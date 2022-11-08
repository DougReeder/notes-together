// Copyright © 2021 Doug Reeder under the MIT License

import {changeBlockType, changeContentType, getRelevantBlockType, insertListAfter, insertTableAfter} from "./slateUtil";
import {createEditor, Editor, Transforms} from 'slate'
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

  it("should return list-item for selection in a list-item", () => {
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
      anchor: { path: [0, 1, 0], offset: 3 },
      focus:  { path: [0, 1, 0], offset: 8 },
    };

    const type = getRelevantBlockType(editor);

    expect(type).toEqual('list-item');
  });

  it("should return numbered-list for a selection with multiple list-items", () => {
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
      anchor: { path: [0, 1, 0], offset: 7 },
      focus:  { path: [0, 2, 0], offset: 5 },
    };

    const type = getRelevantBlockType(editor);

    expect(type).toEqual('numbered-list');
  });

  it("should return bulleted-list for a selection of multiple list-item in a list in a block quote", () => {
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
      anchor: { path: [0, 0, 0, 0], offset: 6 },
      focus:  { path: [0, 0, 1, 0], offset: 6 },
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

  it("should return table-cell when selection wholly in cell text", () => {
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
      anchor: { path: [0, 0, 1, 0, 0], offset: 1 },
      focus:  { path: [0, 0, 1, 0, 0], offset: 12 },
    };

    const type = getRelevantBlockType(editor);

    expect(type).toEqual('table-cell');
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
  it("should wrap image with block quote", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [
              {type: 'image', url: 'https://example.ca', title: "Canada, Eh?", children: [
                  {text: "Excuse me"}
                ]},
            ]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 0, 0, 0], offset: 2}, focus: {path: [0, 0, 0, 0], offset: 8}});

    expect(getRelevantBlockType(editor)).toEqual('image');
    changeBlockType(editor, 'quote');

    expect(editor.children).toEqual([
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [
              {type: 'quote', children: [
                  {type: 'image', url: 'https://example.ca', title: "Canada, Eh?", children: [
                      {text: "Excuse me"}
                    ]},
                ]},
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('image');
  });

  it("should wrap image with bulleted list", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'quote', children: [
          {type: 'image', url: 'https://example.us', title: "US Plus", children: [
              {text: "We own the idea of the idea of America"}
            ]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 0, 0], offset: 3}, focus: {path: [0, 0, 0], offset: 35}});

    expect(getRelevantBlockType(editor)).toEqual('image');
    changeBlockType(editor, 'bulleted-list');

    expect(editor.children).toEqual([
      {type: 'quote', children: [
          {type: 'bulleted-list', children: [
              {type: 'list-item', children: [
                  {type: 'image', url: 'https://example.us', title: "US Plus", children: [
                      {text: "We own the idea of the idea of America"}
                    ]},
                ]},
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('image');
  });

  it("should not wrap image with heading", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [
              {type: 'image', url: 'https://example.ca', title: "Canada, Eh?", children: [
                  {text: "Excuse me"}
                ]},
            ]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 0, 0, 0], offset: 2}, focus: {path: [0, 0, 0, 0], offset: 8}});

    expect(getRelevantBlockType(editor)).toEqual('image');
    changeBlockType(editor, 'heading-two');

    expect(editor.children).toEqual([
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [
              {type: 'image', url: 'https://example.ca', title: "Canada, Eh?", children: [
                  {text: "Excuse me"}
                ]},
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('image');
  });

  it("should convert multiple top-level blocks to table, without splitting images", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      { type: "paragraph",
        children: [
          {text: "first paragraph"}
        ]},
      {type: 'image', url: 'https://example.us', title: "US Plus", children: [
          {text: "We own the idea of the idea of America"}
        ]},
      { type: "quote",
        children: [
          {text: "second paragraph"}
        ]},
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "first item"}]},
          {type: 'list-item', children: [{text: "second item"}]},
        ]},
      { type: "heading-two",
        children: [
          {text: "some heading"}
        ]},
      {type: "paragraph",
        children: [
          {text: "first sentence"},
          {type: 'link', url: 'https://example.edu', title: "important info", children: [
              {text: "link text"},
            ]},
          {text: "last sentence"},
        ]},
      {type: 'image', url: 'https://example.gb', title: "Britain", children: [
          {text: "Keep a stiff upper lip!"}
        ]},
      { type: "paragraph",
        children: [
          {text: "last paragraph"}
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [1, 0], offset: 19}, focus: {path: [6, 0], offset: 4}});

    expect(getRelevantBlockType(editor)).toEqual('multiple');
    changeBlockType(editor, 'table');

    expect(editor.children).toEqual([
      { type: "paragraph",
        children: [
          {text: "first paragraph"}
        ]},
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', isHeader: false, children: [
                  {type: 'image', url: 'https://example.us', title: "US Plus", children: [
                      {text: "We own the idea of the idea of America"}
                    ]},
                ]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', isHeader: false, children: [
                  {text: "second paragraph"},
                ]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', isHeader: false, children: [
                  {text: "first item"},
                ]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', isHeader: false, children: [
                  {text: "second item"}
                ]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', isHeader: false, children: [
                  {text: "some heading"}
                ]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', isHeader: false, children: [
                  {text: "first sentence"},
                  {type: 'link', url: 'https://example.edu', title: "important info", children: [
                      {text: "link text"},
                    ]},
                  {text: "last sentence"},
                ]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', isHeader: false, children: [
                  {type: 'image', url: 'https://example.gb', title: "Britain", children: [
                      {text: "Keep a stiff upper lip!"}
                    ]},
                ]},
            ]},
        ]},
      { type: "paragraph",
        children: [
          {text: "last paragraph"}
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('table');
  });

  it("should split text nodes (and leave rump lists as bulleted)", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [
              {text: "start of first item"},
              {type: 'link', url: 'https://example.fr', title: "le chat", children: [
                  {text: "un chat"},
                ]},
              {text: "end of first item"},
            ]},
          {type: 'list-item', children: [
              {type: 'image', url: 'https://example.de', title: "Der Deutches Haus", children: [
                  {text: "Ein Haus"}
                ]},
              {type: "paragraph",
                children: [
                  {text: "middle of last item"},
                  {type: 'link', url: 'https://example.no', title: "something Norwegian", children: [
                      {text: "more Norwegian"},
                    ]},
                  {text: "end of last item"},
                ]},
            ]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 0, 0], offset: 15}, focus: {path: [0, 1, 1, 2], offset: 3}});

    expect(getRelevantBlockType(editor)).toEqual('numbered-list');
    changeBlockType(editor, 'quote');

    expect(editor.children).toEqual([
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [
              {text: "start of first "},
            ]},
        ]},
      {type: 'quote', children: [
          {text: "item"},
          {type: 'link', url: 'https://example.fr', title: "le chat", children: [
              {text: "un chat"},
            ]},
          {text: "end of first item"},
        ]},
      {type: 'quote', children: [
          {type: 'image', url: 'https://example.de', title: "Der Deutches Haus", children: [
              {text: "Ein Haus"}
            ]},
          {type: "paragraph",
            children: [
              {text: "middle of last item"},
              {type: 'link', url: 'https://example.no', title: "something Norwegian", children: [
                  {text: "more Norwegian"},
                ]},
              {text: "end"},
            ]},
        ]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [
              {type: 'paragraph', children: [
                  {text: " of last item"},
                ]},
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('multiple');
  });

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

    expect(getRelevantBlockType(editor)).toEqual('bulleted-list');
    changeBlockType(editor, 'numbered-list');

    expect(editor.children).toEqual([
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "first"}]},
          {type: 'list-item', children: [{text: "second"}]},
          {type: 'list-item', children: [{text: "third"}]},
        ]}
    ]);
    expect(getRelevantBlockType(editor)).toEqual('numbered-list');
  });

  it("should change table-cell to un-nested numbered-list", () =>{
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "sole"}
                ]},
            ]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 0, 0, 0], offset: 2}, focus: {path: [0, 0, 0, 0], offset: 2}});

    expect(getRelevantBlockType(editor)).toEqual('table-cell');
    changeBlockType(editor, 'numbered-list');

    expect(editor.children).toEqual([
        {type: 'numbered-list', children: [
            {type: 'list-item', children: [
                {text: "sole"}
              ]},
          ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('list-item');
  });

  it("should convert nested table to nested bulleted-list", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "vor"}]},
              {type: 'table-cell', children: [
                  {type: 'table', children: [
                      {type: 'table-row', children: [
                          {type: 'table-cell', children: [{text: "A1"}]},
                          {type: 'table-cell', children: [{text: "A2"}]},
                        ]},
                      {type: 'table-row', children: [
                          {type: 'table-cell', children: [{text: "B1"}]},
                          {type: 'table-cell', children: [{text: "B2"}]},
                        ]},
                    ]},
                  {type: 'numbered-list', children: [
                      {type: 'list-item', children: [{text: "first"}]},
                      {type: 'list-item', children: [{text: "second"}]},
                      {type: 'list-item', children: [{text: "third"}]},
                    ]},
                ]},
              {type: 'table-cell', children: [{text: "nach"}]},
            ]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 0, 1, 0, 0, 0, 0], offset: 0}, focus: {path: [0, 0, 1, 0, 1, 1, 0], offset: 2}});

    expect(getRelevantBlockType(editor)).toEqual('table');
    changeBlockType(editor, 'bulleted-list');

    expect(editor.children).toEqual([
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "vor"}]},
              {type: 'table-cell', children: [
                  {type: 'bulleted-list', children: [
                      {type: 'list-item', children: [{text: "A1"}]},
                      {type: 'list-item', children: [{text: "A2"}]},
                      {type: 'list-item', children: [{text: "B1"}]},
                      {type: 'list-item', children: [{text: "B2"}]},
                    ]},
                  {type: 'numbered-list', children: [
                      {type: 'list-item', children: [{text: "first"}]},
                      {type: 'list-item', children: [{text: "second"}]},
                      {type: 'list-item', children: [{text: "third"}]},
                    ]},
                ]},
              {type: 'table-cell', children: [{text: "nach"}]},
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('bulleted-list');
  });

  it("should convert nested table & numbered-list to un-nested bulleted-list", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "vor"}]},
              {type: 'table-cell', children: [
                  {type: 'table', children: [
                      {type: 'table-row', children: [
                          {type: 'table-cell', children: [{text: "A1"}]},
                          {type: 'table-cell', children: [{text: "A2"}]},
                        ]},
                      {type: 'table-row', children: [
                          {type: 'table-cell', children: [{text: "B1"}]},
                          {type: 'table-cell', children: [{text: "B2"}]},
                        ]},
                    ]},
                  {type: 'numbered-list', children: [
                      {type: 'list-item', children: [{text: "first"}]},
                      {type: 'list-item', children: [{text: "second"}]},
                      {type: 'list-item', children: [{text: "third"}]},
                    ]},
                ]},
              {type: 'table-cell', children: [{text: "nach"}]},
            ]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 0, 1, 0, 0, 0, 0], offset: 0}, focus: {path: [0, 0, 1, 1, 2, 0], offset: 5}});

    expect(getRelevantBlockType(editor)).toEqual('table-cell');
    changeBlockType(editor, 'bulleted-list');

    expect(editor.children).toEqual([
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "vor"}]},
            ]},
        ]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [
              {type: 'table', children: [
                  {type: 'table-row', children: [
                      {type: 'table-cell', children: [{text: "A1"}]},
                      {type: 'table-cell', children: [{text: "A2"}]},
                    ]},
                  {type: 'table-row', children: [
                      {type: 'table-cell', children: [{text: "B1"}]},
                      {type: 'table-cell', children: [{text: "B2"}]},
                    ]},
                ]},
              {type: 'numbered-list', children: [
                  {type: 'list-item', children: [{text: "first"}]},
                  {type: 'list-item', children: [{text: "second"}]},
                  {type: 'list-item', children: [{text: "third"}]},
                ]},
            ]},
        ]},
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "nach"}]},
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('list-item');
  });

  it("should unwrap nested quote when changed to 'quote'", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [
                {type: 'quote', children: [
                    {text: "Some famous saying"},
                  ]},
            ]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 0, 0, 0], offset: 5}, focus: {path: [0, 0, 0, 0], offset: 5}});

    expect(getRelevantBlockType(editor)).toEqual('quote');
    changeBlockType(editor, 'quote');

    expect(editor.children).toEqual([
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [
              {text: "Some famous saying"},
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('list-item');
  });

  it("should change un-nested quote to paragraph when changed to 'quote'", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'quote', children: [
          {text: "Some drivel"},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 0], offset: 5}, focus: {path: [0, 0], offset: 5}});

    expect(getRelevantBlockType(editor)).toEqual('quote');
    changeBlockType(editor, 'quote');

    expect(editor.children).toEqual([
      {type: 'paragraph', children: [
          {text: "Some drivel"},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('paragraph');
  });

  it("should unwrap bulleted list when 'bulleted-list' is reverted", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [
              {text: "Some item"},
            ]},
          {type: 'list-item', children: [
              {text: "Another item"},
            ]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 0, 0], offset: 0}, focus: {path: [0, 1, 0], offset: 12}});

    expect(getRelevantBlockType(editor)).toEqual('bulleted-list');
    changeBlockType(editor, 'bulleted-list');

    expect(editor.children).toEqual([
      {type: 'paragraph', children: [
          {text: "Some item"},
        ]},
      {type: 'paragraph', children: [
          {text: "Another item"},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('multiple');
  });

  it("should unwrap table when 'table' is reverted (table-row being common block)", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "A1"},
                ]},
              {type: 'table-cell', children: [
                  {text: "A2"},
                ]},
            ]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 0, 0, 0], offset: 0}, focus: {path: [0, 0, 1, 0], offset: 2}});

    expect(getRelevantBlockType(editor)).toEqual('table');
    changeBlockType(editor, 'table');

    expect(editor.children).toEqual([
      {type: 'paragraph', children: [
          {text: "A1"},
        ]},
      {type: 'paragraph', children: [
          {text: "A2"},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('multiple');
  });

  it("should de-format list without deleting", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {type: 'paragraph', children: [
                      {text: "body text"},
                    ]},
                  {type: 'numbered-list', children: [
                      {type: 'list-item', children: [
                          {text: "one"}
                        ]},
                      {type: 'list-item', children: [
                          {text: "two"}
                        ]},
                    ]},
                ]},
            ]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 0, 0, 1, 0, 0], offset: 1}, focus: {path: [0, 0, 0, 1, 1, 0], offset: 2}});

    expect(getRelevantBlockType(editor)).toEqual('numbered-list');
    changeBlockType(editor, 'numbered-list');

    expect(editor.children).toEqual([
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {type: 'paragraph', children: [
                      {text: "body text"},
                    ]},
                  {type: 'paragraph', children: [
                      {text: "one"}
                    ]},
                  {type: 'paragraph', children: [
                      {text: "two"}
                    ]},
                ]},
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('table-cell');
  });
});

