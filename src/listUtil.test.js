// listUtil.test.js - tests for utilities for lists of notes
// Copyright © 2021 Doug Reeder

import generateTestId from "./util/generateTestId";
import {updateListWithChanges} from "./listUtil";
import {parseWords} from "./storage";
import {deserializeNote, serializeNote} from "./serializeNote.js";


const startDate = Date.parse('2016-01-01');
async function createIndexedNote(content, date = new Date(startDate + Math.random() * 31 * 24 * 60 * 60 * 1000), isLocked = false) {
  const raw = {id: generateTestId(), content, date, isLocked};
  return serializeNote(deserializeNote(raw));
}


describe("updateListWithChanges", () => {
  it("should delete notes", async () => {
    const targetNoteA = await serializeNote(deserializeNote({id: generateTestId(), content: "second"}));
    const targetNoteB = await serializeNote(deserializeNote({id: generateTestId(), content: "fourth"}));
    const oldNotes = [
      await serializeNote(deserializeNote({id: generateTestId(), content: "first"})),
      targetNoteA,
      await serializeNote(deserializeNote({id: generateTestId(), content: "third"})),
      targetNoteB,
      await serializeNote(deserializeNote({id: generateTestId(), content: "fifth"})),
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

  it("should not change list when other notes are deleted", async () => {
    const oldNotes = [
      await serializeNote(deserializeNote({id: generateTestId(), content: "first"})),
      await serializeNote(deserializeNote({id: generateTestId(), content: "second"})),
      await serializeNote(deserializeNote({id: generateTestId(), content: "third"})),
    ];
    const notesDeleted = {};
    notesDeleted[generateTestId()] = true;
    notesDeleted[generateTestId()] = true;

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, {}, notesDeleted, new Set());

    expect(isChanged).toBeFalsy();
    expect(newNotes.length).toEqual(3);
  });

  it("should delete note, even if it also is changed (no search words)", async () => {
    const oldNotes = [
      await serializeNote(deserializeNote({id: generateTestId(), content: "first"})),
      await serializeNote(deserializeNote({id: generateTestId(), content: "second"})),
      await serializeNote(deserializeNote({id: generateTestId(), content: "third"})),
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

  it("should update existing note text (no search words)", async () => {
    const targetNote = await serializeNote(deserializeNote({id: generateTestId(), content: "second"}));
    const oldNotes = [
      await serializeNote(deserializeNote({id: generateTestId(), content: "first"})),
      targetNote,
      await serializeNote(deserializeNote({id: generateTestId(), content: "third"})),
    ];
    const updatedNote = await serializeNote(deserializeNote({id: targetNote.id, content: "new"}));
    const notesChanged = {};
    notesChanged[updatedNote.id] = updatedNote;

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, notesChanged, {}, new Set());

    expect(isChanged).toBeTruthy();
    expect(newNotes.length).toEqual(3);
    expect(newNotes).toContain(updatedNote);
    expect(newNotes).not.toContain(targetNote);
  });

  it("should re-sort if date of existing note changes (no search words)", async () => {
    const raw = {id: generateTestId(), content: "second", date: new Date(2000, 0, 20)};
    const targetNote = await serializeNote(deserializeNote(raw));
    const oldNotes = [
      await serializeNote(deserializeNote({id: generateTestId(), content: "first", date: new Date(2000, 0, 30)})),
      targetNote,
      await serializeNote(deserializeNote({id: generateTestId(), content: "third", date: new Date(2000, 0, 10)})),
    ];
    const updatedNote = await serializeNote(deserializeNote({id: targetNote.id, content: targetNote.text, date: new Date(2000, 0, 31)}));
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

  it("should add notes (no search words)", async () => {
    const oldNotes = [
      await createIndexedNote("first"),
      await createIndexedNote("second"),
      await createIndexedNote("third"),
    ];
    const newNoteA = await createIndexedNote("new");
    const newNoteB = await createIndexedNote("newer");
    const notesChanged = {};
    notesChanged[newNoteA.id] = newNoteA;
    notesChanged[newNoteB.id] = newNoteB;

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, notesChanged, {}, new Set());

    expect(isChanged).toBeTruthy();
    expect(newNotes.length).toEqual(5);
    expect(newNotes).toContain(newNoteA);
    expect(newNotes).toContain(newNoteB);
  });

  it("should add notes if they match", async () => {
    const searchWords = parseWords("fo");
    const oldNotes = [
      await createIndexedNote("first foo"),
      await createIndexedNote("second foo"),
      await createIndexedNote("third foo"),
    ];
    const newNoteA = await createIndexedNote("new foo");
    const newNoteB = await createIndexedNote("new foolish");
    const notesChanged = {};
    notesChanged[newNoteA.id] = newNoteA;
    notesChanged[newNoteB.id] = newNoteB;

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, notesChanged, {}, searchWords);

    expect(isChanged).toBeTruthy();
    expect(newNotes.length).toEqual(5);
    expect(newNotes).toContain(newNoteA);
    expect(newNotes).toContain(newNoteB);
  });

  it("should not add notes if they don't match", async () => {
    const searchWords = parseWords("fo");
    const oldNotes = [
      await createIndexedNote("first foo"),
      await createIndexedNote("second foo"),
      await createIndexedNote("third foo"),
    ];
    const newNoteA = await createIndexedNote( "new f");
    const newNoteB = await createIndexedNote("new of");
    const notesChanged = {};
    notesChanged[newNoteA.id] = newNoteA;
    notesChanged[newNoteB.id] = newNoteB;

    const {isChanged, newNotes} = updateListWithChanges(oldNotes, notesChanged, {}, searchWords);

    expect(isChanged).toBeFalsy();
    expect(newNotes.length).toEqual(3);
    expect(newNotes).not.toContain(newNoteA);
    expect(newNotes).not.toContain(newNoteB);
  });

  it("should sort new notes in place (with no search words)", async () => {
    const oldNotes = [
      await createIndexedNote("first", new Date(2000, 0, 30)),
      await createIndexedNote("second", new Date(2000, 0, 20)),
      await createIndexedNote("third", new Date(2000, 0, 10)),
    ];
    const newNoteA = await createIndexedNote( "newer", new Date(2000, 0, 25));
    const newNoteB = await createIndexedNote("new", new Date(2000, 0, 15));
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

  it("should sort new notes in place (with search words)", async () => {
    const searchWords = parseWords("fo ba");
    const oldNotes = [
      await createIndexedNote("first foo bar", new Date(2000, 0, 30)),
      await createIndexedNote("second foo bar", new Date(2000, 0, 20)),
      await createIndexedNote("third foo bar", new Date(2000, 0, 10)),
    ];
    const newNoteA = await createIndexedNote("newer bar foo", new Date(2000, 0, 25));
    const newNoteB = await createIndexedNote("bar new foo", new Date(2000, 0, 15));
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

  it("should delete, modify, add and sort (with search words)", async () => {
    const searchWords = parseWords("fo ba");
    const oldNotes = [
      await createIndexedNote("first foo bar", new Date(2000, 0, 30)),
      await createIndexedNote("second foo bar", new Date(2000, 0, 20)),
      await createIndexedNote("third foo bar", new Date(2000, 0, 10)),
    ];

    const notesDeleted = {};
    notesDeleted[generateTestId()] = true;
    notesDeleted[oldNotes[1].id] = true;

    const newNoteA = await createIndexedNote("not a match", new Date(2000, 0, 25));
    const newNoteB = await createIndexedNote("bar new foo", new Date(2000, 0, 5));
    const rawChange = {id: oldNotes[2].id, content: "changed foo bar", date: new Date(2000, 0, 10)};
    const changingNote = await serializeNote(deserializeNote(rawChange));
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
