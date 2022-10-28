// idbNotes.js - IndexedDB code for Notes Together
// Should only be called by storage abstraction, not from front end.
// Copyright © 2021-2022 Doug Reeder

import {v4 as uuidv4} from "uuid";
import {extractUserMessage} from "./util/extractUserMessage";
import {createMemoryNote} from "./Note";

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

    const openRequest = indexedDB.open(dbName, 3);
    openRequest.onerror = function (evt) {
      console.error("IDB initDb:", evt.target.error || evt.target);
      const err = evt.target?.error || new Error(evt.target.toString());
      if (evt.target.error?.name === 'InvalidStateError') {
        err.userMsg = "Private Browsing mode prohibits storing anything.  Run Notes Together in a non-private window.";
      } else {
        err.userMsg = "Restart your browser. Can't open database.";
      }
      reject(err);
    };

    let isFirstLaunch = false;

    openRequest.onupgradeneeded = function (evt) {
      console.info(`IDB: upgrading version ${evt.oldVersion} to ${evt.newVersion}`);
      const theDb = evt.target.result;
      if (evt.oldVersion < 1) {
        isFirstLaunch = true;

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
        searchStore.createIndex('byScore', 'score', {unique: false});
      }
      if (evt.oldVersion < 3) {
        createWelcomeNote(evt.target.transaction);
      }
    };

    openRequest.onsuccess = function () {
      // console.log('IDB: open succeeded:', openRequest.result.name, openRequest.result.version, openRequest.result.objectStoreNames);
      const noteDb = openRequest.result;
      noteDb.onerror = function (evt2) {
        // This handles errors not caught at the transaction or above.
        console.error("IDB: db.onerror:", evt2.target?.error || evt2.target);
        window.postMessage({kind: 'TRANSIENT_MSG', message: "Database error - restart your browser"}, window?.location?.origin);
      };
      // if the browser is closing, the user won't see this
      // maybe store something in localStorage?
      noteDb.onclose = function (evt) {
        console.error("unexpected IDB close:", evt);
        window.postMessage({kind: 'TRANSIENT_MSG', message: "Access to database lost - restart your browser"}, window?.location?.origin);
      }
      resolve({indexedDb: noteDb, isFirstLaunch});
    };

    // If some other tab is loaded with the database, then it needs to be closed
    // before we can proceed.
    openRequest.onblocked = (evt) => {
      console.warn("IDB open blocked:", evt);
      window.postMessage({kind: 'TRANSIENT_MSG', message: "Close all other tabs with this webapp open"}, window?.location?.origin);
    };
  });

  dbPrms.catch(err => {
    window.postMessage({kind: 'TRANSIENT_MSG', message: extractUserMessage(err)}, window?.location?.origin);
  });

  return dbPrms;
}