describe("insertListAfter", () => {
  it("should insert numbered list in list item after text, selection collapsed", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'quote', children: [{text: "beginning"}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "something"}]},
          {type: 'list-item', children: [
              {text: "before"},
              {text: "abcdef", bold: true},
              {text: "after"},
            ]},
          {type: 'list-item', children: [{text: "other"}]},
        ]},
      {type: 'code', children: [{text: "end"}]},
    ];
    Transforms.select(editor, {anchor: {path: [1, 1, 1], offset: 3}, focus: {path: [1, 1, 1], offset: 3}});

    expect(getRelevantBlockType(editor)).toEqual('list-item');
    insertListAfter(editor, 'numbered-list');

    expect(editor.children).toEqual([
      {type: 'quote', children: [{text: "beginning"}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "something"}]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [
                  {text: "before"},
                  {text: "abcdef", bold: true},
                  {text: "after"},
                ]},
              {type: 'numbered-list', children: [
                  {type: 'list-item', children: [
                      {text: ""},
                    ]},
                ]},
            ]},
          {type: 'list-item', children: [{text: "other"}]},
        ]},
      {type: 'code', children: [{text: "end"}]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('list-item');
    expect(editor.selection).toHaveProperty('anchor.path', [1, 1, 1, 0, 0]);
    expect(editor.selection).toHaveProperty('focus.path', [1, 1, 1, 0, 0]);
  });

  it("should insert numbered list in list item after blocks, selection expanded", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'quote', children: [{text: "beginning"}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "something"}]},
          {type: 'list-item', children: [
              {type: 'heading-three', children: [
                  {text: "erste"},
                ]},
              {type: 'quote', children: [
                  {text: "zwitte"},
                ]},
              {type: 'code', children: [
                  {text: "dritte"},
                ]},
              {type: 'paragraph', children: [
                  {text: "vierte"},
                ]},
            ]},
          {type: 'list-item', children: [{text: "other"}]},
        ]},
      {type: 'code', children: [{text: "end"}]},
    ];
    Transforms.select(editor, {anchor: {path: [1, 1, 1, 0], offset: 3}, focus: {path: [1, 1, 2, 0], offset: 3}});

    expect(getRelevantBlockType(editor)).toEqual('list-item');
    insertListAfter(editor, 'numbered-list');

    expect(editor.children).toEqual([
      {type: 'quote', children: [{text: "beginning"}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "something"}]},
          {type: 'list-item', children: [
              {type: 'heading-three', children: [
                  {text: "erste"},
                ]},
              {type: 'quote', children: [
                  {text: "zwitte"},
                ]},
              {type: 'code', children: [
                  {text: "dritte"},
                ]},
              {type: 'numbered-list', children: [
                  {type: 'list-item', children: [
                      {text: ""},
                    ]},
                ]},
              {type: 'paragraph', children: [
                  {text: "vierte"},
                ]},
            ]},
          {type: 'list-item', children: [{text: "other"}]},
        ]},
      {type: 'code', children: [{text: "end"}]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('list-item');
    expect(editor.selection).toHaveProperty('anchor.path', [1, 1, 3, 0, 0]);
    expect(editor.selection).toHaveProperty('focus.path', [1, 1, 3, 0, 0]);
  });

  it("should insert list in table cell", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "One of these things"},
                  {text: "is not like the others.", bold: true},
                  {text: "Three of these things"},
                  {text: "are kinda the same.", italic: true},
                ]},
            ]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 0, 0, 1], offset: 7}, focus: {path: [0, 0, 0, 2], offset: 14}});

    expect(getRelevantBlockType(editor)).toEqual('table-cell');
    insertListAfter(editor, 'bulleted-list');

    expect(editor.children).toEqual([
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {type: 'paragraph', children: [
                      {text: "One of these things"},
                      {text: "is not like the others.", bold: true},
                      {text: "Three of these things"},
                      {text: "are kinda the same.", italic: true},
                    ]},
                  {type: 'bulleted-list', children: [
                      {type: 'list-item', children: [
                          {text: ""},
                        ]},
                    ]},
                ]},
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('list-item');
    expect(editor.selection).toHaveProperty('anchor.path', [0, 0, 0, 1, 0, 0]);
    expect(editor.selection).toHaveProperty('focus.path', [0, 0, 0, 1, 0, 0]);
  });
});

