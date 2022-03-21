// idbNotes.js - IndexedDB code for Notes Together
// Should only be called by storage abstraction, not from front end.
// Copyright © 2021-2022 Doug Reeder

import {v4 as uuidv4} from "uuid";
import {extractUserMessage} from "./util/extractUserMessage";

const FIRST_RESULTS_MS = 84;
const MAX_NOTES_FOUND = 500;
const dbNameDefault = "noteDb";
let dbPrms;

function initDb(dbName = dbNameDefault) {
  dbPrms = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      const err = new Error("missing IndexedDB: " + navigator.userAgent);
      err.userMsg = "This browser is too old to run Notes Together. Try the current version of Firefox or Chrome.";
      return reject(err);
    }

    const openRequest = indexedDB.open(dbName, 2);
    openRequest.onerror = function (evt) {
      console.error("IDB initDb:", evt.target.error || evt.target);
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
      if (evt.oldVersion < 2) {
        const searchStore = theDb.createObjectStore('search', {keyPath: 'normalized'});
        searchStore.createIndex('byCount', 'count', {unique: false});
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
    window.postMessage({kind: 'TRANSIENT_MSG', message: extractUserMessage(err)}, window?.location?.origin);
  });

  return dbPrms;
}


let findStubsTransaction;
/**
 * Searches for notes which match (as a prefix) each word in searchStr.
 * Returns *stubs*: notes with title but not the full content.
 * @param searchWords Set of keywords
 * @param callback may be called *multiple* times; isPartial means there are more results; isFinal means no more results will be returned; *both* will be true when there are more than MAX_NOTES_FOUND matching notes
 */
function findStubs(searchWords, callback) {
  dbPrms.then(db => {
    if (findStubsTransaction) {
      // aborts any pending call in favor of this call
      // console.warn(`Aborting previous fetchNotes transaction. New searchStr: "${searchStr}"`);
      findStubsTransaction.abort();
    }
    findStubsTransaction = db.transaction('note', "readonly");
    findStubsTransaction.onerror = function (evt) {
      const msg = evt.target.errorMessage || evt.target.error.message || evt.target.error.name || evt.target.error.toString() || evt.target.errorCode;
      if (evt.target.error?.name === 'AbortError') {
        console.log("IDB:", evt.target.error?.name, msg);
      } else {
        console.error("IDB findStubs:", evt.target.error);
        findStubsTransaction = null;
        callback(evt.target.error);
      }
      evt.stopPropagation();
    };
    // findStubsTransaction.onabort = function (evt) {
    //   console.log("xaction aborted for", searchStr);
    //   evt.stopPropagation();
    // }
    const noteStore = findStubsTransaction.objectStore("note");

    if (searchWords.size === 0) {
      sortedStubs(callback, noteStore);
    } else {
      searchStubs(callback, noteStore, new Set(searchWords));
    }
  }).catch(err => {
    findStubsTransaction = null;
    callback(err);
  });
}
function sortedStubs(callback, itemStore) {
  const foundStubs = [];
  let lastCallback = Date.now();
  let isFirstResults = true;
  const cursorRequest = itemStore.index('byDate').openCursor(null, "prev");
  cursorRequest.onsuccess = function(evt) {
    try {
      const cursor = evt.target.result;
      if (!cursor) {   // all notes retrieved
        findStubsTransaction = null;
        callback(null, foundStubs, {isPartial: false, isFinal: true, isSearch: false});
      } else {
//						console.log(cursor.key, cursor.value);

        if (foundStubs.length === MAX_NOTES_FOUND) {
          findStubsTransaction = null;
          callback(null, foundStubs, {isPartial: true, isFinal: true, isSearch: false});
          return;   // abandon cursor by not advancing
        }

        foundStubs.push({
          id: cursor.value.id,
          title: cursor.value.title,
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
      findStubsTransaction = null;
      callback(err);
    }
  };
}
function searchStubs(callback, itemStore, searchWords) {
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
          findStubsTransaction = null;
          callback(null, foundStubs, {isPartial: true, isFinal: true, isSearch: true});
          return;   // abandon cursor by not continuing
        }

        foundStubs.push({
          id: cursor.value.id,
          title: cursor.value.title,
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
        findStubsTransaction = null;
        callback(null, foundStubs, {isPartial: false, isFinal: true, isSearch: true});
      }
    } catch (err) {
      findStubsTransaction = null;
      callback(err);
    }
  };
}

function compareByDate(itemA, itemB) {
  return itemB.date - itemA.date;
}


function getNoteDb(id) {
  return dbPrms.then(db => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('note', "readonly");
      const itemStore = transaction.objectStore("note");
      const getRequest = itemStore.get(id);
      getRequest.onsuccess = function (evt) {
        resolve(evt.target.result);   // undefined if missing
      };
      getRequest.onerror = function (evt) {
        console.error("IDB getNoteDb:", evt.target.error);
        evt.stopPropagation();
        reject(evt.target.error);
      };
    });
  });
}

