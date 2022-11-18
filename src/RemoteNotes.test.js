// RemoteNotes.test.js - automated tests for Notes module for RemoteStorage
// Copyright © 2021 Doug Reeder

import generateTestId from "./util/generateTestId";
import {createMemoryNote} from "./Note";
import auto from "fake-indexeddb/auto.js";
import RemoteStorage from "remotestoragejs";
import RemoteNotes from "./RemoteNotes";
import {NIL, validate as uuidValidate} from "uuid";
import {parseWords, TAG_LENGTH_MAX} from "./storage";


describe("RemoteNotes", () => {
  let remoteStorage;

  beforeAll(() => {
    return new Promise((resolve) => {
      const rs = new RemoteStorage({modules: [RemoteNotes], cache: true});
      rs.access.claim('documents', 'rw');

      rs.caching.enable('/documents/notes/');

      rs.on('ready', function () {
        remoteStorage = rs;
        resolve(rs);
      });
    });
  });

  describe("upsert", () => {
    it("should fail storing when passed a non-object", async () => {
      await expect(remoteStorage.documents.upsert()).rejects.toThrow();
    });

    it("should fail storing when passed a note without content", async () => {
      await expect(remoteStorage.documents.upsert({id: generateTestId()})).rejects.toThrow('content');
    });

    it("should reject storing notes with bad string dates", async () => {
      const memNote = createMemoryNote(generateTestId(), "elbow");
      memNote.date = "Tuesday";

      await expect(remoteStorage.documents.upsert(memNote)).rejects.toThrow("Invalid");
    });

    it("should add an id, if needed, when storing", async () => {
      const savedNote = await remoteStorage.documents.upsert({content: "rubber"});

      expect(uuidValidate(savedNote.id)).toBeTruthy();
    });

    it("should use current date when passed a non-date, non-string in date field", async () => {
      const note = createMemoryNote(generateTestId(), "something");
      note.date = undefined;

      const now = new Date();
      const savedNote = await remoteStorage.documents.upsert(note);

      expect(savedNote.date).toBeInstanceOf(Date)
      expect(savedNote.date.getFullYear()).toEqual(now.getFullYear());
      expect(savedNote.date.getMonth()).toEqual(now.getMonth());
      expect(savedNote.date.getDate()).toEqual(now.getDate());
    });

    it("should store text note unchanged when all fields good", async () => {
      const memNote = createMemoryNote(generateTestId(), "elfin", new Date('2000-01-01'), 'text/plain');

      const savedNote = await remoteStorage.documents.upsert(memNote);

      expect(savedNote.id).toEqual(memNote.id);
      expect(savedNote.content).toEqual(memNote.content);
      expect(savedNote.title).toEqual(memNote.content);
      expect(new Date(savedNote.date)).toEqual(memNote.date);
      expect(savedNote.mimeType).toEqual(memNote.mimeType);
    });

    it("should store HTML note unchanged when all fields good", async () => {
      const memNote = createMemoryNote(generateTestId(), "<pre><code> let a = b + c; ", new Date('1996-09-31'), 'text/html;hint=SEMANTIC');

      const savedNote = await remoteStorage.documents.upsert(memNote);

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

      await remoteStorage.documents.upsert(original);
      const updatedText = "<h2>In Joy Still Felt</h2>";
      const updated = createMemoryNote(originalId, updatedText, original.date, 'text/html;hint=SEMANTIC');
      await remoteStorage.documents.upsert(updated);
      const retrieved = await remoteStorage.documents.get(originalId);

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
            const pr1 = remoteStorage.documents.upsert(createMemoryNote(id1, text1.slice(0, i), date1));
            const pr2 = remoteStorage.documents.upsert(createMemoryNote(id2, text2.slice(0, i), date2));
            const pr3 = remoteStorage.documents.upsert(createMemoryNote(id3, text3.slice(0, i), date3));
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
      const savedNote = await remoteStorage.documents.get(NIL);
      expect(savedNote).toBeFalsy();
    });

    it("should store and retrieve text notes", async () => {
      const id = generateTestId();
      const original = createMemoryNote(id, "filbert nut", new Date(2001, 0, 1), 'text/plain');

      await remoteStorage.documents.upsert(original);
      const retrieved = await remoteStorage.documents.get(id);

      expect(retrieved.id).toEqual(original.id);
      expect(retrieved.content).toEqual(original.content);
      expect(retrieved.title).toEqual(original.content);   // text w/o padding
      expect(retrieved.date).toEqual(original.date);
      expect(retrieved.mimeType).toEqual(original.mimeType);
    });

    it("should store and retrieve HTML notes", async () => {
      const id = generateTestId();
      const original = createMemoryNote(id, "<li> wheat bread ", new Date(2005, 2, 31), 'text/html;hint=SEMANTIC');

      await remoteStorage.documents.upsert(original);
      const retrieved = await remoteStorage.documents.get(id);

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
      await remoteStorage.documents.upsert(createMemoryNote(id, "Thridi"));
      await expect(remoteStorage.documents.get(id)).resolves.toBeTruthy();

      await remoteStorage.documents.delete(id);

      await expect(remoteStorage.documents.get(id)).resolves.toBeUndefined();
    });

    it("should succeed in deleting non-existent note", async () => {
      console.error = jest.fn();

      await expect(remoteStorage.documents.delete(NIL)).resolves.toBeTruthy();

      expect(console.error).toHaveBeenCalledWith(expect.stringMatching("Cannot delete non-existing node"));
    });
  });

  describe("subscribe", () => {
    it("should reject non-functions", () => {
      expect(() => {remoteStorage.documents.subscribe(undefined)}).toThrow("undefined");
    });
  });

  describe("upsertTag", () => {
    it("should reject a searchWords that is not a Set", async () => {
      await expect(remoteStorage.documents.upsertTag(undefined, "foo")).rejects.toThrow(/searchWords/);
    });

    it("should reject a search that normalizes to 0 characters", async () => {
      const original = '%%';
      const searchWords = parseWords(original);
      await expect(remoteStorage.documents.upsertTag(searchWords, original)).rejects.toThrow(Error);
    });

    it("should reject a search that normalizes to 1 character", async () => {
      const original = '"a"';
      const searchWords = parseWords(original);
      await expect(remoteStorage.documents.upsertTag(searchWords, original)).rejects.toThrow(Error);
    });

    it(`should reject a normalized search with ${TAG_LENGTH_MAX+1} characters`, async () => {
      const characters = new Array(TAG_LENGTH_MAX+1).fill('a').fill('z', Math.floor(TAG_LENGTH_MAX/2));
      characters[Math.floor(TAG_LENGTH_MAX/2)] = ' ';
      const original = characters.join('');
      const searchWords = parseWords(original);
      await expect(remoteStorage.documents.upsertTag(searchWords, original)).rejects.toThrow(new RegExp('\\b' + TAG_LENGTH_MAX + '\\b'));
    });

    it("should reject a searchStr that is not a string", async () => {
      await expect(remoteStorage.documents.upsertTag(new Set(['FOO']), undefined)).rejects.toThrow(/searchStr/);
    });

    it("should accept a good normalized & original and allow overwriting", async () => {
      const original = "play  group ";
      const searchWords = parseWords(original);
      const normalized = Array.from(searchWords).sort().join(' ');
      await expect(remoteStorage.documents.upsertTag(searchWords, original)).resolves.toEqual(normalized);
      await expect(remoteStorage.documents.upsertTag(searchWords, "Group Play")).resolves.toEqual({normalized, original: "play  group"});
    });
  });

  describe("getAllTags", () => {
    it("should return an array of original tags & a Set of normalized tags", async () => {
      const original = "play  group ";
      const searchWords = parseWords(original);
      const normalized = Array.from(searchWords).sort().join(' ');
      await remoteStorage.documents.upsertTag(searchWords, original);

      const {originalTags, normalizedTags} = await remoteStorage.documents.getAllTags();
      expect(originalTags).toBeInstanceOf(Array);
      expect(originalTags).toEqual([original.trim()]);
      expect(normalizedTags).toBeInstanceOf(Set);
      expect(normalizedTags).toEqual(new Set([normalized]));

      const original2 = "Group Play ";
      const searchWords2 = parseWords(original2);
      await remoteStorage.documents.upsertTag(searchWords2, original2);

      const {originalTags: originalTags2, normalizedTags: normalizedTags2} = await remoteStorage.documents.getAllTags();
      expect(originalTags2).toEqual([original2.trim()]);
      expect(normalizedTags2).toEqual(new Set([normalized]));
    })
  });

  describe("deleteTag", () => {
    it("should reject searchWords that are not a Set", async () => {
      await expect(remoteStorage.documents.deleteTag(undefined)).rejects.toThrow(/searchWords/);
    });

    it("should reject a searchWords with no words", async () => {
      await expect(remoteStorage.documents.deleteTag(new Set())).rejects.toThrow(Error);
    });

    it("should remove the indicated tag and throw error if it doesn't exist", async () => {
      const original = "play  group ";
      const searchWords = parseWords(original);
      const normalized = Array.from(searchWords).sort().join(' ');
      await expect(remoteStorage.documents.upsertTag(searchWords, original)).resolves.toBeTruthy();

      await expect(remoteStorage.documents.deleteTag(searchWords, original)).resolves.toEqual(normalized);

      const {originalTags, normalizedTags} = await remoteStorage.documents.getAllTags();
      expect(originalTags).toEqual([]);
      expect(normalizedTags).toEqual(new Set());

      await expect(remoteStorage.documents.deleteTag(searchWords, original)).rejects.toThrow(/No such tag “play  group ”/);
    });
  });
});