function createWelcomeNote(transaction) {
  let random = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, Math.floor(Math.random()*256), Math.floor(Math.random()*256), Math.floor(Math.random()*256)];
  const idTut = uuidv4({random});

  const tutorialContent = `
<h1>Welcome to Notes Together!</h1>
<p>Change body text to <b>headings</b>, <b>lists</b>, and <b>tables</b> using the <i>Block Type</i> menu above. Break up existing blocks by selecting text, then selecting from the Block Type menu.</p>
<p>To start typing <b>bold</b> or <i>italic</i> text, select from the <i>Text Style</i> menu ➚. Or select text, then select from the Text Style menu.</p>
<p><b>Change the date</b> to any value that helps you find the note (or order your notes) by clicking on the date ↖.</p>
<p>To <b>Undo</b> or <b>Redo</b>, use the <i>Editor menu</i> <b>⋮</b>︎. <b>Insert a picture or diagram</b> by pasting it, drag and dropping it, or using <i>Paste files...</i>.</p>
<p><b>Insert links</b> by dragging the URL (or the icon next to it) from a browser. Right-click to follow links.</p>
<p><b>Keyboard shortcuts</b> are listed in <i>Help</i> in the Application menu ☰.</p>
<p><i>Try out the editor features with this note, and delete it when you're finished.</i></p>
<hr>

<h1>Why remoteStorage?</h1>
<p><a href="https://remotestorage.io/" target="_blank"  rel="noreferrer">remoteStorage</a> is a protocol that puts you in control of your data.</p>
<ul>
<li>If you stop using an app, your data won't be deleted.  Whenever you like, you can start using the app again, and your data will be there.</li>
<li>If an app shuts down, your data won't be deleted. If an app changes in ways you don't like, you can deny permission for it to use your data. If there's a successor app (from the same or a different organization) you can choose whether to let it use your data.</li>
<li>The data from one app can be used by other apps, with <b>your</b> permission. The other apps <b>don't</b> need permission from the first app.</li>
<li>Your data is available on any OS or device - you're not locked in.</li>
<li>You choose which provider stores your data online, and can move to another provider at any time. (If you have a Dropbox or Google Drive account, you can use that, with some limitations.) You (or a friend) could even set up your own server.</li>
<li>You can use one remoteStorage account with many apps, so you have fewer passwords to remember.</li>
</ul>
<p>remoteStorage automatically syncs your data between devices. You can still work when your device is offline. When your device is back online, changes will be synced.</p>
<p>To use remoteStorage with Notes Together:</p>
<ol>
<li>Create an <a href="https://remotestorage.io/get/" target="_blank" rel="noreferrer">account native to remoteStorage</a> with a third-party provider (or use an existing Dropbox or Google Drive account, with some limitations).</li>
<li>Use the widget in the lower left of the list pane to connect.</li>
</ol>
<p>Notes Together uses the remoteStorage <b>documents</b> directory, for compatibility with Litewrite.</p>
<hr>
<p><em>remote storage</em></p>`;

  const tutorialNote = createMemoryNote(idTut, tutorialContent, new Date('2013-07-01T12:00Z'), 'text/html;hint=SEMANTIC');
  tutorialNote.title = "Welcome to Notes Together!\nWhy remoteStorage?";
  tutorialNote.wordArr = ["WELCOME", "NOTES", "TOGETHER", "TYPE", "MENU",
    "CREATE", "HEADINGS", "LISTS", "QUOTES", "BLOCKS", "SELECTING",
    "EXISTING", "TEXT", "STYLE", "BOLD", "ITALIC", "DATE", "CHANGE",
    "FIND", "ORDER", "EDITOR", "PERMISSION",
    "UNDO", "REDO", "PASTE", "FILES", "PLAIN", "MARKUP", "MARKDOWN",
    "IMPORTING", "RICH", "WYSIWYG", "CHANGING", "CONVERT", "COMMONMARK",
    "RIGHTCLICK", "FOLLOW", "LINKS", "PREVIOUS", "PARAGRAPH",
    "KEYBOARD", "SHORTCUTS", "COMMANDS", "HELP", "APPLICATION",
    "FEATURES", "DELETE", "FINISHED", "TUTORIAL",

    "WHY", "REMOTESTORAGE", "PROTOCOL", "IN", "CONTROL",
    "YOUR", "DATA", "ONE", "ACCOUNT", "APPS", "FEWER", "PASSWORDS", "REMEMBER",
    "KINDS", "REVOKE", "ACCESS", "AT", "ANY", "TIME", "STILL", "AVAILABLE",
    "STOP", "USING", "SHUT", "DOWN", "START", "AGAIN", "DEFUNCT", "SUCCESSORS",
    "OS", "LOCKED",
    "CHOOSE", "PROVIDER", "STORES", "ONLINE", "FRIEND", "SET", "UP",
    "OWN", "SERVER", "AUTOMATICALLY", "SYNCS", "BETWEEN", "DEVICES",
    "WORK", "OFFLINE", "BACK", "SYNCED",
    "WIDGET", "LOWER", "LEFT", "PANE", "CONNECT",
    "DOCUMENTS", "DIRECTORY", "COMPATABILITY", "OLDER", "NOTETAKING",
    "LITEWRITE", "WHENEVER", "LIKE", "STORAGE", "CHOICE"
  ];

  const noteStore = transaction.objectStore("note");
    const putRequestTut = noteStore.put(tutorialNote);
    putRequestTut.onsuccess = function () {
      console.info("Orientation note created");
    };
    putRequestTut.onerror = orientationNoteFail;
  function orientationNoteFail(evt) {
    evt.preventDefault();   // Doesn't bubble & thus fail open transaction
    evt.stopPropagation();
    console.error("IDB create orientation note:", evt.target.error);
  }
  // Coding or transient errors here don't fail database creation.
}


