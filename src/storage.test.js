// storage.test.js - automated tests for storage abstraction for Notes Together
// Copyright © 2021 Doug Reeder

import {createMemoryNote} from "./Note";
import auto from "fake-indexeddb/auto.js";
import {init, upsertNote, getNote, deleteNote} from "./storage";

function generateTestId() {
  return Number.MIN_SAFE_INTEGER - 10 + Math.ceil(Math.random() * Number.MIN_SAFE_INTEGER);
}

describe("storage", () => {
  beforeAll(() => {
    return init("testStorageDb");
  });

  describe("upsertNote", () => {
    it("should fail storing when passed a non-object", async () => {
      await expect(upsertNote()).rejects.toThrow();
    });

    it("should fail storing when passed a note without text", async () => {
      await expect(upsertNote({id:generateTestId()})).rejects.toThrow('text');
    });

    it("should reject storing notes with bad string dates", async () => {
      const memNote = createMemoryNote(generateTestId(), "elbow");
      memNote.date = "Tuesday";

      await expect(upsertNote(memNote)).rejects.toThrow("Invalid");
    });

    it("should extract normalized, minimal set of keywords from note", async () => {
      const originalText = "food foolish <b>at</b> attention it's ...its";
      const original = createMemoryNote(generateTestId(), originalText);

      const stub = await upsertNote(original);
      expect(stub.text).toEqual("food foolish <b>at</b> attention it's ...its");
      expect(stub.wordArr).toContain("FOOD");
      expect(stub.wordArr).toContain("FOOLISH");
      expect(stub.wordArr).not.toContain("AT");
      expect(stub.wordArr).toContain("ATTENTION");
      expect(stub.wordArr).toContain("IT'S");
      expect(stub.wordArr).toContain("ITS");
      expect(stub.wordArr.length).toEqual(5);
    });
  });

  describe("getNote", () => {
    it("should reject when id is undefined", async () => {
      await expect(getNote(undefined)).rejects.toThrow();
    });

    it("should resolve with undefined when note doesn't exist", async () => {
      await expect(getNote(0)).resolves.toBeUndefined();
    });
  });

  describe("deleteNote", () => {
    it("should fail when passed a non-number", async () => {
      await expect(deleteNote(undefined)).rejects.toThrow("undefined");
    });

    it("should remove note from storage", async () => {
      const id = generateTestId();
      const note = createMemoryNote(id, "Aroint, thee, knave!")
      await upsertNote(note);

      const deleteResult = await deleteNote(id);
      expect(deleteResult).toContain(id);
      await expect(getNote(id)).resolves.toBeUndefined();
    });

    it("should succeed in deleting non-existent note", async () => {
      const deleteResult = await deleteNote(0);
      expect(deleteResult).toContain(0);
    });
  });
});
