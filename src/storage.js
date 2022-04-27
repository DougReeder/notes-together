// storage.js - abstraction for for RemoteStorage and IndexedDB for Notes Together
// Copyright © 2021 Doug Reeder

import removeDiacritics from "./diacritics";
import {initDb, upsertNoteDb, getNoteDb, deleteNoteDb, findStubs, checkpointSearch, listSuggestions} from "./idbNotes";
import RemoteStorage from 'remotestoragejs';
import RemoteNotes from "./RemoteNotes";
import {sanitizeNote} from "./sanitizeNote";
import {mergeConflicts} from "./mergeConflicts";
import {createMemoryNote} from "./Note";
import decodeEntities from "./util/decodeEntities";
import hasTagsLikeHtml from "./util/hasTagsLikeHtml";
import {extractUserMessage} from "./util/extractUserMessage";

let initPrms;
let isFirstLaunch;
let persistenceAttempted = false;

function init(dbName) {
  if (!initPrms) {
    initPrms = initDb(dbName).then(async ({indexedDb, isFirstLaunch: isFirstLaunchArg}) => {
      isFirstLaunch = isFirstLaunchArg;
      const remoteStorage = await initRemote();
      return {indexedDb, isFirstLaunch, remoteStorage};
    });
  }
  return initPrms;
}

/** exposed only for testing */
async function changeHandler(evt) {
  try {
    const context = evt.newValue?.['@context'] || evt.oldValue?.['@context'] || evt.lastCommonValue?.['@context'] || '';
    const dataType = /[^/]+$/.exec(context)?.[0];
    switch (dataType) {
      case 'note':   // saved by Notes Together
      case 'text':   // saved by Litewrite
        switch (evt.origin) {   // eslint-disable-line default-case
          case 'remote':
            if (evt.newValue) {   // create or update
              // console.log("remoteStorage incoming upsert:", evt.newValue.id, evt.newValue.title);
              await upsertNote(evt.newValue, 'REMOTE');
            } else {   // delete
              // console.log("remoteStorage incoming delete:", evt.oldValue?.id, evt.oldValue?.title);
              await deleteNoteDb(evt.oldValue.id);
            }
            break;
          case 'conflict':
            if (!evt.oldValue && !evt.newValue) {
              console.warn("remoteStorage deleted on both", evt.relativePath);
              // window.postMessage({kind: 'TRANSIENT_MSG', message: "Deleted on both"}, window?.location?.origin);
            } else if (evt.oldValue && !evt.newValue) {
              console.warn("remoteStorage local change, remote delete:", evt.lastCommonValue, evt.oldValue, evt.newValue);
              requestIdleCallback(async () => {
                try {
                  const title = evt.oldValue?.title || evt.lastCommonValue?.title || "⛏";
                  const message = `Retaining “${title?.split('\n')[0]}”, which was deleted on another device`;
                  window.postMessage({
                    kind: 'TRANSIENT_MSG',
                    severity: 'warning',
                    message: message,
                    key: evt.oldValue.id
                  }, window?.location?.origin);
                  // initiator is **not** 'REMOTE' for this purpose
                  await upsertNote(evt.oldValue);
                } catch (err) {
                  console.error("while handling local change, remote delete:", err);
                }
              });
            } else if (!evt.oldValue && evt.newValue) {
              console.warn("remoteStorage local delete, remote change:", evt.lastCommonValue, evt.oldValue, evt.newValue);
              requestIdleCallback(async () => {
                try {
                  const title = evt.newValue?.title || evt.lastCommonValue?.title || "⛏";
                  const message = `Restoring “${title?.split('\n')[0]}”, which was edited on another device`;
                  window.postMessage({
                    kind: 'TRANSIENT_MSG',
                    severity: 'warning',
                    message: message,
                    key: evt.newValue.id
                  }, window?.location?.origin);
                  // initiator is **not** 'REMOTE' for this purpose
                  await upsertNote(evt.newValue);
                } catch (err) {
                  console.error("while handling local delete, remote change:", err);
                }
              });
            } else {
              console.warn("remoteStorage conflict:", evt.lastCommonValue, evt.oldValue, evt.newValue);
              requestIdleCallback(async () => {
                let cleanNote;
                try {
                  const mergedMarkup = mergeConflicts(evt.oldValue.content, evt.newValue.content);
                  const mergedDate = evt.oldValue.date > evt.newValue.date ? evt.oldValue.date : evt.newValue.date;
                  let mergedMimeType;
                  if (hasTagsLikeHtml(evt.oldValue.mimeType)) {
                    mergedMimeType = evt.oldValue.mimeType;
                  } else if (hasTagsLikeHtml(evt.newValue.mimeType)) {
                    mergedMimeType = evt.newValue.mimeType;
                  } else {
                    mergedMimeType = evt.oldValue.mimeType || evt.newValue.mimeType;
                  }
                  // initiator is **not** 'REMOTE' for this purpose
                  cleanNote = await upsertNote(createMemoryNote(evt.oldValue.id, mergedMarkup, mergedDate, mergedMimeType));
                } catch (err) {
                  console.error("while handling conflict:", err);
                } finally {
                  const title = cleanNote?.title || evt.oldValue?.title || evt.newValue?.title || evt.lastCommonValue?.title || "⛏";
                  const message = `Conflict in “${title?.split('\n')[0]}”`;
                  window.postMessage({
                    kind: 'TRANSIENT_MSG',
                    severity: 'warning',
                    message: message,
                    key: evt.oldValue?.id || evt.newValue?.id
                  }, window?.location?.origin);
                }
              });
            }
            break;
            // case 'local':
            //   console.log("remoteStorage local record:", evt.newValue);
            //   break;
        }
        break;
      case 'savedSearch':
        switch (evt.origin) {   // eslint-disable-line default-case
          case 'remote':
            console.info("remoteStorage incoming savedSearch", evt.relativePath, evt.oldValue, evt.newValue);
            window.postMessage({kind: 'TAG_CHANGE'}, window?.location?.origin);
            break;
          case 'conflict':
            console.warn("remoteStorage incoming savedSearch conflict", evt.relativePath, evt.lastCommonValue, evt.oldValue, evt.newValue);
            requestIdleCallback(async () => {
              await saveTag(parseWords(evt.newValue.original), evt.newValue.original);
              window.postMessage({kind: 'TAG_CHANGE'}, window?.location?.origin);
            });
            break;
        }
        break;
      default:
        // unknown dataType
        console.warn(dataType, evt);
    }
  } catch (err) {
    console.error("remoteStorage documents subscribe:", err, evt);
    window.postMessage({kind: 'TRANSIENT_MSG', message: extractUserMessage(err), key: evt.oldValue?.id || evt.newValue?.id}, window?.location?.origin);
  }
}

