// listUtil.test.js - tests for utilities for lists of notes
// Copyright © 2021 Doug Reeder

import {updateListWithChanges} from "./listUtil";
import {createMemoryNote} from "./Note";
import {parseWords} from "./storage";
import {toDbNote} from "./idbNotes";

function generateTestId() {
  return Number.MIN_SAFE_INTEGER - 10 + Math.ceil(Math.random() * Number.MIN_SAFE_INTEGER);
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
    const updatedNote = toDbNote(createMemoryNote(targetNote.id, "new"));
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
    const updatedNote = toDbNote(createMemoryNote(targetNote.id, targetNote.text, new Date(2000, 0, 31)));
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
      createMemoryNote(generateTestId(), "first"),
      createMemoryNote(generateTestId(), "second"),
      createMemoryNote(generateTestId(), "third"),
    ];
    const newNoteA = toDbNote(createMemoryNote(generateTestId(), "new"));
    const newNoteB = toDbNote(createMemoryNote(generateTestId(), "newer"));
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
      createMemoryNote(generateTestId(), "first foo"),
      createMemoryNote(generateTestId(), "second foo"),
      createMemoryNote(generateTestId(), "third foo"),
    ];
    const newNoteA = toDbNote(createMemoryNote(generateTestId(), "new foo"));
    const newNoteB = toDbNote(createMemoryNote(generateTestId(), "new foolish"));
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
      createMemoryNote(generateTestId(), "first foo"),
      createMemoryNote(generateTestId(), "second foo"),
      createMemoryNote(generateTestId(), "third foo"),
    ];
    const newNoteA = toDbNote(createMemoryNote(generateTestId(), "new f"));
    const newNoteB = toDbNote(createMemoryNote(generateTestId(), "new of"));
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
      createMemoryNote(generateTestId(), "first", new Date(2000, 0, 30)),
      createMemoryNote(generateTestId(), "second", new Date(2000, 0, 20)),
      createMemoryNote(generateTestId(), "third", new Date(2000, 0, 10)),
    ];
    const newNoteA = toDbNote(createMemoryNote(generateTestId(), "newer", new Date(2000, 0, 25)));
    const newNoteB = toDbNote(createMemoryNote(generateTestId(), "new", new Date(2000, 0, 15)));
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
      createMemoryNote(generateTestId(), "first foo bar", new Date(2000, 0, 30)),
      createMemoryNote(generateTestId(), "second foo bar", new Date(2000, 0, 20)),
      createMemoryNote(generateTestId(), "third foo bar", new Date(2000, 0, 10)),
    ];
    const newNoteA = toDbNote(createMemoryNote(generateTestId(), "newer bar foo", new Date(2000, 0, 25)));
    const newNoteB = toDbNote(createMemoryNote(generateTestId(), "bar new foo", new Date(2000, 0, 15)));
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
      createMemoryNote(generateTestId(), "first foo bar", new Date(2000, 0, 30)),
      createMemoryNote(generateTestId(), "second foo bar", new Date(2000, 0, 20)),
      createMemoryNote(generateTestId(), "third foo bar", new Date(2000, 0, 10)),
    ];

    const notesDeleted = {};
    notesDeleted[generateTestId()] = true;
    notesDeleted[oldNotes[1].id] = true;

    const newNoteA = toDbNote(createMemoryNote(generateTestId(), "not a match", new Date(2000, 0, 25)));
    const newNoteB = toDbNote(createMemoryNote(generateTestId(), "bar new foo", new Date(2000, 0, 5)));
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
