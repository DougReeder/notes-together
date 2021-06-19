// idbNotes.js - IndexedDB facade for Notes Together
// Copyright © 2021 Doug Reeder

import removeDiacritics from "./diacritics";
import {INCIPIT_LENGTH, semanticOnly} from "./Note";
import sanitizeHtml from "sanitize-html";

const FIRST_RESULTS_MS = 84;
const MAX_NOTES_FOUND = 500;
const dbNameDefault = "noteDb";
let dbPrms;

function init(dbName = dbNameDefault) {
  dbPrms = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      const err = new Error("missing IndexedDB: " + navigator.userAgent);
      err.userMsg = "This browser is too old to run Notes Together. Try the current version of Firefox or Chrome.";
      return reject(err);
    }

    const openRequest = indexedDB.open(dbName, 1);
    openRequest.onerror = function (evt) {
      console.error("IDB init:", evt.target.error || evt.target);
      const err = evt.target?.error || new Error(evt.target.toString());
      if (evt.target.error?.name === 'InvalidStateError') {
        err.userMsg = "Private Browsing mode prohibits storing anything.  Run Notes Together in a non-private window.";
      } else {
        err.userMsg = "Restart your device. Can't open database.";
      }
      reject(err);
    };

    openRequest.onupgradeneeded = function (evt) {
      console.log(`IDB: upgrading version ${evt.oldVersion} to ${evt.newVersion}`);
      const theDb = evt.target.result;
      if (evt.oldVersion < 1) {
        const objectStore = theDb.createObjectStore('note', {keyPath: 'id', autoIncrement: false});
        objectStore.createIndex('byDate', 'date', {});
        const wordsInd = objectStore.createIndex('byWords', 'wordArr', {unique: false, multiEntry: true});
        if (!wordsInd.multiEntry) {
          console.error("IDB: bad wordsInd:", wordsInd.name, wordsInd.keyPath, wordsInd.multiEntry, wordsInd.unique);
          const msg = "This browser does not support full-text search. Try the current version of Firefox or Chrome.";
          reject(new Error(msg));
        }
      }
    };

    openRequest.onsuccess = function (evt) {
      // console.log('IDB: open succeeded:', openRequest.result.name, openRequest.result.version, openRequest.result.objectStoreNames);
      openRequest.result.onerror = function (evt2) {
        // This handles errors not caught at the transaction or above.
        console.error("IDB: db.onerror:", evt2.target?.error || evt2.target);
        const msg = evt2.target.errorMessage || evt2.target.error.name || evt2.target.error.toString() || evt2.target.errorCode;
        alert(msg);
      };
      resolve(openRequest.result)
    };
  });

  dbPrms.catch(err => {
    window?.alert(err.userMsg || err.message);
  });

  return dbPrms;
}


let findNotesTransaction;
/**
 * Searches for notes which match (as a prefix) each word in searchStr.
 * Returns *stubs*: notes with incipit instead of the full text.
 * @param searchWords Set of keywords
 * @param callback may be called *multiple* times; isPartial means there are more results; isFinal means no more results will be returned; *both* will be true when there are more than MAX_NOTES_FOUND matching notes
 */
