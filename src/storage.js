// storage.js - abstraction for for RemoteStorage and IndexedDB for Notes Together
// Copyright © 2021–2024 Doug Reeder

import removeDiacritics from "./diacritics";
import {initDb, upsertNoteDb, getNoteDb, deleteNoteDb, findStubs, findNoteIds, checkpointSearch, listSuggestions} from "./idbNotes";
import RemoteStorage from 'remotestoragejs';
import {RemoteNotes} from "./RemoteNotes";
// import {mergeConflicts} from "./mergeConflicts";
import decodeEntities from "./util/decodeEntities";
import {extractUserMessage, transientMsg} from "./util/extractUserMessage";
import {globalWordRE} from "./util";
import {deserializeNote, serializeNote} from "./serializeNote.js";
import {NodeNote, SerializedNote, shortenTitle} from "./Note.js";   // eslint-disable-line no-unused-vars
import QuietError from "./util/QuietError.js";

const WORD_LENGTH_MAX = 60;
const TAG_LENGTH_MAX = 100;
const STORE_OBJECT_DELAY = 2000;

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
        switch (evt.origin) {
          case 'remote':
            if (evt.newValue) {   // create or update
              // console.log("remoteStorage incoming upsert:", evt.newValue.id, evt.newValue.title);
              await upsertNote(deserializeNote(evt.newValue), 'REMOTE');
            } else {   // delete
              // console.log("remoteStorage incoming delete:", evt.oldValue?.id, evt.oldValue?.title);
              await deleteNoteDb(evt.oldValue.id);
            }
            break;
          case 'conflict':
            if (!evt.oldValue && !evt.newValue) {
              console.warn("remoteStorage deleted on both", evt.relativePath);
              // transientMsg("Deleted on both", 'warning');
            } else if (evt.oldValue && !evt.newValue) {
              console.warn("remoteStorage local change, remote delete:", evt.lastCommonValue, evt.oldValue, evt.newValue);
              requestIdleCallback(async () => {
                try {
                  const shortTitle = shortenTitle(evt.oldValue.title || evt.lastCommonValue?.title || "«untitled»");
                  const message = `Retaining “${shortTitle}”, which was deleted on another device`;
                  transientMsg(message, 'warning');
                  // initiator is conflict resolution, **not** 'REMOTE', for this purpose
                  await upsertNote(deserializeNote(evt.oldValue), undefined);
                } catch (err) {
                  console.error("while handling local change, remote delete:", err);
                }
              });
            } else if (!evt.oldValue && evt.newValue) {
              console.warn("remoteStorage local delete, remote change:", evt.lastCommonValue, evt.oldValue, evt.newValue);
              requestIdleCallback(async () => {
                try {
                  const shortTitle = shortenTitle(evt.newValue.title || evt.lastCommonValue?.title || "«untitled»");
                  const message = `Restoring “${shortTitle}”, which was edited on another device`;
                  transientMsg(message, 'warning');
                  // initiator is **not** 'REMOTE' for this purpose
                  await upsertNote(deserializeNote(evt.newValue), undefined);
                } catch (err) {
                  console.error("while handling local delete, remote change:", err);
                }
              });
            } else {   // changed on both
              if (evt.oldValue.content  === evt.newValue.content &&
                  evt.oldValue.date     === evt.newValue.date &&
                  evt.oldValue.mimeType === evt.newValue.mimeType &&
                  evt.oldValue.isLocked === evt.newValue.isLocked) {
                console.warn("remoteStorage same change locally & remote:", evt.lastCommonValue, evt.oldValue, evt.newValue);
                await upsertNote(deserializeNote(evt.newValue), 'DETAIL');   // DETAIL prevents re-render
                break;
              }
              console.warn("remoteStorage changed on both:", evt.lastCommonValue, evt.oldValue, evt.newValue);
              // setTimeout(async () => {
              //   let mergedNote;
              //   try {
              //     const oldDate = normalizeDate(evt.oldValue.date);
              //     const newDate = normalizeDate(evt.newValue.date);
              //     const mergedDate = oldDate > newDate ? oldDate : newDate;
              //     let mergedMimeType, documentHasTags;
              //     if (hasTagsLikeHtml(evt.oldValue.mimeType)) {
              //       mergedMimeType = evt.oldValue.mimeType;
              //       documentHasTags = true;
              //     } else if (hasTagsLikeHtml(evt.newValue.mimeType)) {
              //       mergedMimeType = evt.newValue.mimeType;
              //       documentHasTags = true;
              //     } else {
              //       mergedMimeType = evt.oldValue.mimeType || evt.newValue.mimeType;
              //       documentHasTags = false;
              //     }
              //     let mergedIsLocked = Boolean(evt.oldValue.isLocked || evt.newValue.isLocked);
              //     const mergedMarkup = mergeConflicts(evt.oldValue.content, evt.newValue.content, documentHasTags);
              //     mergedNote = new SerializedNote(evt.oldValue.id, mergedMimeType, "", mergedMarkup, mergedDate, mergedIsLocked, []);
              //     // initiator is conflict resolution, **not** 'REMOTE', for this purpose
              //     await upsertNote(deserializeNote(mergedNote), undefined);
              //   } catch (err) {
              //     console.error("while handling conflict:", err);
              //   } finally {
              //     const title = mergedNote?.title || evt.oldValue?.title || evt.newValue?.title || evt.lastCommonValue?.title || "«untitled»";
              //     const message = `Edit “${shortenTitle(title)}” then select ‘Clear Deleted & Inserted styles’`;
              //     transientMsg(message, 'warning');
              //   }
              // }, 0);
            }
            break;
            // case 'local':
            //   console.log("remoteStorage local record:", evt.newValue);
            //   break;
        }
        break;
      case 'savedSearch':
        switch (evt.origin) {
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
        // unknown or undefined dataType
        console.warn(`foreign document amid notes, of type “${dataType}”`, evt);
    }
  } catch (err) {
    if (!(err instanceof QuietError)) {
      console.error("remoteStorage changeHandler:", err, evt);
      transientMsg(extractUserMessage(err));
    }
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
    const INITIAL_NOTIFICATION_TIMEOUT = 60_000;
    let notificationTimeout = INITIAL_NOTIFICATION_TIMEOUT;
    const TEN_MINUTES = 10 * 60 * 1000;

    remoteStorage.on('error', function (err) {
      // console.error("remoteStorage error:" /*, err?.name, err?.message*/ , err);
      if ('Unauthorized' === err?.name) { return; }
      if ("SyncError" === err?.name) {
        const timeDiff = Date.now() - lastNotificationTime + 8000;
        if (timeDiff > notificationTimeout) {
          transientMsg(extractUserMessage(err), 'warning');
          lastNotificationTime = Date.now();

          if (Date.now() - lastSyncErrTime > TEN_MINUTES) {
            notificationTimeout = INITIAL_NOTIFICATION_TIMEOUT;
          } else {
            notificationTimeout = Math.min(notificationTimeout * 2, TEN_MINUTES);
          }
        }
        lastSyncErrTime = Date.now();
      } else {
        console.error(`unforeseen remoteStorage error:`, err);
        transientMsg(extractUserMessage(err));
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


const isBusy = new Map();   // per-ID
const queue  = new Map();   // queue of length one per ID

/**
 * Inserts or updates a note in IDB and (if needed) RemoteStorage.
 * @param {NodeNote} nodeNote should have been created by NodeNote constructor
 * @param {string} initiator
 * @returns {Promise<NodeNote|SerializedNote>} NodeNote if busy, SerializedNote if not
 */
async function upsertNote(nodeNote, initiator) {
  const id = nodeNote.id;
  queue.set(id, {note: NodeNote.clone(nodeNote), initiator});   // when busy, overwrites any previous value
  return await storeQueued(id);   // return expected to be serialized note
}

/**
 *
 * @param {string} id uuid
 * @returns {Promise<NodeNote|SerializedNote>} NodeNote if busy, SerializedNote if not
 */
async function storeQueued(id) {
  if (isBusy.get(id)) {
    return queue.get(id)?.note;   // No error is thrown to caller if storing fails later
  } else {   // ok to store object
    const {note, initiator} = queue.get(id) || {};
    queue.delete(id);   // empties the queue
    if (!note) { return null; }
    try {
      isBusy.set(id, true);

      const result = await upsertSerializedNote(await serializeNote(note), initiator);

      setTimeout(checkQueue, STORE_OBJECT_DELAY, id);

      return result;   // expected to be serialized note
    } catch (err) {
      isBusy.delete(id);
      throw err;
    }
  }
}

/**
 * Inserts or updates a note in IDB and (if needed) RemoteStorage.
 * Spaces updates STORE_OBJECT_DELAY apart, for each ID.
 * @param {SerializedNote} serializedNote
 * @param {String} [initiator] 'REMOTE', 'DETAIL' or undefined
 * @return {Promise<SerializedNote>}
 */
async function upsertSerializedNote(serializedNote, initiator) {
  if ('string' !== typeof serializedNote.title) { throw new Error("title must be string"); }
  if ('string' !== typeof serializedNote.content) { throw new Error("content must be string"); }
  if (! (serializedNote.date instanceof Date)) { throw new Error("date must be of type Date"); }
  if (!Array.isArray(serializedNote.wordArr)) { throw new Error("wordArr must be array"); }

  if (!persistenceAttempted && 'REMOTE' !== initiator && !isFirstLaunch && navigator.storage?.persist) {
    persistenceAttempted = true;
    navigator.storage.persist().then(persistent => {
      console.info(persistent ? "Storage will persist until explicit user clear." : "Storage may be cleared by the UA under storage pressure.");
    });
  }

  const promises = [upsertNoteDb(serializedNote, initiator)];
  if ('REMOTE' !== initiator) {
    promises.push(remotePrms.then(remoteStorage => remoteStorage.documents.upsert(serializedNote)));
  }
  return (await Promise.all(promises))[0];
}

async function checkQueue(id) {
  try {
    isBusy.delete(id);
    await storeQueued(id);
  } catch(err) {   // This is a top-level catch.
    if (! (err instanceof QuietError)) {
      console.error(`while checking/storing queued [${id}]:`, err);
      transientMsg("while storing queued: " + extractUserMessage(err));
    }
  }
}


async function deleteNote(id, force) {
  const remoteStorage = await remotePrms;
  if (!force) {
    const note = await getNoteDb(id);
    if (note?.isLocked) {
      const shortTitle = note.title?.split(/\r\n|\n|\r/)?.[0]?.slice(0, 24) + "...";
      const message = `not deleting “${shortTitle}” which is locked.`;
      // console.warning(message);
      const err = new Error(message);
      err.severity = 'warning';
      err.userMsg = `First, unlock “${shortTitle}”`;
      throw err;
    }
  }
  return Promise.all([remoteStorage.documents.delete(id), deleteNoteDb(id)]);
}


function parseWords(text) {
  text = decodeEntities(text);

  const wordSet = new Set();
  // initializes regexp and its lastIndex property outside the loop
  // ASCII, Unicode, no-break & soft hyphens
  // ASCII apostrophe, right-single-quote, modifier-letter-apostrophe
  const wordRE = new RegExp(globalWordRE);
  let result, normalizedWord;

  while ((result = wordRE.exec(text)) !== null) {
    if ((normalizedWord = normalizeWord(removeDiacritics(result[0])))) {
      wordSet.add(normalizedWord);
    }
  }
  return wordSet
}

function normalizeWord(word) {
  // ASCII, Unicode, no-break & soft hyphens
  word = word.toUpperCase().replace(/^['.]+|['.]+$|-|‐|‑|­|_| | | |\^/g, "");
  if (/^[\d.]+$/.test(word)) {   // word containing only digits and decimal points
    word = word.replace(/\.{3,}/g, "..");
  } else {
    word = word.replace(/\./g, "");
  }
  return word.slice(0, WORD_LENGTH_MAX);
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

export {WORD_LENGTH_MAX, TAG_LENGTH_MAX, STORE_OBJECT_DELAY, init, changeHandler, upsertNote, getNoteDb as getNote, deleteNote, findStubs, findNoteIds, parseWords, normalizeWord, checkpointSearch, listSuggestions, saveTag, deleteTag, listTags};
