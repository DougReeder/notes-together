// storage.js - abstraction for for RemoteStorage and IndexedDB for Notes Together
// Copyright © 2021 Doug Reeder

import removeDiacritics from "./diacritics";
import {initDb, upsertNoteDb, getNoteDb, deleteNoteDb, findStubs} from "./idbNotes";
import RemoteStorage from 'remotestoragejs';
import RemoteNotes from "./RemoteNotes";
import {sanitizeNote} from "./sanitizeNote";
import {mergeConflicts} from "./mergeConflicts";
import {createMemoryNote} from "./Note";

let initPrms;

function init(dbName) {
  if (!initPrms) {
    initPrms = initDb(dbName).then(initRemote);
  }
  return initPrms;
}

let remotePrms;

function initRemote() {
  remotePrms = new Promise((resolve) => {
    const remoteStorage = new RemoteStorage({modules: [RemoteNotes], cache: true});
    remoteStorage.access.claim('notes', 'rw');

    remoteStorage.caching.enable('/notes/');

    remoteStorage.on('ready', function () {
      console.log("remoteStorage ready");
      resolve(remoteStorage);

      remoteStorage.notes.subscribe(async evt => {
        try {
          switch (evt.origin) {   // eslint-disable-line default-case
            case 'remote':
              if (evt.newValue) {   // create or update
                console.log("remoteStorage incoming upsert:", evt.newValue);
                await upsertNote(evt.newValue, 'REMOTE');
              } else {   // delete
                console.log("remoteStorage incoming delete:", evt.oldValue);
                await deleteNoteDb(evt.oldValue.id);
              }
              break;
            case 'conflict':
              if (!evt.oldValue && !evt.newValue) {
                console.log("remoteStorage deleted on both", evt.relativePath);
                // window.postMessage({kind: 'TRANSIENT_MSG', message: "Deleted on both"}, window?.location?.origin);
              } else if (evt.oldValue && !evt.newValue) {
                console.warn("remoteStorage local change, remote delete:", evt.lastCommonValue, evt.oldValue, evt.newValue);
                requestIdleCallback(async () => {
                  try {
                    const title = evt.oldValue?.title || evt.lastCommonValue?.title || "⛏";
                    const message = `Restoring “${title?.split('\n')[0]}”, which was deleted on another device`;
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
                    const mergedMarkup = mergeConflicts(evt.oldValue.text, evt.newValue.text);
                    const mergedDate = evt.oldValue.date > evt.newValue.date ? evt.oldValue.date : evt.newValue.date;
                    // initiator is **not** 'REMOTE' for this purpose
                    cleanNote = await upsertNote(createMemoryNote(evt.oldValue.id, mergedMarkup, mergedDate));
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
        } catch (err) {
          console.error("remoteStorage notes subscribe:", err);
          window.postMessage({kind: 'TRANSIENT_MSG', message: err.userMsg || err.message, key: evt.oldValue?.id || evt.newValue?.id}, window?.location?.origin);
        }
      });
    });

    remoteStorage.on('connected', async () => {
      const userAddress = remoteStorage.remote.userAddress;
      console.log(`remoteStorage connected to “${userAddress}”`);
    });

    remoteStorage.on('not-connected', function () {
      console.log("remoteStorage not-connected (anonymous mode)", remoteStorage.remote.token);
    });

    remoteStorage.on('disconnected', function () {
      console.log("remoteStorage disconnected", arguments);
    });

    remoteStorage.on('error', function (err) {
      console.error("remoteStorage error", err.name, err.message);
      if ('Unauthorized' === err.name) { return; }
      window.postMessage({kind: 'TRANSIENT_MSG', message: err.message}, window?.location?.origin);
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
 * @return {Promise<{date: Date, id: number, text: string}>}
 */
async function upsertNote(memoryNote, initiator) {
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
    cleanNote = await remoteStorage.notes.upsert(memoryNote, textFilter);
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
    return Promise.all([remoteStorage.notes.delete(id), deleteNoteDb(id)]);
  });
}


function parseWords(text) {
  text = removeDiacritics(text);

  const wordSet = new Set();
  // initializes regexp and its lastIndex property outside the loop
  // ASCII, Unicode, no-break & soft hyphens
  // ASCII apostrophe, right-single-quote, modifier-letter-apostrophe
  const wordRE = /[-‐‑­'’ʼ.^\wÑñ]+/g;
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
  word = word.toUpperCase().replace(/-|‐|‑|­|_|^'+|'+$|^\.+|\.+$|\^/g, "");
  // not a word containing only digits and decimal points
  if (! /^[\d.]+$/.test(word)) {
    word = word.replace(/\./g, "");
  }
  return word;
}

export {init, upsertNote, getNoteDb as getNote, deleteNote, findStubs, parseWords};