describe("insertTableAfter", () => {
  it("should insert table after blocks, selection expanded", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'quote', children: [{text: "beginning"}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "something"}]},
          {type: 'list-item', children: [
              {type: 'heading-three', children: [
                  {text: "erste"},
                ]},
              {type: 'quote', children: [
                  {text: "zwitte"},
                ]},
              {type: 'code', children: [
                  {text: "dritte"},
                ]},
              {type: 'paragraph', children: [
                  {text: "vierte"},
                ]},
            ]},
          {type: 'list-item', children: [{text: "other"}]},
        ]},
      {type: 'code', children: [{text: "end"}]},
    ];
    Transforms.select(editor, {anchor: {path: [1, 1, 1, 0], offset: 3}, focus: {path: [1, 1, 2, 0], offset: 3}});

    expect(getRelevantBlockType(editor)).toEqual('list-item');
    insertTableAfter(editor);

    expect(editor.children).toEqual([
      {type: 'quote', children: [{text: "beginning"}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "something"}]},
          {type: 'list-item', children: [
              {type: 'heading-three', children: [
                  {text: "erste"},
                ]},
              {type: 'quote', children: [
                  {text: "zwitte"},
                ]},
              {type: 'code', children: [
                  {text: "dritte"},
                ]},
              {type: 'table', children: [
                  {type: 'table-row', children: [
                      {type: 'table-cell', isHeader: true, children: [{text: ""}]},
                      {type: 'table-cell', isHeader: true, children: [{text: ""}]},
                    ]},
                  {type: 'table-row', children: [
                      {type: 'table-cell', isHeader: false, children: [{text: ""}]},
                      {type: 'table-cell', isHeader: false, children: [{text: ""}]},
                    ]},
                ]},
              {type: 'paragraph', children: [
                  {text: "vierte"},
                ]},
            ]},
          {type: 'list-item', children: [{text: "other"}]},
        ]},
      {type: 'code', children: [{text: "end"}]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('table-cell');
    expect(editor.selection).toHaveProperty('anchor.path', [1, 1, 3, 0, 0, 0]);
    expect(editor.selection).toHaveProperty('focus.path', [1, 1, 3, 0, 0, 0]);
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
