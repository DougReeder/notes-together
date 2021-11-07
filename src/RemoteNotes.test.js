// RemoteNotes.test.js - automated tests for Notes module for RemoteStorage
// Copyright © 2021 Doug Reeder

import generateTestId from "./util/generateTestId";
import {createMemoryNote} from "./Note";
import auto from "fake-indexeddb/auto.js";
import RemoteStorage from "remotestoragejs";
import RemoteNotes from "./RemoteNotes";
import {NIL, validate as uuidValidate} from "uuid";


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

    it("should fail storing when passed a note without content", async () => {
      await expect(remoteStorage.notes.upsert({id: generateTestId()})).rejects.toThrow('content');
    });

    it("should reject storing notes with bad string dates", async () => {
      const memNote = createMemoryNote(generateTestId(), "elbow");
      memNote.date = "Tuesday";

      await expect(remoteStorage.notes.upsert(memNote)).rejects.toThrow("Invalid");
    });

    it("should add an id, if needed, when storing", async () => {
      const savedNote = await remoteStorage.notes.upsert({content: "rubber"});

      expect(uuidValidate(savedNote.id)).toBeTruthy();
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

    it("should store text note unchanged when all fields good", async () => {
      const memNote = createMemoryNote(generateTestId(), "elfin", new Date('2000-01-01'), 'text/plain');

      const savedNote = await remoteStorage.notes.upsert(memNote);

      expect(savedNote.id).toEqual(memNote.id);
      expect(savedNote.content).toEqual(memNote.content);
      expect(savedNote.title).toEqual(memNote.content);
      expect(new Date(savedNote.date)).toEqual(memNote.date);
      expect(savedNote.mimeType).toEqual(memNote.mimeType);
    });

    it("should store HTML note unchanged when all fields good", async () => {
      const memNote = createMemoryNote(generateTestId(), "<pre><code> let a = b + c; ", new Date('1996-09-31'), 'text/html;hint=SEMANTIC');

      const savedNote = await remoteStorage.notes.upsert(memNote);

      expect(savedNote.id).toEqual(memNote.id);
      expect(savedNote.content).toEqual(memNote.content + '</code></pre>');
      expect(savedNote.title).toEqual('let a = b + c;');
      expect(new Date(savedNote.date)).toEqual(memNote.date);
      expect(savedNote.mimeType).toEqual(memNote.mimeType);
    });

    it("should update a note", async () => {
      const originalId = generateTestId();
      const originalText = "In Memory Yet Green";
      const original = createMemoryNote(originalId, originalText, new Date(2002, 0, 1), 'text/plain');

      await remoteStorage.notes.upsert(original);
      const updatedText = "<h2>In Joy Still Felt</h2>";
      const updated = createMemoryNote(originalId, updatedText, original.date, 'text/html;hint=SEMANTIC');
      await remoteStorage.notes.upsert(updated);
      const retrieved = await remoteStorage.notes.get(originalId);

      expect(retrieved.content).toEqual(updatedText);
      expect(retrieved.title).toEqual("In Joy Still Felt");
      expect(retrieved.date).toEqual(updated.date);
      expect(retrieved.mimeType).toEqual(updated.mimeType);
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
              expect(cleanNotes[0]?.content).toEqual(text1);
              expect(cleanNotes[1]?.content).toEqual(text2);
              expect(cleanNotes[2]?.content).toEqual(text3);
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
      const savedNote = await remoteStorage.notes.get(NIL);
      expect(savedNote).toBeFalsy();
    });

    it("should store and retrieve text notes", async () => {
      const id = generateTestId();
      const original = createMemoryNote(id, "filbert nut", new Date(2001, 0, 1), 'text/plain');

      await remoteStorage.notes.upsert(original);
      const retrieved = await remoteStorage.notes.get(id);

      expect(retrieved.id).toEqual(original.id);
      expect(retrieved.content).toEqual(original.content);
      expect(retrieved.title).toEqual(original.content);   // text w/o padding
      expect(retrieved.date).toEqual(original.date);
      expect(retrieved.mimeType).toEqual(original.mimeType);
    });

    it("should store and retrieve HTML notes", async () => {
      const id = generateTestId();
      const original = createMemoryNote(id, "<li> wheat bread ", new Date(2005, 2, 31), 'text/html;hint=SEMANTIC');

      await remoteStorage.notes.upsert(original);
      const retrieved = await remoteStorage.notes.get(id);

      expect(retrieved.id).toEqual(original.id);
      expect(retrieved.content).toEqual(`<li> wheat bread </li>`);
      expect(retrieved.title).toEqual("• wheat bread");
      expect(retrieved.date).toEqual(original.date);
      expect(retrieved.mimeType).toEqual(original.mimeType);
    });
  });

  describe("delete", () => {
    it("should remove note from storage", async () => {
      const id = generateTestId();
      await remoteStorage.notes.upsert(createMemoryNote(id, "Thridi"));
      await expect(remoteStorage.notes.get(id)).resolves.toBeTruthy();

      await remoteStorage.notes.delete(id);

      await expect(remoteStorage.notes.get(id)).resolves.toBeUndefined();
    });

    it("should succeed in deleting non-existent note", async () => {
      await expect(remoteStorage.notes.delete(NIL)).resolves.toBeTruthy();
    });
  });

  describe("subscribe", () => {
    it("should reject non-functions", () => {
      expect(() => {remoteStorage.notes.subscribe(undefined)}).toThrow("undefined");
    });
  });
});
