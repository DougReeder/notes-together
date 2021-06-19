// idbNotes.test.js - automated tests for storage for Notes Together
// Copyright © 2021 Doug Reeder

import {createMemoryNote} from "./Note";
import auto from "fake-indexeddb/auto.js";
import {init, getNote, findNotes, upsertNote, deleteNote, parseWords} from "./idbNotes";

function generateTestId() {
  return Number.MIN_SAFE_INTEGER - 10 + Math.ceil(Math.random() * Number.MIN_SAFE_INTEGER);
}

let db;

beforeAll(done => {
  init("testDb").then(theDb => {
    db = theDb;
    // console.log("fake db:", db.name, db.version, db.objectStoreNames);
    done();
  });
});

function deleteTestNotes() {
  return new Promise(resolve => {
    const clearTrnsactn = db.transaction('note', 'readwrite');
    const noteStore = clearTrnsactn.objectStore("note");
    noteStore.delete(IDBKeyRange.upperBound(Number.MIN_SAFE_INTEGER, true)).onsuccess = function (evt) {
      resolve(evt.target.result);
    }
  });
}

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
    const wordArr = Array.from(parseWords("23℥brimstone"));

    expect(wordArr).toContain("23OZ");
    expect(wordArr).toContain("BRIMSTONE");
  });

  it('should parse "℻" symbol as FAX', () => {
    const wordArr = Array.from(parseWords("order℻614-555-1212"));

    expect(wordArr).toContain("ORDER");
    expect(wordArr).toContain("FAX");
    expect(wordArr).toContain("6145551212");
  });

  it('should parse "℞" symbol as Rx', () => {
    const wordArr = Array.from(parseWords("℞2901"));

    expect(wordArr).toContain("RX2901");
  })
});

describe("getNote", () => {
  beforeAll(async () => {
    await deleteTestNotes();
  });

  it("should reject when id is undefined", async () => {
    await expect(getNote(undefined)).rejects.toThrow();
  });

  it("should reject when note doesn't exist", async () => {
    await expect(getNote(0)).rejects.toThrow("no note");
  });
})


describe("upsertNote", () => {
  beforeAll(async () => {
    await deleteTestNotes();
  });

  it("should fail when passed a non-object", async () => {
    await expect(upsertNote()).rejects.toThrow();
  });

  it("should fail when passed a non-clonable date", async () => {
    const note = createMemoryNote(generateTestId(), "something");
    note.date = document.documentElement;
    await expect(upsertNote(note)).rejects.toThrow();
  });

  it("should fail when passed a note without ID", async () => {
    await expect(upsertNote({})).rejects.toThrow('id');
  });

  it("should fail when passed a note without text", async () => {
    await expect(upsertNote({id:Number.MIN_SAFE_INTEGER-2})).rejects.toThrow('text');
  });

  it("should extract normalized keywords from note", async () => {
    const originalText = "editor-in-chief\n================<br>foo_bar Foo.bar </strong>_underlined_\n";
    const original = createMemoryNote(generateTestId(), originalText);

    const savedNote = await upsertNote(original);
    expect(savedNote.text).toEqual("editor-in-chief\n================<br />foo_bar Foo.bar _underlined_\n");
    expect(savedNote.wordArr).toContain("EDITORINCHIEF");
    expect(savedNote.wordArr).toContain("FOOBAR");
    expect(savedNote.wordArr).toContain("UNDERLINED");
    expect(savedNote.wordArr).not.toContain("BR");
    expect(savedNote.wordArr).not.toContain("STRONG");
    expect(savedNote.wordArr.length).toEqual(3);
  });

  it('should drop keywords that match the start of another keyword', async () => {
    const originalText = "tar tarp tarpaulin workgroup workflow doorknob 2.10 2.10.3.8 door";
    const original = createMemoryNote(generateTestId(), originalText);

    const savedNote = await upsertNote(original);
    expect(savedNote.text).toEqual(originalText);
    expect(savedNote.wordArr).toContain("TARPAULIN");
    expect(savedNote.wordArr).not.toContain("TAR");
    expect(savedNote.wordArr).not.toContain("TARP");
    expect(savedNote.wordArr).toContain("WORKGROUP");
    expect(savedNote.wordArr).toContain("WORKFLOW");
    expect(savedNote.wordArr).not.toContain("WORK");
    expect(savedNote.wordArr).toContain("DOORKNOB");
    expect(savedNote.wordArr).not.toContain("DOOR");
    expect(savedNote.wordArr).toContain("2.10.3.8");
    expect(savedNote.wordArr).not.toContain("2.10");
    expect(savedNote.wordArr.length).toEqual(5);
  });

  it("should insert a note",async () => {
    const originalId = generateTestId();
    const originalText = "Beggars <div>in Spain</div>";
    const original = createMemoryNote(originalId, originalText);

    const savedNote = await upsertNote(original);
    expect(savedNote.id).toEqual(originalId);
    expect(savedNote.wordArr).toContain("BEGGARS");
    expect(savedNote.wordArr).toContain("IN");
    expect(savedNote.wordArr).toContain("SPAIN");
    expect(savedNote.wordArr.length).toEqual(3);

    const retrieved = await getNote(originalId);
    expect(retrieved.text).toEqual(originalText);
  });

  it("should update a note",async () => {
    const originalId = generateTestId();
    const originalText = "<h1>In Memory Yet Green</h1>";
    const original = createMemoryNote(originalId, originalText);

    await upsertNote(original);
    const updatedText = "<h2>In Joy Still Felt</h2>";
    const updated = createMemoryNote(originalId, updatedText);
    await upsertNote(updated);
    const retrieved = await getNote(originalId);

    expect(retrieved.text).toEqual(updatedText);
  });

  it("should normalize markup",async () => {
    const originalId = generateTestId();
    const originalText = "<header>A mind is a <strike>terrible thing</blockquote> to waste";
    const original = createMemoryNote(originalId, originalText);

    await upsertNote(original);

    const retrieved = await getNote(originalId);
    expect(retrieved.text).toEqual("<header>A mind is a <strike>terrible thing to waste</strike></header>");
  });
});

