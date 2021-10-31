// storage.test.js - automated tests for storage abstraction for Notes Together
// Copyright © 2021 Doug Reeder

import generateTestId from "./util/generateTestId";
import {createMemoryNote} from "./Note";
import auto from "fake-indexeddb/auto.js";
import {init, parseWords, upsertNote, getNote, deleteNote, findStubs} from "./storage";
import {getNoteDb} from "./idbNotes";
import {findFillerNoteIds} from "./idbNotes";
import {NIL, v4 as uuidv4} from "uuid";


describe("storage", () => {
  beforeAll(() => {
    return init("testStorageDb");
  });

  describe("parseWords", () => {
    it("should retain internal, but not external apostrophes and single quotes", async () => {
      const wordArr = Array.from(parseWords("I'll fix 'John's & F'lar's' boat. F'lar’s|`f'larʼsʼ"))

      expect(wordArr).toContain("I'LL");
      expect(wordArr).toContain("FIX");
      expect(wordArr).toContain("JOHN'S");
      expect(wordArr).toContain("F'LAR'S");
      expect(wordArr).not.toContain("F'LAR’S")
      expect(wordArr).toContain("BOAT");
      expect(wordArr.length).toEqual(5);
    });

    it("forms words with ASCII apostrophe in place of right-single-quote and modifier-letter-apostrophe", function () {
      const wordArr = Array.from(parseWords("’Ellen’s’ ʼJakeʼsʼ"));
      expect(wordArr).toContain("ELLEN'S");
      expect(wordArr).toContain("JAKE'S");
      expect(wordArr.length).toEqual(2);
    });

    it("should decode HTML entities", () => {
      const wordArr = Array.from(parseWords("I&apos;ll fix &apos;John&#39;s &amp; F&apos;lar&apos;s&apos; boat. Jane&nbsp;Doe &quot;real&quot; &lt;tag&gt;"))

      expect(wordArr).toContain("I'LL");
      expect(wordArr).not.toContain("APOS")
      expect(wordArr).toContain("FIX");
      expect(wordArr).toContain("JOHN'S");
      expect(wordArr).not.toContain("AMP")
      expect(wordArr).toContain("F'LAR'S");
      expect(wordArr).not.toContain("F'LAR’S")
      expect(wordArr).toContain("BOAT");
      expect(wordArr).toContain("JANEDOE");
      expect(wordArr).toContain("REAL");
      expect(wordArr).not.toContain("QUOT")
      expect(wordArr).toContain("TAG");
      expect(wordArr).not.toContain("LT")
      expect(wordArr).not.toContain("GT")
      expect(wordArr.length).toEqual(8);
    });

    it("forms words using hyphens, incl. no-break & soft (but not dashes) then drops them", async () => {
      const wordArr = Array.from(parseWords("state‐of‑the­art \n614-555-1212 29–37"));

      expect(wordArr).toContain("STATEOFTHEART");
      expect(wordArr).toContain("6145551212");
      expect(wordArr).toContain("29");
      expect(wordArr).toContain("37");
      expect(wordArr.length).toEqual(4);
    });

    it('forms words using underscores, then drops them', function () {
      const wordArr = Array.from(parseWords('__FILE_FORMAT__\r\n________ john_doe@example.com'));
      expect(wordArr).toContain("FILEFORMAT");
      expect(wordArr).toContain("JOHNDOE");
      expect(wordArr).toContain("EXAMPLECOM");
      expect(wordArr.length).toEqual(3);
    });

    it("forms words using non-breaking space, then drops them", async () => {
      const wordArr = Array.from(parseWords("USD 350 million 100 km § 3.2"));

      expect(wordArr).toContain("USD350MILLION");
      expect(wordArr).toContain("100KM");
      expect(wordArr).toContain("3.2");
      expect(wordArr.length).toEqual(3);
    });

    it("forms words using carets, then drops them; coerces superscript characters to regular digits", async () => {
      const wordArr = Array.from(parseWords("^^^^ ^^^C^3I C³I R^2 R^17 ^pointer ³He"));

      expect(wordArr).toContain("C3I");
      expect(wordArr).toContain("R2");
      expect(wordArr).toContain("R17");
      expect(wordArr).toContain("POINTER");
      expect(wordArr).toContain("3HE");
      expect(wordArr.length).toEqual(5);
    });

    it("coerces subscripts to regular digits when forming words", async () => {
      const wordArr = Array.from(parseWords("H₂O N₀ N_A"))

      expect(wordArr).toContain("H2O");
      expect(wordArr).toContain("N0");
      expect(wordArr).toContain("NA");
      expect(wordArr.length).toEqual(3);
    });

    it("forms words using periods, then drops them, but allows decimal points in numbers", async () => {
      const wordArr = Array.from(parseWords("C.A.T. scan, 1.3.1.2 P.T.A. ...42...69..."));

      expect(wordArr).toContain("CAT");
      expect(wordArr).toContain("SCAN");
      expect(wordArr).toContain("1.3.1.2");
      expect(wordArr).not.toContain("1312");
      expect(wordArr).toContain("PTA");
      expect(wordArr).toContain("42...69");
      expect(wordArr.length).toEqual(5);
    });

    it('tokenizes "Það á sér langan aðdraganda." to "THATH", "A", "SER", "LANGAN", "ATHDRAGANDA"', async () => {
      const wordArr = Array.from(parseWords("Það á sér langan aðdraganda."));

      expect(wordArr).toContain("THATH");
      expect(wordArr).toContain("A");
      expect(wordArr).toContain("SER");
      expect(wordArr).toContain("LANGAN");
      expect(wordArr).toContain("ATHDRAGANDA");
      expect(wordArr.length).toEqual(5);
    });

    it('in the default locale, tokenizes "café Peña słychać grüßen Åland Ælfred"', async () => {
      const wordArr = Array.from(parseWords("café Peña słychać grüßen Åland Ælfred"));

      expect(wordArr).toContain("CAFE");
      expect(wordArr).toContain("PENA");
      expect(wordArr).toContain("SLYCHAC");
      expect(wordArr).toContain("GRUSSEN");
      expect(wordArr).toContain("ALAND");
      expect(wordArr).toContain("AELFRED");
      expect(wordArr.length).toEqual(6);
    });

    it('in the default locale, tokenizes "Öffnen beider Türen?" to "OFFNEN", "BEIDER", "TUREN"', function () {
      const wordArr = Array.from(parseWords('Öffnen beider Türen?'));
      expect(wordArr).toContain("OFFNEN");
      expect(wordArr).toContain("BEIDER");
      expect(wordArr).toContain("TUREN");
      expect(wordArr.length).toEqual(3);
    });

    it('in the default locale, tokenizes ABCDEFG_ÀÁÂÃÄÅÆÇ ÈÉÊËÌÍÎÏÐÑ to ABCDEFGAAAAAAAEC EEEEIIIITHN', async () => {
      const wordArr = Array.from(parseWords("ABCDEFG_ÀÁÂÃÄÅÆÇ ÈÉÊËÌÍÎÏÐÑ"));

      expect(wordArr).toContain("ABCDEFGAAAAAAAEC");
      expect(wordArr).toContain("EEEEIIIITHN");
      expect(wordArr.length).toEqual(2);
    });

    it('in the default locale, tokenizes ÒÓÔÕÖ×ØÙÚÛÜÝÞß àáâãäåæ_ç_èéêë_ìíîï to OOOOO OUUUUYTHSS AAAAAAAECEEEEIIII', async () => {
      const wordArr = Array.from(parseWords("ÒÓÔÕÖ×ØÙÚÛÜÝÞß àáâãäåæ_ç_èéêë_ìíîï"));

      expect(wordArr).toContain("OOOOO");
      expect(wordArr).toContain("OUUUUYTHSS");
      expect(wordArr).toContain("AAAAAAAECEEEEIIII");
      expect(wordArr.length).toEqual(3);
    });

    it('in the default locale, tokenizes ð_ñ_òóôõö_÷_ø_ùúûü_ý_þ_ÿ to THNOOOOO OUUUUYTHY', async () => {
      const wordArr = Array.from(parseWords("ð_ñ_òóôõö_÷_ø_ùúûü_ý_þ_ÿ"));

      expect(wordArr).toContain("THNOOOOO");
      expect(wordArr).toContain("OUUUUYTHY");
      expect(wordArr.length).toEqual(2);
    });

    it('tokenizes "ŰűŲų Ŵŵ ŶŷŸ ŹźŻżŽž ſ" to "UUUU", "WW", "YYY", "ZZZZZZ", "S"', function () {
      const wordArr = Array.from(parseWords('ŰűŲų Ŵŵ ŶŷŸ ŹźŻżŽž ſ'));

      expect(wordArr).toContain("UUUU");
      expect(wordArr).toContain("WW");
      expect(wordArr).toContain("YYY");
      expect(wordArr).toContain("ZZZZZZ");
      expect(wordArr).toContain("S");
      expect(wordArr.length).toEqual(5);
    });

    it('tokenizes fullwidth digits like normal digits', function () {
      const wordArr = Array.from(parseWords('０１２３４５６７８９'));

      expect(wordArr).toContain("0123456789");
      expect(wordArr.length).toEqual(1);
    });

    it('tokenizes fullwidth capital letters like normal letters', function () {
      const wordArr = Array.from(parseWords('ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ'));

      expect(wordArr).toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
      expect(wordArr.length).toEqual(1);
    });

    it('tokenizes fullwidth small letters like normal letters', function () {
      const wordArr = Array.from(parseWords('ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ'));

      expect(wordArr).toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
      expect(wordArr.length).toEqual(1);
    });

    it('tokenizes superscript digits like normal digits', function () {
      const wordArr = Array.from(parseWords('⁰¹²³⁴⁵⁶⁷⁸⁹ⁱⁿ'));

      expect(wordArr).toContain("0123456789IN");
      expect(wordArr.length).toEqual(1);
    });

    it('tokenizes subscript digits like normal digits', function () {
      const wordArr = Array.from(parseWords('₀₁₂₃₄₅₆₇₈₉ₐₑₒₓ'));

      expect(wordArr).toContain("0123456789AEOX");
      expect(wordArr.length).toEqual(1);
    });

    it('in the default locale, tokenizes φίλοι οίκος σεισμός χημεία λαμπάς Αλέξανδρος Μακεδών Ἰωάννης Άγιος Νικόλαος to PHILOI OIKOS SEISMOS CHEMEIA LAMPAS ALEXANDROS MAKEDON IOANNES AGIOS NIKOLAOS', async () => {
      const wordArr = Array.from(parseWords("φίλοι οίκος σεισμός χημεία λαμπάς Αλέξανδρος Μακεδών Ἰωάννης Άγιος Νικόλαος"));

      expect(wordArr).toContain("PHILOI");
      expect(wordArr).toContain("OIKOS");
      expect(wordArr).toContain("SEISMOS");
      expect(wordArr).toContain("CHEMEIA");
      expect(wordArr).toContain("LAMPAS");
      expect(wordArr).toContain("ALEXANDROS");
      expect(wordArr).toContain("MAKEDON");
      expect(wordArr).toContain("IOANNES");
      expect(wordArr).toContain("AGIOS");
      expect(wordArr).toContain("NIKOLAOS");
    });

    it("should allow Greek text to be searchable in any locale", () => {
      const greek = "φίλοι οίκος σεισμός χημεία λαμπάς Αλέξανδρος Μακεδών Ἰωάννης Άγιος Νικόλαος";
      const wordSet = parseWords(greek);
      const wordSet2 = parseWords(greek.toUpperCase());

      expect(wordSet.size).toEqual(10);
      expect(wordSet2).toEqual(wordSet);
    });

    it('should parse "℥" symbol as OZ', () => {
      const wordArr = Array.from(parseWords("23℥ brimstone"));

      expect(wordArr).toContain("23OZ");
      expect(wordArr).toContain("BRIMSTONE");
    });

    it('should parse "℻" symbol as FAX', () => {
      const wordArr = Array.from(parseWords("order ℻614-555-1212"));

      expect(wordArr).toContain("ORDER");
      expect(wordArr).toContain("FAX6145551212");
    });

    it('should parse "℞" symbol as Rx', () => {
      const wordArr = Array.from(parseWords("℞2901"));

      expect(wordArr).toContain("RX2901");
    })
  });

  describe("upsertNote", () => {
    it("should fail storing when passed a non-object", async () => {
      await expect(upsertNote()).rejects.toThrow();
    });

    it("should fail storing when passed a note without content", async () => {
      await expect(upsertNote({id:generateTestId()})).rejects.toThrow('content');
    });

    it("should reject storing notes with bad string dates", async () => {
      const memNote = createMemoryNote(generateTestId(), "elbow");
      memNote.date = "Tuesday";

      await expect(upsertNote(memNote)).rejects.toThrow("Invalid");
    });

    it("should extract normalized, minimal set of keywords from note", async () => {
      const originalText = "food foolish <b>at</b> attention it's ...its";
      const original = createMemoryNote(generateTestId(), originalText);

      const note = await upsertNote(original);
      expect(note.content).toEqual("food foolish <b>at</b> attention it's ...its");
      expect(note.wordArr).toContain("FOOD");
      expect(note.wordArr).toContain("FOOLISH");
      expect(note.wordArr).not.toContain("AT");
      expect(note.wordArr).toContain("ATTENTION");
      expect(note.wordArr).toContain("IT'S");
      expect(note.wordArr).toContain("ITS");
      expect(note.wordArr.length).toEqual(5);
    });

    it('should drop keywords that match the start of another keyword', async () => {
      const originalText = "tar tarp tarpaulin workgroup workflow doorknob 2.10 2.10.3.8 door";
      const original = createMemoryNote(generateTestId(), originalText);

      const cleanNote = await upsertNote(original);

      expect(cleanNote.content).toEqual(originalText);
      expect(cleanNote.wordArr).toContain("TARPAULIN");
      expect(cleanNote.wordArr).not.toContain("TAR");
      expect(cleanNote.wordArr).not.toContain("TARP");
      expect(cleanNote.wordArr).toContain("WORKGROUP");
      expect(cleanNote.wordArr).toContain("WORKFLOW");
      expect(cleanNote.wordArr).not.toContain("WORK");
      expect(cleanNote.wordArr).toContain("DOORKNOB");
      expect(cleanNote.wordArr).not.toContain("DOOR");
      expect(cleanNote.wordArr).toContain("2.10.3.8");
      expect(cleanNote.wordArr).not.toContain("2.10");
      expect(cleanNote.wordArr.length).toEqual(5);
    });

    it("should insert a note",async () => {
      const originalId = generateTestId();
      const originalText = "Simply <strike>unbearable";
      const originalDate = new Date(1997, 5, 16, 9);
      const original = createMemoryNote(originalId, originalText, originalDate);

      const savedNote = await upsertNote(original);
      expect(savedNote.id).toEqual(originalId);
      expect(savedNote.wordArr).toContain("SIMPLY");
      expect(savedNote.wordArr).toContain("UNBEARABLE");
      expect(savedNote.wordArr.length).toEqual(2);

      const retrieved = await getNote(originalId);
      expect(retrieved.content.slice(0, originalText.length)).toEqual(originalText);
      expect(retrieved.date).toEqual(originalDate);
      expect(retrieved.wordArr).toContain("SIMPLY");
      expect(retrieved.wordArr).toContain("UNBEARABLE");
      expect(retrieved.wordArr.length).toEqual(2);
    });

    it("should update a note",async () => {
      const originalId = generateTestId();
      const originalText = "<h1>I. Asimov: A Memoir</h1>";
      const originalDate = new Date(2003, 2, 15);
      const original = createMemoryNote(originalId, originalText, originalDate);

      await upsertNote(original);
      const updatedText = "<h2>Eleven Years of Trying</h2>";
      const updatedDate = new Date(2010, 3, 16);
      const updated = createMemoryNote(originalId, updatedText, updatedDate);
      await upsertNote(updated, 'DETAIL');

      const retrieved = await getNote(originalId);
      expect(retrieved.content).toEqual(updatedText);
      expect(retrieved.date).toEqual(updatedDate);
      expect(retrieved.wordArr).not.toContain("I");
      expect(retrieved.wordArr).not.toContain("ASIMOV");
      expect(retrieved.wordArr).not.toContain("A");
      expect(retrieved.wordArr).not.toContain("MEMOIR");
      expect(retrieved.wordArr).toContain("ELEVEN");
      expect(retrieved.wordArr).toContain("YEARS");
      expect(retrieved.wordArr).toContain("OF");
      expect(retrieved.wordArr).toContain("TRYING");
      expect(retrieved.wordArr.length).toEqual(4);
    });

    it("should insert an indexed note only in IndexedDb, when initiator is REMOTE", async () => {
      const originalId = generateTestId();
      const originalText = "offer of offertory off";
      const originalDate = new Date(1999, 8, 23, 17);
      const original = createMemoryNote(originalId, originalText, originalDate);

      const savedNote = await upsertNote(original, 'REMOTE');
      expect(savedNote.id).toEqual(originalId);
      expect(savedNote.wordArr).toContain("OFFERTORY");
      expect(savedNote.wordArr.length).toEqual(1);

      const retrieved = await getNoteDb(originalId);
      expect(retrieved.content.slice(0, originalText.length)).toEqual(originalText);
      expect(retrieved.date).toEqual(originalDate);
      expect(retrieved.wordArr).toContain("OFFERTORY");
      expect(retrieved.wordArr.length).toEqual(1);
      const remoteStorage = await init();
      await expect(remoteStorage.notes.get(originalId)).resolves.toBeUndefined();
    });
  });

  describe("getNote", () => {
    it("should reject when id is undefined", async () => {
      await expect(getNote(undefined)).rejects.toThrow();
    });

    it("should resolve with undefined when note doesn't exist", async () => {
      await expect(getNote(NIL)).resolves.toBeUndefined();
    });
  });

  describe("deleteNote", () => {
    it("should remove note from storage", async () => {
      const id = generateTestId();
      const note = createMemoryNote(id, "Aroint, thee, knave!")
      await upsertNote(note);

      const deleteResult = await deleteNote(id);
      expect(deleteResult).toContain(id);
      await expect(getNote(id)).resolves.toBeUndefined();
    });

    it("should succeed in deleting non-existent note", async () => {
      const deleteResult = await deleteNote(NIL);
      expect(deleteResult).toContain(NIL);
    });
  });


  describe("findStubs", () => {
    const note1 = createMemoryNote(generateTestId(), "<h2>The world</h2> set free", new Date(2011, 0, 1));
    const note1title = "The world";
    const note2 = createMemoryNote(generateTestId(), "Math <th>is not</th> my favorite", new Date(2012, 1, 2));
    const note2title = "is not";
    const note3 = createMemoryNote(generateTestId(), "I don't <pre>like thin crust</pre>", new Date(2013, 2, 3));
    const note3title = "like thin crust";

    function createTestNote(content) {
      const startDate = new Date(2015, 0, 1);
      const date = new Date(startDate.getTime() + Math.random() * 7*24*60*60*1000);
      return createMemoryNote(generateTestId(), content, date);
    }

    beforeAll(async () => {
      for (const noteId of await findFillerNoteIds()) {
        await deleteNote(noteId);
      }

      await upsertNote(note1);
      await upsertNote(note2);
      await upsertNote(note3);

      for (let i = 0; i < 10; ++i) {
        await upsertNote(createTestNote(note1.content));
        await upsertNote(createTestNote(note2.content));
        await upsertNote(createTestNote(note3.content));
      }
      await upsertNote(createTestNote(note2.content));
      await upsertNote(createTestNote(note3.content));
      await upsertNote(createTestNote(note3.content));
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

          const testStubs = [];
          matched.forEach(stub => {
            testStubs.push(stub);
          });
          expect(testStubs.length).toEqual(36);
          expect(testStubs.reduce((acc, item) => {
            return (item.title === note1title ? 1 : 0) + acc;
          }, 0)).toEqual(11);
          expect(testStubs.reduce((acc, item) => {
            return (item.title === note2title ? 1 : 0) + acc;
          }, 0)).toEqual(12);
          expect(testStubs.reduce((acc, item) => {
            return (item.title === note3title ? 1 : 0) + acc;
          }, 0)).toEqual(13);

          let lastDate = Date.now();
          for (const testStub of testStubs) {
            expect(testStub.date.getTime()).toBeLessThanOrEqual(lastDate);
            lastDate = testStub.date.getTime();
          }

          expect(isPartial).toBeFalsy();
          expect(isSearch).toBeFalsy();
          done();
        } catch (err2) {
          done(err2);
        }
      }
    });

    it("should return stubs containing words which start with the only search word", done => {
      findStubs(parseWords("th"), callback);

      function callback(err, matched, {isPartial, isFinal, isSearch} = {}) {
        if (err) { return done(err) }
        try {
          if (!isFinal) {
            /* eslint-disable jest/no-conditional-expect */
            expect(matched.length).toBeGreaterThan(0);
            expect(matched.length).toBeLessThan(24);
            expect(isPartial).toBeTruthy();
            expect(isSearch).toBeTruthy();
            /* eslint-enable jest/no-conditional-expect */
            return;
          }

          const testStubs = [];
          matched.forEach(stub => {
            testStubs.push(stub);
          });
          expect(testStubs.length).toEqual(24);
          expect(testStubs.reduce((acc, item) => {
            return (item.title === note1title ? 1 : 0) + acc;
          }, 0)).toEqual(11);
          expect(testStubs.reduce((acc, item) => {
            return (item.title === note2title ? 1 : 0) + acc;
          }, 0)).toEqual(0);
          expect(testStubs.reduce((acc, item) => {
            return (item.title === note3title ? 1 : 0) + acc;
          }, 0)).toEqual(13);

          let lastDate = Date.now();
          for (const testStub of testStubs) {
            expect(testStub.date.getTime()).toBeLessThanOrEqual(lastDate);
            lastDate = testStub.date.getTime();
          }

          expect(isPartial).toBeFalsy();
          expect(isSearch).toBeTruthy();
          done();
        } catch (err2) {
          done(err2);
        }
      }
    });

    it("should return stubs containing words which start with each of the search words", done => {
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

          const testStubs = [];
          const testStubIds = new Set();
          matched.forEach(stub => {
            testStubs.push(stub);
            testStubIds.add(stub.id);
          });
          expect(testStubs.length).toEqual(13);
          expect(testStubIds.size).toEqual(13);
          expect(testStubs.reduce((acc, item) => {
            return (item.title === note1title ? 1 : 0) + acc;
          }, 0)).toEqual(0);
          expect(testStubs.reduce((acc, item) => {
            return (item.title === note2title ? 1 : 0) + acc;
          }, 0)).toEqual(0);
          expect(testStubs.reduce((acc, item) => {
            return (item.title === note3title ? 1 : 0) + acc;
          }, 0)).toEqual(13);

          let lastDate = Date.now();
          for (const testStub of testStubs) {
            expect(testStub.date.getTime()).toBeLessThanOrEqual(lastDate);
            lastDate = testStub.date.getTime();
          }

          expect(isPartial).toBeFalsy();
          expect(isSearch).toBeTruthy();
          done();
        } catch (err2) {
          done(err2);
        }
      }
    });
  });

  describe("findStubs (max)", () => {
    const content = "something rather short";

    beforeAll(async () => {
      for (const noteId of await findFillerNoteIds()) {
        await deleteNote(noteId);
      }

      for (let i = 0; i < 500; ++i) {
        await upsertNote(createMemoryNote(generateTestId(), content));
      }
    });

    it("should return 500 stubs when search string is empty", done => {
      findStubs(new Set(), callback);

      function callback(err, matched, {isPartial, isFinal, isSearch} = {}) {
        if (err) {
          return done(err)
        }
        try {
          if (!isFinal) {
            /* eslint-disable jest/no-conditional-expect */
            expect(matched.length).toBeGreaterThan(0);
            expect(matched.length).toBeLessThan(500);
            expect(isPartial).toBeTruthy();
            expect(isSearch).toBeFalsy();
            /* eslint-enable jest/no-conditional-expect */
            return;
          }

          const testStubs = [];
          matched.forEach(stub => {
            testStubs.push(stub);
          });
          expect(testStubs.length).toEqual(500);
          let lastDate = Date.now();
          for (const stub of testStubs) {
            expect(stub.title).toMatch(/^something rather short/);
            expect(stub.date.getTime()).toBeLessThanOrEqual(lastDate);
            lastDate = stub.date.getTime();
          }

          expect(isPartial).toBeFalsy();
          expect(isSearch).toBeFalsy();
          done();
        } catch (err2) {
          done(err2);
        }
      }
    });

    it("should return 500 stubs with multiple search words", done => {
      findStubs(parseWords("Some-thin rathE s.h.o.r."), callback);

      function callback(err, matched, {isPartial, isFinal, isSearch} = {}) {
        if (err) {
          return done(err)
        }
        try {
          if (!isFinal) {
            /* eslint-disable jest/no-conditional-expect */
            expect(matched.length).toBeGreaterThan(0);
            expect(matched.length).toBeLessThan(500);
            expect(isPartial).toBeTruthy();
            expect(isSearch).toBeTruthy();
            /* eslint-enable jest/no-conditional-expect */
            return;
          }

          const testStubs = [];
          matched.forEach(stub => {
            testStubs.push(stub);
          });
          expect(testStubs.length).toEqual(500);
          let lastDate = Date.now();
          for (const stub of testStubs) {
            expect(stub.title).toMatch(/^something rather short/);
            expect(stub.date.getTime()).toBeLessThanOrEqual(lastDate);
            lastDate = stub.date.getTime();
          }

          expect(isPartial).toBeFalsy();
          expect(isSearch).toBeTruthy();
          done();
        } catch (err2) {
          done(err2);
        }
      }
    });
  });

  xdescribe("findStubs (stress)", () => {
    jest.setTimeout(30000);

    const content = `<h1>In Congress, July 4, 1776</h1>
<p><b>The unanimous Declaration of the thirteen united States of America</b>, When in the Course of human events, it becomes necessary for one people to dissolve the political bands which have connected them with another, and to assume among the powers of the earth, the separate and equal station to which the Laws of Nature and of Nature's God entitle them, a decent respect to the opinions of mankind requires that they should declare the causes which impel them to the separation.</p>
<p>We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness.—That to secure these rights, Governments are instituted among Men, deriving their just powers from the consent of the governed, —That whenever any Form of Government becomes destructive of these ends, it is the Right of the People to alter or to abolish it, and to institute new Government, laying its foundation on such principles and organizing its powers in such form, as to them shall seem most likely to effect their Safety and Happiness. Prudence, indeed, will dictate that Governments long established should not be changed for light and transient causes; and accordingly all experience hath shewn, that mankind are more disposed to suffer, while evils are sufferable, than to right themselves by abolishing the forms to which they are accustomed. But when a long train of abuses and usurpations, pursuing invariably the same Object evinces a design to reduce them under absolute Despotism, it is their right, it is their duty, to throw off such Government, and to provide new Guards for their future security.—Such has been the patient sufferance of these Colonies; and such is now the necessity which constrains them to alter their former Systems of Government. The history of the present King of Great Britain is a history of repeated injuries and usurpations, all having in direct object the establishment of an absolute Tyranny over these States. To prove this, let Facts be submitted to a candid world.</p>
<p>He has refused his Assent to Laws, the most wholesome and necessary for the public good.
<p>He has forbidden his Governors to pass Laws of immediate and pressing importance, unless suspended in their operation till his Assent should be obtained; and when so suspended, he has utterly neglected to attend to them.
<p>He has refused to pass other Laws for the accommodation of large districts of people, unless those people would relinquish the right of Representation in the Legislature, a right inestimable to them and formidable to tyrants only.
<p>He has called together legislative bodies at places unusual, uncomfortable, and distant from the depository of their public Records, for the sole purpose of fatiguing them into compliance with his measures.
<p>He has dissolved Representative Houses repeatedly, for opposing with manly firmness his invasions on the rights of the people.
<p>He has refused for a long time, after such dissolutions, to cause others to be elected; whereby the Legislative powers, incapable of Annihilation, have returned to the People at large for their exercise; the State remaining in the mean time exposed to all the dangers of invasion from without, and convulsions within.
<p>He has endeavoured to prevent the population of these States; for that purpose obstructing the Laws for Naturalization of Foreigners; refusing to pass others to encourage their migrations hither, and raising the conditions of new Appropriations of Lands.
<p>He has obstructed the Administration of Justice, by refusing his Assent to Laws for establishing Judiciary powers.
<p>He has made Judges dependent on his Will alone, for the tenure of their offices, and the amount and payment of their salaries.
<p>He has erected a multitude of New Offices, and sent hither swarms of Officers to harrass our people, and eat out their substance.
<p>He has kept among us, in times of peace, Standing Armies without the Consent of our legislatures.
`;

    beforeAll(async () => {
      for (const noteId of await findFillerNoteIds()) {
        await deleteNote(noteId);
      }

      for (let i = 0; i < 600; ++i) {
        await upsertNote(createMemoryNote(generateTestId(), content));
      }
    });

    it("should return a maximum of 500 stubs when search string is empty", done => {
      findStubs(new Set(), callback);

      function callback(err, matched, {isPartial, isFinal, isSearch} = {}) {
        if (err) {
          return done(err)
        }
        try {
          if (!isFinal) {
            /* eslint-disable jest/no-conditional-expect */
            expect(matched.length).toBeGreaterThan(0);
            expect(matched.length).toBeLessThan(500);
            expect(isPartial).toBeTruthy();
            expect(isSearch).toBeFalsy();
            /* eslint-enable jest/no-conditional-expect */
            return;
          }

          const testStubs = [];
          matched.forEach(stub => {
            testStubs.push(stub);
          });
          expect(testStubs.length).toEqual(500);
          for (const stub of testStubs) {
            expect(stub.title).toMatch(/^In Congress, July 4, 1776\nThe unanimous Declaration of the thirteen united States of America, When in the Course of human events/);
          }

          expect(isPartial).toBeTruthy();
          expect(isSearch).toBeFalsy();
          done();
        } catch (err2) {
          done(err2);
        }
      }
    });

    it("should return a maximum of 500 stubs with multiple search words", done => {
      const searchWords = parseWords("177 congres declaratio governmen self-eviden");
      findStubs(searchWords, callback);

      function callback(err, matched, {isPartial, isFinal, isSearch} = {}) {
        if (err) {
          return done(err)
        }
        try {
          if (!isFinal) {
            /* eslint-disable jest/no-conditional-expect */
            expect(matched.length).toBeGreaterThan(0);
            expect(matched.length).toBeLessThan(500);
            expect(isPartial).toBeTruthy();
            expect(isSearch).toBeTruthy();
            /* eslint-enable jest/no-conditional-expect */
            return;
          }

          const testStubs = [];
          matched.forEach(stub => {
            testStubs.push(stub);
          });
          expect(testStubs.length).toEqual(500);
          for (const stub of testStubs) {
            expect(stub.title).toMatch(/^In Congress, July 4, 1776\nThe unanimous Declaration of the thirteen united States of America, When in the Course of human events/);
          }

          expect(isPartial).toBeTruthy();
          expect(isSearch).toBeTruthy();
          done();
        } catch (err2) {
          done(err2);
        }
      }
    });
  });
});
