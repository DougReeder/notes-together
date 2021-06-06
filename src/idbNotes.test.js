// idbNotes.test.js - automated tests for storage for Notes Together
// Copyright © 2021 Doug Reeder

import {createMemoryNote} from "./Note";
import {getNote, searchNotes, upsertNote, deleteNote, parseWords} from "./idbNotes";

function generateTestId() {
  return Number.MIN_SAFE_INTEGER - 10 + Math.ceil(Math.random() * Number.MIN_SAFE_INTEGER);
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

  it("forms words using hyphens, incl. no-break & soft (but not dashes) then drops them", async () => {
    const wordArr = Array.from(parseWords("state‐of‑the­art \n614-555-1212 29–37"));

    expect(wordArr).toContain("STATEOFTHEART");
    expect(wordArr).toContain("6145551212");
    expect(wordArr).toContain("29");
    expect(wordArr).toContain("37");
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
    const wordArr = Array.from(parseWords("C.A.T. scan, 1.3.1.2 P.T.A."));

    expect(wordArr).toContain("CAT");
    expect(wordArr).toContain("SCAN");
    expect(wordArr).toContain("1.3.1.2");
    expect(wordArr).not.toContain("1312");
    expect(wordArr).toContain("PTA");
    expect(wordArr.length).toEqual(4);
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
});

describe("upsertNote", () => {
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
  const note1 = createMemoryNote(generateTestId(), "<h2>The world set free");
  const note2 = createMemoryNote(generateTestId(), "Math <th>is not</th> my favorite");
  const note3 = createMemoryNote(generateTestId(), "I don't <pre>like thin crust</pre>");

  beforeAll(async () => {
    await upsertNote(note1);
    await upsertNote(note2);
    await upsertNote(note3);
  });

  it("should return all notes when search string is empty", async () => {
    const matched = await searchNotes("");
    const matchedTestIds = [];
    matched.forEach(note => {
      if (note.id < Number.MIN_SAFE_INTEGER) {
        matchedTestIds.push(note.id);
      }
    });
    expect(matchedTestIds).toContain(note1.id);
    expect(matchedTestIds).toContain(note2.id);
    expect(matchedTestIds).toContain(note3.id);
  });

  it("should return notes containing words which start with the only search word", async () => {

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

  it("should return notes containing words which start with two search words", async () => {

    const matched = await searchNotes("th don");
    const matchedTestIds = [];
    matched.forEach(note => {
      if (note.id < Number.MIN_SAFE_INTEGER) {
        matchedTestIds.push(note.id);
      }
    });
    expect(matchedTestIds).not.toContain(note1.id);
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
