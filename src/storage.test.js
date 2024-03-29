// storage.test.js - automated tests for storage abstraction for Notes Together
// Copyright © 2021–2024 Doug Reeder

import generateTestId from "./util/generateTestId";
import {NodeNote} from "./Note";
import "fake-indexeddb/auto";
import {
  init,
  parseWords,
  getNote,
  deleteNote,
  findStubs,
  changeHandler,
  saveTag,
  listTags, deleteTag, TAG_LENGTH_MAX, STORE_OBJECT_DELAY, upsertNote
} from "./storage";
import {getNoteDb} from "./idbNotes";
import {findFillerNoteIds} from "./idbNotes";
import {NIL} from "uuid";
import {waitFor} from "@testing-library/react";
import {deserializeHtml, serializeHtml} from "./slateHtmlUtil.js";
import {deserializeNote, serializeNote} from "./serializeNote.js";


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
      const wordArr = Array.from(parseWords("USD 350 million § 3.2 100 km 12 34 56"));

      expect(wordArr).toContain("USD350MILLION");
      expect(wordArr).toContain("3.2");
      expect(wordArr).toContain("100KM");
      expect(wordArr).toContain("123456");
      expect(wordArr.length).toEqual(4);
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

    it('tokenizes "Það á sér langan aðdraganda. ƿǷȜȝ" to "THATH", "A", "SER", "LANGAN", "ATHDRAGANDA" "WWYY"', async () => {
      const wordArr = Array.from(parseWords("Það á sér langan aðdraganda. ƿǷȜȝ"));

      expect(wordArr).toContain("THATH");
      expect(wordArr).toContain("A");
      expect(wordArr).toContain("SER");
      expect(wordArr).toContain("LANGAN");
      expect(wordArr).toContain("ATHDRAGANDA");
      expect(wordArr).toContain("WWYY");
      expect(wordArr.length).toEqual(6);
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

    it('in the default locale, tokenizes ABCDEFG_ÀÁÂÃÄÅÆÇ ÈÉÊËÌÍÎÏÐÑ  to ABCDEFGAAAAAAAEC EEEEIIIITHN', async () => {
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
      await expect(upsertNote(undefined, undefined)).rejects.toThrow();
    });

    it("should fail storing when passed a note without nodes", async () => {
      const badNote = {id: generateTestId(), subtype: '', date: new Date(), isLocked: false};

      await expect(upsertNote(badNote, undefined)).rejects.toThrow('nodes');
    });


    it("should insert a note",async () => {
      const originalId = generateTestId();
      const nodes = [{type: 'paragraph', children: [{text: "Simply "}, {text: "unbearable", strikethrough: true}]}];
      const originalDate = new Date(1996, 5, 16, 9);
      const original = new NodeNote(originalId, 'html;hint=SEMANTIC', nodes, originalDate, true);

      const savedNote = await upsertNote(original, undefined);
      expect(savedNote.id).toEqual(originalId);
      expect(savedNote.mimeType).toEqual('text/' + original.subtype);
      expect(savedNote.title).toEqual("Simply unbearable");
      expect(savedNote.content).toEqual('<p>Simply <s>unbearable</s></p>');
      expect(savedNote.wordArr).toContain("SIMPLY");
      expect(savedNote.wordArr).toContain("UNBEARABLE");
      expect(savedNote.wordArr.length).toEqual(2);

      const retrieved = await getNote(originalId);
      expect(retrieved.mimeType).toEqual('text/' + original.subtype);
      expect(retrieved.content).toEqual(serializeHtml(original.nodes));
      expect(retrieved.date).toEqual(originalDate);
      expect(retrieved.wordArr).toContain("SIMPLY");
      expect(retrieved.wordArr).toContain("UNBEARABLE");
      expect(retrieved.wordArr.length).toEqual(2);
      expect(retrieved.isLocked).toEqual(original.isLocked);

      const {remoteStorage} = await init();
      const remoteNote = await remoteStorage.documents.get(original.id);
      expect(remoteNote.mimeType).toEqual('text/' + original.subtype);
      expect(remoteNote.title).toEqual("Simply unbearable");
      expect(remoteNote.content).toEqual(serializeHtml(original.nodes));
      expect(remoteNote.date).toEqual(original.date);
      expect(remoteNote.isLocked).toEqual(original.isLocked);
    });

    it("should update a note",async () => {
      const originalId = generateTestId();
      const nodes = [
        {type: 'paragraph', children: [{text: "I. Asimov:"}]},
        {type: 'paragraph', children: [{text: " A Memoir"}]},
      ];
      const originalDate = new Date(2003, 2, 15);
      const original = await new NodeNote(originalId, 'plain', nodes, originalDate, true);

      const returned1 = await upsertNote(original, undefined);   // SerializedNote
      expect(returned1.title).toEqual("I. Asimov:\nA Memoir");
      const updatedNodes = [{type: 'heading-two', children: [{text: "Eleven Years of Trying"}]}];
      const updatedDate = new Date(2010, 3, 16);
      const updated = new NodeNote(originalId, 'html;hint=SEMANTIC', updatedNodes, updatedDate, false);
      const returned2 = await upsertNote(updated, 'DETAIL');   // NodeNote
      expect(returned2.subtype).toEqual(updated.subtype);
      expect(returned2.title).toBeFalsy();
      let retrieved = await getNote(originalId);
      expect(retrieved.title).toEqual("I. Asimov:\nA Memoir");   // delay time has not elapsed
      expect(retrieved.date).toEqual(originalDate);
      expect(retrieved.wordArr).toContain("I");
      expect(retrieved.wordArr).toContain("ASIMOV");
      expect(retrieved.wordArr).toContain("MEMOIR");
      expect(retrieved.wordArr.length).toEqual(3);

      await new Promise(resolve => setTimeout(resolve, STORE_OBJECT_DELAY + 100));
      retrieved = await getNote(originalId);
      expect(retrieved.mimeType).toEqual('text/' + updated.subtype);
      expect(retrieved.title).toEqual("Eleven Years of Trying");
      expect(retrieved.content).toEqual("<h2>Eleven Years of Trying</h2>");
      expect(retrieved.date).toEqual(updatedDate);
      expect(retrieved.wordArr).not.toContain("I");
      expect(retrieved.wordArr).not.toContain("ASIMOV");
      expect(retrieved.wordArr).not.toContain("MEMOIR");
      expect(retrieved.wordArr).toContain("ELEVEN");
      expect(retrieved.wordArr).toContain("YEARS");
      expect(retrieved.wordArr).toContain("OF");
      expect(retrieved.wordArr).toContain("TRYING");
      expect(retrieved.wordArr.length).toEqual(4);
      expect(retrieved.isLocked).toEqual(updated.isLocked);
    });

    it("should insert an indexed note only in IndexedDb, when initiator is REMOTE", async () => {
      const originalId = generateTestId();
      const nodes = [{type: 'paragraph', children: [{text: "offer of offertory off"}]}];
      const originalDate = new Date(1999, 8, 23, 17);
      const original = new NodeNote(originalId, 'html', nodes, originalDate, false);

      const savedNote = await upsertNote(original, 'REMOTE');
      expect(savedNote.id).toEqual(originalId);
      expect(savedNote.content).toEqual(serializeHtml(original.nodes));
      expect(savedNote.wordArr).toContain("OFFERTORY");
      expect(savedNote.wordArr.length).toEqual(1);

      const retrieved = await getNoteDb(originalId);
      expect(retrieved.content).toEqual(serializeHtml(original.nodes));
      expect(retrieved.mimeType).toEqual('text/' + original.subtype);
      expect(retrieved.date).toEqual(originalDate);
      expect(retrieved.wordArr).toContain("OFFERTORY");
      expect(retrieved.wordArr.length).toEqual(1);

      const {remoteStorage} = await init();
      await expect(remoteStorage.documents.get(originalId)).resolves.toBeUndefined();
    });

    it("should round-trip a note and its update", async () => {
      const nodes = [
        {type: 'heading-one', children: [{text: "Some", bold: true}, {text: " Title"}]},
        {type: 'heading-one', children: [{text: "Another", italic: true}, {text: " Title"}]},
        {type: 'paragraph', children: [{text: "The Luddites were "}, {text: "technophobes", strikethrough: true},
            {text: " grass-roots labor organizers."}]},
      ];
      const original = new NodeNote(generateTestId(), 'html;hint=SEMANTIC', nodes,
        new Date(2002, 7, 15, 20), true);

      await upsertNote(original, undefined);

      const deserializedNote = deserializeNote(await getNote(original.id));
      expect(deserializedNote).toEqual(original);

      const {remoteStorage} = await init();
      const deserializedRemoteNote = deserializeNote(await remoteStorage.documents.get(original.id));
      expect(deserializedRemoteNote).toEqual(original);

      const updatedNodes = [{type: 'heading-one', children: [{text: "something agitating"}]}, ...nodes];
      const updated = new NodeNote(original.id, original.subtype, updatedNodes, original.date, original.isLocked);

      await upsertNote(updated, undefined);

      const immediateNote = deserializeNote(await getNote(original.id));
      expect(immediateNote).toEqual(original);   // delay time has not elapsed
      const immediateRemoteNote = await deserializeNote(await remoteStorage.documents.get(original.id));
      expect(immediateRemoteNote).toEqual(original);

      await new Promise(resolve => setTimeout(resolve, STORE_OBJECT_DELAY + 100));
      const delayedNote = deserializeNote(await getNote(original.id));
      expect(delayedNote).toEqual(updated);
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
    it("should fail when passed a non-number", async () => {
      await expect(deleteNote(undefined)).rejects.toThrow();
    });

    it("should remove note from storage", async () => {
      const id = generateTestId();
      const nodes = [{type: 'paragraph', children: [{text: "Aroint, thee, knave!"}]}];
      await upsertNote(new NodeNote(id, undefined, nodes), undefined);

      const deleteResult = await deleteNote(id);

      expect(deleteResult).toContain(id);
      await expect(getNote(id)).resolves.toBeUndefined();
    });

    it("should succeed in deleting non-existent note (and log error)", async () => {
      console.error = vitest.fn();

      const deleteResult = await deleteNote(NIL);
      expect(deleteResult).toContain(NIL);

      expect(console.error).toHaveBeenCalledWith(expect.stringMatching("Cannot delete non-existing node"));
    });

    it("should not remove locked note from storage", async () => {
      const nodes = [{type: 'paragraph', children: [{text: "Fusce vel maximus ipsum, at consequat dolor."}]}];
      const nodeNote = new NodeNote(generateTestId(), 'html;hint=SEMANTIC', nodes, new Date(1983, 2, 26), true)
      const savedNote = await upsertNote(nodeNote, undefined)

      await expect(deleteNote(savedNote.id)).rejects.toThrow("not deleting “Fusce vel maximus ipsum,...” which is locked.");
      await expect(getNote(savedNote.id)).resolves.toEqual(savedNote);

      await new Promise(resolve => setTimeout(resolve, STORE_OBJECT_DELAY + 100));
      nodeNote.isLocked = false;
      await upsertNote(nodeNote, undefined);
      await expect(deleteNote(savedNote.id)).resolves.toEqual([{statusCode: 200},  savedNote.id]);
      await expect(getNote(savedNote.id)).resolves.toBeUndefined();
    });
  });

  describe("changeHandler", () => {
    it("should create an HTML note from incoming upsert", async () => {
      const id = generateTestId();
      const remoteNote = {
        id: id,
        content: `<p> Lorem ipsum dolor sit amet </p>`,
        title: `Itaque earum rerum hic tenetur a sapiente delectus`,
        date: new Date(1600, 2, 15).toISOString(),
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
      expect(retrieved.title).toEqual("Lorem ipsum dolor sit amet");
      expect(retrieved.date).toEqual(new Date(remoteNote.date));
      expect(retrieved.mimeType).toEqual(remoteNote.mimeType);

      const {remoteStorage} = await init();
      await expect(remoteStorage.documents.get(id)).resolves.toBeUndefined();
    });

    it("should create a text note from incoming upsert (Litewrite)", async () => {
      const id = generateTestId();
      const date = new Date(1950, 0, 1);
      const remoteNote = {
        id: id,
        content: ` Hi ho the dairy-o \n The farmer in the dell `,
        title: 'mismatched title',
        lastEdited: date.valueOf(),
        cursorPos: 13,
        public: null,
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
      expect(retrieved.title).toEqual('Hi ho the dairy-o\nThe farmer in the dell');
      expect(retrieved.date).toEqual(date);
      expect(retrieved.mimeType).toBeFalsy();
      expect(retrieved.isLocked).toBeFalsy();

      const {remoteStorage} = await init();
      await expect(remoteStorage.documents.get(id)).resolves.toBeUndefined();
    });

    it("should delete a note from incoming delete", async () => {
      const id = generateTestId();
      const localNote = {
        id: id,
        content: `<p> Lorem ipsum dolor sit amet </p>`,
        title: `ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.`,
        date: new Date(1918, 10, 11).toISOString(),
        mimeType: 'text/html;hint=SEMANTIC',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      await upsertNote(deserializeNote(localNote), undefined);
      await changeHandler({origin: 'remote', oldValue: localNote, newValue: false});
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 10);
      });

      const retrieved = await getNote(id);
      expect(retrieved).toBeFalsy();
    });

    it("should retain a modified HTML note which was deleted on another device", async () => {
      console.warn = vitest.fn();

      const id = generateTestId();
      const localNote = {
        id: id,
        content: `<p> Lorem ipsum dolor sit amet </p>`,
        title: `Lorem ipsum dolor sit amet`,
        date: new Date(1500, 0, 1).toISOString(),
        mimeType: 'text/html;hint=SEMANTIC',
        isLocked: false,
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
      expect(retrieved.date).toEqual(new Date(localNote.date));
      expect(retrieved.mimeType).toEqual(localNote.mimeType);
      expect(retrieved.isLocked).toEqual(localNote.isLocked);

      expect(console.warn).toHaveBeenCalledWith("remoteStorage local change, remote delete:", undefined, localNote, false);
    });

    it("should retain a modified text note which was deleted on another device", async () => {
      console.warn = vitest.fn();

      const id = generateTestId();
      const localNote = {
        id: id,
        content: ` one space \n  two spaces  \n   three space   `,
        title: `Lorem ipsum dolor sit amet`,
        date: new Date(1812, 9, 22).toISOString(),
        mimeType: 'text/plain',
        isLocked: false,
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
      expect(retrieved.title).toEqual("one space\ntwo spaces");
      expect(retrieved.date).toEqual(new Date(localNote.date));
      expect(retrieved.mimeType).toEqual(localNote.mimeType);
      expect(retrieved.isLocked).toEqual(localNote.isLocked);

      expect(console.warn).toHaveBeenCalledWith("remoteStorage local change, remote delete:", undefined, localNote, false);
    });

    it("should restore a deleted text note which was edited on another device", async () => {
      const id = generateTestId();
      const remoteNote = {
        id: id,
        content: ` Ut enim ad minim veniam `,
        title: `Ut enim ad minim veniam`,
        isLocked: true,
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
      expect(Date.now() - retrieved.date).toBeLessThan(1000);
      expect(retrieved.mimeType).toEqual('');
      expect(retrieved.isLocked).toEqual(remoteNote.isLocked);
    });

    it("should confirm remote changes, if the same changes were made to local", async () => {
      const id = generateTestId();
      const localNote = {
        id: id,
        content: `<h1>Duis ex elit</h1><p>Vestibulum nec massa eu, cursus porta augue.</p>`,
        title: `Duis ex elit`,
        date: new Date(2021, 8, 1).toISOString(),
        mimeType: 'text/html;hint=SEMANTIC',
        isLocked: false,
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      const remoteNote = JSON.parse(JSON.stringify(localNote));
      remoteNote.date = localNote.date;
      await changeHandler({origin: 'conflict', oldValue: localNote, newValue: remoteNote});
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 100);
      });

      const retrieved = await getNote(id);
      expect(retrieved.content).toEqual(`<h1>Duis ex elit</h1><p>Vestibulum nec massa eu, cursus porta augue.</p>`);
      expect(retrieved.title).toEqual("Duis ex elit");
      expect(retrieved.date).toEqual(new Date(remoteNote.date));
      expect(retrieved.mimeType).toEqual(localNote.mimeType);
      expect(retrieved.isLocked).toEqual(localNote.isLocked);
    });

    it.skip("should merge a conflicted HTML note", async () => {
      const id = generateTestId();
      const localNote = {
        id: id,
        content: `<p><em>My Day</em></p><p>It was dull.</p>`,
        title: `My Day\nIt was dull.`,
        date: new Date(2021, 8, 1).toISOString(),
        mimeType: 'text/html;hint=SEMANTIC',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      const remoteNote = {
        id: id,
        content: `<p><i>My Day</i></p><p>It was great!</p>`,
        title: `My Day\nIt was great!`,
        date: new Date(2021, 9, 1).toISOString(),
        mimeType: 'text/html',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      await changeHandler({origin: 'conflict', oldValue: localNote, newValue: remoteNote});
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 100);
      });

      const retrieved = await getNote(id);
      expect(retrieved.content).toEqual(`<p><em><em>My Day</em></em></p><p><del>It was dull.</del><ins>It was great!</ins></p>`);
      expect(retrieved.title).toMatch(/My Day\nIt was dull\. ?It was great!/);
      expect(retrieved.date).toEqual(remoteNote.date);
      expect(retrieved.mimeType).toEqual(localNote.mimeType);
    });

    it.skip("should merge a conflicted text note", async () => {
      const id = generateTestId();
      const localNote = {
        id: id,
        content: `The movie was well-acted.`,
        title: `The movie was well-acted.`,
        date: new Date(2020, 3, 1).toISOString(),
        mimeType: 'text/markdown;hint=COMMONMARK',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      const remoteNote = {
        id: id,
        content: `The movie has good costuming.`,
        title: `The movie has good costuming.`,
        date: new Date(2020, 0, 1).toISOString(),
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

    it.skip("should merge a conflicted local HTML / remote text note as HTML", async () => {
      const id = generateTestId();
      const localNote = {
        id: id,
        content: `<h1>Staff Meeting</h1><p>Mary: let's do it!</p><p>John: let's be cautious</p>`,
        title: `Staff Meeting\nMary: let's do it!`,
        date: new Date(2021, 8, 2).toISOString(),
        mimeType: 'text/html;hint=SEMANTIC',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      const remoteNote = {
        id: id,
        content: `Staff Meeting
John: let's be cautious
Finance: we can't afford it.`,
        title: `Staff Meeting\nJohn: let's be cautious`,
        date: new Date(2021, 8, 1).toISOString(),
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

    it.skip("should merge a conflicted local text / remote HTML note as HTML", async () => {
      const id = generateTestId();
      const localNote = {
        id: id,
        content: ` my notes on\n# Therapods `,
        title: `my notes on\n# Therapods`,
        date: new Date(2010, 1, 14).toISOString(),
        mimeType: 'text/markdown;hint=COMMONMARK',
        '@context': "http://remotestorage.io/spec/modules/documents/note"
      };
      const remoteNote = {
        id: id,
        content: `<p>my notes on</p><h2>Therapods</h2>`,
        title: `Therapods\nmy notes on`,
        date: new Date(2010, 0, 1).toISOString(),
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
      console.info = vitest.fn();
      window.postMessage = vitest.fn();

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
      console.warn = vitest.fn();
      console.info = vitest.fn();
      window.postMessage = vitest.fn();

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
      await waitFor(async () => {
        const {originalTags} = await listTags();
        expect(originalTags.length).toBeGreaterThan(0);
      });

      const {originalTags, normalizedTags} = await listTags();
      expect(originalTags[0]).toEqual(original.trim());
      expect(originalTags.length).toEqual(1);
      expect(normalizedTags.values().next().value).toEqual(Array.from(parseWords(original)).sort().join(' '))
      expect(window.postMessage).toHaveBeenCalledTimes(1);
      expect(window.postMessage).toHaveBeenCalledWith({kind: 'TAG_CHANGE'}, expect.anything());
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith("remoteStorage incoming savedSearch conflict", undefined, undefined, expect.anything(), expect.anything());
    });
  });

  describe("findStubs", () => {
    let note1, note2, note3;
    let note1title, note2title, note3title;

    function createTestNote(nodes) {
      const startDate = new Date(2015, 0, 1);
      const date = new Date(startDate.getTime() + Math.random() * 7*24*60*60*1000);
      return new NodeNote(generateTestId(), 'html;hint=SEMANTIC', nodes, date, false);
    }

    beforeAll(async () => {
      const nodes1 = [
        {type: 'heading-two', children: [{text: "The world"}]},
        {type: 'paragraph', children: [{text: " set free"}]},
      ];
      note1 = new NodeNote(generateTestId(), 'html;hint=SEMANTIC', nodes1, new Date(2011, 0, 1));
      note1title = (await serializeNote(note1)).title;

      const nodes2 = [
        {type: 'paragraph', children: [{text: "Math "}, {text: "is not", bold: true}, {text: " my favorite"}, ]},
      ];
      note2 = new NodeNote(generateTestId(), 'html;hint=SEMANTIC', nodes2, new Date(2012, 1, 2));
      note2title = (await serializeNote(note2)).title;

      const nodes3 = [
        {type: 'paragraph', children: [{text: "I don't "}, {text: "like thin crust", code: true}]},
      ];
      note3 = new NodeNote(generateTestId(), 'html;hint=SEMANTIC', nodes3, new Date(2013, 2, 3));
      note3title = (await serializeNote(note3)).title;

      for (const noteId of await findFillerNoteIds()) {
        await deleteNote(noteId, true);
      }

      await upsertNote(note1, undefined);
      await upsertNote(note2, undefined);
      await upsertNote(note3, undefined);

      for (let i = 0; i < 10; ++i) {
        await upsertNote(createTestNote(nodes1), undefined);
        await upsertNote(createTestNote(nodes2), undefined);
        await upsertNote(createTestNote(nodes3), undefined);
      }
      await upsertNote(createTestNote(nodes2), undefined);
      await upsertNote(createTestNote(nodes3), undefined);
      await upsertNote(createTestNote(nodes3), undefined);
    });

    it("should return all notes when no words in search string", () => new Promise((done, fail) => {
      expect.hasAssertions();
      findStubs(parseWords(" .@ *) -—-"), callback);

      function callback(err, matched, {isPartial, isFinal, isSearch} = {}) {
        if (err) { return fail(err) }
        try {
          if (!isFinal) {
            expect(matched.length).toBeGreaterThan(0);
            expect(matched.length).toBeLessThan(36);
            expect(isPartial).toBeTruthy();
            expect(isSearch).toBeFalsy();
            return;
          }

          const testStubs = [];
          matched.forEach(stub => {
            testStubs.push(stub);
          });
          expect(testStubs.length).toEqual(36);
          expect(testStubs.reduce((acc, item) => {
            return (item.title ===  note1title ? 1 : 0) + acc;
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
          fail(err2);
        }
      }
    }));

    it("should return stubs containing words which start with the only search word", () => new Promise((done, fail) => {
      expect.hasAssertions();
      findStubs(parseWords("th"), callback);

      function callback(err, matched, {isPartial, isFinal, isSearch} = {}) {
        if (err) { return fail(err) }
        try {
          if (!isFinal) {
            expect(matched.length).toBeGreaterThan(0);
            expect(matched.length).toBeLessThan(24);
            expect(isPartial).toBeTruthy();
            expect(isSearch).toBeTruthy();
            return;
          }

          const testStubs = [];
          matched.forEach(stub => {
            testStubs.push(stub);
          });
          expect(testStubs.length).toEqual(24);
          expect(testStubs.reduce((acc, item) => {
            return (item.title ===  note1title ? 1 : 0) + acc;
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
          fail(err2);
        }
      }
    }));

    it("should return stubs containing words which start with each of the search words", () => new Promise((done, fail) => {
      expect.hasAssertions();
      findStubs(parseWords("th don"), callback);

      function callback(err, matched, {isPartial, isFinal, isSearch} = {}) {
        if (err) { return fail(err) }
        try {
          if (!isFinal) {
            expect(matched.length).toBeGreaterThan(0);
            expect(matched.length).toBeLessThan(13);
            expect(isPartial).toBeTruthy();
            expect(isSearch).toBeTruthy();
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
            return (item.title ===  note1title ? 1 : 0) + acc;
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
          fail(err2);
        }
      }
    }));
  });

  describe("findStubs (max)", () => {
    beforeAll(async () => {
      const nodes = [{type: 'paragraph', children: [{text: "something rather short"}]}];

      for (const noteId of await findFillerNoteIds()) {
        await deleteNote(noteId);
      }

      for (let i = 0; i < 500; ++i) {
        const nodeNote = new NodeNote(generateTestId(), undefined, nodes, new Date(), false);
        await upsertNote(nodeNote, undefined);
      }
    });

    it("should return 500 stubs when search string is empty", () => new Promise((done, fail) => {
      expect.hasAssertions();
      findStubs(new Set(), callback);

      function callback(err, matched, {isPartial, isFinal, isSearch} = {}) {
        if (err) {
          return fail(err)
        }
        try {
          if (!isFinal) {
            expect(matched.length).toBeGreaterThan(0);
            expect(matched.length).toBeLessThan(500);
            expect(isPartial).toBeTruthy();
            expect(isSearch).toBeFalsy();
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
          fail(err2);
        }
      }
    }));

    it("should return 500 stubs with multiple search words", () => new Promise((done, fail) => {
      expect.hasAssertions();
      findStubs(parseWords("Some-thin rathE s.h.o.r."), callback);

      function callback(err, matched, {isPartial, isFinal, isSearch} = {}) {
        if (err) {
          return fail(err)
        }
        try {
          if (!isFinal) {
            expect(matched.length).toBeGreaterThan(0);
            expect(matched.length).toBeLessThan(500);
            expect(isPartial).toBeTruthy();
            expect(isSearch).toBeTruthy();
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
          fail(err2);
        }
      }
    }));
  });

  describe.skip("findStubs (stress)", () => {
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
    const nodes = deserializeHtml(content);

    beforeAll(async () => {
      for (const noteId of await findFillerNoteIds()) {
        await deleteNote(noteId);
      }

      for (let i = 0; i < 600; ++i) {
        const nodeNote = new NodeNote(generateTestId(), 'html;hint=SEMANTIC', nodes)
        await upsertNote(nodeNote, undefined);
      }
    }, 60_000);

    it("should return a maximum of 500 stubs when search string is empty", () => new Promise((done, fail) => {
      expect.hasAssertions();
      findStubs(new Set(), callback);

      function callback(err, matched, {isPartial, isFinal, isSearch} = {}) {
        if (err) {
          return fail(err)
        }
        try {
          if (!isFinal) {
            expect(matched.length).toBeGreaterThan(0);
            expect(matched.length).toBeLessThan(500);
            expect(isPartial).toBeTruthy();
            expect(isSearch).toBeFalsy();
            return;
          }

          const testStubs = [];
          matched.forEach(stub => {
            testStubs.push(stub);
          });
          expect(testStubs.length).toEqual(500);
          for (const stub of testStubs) {
            expect(stub.title).toEqual("In Congress, July 4, 1776");
          }

          expect(isPartial).toBeTruthy();
          expect(isSearch).toBeFalsy();
          done();
        } catch (err2) {
          fail(err2);
        }
      }
    }), 30_000);

    it("should return a maximum of 500 stubs with multiple search words", () => new Promise((done, fail) => {
      expect.hasAssertions();
      const searchWords = parseWords("177 congres declaratio governmen self-eviden");
      findStubs(searchWords, callback);

      function callback(err, matched, {isPartial, isFinal, isSearch} = {}) {
        if (err) {
          return fail(err)
        }
        try {
          if (!isFinal) {
            expect(matched.length).toBeGreaterThan(0);
            expect(matched.length).toBeLessThan(500);
            expect(isPartial).toBeTruthy();
            expect(isSearch).toBeTruthy();
            return;
          }

          const testStubs = [];
          matched.forEach(stub => {
            testStubs.push(stub);
          });
          expect(testStubs.length).toEqual(500);
          for (const stub of testStubs) {
            expect(stub.title).toEqual("In Congress, July 4, 1776");
          }

          expect(isPartial).toBeTruthy();
          expect(isSearch).toBeTruthy();
          done();
        } catch (err2) {
          fail(err2);
        }
      }
    }), 30_000);
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
          // continue regardless of error
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
