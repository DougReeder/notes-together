// idbNotes.test.js - automated tests for storage for Notes Together
// Copyright © 2021 Doug Reeder

import generateTestId from "./util/generateTestId";
import { v4 as uuidv4 } from 'uuid';
import {createMemoryNote} from "./Note";
import auto from "fake-indexeddb/auto.js";
import {initDb, findStubs, getNoteDb, upsertNoteDb, deleteNoteDb} from "./idbNotes";
import {sanitizeNote} from "./sanitizeNote";
import {parseWords} from "./storage";


let db;

beforeAll(done => {
  initDb("testDb").then(theDb => {
    db = theDb;
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

  const date = new Date(2001, 0, 1);

  function createIndexedNote(content) {
    date.setTime(date.getTime() + 24*60*60*1000);
    const memNote = createMemoryNote(generateTestId(), content, date, 'text/html;hint=SEMANTIC');

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

   beforeAll(async () => {
    await deleteTestNotes();

    for (let i = 0; i < 11; ++i) {
      await upsertNoteDb(createIndexedNote(text1));
      await upsertNoteDb(createIndexedNote(text2));
      await upsertNoteDb(createIndexedNote(text3));
    }
    await upsertNoteDb(createIndexedNote(text2));
    await upsertNoteDb(createIndexedNote(text3));
    await upsertNoteDb(createIndexedNote(text3));
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


afterAll(async () => {
  return deleteTestNotes();
});