function upsertNoteDb(cleanNote, initiator) {
  return dbPrms.then(db => {
    if (!('wordArr' in cleanNote)) {
      throw new Error("wordArr required for full-text search");
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('note', "readwrite");
      const noteStore = transaction.objectStore("note");
      const putRequest = noteStore.put(cleanNote);
      putRequest.onsuccess = function (evt) {
        // noteService.setFirstUnexportedChange().then(function (prefResult) {
        if (evt.target.result === cleanNote.id) {   // TODO: remove this backstop
          const notesChanged = {};
          notesChanged[cleanNote.id] = cleanNote;   // postMessage will clone
          // console.log("IDB: upsertNoteDb", note.id, note.content?.slice(0, 50));
          window.postMessage({kind: 'NOTE_CHANGE', initiator, notesChanged, notesDeleted: {}}, window?.location?.origin);
          resolve(cleanNote);
        } else {
          reject(new Error(`saved id ${evt.target?.result} doesn't match passed id ${cleanNote.id}`))
        }
        // });
      };
      putRequest.onerror = function (evt) {
        console.error("IDB upsertNoteDb:", evt.target.error);
        evt.stopPropagation();
        reject(evt.target.error);
      };
    });
  });
}

function deleteNoteDb(id) {
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
          }, window.location?.origin);

          // evt.target.result is always undefined
          resolve(id);
        } catch (err) {
          console.error("IDB deleteNoteDb 1:", err);
          reject(err);
        }
      };
      deleteRequest.onerror = function (evt) {
        console.error("IDB deleteNoteDb 2:", evt.target.error);
        evt.stopPropagation();
        reject(evt.target.error);
      };
    });
  });
}


function findFillerNoteIds() {
  return dbPrms.then(db => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('note', 'readonly');
      transaction.onerror = function (evt) {
        console.error("IDB findFillerNoteIds x:", evt.target.error);
        reject(evt.target.error);
      }
      const noteStore = transaction.objectStore("note");
      const noteIds = new Set();
      const random = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255];
      noteStore.openCursor(IDBKeyRange.upperBound(uuidv4({random}), false)).onsuccess = function (evt) {
        try {
          const cursor = evt.target.result;
          if (cursor) {
            noteIds.add(cursor.key);
            cursor.continue();
          } else {
            resolve(noteIds);
          }
        } catch (err) {
          console.error("IDB findFillerNoteIds:", err);
          reject(err);
        }
      }
    });
  });
}


function checkpointSearch(searchWords, searchStr) {
  return dbPrms.then(db => {
    return new Promise((resolve, reject) => {
      if (!(searchWords instanceof Set)) {
        return reject(new Error(`“${searchWords}” is not a Set`));
      }
      if ('string' !== typeof searchStr) {
        return reject(new Error(`“${searchStr}” is not a string`));
      }
      if (0 === searchWords.size) {
        return resolve(0);
      }
      if (1 === searchWords.size) {
        if (Array.from(searchWords).every(word => word.length < 2)) {
          return resolve(0);
        }
      }
      const normalized = Array.from(searchWords.values()).sort().join(' ');

      const transaction = db.transaction('search', "readwrite", {durability: "relaxed"});
      const searchStore = transaction.objectStore("search");
      const getRequest = searchStore.get(normalized);
      getRequest.onsuccess = function (evt) {
        const newCount = (evt.target.result?.count || 0) + 1;
        const putRequest = searchStore.put({normalized, original: searchStr, count: newCount});
        putRequest.onsuccess = function (evt) {
          resolve(newCount);
        }
        putRequest.onerror = function (evt) {
          console.error("IDB checkpointSearch put:", evt.target.error);
          evt.stopPropagation();
          reject(evt.target.error);
        };
      };
      getRequest.onerror = function (evt) {
        console.error("IDB checkpointSearch get:", evt.target.error);
        evt.stopPropagation();
        reject(evt.target.error);
      };
    });
  });
}

function listSuggestions(max) {
  return dbPrms.then(db => {
    return new Promise((resolve, reject) => {
      if ('number' !== typeof max) {
        reject(new Error(`“${max}” is not a number`));
      }
      if (max < 1) {
        resolve(new Map());
      }

      const suggestions = new Map();
      const transaction = db.transaction('search', "readonly", {durability: "relaxed"});
      const searchStore = transaction.objectStore("search");
      const cursorRequest = searchStore.index('byCount').openCursor(null, "prev");
      cursorRequest.onsuccess = function(evt) {
        try {
          const cursor = evt.target.result;
          if (cursor) {
            // console.log("suggestion:", cursor.primaryKey, cursor.value);
            suggestions.set(cursor.value.original, cursor.value.normalized);
            if (suggestions.size < max) {
              cursor.continue();
            } else {
              resolve(suggestions);
            }
          } else {   // no more suggestions
            resolve(suggestions);
          }
        } catch (err) {
          reject(err);
        }
      };
    });
  });
}

export {initDb, findStubs, getNoteDb, upsertNoteDb, deleteNoteDb, findFillerNoteIds, checkpointSearch, listSuggestions};
