// FileImport.test.js - automated tests for importing notes from files
// Copyright © 2021-2022 Doug Reeder

import auto from "fake-indexeddb/auto.js";
import {init, getNote} from "./storage";
import FileImport, {checkForMarkdown, importFromFile} from "./FileImport";
import {
  render,
  screen, waitFor
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {validate as uuidValidate} from "uuid";
import {TITLE_MAX} from "./Note";
import {dataURItoFile} from "./util/testUtil";

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

    const {noteIds, message} = await importFromFile(file, 'text/html', true);
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

    const {noteIds, message} = await importFromFile(file, 'text/html', true);
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
    while (html.length < 600_000) {
      html += html;
    }
    const file = new File(['<ol>', html,'</ol>'], "list.html", {type: 'text/html', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importFromFile(file, 'text/html', true);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(0);
    expect(message).toEqual("Too long. Copy the parts you need.");
  });

  it("should parse an empty text file as 0 notes in multiple mode", async () => {
    const fileDate = '2019-06-01T12:00:00Z';
    const file = new File([], "empty-css.html", {type: 'text/css', lastModified: Date.parse(fileDate)});

    const {noteIds, message} = await importFromFile(file, 'text/plain', true);
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

    const {noteIds, message} = await importFromFile(file, 'text/plain', true);
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

    const {noteIds, message} = await importFromFile(file, 'text/markdown', true);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(2);
    expect(uuidValidate(noteIds[0])).toBeTruthy();
    expect(uuidValidate(noteIds[1])).toBeTruthy();
    expect(message).toEqual("2 notes");

    let retrievedNote = await getNote(noteIds[0]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/markdown');
    let titleLines = retrievedNote.title.split('\n');
    expect(titleLines[0]).toMatch(/^Subject Area/);
    expect(titleLines[1]).toMatch(/^Actual Title/);
    expect(retrievedNote.content).toEqual(content0 + '\nactually-markdown.txt');
    expect(retrievedNote.date).toEqual(new Date(date0));

    retrievedNote = await getNote(noteIds[1]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/markdown');
    titleLines = retrievedNote.title.split('\n');
    expect(titleLines[0]).toMatch(/^Item          Price      # In stock/);
    expect(titleLines[1]).toMatch(/^Juicy Apples  1.99       7/);
    expect(retrievedNote.content).toEqual(content1 + '\nactually-markdown.txt');
    expect(retrievedNote.date).toEqual(new Date(date1));
  });

  it("should continue after refusing to create a text note longer than 60,000 characters", async () => {
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
    expect(retrievedNote.title).toEqual(retrievedNote.content.slice(0, TITLE_MAX).trim());
    expect(retrievedNote.content).toEqual(content0 + '\nreport-with-log.txt');
    expect(retrievedNote.date).toEqual(new Date(date0));

    retrievedNote = await getNote(noteIds[1]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/plain');
    expect(retrievedNote.title).toEqual(retrievedNote.content.slice(0, TITLE_MAX).trim());
    expect(retrievedNote.content).toEqual(content2 + '\nreport-with-log.txt');
    expect(retrievedNote.date).toEqual(new Date(date2));
  });

  it("should continue after refusing to create a Markdown note longer than 600,000 characters", async () => {
    const content0 = 'introduction\n';
    const date0 = '2006-02-14T07:00:00Z';
    let listLines = `1. A thing
2. Some other thing
`;
    while (listLines.length < 600_000) {
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
    expect(retrievedNote.mimeType).toEqual('text/markdown');
    expect(retrievedNote.title).toMatch(/^introduction\ninterminable.md/);
    expect(retrievedNote.content).toEqual(content0 + '\ninterminable.md');
    expect(retrievedNote.date).toEqual(new Date(date0));

    retrievedNote = await getNote(noteIds[1]);
    expect(retrievedNote).toBeInstanceOf(Object);
    expect(retrievedNote.mimeType).toEqual('text/markdown');
    expect(retrievedNote.title).toMatch(/^Lorem ipsum dolor sit amet, consectetur adipiscing elit/);
    expect(retrievedNote.content).toEqual(lipsum + '\ninterminable.md');
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

    const {noteIds, message} = await importFromFile(file, 'text/javascript', true);
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

    const {noteIds, message} = await importFromFile(file, 'text/csv', true);
    expect(noteIds).toBeInstanceOf(Array);
    expect(noteIds.length).toEqual(0);
    expect(message).toEqual("Too long. Copy the parts you need.");
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
    expect(retrievedNote.title).toEqual(retrievedNote.content.slice(0, TITLE_MAX).trim());
    expect(retrievedNote.content).toEqual(fileContent + "\n\ngap.txt");
    expect(retrievedNote.date).toEqual(new Date(fileDate));
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
    expect(retrievedNote.mimeType).toEqual('text/markdown');
    expect(retrievedNote.title).toMatch(/^Lorem Ipsum\n1. Aenean magna orci, porta quis vestibulum ac, venenatis eu est./);
    expect(retrievedNote.content).toEqual(fileContent + "\n\ndivided.txt");
    expect(retrievedNote.date).toEqual(new Date(fileDate));
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

const fiveFiles = [htmlFile, binaryFile, markdownFile, markDownInTextFile, textFile];

describe("FileImport", () => {
  beforeAll(() => {
    return init("testStorageDb");
  });

  it("should not render dialog when no files supplied", async () => {
    const mockCloseImport = jest.fn();

    const {queryAllByRole} = render(<FileImport files={[]} isMultiple={true} doCloseImport={mockCloseImport}/>);

    const dialogs = queryAllByRole('dialog');
    expect(dialogs.length).toEqual(0);
    expect(mockCloseImport).not.toHaveBeenCalled();
  });

  it("should render one row for each file supplied & allow closing", async () => {
    const mockCloseImport = jest.fn();

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

    userEvent.click(closeBtn);
    expect(mockCloseImport).toHaveBeenCalledWith("", expect.anything());
  });

  it("should not render Markdown column when not needed", async () => {
    const mockCloseImport = jest.fn();

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

    userEvent.click(closeBtn);
    expect(mockCloseImport).toHaveBeenCalledWith("", expect.anything());
  });

  it("should import & summarize results", async () => {
    const mockCloseImport = jest.fn();

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

    userEvent.click(screen.getByRole('button', {name: "Import"}));
    expect(mockCloseImport).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeEnabled();

    await waitFor(() => expect(screen.getByRole('dialog', {name: "Imported 4 Notes"})).toBeVisible())
    expect(cells[2].textContent).toEqual("1 note");
    expect(cells[5].textContent).toEqual("Not importable. Open in appropriate app & copy.");
    expect(cells[8].textContent).toEqual("1 note");
    expect(cells[11].textContent).toEqual("1 note");
    expect(cells[14].textContent).toEqual("1 note");

    userEvent.click(closeBtn);
    expect(mockCloseImport).toHaveBeenCalledWith("nursery-rhymes.txt", expect.anything());
  });

  it("should allow changing Markdown flags before importing", async () => {
    const mockCloseImport = jest.fn();

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

    userEvent.click(mdInTextCheckbox);
    expect(mdInTextCheckbox.checked).toEqual(false);
    userEvent.click(textCheckbox);
    expect(textCheckbox.checked).toEqual(true);

    userEvent.click(importBtn);
    expect(mockCloseImport).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeEnabled();

    await waitFor(() => expect(screen.getByRole('dialog', {name: "Imported 7 Notes"})).toBeVisible())
    expect(cells[2].textContent).toEqual("1 note");
    expect(cells[5].textContent).toEqual("Not importable. Open in appropriate app & copy.");
    expect(cells[8].textContent).toEqual("2 notes");
    expect(cells[11].textContent).toEqual("2 notes");
    expect(cells[14].textContent).toEqual("2 notes");

    userEvent.click(closeBtn);
    expect(mockCloseImport).toHaveBeenCalledWith("nursery-rhymes.txt", expect.anything());
  });

  it("should import single notes from text & Markdown files when flagged", async () => {
    const mockCloseImport = jest.fn();

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

    userEvent.click(screen.getByRole('button', {name: "Import"}));
    expect(mockCloseImport).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeEnabled();

    await waitFor(() => expect(screen.getByRole('dialog', {name: "Imported 4 Notes"})).toBeVisible())
    expect(cells[2].textContent).toEqual("1 note");
    expect(cells[5].textContent).toEqual("Not importable. Open in appropriate app & copy.");
    expect(cells[8].textContent).toEqual("1 note");
    expect(cells[11].textContent).toEqual("1 note");
    expect(cells[14].textContent).toEqual("1 note");

    userEvent.click(closeBtn);
    expect(mockCloseImport).toHaveBeenCalledWith("nursery-rhymes.txt", expect.anything());
  });

  it("should skip review, when all files are readable, an importable type, and not text", async () => {
    const mockCloseImport = jest.fn();

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

    userEvent.click(closeBtn);
    expect(mockCloseImport).toHaveBeenCalledWith("Burroughs.md", expect.anything());
  });
});
