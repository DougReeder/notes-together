// Copyright © 2021 Doug Reeder under the MIT License

import {changeBlockType, changeContentType, getRelevantBlockType} from "./slateUtil";
import {createEditor, Transforms} from 'slate'
import {withHtml} from "./slateHtml";
import {withReact} from "slate-react";
import auto from "fake-indexeddb/auto.js";
import {init} from "./storage";

describe("getRelevantBlockType", () => {
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
      anchor: { path: [0, 1], offset: 3 },
      focus:  { path: [0, 1], offset: 8 },
    };

    const type = getRelevantBlockType(editor);

    expect(type).toEqual('numbered-list');
  });

  it("should return bulleted-list for a list-item in a list in a block quote", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      { type: "quote", children: [
          { type: "bulleted-list", children: [
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
        ]},
    ];
    editor.selection = {
      anchor: { path: [0, 0, 1], offset: 2 },
      focus:  { path: [0, 0, 1], offset: 9 },
    };

    const type = getRelevantBlockType(editor);

    expect(type).toEqual('bulleted-list');
  });

  it("should return image when selection wholly in image in table cell", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      { type: "quote", children: [
        {type: 'table', children: [
          {type: 'table-row', children: [
            {type: 'table-cell', isHeader: true, children: [
                {text: "Lorem ipsum dolor"},
              ]},
            {type: 'table-cell', isHeader: true, children: [
                {text: "sit amet, consectetur"},
              ]},
          ]},
          {type: 'table-row', children: [
            {type: 'table-cell', isHeader: true, children: [
                {text: "adipiscing elit"},
              ]},
            {type: 'table-cell', isHeader: false, children: [
                {type: 'image', url: 'https://storage.org/?q=cat',
                  title: "Cat of the day",
                  children: [{text: "a sleeping Persian"}]
                }
              ]},
          ]},
        ]},
      ]},
    ];
    editor.selection = {
      anchor: { path: [0, 0, 1, 1, 0, 0], offset: 1 },
      focus:  { path: [0, 0, 1, 1, 0, 0], offset: 14 },
    };

    const type = getRelevantBlockType(editor);

    expect(type).toEqual('image');
  });

  it("should return table when selection wholly in cell text", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      { type: "paragraph", children: [
          {type: 'table', children: [
              {type: 'table-row', children: [
                  {type: 'table-cell', isHeader: true, children: [
                      {text: "Lorem ipsum dolor"},
                    ]},
                  {type: 'table-cell', isHeader: true, children: [
                      {text: "sit amet, consectetur"},
                    ]},
                ]},
              {type: 'table-row', children: [
                  {type: 'table-cell', isHeader: true, children: [
                      {text: "adipiscing elit"},
                    ]},
                  {type: 'table-cell', isHeader: false, children: [
                      {type: 'image', url: 'https://storage.org/?q=cat',
                        title: "Cat of the day",
                        children: [{text: "a sleeping Persian"}]
                      }
                    ]},
                ]},
            ]},
        ]},
    ];
    editor.selection = {
      anchor: { path: [0, 0, 1, 0], offset: 1 },
      focus:  { path: [0, 0, 1, 0], offset: 12 },
    };

    const type = getRelevantBlockType(editor);

    expect(type).toEqual('table');
  });

  it("should return table when selection crosses from cell to cell", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      { type: "quote", children: [
          {type: 'table', children: [
              {type: 'table-row', children: [
                  {type: 'table-cell', isHeader: true, children: [
                      {text: "Lorem ipsum dolor"},
                    ]},
                  {type: 'table-cell', isHeader: true, children: [
                      {text: "sit amet, consectetur"},
                    ]},
                ]},
              {type: 'table-row', children: [
                  {type: 'table-cell', isHeader: true, children: [
                      {text: "adipiscing elit"},
                    ]},
                  {type: 'table-cell', isHeader: false, children: [
                      {type: 'image', url: 'https://storage.org/?q=cat',
                        title: "Cat of the day",
                        children: [{text: "a sleeping Persian"}]
                      }
                    ]},
                ]},
            ]},
        ]},
    ];
    editor.selection = {
      anchor: { path: [0, 0, 0, 0], offset: 5 },
      focus:  { path: [0, 0, 0, 1], offset: 10 },
    };

    const type = getRelevantBlockType(editor);

    expect(type).toEqual('table');
  });

  it("should return table when selection crosses from row to row", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      { type: "paragraph", children: [
          {type: 'table', children: [
              {type: 'table-row', children: [
                  {type: 'table-cell', isHeader: true, children: [
                      {text: "Lorem ipsum dolor"},
                    ]},
                  {type: 'table-cell', isHeader: true, children: [
                      {text: "sit amet, consectetur"},
                    ]},
                ]},
              {type: 'table-row', children: [
                  {type: 'table-cell', isHeader: true, children: [
                      {text: "adipiscing elit"},
                    ]},
                  {type: 'table-cell', isHeader: false, children: [
                      {type: 'image', url: 'https://storage.org/?q=cat',
                        title: "Cat of the day",
                        children: [{text: "a sleeping Persian"}]
                      }
                    ]},
                ]},
            ]},
        ]},
    ];
    editor.selection = {
      anchor: { path: [0, 0, 0, 1], offset: 15 },
      focus:  { path: [0, 0, 1, 0], offset: 4 },
    };

    const type = getRelevantBlockType(editor);

    expect(type).toEqual('table');
  });

  it("should return multiple when selection crosses from top-level heading to quote", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      { type: "heading-one", children: [
        {text: "Declaration of Independence"}
      ]},
      { type: "quote", children: [
        {text: "When, in the course of human events..."}
      ]},
    ];
    editor.selection = {
      anchor: { path: [0, 0], offset: 11 },
      focus:  { path: [1, 0], offset: 5 },
    };

    const type = getRelevantBlockType(editor);

    expect(type).toEqual('multiple');
  });
});

