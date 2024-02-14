// serializeNote.test.js - automated tests for subroutine for Notes module for RemoteStorage
// Copyright © 2023–2024 Doug Reeder

import generateTestId from "./util/generateTestId";
import {deserializeNote, serializeNote} from "./serializeNote";
import {CONTENT_MAX, NodeNote} from "./Note";
import {withHtml} from "./slateHtmlPlugin.js";
import {withReact} from "slate-react";
import {createEditor} from "slate";
import {validate as uuidValidate} from "uuid";


describe("serializeNote", () => {
  it("should handle empty array and pass through id, date and isLocked", async () => {
    const id = generateTestId();
    const subtype = 'html;hint=SEMANTIC';
    const slateNodes = [];
    const date = new Date('2014-04-15T13:47');
    const isLocked = true;
    const nodeNote = new NodeNote(id, subtype, slateNodes, date, isLocked);

    const serializedNote = await serializeNote(nodeNote);

    expect(serializedNote.id).toEqual(id);
    expect(serializedNote.mimeType).toEqual('text/html;hint=SEMANTIC');
    expect(serializedNote.title).toEqual('');
    expect(serializedNote.content).toEqual('');
    expect(serializedNote.wordArr.length).toEqual(0);
    expect(serializedNote.date).toEqual(date);
    expect(serializedNote.isLocked).toEqual(isLocked);
  });

  it("should construct MIME type", async () => {
    const subtype = 'csv';
    const slateNodes = [];

    const nodeNote = new NodeNote(generateTestId(), subtype, slateNodes, new Date, false);

    const serializedNote = await serializeNote(nodeNote);

    expect(serializedNote.mimeType).toEqual('text/csv')
  });

  it("should leave MIME type empty if subtype empty", async () => {
    const subtype = '';
    const slateNodes = [];

    const nodeNote = new NodeNote(generateTestId(), subtype, slateNodes, new Date, false);

    const serializedNote = await serializeNote(nodeNote);

    expect(serializedNote.mimeType).toEqual('')
  });

  it("should, from HTML note, extract title from headings, serialize content & extract minimal keywords", async () => {
    const subtype = 'html;hint=SEMANTIC';
    const slateNodes = [
      {type: 'heading-two', children: [{text: "A Sequence List"}]},
      {type: 'sequence-list', children: [
          {type: 'list-item', checked: false, children: [{text: "plain"}, {text: "bold more", bold: true}]},
          {type: 'list-item', checked: true, children: [{text: ""}]},
        ]},
      {type: 'heading-one', children: [{text: "The Overall Title"}]},
      {type: 'heading-two', children: [{text: "appendix"}]},
    ];

    const nodeNote = new NodeNote(generateTestId(), subtype, slateNodes, new Date, true);

    const serializedNote = await serializeNote(nodeNote);

    expect(serializedNote.mimeType).toEqual('text/' + subtype);
    expect(serializedNote.title).toEqual('The Overall Title');
    expect(serializedNote.content).toEqual('<h2>A Sequence List</h2><ol><li><input type="checkbox"/>plain<strong>bold more</strong></li><li><input type="checkbox" checked/></li></ol><h1>The Overall Title</h1><h2>appendix</h2>');
    expect(serializedNote.wordArr).not.toContain("A");
    expect(serializedNote.wordArr).toContain("APPENDIX");
    expect(serializedNote.wordArr).toContain("SEQUENCE");
    expect(serializedNote.wordArr).toContain("LIST");
    expect(serializedNote.wordArr).toContain("PLAINBOLD");
    expect(serializedNote.wordArr).toContain("MORE");
    expect(serializedNote.wordArr).toContain("THE");
    expect(serializedNote.wordArr).toContain("OVERALL");
    expect(serializedNote.wordArr).toContain("TITLE");
    expect(serializedNote.wordArr.length).toEqual(8);
  });

  it("should, from HTML note, extract title ignoring blank elements", async () => {
    const subtype = 'html;hint=SEMANTIC';
    const slateNodes = [
      {type: 'heading-two', children: [{text: ""}]},
      {type: 'paragraph', children: [{text: "  paragraph text  "}]},
      {type: 'heading-two', children: [{text: "   "}]},
    ];

    const nodeNote = new NodeNote(generateTestId(), subtype, slateNodes, new Date, false);

    const serializedNote = await serializeNote(nodeNote);

    expect(serializedNote.mimeType).toEqual('text/html;hint=SEMANTIC');
    expect(serializedNote.title).toEqual('paragraph text');
    expect(serializedNote.content).toEqual('<h2></h2><p>  paragraph text  </p><h2>   </h2>');
    expect(serializedNote.wordArr).toContain("PARAGRAPH");
    expect(serializedNote.wordArr).toContain("TEXT");
    expect(serializedNote.wordArr.length).toEqual(2);
  });

  it("should, if no headings in HTML note, extract title from paragraphs, serialize content & extract minimal keywords", async () => {
    const subtype = 'html;hint=SEMANTIC';
    const slateNodes = [
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "first"}]},
          {type: 'list-item', children: [{text: "second"}]},
        ]},
      {type: 'paragraph', children: [{text: "an x"}, {text: "2", superscript: true}, {text: " equation"}, ]},
      {type: 'code', children: [{text: "const annual = 42"}]},
      {type: 'paragraph', children: [
          {text: ""},
          {type: 'link', url: 'https://example.com', title: "link title", children: [{text: "link text"}]},
          {text: ""},
        ]},
    ];

    const nodeNote = new NodeNote(generateTestId(), subtype, slateNodes, new Date, true);

    const serializedNote = await serializeNote(nodeNote);

    expect(serializedNote.mimeType).toEqual('text/html;hint=SEMANTIC');
    expect(serializedNote.title).toEqual('an x2 equation\nlink text');
    expect(serializedNote.content).toEqual('<ul><li>first</li><li>second</li></ul><p>an x<sup>2</sup> equation</p><pre><code>const annual = 42</code></pre><p><a href="https://example.com" title="link title">link text</a></p>');
    expect(serializedNote.wordArr).toContain("FIRST");
    expect(serializedNote.wordArr).toContain("SECOND");
    expect(serializedNote.wordArr).not.toContain("AN");
    expect(serializedNote.wordArr).toContain("ANNUAL");
    expect(serializedNote.wordArr).toContain("X2");
    expect(serializedNote.wordArr).toContain("EQUATION");
    expect(serializedNote.wordArr).toContain("CONST");
    expect(serializedNote.wordArr).toContain("42");
    expect(serializedNote.wordArr).toContain("LINK");
    expect(serializedNote.wordArr).toContain("TEXT");
    expect(serializedNote.wordArr).not.toContain("TITLE");
    expect(serializedNote.wordArr.length).toEqual(9);
  });

  it("should, if no paragraphs in HTML note, extract title from list items & quotes, serialize content & extract keywords", async () => {
    const subtype = 'html;hint=SEMANTIC';
    const slateNodes = [
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "one"}]},
        ]},
      {type: 'quote', children: [{text: "famous q"}, {text: "uot", underline: true}, {text: "e"}]},
      {type: 'code', children: [{text: "tabular"}]},
      {type: 'quote', children: [{text: "indented"}]},
    ];

    const nodeNote = new NodeNote(generateTestId(), subtype, slateNodes, new Date, true);

    const serializedNote = await serializeNote(nodeNote);

    expect(serializedNote.mimeType).toEqual('text/html;hint=SEMANTIC');
    expect(serializedNote.title).toEqual('• one\nfamous quote');
    expect(serializedNote.content).toEqual('<ol><li>one</li></ol><blockquote>famous q<u>uot</u>e</blockquote><pre><code>tabular</code></pre><blockquote>indented</blockquote>');
    expect(serializedNote.wordArr).toContain("ONE");
    expect(serializedNote.wordArr).toContain("FAMOUS");
    expect(serializedNote.wordArr).toContain("QUOTE");
    expect(serializedNote.wordArr).toContain("TABULAR");
    expect(serializedNote.wordArr).toContain("INDENTED");
    expect(serializedNote.wordArr.length).toEqual(5);
  });

  it("should, if no paragraphs in HTML note, extract title from tables & code, serialize content & extract keywords", async () => {
    const slateNodes = [
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: " lone "}]},
            ]},
        ]},
      {type: 'code', children: [{text: " let x = 42 "}]},
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: " siete "}]},
        ]},
    ];
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = slateNodes;
    editor.selection = null;

    const nodeNote = new NodeNote(generateTestId(), editor.subtype, editor.children, new Date, false);

    const serializedNote = await serializeNote(nodeNote);

    expect(serializedNote.mimeType).toEqual('text/html;hint=SEMANTIC');
    expect(serializedNote.title).toEqual('lone\nlet x = 42');
    expect(serializedNote.content).toEqual('<table><tbody><tr><td> lone </td></tr></tbody></table><pre><code> let x = 42 </code></pre><ol><li> siete </li></ol>');
    expect(serializedNote.wordArr).toContain("SIETE");
    expect(serializedNote.wordArr).toContain("LONE");
    expect(serializedNote.wordArr).toContain("LET");
    expect(serializedNote.wordArr).toContain("X");
    expect(serializedNote.wordArr).toContain("42");
    expect(serializedNote.wordArr.length).toEqual(5);
  });

  it("should, from Markdown note, extract title from incipit, assemble content & extract minimal keywords", async () => {
    const subtype = 'markdown;hint=COMMONMARK';
    const slateNodes = [
      {type: 'paragraph', children: [{text: "Markdown: Syntax"}], noteSubtype: subtype},
      {type: 'paragraph', children: [{text: "================"}]},
      {type: 'paragraph', children: [{text: `Markdown's syntax has been influenced by 
several existing text-to-HTML filters -- 
including [Setext][1], [atx][2] --- 
the single biggest source of inspiration for Markdown's syntax is the format of plain text email.`}]},
      {type: 'paragraph', children: [{text: ""}]},
      {type: 'paragraph', children: [{text: "[1]: https://docutils.sourceforge.net/mirror/setext.html"}]},
      {type: 'paragraph', children: [{text: "[2]: http://www.aaronsw.com/2002/atx/"}]},
    ];
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = subtype;
    editor.children = slateNodes;
    editor.selection = null;
    const nodeNote = new NodeNote(generateTestId(), editor.subtype, editor.children, new Date, true);

    const serializedNote = await serializeNote(nodeNote);

    expect(serializedNote.mimeType).toEqual('text/' + subtype);
    expect(serializedNote.title).toEqual('Markdown: Syntax\nMarkdown\'s syntax has been influenced by');
    expect(serializedNote.content).toEqual(`Markdown: Syntax
================
Markdown's syntax has been influenced by 
several existing text-to-HTML filters -- 
including [Setext][1], [atx][2] --- 
the single biggest source of inspiration for Markdown's syntax is the format of plain text email.

[1]: https://docutils.sourceforge.net/mirror/setext.html
[2]: http://www.aaronsw.com/2002/atx/`);
    expect(serializedNote.wordArr).not.toContain("MARKDOWN");
    expect(serializedNote.wordArr).toContain("MARKDOWN'S");
    expect(serializedNote.wordArr).toContain("SYNTAX");
    expect(serializedNote.wordArr).toContain("BEEN");
    expect(serializedNote.wordArr).toContain("INFLUENCED");
    expect(serializedNote.wordArr).toContain("SEVERAL");
    expect(serializedNote.wordArr).toContain("SETEXTHTML");
    expect(serializedNote.wordArr).toContain("1");
    expect(serializedNote.wordArr).not.toContain("2");
    expect(serializedNote.wordArr).toContain("2002");
    expect(serializedNote.wordArr).toContain("HTTPS");
    expect(serializedNote.wordArr).not.toContain("HTTP");
    expect(serializedNote.wordArr).toContain("DOCUTILSSOURCEFORGENET");
    expect(serializedNote.wordArr).toContain("WWWAARONSWCOM");

    expect(serializedNote.wordArr.length).toEqual(29);
  });

  it("should, from text note, extract title from incipit, assemble content & extract keywords", async () => {
    const subtype = 'plain';
    const slateNodes = [
      {type: 'paragraph', children: [{text: "    A12345678 B12345678 C12345678 D12345678"}], noteSubtype: subtype},
      {type: 'paragraph', children: [{text: "    E12345678 F12345678 G12345678 H12345678"}]},
      {type: 'paragraph', children: [{text: "    I12345678 J12345678 K12345678 L12345678"}]},
      {type: 'paragraph', children: [{text: "    M12345678 N12345678 O12345678 P12345678"}]},
    ];
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = subtype;
    editor.children = slateNodes;
    editor.selection = null;

    const nodeNote = new NodeNote(generateTestId(), editor.subtype, editor.children, new Date, true);

    const serializedNote = await serializeNote(nodeNote);

    expect(serializedNote.mimeType).toEqual('text/plain');
    expect(serializedNote.title).toEqual('A12345678 B12345678 C12345678 D12345678\nE12345678 F12345678 G12345678 H12345678');
    expect(serializedNote.content).toEqual('    A12345678 B12345678 C12345678 D12345678\n    E12345678 F12345678 G12345678 H12345678\n    I12345678 J12345678 K12345678 L12345678\n    M12345678 N12345678 O12345678 P12345678');
    expect(serializedNote.wordArr).toContain("A12345678");
    expect(serializedNote.wordArr).toContain("B12345678");
    expect(serializedNote.wordArr).toContain("C12345678");
    expect(serializedNote.wordArr).toContain("D12345678");
    expect(serializedNote.wordArr).toContain("E12345678");
    expect(serializedNote.wordArr).toContain("L12345678");
    expect(serializedNote.wordArr).toContain("P12345678");
    expect(serializedNote.wordArr.length).toEqual(16);
  });

  it(`should reject an HTML note longer than ${CONTENT_MAX} characters`, async () => {
    const nodes = [];
    for (let i = 0; i < 100; ++i) {
      const text = "b".repeat(CONTENT_MAX / 100);
      nodes.push({type: 'paragraph', children: [{text}]});
    }
    const nodeNote = new NodeNote(generateTestId(), 'html;hint=SEMANTIC', nodes, new Date(), false);

    await expect(serializeNote(nodeNote)).rejects.toThrow("too long");
  });

  it(`should reject a text note longer than ${CONTENT_MAX / 10} characters`, async () => {
    const nodes = [];
    for (let i = 0; i < 100; ++i) {
      const text = "c".repeat(CONTENT_MAX / 10 / 100);
      nodes.push({type: 'paragraph', children: [{text}]});
    }
    const nodeNote = new NodeNote(generateTestId(), 'plain', nodes, new Date(), false);

    await expect(serializeNote(nodeNote)).rejects.toThrow("too long");
  });
});


