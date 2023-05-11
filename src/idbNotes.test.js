// idbNotes.test.js - automated tests for storage for Notes Together
// Copyright © 2021-2022 Doug Reeder

import generateTestId from "./util/generateTestId";
import {v4 as uuidv4, validate as uuidValidate} from 'uuid';
import {createMemoryNote} from "./Note";
import auto from "fake-indexeddb/auto.js";
import {
  initDb,
  findStubs,
  getNoteDb,
  upsertNoteDb,
  deleteNoteDb,
  checkpointSearch,
  listSuggestions,
  findNoteIds
} from "./idbNotes";
import {sanitizeNote} from "./sanitizeNote";
import {parseWords} from "./storage";

if (!global.requestIdleCallback) {
  global.requestIdleCallback = function (callback, options) {
    options = options || {};
    const relaxation = 1;
    const timeout = options.timeout || relaxation;
    const start = performance.now();
    return setTimeout(function () {
      callback({
        get didTimeout() {
          return options.timeout ? false : (performance.now() - start) - relaxation > timeout;
        },
        timeRemaining: function () {
          return Math.max(0, relaxation + (performance.now() - start));
        },
      });
    }, relaxation);
  };
}


let db;

beforeAll(done => {
  initDb("testDb").then(({indexedDb}) => {
    db = indexedDb;
    // console.log("fake db:", db.name, db.version, db.objectStoreNames);
    done();
  });
});

function deleteTestNotes() {
  return new Promise(resolve => {
    const clearTrnsactn = db.transaction('note', 'readwrite');
    const noteStore = clearTrnsactn.objectStore("note");
    const random = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255];
    noteStore.delete(IDBKeyRange.upperBound(uuidv4({random}), false)).onsuccess = function (evt) {
      resolve(evt.target.result);
    }
  });
}

function deleteSearchCheckpoints() {
  return new Promise(resolve => {
    const clearTransaction = db.transaction('search', 'readwrite');
    const searchStore = clearTransaction.objectStore("search");
    const clearRequest = searchStore.clear();
    clearRequest.onsuccess = function () {
      resolve();
    }
  });
}


describe("getNoteDb", () => {
  beforeAll(async () => {
    await deleteTestNotes();
  });

  it("should reject when id is undefined", async () => {
    await expect(getNoteDb(undefined)).rejects.toThrow();
  });

  it("should return undefined when note doesn't exist", async () => {
    await expect(getNoteDb(0)).resolves.toBeUndefined();
  });
})


describe("upsertNoteDb", () => {
  beforeAll(async () => {
    await deleteTestNotes();
  });

  it("should fail when passed a non-object", async () => {
    await expect(upsertNoteDb()).rejects.toThrow();
  });

  it("should fail when passed a note without ID", async () => {
    await expect(upsertNoteDb({})).rejects.toThrow();
  });

  it("should fail when passed a note without wordArr", async () => {
    const memNote = createMemoryNote(generateTestId(), "something");
    await expect(upsertNoteDb(memNote)).rejects.toThrow('wordArr');
  });

  it("should insert a note",async () => {
    const originalId = generateTestId();
    const originalText = "Beggars <div>in Spain</div>";
    const originalDate = new Date(1997, 5, 16, 9);
    const original = sanitizeNote(createMemoryNote(originalId, originalText, originalDate, 'text/html;hint=SEMANTIC'));
    original.wordArr = ["BEGGARS", "IN", "SPAIN"];

    const savedNote = await upsertNoteDb(original);
    expect(savedNote.id).toEqual(originalId);
    expect(savedNote.content).toEqual(originalText);
    expect(savedNote.date).toEqual(originalDate);

    const retrieved = await getNoteDb(originalId);
    expect(retrieved.content).toEqual(originalText);
    expect(retrieved.date).toEqual(originalDate);
    expect(retrieved.wordArr).toEqual(original.wordArr);
    expect(retrieved.mimeType).toEqual('text/html;hint=SEMANTIC');
  });

  it("should update a note",async () => {
    const originalId = generateTestId();
    const originalText = "In Memory Yet Green";
    const originalDate = new Date(2003, 2, 15);
    const original = sanitizeNote(createMemoryNote(originalId, originalText, originalDate));
    original.wordArr = ["IN", "MEMORY", "YET", "GREEN"];
    await upsertNoteDb(original);

    const updatedText = "<h2>In Joy Still Felt</h2>";
    const updatedDate = new Date(2010, 3, 16);
    const updated = sanitizeNote(createMemoryNote(originalId, updatedText, updatedDate, 'text/html;hint=SEMANTIC'));
    updated.wordArr = ["IN", "JOY", "STILL", "FELT"];
    await upsertNoteDb(updated);

    const retrieved = await getNoteDb(originalId);
    expect(retrieved.content).toEqual(updatedText);
    expect(retrieved.date).toEqual(updatedDate);
    expect(retrieved.wordArr).not.toContain("MEMORY");
    expect(retrieved.wordArr).not.toContain("YET");
    expect(retrieved.wordArr).not.toContain("GREEN");
    expect(retrieved.wordArr).toContain("IN");
    expect(retrieved.wordArr).toContain("JOY");
    expect(retrieved.wordArr).toContain("STILL");
    expect(retrieved.wordArr).toContain("FELT");
    expect(retrieved.wordArr.length).toEqual(4);
    expect(retrieved.mimeType).toEqual(updated.mimeType);
  });
});

