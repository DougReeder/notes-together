// storage.js - abstraction for for RemoteStorage and IndexedDB for Notes Together
// Copyright © 2021 Doug Reeder

import removeDiacritics from "./diacritics";
import {initDb, upsertNoteDb, getNoteDb, deleteNoteDb, findStubs} from "./idbNotes";
import RemoteStorage from 'remotestoragejs';
import RemoteNotes from "./RemoteNotes";
import {sanitizeNote} from "./sanitizeNote";

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
                await upsertNote(evt.newValue, true);
              } else {   // delete
                console.log("remoteStorage incoming delete:", evt.oldValue);
                await deleteNoteDb(evt.oldValue.id);
              }
              break;
            case 'conflict':
              if (!evt.oldValue && !evt.newValue) {
                console.log("remoteStorage deleted on both", evt.relativePath);
              } else {
                console.warn("remoteStorage conflict:", evt.lastCommonValue, evt.oldValue, evt.newValue);
              }
              break;
            // case 'local':
            //   console.log("remoteStorage local record:", evt.newValue);
            //   break;
          }
        } catch (err) {
          console.error("remoteStorage notes subscribe:", err);
          // TODO: notify user
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
      console.error("remoteStorage error", err);
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


async function upsertNote(memoryNote, isIndexedDbOnly) {
  const wordSet = new Set();
  const textFilter = function (text) {
    for (const word of parseWords(text)) {
      wordSet.add(word);
    }
    return text;
  }

  let cleanNote;
  if (isIndexedDbOnly) {
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

  await upsertNoteDb(cleanNote);
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
