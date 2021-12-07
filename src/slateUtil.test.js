// Copyright © 2021 Doug Reeder under the MIT License

import {changeContentType, getRelevantBlockType} from "./slateUtil";
import {createEditor} from 'slate'
import {withHtml} from "./slateHtml";
import {withReact} from "slate-react";
import auto from "fake-indexeddb/auto.js";
import {getNote, init} from "./storage";
import generateTestId from "./util/generateTestId";

describe("getTextBlockStyle", () => {
  it("should return containing block for simple tree", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      { type: "paragraph",
        children: [
          {text: "first paragraph"}
        ]},
      { type: "quote",
        children: [
          {text: "second paragraph"}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 6 },
      focus:  { path: [1, 0], offset: 6 },
    };

    const type = getRelevantBlockType(editor);

    expect(type).toEqual('quote');
  });

  it("should return numbered-list for a list-item", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      { type: "numbered-list", children: [
        {type: "list-item", children: [
            {text: "first item"}
        ]},
        {type: "list-item", children: [
            {text: "second item"}
        ]},
        {type: "list-item", children: [
            {text: "third item"}
        ]},
      ]},
    ];
    editor.selection = {
      anchor: { path: [0, 1], offset: 6 },
      focus:  { path: [0, 1], offset: 6 },
    };

    const type = getRelevantBlockType(editor);

    expect(type).toEqual('numbered-list');
  });

  // it("should return numbered-list for a list-item in a list in a block quote", () => {
  //   const editor = withHtml(withReact(createEditor()));
  //   editor.children = [
  //     { type: "quote", children: [
  //         { type: "numbered-list", children: [
  //             {type: "list-item", children: [
  //                 {text: "first item"}
  //               ]},
  //             {type: "list-item", children: [
  //                 {text: "second item"}
  //               ]},
  //             {type: "list-item", children: [
  //                 {text: "third item"}
  //               ]},
  //           ]},
  //       ]},
  //   ];
  //   editor.selection = {
  //     anchor: { path: [0, 0, 1], offset: 6 },
  //     focus:  { path: [0, 0, 1], offset: 6 },
  //   };
  //
  //   const type = getRelevantBlockType(editor);
  //
  //   expect(type).toEqual('numbered-list');
  // });
});

