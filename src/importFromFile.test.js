// importFromFile.test.js
// Copyright © 2021 Doug Reeder

import auto from "fake-indexeddb/auto.js";
import {init, parseWords, upsertNote, getNote, deleteNote, findStubs, changeHandler} from "./storage";
import {importMultipleNotes, checkForMarkdown} from "./importFromFile";
import {validate as uuidValidate} from "uuid";

describe("checkForMarkdown", () => {
  it("should throw for non-file", async () => {
    await expect(checkForMarkdown("filename.txt")).rejects.toThrow();
  });

  it("should return false for empty file", async () => {
    const file = new Blob([], {type: 'text/plain'});
    await expect(checkForMarkdown(file)).resolves.toEqual(false);
  });

  it("should return false for plain text", async () => {
    const file = new Blob(["To be, or not to be."], {type: 'text/plain'});
    await expect(checkForMarkdown(file)).resolves.toEqual(false);
  });

  it("should return true for text with emphasis", async () => {
    const file = new Blob(["plain *emphasized text* plain"], {type: 'text/plain'});
    await expect(checkForMarkdown(file)).resolves.toEqual(true);
  });

  it("should return true for text with numbered list", async () => {
    const file = new Blob([
        "   2. Second\n",
        "  3. Third\n",
    ], {type: 'text/plain'});
    await expect(checkForMarkdown(file)).resolves.toEqual(true);
  });
});

describe("importMultipleNotes", () => {
  beforeAll(() => {
    return init("testStorageDb");
  });

  it("should parse a single HTML fragment note", async () => {
    const fileContent = `<h1>Some Topic</h1>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
<p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. </p>
<ol>
<li>erste</li>
<li>zwitte</li>
<li>dritte</li>
</ol>`;
    const fileDate = '2021-07-01T10:30:00Z';
    const file = new File([fileContent], "Lipsum.html", {type: 'application/xhtml+xml', lastModified: Date.parse(fileDate)});

    const result = await importMultipleNotes(file, 'text/html');
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toEqual(1);
    expect(uuidValidate(result[0])).toBeTruthy();

    const retrievedNote = await getNote(result[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/html;hint=SEMANTIC');
    expect(retrievedNote.title).toEqual(`Some Topic
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`);
    expect(retrievedNote.content).toEqual(fileContent + "<p>Lipsum.html</p>");
    expect(retrievedNote.date).toEqual(new Date(fileDate));
  });

  it("should parse a single HTML document note", async () => {
    const fileContent = `<html><head><title>Buckaroo Banzai</title></head><body>
<blockquote>No matter where you go, there you are.</blockquote>
</body></html>`;
    const fileDate = '2021-08-01T11:00:00Z';
    const file = new File([fileContent], "Buckaroo-Banzai.html", {type: 'text/html', lastModified: Date.parse(fileDate)});

    const result = await importMultipleNotes(file, 'text/html');
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toEqual(1);
    expect(uuidValidate(result[0])).toBeTruthy();

    const retrievedNote = await getNote(result[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/html;hint=SEMANTIC');
    expect(retrievedNote.title).toEqual(`No matter where you go, there you are.
Buckaroo-Banzai.html`);
    expect(retrievedNote.content).toEqual(`
<blockquote>No matter where you go, there you are.</blockquote>
<p>Buckaroo-Banzai.html</p>`);
    expect(retrievedNote.date).toEqual(new Date(fileDate));
  });

  it("should parse an empty HTML file", async () => {
    const fileDate = '2021-09-01T12:00:00Z';
    const file = new File([], "empty.html", {type: 'text/html', lastModified: Date.parse(fileDate)});

    const result = await importMultipleNotes(file, 'text/html');
    expect(result).toBeInstanceOf(Array);
    // Creating either zero or one note is fine.
  });

  xit("should parse a single text note", async () => {
    const file = new File([`Popular Novel
Review copyright 2021 by Doug Reeder

There's three things to say about this:
1. Something
2. Another thing
3. A sweeping generalization`], "review.t", {type: 'text/troff'});

    const result = await importMultipleNotes(file, 'text/plain');

    expect(result).toBeTruthy();
    expect(result.length).toEqual(1);
    expect(uuidValidate(result[0])).toBeTruthy();
  });
});
