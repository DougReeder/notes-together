// sanitizeNote.test.js - automated tests for subroutine for Notes module for RemoteStorage
// Copyright © 2021 Doug Reeder under the MIT license

import {sanitizeNote} from "./sanitizeNote";
import {createMemoryNote} from "./Note";
import {parseWords} from "./storage";

function generateTestId() {
  return Number.MIN_SAFE_INTEGER - 10 + Math.ceil(Math.random() * Number.MIN_SAFE_INTEGER);
}

describe("sanitizeNote", () => {
  it("should fail when passed a note without content", () => {
    expect(() => {sanitizeNote({id:Number.MIN_SAFE_INTEGER-2})}).toThrow('content');
  });

  it("should remove forbidden tags and attributes", () => {
    const original = createMemoryNote(generateTestId(),
        `Our <a href="/menu">menu</a> is extensive!
<img srcset="https://mdg.imgix.net/book-cover.jpg?fit=clip&amp;w=480 480w, https://mdg.imgix.net/book-cover.jpg?fit=clip&amp;w=1080 1080w" src="https://mdg.imgix.net/book-cover.jpg" class="img-fluid" alt="Markdown Guide book cover" loading="lazy" sizes="100vw">
<script>alert("Hello World!");</script>
<button name="button">Press me</button>
<input type="text" id="name" name="name" required minlength="4" maxlength="8" size="10">
<select id="pet-select"><option value="dog">Dog</option><option value="cat">Cat</option></select>
<canvas width="300" height="300">graph of sine function</canvas>
<div style="position: absolute; bottom: 0; left: 0">This is absolutely positioned bottom left</div>
<video controls width="250"><source src="/media/cc0-videos/flower.webm" type="video/webm">Sorry, your browser doesn't support embedded videos.</video>
unstyled text <font color="red" size="-2">small red text</font> unstyled text`);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.content).toEqual(
        `Our <a href="/menu">menu</a> is extensive!
<img srcset="https://mdg.imgix.net/book-cover.jpg?fit=clip&amp;w=480 480w, https://mdg.imgix.net/book-cover.jpg?fit=clip&amp;w=1080 1080w" src="https://mdg.imgix.net/book-cover.jpg" alt="Markdown Guide book cover" sizes="100vw" />




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

    expect(cleanNote.content).toEqual("<header>A mind is a <strike>terrible thing to waste</strike></header>");
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

    expect(cleanNote.content).toEqual("editor-in-chief\n================<br />foo_bar Foo.bar _underlined_\n");
    const wordArr = Array.from(wordSet);
    expect(wordArr).toContain("EDITORINCHIEF");
    expect(wordArr).toContain("FOOBAR");
    expect(wordArr).toContain("UNDERLINED");
    expect(wordArr).not.toContain("BR");
    expect(wordArr).not.toContain("STRONG");
    expect(wordArr.length).toEqual(3);
  });

  it("should extract a title from h tags, prioritizing higher", () => {
    const originalId = generateTestId();
    const originalText = `  <hr/><h6>trivial heading</h6>
  <h5>minor heading</h5>
<h3>Subheading</h3>`;
    const original = createMemoryNote(originalId, originalText);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.title).toEqual("Subheading\nminor heading");
    expect(cleanNote.content).toEqual(`  <hr /><h3>trivial heading</h3>
  <h3>minor heading</h3>
<h3>Subheading</h3>`);
  });

  it("should extract a title from h tags and ordinary tags if needed", () => {
    const originalId = generateTestId();
    const originalText = `  <p> </p><a href="https://www.npr.org/programs/" title="null">click me</a>
  <del>some old stuff</del>
  <sup>12</sup><sub>6</sub>C
  <p>first real paragraph</p>
  <p>second real paragraph</p>
  <h6>minor heading</h6>`;
    const original = createMemoryNote(originalId, originalText);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.title).toEqual("minor heading\nfirst real paragraph");
    expect(cleanNote.content).toEqual(`  <p> </p><a href="https://www.npr.org/programs/" title="null">click me</a>
  <del>some old stuff</del>
  <sup>12</sup><sub>6</sub>C
  <p>first real paragraph</p>
  <p>second real paragraph</p>
  <h3>minor heading</h3>`);
  });

  it("should extract a title from paragraphs rather than emphasis", () => {
    const originalId = generateTestId();
    const originalText = ` <p>The <em>long</em>, <b>strong</b> thing</p> `;
    const original = createMemoryNote(originalId, originalText);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.title).toMatch(/^The long, strong thing/);
    expect(cleanNote.content).toEqual(` <p>The <i>long</i>, <b>strong</b> thing</p> `);
  });

  it("should extract a title from ordinary tags if necessary", () => {
    const originalId = generateTestId();
    const originalText = `  <div>something</div>  <div>another thing</div>`;
    const original = createMemoryNote(originalId, originalText);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.title).toEqual("something\nanother thing");
    expect(cleanNote.content).toEqual(`  <div>something</div>  <div>another thing</div>`);
  });

  it("should extract a title from list items if necessary", () => {
    const originalId = generateTestId();
    const originalText = `  <ul>
  <li>erste</li>
  <li>zwitte</li>
</ul>`;
    const original = createMemoryNote(originalId, originalText);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.title).toEqual("• erste\n• zwitte");
    expect(cleanNote.content).toEqual(`  <ul>
  <li>erste</li>
  <li>zwitte</li>
</ul>`);
  });

  it("should extract a title from img alt attribute, after paragraph text", () => {
    const originalId = generateTestId();
    const originalText = `  <img class="fit-picture"
       src="/media/cc0-images/grapefruit-slice-332-332.jpg"
       alt="Grapefruit slice atop a pile of other slices"> <p> Grapefruit are healthy. </p>  `;
    const original = createMemoryNote(originalId, originalText);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.title).toEqual("Grapefruit are healthy.\nGrapefruit slice atop a pile of other slices");
    expect(cleanNote.content).toEqual(`  <img src="/media/cc0-images/grapefruit-slice-332-332.jpg" alt="Grapefruit slice atop a pile of other slices" /> <p> Grapefruit are healthy. </p>  `);
  });

  it("should not extract title string twice from emphasis in paragraph", () => {
    const originalId = generateTestId();
    const originalText = ` <p><i> Barrier Mage</i> short talk </p> `;
    const original = createMemoryNote(originalId, originalText);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.title).toEqual("Barrier Mage short talk");
    expect(cleanNote.content).toEqual(` <p><i> Barrier Mage</i> short talk </p> `);
  });

  it("should extract title once from code block", () => {
    const originalId = generateTestId();
    const originalText = ` <pre><code> a = b + c </code></pre> `;
    const original = createMemoryNote(originalId, originalText);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.title).toEqual("a = b + c");
    expect(cleanNote.content).toEqual(` <pre><code> a = b + c </code></pre> `);
  });

  it("should extract title from tables", () => {
    const originalId = generateTestId();
    const originalText = ` 
 <table>
    <thead>
        <tr>
            <th colspan="2"> Shortcuts — Anywhere </th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td> four carriage-returns </td>
            <td> new note </td>
        </tr>
    </tbody>
</table>
    `;
    const original = createMemoryNote(originalId, originalText);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.title).toEqual("Shortcuts — Anywhere\nfour carriage-returns");
    expect(cleanNote.content).toEqual(` 
 <table>
    <thead>
        <tr>
            <th colspan="2"> Shortcuts — Anywhere </th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td> four carriage-returns </td>
            <td> new note </td>
        </tr>
    </tbody>
</table>
    `);
  });

  it("should extract a title from low-value tags if necessary", () => {
    const originalId = generateTestId();
    const originalText = `  <aside>pasted sidebar</aside>   <a href="http://example.com">click me</a> `;
    const original = createMemoryNote(originalId, originalText);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.title).toEqual("pasted sidebar\nclick me");
    expect(cleanNote.content).toEqual(`  <aside>pasted sidebar</aside>   <a href="http://example.com">click me</a> `);
  });

  it("should not extract a title from ruby tags", () => {
    const originalId = generateTestId();
    const originalText = `<p><ruby>
  明日 <rp>(</rp><rt>Ashita</rt><rp>)</rp>
</ruby></p>`;
    const original = createMemoryNote(originalId, originalText);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.title).toEqual("明日 (Ashita)");
    expect(cleanNote.content).toEqual(`<p><ruby>
  明日 <rp>(</rp><rt>Ashita</rt><rp>)</rp>
</ruby></p>`);
  });

  it("should extract a blank title from blank paragraphs", () => {
    const originalId = generateTestId();
    const originalText = `  <p>  </p>  <div>  </div>`;
    const original = createMemoryNote(originalId, originalText);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.title).toEqual("");
    expect(cleanNote.content).toEqual(`  <p>  </p>  <div>  </div>`);
  });

  it("should extract a title from raw text without tags if necessary", () => {
    const originalId = generateTestId();
    const originalText = `  
    
    plain text   `;
    const original = createMemoryNote(originalId, originalText);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.title).toEqual("plain text");
    expect(cleanNote.content).toEqual(`  
    
    plain text   `);
  });

  it("should extract a title without HTML entities", () => {
    const originalId = generateTestId();
    const originalText = `   <p> something &quot;quoted&quot; a&gt;b c&lt;d </p>
   <p> Bob&#39;s Red Mill; Alice &amp; Bob &amp; Carol </p> `;
    const original = createMemoryNote(originalId, originalText);

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.title).toEqual("something \"quoted\" a>b c<d\nBob's Red Mill; Alice & Bob & Carol");
    expect(cleanNote.content).toEqual(`   <p> something &quot;quoted&quot; a&gt;b c&lt;d </p>
   <p> Bob&#39;s Red Mill; Alice &amp; Bob &amp; Carol </p> `);
  });

  it("should extract a title from h tags and allow extraction of keywords",  () => {
    const originalText = `leading junk
    <h2>Table of Contents</h2>
<h1>The <b>Actual</b> Title</h1>
<p>body text</p>`;
    const original = createMemoryNote(generateTestId(), originalText);
    const wordSet = new Set();
    const textFilter = function (text) {
      for (const word of parseWords(text)) {
        wordSet.add(word);
      }
      return text;
    }

    const cleanNote = sanitizeNote(original, textFilter);

    expect(cleanNote.content).toEqual(`leading junk
    <h2>Table of Contents</h2>
<h1>The <b>Actual</b> Title</h1>
<p>body text</p>`);
    const wordArr = Array.from(wordSet);
    expect(wordArr).toContain("LEADING");
    expect(wordArr).toContain("JUNK");
    expect(wordArr).toContain("TABLE");
    expect(wordArr).toContain("OF");
    expect(wordArr).toContain("CONTENTS");
    expect(wordArr).toContain("THE");
    expect(wordArr).toContain("ACTUAL");
    expect(wordArr).toContain("TITLE");
    expect(wordArr).toContain("BODY");
    expect(wordArr).toContain("TEXT");
    expect(wordArr).not.toContain("H2");
    expect(wordArr).not.toContain("H1");
    expect(wordArr).not.toContain("P");
    expect(wordArr.length).toEqual(10);
    expect(cleanNote.title).toMatch(/^The Actual Title\nTable of Contents/);
  });

  it("should retain existing title", () => {
    const originalId = generateTestId();
    const originalText = `  <p> note body </p> `;
    const original = createMemoryNote(originalId, originalText);
    original.title = "title text";

    const cleanNote = sanitizeNote(original);

    expect(cleanNote.title).toEqual("title text");
    expect(cleanNote.content).toEqual(`  <p> note body </p> `);
  });
});
