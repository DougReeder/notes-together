// sanitizeNote.test.js - automated tests for subroutine for Notes module for RemoteStorage
// Copyright © 2021 Doug Reeder under the MIT license

import {sanitizeNote} from "./sanitizeNote";
import {createMemoryNote} from "./Note";
import {parseWords} from "./storage";

function generateTestId() {
  return Number.MIN_SAFE_INTEGER - 10 + Math.ceil(Math.random() * Number.MIN_SAFE_INTEGER);
}

describe("sanitizeNote", () => {
  it("should fail when passed a note without text", () => {
    expect(() => {sanitizeNote({id:Number.MIN_SAFE_INTEGER-2})}).toThrow('text');
  });

  it("should remove forbidden tags and attributes", () => {
    const original = createMemoryNote(generateTestId(),
        `Our <a href="/menu">menu</a> is extensive!
<script>alert("Hello World!");</script>
<button name="button">Press me</button>
<input type="text" id="name" name="name" required minlength="4" maxlength="8" size="10">
<select id="pet-select"><option value="dog">Dog</option><option value="cat">Cat</option></select>
<canvas width="300" height="300">graph of sine function</canvas>
<div style="position: absolute; bottom: 0; left: 0">This is absolutely positioned bottom left</div>
<video controls width="250"><source src="/media/cc0-videos/flower.webm" type="video/webm">Sorry, your browser doesn't support embedded videos.</video>
unstyled text <font color="red" size="-2">small red text</font> unstyled text`);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.text).toEqual(
        `Our menu is extensive!




graph of sine function
<div>This is absolutely positioned bottom left</div>
Sorry, your browser doesn't support embedded videos.
unstyled text small red text unstyled text`);
  });

  it("should normalize markup", () => {
    const originalId = generateTestId();
    const originalText = "<header>A mind is a <strike>terrible thing</blockquote> to waste";
    const original = createMemoryNote(originalId, originalText);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.text).toEqual("<header>A mind is a <strike>terrible thing to waste</strike></header>");
  });

  it("should pass through a date of type Date", () => {
    const memNote = createMemoryNote(generateTestId(), "excellent", new Date('2021-02-01T09:00:00.000Z'));

    const cleanNote = sanitizeNote(memNote);

    expect(cleanNote.date).toBeInstanceOf(Date);
    expect(cleanNote.date).toEqual(memNote.date);
  });

  it("should parse a string date into a Date", () => {
    const memNote = createMemoryNote(generateTestId(), "archangel");
    memNote.date = '2021-03-01T06:00:00.000Z';

    const cleanNote = sanitizeNote(memNote);

    expect(cleanNote.date).toBeInstanceOf(Date);
  });

  it("should parse a number date into a Date", () => {
    const memNote = createMemoryNote(generateTestId(), "redecorate");
    memNote.date = 1624176186133;

    const cleanNote = sanitizeNote(memNote);

    expect(cleanNote.date).toBeInstanceOf(Date);
  });

  it("should use current date when passed a non-date, non-string in date field", () => {
    const note = createMemoryNote(generateTestId(), "something");
    note.date = document.documentElement;

    const cleanNote = sanitizeNote(note);

    expect(cleanNote.date).toBeInstanceOf(Date);
    const today = new Date();
    expect(cleanNote.date.getFullYear()).toEqual(today.getFullYear());
    expect(cleanNote.date.getMonth()).toEqual(today.getMonth());
    expect(cleanNote.date.getDate()).toEqual(today.getDate());
  });

  it("should allow extraction of normalized keywords via textFilter",  () => {
    const originalText = "editor-in-chief\n================<br>foo_bar Foo.bar </strong>_underlined_\n";
    const original = createMemoryNote(generateTestId(), originalText);
    const wordSet = new Set();
    const textFilter = function (text) {
      for (const word of parseWords(text)) {
        wordSet.add(word);
      }
      return text;
    }

    const cleanNote = sanitizeNote(original, textFilter);

    expect(cleanNote.text).toEqual("editor-in-chief\n================<br />foo_bar Foo.bar _underlined_\n");
    const wordArr = Array.from(wordSet);
    expect(wordArr).toContain("EDITORINCHIEF");
    expect(wordArr).toContain("FOOBAR");
    expect(wordArr).toContain("UNDERLINED");
    expect(wordArr).not.toContain("BR");
    expect(wordArr).not.toContain("STRONG");
    expect(wordArr.length).toEqual(3);
  });
});