describe("deleteNoteDb", () => {
  it("should fail when passed a non-number", async () => {
    await expect(deleteNoteDb(undefined)).rejects.toThrow();
  });

  it("should remove note from storage", async () => {
    const id = generateTestId();
    const note = sanitizeNote(createMemoryNote(id, "Aroint, thee, knave!"));
    note.wordArr = ["AROINT", "THEE", "KNAVE"];
    await upsertNoteDb(note);

    const deletedId = await deleteNoteDb(id);
    expect(deletedId).toEqual(id);
    await expect(getNoteDb(id)).resolves.toBeUndefined();
  });

  it("should succeed in deleting non-existent note", async () => {
    const deletedId = await deleteNoteDb(0);
    expect(deletedId).toEqual(0);
  });
});

describe("findStubs", () => {
  const text1 = "<h2>The world</h2> set free";
  const text1title = "The world";
  const text2 = "Math <th>is not</th> my favorite";
  const text2title = "is not";
  const text3 = "I don't <pre>like thin crust</pre>";
  const text3title = "like thin crust";

   beforeAll(async () => {
    await deleteTestNotes();

    const date = new Date(2001, 0, 1);
    for (let i = 0; i < 11; ++i) {
      date.setTime(date.getTime() + 24*60*60*1000);
      await upsertNoteDb(createIndexedNote(text1, date));
      date.setTime(date.getTime() + 24*60*60*1000);
      await upsertNoteDb(createIndexedNote(text2, date));
      date.setTime(date.getTime() + 24*60*60*1000);
      await upsertNoteDb(createIndexedNote(text3, date, 1 === i));
    }
    date.setTime(date.getTime() + 24*60*60*1000);
    await upsertNoteDb(createIndexedNote(text2, date));
    date.setTime(date.getTime() + 24*60*60*1000);
    await upsertNoteDb(createIndexedNote(text3, date));
    date.setTime(date.getTime() + 24*60*60*1000);
    await upsertNoteDb(createIndexedNote(text3, date));
  });

  it("should return all notes when no words in search string", done => {
    findStubs(parseWords(" .@ *) -—-"), callback);

    function callback(err, matched, {isPartial, isFinal, isSearch} = {}) {
      if (err) { return done(err) }
      try {
        if (!isFinal) {
          /* eslint-disable jest/no-conditional-expect */
          expect(matched.length).toBeGreaterThan(0);
          expect(matched.length).toBeLessThan(36);
          expect(isPartial).toBeTruthy();
          expect(isSearch).toBeFalsy();
          /* eslint-enable jest/no-conditional-expect */
          return;
        }

        const testNotes = [];
        matched.forEach(note => {
          testNotes.push(note);
        });
        expect(testNotes.length).toEqual(36);
        expect(testNotes.reduce((acc, item) => {
          return (item.title === text1title ? 1 : 0) + acc;
        }, 0)).toEqual(11);
        expect(testNotes.reduce((acc, item) => {
          return (item.title === text2title ? 1 : 0) + acc;
        }, 0)).toEqual(12);
        expect(testNotes.reduce((acc, item) => {
          return (item.title === text3title ? 1 : 0) + acc;
        }, 0)).toEqual(13);
        expect(testNotes[0].title).toEqual(text3title);
        expect(testNotes[1].title).toEqual(text3title);
        expect(testNotes[2].title).toEqual(text2title);
        expect(testNotes[3].title).toEqual(text3title);
        expect(testNotes[4].title).toEqual(text2title);
        expect(testNotes[5].title).toEqual(text1title);

        expect(isPartial).toBeFalsy();
        expect(isSearch).toBeFalsy();
        done();
      } catch (err2) {
        done(err2);
      }
    }
  });

  it("should return notes containing words which start with each of the search words", done => {
    findStubs(parseWords("th don"), callback);

    function callback(err, matched, {isPartial, isFinal, isSearch} = {}) {
      if (err) { return done(err) }
      try {
        if (!isFinal) {
          /* eslint-disable jest/no-conditional-expect */
          expect(matched.length).toBeGreaterThan(0);
          expect(matched.length).toBeLessThan(13);
          expect(isPartial).toBeTruthy();
          expect(isSearch).toBeTruthy();
          /* eslint-enable jest/no-conditional-expect */
          return;
        }

        const testNotes = [];
        const testNoteIds = new Set();
        matched.forEach(note => {
          testNotes.push(note);
          testNoteIds.add(note.id);
        });
        expect(testNotes.length).toEqual(13);
        expect(testNoteIds.size).toEqual(13);
        expect(testNotes.reduce((acc, item) => {
          return (item.title === text1title ? 1 : 0) + acc;
        }, 0)).toEqual(0);
        expect(testNotes.reduce((acc, item) => {
          return (item.title === text2title ? 1 : 0) + acc;
        }, 0)).toEqual(0);
        expect(testNotes.reduce((acc, item) => {
          return (item.title === text3title ? 1 : 0) + acc;
        }, 0)).toEqual(13);

        expect(isPartial).toBeFalsy();
        expect(isSearch).toBeTruthy();
        done();
      } catch (err2) {
        done(err2);
      }
    }
  });
});

