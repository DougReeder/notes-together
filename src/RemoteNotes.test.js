// RemoteNotes.test.js - automated tests for Notes module for RemoteStorage
// Copyright © 2021 Doug Reeder

import generateTestId from "./util/generateTestId";
import {CONTENT_MAX, CONTENT_TOO_LONG, SerializedNote} from "./Note";
import _ from "fake-indexeddb/auto.js";
import RemoteStorage from "remotestoragejs";
import {RemoteNotes} from "./RemoteNotes";
import {NIL} from "uuid";
import {parseWords, TAG_LENGTH_MAX, STORE_OBJECT_DELAY} from "./storage";
import {deserializeNote, serializeNote} from "./serializeNote.js";
import QuietError from "./util/QuietError.js";


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
    it("should reject storing when passed a non-object", async () => {
      await expect(remoteStorage.documents.upsert()).rejects.toThrow();
    });

    it("should reject storing a note without valid id", async () => {
      await expect(remoteStorage.documents.upsert({content: "rubber"})).rejects.toThrow();
    });

    it("should fail storing a note without content", async () => {
      await expect(() => remoteStorage.documents.upsert({id: generateTestId()})).rejects.toThrow();
    });

    it("should use current date when date is invalid", async () => {
      const serializedNote = new SerializedNote(generateTestId(), undefined, '', '', "Tuesday");

      const savedNote = await remoteStorage.documents.upsert(serializedNote);

      expect(typeof savedNote.date).toEqual('string')
      expect(Date.now() - new Date(savedNote.date)).toBeLessThan(1000);
    });

    it("should use current date when date is undefined", async () => {
      const note = new SerializedNote(generateTestId(), undefined, '', '', undefined, false, undefined);

      const savedNote = await remoteStorage.documents.upsert(note);

      expect(typeof savedNote.date).toEqual('string')
      expect(Date.now() - new Date(savedNote.date)).toBeLessThan(1000);
    });

    it("should store text note unchanged when all fields good", async () => {
      const serializedNote = new SerializedNote(generateTestId(), 'text/plain', "elfin", "elfin", new Date('2000-01-01'), false, ["ELFIN"]);

      const savedNote = await remoteStorage.documents.upsert(serializedNote);

      expect(savedNote.id).toEqual(serializedNote.id);
      expect(savedNote.content).toEqual(serializedNote.content);
      expect(savedNote.title).toEqual(serializedNote.title);
      expect(new Date(savedNote.date)).toEqual(serializedNote.date);
      expect(savedNote.mimeType).toEqual(serializedNote.mimeType);
      expect(savedNote.isLocked).toEqual(serializedNote.isLocked);

      const retrieved = await remoteStorage.documents.get(serializedNote.id);
      expect(retrieved.content).toEqual(serializedNote.content);
      expect(retrieved.title).toEqual(serializedNote.title);
      expect(new Date(retrieved.date)).toEqual(serializedNote.date);
      expect(retrieved.mimeType).toEqual(serializedNote.mimeType);
      expect(retrieved.isLocked).toEqual(serializedNote.isLocked);
    });

    it("should store HTML note unchanged when all fields good", async () => {
      const serializedNote = new SerializedNote(generateTestId(), 'text/html;hint=SEMANTIC', "let a = b + c;", "<pre><code> let a = b + c; </code></pre>", new Date('1996-09-31'), false, []);

      const savedNote = await remoteStorage.documents.upsert(serializedNote);

      expect(savedNote.id).toEqual(serializedNote.id);
      expect(savedNote.content).toEqual(serializedNote.content);
      expect(savedNote.title).toEqual('let a = b + c;');
      expect(new Date(savedNote.date)).toEqual(serializedNote.date);
      expect(savedNote.mimeType).toEqual(serializedNote.mimeType);
      expect(savedNote.isLocked).toEqual(serializedNote.isLocked);
    });

    it("should update a note", async () => {
      const originalId = generateTestId();
      const originalText = "In Memory Yet Green";
      const original = new SerializedNote(originalId, 'text/plain', originalText, originalText, new Date(2002, 0, 1), false, []);

      await remoteStorage.documents.upsert(original);
      const updatedText = "<h2>In Joy Still Felt</h2>";
      const updated = new SerializedNote(originalId, 'text/html;hint=SEMANTIC', "In Joy Still Felt", updatedText, original.date, false, []);
      await remoteStorage.documents.upsert(updated);
      let retrieved = await remoteStorage.documents.get(originalId);
      expect(retrieved.content).toEqual(updatedText);
      expect(retrieved.title).toEqual(updated.title);
      expect(retrieved.date).toEqual(updated.date);
      expect(retrieved.mimeType).toEqual(updated.mimeType);
      expect(retrieved.isLocked).toEqual(updated.isLocked);
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
            const srl1 = new SerializedNote(id1, undefined, undefined, text1.slice(0, i), date1);
            const pr1 = remoteStorage.documents.upsert(srl1);
            const srl2 = new SerializedNote(id2, undefined, undefined, text2.slice(0, i), date2);
            const pr2 = remoteStorage.documents.upsert(srl2);
            const srl3 = new SerializedNote(id3, undefined, undefined, text3.slice(0, i), date3);
            const pr3 = remoteStorage.documents.upsert(srl3);
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
          } catch (err) {
            reject(err);
          }
        }, 0);

      });
    })

    it("should message user & not save when content too large", async () => {
      const mockPostMessage = window.postMessage = vitest.fn();
      const mockConsoleError = console.error = vitest.fn();

      const originalText = "a".repeat(CONTENT_MAX);
      const original = new SerializedNote(generateTestId(), undefined, "really long", originalText, new Date(2003, 4, 13), false, []);
      await remoteStorage.documents.upsert(original);

      let retrieved = await remoteStorage.documents.get(original.id);

      expect(retrieved.content).toEqual(originalText);   // validates success of upsert
      expect(retrieved.title).toEqual(original.title);
      expect(retrieved.date).toEqual(original.date);
      expect(retrieved.mimeType).toEqual(original.mimeType);
      expect(retrieved.isLocked).toEqual(original.isLocked);

      await new Promise(resolve => setTimeout(resolve, STORE_OBJECT_DELAY + 100));
      const updatedText = originalText + "x";
      const updated = new SerializedNote(original.id, original.mimeType, "longer", updatedText, original.date, false, []);

      await expect(remoteStorage.documents.upsert(updated)).rejects.toThrow(QuietError);

      retrieved = await remoteStorage.documents.get(original.id);
      expect(retrieved.content).toEqual(originalText);   // not updated
      expect(retrieved.title).toEqual(original.title);   // not updated
      expect(mockPostMessage).toHaveBeenCalledOnce();
      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining( {kind: 'TRANSIENT_MSG',
        message: CONTENT_TOO_LONG, severity: 'error'}), '/');
      expect(mockConsoleError).toHaveBeenCalledOnce();
    });
  });

  describe("get", () => {
    it("should return falsy for nonexistent notes", async () => {
      const savedNote = await remoteStorage.documents.get(NIL);
      expect(savedNote).toBeFalsy();
    });

    it("should store and retrieve text notes", async () => {
      const id = generateTestId();
      const raw = {id, mimeType: 'text/plain', content: "filbert nut", date: new Date(2001, 0, 1)};
      const original = await serializeNote(deserializeNote(raw));

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
      const raw = {id, mimeType: 'text/html;hint=SEMANTIC', content: "<li> wheat bread ", date: new Date(2005, 2, 31)};
      const original = await serializeNote(deserializeNote(raw));

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
      const serializedNote = new SerializedNote(id, undefined, "Thridi", "Thridi", new Date())
      await remoteStorage.documents.upsert(serializedNote);
      await expect(remoteStorage.documents.get(id)).resolves.toBeTruthy();

      await remoteStorage.documents.delete(id);

      await expect(remoteStorage.documents.get(id)).resolves.toBeUndefined();
    });

    it("should succeed in deleting non-existent note", async () => {
      console.error = vitest.fn();

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