describe("deleteNote", () => {
  it("should fail when passed a non-number", async () => {
    await expect(deleteNote(undefined)).rejects.toThrow();
  });

  it("should remove note from storage", async () => {
    const id = generateTestId();
    const note = createMemoryNote(id, "Aroint, thee, knave!")
    await upsertNote(note);

    const deletedId = await deleteNote(id);
    expect(deletedId).toEqual(id);
    await expect(getNote(id)).rejects.toThrow("no note");
  });

  it("should succeed in deleting non-existent note", async () => {
    const deletedId = await deleteNote(0);
    expect(deletedId).toEqual(0);
  });
});

describe("findNotes", () => {
  const note1 = createMemoryNote(generateTestId(), "<h2>The world</h2> set free");
  const note2 = createMemoryNote(generateTestId(), "Math <th>is not</th> my favorite");
  const note3 = createMemoryNote(generateTestId(), "I don't <pre>like thin crust</pre>");

  beforeAll(async () => {
    await deleteTestNotes();

    await upsertNote(note1);
    await upsertNote(note2);
    await upsertNote(note3);

    for (let i = 0; i < 10; ++i) {
      await upsertNote(createMemoryNote(generateTestId(), note1.text));
      await upsertNote(createMemoryNote(generateTestId(), note2.text));
      await upsertNote(createMemoryNote(generateTestId(), note3.text));
    }
    await upsertNote(createMemoryNote(generateTestId(), note2.text));
    await upsertNote(createMemoryNote(generateTestId(), note3.text));
    await upsertNote(createMemoryNote(generateTestId(), note3.text));
  });

  it("should return all notes when no words in search string", done => {
    findNotes(parseWords(" .@ *) -—-"), callback);

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

        const testNotes = [];
        matched.forEach(note => {
          if (note.id < Number.MIN_SAFE_INTEGER) {
            testNotes.push(note);
          }
        });
        expect(testNotes.length).toEqual(36);
        expect(testNotes.reduce((acc, item) => {
          return (item.incipit === note1.text ? 1 : 0) + acc;
        }, 0)).toEqual(11);
        expect(testNotes.reduce((acc, item) => {
          return (item.incipit === note2.text ? 1 : 0) + acc;
        }, 0)).toEqual(12);
        expect(testNotes.reduce((acc, item) => {
          return (item.incipit === note3.text ? 1 : 0) + acc;
        }, 0)).toEqual(13);

        expect(isPartial).toBeFalsy();
        expect(isSearch).toBeFalsy();
        done();
      } catch (err2) {
        done(err2);
      }
    }
  });

  it("should return notes containing words which start with the only search word", done => {
    findNotes(parseWords("th"), callback);

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

        const testNotes = [];
        matched.forEach(note => {
          if (note.id < Number.MIN_SAFE_INTEGER) {
            testNotes.push(note);
          }
        });
        expect(testNotes.length).toEqual(24);
        expect(testNotes.reduce((acc, item) => {
          return (item.incipit === note1.text ? 1 : 0) + acc;
        }, 0)).toEqual(11);
        expect(testNotes.reduce((acc, item) => {
          return (item.incipit === note2.text ? 1 : 0) + acc;
        }, 0)).toEqual(0);
        expect(testNotes.reduce((acc, item) => {
          return (item.incipit === note3.text ? 1 : 0) + acc;
        }, 0)).toEqual(13);

        expect(isPartial).toBeFalsy();
        expect(isSearch).toBeTruthy();
        done();
      } catch (err2) {
        done(err2);
      }
    }
  });

  it("should return notes containing words which start with each of the search words", done => {
    findNotes(parseWords("th don"), callback);

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

        const testNotes = [];
        const testNoteIds = new Set();
        matched.forEach(note => {
          if (note.id < Number.MIN_SAFE_INTEGER) {
            testNotes.push(note);
            testNoteIds.add(note.id);
          }
        });
        expect(testNotes.length).toEqual(13);
        expect(testNoteIds.size).toEqual(13);
        expect(testNotes.reduce((acc, item) => {
          return (item.incipit === note1.text ? 1 : 0) + acc;
        }, 0)).toEqual(0);
        expect(testNotes.reduce((acc, item) => {
          return (item.incipit === note2.text ? 1 : 0) + acc;
        }, 0)).toEqual(0);
        expect(testNotes.reduce((acc, item) => {
          return (item.incipit === note3.text ? 1 : 0) + acc;
        }, 0)).toEqual(13);

        expect(isPartial).toBeFalsy();
        expect(isSearch).toBeTruthy();
        done();
      } catch (err2) {
        done(err2);
      }
    }
  });
});