let findStubsTransaction;
/**
 * Searches for notes which match (as a prefix) each word in searchStr.
 * Returns *stubs*: notes with title but not the full content.
 * @param searchWords Set of keywords
 * @param callback may be called *multiple* times; isPartial means there are more results; isFinal means no more results will be returned; *both* will be true when there are more than MAX_NOTES_FOUND matching notes
 */
function findStubs(searchWords, callback) {
  dbPrms.then(({indexedDb: db}) => {
    if (findStubsTransaction) {
      // aborts any pending call in favor of this call
      // console.warn(`Aborting previous fetchNotes transaction. New searchStr: "${searchStr}"`);
      findStubsTransaction.abort();
    }
    findStubsTransaction = db.transaction('note', "readonly");
    findStubsTransaction.onerror = function (evt) {
      if (evt.target.error?.name === 'AbortError') {
        // console.log("IDB:", evt.target.error?.name, extractUserMessage(evt.target.error));
      } else {
        console.error("IDB findStubs:", evt.target.error);
        findStubsTransaction = null;
        callback(evt.target.error);
      }
      evt.preventDefault();
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
  return dbPrms.then(({indexedDb: db}) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('note', "readonly");
      const itemStore = transaction.objectStore("note");
      const getRequest = itemStore.get(id);
      getRequest.onsuccess = function (evt) {
        resolve(evt.target.result);   // undefined if missing
      };
      getRequest.onerror = function (evt) {
        console.error("IDB getNoteDb:", evt.target.error);
        evt.preventDefault();
        evt.stopPropagation();
        reject(evt.target.error);
      };
    });
  });
}

function upsertNoteDb(cleanNote, initiator) {
  return dbPrms.then(({indexedDb: db}) => {
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
        evt.preventDefault();
        evt.stopPropagation();
        reject(evt.target.error);
      };
    });
  });
}

function deleteNoteDb(id) {
  return dbPrms.then(({indexedDb: db}) => {
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
        evt.preventDefault();
        evt.stopPropagation();
        reject(evt.target.error);
      };
    });
  });
}