function findNotes(searchWords, callback) {
  dbPrms.then(db => {
    if (findNotesTransaction) {
      // aborts any pending call in favor of this call
      // console.warn(`Aborting previous fetchNotes transaction. New searchStr: "${searchStr}"`);
      findNotesTransaction.abort();
    }
    findNotesTransaction = db.transaction('note', "readonly");
    findNotesTransaction.onerror = function (evt) {
      const msg = evt.target.errorMessage || evt.target.error.message || evt.target.error.name || evt.target.error.toString() || evt.target.errorCode;
      if (evt.target.error?.name === 'AbortError') {
        console.log("IDB:", evt.target.error?.name, msg);
      } else {
        console.error("IDB findNotes:", evt.target.error);
        callback(evt.target.error);
        // TODO: user-visible transient message
      }
      evt.stopPropagation();
      findNotesTransaction = null;
    };
    // findNotesTransaction.onabort = function (evt) {
    //   console.log("xaction aborted for", searchStr);
    //   evt.stopPropagation();
    // }
    const noteStore = findNotesTransaction.objectStore("note");

    if (searchWords.size === 0) {
      sortedNotes(callback, noteStore);
    } else {
      searchNotes(callback, noteStore, new Set(searchWords));
    }
  }).catch(err => {
    callback(err);
  });
}
function sortedNotes(callback, itemStore) {
  const foundStubs = [];
  let lastCallback = Date.now();
  let isFirstResults = true;
  const cursorRequest = itemStore.index('byDate').openCursor(null, "prev");
  cursorRequest.onsuccess = function(evt) {
    try {
      const cursor = evt.target.result;
      if (!cursor) {   // all notes retrieved
        findNotesTransaction = null;
        callback(null, foundStubs, {isPartial: false, isFinal: true, isSearch: false});
      } else {
//						console.log(cursor.key, cursor.value);

        if (foundStubs.length === MAX_NOTES_FOUND) {
          findNotesTransaction = null;
          callback(null, foundStubs, {isPartial: true, isFinal: true, isSearch: false});
          return;   // abandon cursor by not advancing
        }

        foundStubs.push({
          id: cursor.value.id,
          incipit: cursor.value.text.slice(0, INCIPIT_LENGTH),
          date: cursor.value.date,
        });
        if ((isFirstResults && Date.now() - lastCallback > FIRST_RESULTS_MS) || (Date.now() - lastCallback > 1000)) {
          isFirstResults = false;
          lastCallback = Date.now();
          callback(null, foundStubs, {isPartial: true, isFinal: false, isSearch: false});
        }
        cursor.continue();
      }
    } catch (err) {
      findNotesTransaction = null;
      callback(err);
    }
  };
}
function searchNotes(callback, itemStore, searchWords) {
  // Finds the longest word, which will probably narrow the search the most.
  let indexWord = "";
  for (let word of searchWords) {
    if (word.length > indexWord.length) {
      indexWord = word;
    }
  }
  searchWords.delete(indexWord);
  const endWord = indexWord.slice(0, -1) + String.fromCharCode(indexWord.charCodeAt(indexWord.length - 1) + 1);
  // console.log(`searching from ${indexWord} to ${endWord}`, searchWords)

  const index = itemStore.index('byWords');
  const foundStubs = [];
  const foundIds = new Set();
  let lastCallback = Date.now();
  let isFirstResults = true;
  const cursorRequest = index.openCursor(IDBKeyRange.bound(indexWord, endWord, false, true));
  cursorRequest.onsuccess = function (evt) {
    try {
      const cursor = evt.target.result
      if (cursor) {
        // A note might be indexed under "their" and "then".
        // The search word "the" would match both entries.
        if (foundIds.has(cursor.value.id)) {
          return cursor.continue();
        }
        for (const searchWord of searchWords) {
          if (!cursor.value.wordArr.some(noteWord => noteWord.startsWith(searchWord))) {
            return cursor.continue();
          }
        }

        if (foundStubs.length === MAX_NOTES_FOUND) {
          foundStubs.sort(compareByDate);
          findNotesTransaction = null;
          callback(null, foundStubs, {isPartial: true, isFinal: true, isSearch: true});
          return;   // abandon cursor by not continuing
        }

        foundStubs.push({
          id: cursor.value.id,
          incipit: cursor.value.text.slice(0, INCIPIT_LENGTH),
          date: cursor.value.date,
        });
        foundIds.add(cursor.value.id);

        if ((isFirstResults && Date.now() - lastCallback > FIRST_RESULTS_MS) || (Date.now() - lastCallback > 1000)) {
          isFirstResults = false;
          lastCallback = Date.now();
          callback(null, foundStubs, {isPartial: true, isFinal: false, isSearch: true});
        }
        cursor.continue();
      } else {   // no cursor -> end
        foundStubs.sort(compareByDate);
        findNotesTransaction = null;
        callback(null, foundStubs, {isPartial: false, isFinal: true, isSearch: true});
      }
    } catch (err) {
      findNotesTransaction = null;
      callback(err);
    }
  };
}

function compareByDate(itemA, itemB) {
  return itemB.date - itemA.date;
}


function getNote(id) {
  return dbPrms.then(db => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('note', "readonly");
      const itemStore = transaction.objectStore("note");
      const getRequest = itemStore.get(id);
      getRequest.onsuccess = function (evt) {
        if (evt.target.result) {
          resolve(evt.target.result);
        } else {
          const err = new Error("no note with id=" + id);
          console.log("getNote:", err.message);
          err.name = "MissingError";
          reject(err);
        }
      };
      getRequest.onerror = function (evt) {
        console.error("IDB getNote:", evt.target.error);
        evt.stopPropagation();
        reject(evt.target.error);
      };
    });
  });
}