describe("findNotes (max)", () => {
  const text = "something rather short";

  beforeAll(async () => {
    await deleteTestNotes();

    for (let i = 0; i < 500; ++i) {
      await upsertNote(createMemoryNote(generateTestId(), text));
    }
  });

  it("should return 500 notes when search string is empty", done => {
    findNotes(new Set(), callback);

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
        matched.forEach(note => {
          if (note.id < Number.MIN_SAFE_INTEGER) {
            testStubs.push(note);
          }
        });
        expect(testStubs.length).toEqual(500);
        for (const stub of testStubs) {
          expect(stub.incipit).toMatch(/^something rather short/);
        }

        expect(isPartial).toBeFalsy();
        expect(isSearch).toBeFalsy();
        done();
      } catch (err2) {
        done(err2);
      }
    }
  });

  it("should return 500 notes with multiple search words", done => {
    findNotes(parseWords("Some-thin rathE s.h.o.r."), callback);

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
        matched.forEach(note => {
          if (note.id < Number.MIN_SAFE_INTEGER) {
            testStubs.push(note);
          }
        });
        expect(testStubs.length).toEqual(500);
        for (const stub of testStubs) {
          expect(stub.incipit).toMatch(/^something rather short/);
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

xdescribe("findNotes (stress)", () => {
  jest.setTimeout(30000);

  const text = `<h1>In Congress, July 4, 1776</h1>
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
    await deleteTestNotes();

    for (let i = 0; i < 600; ++i) {
      await upsertNote(createMemoryNote(generateTestId(), text));
    }
  });

  it("should return a maximum of 500 notes when search string is empty", done => {
    findNotes(new Set(), callback);

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
        matched.forEach(note => {
          if (note.id < Number.MIN_SAFE_INTEGER) {
            testStubs.push(note);
          }
        });
        expect(testStubs.length).toEqual(500);
        for (const stub of testStubs) {
          expect(stub.incipit).toMatch(/^<h1>In Congress, July 4, 1776<\/h1>\s+<p><b>The unanimous Declaration of the thirteen united States of America<\/b>, When in the Course of human events/);
        }

        expect(isPartial).toBeTruthy();
        expect(isSearch).toBeFalsy();
        done();
      } catch (err2) {
        done(err2);
      }
    }
  });

  it("should return a maximum of 500 notes with multiple search words", done => {
    const searchWords = parseWords("177 congres declaratio governmen self-eviden");
    findNotes(searchWords, callback);

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
        matched.forEach(note => {
          if (note.id < Number.MIN_SAFE_INTEGER) {
            testStubs.push(note);
          }
        });
        expect(testStubs.length).toEqual(500);
        for (const stub of testStubs) {
          expect(stub.incipit).toMatch(/^<h1>In Congress, July 4, 1776<\/h1>\s+<p><b>The unanimous Declaration of the thirteen united States of America<\/b>, When in the Course of human events/);
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

afterAll(async () => {
  return deleteTestNotes();
});