function findFillerNoteIds() {
  return dbPrms.then(({indexedDb: db}) => {
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


const MAX_SEARCHES = 100;   // perhaps a month's or year's worth

async function checkpointSearch(searchWords, searchStr) {
  if (!(searchWords instanceof Set)) {
    throw new Error(`“${searchWords}” is not a Set`);
  }
  if ('string' !== typeof searchStr) {
    throw new Error(`“${searchStr}” is not a string`);
  }
  if (0 === searchWords.size) {
    return 0;
  }
  if (1 === searchWords.size) {
    if (Array.from(searchWords).every(word => word.length < 2)) {
      return 0;
    }
  }

  await new Promise(resolve => {
    requestIdleCallback(resolve);
  });

  const now = Date.now();
  const newCount = await incrementCount(searchWords, searchStr, now);

  const numRecalculated = await recalculateScores(now);

  if (numRecalculated > MAX_SEARCHES) {
    await deleteExtraSearches(numRecalculated - MAX_SEARCHES);
  }

  return newCount;
}

async function incrementCount(searchWords, searchStr, now) {
  const {indexedDb: db} = await dbPrms;
  return new Promise((resolve, reject) => {
    const normalized = Array.from(searchWords.values()).sort().join(' ');

    const transaction = db.transaction('search', "readwrite", {durability: "relaxed"});
    const searchStore = transaction.objectStore("search");
    const getRequest = searchStore.get(normalized);
    getRequest.onsuccess = function (evt) {
      const oldCount = evt.target.result?.count || 0;
      const oldDate = evt.target.result?.date || 0;
      const doubleDaysOld = (now - oldDate) / (2 * 24 * 60 * 60 * 1000);
      const newCount = (oldCount / (1 + doubleDaysOld)) + 1;
      const putRequest = searchStore.put({
        normalized,
        original: searchStr,
        count: newCount,
        date: now
      });
      putRequest.onsuccess = function () {
        resolve(newCount);
      }
      putRequest.onerror = handleError;
    };
    getRequest.onerror = handleError;
    function handleError(evt) {
      console.error("IDB incrementCount:", evt.target.error);
      evt.preventDefault();
      evt.stopPropagation();
      reject(evt.target.error);
    }
  });
}

/**
 * A search used twice yesterday scores like a search used once today,
 * but a search used thrice yesterday is ahead.  Two days on, the search
 * used twice will score higher than the search scored once
 *
 * @return {Promise<unknown>}
 */
async function recalculateScores(now) {
  const {indexedDb: db} = await dbPrms;
  return new Promise((resolve, reject) => {
    let numRecalculated = 0;
    const transaction = db.transaction('search', "readwrite", {durability: "relaxed"});
    const searchStore = transaction.objectStore("search");
    const cursorRequest = searchStore.openCursor();
    cursorRequest.onsuccess = function(evt) {
      try {
        const cursor = evt.target.result;
        if (cursor) {
          const oldDate = cursor.value?.date || 0;
          const daysOld = (now - oldDate) / (24 * 60 * 60 * 1000);
          const count = cursor.value?.count || 0;
          const score = count / (1 + daysOld);
          cursor.value.score = score;
          const updateRequest = cursor.update(cursor.value);
          updateRequest.onsuccess = function () {
            // console.log(`updated search “${cursor.value?.original}” (count ${cursor.value?.count}) score to ${cursor.value?.score}`)
            ++numRecalculated;
            cursor.continue();
          }
          updateRequest.onerror = (evt) => {
            console.error("IDB recalculateScores error:", evt.target.error);
            evt.preventDefault();
            evt.stopPropagation();
            cursor.continue();
          }
        } else {   // no more searches
          // console.log(`recalculated scores on ${numRecalculated} searches`);
          resolve(numRecalculated);
        }
      } catch (err) {
        reject(err);
      }
    };
  });
}

async function deleteExtraSearches(numToDelete) {
  const {indexedDb: db} = await dbPrms;
  return new Promise((resolve, reject) => {
    let numDeleted = 0;
    const transaction = db.transaction('search', "readwrite", {durability: "relaxed"});
    const searchStore = transaction.objectStore("search");
    const cursorRequest = searchStore.index('byScore').openCursor();
    cursorRequest.onsuccess = function(evt) {
      try {
        const cursor = evt.target.result;
        if (cursor) {
          console.info(`discarding search “${cursor.value?.original}” ${cursor.value?.count} ${cursor.value?.score}`);
          const deleteRequest = cursor.delete();
          deleteRequest.onsuccess = function () {
            if (++numDeleted >= numToDelete) {
              resolve(numDeleted);   // and abandon cursor, ending transaction
            } else {
              cursor.continue();
            }
          }
          deleteRequest.onerror = (evt) => {
            console.error("IDB deleteExtraSearches error:", evt.target.error);
            evt.preventDefault();
            evt.stopPropagation();
            cursor.continue();
          }
        } else {   // no more searches
          resolve(numDeleted);
        }
      } catch (err) {
        reject(err);
      }
    }
  });
}

function listSuggestions(max) {
  return dbPrms.then(({indexedDb: db}) => {
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
      const cursorRequest = searchStore.index('byScore').openCursor(null, "prev");
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