let remotePrms;

function initRemote() {
  remotePrms = new Promise((resolve) => {
    const remoteStorage = new RemoteStorage({modules: [RemoteNotes], cache: true});
    remoteStorage.setApiKeys({
      googledrive: '1058652152054-bqj3aev2b7ik8mc2k9co7k4p0f5rvuv2.apps.googleusercontent.com',
      dropbox: 'swcj8jbc9i1jf1m',
    });
    remoteStorage.access.claim('documents', 'rw');

    remoteStorage.caching.enable('/documents/notes/');

    remoteStorage.on('ready', function () {
      console.info("remoteStorage ready");
      resolve(remoteStorage);

      remoteStorage.documents.subscribe(changeHandler);
    });

    remoteStorage.on('connected', async () => {
      const userAddress = remoteStorage.remote.userAddress;
      console.info(`remoteStorage connected to “${userAddress}”`);
    });

    remoteStorage.on('not-connected', function () {
      console.info("remoteStorage not-connected (anonymous mode)", remoteStorage.remote?.token);
    });

    remoteStorage.on('disconnected', function () {
      console.info("remoteStorage disconnected", arguments);
    });

    let lastNotificationTime = 0;
    let lastSyncErrTime = 0;
    const INITIAL_NOTIFICATION_TIMEOUT = 10_000;
    let notificationTimeout = INITIAL_NOTIFICATION_TIMEOUT;
    const TEN_MINUTES = 10 * 60 * 1000;

    remoteStorage.on('error', function (err) {
      console.error("remoteStorage error:" /*, err?.name, err?.message*/ , err);
      if ('Unauthorized' === err?.name) { return; }
      if ("SyncError" === err?.name) {
        const timeDiff = Date.now() - lastNotificationTime;
        if (timeDiff > notificationTimeout - 5000) {
          window.postMessage({kind: 'TRANSIENT_MSG', message: extractUserMessage(err)}, window?.location?.origin);
          lastNotificationTime = Date.now();

          if (Date.now() - lastSyncErrTime > TEN_MINUTES) {
            notificationTimeout = INITIAL_NOTIFICATION_TIMEOUT;
          } else {
            notificationTimeout = Math.min(notificationTimeout * 2, TEN_MINUTES);
          }
        }
        lastSyncErrTime = Date.now();
      } else {
        window.postMessage({kind: 'TRANSIENT_MSG', message: extractUserMessage(err)}, window?.location?.origin);
      }
    });

    remoteStorage.on('network-offline', () => {
      console.debug(`remoteStorage offline now.`);
    });

    remoteStorage.on('network-online', () => {
      console.debug(`remoteStorage back online.`);
    });
  });

  return remotePrms;
}