describe("findNoteIds", () => {
  const text1 = "<h1>The Mysterious Island</h1><p>by Jules Verne</p>";
  const text1title = "The Mysterious Island";
  const text2 = "<h2>The <i>Widget</i> Chronicle</h2><i>by John Doe</i>";
  const text2title = "The Widget Chronicle";
  const text3 = "<h3>groceries</h3><ol><li>all purpose flour</li><li>oranges</li></ol>";
  const text3title = "groceries";
  const titles = [text1title, text2title, text3title];
  const earlierDate = new Date(2010, 6, 1);
  const laterDate = new Date(2010, 7, 1);

  beforeAll(async () => {
    await deleteTestNotes();

    await upsertNoteDb(createIndexedNote(text1, earlierDate));
    await upsertNoteDb(createIndexedNote(text2, earlierDate));
    await upsertNoteDb(createIndexedNote(text3, earlierDate));

    await upsertNoteDb(createIndexedNote(text2, laterDate));
    await upsertNoteDb(createIndexedNote(text1, laterDate));
    await upsertNoteDb(createIndexedNote(text3, laterDate));
  });

  it("should return all note IDs, by descending date order, when no search words", async () => {
    const ids = await findNoteIds(new Set());

    const notes = [];
    for (const id of ids) {
      expect(uuidValidate(id)).toBeTruthy();
      notes.push(await getNoteDb(id));
    }
    expect(ids.length).toEqual(6);
    expect(notes[0].date).toEqual(laterDate);
    expect(notes[1].date).toEqual(laterDate);
    expect(notes[2].date).toEqual(laterDate);
    expect(notes[3].date).toEqual(earlierDate);
    expect(notes[4].date).toEqual(earlierDate);
    expect(notes[5].date).toEqual(earlierDate);

    expect(notes.every(note => titles.includes(note.title))).toBeTruthy();
  });

  it("should return note IDs that match search words, by descending date order", async () => {
    const ids = await findNoteIds(new Set(["BY"]));

    const notes = [];
    for (const id of ids) {
      expect(uuidValidate(id)).toBeTruthy();
      notes.push(await getNoteDb(id));
    }
    expect(ids.length).toEqual(4);
    expect(notes[0].date).toEqual(laterDate);
    expect(notes[1].date).toEqual(laterDate);
    expect(notes[2].date).toEqual(earlierDate);
    expect(notes[3].date).toEqual(earlierDate);

    const bookTitles = [text1title, text2title];
    expect(notes.every(note => bookTitles.includes(note.title))).toBeTruthy();
  });
});

