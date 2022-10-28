// storage.test.js - automated tests for storage abstraction for Notes Together
// Copyright © 2021-2022 Doug Reeder

import generateTestId from "./util/generateTestId";
import {createMemoryNote} from "./Note";
import auto from "fake-indexeddb/auto.js";
import {
  init,
  parseWords,
  upsertNote,
  getNote,
  deleteNote,
  findStubs,
  changeHandler,
  saveTag,
  listTags, deleteTag, WORD_LENGTH_MAX, TAG_LENGTH_MAX
} from "./storage";
import {getNoteDb} from "./idbNotes";
import {findFillerNoteIds} from "./idbNotes";
import {NIL} from "uuid";
import {waitFor} from "@testing-library/react";


if (!global.requestIdleCallback) {
  global.requestIdleCallback = function (callback, options) {
    options = options || {};
    const relaxation = 1;
    const timeout = options.timeout || relaxation;
    const start = performance.now();
    return setTimeout(function () {
      callback({
        get didTimeout() {
          return options.timeout ? false : (performance.now() - start) - relaxation > timeout;
        },
        timeRemaining: function () {
          return Math.max(0, relaxation + (performance.now() - start));
        },
      });
    }, relaxation);
  };
}


describe("storage", () => {
  beforeAll(() => {
    return init("testStorageDb");
  });

  describe("parseWords", () => {
    it("should retain internal, but not external apostrophes and single quotes", async () => {
      const wordArr = Array.from(parseWords("I'll fix 'John's & F'lar's' boat. F'lar’s|`f'larʼsʼ .'oddword.'-"))

      expect(wordArr).toContain("I'LL");
      expect(wordArr).toContain("FIX");
      expect(wordArr).toContain("JOHN'S");
      expect(wordArr).toContain("F'LAR'S");
      expect(wordArr).not.toContain("F'LAR’S")
      expect(wordArr).toContain("BOAT");
      expect(wordArr).toContain("ODDWORD");
      expect(wordArr.length).toEqual(6);
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
      const wordArr = Array.from(parseWords("C.A.T. scan, 1.3.1.2 P.T.A. ...42...69... '....' .......010.......020.......030......."));

      expect(wordArr).toContain("CAT");
      expect(wordArr).toContain("SCAN");
      expect(wordArr).toContain("1.3.1.2");
      expect(wordArr).not.toContain("1312");
      expect(wordArr).toContain("PTA");
      expect(wordArr).toContain("42..69");
      expect(wordArr).toContain("010..020..030");
      expect(wordArr.length).toEqual(6);
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

    it('tokenizes Greek to upper-case', async () => {
      const wordArr = Array.from(parseWords("φίλοι οίκος σεισμός χημεία λαμπάς Αλέξανδρος Μακεδών Ἰωάννης Άγιος Νικόλαος"));

      expect(wordArr).toContain("ΦΙΛΟΙ");
      expect(wordArr).toContain("ΟΙΚΟΣ");
      expect(wordArr).toContain("ΣΕΙΣΜΟΣ");
      expect(wordArr).toContain("ΧΗΜΕΙΑ");
      expect(wordArr).toContain("ΛΑΜΠΑΣ");
      expect(wordArr).toContain("ΑΛΕΞΑΝΔΡΟΣ");
      expect(wordArr).toContain("ΜΑΚΕΔΩΝ");
      expect(wordArr).toContain("ΙΩΑΝΝΗΣ");
      expect(wordArr).toContain("ΑΓΙΟΣ");
      expect(wordArr).toContain("ΝΙΚΟΛΑΟΣ");
    });

    it("should allow Greek text to be searchable in any locale", () => {
      const greek = "φίλοι οίκος σεισμός χημεία λαμπάς Αλέξανδρος Μακεδών Ἰωάννης Άγιος Νικόλαος";
      const wordSet = parseWords(greek);
      const wordSet2 = parseWords(greek.toUpperCase());

      expect(wordSet.size).toEqual(10);
      expect(wordSet2).toEqual(wordSet);
    });

    it("should handle common Modern Greek phrases", () => {
      const wordArr = Array.from(parseWords("Γειά σου! Καλημέρα! Καληνύχτα! Ευχαριστώ. Παρακαλώ. Δε μιλάω ελληνικά. Μπορειτε να με βοηθησετε?"));
      // There are so many more accented greek letters to be transliterated.

      expect(wordArr).toContain("ΓΕΙΑ");
      expect(wordArr).toContain("ΣΟΥ");
      expect(wordArr).toContain("ΚΑΛΗΜΕΡΑ");
      expect(wordArr).toContain("ΚΑΛΗΝΥΧΤΑ");
      expect(wordArr).toContain("ΕΥΧΑΡΙΣΤΩ");
      expect(wordArr).toContain("ΠΑΡΑΚΑΛΩ");
      expect(wordArr).toContain("ΔΕ");
      expect(wordArr).toContain("ΜΙΛΑΩ");
      expect(wordArr).toContain("ΕΛΛΗΝΙΚΑ");
      expect(wordArr).toContain("ΜΠΟΡΕΙΤΕ");
      expect(wordArr).toContain("ΝΑ");
      expect(wordArr).toContain("ΜΕ");
      expect(wordArr).toContain("ΒΟΗΘΗΣΕΤΕ");

      expect(wordArr.length).toEqual(13);
    });

    it("should handle common Ancient Greek phrases", () => {
      const wordArr = Array.from(parseWords("Ἀσπάζομαι! Χαῖρε! Τί πράττεις? Πάντ' ἀγαθὰ πράττω, ὦ φίλε. Ὄνομα σοι τί ἐστιν? Ποδαπὸς εἶ?"));
      // There are so many more greek letters with diacritics.

      expect(wordArr).toContain("ΑΣΠΑΖΟΜΑΙ");
      expect(wordArr).toContain("ΧΑΙΡΕ");
      expect(wordArr).toContain("ΤΙ");
      expect(wordArr).toContain("ΠΡΑΤΤΕΙΣ");
      expect(wordArr).toContain("ΠΑΝΤ");
      expect(wordArr).toContain("ΑΓΑΘΑ");
      expect(wordArr).toContain("ΠΡΑΤΤΩ");
      expect(wordArr).toContain("Ω");
      expect(wordArr).toContain("ΦΙΛΕ");
      expect(wordArr).toContain("ΟΝΟΜΑ");
      expect(wordArr).toContain("ΣΟΙ");
      expect(wordArr).toContain("ΕΣΤΙΝ");
      expect(wordArr).toContain("ΠΟΔΑΠΟΣ");
      expect(wordArr).toContain("ΕΙ");

      expect(wordArr.length).toEqual(14);
    });

    it("should limit index words to first 60 characters", () => {
      const wordArr = Array.from(parseWords("~~~Incomprehensibilities234567890abcdefghijklmnopqrstuvwxyz789ABCDEFGHIJKL'''"));

      expect(wordArr).toContain("INCOMPREHENSIBILITIES234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ789A");
      expect(wordArr.length).toEqual(1);
    });
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
      const original = createMemoryNote(generateTestId(), originalText, null,'text/html;hint=SEMANTIC');

      const note = await upsertNote(original);
      expect(note.content).toEqual("food foolish <strong>at</strong> attention it's ...its");
      expect(note.wordArr).toContain("FOOD");
      expect(note.wordArr).toContain("FOOLISH");
      expect(note.wordArr).not.toContain("AT");
      expect(note.wordArr).toContain("ATTENTION");
      expect(note.wordArr).toContain("IT'S");
      expect(note.wordArr).toContain("ITS");
      expect(note.wordArr.length).toEqual(5);
      expect(note.mimeType).toEqual(original.mimeType);
    });

    it('should drop keywords that match the start of another keyword', async () => {
      const originalText = "tar tarp tarpaulin workgroup workflow doorknob 2.10 2.10.3.8 door";
      const original = createMemoryNote(generateTestId(), originalText, null, 'text/plain');

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
      expect(cleanNote.mimeType).toEqual(original.mimeType);
    });

    it("should insert a note",async () => {
      const originalId = generateTestId();
      const originalText = "Simply <strike>unbearable";
      const originalDate = new Date(1997, 5, 16, 9);
      const original = createMemoryNote(originalId, originalText, originalDate, 'text/html;hint=SEMANTIC');

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
      expect(retrieved.mimeType).toEqual(original.mimeType);
    });

    it("should update a note",async () => {
      const originalId = generateTestId();
      const originalText = "I. Asimov: A Memoir";
      const originalDate = new Date(2003, 2, 15);
      const original = createMemoryNote(originalId, originalText, originalDate, 'text/plain');

      await upsertNote(original);
      const updatedText = "<h2>Eleven Years of Trying</h2>";
      const updatedDate = new Date(2010, 3, 16);
      const updated = createMemoryNote(originalId, updatedText, updatedDate, 'text/html;hint=SEMANTIC');
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
      expect(retrieved.mimeType).toEqual(updated.mimeType);
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
      expect(retrieved.mimeType).toEqual(original.mimeType);

      const {remoteStorage} = await init();
      await expect(remoteStorage.documents.get(originalId)).resolves.toBeUndefined();
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

  describe("changeHandler", () => {
    it("should create a note from incoming upsert", async () => {
      const id = generateTestId();
      const remoteNote = {
        id: id,
        content: `<p> Lorem ipsum dolor sit amet </p>`,
        title: `Itaque earum rerum hic tenetur a sapiente delectus`,
        date: new Date(1600, 2, 15),
        mimeType: 'text/html;hint=SEMANTIC',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      await changeHandler({origin: 'remote', oldValue: false, newValue: remoteNote});
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 10);
      });

      const retrieved = await getNote(id);
      expect(retrieved.content).toEqual(remoteNote.content);
      expect(retrieved.title).toEqual(remoteNote.title);
      expect(retrieved.date).toEqual(remoteNote.date);
      expect(retrieved.mimeType).toEqual(remoteNote.mimeType);
    });

    it("should delete a note from incoming delete", async () => {
      const id = generateTestId();
      const localNote = {
        id: id,
        content: `<p> Lorem ipsum dolor sit amet </p>`,
        title: `ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.`,
        date: new Date(1918, 10, 11),
        mimeType: 'text/html;hint=SEMANTIC',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      await upsertNote(localNote);
      await changeHandler({origin: 'remote', oldValue: localNote, newValue: false});
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 10);
      });

      const retrieved = await getNote(id);
      expect(retrieved).toBeFalsy();
    });

    it("should retain a modified note which was deleted on another device", async () => {
      const id = generateTestId();
      const localNote = {
        id: id,
        content: `<p> Lorem ipsum dolor sit amet </p>`,
        title: `Lorem ipsum dolor sit amet`,
        date: new Date(1500, 0, 1),
        mimeType: 'text/html;hint=SEMANTIC',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      await changeHandler({origin: 'conflict', oldValue: localNote, newValue: false});
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 30);
      });

      const retrieved = await getNote(id);
      expect(retrieved.content).toEqual(localNote.content);
      expect(retrieved.title).toEqual(localNote.title);
      expect(retrieved.date).toEqual(localNote.date);
      expect(retrieved.mimeType).toEqual(localNote.mimeType);
    });

    it("should restore a deleted note which was edited on another device", async () => {
      const id = generateTestId();
      const remoteNote = {
        id: id,
        content: ` Ut enim ad minim veniam `,
        title: `Ut enim ad minim veniam`,
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      await changeHandler({origin: 'conflict', oldValue: false, newValue: remoteNote});
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 33);
      });

      const retrieved = await getNote(id);
      expect(retrieved.content).toEqual(remoteNote.content);
      expect(retrieved.title).toEqual(remoteNote.title);
      // expect(retrieved.date).toEqual(remoteNote.date);
      expect(retrieved.mimeType).toEqual(remoteNote.mimeType);
    });

    it("should merge a conflicted HTML note", async () => {
      const id = generateTestId();
      const localNote = {
        id: id,
        content: `<p><em>My Day</em></p><p>It was dull.</p>`,
        title: `My Day\nIt was dull.`,
        date: new Date(2021, 8, 1),
        mimeType: 'text/html;hint=SEMANTIC',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      const remoteNote = {
        id: id,
        content: `<p><i>My Day</i></p><p>It was great!</p>`,
        title: `My Day\nIt was great!`,
        date: new Date(2021, 9, 1),
        mimeType: 'text/html',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      await changeHandler({origin: 'conflict', oldValue: localNote, newValue: remoteNote});
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 33);
      });

      const retrieved = await getNote(id);
      expect(retrieved.content).toEqual(`<p><em><em>My Day</em></em></p><p><del>It was dull.</del><ins>It was great!</ins></p>`);
      expect(retrieved.title).toMatch(/My Day\nIt was dull\. ?It was great!/);
      expect(retrieved.date).toEqual(remoteNote.date);
      expect(retrieved.mimeType).toEqual(localNote.mimeType);
    });

    it("should merge a conflicted text note", async () => {
      const id = generateTestId();
      const localNote = {
        id: id,
        content: `The movie was well-acted.`,
        title: `The movie was well-acted.`,
        date: new Date(2020, 3, 1),
        mimeType: 'text/markdown;hint=COMMONMARK',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      const remoteNote = {
        id: id,
        content: `The movie has good costuming.`,
        title: `The movie has good costuming.`,
        date: new Date(2020, 0, 1),
        mimeType: 'text/plain;charset=UTF-8',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      await changeHandler({origin: 'conflict', oldValue: localNote, newValue: remoteNote});
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 33);
      });

      const retrieved = await getNote(id);
      expect(retrieved.content).toEqual(`\n\nThe movie was well-acted.\n\nThe movie has good costuming.\n`);
      expect(retrieved.title).toEqual("The movie was well-acted.\nThe movie has good costuming.");
      expect(retrieved.date).toEqual(localNote.date);
      expect(retrieved.mimeType).toEqual(localNote.mimeType);
    });

    it("should merge a conflicted local HTML / remote text note as HTML", async () => {
      const id = generateTestId();
      const localNote = {
        id: id,
        content: `<h1>Staff Meeting</h1><p>Mary: let's do it!</p><p>John: let's be cautious</p>`,
        title: `Staff Meeting\nMary: let's do it!`,
        date: new Date(2021, 8, 2),
        mimeType: 'text/html;hint=SEMANTIC',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      const remoteNote = {
        id: id,
        content: `Staff Meeting
John: let's be cautious
Finance: we can't afford it.`,
        title: `Staff Meeting\nJohn: let's be cautious`,
        date: new Date(2021, 8, 1),
      };
      await changeHandler({origin: 'conflict', oldValue: localNote, newValue: remoteNote});
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 33);
      });

      const retrieved = await getNote(id);
      // TODO: parse text notes into paragraphs
      expect(retrieved.content).toEqual(`<del><h1>Staff Meeting</h1><p>Mary: let's do it!</p><p>John: let's be cautious</p></del><ins>Staff Meeting
John: let's be cautious
Finance: we can't afford it.</ins>`);
      expect(retrieved.title).toEqual("Staff Meeting");
      expect(retrieved.date).toEqual(localNote.date);
      expect(retrieved.mimeType).toEqual(localNote.mimeType);
    });

    it("should merge a conflicted local text / remote HTML note as HTML", async () => {
      const id = generateTestId();
      const localNote = {
        id: id,
        content: ` my notes on\n# Therapods `,
        title: `my notes on\n# Therapods`,
        date: new Date(2010, 1, 14),
        mimeType: 'text/markdown;hint=COMMONMARK',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      const remoteNote = {
        id: id,
        content: `<p>my notes on</p><h2>Therapods</h2>`,
        title: `Therapods\nmy notes on`,
        date: new Date(2010, 0, 1),
        mimeType: 'text/html;hint=SEMANTIC',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      await changeHandler({origin: 'conflict', oldValue: localNote, newValue: remoteNote});
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 33);
      });

      const retrieved = await getNote(id);
      // TODO: parse text notes into paragraphs
      expect(retrieved.content).toEqual(`<del> my notes on\n# Therapods </del><ins><p>my notes on</p><h2>Therapods</h2></ins>`);
      expect(retrieved.title).toEqual(`Therapods`);
      expect(retrieved.date).toEqual(localNote.date);
      expect(retrieved.mimeType).toEqual(remoteNote.mimeType);
    });

    it("should create a savedSearch from incoming upsert", async () => {
      window.postMessage = jest.fn();

      const original = "Man Cave ";
      const remoteSavedSearch = {
        original,
        '@context': "http://remotestorage.io/spec/modules/documents/savedSearch"
      };
      await changeHandler({
        origin: 'remote',
        oldValue: false,
        newValue: remoteSavedSearch}
      );
      await waitFor(() => expect(window.postMessage).toHaveBeenCalledTimes(1));
      expect(window.postMessage).toHaveBeenCalledWith({kind: 'TAG_CHANGE'}, expect.anything());
    });

    it("should create a savedSearch from incoming conflict", async () => {
      window.postMessage = jest.fn();

      const original = "Man Cave ";
      const remoteSavedSearch = {
        original,
        '@context': "http://remotestorage.io/spec/modules/documents/savedSearch"
      };
      await changeHandler({
        origin: 'conflict',
        oldValue: false,
        newValue: remoteSavedSearch}
      );
      await new Promise((resolve) => {
        requestIdleCallback(() => {
          setTimeout(() => {
            resolve();
          }, 10);
        });
      });

      const {originalTags, normalizedTags} = await listTags();
      expect(originalTags[0]).toEqual(original.trim());
      expect(originalTags.length).toEqual(1);
      expect(normalizedTags.values().next().value).toEqual(Array.from(parseWords(original)).sort().join(' '))
      expect(window.postMessage).toHaveBeenCalledTimes(1);
      expect(window.postMessage).toHaveBeenCalledWith({kind: 'TAG_CHANGE'}, expect.anything());
    });
  });

  describe("findStubs", () => {
    const note1 = createMemoryNote(generateTestId(), "<h2>The world</h2> set free", new Date(2011, 0, 1), 'text/html;hint=SEMANTIC');
    const note1title = "The world";
    const note2 = createMemoryNote(generateTestId(), "Math <th>is not</th> my favorite", new Date(2012, 1, 2), 'text/html;hint=SEMANTIC');
    const note2title = "is not";
    const note3 = createMemoryNote(generateTestId(), "I don't <pre>like thin crust</pre>", new Date(2013, 2, 3), 'text/html;hint=SEMANTIC');
    const note3title = "like thin crust";

    function createTestNote(content) {
      const startDate = new Date(2015, 0, 1);
      const date = new Date(startDate.getTime() + Math.random() * 7*24*60*60*1000);
      return createMemoryNote(generateTestId(), content, date, 'text/html;hint=SEMANTIC');
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
        await upsertNote(createMemoryNote(generateTestId(), content, null, 'text/html;hint=SEMANTIC'));
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


  describe("saveTag", () => {
    it("should reject searchWords that aren't a Set", async () => {
      await expect(saveTag(undefined, "foo")).rejects.toThrow(Error);
    });

    it("should reject searchWords with zero words", async () => {
      await expect(saveTag(new Set(), "foo")).rejects.toThrow(Error);
    });

    it("should reject a non-string search", async () => {
      await expect(saveTag(new Set(["BAR"]))).rejects.toThrow(Error);
    });

    it("should reject a blank search", async () => {
      await expect(saveTag(new Set(), '   ')).rejects.toThrow(/\b2\b/);
    });

    it("should reject a search with no letters", async () => {
      const searchStr = "%% ";
      const searchWords = parseWords(searchStr);
      await expect(saveTag(searchWords, searchStr)).rejects.toThrow(/\b2\b/);
    });

    it("should reject a search with one letter", async () => {
      const searchStr = '"a"';
      const searchWords = parseWords(searchStr);
      await expect(saveTag(searchWords, searchStr)).rejects.toThrow(/\b2\b/);
    });

    it("should reject a 1-character search", async () => {
      await expect(saveTag(new Set(["X"]), 'x')).rejects.toThrow(/\b2\b/);
    });
    it(`should reject a ${TAG_LENGTH_MAX+1}-character search`, async () => {
      const characters = new Array(TAG_LENGTH_MAX+1).fill('a').fill('z', Math.floor(TAG_LENGTH_MAX/2));
      characters[Math.floor(TAG_LENGTH_MAX/2)] = ' ';
      const searchStr = characters.join('');
      const searchWords = parseWords(searchStr);
      await expect(saveTag(searchWords, searchStr)).rejects.toThrow(new RegExp('\\b' + TAG_LENGTH_MAX + '\\b'));
    });

    it("should accept a 2-character search", async () => {
      const searchStr = "iq";
      const searchWords = parseWords(searchStr);
      await expect(saveTag(searchWords, searchStr)).resolves.toEqual("IQ");
    });

    it("should accept a 2-word search", async () => {
      const searchStr = "H v";
      const searchWords = parseWords(searchStr);
      await expect(saveTag(searchWords, searchStr)).resolves.toEqual("H V");
    });

    it("should return normalized search", async () => {
      const searchStr = "  house cat  ";
      const searchWords = parseWords(searchStr);
      await expect(saveTag(searchWords, searchStr)).resolves.toEqual("CAT HOUSE");
    });
  });

  describe("deleteTag", () => {
    it("should reject searchWords that aren't a Set", async () => {
      await expect(deleteTag(undefined)).rejects.toThrow(Error);
    });

    it("should reject empty set of searchWords", async () => {
      await expect(deleteTag(new Set())).rejects.toThrow(Error);
    });

    it("should reject searchWords with no letters", async () => {
      await expect(deleteTag(new Set(['']))).rejects.toThrow(Error);
    });

    it("should return normalized search", async () => {
      const searchStr = "  Man Cave  ";
      const searchWords = parseWords(searchStr);
      await expect(deleteTag(searchWords)).resolves.toEqual("CAVE MAN");
    });
  });

  describe("listTags", () => {
    beforeEach(async () => {
      for (const searchStr of ["house cat", "iq ", "H v ", "  Star Wars Trek  "]) {
        try {
          await deleteTag(parseWords(searchStr), searchStr);
        } catch (err) {
        }
      }
    });

    it("should return a sorted array of original searches and a Set of normalized searches", async () => {
      const searchStr1 = "iq ";
      const searchWords1 = parseWords(searchStr1);
      await saveTag(searchWords1, searchStr1);
      const searchStr2 = "H v ";
      const searchWords2 = parseWords(searchStr2);
      await saveTag(searchWords2, searchStr2);
      const searchStr3 = "  Star Wars Trek  ";
      const searchWords3 = parseWords(searchStr3);
      await saveTag(searchWords3, searchStr3);

      const {originalTags, normalizedTags} = await listTags();
      expect(originalTags).toBeInstanceOf(Array);
      expect(originalTags).toEqual([searchStr2.trim(), searchStr1.trim(), searchStr3.trim()]);
      expect(normalizedTags).toBeInstanceOf(Set);
      expect(normalizedTags).toEqual(new Set([
        Array.from(searchWords3).sort().join(' '),
        Array.from(searchWords2).sort().join(' '),
        Array.from(searchWords1).sort().join(' ')
      ]));
    });
  });
});
