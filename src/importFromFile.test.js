// importFromFile.test.js
// Copyright © 2021 Doug Reeder

import auto from "fake-indexeddb/auto.js";
import {init, parseWords, upsertNote, getNote, deleteNote, findStubs, changeHandler} from "./storage";
import {importMultipleNotes, checkForMarkdown} from "./importFromFile";
import {validate as uuidValidate} from "uuid";
import {TITLE_MAX} from "./Note";

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

  it("should parse a file containing an HTML fragment as one note, with file name appended", async () => {
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

    const {noteIds, message} = await importMultipleNotes(file, 'text/html');
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(1);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(message).toEqual("1 note");

    const retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/html;hint=SEMANTIC');
    expect(retrievedNote.title).toEqual(`Some Topic
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`);
    expect(retrievedNote.content).toEqual(fileContent + "<p>Lipsum.html</p>");
    expect(retrievedNote.date).toEqual(new Date(fileDate));
  });

  it("should parse a file containing an HTML document as one note, with file name appended", async () => {
    const fileContent = `<html><head><title>Buckaroo Banzai</title></head><body>
<blockquote>No matter where you go, there you are.</blockquote>
</body></html>`;
    const fileDate = '2021-08-01T11:00:00Z';
    const file = new File([fileContent], "Buckaroo-Banzai.html", {type: 'text/html', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importMultipleNotes(file, 'text/html');
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(1);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(message).toEqual("1 note");

    const retrievedNote = await getNote(noteIds[0]);
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
    const {noteIds, message} = await importMultipleNotes(file, 'text/html');
    expect(noteIds).toBeInstanceOf(Array);
    // Creating either zero or one note is fine.
    expect(noteIds.length).toBeLessThan(2);
    expect(message).toMatch(/\S/);
  });

  it("should reject an overly-long HTML file", async () => {
    const fileDate = '2021-08-15T12:00:00Z';
    let html = '<li>${Math.random()}</li>\n';
    while (html.length < 600_000) {
      html += html;
    }
    const file = new File(['<ol>', html,'</ol>'], "list.html", {type: 'text/html', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importMultipleNotes(file, 'text/html');
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(0);
    expect(message).toEqual("Too long. Copy the parts you need.");
  });

  it("should parse an empty text file as 0 notes", async () => {
    const fileDate = '2019-06-01T12:00:00Z';
    const file = new File([], "empty-css.html", {type: 'text/css', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importMultipleNotes(file, 'text/plain');
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(0);
    expect(message).toEqual("No notes");
  });

  it("should parse a text file with no separations nor dates as one note, with date equal to the file date", async () => {
    const fileContent = `Popular Novel
Review copyright 2021 by Doug Reeder

There's three things to say about this:
1. Something
2. Another thing
3. A sweeping generalization`;
    const fileDate = '2021-10-01T13:00:00Z';
    const file = new File([fileContent], "review.t", {type: 'text/troff', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importMultipleNotes(file, 'text/plain');
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(1);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(message).toEqual("1 note");

    const retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    expect(retrievedNote.title).toEqual(retrievedNote.content);
    expect(retrievedNote.content).toEqual(fileContent + `

review.t`);
    expect(retrievedNote.date).toEqual(new Date(fileDate));
  });

  it("should parse a text file with two separations as three text notes", async () => {
    const content0 = '\nTadka Indian Cuisine  \nnice atmosphere  \nnever tried their curry, either\n\nW Dublin Granville Rd, Columbus, Franklin County, Ohio\n';
    const date0 = '2014-05-22T07:34:34.085Z';
    const content1 = 'The Matrix (1999)  \nwouldn\'t cows be a better heat source?\nWithout the ability to stage a revolt and all, you know  \naction, adventure, science-fiction\n';
    const date1 = '2014-05-22T04:19:06.697Z';
    const content2 = 'CbusJS d3  \n  \nNye County, Nevada';
    const fileDate = '2021-11-01T14:00:00Z';
    const file = new File([content0, date0, '\n\n\n\n', content1, date1, '\n\n\n\n', content2, '\n  '],
        "melange.txt",
        {type: 'text/plain', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importMultipleNotes(file, 'text/plain');
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(3);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(uuidValidate(noteIds[1])).toBeTruthy();
    expect(uuidValidate(noteIds[2])).toBeTruthy();
    expect(message).toEqual("3 notes");

    let retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    expect(retrievedNote.title).toEqual(retrievedNote.content.slice(0, TITLE_MAX).trim());
    expect(retrievedNote.content).toEqual(content0 + '\nmelange.txt');
    expect(retrievedNote.date).toEqual(new Date(date0));

    retrievedNote = await getNote(noteIds[1]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    expect(retrievedNote.title).toEqual(retrievedNote.content.slice(0, TITLE_MAX).trim());
    expect(retrievedNote.content).toEqual(content1 + '\nmelange.txt');
    expect(retrievedNote.date).toEqual(new Date(date1));

    retrievedNote = await getNote(noteIds[2]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    expect(retrievedNote.title).toEqual(retrievedNote.content.slice(0, TITLE_MAX).trim());
    expect(retrievedNote.content).toEqual(content2 + '\n\nmelange.txt');
    expect(Math.abs(retrievedNote.date - new Date(fileDate))).toBeLessThan(5);
  });

  it("should parse a text file containing Markdown with one separation as two Markdown notes", async () => {
    const content0 = `## Subject Area

# Actual Title

1. Item 1
2. A second item
3. Number 3
4. Ⅳ

*Note: the fourth item uses the Unicode character for [Roman numeral four][2].*
`;
    const date0 = '2005-01-22T07:34:34.085Z';
    const content1 = `| Item         | Price     | # In stock |
|--------------|-----------|------------|
| Juicy Apples | 1.99      | *7*        |
| Bananas      | **1.89**  | 5234       |
`;
    const date1 = '2005-02-13T04:19:06.697Z';
    const file = new File([content0, date0, '\n\n\n\n', content1, date1, '\n\n\n\n'],
        "actually-markdown.txt",
        {type: 'text/plain', lastModified: Date.parse('2021-12-01T14:00:00Z')});

    const {noteIds, message} = await importMultipleNotes(file, 'text/markdown');
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(2);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(uuidValidate(noteIds[1])).toBeTruthy();
    expect(message).toEqual("2 notes");

    let retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/markdown');
    expect(retrievedNote.title).toEqual(retrievedNote.content.slice(0, TITLE_MAX).trim());
    expect(retrievedNote.content).toEqual(content0 + '\nactually-markdown.txt');
    expect(retrievedNote.date).toEqual(new Date(date0));

    retrievedNote = await getNote(noteIds[1]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/markdown');
    expect(retrievedNote.title).toEqual(retrievedNote.content.slice(0, TITLE_MAX).trim());
    expect(retrievedNote.content).toEqual(content1 + '\nactually-markdown.txt');
    expect(retrievedNote.date).toEqual(new Date(date1));
  });

  it("should continue after refusing to create a note longer than 600,000 characters", async () => {
    const content0 = 'before\n';
    const date0 = '2006-02-14T07:00:00Z';
    let logLines = `Feb 16 00:17:00 frodo Java Updater[24847]: Untrusted apps are not allowed to connect to Window Server before login.
Feb 16 00:15:30 frodo spindump[24839]: Removing excessive log: file:///Library/Logs/DiagnosticReports/powerstats_2016-02-07-001552_frodo.diag
`;
    while (logLines.length < 600_000) {
      logLines += logLines;
    }
    const content2 = 'after\n';
    const date2 = '2006-02-16T08:00:00Z';
    const file = new File([content0, date0, '\n\n\n\n', logLines, '\n\n\n', content2, date2, '\n\n\n\n'], "report-with.log", {type: ''});

    const {noteIds, message} = await importMultipleNotes(file, 'text/plain');
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(2);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(uuidValidate(noteIds[1])).toBeTruthy();
    expect(message).toEqual("2 notes; Divide manually before importing");

    let retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    expect(retrievedNote.title).toEqual(retrievedNote.content.slice(0, TITLE_MAX).trim());
    expect(retrievedNote.content).toEqual(content0 + '\nreport-with.log');
    expect(retrievedNote.date).toEqual(new Date(date0));

    retrievedNote = await getNote(noteIds[1]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    expect(retrievedNote.title).toEqual(retrievedNote.content.slice(0, TITLE_MAX).trim());
    expect(retrievedNote.content).toEqual(content2 + '\nreport-with.log');
    expect(retrievedNote.date).toEqual(new Date(date2));
  });

  it("should parse a non-plain text file as one note, with file name appended", async () => {
    const fileContent = `if ('chrome' in window && 'fileSystem' in chrome) {
\thistory.pushState = function (newState) {
\t\thistory.state = newState;
\t};

\thistory.replaceState = function (newState) {
\t\thistory.state = newState;
\t};

\thistory.back = function () {
\t\t// no-op
\t};
}
`;
    const fileDate = '2004-10-30T10:30:00Z';
    const file = new File([fileContent], "historyStub.js", {type: 'application/javascript', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importMultipleNotes(file, 'text/javascript');
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(1);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(message).toEqual("1 note");

    const retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/javascript');
    expect(retrievedNote.title).toEqual(retrievedNote.content.slice(0, TITLE_MAX).trim());
    expect(retrievedNote.content).toEqual(fileContent + "\n\nhistoryStub.js");
    expect(retrievedNote.date).toEqual(new Date(fileDate));
  });

  it("should reject an overly-long non-plain text file", async () => {
    const fileDate = '2021-05-11T12:00:00Z';
    let lines = 'foo,42\n';
    while (lines.length < 600_000) {
      lines += lines;
    }
    const file = new File([lines], "too-long.csv", {type: 'text/csv', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importMultipleNotes(file, 'text/csv');
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(0);
    expect(message).toEqual("Too long. Copy the parts you need.");
  });

});