/**
 * Inserts or updates a note in IDB and RemoteStorage, when needed.
 * @param memoryNote
 * @param initiator: 'REMOTE', 'DETAIL' or undefined
 * @return {Promise<{date: Date, id: number, content: string, title: string}>}
 */
async function upsertNote(memoryNote, initiator) {
  if (!persistenceAttempted && 'REMOTE' !== initiator && !isFirstLaunch && navigator.storage?.persist) {
    persistenceAttempted = true;
    navigator.storage.persist().then(persistent => {
      console.info(persistent ? "Storage will persist until explicit user clear." : "Storage may be cleared by the UA under storage pressure.");
    });
  }

  const wordSet = new Set();
  const textFilter = function (text) {
    for (const word of parseWords(text)) {
      wordSet.add(word);
    }
    return text;
  }

  let cleanNote;
  if ('REMOTE' === initiator) {
    cleanNote = sanitizeNote(memoryNote, textFilter);
  } else {
    const remoteStorage = await remotePrms;
    cleanNote = await remoteStorage.documents.upsert(memoryNote, textFilter);
  }

  for (let candidateWord of wordSet) {
    for (let otherWord of wordSet) {
      if (otherWord !== candidateWord && candidateWord.startsWith(otherWord)) {
        wordSet.delete(otherWord);
      }
    }
  }
  cleanNote.wordArr = Array.from(wordSet);

  await upsertNoteDb(cleanNote, initiator);
  return cleanNote;
}


function deleteNote(id) {
  return remotePrms.then(remoteStorage => {
    return Promise.all([remoteStorage.documents.delete(id), deleteNoteDb(id)]);
  });
}


function parseWords(text) {
  text = removeDiacritics(decodeEntities(text));

  const wordSet = new Set();
  // initializes regexp and its lastIndex property outside the loop
  // ASCII, Unicode, no-break & soft hyphens
  // ASCII apostrophe, right-single-quote, modifier-letter-apostrophe
  const wordRE = /[-‐‑­'’ʼ. ^\wÑñ]+/g;
  let result, normalizedWord;

  while ((result = wordRE.exec(text)) !== null) {
    if ((normalizedWord = normalizeWord(result[0]))) {
      wordSet.add(normalizedWord);
    }
  }
  return wordSet
}

function normalizeWord(word) {
  // ASCII, Unicode, no-break & soft hyphens
  word = word.toUpperCase().replace(/-|‐|‑|­|_| |^'+|'+$|^\.+|\.+$|\^/g, "");
  // not a word containing only digits and decimal points
  if (! /^[\d.]+$/.test(word)) {
    word = word.replace(/\./g, "");
  }
  return word;
}


async function saveTag(searchWords, searchStr) {
  const remoteStorage = await remotePrms;
  return await remoteStorage.documents.upsertTag(searchWords, searchStr);
}

async function deleteTag(searchWords, searchStr) {
  const remoteStorage = await remotePrms;
  return await remoteStorage.documents.deleteTag(searchWords, searchStr);
}

async function listTags() {
  const remoteStorage = await remotePrms;
  return await remoteStorage.documents.getAllTags();
}

export {init, changeHandler, upsertNote, getNoteDb as getNote, deleteNote, findStubs, parseWords, checkpointSearch, listSuggestions, saveTag, deleteTag, listTags};
