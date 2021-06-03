// idbNotes.test.js - automated tests for storage for Notes Together
// Copyright © 2021 Doug Reeder

import {createMemoryNote} from "./Note";
import {getNote, searchNotes, upsertNote, deleteNote} from "./idbNotes";

function generateTestId() {
  return Number.MIN_SAFE_INTEGER - 10 + Math.ceil(Math.random() * Number.MIN_SAFE_INTEGER);
}

describe("upsertNote", () => {
  it("should insert a note",async () => {
    const originalId = generateTestId();
    const originalText = "Beggars <div>in Spain</div>";
    const original = createMemoryNote(originalId, originalText);

    const savedId = await upsertNote(original);
    expect(savedId).toEqual(originalId);

    const retrieved = await getNote(originalId);
    expect(retrieved.text).toEqual(originalText);
  });

  it("should update a note",async () => {
    const originalId = generateTestId();
    const originalText = "<h1>In Memory Yet Green</h1>";
    const original = createMemoryNote(originalId, originalText);

    const savedId = await upsertNote(original);
    const updatedText = "<h2>In Joy Still Felt</h2>";
    const updated = createMemoryNote(originalId, updatedText);
    const resavedId = await upsertNote(updated);
    const retrieved = await getNote(originalId);

    expect(retrieved.text).toEqual(updatedText);
  });

  it("should normalize text",async () => {
    const originalId = generateTestId();
    const originalText = "<header>A mind is a <strike>terrible thing to waste";
    const original = createMemoryNote(originalId, originalText);

    const savedId = await upsertNote(original);

    const retrieved = await getNote(originalId);
    expect(retrieved.text).toEqual("<div>A mind is a <strike>terrible thing to waste</strike></div>");
  });
});

describe("deleteNote", () => {
  it("should fail when passed a non-number", async () => {
    await expect(deleteNote(undefined)).rejects.toEqual(new Error("not finite: undefined"));
  });

  it("should remove note from storage", async () => {
    const id = generateTestId();
    const note = createMemoryNote(id, "Aroint, thee, knave!")
    await upsertNote(note);

    const deletedId = await deleteNote(id);
    expect(deletedId).toEqual(id);
    await expect(getNote(id)).rejects.toEqual(
        new Error('no note with id=' + id)
    );
  });
});

describe("searchNotes", () => {
  it("should return notes with words which start with search string", async () => {
    const note1 = createMemoryNote(generateTestId(), "<h2>The world set free");
    await upsertNote(note1);
    const note2 = createMemoryNote(generateTestId(), "Math <b>is not</b> my favorite");
    await upsertNote(note2);
    const note3 = createMemoryNote(generateTestId(), "I don't <pre>like thin crust</pre>");
    await upsertNote(note3);

    const matched = await searchNotes("th");
    const matchedTestIds = [];
    matched.forEach(note => {
      if (note.id < Number.MIN_SAFE_INTEGER) {
        matchedTestIds.push(note.id);
      }
    });
    expect(matchedTestIds).toContain(note1.id);
    expect(matchedTestIds).not.toContain(note2.id);
    expect(matchedTestIds).toContain(note3.id);
  });
});

afterAll(async () => {
  const notes = await searchNotes("");
  for (let i = 0; i < notes.length; ++i) {
    if (notes[i].id < Number.MIN_SAFE_INTEGER) {
      await deleteNote(notes[i].id);
    }
  }
});