function upsertNote(note) {
  return dbPrms.then(db => {
    const dbNote = toDbNote(note);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('note', "readwrite");
      const noteStore = transaction.objectStore("note");
      const putRequest = noteStore.put(dbNote);
      putRequest.onsuccess = function (evt) {
        // noteService.setFirstUnexportedChange().then(function (prefResult) {
        if (evt.target.result === dbNote.id) {   // TODO: remove this backstop
          const notesChanged = {};
          notesChanged[dbNote.id] = dbNote;   // postMessage will clone
          // console.log("IDB: upsertNote", dbNote.id, dbNote.text?.slice(0, 50));
          window.postMessage({kind: 'NOTE_CHANGE', notesChanged, notesDeleted: {}}, window?.location?.origin);
          resolve(dbNote);
        } else {
          reject(new Error(`saved id ${evt.target?.result} doesn't match passed id ${dbNote.id}`))
        }
        // });
      };
      putRequest.onerror = function (evt) {
        console.error("IDB upsertNote:", evt.target.error);
        evt.stopPropagation();
        reject(evt.target.error);
      };
    });
  });
}

function deleteNote(id) {
  return dbPrms.then(db => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('note', "readwrite");
      const itemStore = transaction.objectStore("note");
      const deleteRequest = itemStore['delete'](id);
      deleteRequest.onsuccess = function (evt) {
        try {
          // noteService.setFirstUnexportedChange().then(function (prefResult) {
          const notesDeleted = {};
          notesDeleted[id] = true;
          window.postMessage({
            kind: 'NOTE_CHANGE',
            notesChanged: {},
            notesDeleted
          }, window.location.origin);

          // evt.target.result is always undefined
          resolve(id);
        } catch (err) {
          console.error("IDB deleteNote 1:", err);
          reject(err);
        }
      };
      deleteRequest.onerror = function (evt) {
        console.error("IDB deleteNote 2:", evt.target.error);
        evt.stopPropagation();
        reject(evt.target.error);
      };
    });
  });
}


const semanticExtractKeywords = JSON.parse(JSON.stringify(semanticOnly));

function toDbNote(memoryNote) {
  if (!Number.isFinite(memoryNote.id)) {
    throw new Error("id must be finite");
  } else if ('string' !== typeof memoryNote.text) {
    throw new Error("text must be string");
  }

  const wordSet = new Set();
  semanticExtractKeywords.textFilter = function (text) {
    const someWords = parseWords(text);
    for (let word of someWords) {
      wordSet.add(word);
    }
    return text;
  }
  const sanitizedText = sanitizeHtml(memoryNote.text, semanticExtractKeywords);
  for (let candidateWord of wordSet) {
    for (let otherWord of wordSet) {
      if (otherWord !== candidateWord && candidateWord.startsWith(otherWord)) {
        wordSet.delete(otherWord);
      }
    }
  }

  return {
    id: memoryNote.id,
    text: sanitizedText,
    wordArr: Array.from(wordSet),
    date: memoryNote.date || new Date(),
  };
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


function deleteFillerNotes() {
  return dbPrms.then(db => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('note', 'readwrite');
      transaction.onerror = function (evt) {
        console.error("IDB deleteFillerNotes x:", evt.target.error);
        reject(evt.target.error);
      }
      const noteStore = transaction.objectStore("note");
      const notesDeleted = {};
      noteStore.openCursor(IDBKeyRange.lowerBound(Number.MAX_SAFE_INTEGER, true)).onsuccess = function (evt) {
        try {
          const cursor = evt.target.result;
          if (cursor) {
            const id = cursor.key;
            cursor.delete().onsuccess = function (evt2) {
              notesDeleted[id] = true;
            }
            cursor.continue();
          } else {
            window.postMessage({
              kind: 'NOTE_CHANGE',
              notesChanged: {},
              notesDeleted
            }, window.location.origin);
            resolve(notesDeleted);
          }
        } catch (err) {
          console.error("IDB deleteFillerNotes:", err);
          reject(err);
        }
      }
    });
  });
}


export {init, findNotes, getNote, upsertNote, deleteNote, toDbNote, parseWords, deleteFillerNotes};
