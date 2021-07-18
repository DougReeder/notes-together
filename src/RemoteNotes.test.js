// RemoteNotes.test.js - automated tests for Notes module for RemoteStorage
// Copyright © 2021 Doug Reeder

import {createMemoryNote} from "./Note";
import auto from "fake-indexeddb/auto.js";
import RemoteStorage from "remotestoragejs";
import RemoteNotes from "./RemoteNotes";

function generateTestId() {
  return Number.MIN_SAFE_INTEGER - 10 + Math.ceil(Math.random() * Number.MIN_SAFE_INTEGER);
}

describe("RemoteNotes", () => {
  let remoteStorage;

  beforeAll(() => {
    return new Promise((resolve) => {
      const rs = new RemoteStorage({modules: [RemoteNotes], cache: true});
      rs.access.claim('notes', 'rw');

      rs.caching.enable('/notes/');

      rs.on('ready', function () {
        remoteStorage = rs;
        resolve(rs);
      });
    });
  });

  describe("upsert", () => {
    it("should fail storing when passed a non-object", async () => {
      await expect(remoteStorage.notes.upsert()).rejects.toThrow();
    });

    // it("should fail when passed a note with id greater than range", async () => {
    //   const memNote = createMemoryNote(Number.MAX_SAFE_INTEGER+10,"foo");
    //   await expect(remoteStorage.notes.upsert(memNote)).rejects.toThrow('id');
    // });

    it("should fail storing when passed a note without text", async () => {
      await expect(remoteStorage.notes.upsert({id: generateTestId()})).rejects.toThrow('text');
    });

    it("should reject storing notes with bad string dates", async () => {
      const memNote = createMemoryNote(generateTestId(), "elbow");
      memNote.date = "Tuesday";

      await expect(remoteStorage.notes.upsert(memNote)).rejects.toThrow("Invalid");
    });

    it("should add an id, if needed, when storing", async () => {
      const savedNote = await remoteStorage.notes.upsert({text: "rubber"});

      expect(savedNote.id).toBeGreaterThanOrEqual(Number.MIN_SAFE_INTEGER);
      expect(savedNote.id).toBeLessThanOrEqual((Number.MAX_SAFE_INTEGER));
    });

    it("should use current date when passed a non-date, non-string in date field", async () => {
      const note = createMemoryNote(generateTestId(), "something");
      note.date = undefined;

      const now = new Date();
      const savedNote = await remoteStorage.notes.upsert(note);

      expect(savedNote.date).toBeInstanceOf(Date)
      expect(savedNote.date.getFullYear()).toEqual(now.getFullYear());
      expect(savedNote.date.getMonth()).toEqual(now.getMonth());
      expect(savedNote.date.getDate()).toEqual(now.getDate());
    });

    it("should store unchanged when all fields good", async () => {
      const memNote = createMemoryNote(generateTestId(), "elfin", new Date('2000-01-01'));

      const savedNote = await remoteStorage.notes.upsert(memNote);

      expect(savedNote.id).toEqual(memNote.id);
      expect(savedNote.text).toEqual(memNote.text);
      expect(new Date(savedNote.date)).toEqual(memNote.date);
    });

    it("should update a note", async () => {
      const originalId = generateTestId();
      const originalText = "<h1>In Memory Yet Green</h1>";
      const original = createMemoryNote(originalId, originalText, new Date(2002, 0, 1));

      await remoteStorage.notes.upsert(original);
      const updatedText = "<h2>In Joy Still Felt</h2>";
      const updated = createMemoryNote(originalId, updatedText, original.date);
      await remoteStorage.notes.upsert(updated);
      const retrieved = await remoteStorage.notes.get(originalId);

      expect(retrieved.text).toEqual(updatedText);
      expect(retrieved.date).toEqual(original.date);
    });

    it("should update multiple notes", () => {
      return new Promise((resolve, reject) => {
        const id1 = generateTestId();
        const text1 = "O beautiful for spacious skies";
        const date1 = new Date(Date.now() + (Math.random()*32 - 31) * 24*60*60*1000);
        const id2 = generateTestId();
        const text2 = "For amber waves of grain";
        const date2 = new Date(Date.now() + (Math.random()*32 - 31) * 24*60*60*1000);
        const id3 = generateTestId();
        const text3 = "For purple mountains majesty";
        const date3 = new Date(Date.now() + (Math.random()*32 - 31) * 24*60*60*1000);
        const maxLength = Math.max(text1.length, text2.length, text3.length);

        let i=0;
        const timer = setInterval(async () => {
          try {
            ++i;
            const pr1 = remoteStorage.notes.upsert(createMemoryNote(id1, text1.slice(0, i), date1));
            const pr2 = remoteStorage.notes.upsert(createMemoryNote(id2, text2.slice(0, i), date2));
            const pr3 = remoteStorage.notes.upsert(createMemoryNote(id3, text3.slice(0, i), date3));
            /* eslint-disable jest/no-conditional-expect */
            if (i < maxLength) {
              await expect(pr1).resolves.toBeTruthy();
              await expect(pr2).resolves.toBeTruthy();
              await expect(pr3).resolves.toBeTruthy();
            } else {
              clearInterval(timer);

              const cleanNotes = await Promise.all([pr1, pr2, pr3]);
              expect(cleanNotes[0]?.text).toEqual(text1);
              expect(cleanNotes[1]?.text).toEqual(text2);
              expect(cleanNotes[2]?.text).toEqual(text3);
              resolve();
            }
            /* eslint-enable jest/no-conditional-expect */
          } catch (err) {
            reject(err);
          }
        }, 0);

      });
    })
  });

  describe("get", () => {
    it("should return falsy for nonexistent notes", async () => {
      const savedNote = await remoteStorage.notes.get(Number.MAX_SAFE_INTEGER + 2);
      expect(savedNote).toBeFalsy();
    });

    it("should store and retrieve notes", async () => {
      const id = generateTestId();
      const original = createMemoryNote(id, "filbert nut", new Date(2001, 0, 1));

      await remoteStorage.notes.upsert(original);
      const retrieved = await remoteStorage.notes.get(id);

      expect(retrieved).toEqual(original);
    });
  });

  describe("delete", () => {
    it("should fail when passed a non-number", async () => {
      await expect(remoteStorage.notes.delete(undefined)).rejects.toThrow("undefined");
    });

    it("should remove note from storage", async () => {
      const id = generateTestId();
      await remoteStorage.notes.upsert(createMemoryNote(id, "Thridi"));
      await expect(remoteStorage.notes.get(id)).resolves.toBeTruthy();

      await remoteStorage.notes.delete(id);

      await expect(remoteStorage.notes.get(id)).resolves.toBeUndefined();
    });

    it("should succeed in deleting non-existent note", async () => {
      await expect(remoteStorage.notes.delete(0)).resolves.toBeTruthy();
    });
  });

  describe("subscribe", () => {
    it("should reject non-functions", () => {
      expect(() => {remoteStorage.notes.subscribe(undefined)}).toThrow("undefined");
    });
  });
});