function createIndexedNote(content, date, isLocked = false) {
  const memNote = createMemoryNote(generateTestId(), content, date, 'text/html;hint=SEMANTIC', isLocked);

  const wordSet = new Set();
  const textFilter = function (text) {
    for (const word of parseWords(text)) {
      wordSet.add(word);
    }
    return text;
  }

  const cleanNote = sanitizeNote(memNote, textFilter);

  for (let candidateWord of wordSet) {
    for (let otherWord of wordSet) {
      if (otherWord !== candidateWord && candidateWord.startsWith(otherWord)) {
        wordSet.delete(otherWord);
      }
    }
  }
  cleanNote.wordArr = Array.from(wordSet);

  return cleanNote;
}


describe("checkPointSearch", () => {
  jest.setTimeout(30000);
  beforeEach(deleteSearchCheckpoints);

  it("should throw error when not passed a Set of words", async () => {
    await expect(checkpointSearch(undefined, "foo")).rejects.toThrow(/not a Set/);
  });

  it("should throw error when not passed a search string", async () => {
    await expect(checkpointSearch(new Set(['FOO']))).rejects.toThrow(/not a string/);
  });

  it("should not create record if search is blank", async () => {
    expect(await checkpointSearch(new Set(),"   ")).toEqual(0);
  });

  it("should not create record if search is one character", async () => {
    expect(await checkpointSearch(new Set(['A']),"a ")).toEqual(0);
  });

  it("should create record if it doesn't exist (2-letter word)", async () => {
    const searchStr = "pg";
    const searchWords = parseWords(searchStr);
    expect(await checkpointSearch(searchWords, searchStr)).toEqual(1);
  });

  it("should create record if it doesn't exist (2 1-letter words)", async () => {
    const searchStr = "a z";
    const searchWords = parseWords(searchStr);
    expect(await checkpointSearch(searchWords, searchStr)).toEqual(1);
  });

  it("should increment record if search matches existing", async () => {
    const searchStr1 = "play group";
    const searchWords1 = parseWords(searchStr1);
    expect(await checkpointSearch(searchWords1, searchStr1)).toEqual(1);

    await new Promise(resolve => setTimeout(resolve, 1));
    const searchStr2 = "group play";
    const searchWords2 = parseWords(searchStr2);
    const count = await checkpointSearch(searchWords2, searchStr2);
    expect(count).toBeGreaterThan(1.999);
    expect(count).toBeLessThan(2);
  });

  it("should only save the last 100 searches, when last search is new)", async () => {
    for (let i=1; i<=105; ++i) {
      const searchStr = "search " + i;
      const searchWords = parseWords(searchStr);
      expect(await checkpointSearch(searchWords, searchStr)).toEqual(1);
      // TODO: figure out why this delay makes the deletions happen as expected
      await new Promise(resolve => setTimeout(resolve, 15));
    }

    const suggestions = await listSuggestions(110);
    const suggestionArr = Array.from(suggestions.keys());
    expect(suggestionArr[0]).toEqual("search 105");
    expect(suggestionArr[99]).toEqual("search 6");
    expect(suggestionArr.length).toEqual(100);
  });

  it("should only save the last 100 searches, when the last is a repeat", async () => {
    for (let i=1; i<=105; ++i) {
      const searchStr = "search " + i;
      const searchWords = parseWords(searchStr);
      expect(await checkpointSearch(searchWords, searchStr)).toEqual(1);
      // TODO: figure out why this delay makes the deletions happen as expected
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    const searchStr = "search " + 69;
    const searchWords = parseWords(searchStr);
    const count69 = await checkpointSearch(searchWords, searchStr);
    expect(count69).toBeGreaterThan(1.999);
    expect(count69).toBeLessThan(2);

    const suggestions = await listSuggestions(110);
    const suggestionArr = Array.from(suggestions.keys());
    expect(suggestionArr[0]).toEqual("search 69");
    expect(suggestionArr[99]).toEqual("search 6");
    expect(suggestionArr.length).toEqual(100);
  });
});

describe("listSuggestions", () => {
  beforeEach(deleteSearchCheckpoints);

  it("should throw error when not passed a number", async () => {
    await expect(listSuggestions("foo")).rejects.toThrow(/not a number/);
  });

  it("should return empty array when passed max 0", async () => {
    const suggestions = await listSuggestions(0);
    expect(suggestions).toEqual(new Map());
  });

  it("should return empty Map when passed negative max", async () => {
    const suggestions = await listSuggestions(-17);
    expect(suggestions).toEqual(new Map());
  });

  it("should return an array of the last-used original search strings", async () => {
    const onceSearchStr = "Once upon a time";
    const onceSearchWords = parseWords(onceSearchStr);
    const twiceSearchStr1 = "Twice lucky";
    const twiceSearchWords1 = parseWords(twiceSearchStr1);
    const twiceSearchStr2 = "Lucky twice";
    const twiceSearchWords2 = parseWords(twiceSearchStr2);
    const thriceSearchStr1 = "Dritte Straße";
    const thriceSearchWords1 = parseWords(thriceSearchStr1);
    const thriceSearchStr2 = "Dritte strasse";
    const thriceSearchWords2 = parseWords(thriceSearchStr2);
    const thriceSearchStr3 = "Straße Dritte";
    const thriceSearchWords3 = parseWords(thriceSearchStr3);
    const doubleSearchStr = "Double trouble";
    const doubleSearchWords = parseWords(doubleSearchStr);
    await checkpointSearch(onceSearchWords, onceSearchStr);
    await checkpointSearch(thriceSearchWords1, thriceSearchStr1);
    await checkpointSearch(twiceSearchWords1, twiceSearchStr1);
    await checkpointSearch(thriceSearchWords2, thriceSearchStr2);
    await checkpointSearch(twiceSearchWords2, twiceSearchStr2);
    await checkpointSearch(doubleSearchWords, doubleSearchStr);
    await checkpointSearch(thriceSearchWords3, thriceSearchStr3);
    await checkpointSearch(doubleSearchWords, doubleSearchStr);

    const suggestions = await listSuggestions(12);
    expect(suggestions).toBeInstanceOf(Map)
    const suggestionArr = Array.from(suggestions.keys());
    const suggestionsNormalized = Array.from(suggestions.values());
    expect(suggestionArr[0]).toEqual(thriceSearchStr3);
    expect(suggestionsNormalized[0]).toEqual(Array.from(thriceSearchWords1.values()).sort().join(' '));
    expect(suggestionArr[1]).toEqual(doubleSearchStr);   // later comes before earlier
    expect(suggestionArr[2]).toEqual(twiceSearchStr2);
    expect(suggestionArr[3]).toEqual(onceSearchStr);
    expect(suggestionsNormalized[3]).toEqual(Array.from(onceSearchWords.values()).sort().join(' '));
    expect(suggestions.size).toEqual(4);

    const max = 3;
    const suggestions2 = await listSuggestions(max);
    const suggestionArr2 = Array.from(suggestions2.keys());
    expect(suggestionArr2[0]).toEqual(thriceSearchStr3);
    expect(suggestionArr2[1]).toEqual(doubleSearchStr);
    expect(suggestionArr2[2]).toEqual(twiceSearchStr2);
    expect(suggestions2.size).toEqual(max);
  });
});


afterAll(async () => {
  return deleteTestNotes();
});
