// mergeConflicts.test.js - automated tests for merging two notes for Notes Together
// Copyright © 2021–2026 Doug Reeder

import {matchElements, mergeNotes} from "./mergeConflicts";
import {deserializeHtml, serializeHtml} from "./slateHtmlUtil.js";
import {SerializedNote} from "./Note.js";
import generateTestId from "./util/generateTestId.js";

const markupSvg = `<svg width="120" height="240" version="1.1" xmlns="http://www.w3.org/2000/svg">
  <defs>
      <linearGradient id="Gradient1">
        <stop class="stop1" offset="0%"/>
        <stop class="stop2" offset="50%"/>
        <stop class="stop3" offset="100%"/>
      </linearGradient>
      <linearGradient id="Gradient2" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="red"/>
        <stop offset="50%" stop-color="black" stop-opacity="0"/>
        <stop offset="100%" stop-color="blue"/>
      </linearGradient>
      <style type="text/css"><![CDATA[
        #rect1 { fill: url(#Gradient1); }
        .stop1 { stop-color: red; }
        .stop2 { stop-color: black; stop-opacity: 0; }
        .stop3 { stop-color: blue; }
      ]]></style>
  </defs>

  <rect id="rect1" x="10" y="10" rx="15" ry="15" width="100" height="100"/>
  <rect x="10" y="120" rx="15" ry="15" width="100" height="100" fill="url(#Gradient2)"/>

</svg>`;


describe("matchElements", () => {
  it("should not match different types", () => {
    expect(matchElements(
      {type: 'quote', children: []},
      {type: 'paragraph', children: []}
    )).toBe('DIFFERENT');
  });

  it("should not match blocks and inlines", () => {
    expect(matchElements(
      {type: 'list-item', children: [
          {text: "Nam egestas"},
          {text: "felis a tellus"}
        ]},
      {type: 'list-item', children: [
          {type: 'paragraph', children: [{text: "Nam egestas"}]},
          {type: 'paragraph', children: [{text: "felis a tellus"}]},
        ]}
    )).toBe('DIFFERENT');
  });

  it("should allow merging different numbers of inlines", () => {
    expect(matchElements(
        {type: 'list-item', children: [
            {text: "Nam egestas"},
            {text: "felis a tellus"}
          ]},
        {type: 'list-item', children: [
            {text: "Nam egestas"},
            {text: "felis a tellus"},
            {text: "et vestibulum lectus "},
          ]}
    )).toBe('MERGEABLE');
  });

  it("should allow merging different numbers of blocks", () => {
    expect(matchElements(
        {type: 'list-item', children: [
            {type: 'paragraph', children: [{text: "Nam egestas"}]},
            {type: 'paragraph', children: [{text: "felis a tellus"}]},
          ]},
        {type: 'list-item', children: [
            {type: 'paragraph', children: [{text: "Nam egestas"}]},
            {type: 'paragraph', children: [{text: "felis a tellus"}]},
            {type: 'paragraph', children: [{text: "et vestibulum lectus"}]},
          ]}
    )).toBe('MERGEABLE');
  });

  it("should allow merging same number of inlines", () => {
    expect(matchElements(
        {type: 'list-item', children: [
            {text: "Nam egestas"},
            {text: "felis a tellus"}
          ]},
        {type: 'list-item', children: [
            {text: "Nam egestas"},
            {text: "et vestibulum lectus "},
          ]}
    )).toBe('MERGEABLE');
  });

  it("should allow merging same number of blocks", () => {
    expect(matchElements(
        {type: 'list-item', children: [
            {type: 'paragraph', children: [{text: "Nam egestas"}]},
            {type: 'paragraph', children: [{text: "felis a tellus"}]},
          ]},
        {type: 'list-item', children: [
            {type: 'paragraph', children: [{text: "Nam egestas"}]},
            {type: 'paragraph', children: [{text: "et vestibulum lectus"}]},
          ]}
    )).toBe('MERGEABLE');
  });

  it("should match inlines", () => {
    expect(matchElements(
        {type: 'list-item', children: [
            {text: "Nam egestas"},
            {text: "felis a tellus"}
          ]},
        {type: 'list-item', children: [
            {text: "Nam egestas"},
            {text: "felis a tellus"},
          ]}
    )).toBe('EQUAL');
  });

  it("should match blocks", () => {
    expect(matchElements(
        {type: 'list-item', children: [
            {type: 'paragraph', children: [{text: "Nam egestas"}]},
            {type: 'paragraph', children: [{text: "felis a tellus"}]},
          ]},
        {type: 'list-item', children: [
            {type: 'paragraph', children: [{text: "Nam egestas"}]},
            {type: 'paragraph', children: [{text: "felis a tellus"}]},
          ]}
    )).toBe('EQUAL');
  });

  it("should allow merging nested blocks", () => {
    expect(matchElements(
        {type: 'bulleted-list', children: [
            {type: 'list-item', children: [
                {type: 'paragraph', children: [{text: "Nam egestas"}]},
                {type: 'paragraph', children: [{text: "felis a tellus"}]},
              ]}]},
        {type: 'bulleted-list', children: [
            {type: 'list-item', children: [
                {type: 'paragraph', children: [{text: "Nam egestas"}]},
                {type: 'paragraph', children: [{text: "Morbi mattis urna varius"}]},
              ]}]}
    )).toBe('MERGEABLE');
  });

  it("should match nested blocks", () => {
    expect(matchElements(
        {type: 'bulleted-list', children: [
            {type: 'list-item', children: [
                {type: 'paragraph', children: [{text: "Nam egestas"}]},
                {type: 'paragraph', children: [{text: "Morbi mattis urna varius"}]},
              ]}]},
        {type: 'bulleted-list', children: [
            {type: 'list-item', children: [
                {type: 'paragraph', children: [{text: "Nam egestas"}]},
                {type: 'paragraph', children: [{text: "Morbi mattis urna varius"}]},
              ]}]}
    )).toBe('EQUAL');
  });

  it("should handle blocks with different properties", () => {
    expect(matchElements(
        {type: 'list-item', checked: true, children: [{text: "plain"}]},
        {type: 'list-item', children: [{text: "plain"}]}
    )).toBe('DIFFERENT');
  });
});