describe("changeBlockType", () => {
  it("should convert bulleted-list to numbered-list", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "first"}]},
          {type: 'list-item', children: [{text: "second"}]},
          {type: 'list-item', children: [{text: "third"}]},
        ]}
    ];
    Transforms.select(editor, []);

    changeBlockType(editor, 'numbered-list');

    expect(editor.children).toEqual([
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "first"}]},
          {type: 'list-item', children: [{text: "second"}]},
          {type: 'list-item', children: [{text: "third"}]},
        ]}
    ]);
  });
});

describe("changeContentType", () => {
  beforeAll(() => {
    return init("testStorageDb");
  });

  it("should convert untyped to HTML paragraphs", async () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {noteSubtype: "", type: 'paragraph', children: [
          {text: "prima linea text"}
        ]},
      {type: 'paragraph', children: [
          {text: "secundo linea textu"}
        ]},
      {type: 'paragraph', children: [
          {text: `Non-semantic tag: <b>bold</b> "Mike's & mine"`}
        ]},
    ];
    const newSubtype = 'html;hint=SEMANTIC';
    const expectedNodes = JSON.parse(JSON.stringify(editor.children));
    expectedNodes[0].noteSubtype = newSubtype;

    await changeContentType(editor, undefined, newSubtype);

    expect(editor.children).toEqual(expectedNodes);
    expect(editor.subtype).toEqual(newSubtype);
  });

  it("should convert Markdown markup to HTML markup", async () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {noteSubtype: "markdown", type: 'paragraph', children: [
          {text: "> Quotable dialog"}
        ]},
      {type: 'paragraph', children: [
          {text: "# Review of *Epic Movie*"}
        ]},
      {type: 'paragraph', children: [
          {text: "1. Acting uneven"}
        ]},
    ];

    const newSubtype = 'html;hint=SEMANTIC';
    await changeContentType(editor, 'markdown;hint=COMMONMARK', newSubtype);

    expect(editor.children[0]).toEqual(
      {noteSubtype: newSubtype, type: 'quote', children: [
          {type: 'paragraph', children: [{text: "Quotable dialog"}]},
        ]}
    );
    expect(editor.children[1]).toEqual({type: 'heading-one', children: [
        {text: "Review of "}, {italic: true, text: "Epic Movie"}
      ]});
    expect(editor.children[2]).toEqual({type: 'numbered-list', listStart: 1, children: [
        {type: 'list-item', children: [{text: "Acting uneven"}]}
      ]});
    expect(editor.subtype).toEqual(newSubtype);
  });


  it("should convert untyped to Markdown without altering content", async () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {noteSubtype: "", type: "paragraph", children: [
          {text: "erste Textzeile"}
        ]},
      {type: "paragraph", children: [
          {text: "zweite Textzeile"}
        ]},
    ];
    const expectedNodes = JSON.parse(JSON.stringify(editor.children));
    expectedNodes[0].noteSubtype = "markdown";

    const newSubtype = 'markdown';
    await changeContentType(editor, undefined, newSubtype);

    expect(editor.children).toEqual(expectedNodes);
    expect(editor.subtype).toEqual(newSubtype);
  });

  it("should convert HTML markup to Markdown markup", async () => {
    const oldSubtype = 'html;hint=SEMANTIC';
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {noteSubtype: oldSubtype, type: 'quote', children: [
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
    await changeContentType(editor, oldSubtype, newSubtype);

    expect(editor.children[0]).toEqual({noteSubtype: newSubtype, type: 'paragraph',
      children: [{text: "> Something to lure you in"}]});
    expect(editor.children[1]).toEqual({type: 'paragraph',
      children: [{text: "## A *Dramatic* Article Title"}]});
    expect(editor.children[2]).toEqual({type: 'paragraph',
      children: [{text: "    1. First point"}]});
    expect(editor.children[3]).toEqual({type: 'paragraph',
      children: [{text: "1. **Second** point"}]});
    expect(editor.subtype).toEqual(newSubtype);
  });


  it("should convert CSV to plain text without altering content", async () => {
    const oldSubtype = 'csv';
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {noteSubtype: "csv", type: 'paragraph', children: [
          {text: "42,ABC,3.14159"}
        ]},
      {type: 'paragraph', children: [
          {text: "hut 1, hut2, hike!"}
        ]},
      {type: 'paragraph', children: [
          {text: ",,"}
        ]},
    ];
    const expectedNodes = JSON.parse(JSON.stringify(editor.children));
    expectedNodes[0].noteSubtype = "plain";

    const newSubtype = 'plain';
    await changeContentType(editor, oldSubtype, newSubtype);

    expect(editor.children).toEqual(expectedNodes);
    expect(editor.subtype).toEqual(newSubtype);
  });

  it("should convert Markdown to plain text & remove markup", async () => {
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
    await changeContentType(editor, oldSubtype, newSubtype);

    expect(editor.children[0].children).toEqual([{text: "Quotable dialog"}]);
    expect(editor.children[1].children).toEqual([{text: "Review of Epic Movie"}]);
    expect(editor.children[2].children).toEqual([{text: "Acting unevenSeparate paragraph of first item"}]);
    expect(editor.children[3].children).toEqual([{text: "General Electric Big Blow"}]);
    expect(editor.children.length).toEqual(4);

    expect(editor.subtype).toEqual(newSubtype);
    expect(editor.children[0].noteSubtype).toEqual(newSubtype);
  });

  it("should convert HTML to plain text and remove markup", async () => {
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
    await changeContentType(editor, oldSubtype, newSubtype);

    expect(editor.children[0].type).toEqual('paragraph');
    expect(editor.children[0].children).toEqual([{text: "Something to lure you in"}]);
    expect(editor.children[1].type).toEqual('paragraph');
    expect(editor.children[1].children).toEqual([{text: "A Dramatic Article Title"}]);
    expect(editor.children[2].type).toEqual('paragraph');
    expect(editor.children[2].children).toEqual([{text: "First point"}]);
    expect(editor.children[3].type).toEqual('paragraph');
    expect(editor.children[3].children).toEqual([{text: "Second point"}]);
    expect(editor.children[4].type).toEqual('paragraph');
    expect(editor.children[4].children).toEqual([{text: "Another paragraph in second point"}]);
    expect(editor.children[5].type).toEqual('paragraph');
    expect(editor.children[5].children).toEqual([{text: "A landscape of Mt. Hood"}]);
    expect(editor.children[6].type).toEqual('paragraph');
    expect(editor.children[6].children).toEqual([{text: "Misato"}]);
    expect(editor.children[7].type).toEqual('paragraph');
    expect(editor.children[7].children).toEqual([{text: "portrait"}]);
    expect(editor.children[8].type).toEqual('paragraph');
    expect(editor.children[8].children).toEqual([{text: "☹︎"}]);
    expect(editor.children.length).toEqual(9);

    expect(editor.subtype).toEqual(newSubtype);
    expect(editor.children[0].noteSubtype).toEqual(newSubtype);
  });
});