describe("deserializeNote", () => {
  it("should throw error when passed non-object", () => {
    expect(() => {deserializeNote(undefined)}).toThrow();
  });

  it("should handle a note object with no fields", () => {
    const remoteNote = {};

    const nodeNote = deserializeNote(remoteNote);

    expect(uuidValidate(nodeNote.id)).toBeTruthy();
    expect(nodeNote.subtype).toEqual('');
    expect(nodeNote.nodes).toEqual([
      {type: 'paragraph', children: [{text: ''}]}
    ]);
    expect(Date.now() - nodeNote.date).toBeLessThan(1000);
    expect(nodeNote.isLocked).toEqual(false);
  });

  it("should deserialize an HTML note as rich text", () => {
    const remoteNote = {
      id: generateTestId(),
      mimeType: 'text/html;hint=SEMANTIC',
      title: `Ut sed nulla justo.`,
      content: `<h1> In ut condimentum risus, <b> ac semper velit. </b></h1><p> Suspendisse dapibus sit amet lacus sed ornare. </p>`,
      date: new Date(1800, 0, 1).toISOString(),
      isLocked: true,
      '@context': "http://remotestorage.io/spec/modules/documents/note"
    };

    const nodeNote = deserializeNote(remoteNote);

    expect(nodeNote.id).toEqual(remoteNote.id);
    expect(nodeNote.subtype).toEqual('html;hint=SEMANTIC');
    expect(nodeNote.nodes).toEqual([
      {type: 'heading-one', children: [{text: ' In ut condimentum risus, '}, {text: ' ac semper velit. ', bold: true}]},
      {type: 'paragraph', children: [{text: ' Suspendisse dapibus sit amet lacus sed ornare. '}]}
    ]);
    expect(nodeNote.date).toEqual(new Date(remoteNote.date));
    expect(nodeNote.isLocked).toEqual(remoteNote.isLocked);
  });

  it("should deserialize an XHTML note as rich text", () => {
    const remoteNote = {
      id: generateTestId(),
      mimeType: 'application/xhtml+xml',
      title: 'XHTML',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en-US">
  <head>
    <title>XHTML</title>
  </head>
  <body>
    <p>I am a XHTML document</p>
  </body>
</html>`,
      '@context': "http://remotestorage.io/spec/modules/documents/note"
    };

    const nodeNote = deserializeNote(remoteNote);

    expect(nodeNote.id).toEqual(remoteNote.id);
    expect(nodeNote.subtype).toEqual('html;hint=SEMANTIC');
    expect(nodeNote.nodes).toEqual([
      {type: 'heading-one', children: [{text: "XHTML"}]},
      {type: 'paragraph', children: [{text: 'I am a XHTML document'}]}
    ]);
    expect(Date.now() - nodeNote.date).toBeLessThan(1000);
    expect(nodeNote.isLocked).toEqual(Boolean(remoteNote.isLocked));
  });

  it("should deserialize a Markdown note (w/ string date) as Commonmark Markdown text", () => {
    const remoteNote = {
      id: generateTestId(),
      mimeType: 'text/markdown',
      title: `Donec finibus dignissim sem`,
      content: `Donec finibus dignissim sem
==================
  
* Donec suscipit libero *sed mollis* vulputate.
* Phasellus quis consequat sem, eu porta turpis.`,
      date: new Date(1802, 2, 3).toISOString(),
      isLocked: false,
      '@context': "http://remotestorage.io/spec/modules/documents/note"
    };

    const nodeNote = deserializeNote(remoteNote);

    expect(nodeNote.id).toEqual(remoteNote.id);
    expect(nodeNote.subtype).toEqual('markdown;hint=COMMONMARK');
    expect(nodeNote.nodes).toEqual([
      {type: 'paragraph', children: [{text: 'Donec finibus dignissim sem'}]},
      {type: 'paragraph', children: [{text: '=================='}]},
      {type: 'paragraph', children: [{text: '  '}]},
      {type: 'paragraph', children: [{text: '* Donec suscipit libero *sed mollis* vulputate.'}]},
      {type: 'paragraph', children: [{text: '* Phasellus quis consequat sem, eu porta turpis.'}]},
    ]);
    expect(nodeNote.date).toEqual(new Date(remoteNote.date));
    expect(nodeNote.isLocked).toEqual(remoteNote.isLocked);
  });

  it("should deserialize a plain text note (w/ Date date) as plain text", () => {
    const idbNote = {
      id: generateTestId(),
      mimeType: 'text/plain',
      title: `Vivamus semper neque vel mauris vulputate`,
      content: `  Vivamus semper neque vel mauris vulputate, 
quis dapibus massa varius. 
Suspendisse ex nunc, tincidunt vel tempor ut, vehicula mattis erat.`,
      date: new Date(1997, 9, 21),
      isLocked: true,
      '@context': "http://remotestorage.io/spec/modules/documents/note"
    };

    const nodeNote = deserializeNote(idbNote);

    expect(nodeNote.id).toEqual(idbNote.id);
    expect(nodeNote.subtype).toEqual('plain');
    expect(nodeNote.nodes).toEqual([
      {type: 'paragraph', children: [{text: '  Vivamus semper neque vel mauris vulputate, '}]},
      {type: 'paragraph', children: [{text: 'quis dapibus massa varius. '}]},
      {type: 'paragraph', children: [{text: 'Suspendisse ex nunc, tincidunt vel tempor ut, vehicula mattis erat.'}]},
    ]);
    expect(nodeNote.date).toEqual(idbNote.date);
    expect(nodeNote.isLocked).toEqual(Boolean(idbNote.isLocked));
  });

  it("should deserialize a Litewrite note as plain text", () => {
    const date = new Date(1986, 5, 10);
    const remoteNote = {
      id: generateTestId(),
      title: `Vestibulum ullamcorper ornare fermentum.`,
      content: `  Vestibulum ullamcorper ornare fermentum.
Integer accumsan risus lacus, sed scelerisque augue mollis in. Quisque tincidunt ipsum sed rhoncus convallis. Praesent tempus erat posuere urna convallis, sed rhoncus tortor pretium.  
Suspendisse et ornare lectus.`,
      lastEdited: date.valueOf(),
      public: null,
      cursorPos: 14,
      '@context': "http://remotestorage.io/spec/modules/documents/note"
    };

    const nodeNote = deserializeNote(remoteNote);

    expect(nodeNote.id).toEqual(remoteNote.id);
    expect(nodeNote.subtype).toEqual('');
    expect(nodeNote.nodes).toEqual([
      {type: 'paragraph', children: [{text: '  Vestibulum ullamcorper ornare fermentum.'}]},
      {type: 'paragraph', children: [{text: 'Integer accumsan risus lacus, sed scelerisque augue mollis in. Quisque tincidunt ipsum sed rhoncus convallis. Praesent tempus erat posuere urna convallis, sed rhoncus tortor pretium.  '}]},
      {type: 'paragraph', children: [{text: 'Suspendisse et ornare lectus.'}]},
    ]);
    expect(nodeNote.date).toEqual(date);
    expect(nodeNote.isLocked).toEqual(Boolean(remoteNote.isLocked));
  });

  it("should deserialize a CSV note as CSV (plain) text", () => {
    const remoteNote = {
      id: generateTestId(),
      mimeType: 'text/csv',
      title: `Application,Report For\nOutline Tracker (2.2.8),7/12/2011 to 7/31/2011`,
      content: `Application,Report For
Outline Tracker (2.2.8),7/12/2011 to 7/31/2011

Day,Total Downloads,Updates/Restores,Total App Sales,Credit Cards,Operator Billing,HP Promo,Your Promo,Failed Transactions
2011-07-12,6,6,0,0,,0,0
2011-07-13,5,4,0,0,,0,1
2011-07-14,2,1,0,0,,0,1`,
      date: new Date(1804, 4, 5).toISOString(),
      isLocked: true,
      '@context': "http://remotestorage.io/spec/modules/documents/note"
    };

    const nodeNote = deserializeNote(remoteNote);

    expect(nodeNote.id).toEqual(remoteNote.id);
    expect(nodeNote.subtype).toEqual('csv');
    expect(nodeNote.nodes).toEqual([
      {type: 'paragraph', children: [{text: 'Application,Report For'}]},
      {type: 'paragraph', children: [{text: 'Outline Tracker (2.2.8),7/12/2011 to 7/31/2011'}]},
      {type: 'paragraph', children: [{text: ''}]},
      {type: 'paragraph', children: [{text: 'Day,Total Downloads,Updates/Restores,Total App Sales,Credit Cards,Operator Billing,HP Promo,Your Promo,Failed Transactions'}]},
      {type: 'paragraph', children: [{text: '2011-07-12,6,6,0,0,,0,0'}]},
      {type: 'paragraph', children: [{text: '2011-07-13,5,4,0,0,,0,1'}]},
      {type: 'paragraph', children: [{text: '2011-07-14,2,1,0,0,,0,1'}]},
    ]);
    expect(nodeNote.date).toEqual(new Date(remoteNote.date));
    expect(nodeNote.isLocked).toEqual(remoteNote.isLocked);
  });

});
