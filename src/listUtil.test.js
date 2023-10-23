// listUtil.test.js - tests for utilities for lists of notes
// Copyright © 2021 Doug Reeder

import generateTestId from "./util/generateTestId";
import {updateListWithChanges} from "./listUtil";
import {createMemoryNote} from "./Note";
import {sanitizeNote} from "./sanitizeNote";
import {parseWords} from "./storage";


const startDate = Date.parse('2016-01-01');
function createIndexedNote(content, date) {
  if (!date) {
    date = new Date(startDate + Math.random() * 31 * 24 * 60 * 60 * 1000);
  }
  const memNote = createMemoryNote(generateTestId(), content, date);

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


describe("updateListWithChanges", () => {
  it("should delete notes", () => {
    const targetNoteA = createMemoryNote(generateTestId(), "second");
    const targetNoteB = createMemoryNote(generateTestId(), "fourth");
    const oldNotes = [
      createMemoryNote(generateTestId(), "first"),
      targetNoteA,
      createMemoryNote(generateTestId(), "third"),
      targetNoteB,
      createMemoryNote(generateTestId(), "fifth"),
    ];
    const notesDeleted = {};
    notesDeleted[targetNoteA.id] = true;
    notesDeleted[targetNoteB.id] = true;

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, {}, notesDeleted, new Set());

    expect(isChanged).toBeTruthy();
    expect(newNotes.length).toEqual(3);
    expect(newNotes).not.toContain(targetNoteA);
    expect(newNotes).not.toContain(targetNoteB);
  });

  it("should not change list when other notes are deleted", () => {
    const oldNotes = [
      createMemoryNote(generateTestId(), "first"),
      createMemoryNote(generateTestId(), "second"),
      createMemoryNote(generateTestId(), "third"),
    ];
    const notesDeleted = {};
    notesDeleted[generateTestId()] = true;
    notesDeleted[generateTestId()] = true;

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, {}, notesDeleted, new Set());

    expect(isChanged).toBeFalsy();
    expect(newNotes.length).toEqual(3);
  });

  it("should delete note, even if it also is changed (no search words)", () => {
    const oldNotes = [
      createMemoryNote(generateTestId(), "first"),
      createMemoryNote(generateTestId(), "second"),
      createMemoryNote(generateTestId(), "third"),
    ];

    const notesDeleted = {};
    notesDeleted[oldNotes[1].id] = true;
    const notesChanged = {};
    notesChanged[oldNotes[1].id] = oldNotes[1];

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, notesChanged, notesDeleted, new Set());

    expect(isChanged).toBeTruthy();
    expect(newNotes.length).toEqual(2);
    expect(newNotes).not.toContain(oldNotes[1]);
  });

  it("should update existing note text (no search words)", () => {
    const targetNote = createMemoryNote(generateTestId(), "second");
    const oldNotes = [
      createMemoryNote(generateTestId(), "first"),
      targetNote,
      createMemoryNote(generateTestId(), "third"),
    ];
    const updatedNote = sanitizeNote(createMemoryNote(targetNote.id, "new"));
    const notesChanged = {};
    notesChanged[updatedNote.id] = updatedNote;

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, notesChanged, {}, new Set());

    expect(isChanged).toBeTruthy();
    expect(newNotes.length).toEqual(3);
    expect(newNotes).toContain(updatedNote);
    expect(newNotes).not.toContain(targetNote);
  });

  it("should re-sort if date of existing note changes (no search words)", () => {
    const targetNote = createMemoryNote(generateTestId(), "second", new Date(2000, 0, 20));
    const oldNotes = [
      createMemoryNote(generateTestId(), "first", new Date(2000, 0, 30)),
      targetNote,
      createMemoryNote(generateTestId(), "third", new Date(2000, 0, 10)),
    ];
    const updatedNote = sanitizeNote(createMemoryNote(targetNote.id, targetNote.text, new Date(2000, 0, 31)));
    const notesChanged = {};
    notesChanged[updatedNote.id] = updatedNote;

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, notesChanged, {}, new Set());

    expect(isChanged).toBeTruthy();
    expect(newNotes.length).toEqual(3);
    expect(newNotes).toContain(updatedNote);
    expect(newNotes).not.toContain(targetNote);
    expect(newNotes[0]).toEqual(updatedNote);
    expect(newNotes[1]).toEqual(oldNotes[0]);
    expect(newNotes[2]).toEqual(oldNotes[2]);
  });

  it("should add notes (no search words)", () => {
    const oldNotes = [
      createIndexedNote("first"),
      createIndexedNote("second"),
      createIndexedNote("third"),
    ];
    const newNoteA = createIndexedNote("new");
    const newNoteB = createIndexedNote("newer");
    const notesChanged = {};
    notesChanged[newNoteA.id] = newNoteA;
    notesChanged[newNoteB.id] = newNoteB;

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, notesChanged, {}, new Set());

    expect(isChanged).toBeTruthy();
    expect(newNotes.length).toEqual(5);
    expect(newNotes).toContain(newNoteA);
    expect(newNotes).toContain(newNoteB);
  });

  it("should add notes if they match", () => {
    const searchWords = parseWords("fo");
    const oldNotes = [
      createIndexedNote("first foo"),
      createIndexedNote("second foo"),
      createIndexedNote("third foo"),
    ];
    const newNoteA = createIndexedNote("new foo");
    const newNoteB = createIndexedNote("new foolish");
    const notesChanged = {};
    notesChanged[newNoteA.id] = newNoteA;
    notesChanged[newNoteB.id] = newNoteB;

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, notesChanged, {}, searchWords);

    expect(isChanged).toBeTruthy();
    expect(newNotes.length).toEqual(5);
    expect(newNotes).toContain(newNoteA);
    expect(newNotes).toContain(newNoteB);
  });

  it("should not add notes if they don't match", () => {
    const searchWords = parseWords("fo");
    const oldNotes = [
      createIndexedNote("first foo"),
      createIndexedNote("second foo"),
      createIndexedNote("third foo"),
    ];
    const newNoteA = createIndexedNote( "new f");
    const newNoteB = createIndexedNote("new of");
    const notesChanged = {};
    notesChanged[newNoteA.id] = newNoteA;
    notesChanged[newNoteB.id] = newNoteB;

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, notesChanged, {}, searchWords);

    expect(isChanged).toBeFalsy();
    expect(newNotes.length).toEqual(3);
    expect(newNotes).not.toContain(newNoteA);
    expect(newNotes).not.toContain(newNoteB);
  });

  it("should sort new notes in place (with no search words)", () => {
    const oldNotes = [
      createIndexedNote("first", new Date(2000, 0, 30)),
      createIndexedNote("second", new Date(2000, 0, 20)),
      createIndexedNote("third", new Date(2000, 0, 10)),
    ];
    const newNoteA = createIndexedNote( "newer", new Date(2000, 0, 25));
    const newNoteB = createIndexedNote("new", new Date(2000, 0, 15));
    const notesChanged = {};
    notesChanged[newNoteA.id] = newNoteA;
    notesChanged[newNoteB.id] = newNoteB;

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, notesChanged, {}, new Set());

    expect(isChanged).toBeTruthy();
    expect(newNotes.length).toEqual(5);
    expect(newNotes).toContain(newNoteA);
    expect(newNotes).toContain(newNoteB);
    expect(newNotes[1]).toEqual(newNoteA);
    expect(newNotes[3]).toEqual(newNoteB);
  });

  it("should sort new notes in place (with search words)", () => {
    const searchWords = parseWords("fo ba");
    const oldNotes = [
      createIndexedNote( "first foo bar", new Date(2000, 0, 30)),
      createIndexedNote("second foo bar", new Date(2000, 0, 20)),
      createIndexedNote("third foo bar", new Date(2000, 0, 10)),
    ];
    const newNoteA = createIndexedNote("newer bar foo", new Date(2000, 0, 25));
    const newNoteB = createIndexedNote("bar new foo", new Date(2000, 0, 15));
    const notesChanged = {};
    notesChanged[newNoteA.id] = newNoteA;
    notesChanged[newNoteB.id] = newNoteB;

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, notesChanged, {}, searchWords);

    expect(isChanged).toBeTruthy();
    expect(newNotes.length).toEqual(5);
    expect(newNotes).toContain(newNoteA);
    expect(newNotes).toContain(newNoteB);
    expect(newNotes[1]).toEqual(newNoteA);
    expect(newNotes[3]).toEqual(newNoteB);
  });

  it("should delete, modify, add and sort (with search words)", () => {
    const searchWords = parseWords("fo ba");
    const oldNotes = [
      createIndexedNote("first foo bar", new Date(2000, 0, 30)),
      createIndexedNote("second foo bar", new Date(2000, 0, 20)),
      createIndexedNote("third foo bar", new Date(2000, 0, 10)),
    ];

    const notesDeleted = {};
    notesDeleted[generateTestId()] = true;
    notesDeleted[oldNotes[1].id] = true;

    const newNoteA = createIndexedNote("not a match", new Date(2000, 0, 25));
    const newNoteB = createIndexedNote("bar new foo", new Date(2000, 0, 5));
    const changingNote = createMemoryNote(oldNotes[2].id, "changed foo bar", new Date(2000, 0, 10));
    const notesChanged = {};
    notesChanged[newNoteA.id] = newNoteA;
    notesChanged[newNoteB.id] = newNoteB;
    notesChanged[changingNote.id] = changingNote;

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, notesChanged, notesDeleted, searchWords);

    expect(isChanged).toBeTruthy();
    expect(newNotes.length).toEqual(3);
    expect(newNotes).toContain(changingNote);
    expect(newNotes[1]).toEqual(changingNote);
    expect(newNotes).not.toContain(oldNotes[2]);
    expect(newNotes).not.toContain(newNoteA);
    expect(newNotes).toContain(newNoteB);
    expect(newNotes[2]).toEqual(newNoteB);
  });
});