describe("changeContentType", () => {
  beforeAll(() => {
    return init("testStorageDb");
  });

  it("should convert untyped to HTML paragraphs", async () => {
    const id = generateTestId();
    const noteDate = new Date(2001, 11, 31);
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {children: [
          {text: "prima linea text"}
        ]},
      {children: [
          {text: "secundo linea textu"}
        ]},
      {children: [
          {text: `Non-semantic tag: <b>bold</b> "Mike's & mine"`}
        ]},
    ];

    const newSubtype = 'html;hint=SEMANTIC';
    await changeContentType(editor, undefined, newSubtype, id, noteDate);

    const retrieved = await getNote(id);
    expect(retrieved.content).toMatch(/<p>prima linea text<\/p>\s*<p>secundo linea textu<\/p>\s*<p>Non-semantic tag: &lt;b&gt;bold&lt;\/b&gt; &quot;Mike&apos;s &amp; mine&quot;<\/p>/);
    expect(retrieved.title).toEqual("prima linea text\nsecundo linea textu");
    expect(retrieved.date).toEqual(noteDate);
    expect(retrieved.mimeType).toEqual('text/' + newSubtype);
  });

  it("should convert Markdown markup to HTML markup", async () => {
    const id = generateTestId();
    const noteDate = new Date(2002, 11, 31);
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {children: [
          {text: "> Quotable dialog"}
        ]},
      {children: [
          {text: "# Review of *Epic Movie*"}
        ]},
      {children: [
          {text: "1. Acting uneven"}
        ]},
    ];

    const newSubtype = 'html;hint=SEMANTIC';
    await changeContentType(editor, 'markdown;hint=COMMONMARK', newSubtype, id, noteDate);

    const retrieved = await getNote(id);
    expect(retrieved.content).toMatch(/<blockquote>\s*<p>Quotable dialog<\/p>\s*<\/blockquote>\s*<h1>Review of <em>Epic Movie<\/em><\/h1>\s*<ol>\s*<li>Acting uneven<\/li>\s*<\/ol>/);
    expect(retrieved.title).toEqual("Review of Epic Movie\nQuotable dialog");
    expect(retrieved.date).toEqual(noteDate);
    expect(retrieved.mimeType).toEqual('text/' + newSubtype);
  });


  it("should convert untyped to Markdown", async () => {
    const id = generateTestId();
    const noteDate = new Date(2003, 11, 31);
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {children: [
          {text: "erste Textzeile"}
        ]},
      {children: [
          {text: "zweite Textzeile"}
        ]},
    ];

    const newSubtype = 'markdown;hint=COMMONMARK';
    await changeContentType(editor, undefined, newSubtype, id, noteDate);

    const retrieved = await getNote(id);
    expect(retrieved.content).toEqual("erste Textzeile\nzweite Textzeile");
    expect(retrieved.title).toEqual("erste Textzeile\nzweite Textzeile");
    expect(retrieved.date).toEqual(noteDate);
    expect(retrieved.mimeType).toEqual('text/' + newSubtype);
  });

  it("should convert HTML markup to Markdown markup", async () => {
    const id = generateTestId();
    const noteDate = new Date(2003, 11, 31);
    const oldSubtype = 'html;hint=SEMANTIC';
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'quote', children: [
          {text: "Something to lure you in"}
        ]},
      {type: 'heading-two', children: [
          {text: "A "},
          {text: "Dramatic", italic: true},
          {text: " Article Title"}
        ]},
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [
              {text: "First point"},
            ]},
          {type: 'list-item', children: [
              {text: "Second", bold: true},
              {text: " point"},
            ]},
        ]},
    ];

    const newSubtype = 'markdown;hint=COMMONMARK';
    await changeContentType(editor, oldSubtype, newSubtype, id, noteDate);

    const retrieved = await getNote(id);
    expect(retrieved.content).toMatch(/> Something to lure you in/);
    expect(retrieved.content).toMatch(/## A \*Dramatic\* Article Title/);
    expect(retrieved.content).toMatch(/1. First point/);
    expect(retrieved.content).toMatch(/1. \*\*Second\*\* point/);
    expect(retrieved.title).toMatch(/^> Something to lure you in/);
    expect(retrieved.title).toMatch(/## A \*Dramatic\* Article Title/);
    expect(retrieved.date).toEqual(noteDate);
    expect(retrieved.mimeType).toEqual('text/' + newSubtype);
  });


  it("should convert CSV to plain text without altering content", async () => {
    const id = generateTestId();
    const noteDate = new Date(2002, 11, 31);
    const oldSubtype = 'csv';
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {children: [
          {text: "42,ABC,3.14159"}
        ]},
      {children: [
          {text: "hut 1, hut2, hike!"}
        ]},
      {children: [
          {text: ",,"}
        ]},
    ];

    const newSubtype = 'plain';
    await changeContentType(editor, oldSubtype, newSubtype, id, noteDate);

    const retrieved = await getNote(id);
    expect(retrieved.content).toEqual(`42,ABC,3.14159
hut 1, hut2, hike!
,,`);
    expect(retrieved.title).toMatch(/^42,ABC,3.14159/);
    expect(retrieved.title).toMatch(/hut 1, hut2, hike!/);
    expect(retrieved.date).toEqual(noteDate);
    expect(retrieved.mimeType).toEqual('text/' + newSubtype);
  });

  it("should convert Markdown to plain text & remove markup", async () => {
    const id = generateTestId();
    const noteDate = new Date(2002, 11, 31);
    const oldSubtype = 'markdown;hint=COMMONMARK';
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {children: [
          {text: "> Quotable dialog"}
        ]},
      {children: [
          {text: "# Review of *Epic Movie*"}
        ]},
      {children: [
          {text: "1. Acting uneven"}
        ]},
      {children: [
          {text: ""}
        ]},
      {children: [
          {text: "    Separate paragraph of first item"}
        ]},
      {children: [
          {text: ""}
        ]},
      {children: [
          {text: '![General Electric Big Blow](/path/to/train.jpg  "in UP colors" )'}
        ]},
    ];


    const newSubtype = 'plain';
    await changeContentType(editor, oldSubtype, newSubtype, id, noteDate);

    const retrieved = await getNote(id);
    expect(retrieved.content).toEqual(`Quotable dialog
Review of Epic Movie
Acting unevenSeparate paragraph of first item
General Electric Big Blow`)
    expect(retrieved.title).toMatch(/Quotable dialog/);
    expect(retrieved.title).toMatch(/Review of Epic Movie/);
    expect(retrieved.date).toEqual(noteDate);
    expect(retrieved.mimeType).toEqual('text/' + newSubtype);
  });

  it("should convert HTML to plain text and remove markup", async () => {
    const id = generateTestId();
    const noteDate = new Date(2003, 11, 31);
    const oldSubtype = 'html;hint=SEMANTIC';
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'quote', children: [
          {text: "Something to lure you in"}
        ]},
      {type: 'heading-two', children: [
          {text: "A "},
          {text: "Dramatic", italic: true},
          {text: " Article Title"}
        ]},
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [
              {text: "First", bold: true},
              {text: " point"},
            ]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [
                  {text: "Second point"},
                ]},
              {type: 'paragraph', children: [
                  {text: "Another paragraph in second point"},
                ]},
            ]},
        ]},
      {type: 'image', url: "https://example.com/picture",
        title: "Mt. Hood",
        children: [{text: "A landscape of Mt. Hood"}]},
      {type: 'image', url: "https://example.com/pic",
        title: "Misato",
        children: [{text: ""}]},
      {type: 'image', url: "https://example.com/portrait",
        children: [{text: ""}]},
      {type: 'image', url: "https://example.com/directory/",
        children: [{text: ""}]},
    ];

    const newSubtype = 'plain';
    await changeContentType(editor, oldSubtype, newSubtype, id, noteDate);

    const retrieved = await getNote(id);
    expect(retrieved.content).toEqual(`Something to lure you in
A Dramatic Article Title
First point
Second point
Another paragraph in second point
A landscape of Mt. Hood
Misato
portrait
☹︎`);
    expect(retrieved.title).toMatch(/^Something to lure you in/);
    expect(retrieved.title).toMatch(/A Dramatic Article Title/);
    expect(retrieved.date).toEqual(noteDate);
    expect(retrieved.mimeType).toEqual('text/' + newSubtype);
  });
});