// Tests of date or lock conflicts should call mergeNotes() directly.
// Tests of content and/or mimeType conflicts should call mergeConflicts() shim.
describe("mergeNotes", () => {
  it("should merge plain text line-by-line", () => {
    const oldText = `The Dao that is seen
is not the true Dao
until you bring fresh toner
-- anonymous`;
    const newText = `The Dao that is seen
is not the true Dao, until
you bring fresh toner
-- anonymous
`;

    const mergedText = mergeConflicts(oldText, newText, 'plain');
    expect(mergedText).toEqual(`The Dao that is seen
- is not the true Dao
+ is not the true Dao, until
- until you bring fresh toner
+ you bring fresh toner
-- anonymous
+ `);
  });

  it("should merge Markdown in text/plain note w/ Markdown in text/markdown note", () => {
    const text1 = `   * erste 

   *  zwitte A

      zwitte B 

  *   dritte`;
    const text2 = `  * erste 

  *  zwitte A und zwitte B 

 *   dritte`;
    const mergedText = mergeConflicts(text1, text2, 'plain', 'markdown');
    expect(mergedText).toEqual(`* erste
* <del>zwitte A</del>

    <del>zwitte B</del>
* <ins>zwitte A und zwitte B</ins>
* dritte`)
  });

  it("should normalize MarkDown when both versions are equal", () => {
    const text1 = `   * erste 

   *  zwitte A

      zwitte B 

  *   dritte`;
    const text2 = `   * erste 

   *  zwitte A

      zwitte B 

  *   dritte`;
    const mergedText = mergeConflicts(text1, text2, 'markdown');
    expect(mergedText).toEqual(`* erste
* zwitte A

    zwitte B
* dritte`)
  });

  it("should match identical MarkDown, merge mergeable & flag differences", () => {
    const text1 = `   * one 
  * two
 * ![picture three](https://iota.yy/q.png)
  *   four   

paragraph of five   

paragraph of *six* 

\`\`\`
let a = b + c;
\`\`\`
`;
    const text2 = `   * ![description text](https://epsilon.xx/q.png "another title")
   * dos
 *   tres
   *   four

> blockquote of cinco    

paragraph of *six* [links for](https://abc.mx/) your pleasure
`;
    const mergedText = mergeConflicts(text1, text2, 'markdown');
    expect(mergedText).toEqual(`* <del>one</del>
* ![<ins>description text</ins>](https://epsilon.xx/q.png "another title")
* <del>two</del><ins>dos</ins>
* ![<del>picture three</del>](https://iota.yy/q.png)
* <ins>tres</ins>
* four

<del>paragraph of five</del>

> <ins>blockquote of cinco</ins>

paragraph of *six*<ins> </ins>[<ins>links for</ins>](https://abc.mx/)<ins> your pleasure</ins>
\`\`\`
let a = b + c;
\`\`\``);
    // can't put <del> tags inside MarkDown code block
  });

  it("should handle different beginnings", () => {
    const mergedMarkup = mergeConflicts('<p>foo</p><p><b>bold</b></p><p>end</p>', '<p>bar<p><i>italic</i><p>end');
    expect(mergedMarkup).toEqual('<p><del>foo</del><ins>bar</ins></p><p><del><strong>bold</strong></del><ins><em>italic</em></ins></p><p>end</p>');
  });

  it("should handle delete at beginning of markup 1", () => {
    const mergedMarkup = mergeConflicts('<p>end</p>', '<h1>title</h1><p>end</p>');
    expect(mergedMarkup).toEqual('<h1><ins>title</ins></h1><p>end</p>');
  });

  it("should handle delete at beginning of markup 2", () => {
    const mergedMarkup = mergeConflicts('<h1>title</h1><p>end</p>', '<p>end</p>');
    expect(mergedMarkup).toEqual('<h1><del>title</del></h1><p>end</p>');
  });

  it("should handle delete at end of markup 1", () => {
    const mergedMarkup = mergeConflicts('<h2>start</h2><p>something</p>', '<h2>start</h2>');
    expect(mergedMarkup).toEqual('<h2>start</h2><p><del>something</del></p>');
  });

  it("should handle delete at end of markup 2", () => {
    const mergedMarkup = mergeConflicts('<pre>start</pre>', '<pre>start</pre><p>something</p>');
    expect(mergedMarkup).toEqual('<pre><code>start</code></pre><p><ins>something</ins></p>');
  });

  it("should handle different ends", () => {
    const mergedMarkup = mergeConflicts('<h6>start</h6><p><b>bold</b></p><p>foo</p>', '<h6>start</h6><p><i>italic</i></p><p>bar</p>');
    expect(mergedMarkup).toEqual('<h3>start</h3><p><del><strong>bold</strong></del><ins><em>italic</em></ins></p><p><del>foo</del><ins>bar</ins></p>');

    const mergedMarkup2 = mergeConflicts('<hr><p>alpha</p>', '<hr><p>beta</p>');
    expect(mergedMarkup2).toEqual('<hr /><p><del>alpha</del><ins>beta</ins></p>');
  });

  it("should include all of totally different markups", () => {
    const mergedMarkup = mergeConflicts('<h2>title</h2><blockquote>first</blockquote>', '<p>first paragraph</p><p>second paragraph</p>');
    expect(mergedMarkup).toEqual('<h2><del>title</del></h2><blockquote><del>first</del></blockquote><p><ins>first paragraph</ins></p><p><ins>second paragraph</ins></p>');

    const mergedMarkup2 = mergeConflicts('<a href="https://example.com/">first</a>', '<img src="https://example.org/pic" />');
    expect(mergedMarkup2).toEqual('<a href="https://example.com/"><del>first</del></a><img src="https://example.org/pic" alt="">');
  });

  // it("should insert a space between alternate text (to avoid joining words)", () => {
  //   const mergedMarkup = mergeConflicts('<h3>one way</h3>', '<h3>point forward</h3>');
  //   expect(mergedMarkup).toEqual('<h3><del>one way</del><ins>point forward</ins></h3>');
  // });

  it("should handle text replaced by tag", () => {
    const mergedMarkup = mergeConflicts('<p>Figure 1: (image goes here)</p>', '<p>Figure 1: </p><img src="fig1.jpg">');
    expect(mergedMarkup).toEqual('<p><del>Figure 1: (image goes here)</del><ins>Figure 1: </ins></p><img src="fig1.jpg" alt="">');
  });

  it("should recognize equal links", () => {
    const mergedMarkup = mergeConflicts('<a href="https://example.com/">stuff</a>', '<a href="https://example.com/">stuff</a>');
    expect(mergedMarkup).toEqual('<a href="https://example.com/">stuff</a>');
  });

  it("should merge links differing by content", () => {
    const mergedMarkup = mergeConflicts('<a href="https://example.com/">stuff</a>', '<a href="https://example.com/">things</a>');
    expect(mergedMarkup).toEqual('<a href="https://example.com/"><del>stuff</del><ins>things</ins></a>');
  });

  it("should include both versions of links differing by href", () => {
    const mergedMarkup = mergeConflicts('<a href="https://example.com/">stuff</a>', '<a href="https://example.org/">stuff</a>');
    expect(mergedMarkup).toEqual('<a href="https://example.com/"><del>stuff</del></a><a href="https://example.org/"><ins>stuff</ins></a>');
  });

  it("should merge alt attributes of images differing only by alt", () => {
    const mergedMarkup = mergeConflicts('<img src="fig1.jpg" alt="description 1">', '<img src="fig1.jpg" alt="description 2">');
    expect(mergedMarkup).toEqual('<img src="fig1.jpg" alt="description 1description 2">');
  });

  it("should include both versions of images differing by src", () => {
    const mergedMarkup = mergeConflicts('<img src="fig1.jpg" alt="description">', '<img src="fig2.jpg" alt="description">');
    // TODO: show image as inserted and deleted
    expect(mergedMarkup).toEqual('<img src="fig1.jpg" alt="description"><img src="fig2.jpg" alt="description">');
  });

  it("should include both list items differing by checked", () => {
    const mergedMarkup = mergeConflicts('<li><input type="checkbox" checked/>Quisque</li>', '<li><input type="checkbox"/>Quisque</li>');
    expect(mergedMarkup).toEqual('<li><input type="checkbox" checked/><del>Quisque</del></li><li><input type="checkbox"/><ins>Quisque</ins></li>');
  });

  it("should merge changes in list", () => {
      const mergedMarkup = mergeConflicts(
          '<ul><li>first</li><li>second</li><li>third</li></ul>',
          '<ul><li>first</li><li>second changed</li><li>third</li></ul>'
      );
      expect(mergedMarkup).toEqual(
          '<ul><li>first</li><li><del>second</del><ins>second changed</ins></li><li>third</li></ul>'
      );
  });

  it("should merge changes in table", () => {
      const mergedMarkup = mergeConflicts(
          '<table><tr><td>A1</td><td>A2</td></tr><tr><td>B1</td><td>B2</td></tr></table>',
          '<table><tr><td>A1</td><td>A2</td></tr><tr><td>B1 changed</td><td>B2</td></tr></table>'
      );
      expect(mergedMarkup).toEqual('<table><tbody><tr><td>A1</td><td>A2</td></tr><tr><td><del>B1</del><ins>B1 changed</ins></td><td>B2</td></tr></tbody></table>');
  });

  it("should handle changes in number of rows or columns in table", () => {
    const mergedMarkup = mergeConflicts(
        `
<table>
<tr><td>A1</td><td>x</td><td>A2</td></tr>
<tr><td>B1</td><td>x</td><td>B2</td></tr>
</table>`, `<table>
<tr><td>A1</td><td>A2</td></tr>
<tr><td>x</td><td>x</td></tr>
<tr><td>B1</td><td>B2</td></tr>
</table>`);
    expect(mergedMarkup.replace(/<tr>/g, '\n<tr>',)).toEqual(`<table><tbody>
<tr><td>A1</td><td><del>x</del></td><td>A2</td></tr>
<tr><td><del>B1</del><ins>x</ins></td><td>x</td><td><del>B2</del></td></tr>
<tr><td><ins>B1</ins></td><td><ins>B2</ins></td></tr></tbody></table>`);
    // only two cells in the last row, but normalization will handle this.
  });

  it("should match identical, merge mergeable & flag differences", () => {
    const mergedMarkup = mergeConflicts(
        `<ul>
<li>first</li>
<li>second</li>
<li>third</li>
<li>fourth</li>
<li>fifth</li>
<li>sixth</li>
<li>seventh</li>
<li>eighth</li>
<li>ninth</li>
</ul>`,
        `<ul>
<li><p>erste</p></li>
<li><p>zwitte</p></li>
<li>dritte</li>
<li>vierte</li>
<li><pre>fifth</pre></li>
<li>sixth</li>
<li><blockquote>seventh</blockquote></li>
<li>achte</li>
<li><img src="https://example.com/pic" alt="neunter"></li>
</ul>`
    );
    expect(mergedMarkup).toEqual(serializeHtml(deserializeHtml(`<ul>
<li><del>first</del></li>
<li><del>second</del></li>
<li><p><ins>erste</ins></p></li>
<li><p><ins>zwitte</ins></p></li>
<li><del>third</del><ins>dritte</ins></li>
<li><del>fourth</del><ins>vierte</ins></li>
<li><del>fifth</del></li>
<li><pre><ins>fifth</ins></pre></li>
<li>sixth</li>
<li><del>seventh</del></li>
<li><blockquote><ins>seventh</ins></blockquote></li>
<li><del>eighth</del><ins>achte</ins></li>
<li><del>ninth</del></li>
<li><img src="https://example.com/pic" alt="neunter"></li>
</ul>`)));
  });

  it("should align after equal nodes", () => {
    const mergedMarkup = mergeConflicts(
        `
<blockquote>first</blockquote>
<blockquote>second</blockquote>
<blockquote>third</blockquote>
<blockquote>fourth</blockquote>
<blockquote>fifth</blockquote>
<blockquote>sixth</blockquote>
`,
        `
<blockquote><p>noch ein</p></blockquote>
<blockquote><p>noch zwei</p></blockquote>
<blockquote><p>noch drei</p></blockquote>
<blockquote><p>noch vier</p></blockquote>
<blockquote><p>noch funf</p></blockquote>
<blockquote>first</blockquote>
<blockquote>zwitte</blockquote>
<blockquote>dritte</blockquote>
<blockquote>vierte</blockquote>
<blockquote><pre>fifth</pre></blockquote>
<blockquote>sixth</blockquote>
`
    );
    expect(mergedMarkup).toEqual(serializeHtml(deserializeHtml(`
<blockquote><p><ins>noch ein</ins></p></blockquote>
<blockquote><p><ins>noch zwei</ins></p></blockquote>
<blockquote><p><ins>noch drei</ins></p></blockquote>
<blockquote><p><ins>noch vier</ins></p></blockquote>
<blockquote><p><ins>noch funf</ins></p></blockquote>
<blockquote>first</blockquote>
<blockquote><del>second</del><ins>zwitte</ins></blockquote>
<blockquote><del>third</del><ins>dritte</ins></blockquote>
<blockquote><del>fourth</del><ins>vierte</ins></blockquote>
<blockquote><del>fifth</del></blockquote>
<blockquote><pre><ins>fifth</ins></pre></blockquote>
<blockquote>sixth</blockquote>
`)));
  });

  it.skip("should merge SVG changes into legal SVG", () => {
    const markupSvg2 = `<svg width="120" height="240" version="1.1" xmlns="http://www.w3.org/2000/svg">
  <defs>
      <linearGradient id="Gradient1">
        <stop class="stop1" offset="0%"/>
        <stop class="stop2" offset="50%"/>
        <stop class="stop3" offset="100%"/>
      </linearGradient>
      <linearGradient id="Gradient2" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="red"/>
        <stop offset="60%" stop-color="black" stop-opacity="0"/>
        <stop offset="100%" stop-color="blue"/>
      </linearGradient>
      <style type="text/css"><![CDATA[
        #rect1 { fill: url(#Gradient1); }
        .stop1 { stop-color: red; }
        .stop2 { stop-color: green; stop-opacity: 0.2; }
        .stop3 { stop-color: blue; }
      ]]></style>
  </defs>

  <rect id="rect1" x="10" y="10" rx="15" ry="15" width="100" height="100"/>
  <rect x="10" y="120" rx="15" ry="20" width="100" height="100" fill="url(#Gradient1)"/>

</svg>`;

    const mergedMarkup = mergeConflicts(markupSvg, markupSvg2);

    expect(mergedMarkup).toEqual(`<svg width="120" height="240" version="1.1" xmlns="http://www.w3.org/2000/svg">
  <defs>
      <lineargradient id="Gradient1">
        <stop class="stop1" offset="0%" />
        <stop class="stop2" offset="50%" />
        <stop class="stop3" offset="100%" />
      </lineargradient>
      <lineargradient id="Gradient2" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="red" />
        <stop offset="50%" stop-color="black" stop-opacity="0" /><stop offset="60%" stop-color="black" stop-opacity="0" />
        <stop offset="100%" stop-color="blue" />
      </lineargradient>
      <style type="text/css"><del><![CDATA[
        #rect1 { fill: url(#Gradient1); }
        .stop1 { stop-color: red; }
        .stop2 { stop-color: black; stop-opacity: 0; }
        .stop3 { stop-color: blue; }
      ]]></del><ins><![CDATA[
        #rect1 { fill: url(#Gradient1); }
        .stop1 { stop-color: red; }
        .stop2 { stop-color: green; stop-opacity: 0.2; }
        .stop3 { stop-color: blue; }
      ]]></ins></style>
  </defs>

  <rect id="rect1" x="10" y="10" rx="15" ry="15" width="100" height="100" />
  <rect x="10" y="120" rx="15" ry="15" width="100" height="100" fill="url(#Gradient2)" /><rect x="10" y="120" rx="15" ry="20" width="100" height="100" fill="url(#Gradient1)" />

</svg>`);
  });
});


// utility to streamline most tests
function mergeConflicts(markup1, markup2, subtype1 = 'html', subtype2) {
  const id = generateTestId();
  const mimeType1 = `text/${subtype1}`;
  const mimeType2 = `text/${subtype2 ?? subtype1}`;
  const date = new Date();
  const note1 = new SerializedNote(id, mimeType1, 'title1', markup1, date, false, []);
  const note2 = new SerializedNote(id, mimeType2, 'title2', markup2, date, false, []);
  const mergedNote = mergeNotes(note1, note2);
  return mergedNote.content;
}
