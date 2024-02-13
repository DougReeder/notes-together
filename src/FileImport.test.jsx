// FileImport.test.js - automated tests for importing notes from files
// Copyright © 2021-2024 Doug Reeder

import _ from "fake-indexeddb/auto.js";
import {init, getNote} from "./storage";
import FileImport, {checkForMarkdown, determineParseType, importFromFile} from "./FileImport";
import {
  render,
  screen, waitFor
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event';
import {validate as uuidValidate} from "uuid";
import {dataURItoFile} from "./util/testUtil";
import {CONTENT_MAX} from "./Note.js";
import {CONTENT_TOO_LONG} from "./Note.js";

describe("determineParseType", () => {
  it("should parse graphics as their mime type", async () => {
    const file = new File([], 'landscape.jpeg', {type: 'image/jpeg'});

    await expect(determineParseType(file)).resolves.toEqual({file, parseType: file.type});
  });

  it("should parse compatible files as HTML", async () => {
    const file = new File([], 'equations.mml', {type: 'application/mathml+xml'});

    await expect(determineParseType(file)).resolves.toEqual({file, parseType: 'text/html'});
  });

  it("should flag unknown types", async () => {
    console.error = vitest.fn();
    const file = new File([], 'data.bin', {type: 'application/octet-stream'});

    await expect(determineParseType(file)).resolves.toEqual(expect.objectContaining({file, parseType: file.type, message: expect.stringMatching("Not importable")}));
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("should parse markdown as markdown", async () => {
    const file = new File([], 'webpage.md', {type: 'text/markdown'});

    await expect(determineParseType(file)).resolves.toEqual({file, parseType: file.type});
  });

  it("should guess whether plain text files contain markdown", async () => {
    const file = new File([], 'webpage.txt', {type: 'text/plain'});

    await expect(determineParseType(file)).resolves.toEqual({file, parseType: 'text/plain', isMarkdown: false});
  });

  it("should flag unsupported text types", async () => {
    console.error = vitest.fn();
    const file = new File([], 'document.rtf', {type: 'text/rtf'});

    await expect(determineParseType(file)).resolves.toEqual(expect.objectContaining({file, parseType: file.type, message: expect.stringMatching("Not importable")}));
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("should parse supported text types as their own MIME type", async () => {
    const file = new File([], 'table.csv', {type: 'text/csv'});

    await expect(determineParseType(file)).resolves.toEqual({file, parseType: file.type});
  });

  it("should discard subtype prefixes", async () => {
    const file = new File([], 'config.yaml', {type: 'text/x-yaml'});

    await expect(determineParseType(file)).resolves.toEqual({file, parseType: 'text/yaml'});
  });

  it("should parse unknown types with known extension as text", async () => {
    const file = new File([], 'program.java', {type: ''});

    await expect(determineParseType(file)).resolves.toEqual({file, parseType: 'text/java'});
  });
});

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

describe("importFromFile", () => {
  beforeAll(() => {
    return init("testStorageDb");
  });

  it("should parse a file containing an HTML fragment as one note, with file name prepended", async () => {
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

    const {noteIds, message} = await importFromFile(file, 'text/html', true);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(1);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(message).toEqual("1 note");

    const retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/html;hint=SEMANTIC');
    expect(retrievedNote.title).toEqual(`Some Topic`);
    expect(retrievedNote.content).toEqual("<p><em>Lipsum.html</em></p><hr />" + fileContent.replace(/\n/g, ''));
    expect(retrievedNote.date).toEqual(new Date(fileDate));
    expect(retrievedNote.isLocked).toEqual(false);
  });

  it("should parse a file containing an HTML document as one note, with title & file name prepended", async () => {
    const fileContent = `<html><head><title>Buckaroo Banzai</title></head><body>
<blockquote>No matter where you go, there you are.</blockquote>
</body></html>`;
    const fileDate = '2021-08-01T11:00:00Z';
    const file = new File([fileContent], "Buckaroo-Banzai.html", {type: 'text/html', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importFromFile(file, 'text/html', true);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(1);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(message).toEqual("1 note");

    const retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/html;hint=SEMANTIC');
    expect(retrievedNote.title).toEqual(`Buckaroo Banzai`);
    expect(retrievedNote.content).toEqual(`<h1>Buckaroo Banzai</h1><p><em>Buckaroo-Banzai.html</em></p><hr /><blockquote>No matter where you go, there you are.</blockquote>`);
    expect(retrievedNote.date).toEqual(new Date(fileDate));
    expect(retrievedNote.isLocked).toEqual(false);
  });

  it("should not prepend title of HTML document if it contains a non-blank H1", async () => {
    const htmlContent = `<html><head><title>Albert Einstein — Biographies</title></head><body>
<h1>Einstein Quote</h1>
<blockquote>You should make things as simple as possible, but no simpler.</blockquote>
</body></html>`;
    const einsteinDate = '2019-02-01T13:00:00Z';
    const file = new File([htmlContent], "Einstein-quote.html", {type: 'text/html', lastModified: Date.parse(einsteinDate)});

    const {noteIds, message} = await importFromFile(file, 'text/html', true);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(1);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(message).toEqual("1 note");

    const retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/html;hint=SEMANTIC');
    expect(retrievedNote.title).toEqual(`Einstein Quote`);
    expect(retrievedNote.content).toEqual(
      `<p><em>Einstein-quote.html</em></p><hr /><h1>Einstein Quote</h1><blockquote>You should make things as simple as possible, but no simpler.</blockquote>`);
    expect(retrievedNote.date).toEqual(new Date(einsteinDate));
    expect(retrievedNote.isLocked).toEqual(false);
  });

  it("should parse an empty HTML file as 0 notes", async () => {
    const fileDate = '2021-09-01T12:00:00Z';
    const file = new File([], "empty.html", {type: 'text/html', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importFromFile(file, 'text/html', false);

    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(0);
    expect(message).toEqual("No notes");
  });

  it("should reject an overly-long HTML file", async () => {
    const fileDate = '2021-08-15T12:00:00Z';
    let html = '<li>${Math.random()}</li>\n';
    while (html.length < CONTENT_MAX) {
      html += html;
    }
    const file = new File(['<ol>', html,'</ol>'], "list.html", {type: 'text/html', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importFromFile(file, 'text/html', true);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(0);
    expect(message).toEqual(CONTENT_TOO_LONG);
  });

  it("should parse an empty text file as 0 notes in multiple mode", async () => {
    const fileDate = '2019-06-01T12:00:00Z';
    const file = new File([], "empty-css.html", {type: 'text/css', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importFromFile(file, 'text/plain', true);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(0);
    expect(message).toEqual("No notes");
  });

  it("should parse a text file with no separations nor dates as one note in multiple mode, with date equal to the file date", async () => {
    const fileContent = `Popular Novel
Review copyright 2021 by Doug Reeder

There's three things to say about this:
1. Something
2. Another thing
3. A sweeping generalization`;
    const fileDate = '2021-10-01T13:00:00Z';
    const file = new File([fileContent], "review.text", {type: 'text/plain', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importFromFile(file, 'text/plain', true);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(1);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(message).toEqual("1 note");

    const retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    let titleLines = retrievedNote.title.split('\n');
    expect(titleLines[0]).toEqual("Popular Novel");
    expect(titleLines[1]).toEqual("Review copyright 2021 by Doug Reeder");
    expect(retrievedNote.content).toEqual(fileContent + `

review.text`);
    expect(retrievedNote.date).toEqual(new Date(fileDate));
    expect(retrievedNote.isLocked).toEqual(false);
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

    const {noteIds, message} = await importFromFile(file, 'text/plain', true);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(3);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(uuidValidate(noteIds[1])).toBeTruthy();
    expect(uuidValidate(noteIds[2])).toBeTruthy();
    expect(message).toEqual("3 notes");

    let retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    let titleLines = retrievedNote.title.split('\n');
    expect(titleLines[0]).toMatch(/^Tadka Indian Cuisine/);
    expect(titleLines[1]).toMatch(/^nice atmosphere/);
    expect(retrievedNote.content).toEqual(content0 + '\nmelange.txt');
    expect(retrievedNote.date).toEqual(new Date(date0));
    expect(retrievedNote.isLocked).toEqual(false);

    retrievedNote = await getNote(noteIds[1]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    titleLines = retrievedNote.title.split('\n');
    expect(titleLines[0]).toMatch(/^The Matrix \(1999\)/);
    expect(titleLines[1]).toMatch(/^wouldn't cows be a better heat source?/);
    expect(retrievedNote.content).toEqual(content1 + '\nmelange.txt');
    expect(retrievedNote.date).toEqual(new Date(date1));
    expect(retrievedNote.isLocked).toEqual(false);

    retrievedNote = await getNote(noteIds[2]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    titleLines = retrievedNote.title.split('\n');
    expect(titleLines[0]).toMatch(/^CbusJS d3/);
    expect(titleLines[1]).toMatch(/^Nye County, Nevada/);
    expect(retrievedNote.content).toEqual(content2 + '\n\nmelange.txt');
    expect(Math.abs(retrievedNote.date - new Date(fileDate))).toBeLessThan(5);
    expect(retrievedNote.isLocked).toEqual(false);
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

    const {noteIds, message} = await importFromFile(file, 'text/markdown', true);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(2);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(uuidValidate(noteIds[1])).toBeTruthy();
    expect(message).toEqual("2 notes");

    let retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/markdown;hint=COMMONMARK');
    let titleLines = retrievedNote.title.split('\n');
    expect(titleLines[0]).toMatch(/^Subject Area/);
    expect(titleLines[1]).toMatch(/^Actual Title/);
    expect(retrievedNote.content).toEqual(content0 + '\n------------------------------\n*actually-markdown.txt*');
    expect(retrievedNote.date).toEqual(new Date(date0));
    expect(retrievedNote.isLocked).toEqual(false);

    retrievedNote = await getNote(noteIds[1]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/markdown;hint=COMMONMARK');
    titleLines = retrievedNote.title.split('\n');
    expect(titleLines[0]).toMatch(/^Item          Price      # In stock/);
    expect(titleLines[1]).toMatch(/^Juicy Apples  1.99       7/);
    expect(retrievedNote.content).toEqual(content1 + '\n------------------------------\n*actually-markdown.txt*');
    expect(retrievedNote.date).toEqual(new Date(date1));
    expect(retrievedNote.isLocked).toEqual(false);
  });

  it("should import a Serene Notes backup as Markdown without appending the file name", async () => {
    const content0 = `## First Title

body text of first note
`;
    const date0 = '2006-01-22T07:34:34.085Z';
    const content1 = `# Second Title

body text of second note
`;
    const date1 = '2007-02-13T04:19:06.697Z';
    const file = new File([content0, date0, '\n\n\n\n', content1, date1, '\n\n\n\n'],
        "serene-notes-2021-12-31T0430.txt",
        {type: 'text/plain', lastModified: Date.parse('2021-12-31T0430Z')});

    const {noteIds, message} = await importFromFile(file, 'text/markdown', true);
    expect(Array.isArray(noteIds)).toBeTruthy();
    expect(noteIds.length).toEqual(2);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(uuidValidate(noteIds[1])).toBeTruthy();
    expect(message).toEqual("2 notes");

    let retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/markdown;hint=COMMONMARK');
    expect(retrievedNote.content).toEqual(content0);
    expect(retrievedNote.date).toEqual(new Date(date0));
    expect(retrievedNote.isLocked).toEqual(false);

    retrievedNote = await getNote(noteIds[1]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/markdown;hint=COMMONMARK');
    expect(retrievedNote.content).toEqual(content1);
    expect(retrievedNote.date).toEqual(new Date(date1));
    expect(retrievedNote.isLocked).toEqual(false);
  });

  it("should import a Serene Notes backup as plain text without appending the file name", async () => {
    const content0 = `Something groovy

more fab
`;
    const date0 = '2010-01-22T07:34:34.085Z';
    const content1 = `Harshness

yucking my yum
`;
    const date1 = '2009-02-13T04:19:06.697Z';
    const file = new File([content0, date0, '\n\n\n\n', content1, date1, '\n\n\n\n'],
        "serene-notes-2020-07-15T0430.txt",
        {type: 'text/plain', lastModified: Date.parse('2021-12-31T0430Z')});

    const {noteIds, message} = await importFromFile(file, 'text/plain', true);
    expect(Array.isArray(noteIds)).toBeTruthy();
    expect(noteIds.length).toEqual(2);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(uuidValidate(noteIds[1])).toBeTruthy();
    expect(message).toEqual("2 notes");

    let retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    expect(retrievedNote.content).toEqual(content0);
    expect(retrievedNote.date).toEqual(new Date(date0));
    expect(retrievedNote.isLocked).toEqual(false);

    retrievedNote = await getNote(noteIds[1]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    expect(retrievedNote.content).toEqual(content1);
    expect(retrievedNote.date).toEqual(new Date(date1));
    expect(retrievedNote.isLocked).toEqual(false);
  });

  it("should continue after refusing to create a text note longer than 60,000 characters", async () => {
    console.error = vitest.fn();

    const content0 = 'before\n';
    const date0 = '2006-02-14T07:00:00Z';
    let logLines = `Feb 16 00:17:00 frodo Java Updater[24847]: Untrusted apps are not allowed to connect to Window Server before login.
Feb 16 00:15:30 frodo spindump[24839]: Removing excessive log: file:///Library/Logs/DiagnosticReports/powerstats_2016-02-07-001552_frodo.diag
`;
    while (logLines.length < 60_000) {
      logLines += logLines;
    }
    const content2 = 'after\n';
    const date2 = '2006-02-16T08:00:00Z';
    const file = new File([content0, date0, '\n\n\n\n', logLines, '\n\n\n', content2, date2, '\n\n\n\n'], "report-with-log.txt", {type: 'text/plain'});

    const {noteIds, message} = await importFromFile(file, 'text/plain', true);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(2);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(uuidValidate(noteIds[1])).toBeTruthy();
    expect(message).toEqual("2 notes; Divide manually before importing");

    let retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    let titleLines = retrievedNote.title.split('\n');
    expect(titleLines[0]).toMatch(/^before/);
    expect(retrievedNote.content).toEqual(content0 + '\nreport-with-log.txt');
    expect(retrievedNote.date).toEqual(new Date(date0));
    expect(retrievedNote.isLocked).toEqual(false);

    retrievedNote = await getNote(noteIds[1]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    titleLines = retrievedNote.title.split('\n');
    expect(titleLines[0]).toMatch(/^after/);
    expect(retrievedNote.content).toEqual(content2 + '\nreport-with-log.txt');
    expect(retrievedNote.date).toEqual(new Date(date2));
    expect(retrievedNote.isLocked).toEqual(false);

    expect(console.error).toHaveBeenCalledWith("splitIntoNotes:", expect.any(Error));
  });

  it("should continue after refusing to create a Markdown note longer than 600,000 characters", async () => {
    console.error = vitest.fn();
    const content0 = 'introduction\n';
    const date0 = '2006-02-14T07:00:00Z';
    let listLines = `1. A thing
2. Some other thing
`;
    while (listLines.length < CONTENT_MAX) {
      listLines += listLines;
    }
    let lipsum = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\n';
    while (lipsum.length < 60_000) {
      lipsum += lipsum;
    }
    const date2 = '2006-02-16T08:00:00Z';
    const file = new File([content0, date0, '\n\n\n\n', listLines, '\n\n\n', lipsum, date2, '\n\n\n\n'], "interminable.md", {type: 'text/markdown'});

    const {noteIds, message} = await importFromFile(file, 'text/markdown', true);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(2);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(uuidValidate(noteIds[1])).toBeTruthy();
    expect(message).toEqual("2 notes; Divide manually before importing");

    let retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/markdown;hint=COMMONMARK');
    expect(retrievedNote.title).toMatch(/^introduction\ninterminable.md/);
    expect(retrievedNote.content).toEqual(content0 + '\n------------------------------\n*interminable.md*');
    expect(retrievedNote.date).toEqual(new Date(date0));
    expect(retrievedNote.isLocked).toEqual(false);

    retrievedNote = await getNote(noteIds[1]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/markdown;hint=COMMONMARK');
    expect(retrievedNote.title).toMatch(/^Lorem ipsum dolor sit amet, consectetur adipiscing elit/);
    expect(retrievedNote.content).toEqual(lipsum + '\n------------------------------\n*interminable.md*');
    expect(retrievedNote.date).toEqual(new Date(date2));
    expect(retrievedNote.isLocked).toEqual(false);

    expect(console.error).toHaveBeenCalledWith("splitIntoNotes:", expect.any(Error));
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

    const {noteIds, message} = await importFromFile(file, 'text/javascript', true);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(1);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(message).toEqual("1 note");

    const retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/javascript');
    let titleLines = retrievedNote.title.split('\n');
    expect(titleLines[0]).toMatch(/^historyStub.js/);
    expect(titleLines[1]).toMatch(/^if \('chrome' in window && 'fileSystem' in chrome\) \{/);
    expect(retrievedNote.content).toEqual("historyStub.js\n\n" + fileContent);
    expect(retrievedNote.date).toEqual(new Date(fileDate));
  });

  it("should reject an overly-long non-plain text file", async () => {
    const fileDate = '2021-05-11T12:00:00Z';
    let lines = 'foo,42\n';
    while (lines.length < CONTENT_MAX) {
      lines += lines;
    }
    const file = new File([lines], "too-long.csv", {type: 'text/csv', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importFromFile(file, 'text/csv', true);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(0);
    expect(message).toEqual(CONTENT_TOO_LONG);
  });

  it("should parse a text file as one note when flagged single", async () => {
    const fileContent = `Some Title

Aenean magna orci, porta quis vestibulum ac, venenatis eu est. Nulla justo risus, elementum non efficitur id, congue in enim. Morbi ut pharetra tortor, non blandit neque. Sed elementum gravida fermentum. Vestibulum et lorem nibh. Etiam sollicitudin elementum sapien, sit amet euismod ipsum porttitor a. In tortor augue, elementum at scelerisque eu, mollis id turpis.




Morbi quis vulputate lectus, a interdum velit. Cras quis aliquam magna, sit amet convallis leo. Cras commodo blandit nulla. Morbi tincidunt pellentesque est. Morbi porta id eros vulputate posuere. Ut semper, lorem at iaculis malesuada, arcu diam pretium diam, vitae rhoncus ligula nibh eu nibh. Pellentesque bibendum in felis ullamcorper tempus. Vivamus sodales, ipsum non lacinia ornare, velit eros volutpat nibh, nec scelerisque odio justo vitae tortor. Praesent vitae cursus velit. Etiam a augue ut sapien porttitor mollis. Mauris at neque dapibus dolor elementum vehicula eu a orci. Praesent quis risus ac lorem semper iaculis. Morbi pretium risus in pulvinar semper. Pellentesque lacus velit, fermentum a convallis sed, scelerisque sed ligula. Vestibulum luctus sem id purus posuere, ac pulvinar ante dictum. `;
    const fileDate = '2021-12-01T11:30:00Z';
    const file = new File([fileContent], "gap.txt", {
      type: 'text/plain',
      lastModified: Date.parse(fileDate)
    });

    const {noteIds, message} = await importFromFile(file, 'text/plain', false);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(1);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(message).toEqual("1 note");

    const retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    let titleLines = retrievedNote.title.split('\n');
    expect(titleLines[0]).toMatch(/^gap.txt/);
    expect(titleLines[1]).toMatch(/Some Title/);
    expect(retrievedNote.content).toEqual("gap.txt\n\n" + fileContent);
    expect(retrievedNote.date).toEqual(new Date(fileDate));
    expect(retrievedNote.isLocked).toEqual(false);
  });

  it("should parse a Markdown file as one note when flagged single", async () => {
    const fileContent = `## Lorem Ipsum

1. Aenean magna orci, porta quis vestibulum ac, venenatis eu est.
2. Nulla justo risus, elementum non efficitur id, congue in enim.
3. Morbi ut pharetra tortor, non blandit neque.
4. Sed elementum gravida fermentum.




* Morbi quis vulputate lectus, a interdum velit.
* Cras quis aliquam magna, sit amet convallis leo.
* Cras commodo blandit nulla.
* Morbi tincidunt pellentesque est.`;
    const fileDate = '2021-12-02T12:30:00Z';
    const file = new File([fileContent], "divided.txt", {
      type: 'text/markdown',
      lastModified: Date.parse(fileDate)
    });

    const {noteIds, message} = await importFromFile(file, 'text/markdown', false);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(1);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(message).toEqual("1 note");

    const retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/markdown;hint=COMMONMARK');
    expect(retrievedNote.title).toMatch(/^divided.txt\nLorem Ipsum/);
    expect(retrievedNote.content).toEqual("*divided.txt*\n\n------------------------------\n" + fileContent);
    expect(retrievedNote.date).toEqual(new Date(fileDate));
    expect(retrievedNote.isLocked).toEqual(false);
  });

  it("should parse an empty text file as 0 notes, in single mode", async () => {
    const fileDate = '2019-06-01T12:00:00Z';
    const file = new File([], "empty.txt", {type: 'text/plain', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importFromFile(file, 'text/plain', false);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(0);
    expect(message).toEqual("No notes");
  });

  it("should parse an empty Markdown file as 0 notes, in single mode", async () => {
    const fileDate = '2019-06-01T12:00:00Z';
    const file = new File([], "empty.md", {type: 'text/markdown', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importFromFile(file, 'text/markdown', false);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(0);
    expect(message).toEqual("No notes");
  });

  it("should parse a text file with carriage returns, in single mode", async () => {
    vitest.spyOn(console, 'info').mockImplementation(() => null);

    const {noteIds, message} = await importFromFile(carriageReturnsFile, 'text/plain', false);

    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(1);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(message).toEqual("1 note");

    const retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    expect(retrievedNote.title).toEqual("cr\nSome MacOS Classic file");
    expect(retrievedNote.content).toEqual("cr\n\n" + carriageReturnsContent.replace(/\r/g, '\n'));
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/Imported .*from "cr"/i), ["1 note"]);
  });
});


const fileDateHtml = '1889-01-01T12:00:00Z';
const htmlFile = new File(['<p>Alis Volat Propiis</p>'], 'Oregon.html', {type: 'text/html', lastModified: Date.parse(fileDateHtml)});

const binaryFile = new File([], 'binary', {type: 'application/octet-stream'});

const rtfContent = `{\\rtf1\\ansi\\ansicpg1252\\cocoartf1038\\cocoasubrtf320
{\\fonttbl\\f0\\fswiss\\fcharset0 Helvetica;}
{\\colortbl;\\red255\\green255\\blue255;}
\\margl1440\\margr1440\\vieww10680\\viewh17940\\viewkind0
\\pard\\tx720\\tx1440\\tx2160\\tx2880\\tx3600\\tx4320\\tx5040\\tx5760\\tx6480\\tx7200\\tx7920\\tx8640\\ql\\qnatural\\pardirnatural

\\f0\\fs24 \\cf0 Dev Day Keynote\\
`;
const rtfFile = new File([rtfContent], "typical.rtf", {type: 'text/rtf', lastModified: Date.parse('2019-07-30T12:00:00Z')});

const fileDateMd = '1919-04-17T15:00:00Z';
const markdownContent = "# Tarzan, Lord of the Jungle\n\n\n\n# A Princess of Mars";
const markdownFile = new File([markdownContent], 'Burroughs.md', {type: 'text/markdown', lastModified: Date.parse(fileDateMd)});

const fileDateMdInText = '1970-05-23T17:00:00Z';
const markdownInTextContent = "## Ringworld\n\nreview ©1979\n\n\n\n## World of Ptavvs"
const markDownInTextFile = new File([markdownInTextContent], 'Niven.txt', {type: 'text/plain', lastModified: Date.parse(fileDateMdInText)});

const fileDateText = '1991-02-17T23:00:00Z';
const textContent = 'London Bridge is falling down\n\n\n\nMary, Mary, quite contrary';
const textFile = new File([textContent], 'nursery-rhymes.txt', {type: 'text/plain', lastModified: Date.parse(fileDateText)});

const fileDatePng = '2001-09-30T10:00:00Z';
const dataUrlDot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAABlBMVEUAAAD///+l2Z/dAAAACXBIWXMAAAAAAAAAAACdYiYyAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';
const pngFile = dataURItoFile(dataUrlDot, 'dot.png', fileDatePng);

const fileDateCarriageReturns = '1950-01-31';
const carriageReturnsContent = "Some MacOS Classic file\r\rcollapse of the Soviet Union\nend of the Cold War";
const carriageReturnsFile = new File([carriageReturnsContent], 'cr', {type: 'text/plain', lastModified: Date.parse(fileDateCarriageReturns)});

const fiveFiles = [htmlFile, binaryFile, markdownFile, markDownInTextFile, textFile];

describe("FileImport", () => {
  // jest.setTimeout(30_000);
  beforeAll(() => {
    return init("testStorageDb");
  });

  it("should not render dialog when no files supplied", async () => {
    const mockCloseImport = vitest.fn();

    const {queryAllByRole} = render(<FileImport files={[]} isMultiple={true} doCloseImport={mockCloseImport}/>);

    const dialogs = queryAllByRole('dialog');
    expect(dialogs.length).toEqual(0);
    expect(mockCloseImport).not.toHaveBeenCalled();
  });

  it("should render one row for each file supplied & allow closing", async () => {
    const mockCloseImport = vitest.fn();

    render(<FileImport files={[htmlFile, binaryFile, rtfFile, markdownFile, markDownInTextFile, textFile]} isMultiple={false} doCloseImport={mockCloseImport}/>);

    await waitFor(() => expect(screen.getByRole('dialog', {name: /Review Import \(One Note\/File\)/})).toBeVisible());

    const closeBtn = screen.getByRole('button', {name: "Close"});
    expect(closeBtn).toBeEnabled();
    await waitFor(() => expect(screen.getByRole('button', {name: "Import"})).toBeEnabled());

    const rows = screen.queryAllByRole('row');
    expect(rows.length).toEqual(1+6);
    const headers = screen.queryAllByRole('columnheader');
    expect(headers[0].textContent).toEqual('File Name');
    expect(headers[1].textContent).toEqual('Contains Markdown');
    expect(headers[2].textContent).toEqual('Result');
    const cells = screen.queryAllByRole('cell');
    expect(cells[0].textContent).toEqual("Oregon.html");
    expect(cells[1].textContent).toEqual("");
    expect(cells[2].textContent).toEqual("");
    expect(cells[3].textContent).toEqual("binary");
    expect(cells[4].textContent).toEqual("");
    expect(cells[5].textContent).toEqual("Not importable. Open in appropriate app & copy.");
    expect(cells[6].textContent).toEqual("typical.rtf");
    expect(cells[7].textContent).toEqual("");
    expect(cells[8].textContent).toEqual("Not importable. Open in appropriate app & copy.");
    expect(cells[9].textContent).toEqual("Burroughs.md");
    const mdCheckbox = cells[10].querySelector('input[type=checkbox]');
    expect(mdCheckbox.checked).toEqual(true);
    expect(mdCheckbox.disabled).toEqual(true);
    expect(cells[11].textContent).toEqual("");
    expect(cells[12].textContent).toEqual("Niven.txt");
    const mdInTextCheckbox = cells[13].querySelector('input[type=checkbox]');
    expect(mdInTextCheckbox.checked).toEqual(true);
    expect(mdInTextCheckbox.disabled).toEqual(false);
    expect(cells[14].textContent).toEqual("");
    expect(cells[15].textContent).toEqual("nursery-rhymes.txt");
    const textCheckbox = cells[16].querySelector('input[type=checkbox]');
    expect(textCheckbox.checked).toEqual(false);
    expect(textCheckbox.disabled).toEqual(false);
    expect(cells[17].textContent).toEqual("");
    expect(cells.length).toEqual(6*3);

    await userEvent.click(closeBtn);
    expect(mockCloseImport).toHaveBeenCalledWith("");
  });

  it("should not render Markdown column when not needed", async () => {
    const mockCloseImport = vitest.fn();

    render(<FileImport files={[htmlFile, binaryFile, rtfFile, pngFile]} isMultiple={false} doCloseImport={mockCloseImport}/>);

    await waitFor(() => expect(screen.getByRole('dialog', {name: /Review Import \(One Note\/File\)/})).toBeVisible());

    const closeBtn = screen.getByRole('button', {name: "Close"});
    expect(closeBtn).toBeEnabled();
    await waitFor(() => expect(screen.getByRole('button', {name: "Import"})).toBeEnabled());

    const rows = screen.queryAllByRole('row');
    expect(rows.length).toEqual(1+4);
    const headers = screen.queryAllByRole('columnheader');
    expect(headers[0].textContent).toEqual('File Name');
    expect(headers[1].textContent).toEqual('Result');
    const cells = screen.queryAllByRole('cell');
    expect(cells[0].textContent).toEqual("Oregon.html");
    expect(cells[1].textContent).toEqual("");
    expect(cells[2].textContent).toEqual("binary");
    expect(cells[3].textContent).toEqual("Not importable. Open in appropriate app & copy.");
    expect(cells[4].textContent).toEqual("typical.rtf");
    expect(cells[5].textContent).toEqual("Not importable. Open in appropriate app & copy.");
    expect(cells[6].textContent).toEqual("dot.png");
    expect(cells[7].textContent).toEqual("");
    expect(cells.length).toEqual(4*2);

    await userEvent.click(closeBtn);
    expect(mockCloseImport).toHaveBeenCalledWith("");
  });

  it("should import & summarize results", async () => {
    const mockCloseImport = vitest.fn();

    render(<FileImport files={fiveFiles} isMultiple={false} doCloseImport={mockCloseImport}/>);

    await waitFor(() => expect(screen.getByRole('dialog', {name: /Review Import \(One Note\/File\)/})).toBeVisible())

    const closeBtn = screen.getByRole('button', {name: "Close"});
    expect(closeBtn).toBeEnabled();
    await waitFor(() => expect(screen.getByRole('button', {name: "Import"})).toBeEnabled());

    const cells = screen.queryAllByRole('cell');
    expect(cells[0].textContent).toEqual("Oregon.html");
    expect(cells[1].textContent).toEqual("");
    expect(cells[2].textContent).toEqual("");
    expect(cells[3].textContent).toEqual("binary");
    expect(cells[4].textContent).toEqual("");
    expect(cells[5].textContent).toEqual("Not importable. Open in appropriate app & copy.");
    expect(cells[6].textContent).toEqual("Burroughs.md");
    const mdCheckbox = cells[7].querySelector('input[type=checkbox]');
    expect(mdCheckbox.checked).toEqual(true);
    expect(mdCheckbox.disabled).toEqual(true);
    expect(cells[8].textContent).toEqual("");
    expect(cells[9].textContent).toEqual("Niven.txt");
    const mdInTextCheckbox = cells[10].querySelector('input[type=checkbox]');
    expect(mdInTextCheckbox.checked).toEqual(true);
    expect(mdInTextCheckbox.disabled).toEqual(false);
    expect(cells[11].textContent).toEqual("");
    expect(cells[12].textContent).toEqual("nursery-rhymes.txt");
    const textCheckbox = cells[13].querySelector('input[type=checkbox]');
    expect(textCheckbox.checked).toEqual(false);
    expect(textCheckbox.disabled).toEqual(false);
    expect(cells[14].textContent).toEqual("");
    expect(cells.length).toEqual(5*3);

    await userEvent.click(screen.getByRole('button', {name: "Import"}));
    expect(mockCloseImport).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeEnabled();

    await waitFor(() => expect(screen.getByRole('dialog', {name: "Imported 4 Notes"})).toBeVisible())
    expect(cells[2].textContent).toEqual("1 note");
    expect(cells[5].textContent).toEqual("Not importable. Open in appropriate app & copy.");
    expect(cells[8].textContent).toEqual("1 note");
    expect(cells[11].textContent).toEqual("1 note");
    expect(cells[14].textContent).toEqual("1 note");

    await userEvent.click(closeBtn);
    expect(mockCloseImport).toHaveBeenCalledWith("nursery-rhymes.txt");
  });

  it("should allow changing Markdown flags before importing", async () => {
    const mockCloseImport = vitest.fn();

    render(<FileImport files={fiveFiles} isMultiple={true} doCloseImport={mockCloseImport}/>);

    await waitFor(() => expect(screen.queryAllByRole('row').length).toEqual(1+5));
    expect(screen.getByRole('dialog', {name: "Review Import (Multiple Notes/File)"})).toBeVisible()
    const closeBtn = screen.getByRole('button', {name: "Close"});
    expect(closeBtn).toBeEnabled();
    const importBtn = screen.getByRole('button', {name: "Import"});
    expect(importBtn).toBeEnabled();

    const cells = screen.queryAllByRole('cell');
    expect(cells[0].textContent).toEqual("Oregon.html");
    expect(cells[1].textContent).toEqual("");
    expect(cells[2].textContent).toEqual("");
    expect(cells[3].textContent).toEqual("binary");
    expect(cells[4].textContent).toEqual("");
    expect(cells[5].textContent).toEqual("Not importable. Open in appropriate app & copy.");
    expect(cells[6].textContent).toEqual("Burroughs.md");
    const mdCheckbox = cells[7].querySelector('input[type=checkbox]');
    expect(mdCheckbox.checked).toEqual(true);
    expect(mdCheckbox.disabled).toEqual(true);
    expect(cells[8].textContent).toEqual("");
    expect(cells[9].textContent).toEqual("Niven.txt");
    const mdInTextCheckbox = cells[10].querySelector('input[type=checkbox]');
    expect(mdInTextCheckbox.checked).toEqual(true);
    expect(mdInTextCheckbox.disabled).toEqual(false);
    expect(cells[11].textContent).toEqual("");
    expect(cells[12].textContent).toEqual("nursery-rhymes.txt");
    const textCheckbox = cells[13].querySelector('input[type=checkbox]');
    expect(textCheckbox.checked).toEqual(false);
    expect(textCheckbox.disabled).toEqual(false);
    expect(cells[14].textContent).toEqual("");
    expect(cells.length).toEqual(5*3);

    await userEvent.click(mdInTextCheckbox);
    expect(mdInTextCheckbox.checked).toEqual(false);
    await userEvent.click(textCheckbox);
    expect(textCheckbox.checked).toEqual(true);

    await userEvent.click(importBtn);
    expect(mockCloseImport).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeEnabled();

    await waitFor(() => expect(screen.getByRole('dialog', {name: "Imported 7 Notes"})).toBeVisible())
    expect(cells[2].textContent).toEqual("1 note");
    expect(cells[5].textContent).toEqual("Not importable. Open in appropriate app & copy.");
    expect(cells[8].textContent).toEqual("2 notes");
    expect(cells[11].textContent).toEqual("2 notes");
    expect(cells[14].textContent).toEqual("2 notes");

    await userEvent.click(closeBtn);
    expect(mockCloseImport).toHaveBeenCalledWith("nursery-rhymes.txt");
  });

  it("should import single notes from text & Markdown files when flagged", async () => {
    const mockCloseImport = vitest.fn();

    render(<FileImport files={fiveFiles} isMultiple={false} doCloseImport={mockCloseImport}/>);

    await waitFor(() => expect(screen.getByRole('dialog', {name: /Review Import \(One Note\/File\)/})).toBeVisible())

    const closeBtn = screen.getByRole('button', {name: "Close"});
    expect(closeBtn).toBeEnabled();
    await waitFor(() => expect(screen.getByRole('button', {name: "Import"})).toBeEnabled());

    const cells = screen.queryAllByRole('cell');
    expect(cells[0].textContent).toEqual("Oregon.html");
    expect(cells[1].textContent).toEqual("");
    expect(cells[2].textContent).toEqual("");
    expect(cells[3].textContent).toEqual("binary");
    expect(cells[4].textContent).toEqual("");
    expect(cells[5].textContent).toEqual("Not importable. Open in appropriate app & copy.");
    expect(cells[6].textContent).toEqual("Burroughs.md");
    const mdCheckbox = cells[7].querySelector('input[type=checkbox]');
    expect(mdCheckbox.checked).toEqual(true);
    expect(mdCheckbox.disabled).toEqual(true);
    expect(cells[8].textContent).toEqual("");
    expect(cells[9].textContent).toEqual("Niven.txt");
    const mdInTextCheckbox = cells[10].querySelector('input[type=checkbox]');
    expect(mdInTextCheckbox.checked).toEqual(true);
    expect(mdInTextCheckbox.disabled).toEqual(false);
    expect(cells[11].textContent).toEqual("");
    expect(cells[12].textContent).toEqual("nursery-rhymes.txt");
    const textCheckbox = cells[13].querySelector('input[type=checkbox]');
    expect(textCheckbox.checked).toEqual(false);
    expect(textCheckbox.disabled).toEqual(false);
    expect(cells[14].textContent).toEqual("");
    expect(cells.length).toEqual(5*3);

    await userEvent.click(screen.getByRole('button', {name: "Import"}));
    expect(mockCloseImport).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeEnabled();

    await waitFor(() => expect(screen.getByRole('dialog', {name: "Imported 4 Notes"})).toBeVisible())
    expect(cells[2].textContent).toEqual("1 note");
    expect(cells[5].textContent).toEqual("Not importable. Open in appropriate app & copy.");
    expect(cells[8].textContent).toEqual("1 note");
    expect(cells[11].textContent).toEqual("1 note");
    expect(cells[14].textContent).toEqual("1 note");

    await userEvent.click(closeBtn);
    expect(mockCloseImport).toHaveBeenCalledWith("nursery-rhymes.txt");
  });

  it("should skip review, when all files are readable, an importable type, and not text", async () => {
    const mockCloseImport = vitest.fn();

    render(<FileImport files={[htmlFile, markdownFile]} isMultiple={false} doCloseImport={mockCloseImport}/>);
    await waitFor(() => expect(screen.getByRole('dialog', {name: "Imported 2 Notes"})).toBeVisible())
    const closeBtn = screen.getByRole('button', {name: "Close"});
    expect(closeBtn).toBeEnabled();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeDisabled();
    const cells = screen.queryAllByRole('cell');
    expect(cells[0].textContent).toEqual("Oregon.html");
    expect(cells[1].textContent).toEqual("");
    expect(cells[2].textContent).toEqual("1 note");
    expect(cells[3].textContent).toEqual("Burroughs.md");
    expect(cells[4].textContent).toEqual("");
    expect(cells[5].textContent).toEqual("1 note");
    expect(cells.length).toEqual(2*3);
    expect(mockCloseImport).not.toHaveBeenCalled();

    await userEvent.click(closeBtn);
    expect(mockCloseImport).toHaveBeenCalledWith("Burroughs.md");
  });
});
