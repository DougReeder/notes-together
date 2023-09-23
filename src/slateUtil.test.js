// Copyright © 2021-2023 Doug Reeder under the MIT License

import {
  changeBlockType,
  changeContentType, DEFAULT_TABLE, deleteCompletedTasks,
  flipTableRowsToColumns,
  getRelevantBlockType,
  getSelectedListItem,
  getSelectedTable, insertCheckListAfter,
  insertListAfter,
  insertTableAfter,
  tabLeft,
  tabRight,
  toggleCheckListItem
} from "./slateUtil";
import {createEditor, Editor, Transforms} from 'slate'
import {withHtml} from "./slateHtml";
import {withReact} from "slate-react";
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

  it("should return list-item for a list-item with a 'checked' property, regardless of list type", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      { type: "numbered-list", children: [
          {type: "list-item", children: [
              {text: "first item"}
            ]},
          {type: "list-item", checked: false, children: [
              {text: "second item"}
            ]},
          {type: "list-item", children: [
              {text: "third item"}
            ]},
        ]},
    ];
    editor.selection = {
      anchor: { path: [0, 1, 0], offset: 6 },
      focus:  { path: [0, 1, 0], offset: 10 },
    };

    const type = getRelevantBlockType(editor);

    expect(type).toEqual('list-item');
  });

  for (const blockType of ['bulleted-list', 'numbered-list', 'task-list', 'sequence-list']) {
    it(`should return ${blockType} for a selection of multiple items in a ${blockType}`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.children = [
        { type: blockType, children: [
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

      expect(type).toEqual(blockType);
    });
  }

  for (const blockType of ['bulleted-list', 'numbered-list', 'task-list', 'sequence-list']) {
    it(`should return ${blockType} for a selection of multiple items in a ${blockType} in a block quote`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: "quote", children: [
            {type: blockType, children: [
                {type: "list-item", checked: false, children: [
                    {text: "first item"}
                  ]},
                {type: "list-item", checked: false, children: [
                    {text: "second item"}
                  ]},
                {type: "list-item", checked: false, children: [
                    {text: "third item"}
                  ]},
              ]},
          ]},
      ];
      editor.selection = {
        anchor: {path: [0, 0, 1, 0], offset: 6},
        focus: {path: [0, 0, 2, 0], offset: 5},
      };

      const type = getRelevantBlockType(editor);

      expect(type).toEqual(blockType);
    });
  }

  it("should return image when selection wholly in image in table cell", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      { type: "quote", children: [
        {type: 'table', children: [
          {type: 'table-row', children: [
            {type: 'table-cell', children: [
                {text: "Lorem ipsum dolor", bold: true},
              ]},
            {type: 'table-cell', children: [
                {text: "sit amet, consectetur", bold: true},
              ]},
          ]},
          {type: 'table-row', children: [
            {type: 'table-cell', children: [
                {text: "adipiscing elit", bold: true},
              ]},
            {type: 'table-cell', children: [
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
                  {type: 'table-cell', children: [
                      {text: "Lorem ipsum dolor", bold: true},
                    ]},
                  {type: 'table-cell', children: [
                      {text: "sit amet, consectetur", bold: true},
                    ]},
                ]},
              {type: 'table-row', children: [
                  {type: 'table-cell', children: [
                      {text: "adipiscing elit", bold: true},
                    ]},
                  {type: 'table-cell', children: [
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
                  {type: 'table-cell', children: [
                      {text: "Lorem ipsum dolor", bold: true},
                    ]},
                  {type: 'table-cell', children: [
                      {text: "sit amet, consectetur", bold: true},
                    ]},
                ]},
              {type: 'table-row', children: [
                  {type: 'table-cell', children: [
                      {text: "adipiscing elit", bold: true},
                    ]},
                  {type: 'table-cell', children: [
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
                  {type: 'table-cell', children: [
                      {text: "Lorem ipsum dolor", bold: true},
                    ]},
                  {type: 'table-cell', children: [
                      {text: "sit amet, consectetur", bold: true},
                    ]},
                ]},
              {type: 'table-row', children: [
                  {type: 'table-cell', children: [
                      {text: "adipiscing elit", bold: true},
                    ]},
                  {type: 'table-cell', children: [
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
    jest.spyOn(console, 'warn').mockImplementation(() => {});
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
    expect(console.warn).toHaveBeenCalled();
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
              {type: 'table-cell', children: [
                  {type: 'image', url: 'https://example.us', title: "US Plus", children: [
                      {text: "We own the idea of the idea of America"}
                    ]},
                ]},
              {type: 'table-cell', children: [{text: ""}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "second paragraph"},
                ]},
              {type: 'table-cell', children: [{text: ""}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "first item"},
                ]},
              {type: 'table-cell', children: [{text: ""}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "second item"}
                ]},
              {type: 'table-cell', children: [{text: ""}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "some heading"}
                ]},
              {type: 'table-cell', children: [{text: ""}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "first sentence"},
                  {type: 'link', url: 'https://example.edu', title: "important info", children: [
                      {text: "link text"},
                    ]},
                  {text: "last sentence"},
                ]},
              {type: 'table-cell', children: [{text: ""}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {type: 'image', url: 'https://example.gb', title: "Britain", children: [
                      {text: "Keep a stiff upper lip!"}
                    ]},
                ]},
              {type: 'table-cell', children: [{text: ""}]},
            ]},
        ]},
      { type: "paragraph",
        children: [
          {text: "last paragraph"}
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('table-cell');
    expect(editor.selection).toEqual({
      anchor: {path: [1, 0, 1, 0], offset: 0},
      focus: {path: [1, 0, 1, 0], offset: 0},
    });
  });

  it("should split text nodes (and leave rump lists same type)", () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
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
      {type: 'numbered-list', children: [
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
      {type: 'numbered-list', children: [
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

  for (const blockType of ['task-list', 'sequence-list']) {
    it(`should convert numbered-list to ${blockType}`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: 'quote', children: [
            {type: 'numbered-list', children: [
                {type: 'list-item', children: [{text: "Morbi lobortis"}]},
                {type: 'list-item', children: [{text: "lorem elit"}]},
                {type: 'list-item', children: [{text: "eget imperdiet"}]},
              ]}
          ]},
      ];
      editor.selection = {
        anchor: {path: [0, 0, 0, 0], offset: 0},
        focus: {path: [0, 0, 2, 0], offset: 14},
      };

      expect(getRelevantBlockType(editor)).toEqual('numbered-list');
      changeBlockType(editor, blockType);

      expect(editor.children).toEqual([
        {type: 'quote', children: [
            {type: blockType, children: [
                {type: 'list-item', checked: false, children: [{text: "Morbi lobortis"}]},
                {type: 'list-item', checked: false, children: [{text: "lorem elit"}]},
                {type: 'list-item', checked: false, children: [{text: "eget imperdiet"}]},
              ]}
          ]},
      ]);
      expect(getRelevantBlockType(editor)).toEqual(blockType);
    });
  }

  for (const blockType of ['task-list', 'sequence-list']) {
    it(`should convert ${blockType} to clean numbered list`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: 'quote', children: [
            {type: blockType, children: [
                {type: 'list-item', checked: false, children: [{text: "Cras aliquam"}]},
                {type: 'list-item', checked: false, children: [{text: "egestas mattis"}]},
                {type: 'list-item', checked: false, children: [{text: "Integer quis"}]},
              ]}
          ]},
      ];
      editor.selection = {
        anchor: { path: [0, 0, 0, 0], offset: 0 },
        focus:  { path: [0, 0, 2, 0], offset: 12 },
      };

      expect(getRelevantBlockType(editor)).toEqual(blockType);
      changeBlockType(editor, 'numbered-list');

      expect(editor.children).toEqual([
        {type: 'quote', children: [
            {type: 'numbered-list', children: [
                {type: 'list-item', children: [{text: "Cras aliquam"}]},
                {type: 'list-item', children: [{text: "egestas mattis"}]},
                {type: 'list-item', children: [{text: "Integer quis"}]},
              ]}
          ]},
      ]);
      expect(getRelevantBlockType(editor)).toEqual('numbered-list');
    });
  }

  for (const {oldListType, newListType} of [
    {oldListType: 'task-list', newListType: 'sequence-list'},
    {oldListType: 'sequence-list', newListType: 'task-list'}
  ]) {
    it(`should convert ${oldListType} to ${newListType}`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: 'quote', children: [
            {type: oldListType, children: [
                {type: 'list-item', checked: true, children: [{text: "risus fermentum"}]},
                {type: 'list-item', checked: false, children: [{text: "Nunc neque nulla"}]},
                {type: 'list-item', checked: true, children: [{text: "maximus vitae"}]},
              ]}
          ]},
      ];
      editor.selection = {
        anchor: { path: [0, 0, 0, 0], offset: 0 },
        focus:  { path: [0, 0, 2, 0], offset: 13 },
      };

      expect(getRelevantBlockType(editor)).toEqual(oldListType);
      changeBlockType(editor, newListType);

      expect(editor.children).toEqual([
        {type: 'quote', children: [
            {type: newListType, children: [
                {type: 'list-item', checked: true, children: [{text: "risus fermentum"}]},
                {type: 'list-item', checked: false, children: [{text: "Nunc neque nulla"}]},
                {type: 'list-item', checked: true, children: [{text: "maximus vitae"}]},
              ]}
          ]},
      ]);
      expect(getRelevantBlockType(editor)).toEqual(newListType);
    });
  }

  it("should change table-cell to un-nested numbered-list", () =>{
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "alpha"}
                ]},
              {type: 'table-cell', children: [
                  {text: "beta"}
                ]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "gamma"}
                ]},
              {type: 'table-cell', children: [
                  {type: 'paragraph', children: [{text: "delta 1"}]},
                  {type: 'quote', children: [{text: "delta 2"}]},
                ]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "epsilon"}
                ]},
              {type: 'table-cell', children: [
                  {text: "zeta"}
                ]},
            ]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 1, 0, 0], offset: 0}, focus: {path: [0, 1, 1, 1, 0], offset: 7}});

    expect(getRelevantBlockType(editor)).toEqual('table');
    changeBlockType(editor, 'numbered-list');

    expect(editor.children).toEqual([
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "alpha"}
                ]},
              {type: 'table-cell', children: [
                  {text: "beta"}
                ]},
            ]},
        ]},
        {type: 'numbered-list', children: [
            {type: 'list-item', children: [
                {type: 'paragraph', children: [{text: "gamma"}]},
                {type: 'paragraph', children: [{text: "delta 1"}]},
                {type: 'quote', children: [{text: "delta 2"}]},
              ]},
          ]},
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "epsilon"}
                ]},
              {type: 'table-cell', children: [
                  {text: "zeta"}
                ]},
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
                      {type: 'list-item', children: [
                          {type: 'paragraph', children: [{text: "A1"}]},
                          {type: 'paragraph', children: [{text: "A2"}]},
                        ]},
                      {type: 'list-item', children: [
                          {type: 'paragraph', children: [{text: "B1"}]},
                          {type: 'paragraph', children: [{text: "B2"}]},
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
    ]);
    expect(getRelevantBlockType(editor)).toEqual('bulleted-list');
  });

  it("should convert nested table & numbered-list to un-nested bulleted-list", () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
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
    expect(console.warn).toHaveBeenCalled();
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

  for (const blockType of ['bulleted-list', 'numbered-list']) {
    it(`should unwrap ${blockType} when ${blockType} is reverted`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.children = [
        {type: blockType, children: [
            {type: 'list-item', children: [
                {text: "Some item"},
              ]},
            {type: 'list-item', children: [
                {text: "Another item"},
              ]},
          ]},
      ];
      Transforms.select(editor, {anchor: {path: [0, 0, 0], offset: 0}, focus: {path: [0, 1, 0], offset: 12}});

      expect(getRelevantBlockType(editor)).toEqual(blockType);
      changeBlockType(editor, blockType);

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
  }

  for (const blockType of ['task-list', 'sequence-list']) {
    it(`should unwrap ${blockType} and remove 'checked' property when ${blockType} is reverted`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.children = [
        {type: blockType, children: [
            {type: 'list-item', checked: false, children: [
                {text: "odio facilisis"},
              ]},
            {type: 'list-item', checked: true, children: [
                {text: "In tincidunt"},
              ]},
          ]},
      ];
      Transforms.select(editor, {anchor: {path: [0, 0, 0], offset: 0}, focus: {path: [0, 1, 0], offset: 12}});

      expect(getRelevantBlockType(editor)).toEqual(blockType);
      changeBlockType(editor, blockType);

      expect(editor.children).toEqual([
        {type: 'paragraph', children: [
            {text: "odio facilisis"},
          ]},
        {type: 'paragraph', children: [
            {text: "In tincidunt"},
          ]},
      ]);
      expect(getRelevantBlockType(editor)).toEqual('multiple');
    });
  }

  it("should change blank paragraph to table with 2 rows and 2 columns", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'heading-one', children: [{text: "Some Topic"}]},
      {type: 'paragraph', children: [{text: "  \t"}, {bold: true, text: "\r"}]},
    ];
    Transforms.select(editor, {anchor: {path: [1, 0], offset: 0}, focus: {path: [1, 1], offset: 1}});

    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    changeBlockType(editor, 'table');

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "Some Topic"}]},
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "  \t"}, {bold: true, text: "\r"}]},
              {type: 'table-cell', children: [{text: ""}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: ""}]},
              {type: 'table-cell', children: [{text: ""}]},
            ]}
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('table-cell');
    expect(editor.selection).toEqual({
      anchor: {path: [1, 0, 1, 0], offset: 0},
      focus: {path: [1, 0, 1, 0], offset: 0},
    });
  });

  it("should change blank list items to table w/ 2 columns", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'heading-three', children: [{text: "elk"}]},
      {type: 'quote', children: [
          {type: 'task-list', children: [
              {type: 'list-item', checked: false, children: [{text: "first"}]},
              {type: 'list-item', checked: false, children: [{text: "  \t"}, {bold: true, text: "\v\n"}]},
              {type: 'list-item', checked: false, children: [{text: "   "}]},
              {type: 'list-item', checked: true, children: [{text: "last"}]},
            ]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [1, 0, 2, 0], offset: 3}, focus: {path: [1, 0, 1, 0], offset: 0}});

    expect(getRelevantBlockType(editor)).toEqual('task-list');
    changeBlockType(editor, 'table');

    expect(editor.children).toEqual([
      {type: 'heading-three', children: [{text: "elk"}]},
      {type: 'quote', children: [
          {type: 'task-list', children: [
              {type: 'list-item', checked: false, children: [{text: "first"}]},
            ]},
          {type: 'table', children: [
              {type: 'table-row', children: [
                  {type: 'table-cell', children: [{text: "  \t"}, {bold: true, text: "\v\n"}]},
                  {type: 'table-cell', children: [{text: ""}]},
                ]},
              {type: 'table-row', children: [
                  {type: 'table-cell', children: [{text: "   "}]},
                  {type: 'table-cell', children: [{text: ""}]},
                ]}
            ]},
          {type: 'task-list', children: [
              {type: 'list-item', checked: true, children: [{text: "last"}]},
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('table-cell');
    expect(editor.selection).toEqual({
      anchor: {path: [1, 1, 0, 1, 0], offset: 0},
      focus: {path: [1, 1, 0, 1, 0], offset: 0},
    });
  });

  it("should replace list item at end to table with 2 rows and 2 columns", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'heading-two', children: [{text: "The Author"}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "non-blank item"}]},
          {type: 'list-item', children: [{text: "  \t"}, {bold: true, text: "\v"}]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [1, 1, 0], offset: 1}, focus: {path: [1, 1, 0], offset: 1}});

    expect(getRelevantBlockType(editor)).toEqual('list-item');
    changeBlockType(editor, 'table');

    expect(editor.children).toEqual([
      {type: 'heading-two', children: [{text: "The Author"}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "non-blank item"}]},
        ]},
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "  \t"}, {bold: true, text: "\v"}]},
              {type: 'table-cell', children: [{text: ""}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: ""}]},
              {type: 'table-cell', children: [{text: ""}]},
            ]}
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('table-cell');
    expect(editor.selection).toEqual({
      anchor: {path: [2, 0, 1, 0], offset: 0},
      focus: {path: [2, 0, 1, 0], offset: 0},
    });
  });

  it("should change list items to 1st column of 2-column table", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'heading-three', children: [{text: "gnu"}]},
      {type: 'sequence-list', children: [
          {type: 'list-item', checked: false, children: [{text: "erste"}]},
          {type: 'list-item', checked: true, children: [{text: "zwitte"}, {bold: true, text: "\t"}]},
          {type: 'list-item', checked: false, children: [{text: "dritte"}]},
          {type: 'list-item', checked: true, children: [{text: "letzte"}]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [1, 2, 0], offset: 6}, focus: {path: [1, 1, 0], offset: 0}});

    expect(getRelevantBlockType(editor)).toEqual('sequence-list');
    changeBlockType(editor, 'table');

    expect(editor.children).toEqual([
      {type: 'heading-three', children: [{text: "gnu"}]},
      {type: 'sequence-list', children: [
          {type: 'list-item', checked: false, children: [{text: "erste"}]},
        ]},
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "zwitte"}, {bold: true, text: "\t"}]},
              {type: 'table-cell', children: [{text: ""}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "dritte"}]},
              {type: 'table-cell', children: [{text: ""}]},
            ]},
        ]},
      {type: 'sequence-list', children: [
          {type: 'list-item', checked: true, children: [{text: "letzte"}]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('table-cell');
    expect(editor.selection).toEqual({
      anchor: {path: [2, 0, 1, 0], offset: 0},
      focus: {path: [2, 0, 1, 0], offset: 0},
    });
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
    Transforms.select(editor, {anchor: {path: [0, 0, 0, 1, 0, 0], offset: 0}, focus: {path: [0, 0, 0, 1, 1, 0], offset: 3}});

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

  it("should insert numbered list after paragraph in list item after text, selection collapsed", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'quote', children: [{text: "quis bibendum arcu commodo"}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [
              {type: 'paragraph', children: [
                  {text: "begin"},
                  {text: "12345678", bold: true},
                  {text: "end"},
                ]},
              {type: 'table', children: [
                  {type: 'table-row', children: [
                      {type: 'table-cell', children: [
                          {text: "maximus sollicitudin lacus non"},
                        ]},
                    ]},
                ]}
            ]},
          {type: 'list-item', children: [{text: "molestie sollicitudin est"}]},
        ]},
      {type: 'code', children: [{text: "In vitae condimentum ipsum"}]},
    ];
    Transforms.select(editor, {
      anchor: {path: [1, 0, 0, 0], offset: 4},
      focus:  {path: [1, 0, 0, 0], offset: 4},
    });

    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    insertListAfter(editor, 'numbered-list');

    expect(editor.children).toEqual([
      {type: 'quote', children: [{text: "quis bibendum arcu commodo"}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [
              {type: 'paragraph', children: [
                  {text: "begin"},
                  {text: "12345678", bold: true},
                  {text: "end"},
                ]},
              {type: 'numbered-list', children: [
                  {type: 'list-item', children: [
                      {text: ""},
                    ]},
                ]},
              {type: 'table', children: [
                  {type: 'table-row', children: [
                      {type: 'table-cell', children: [
                          {text: "maximus sollicitudin lacus non"},
                        ]},
                    ]},
                ]}
            ]},
          {type: 'list-item', children: [{text: "molestie sollicitudin est"}]},
        ]},
      {type: 'code', children: [{text: "In vitae condimentum ipsum"}]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('list-item');
    expect(editor.selection).toHaveProperty('anchor.path', [1, 0, 1, 0, 0]);
    expect(editor.selection).toHaveProperty('focus.path',  [1, 0, 1, 0, 0]);
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

describe("insertChecklistAfter", () => {
  for (const blockType of ['task-list', 'sequence-list']) {
    it(`should insert ${blockType} in list item after text, selection collapsed`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.children = [
        {type: 'quote', children: [{text: "convallis ultrices"}]},
        {type: 'bulleted-list', children: [
            {type: 'list-item', children: [{text: "Duis eleifend"}]},
            {type: 'list-item', children: [
                {text: "ante-"},
                {text: "ne plus ultra", bold: true},
                {text: "post-"},
              ]},
            {type: 'list-item', children: [{text: "other"}]},
          ]},
        {type: 'code', children: [{text: "end"}]},
      ];
      Transforms.select(editor, {anchor: {path: [1, 1, 1], offset: 3}, focus: {path: [1, 1, 1], offset: 3}});

      expect(getRelevantBlockType(editor)).toEqual('list-item');
      insertCheckListAfter(editor, blockType);

      expect(editor.children).toEqual([
        {type: 'quote', children: [{text: "convallis ultrices"}]},
        {type: 'bulleted-list', children: [
            {type: 'list-item', children: [{text: "Duis eleifend"}]},
            {type: 'list-item', children: [
                {type: 'paragraph', children: [
                    {text: "ante-"},
                    {text: "ne plus ultra", bold: true},
                    {text: "post-"},
                  ]},
                {type: blockType, children: [
                    {type: 'list-item', checked: false, children: [
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
  }

  for (const blockType of ['task-list', 'sequence-list']) {
    it(`should insert ${blockType} in list item after blocks, selection expanded`, () => {
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
      insertCheckListAfter(editor, blockType);

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
                {type: blockType, children: [
                    {type: 'list-item', checked: false, children: [
                        {text: ""},
                      ]},
                  ]},
                {type: 'paragraph', children: [
                    {text: "vierte"},
                  ]},
              ]},
            {type: 'list-item', children: [{text: "other"}]},
          ]
        },
        {type: 'code', children: [{text: "end"}]},
      ]);
      expect(getRelevantBlockType(editor)).toEqual('list-item');
      expect(editor.selection).toHaveProperty('anchor.path', [1, 1, 3, 0, 0]);
      expect(editor.selection).toHaveProperty('focus.path', [1, 1, 3, 0, 0]);
    });
  }
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
              DEFAULT_TABLE,
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

describe("getSelectedListItem", () => {
  it("should return falsy if no selection", () => {
    console.error = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'heading-two', children: [{text: "Vivamus dapibus nunc vitae sapien fermentum"}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "Mauris sollicitudin hendrerit eros"}]},
          {type: 'list-item', children: [{text: "Donec sodales est at risus porttitor"}]},
        ]
      },
    ];
    Transforms.deselect(editor);

    expect(getRelevantBlockType(editor)).toEqual('n/a');
    expect(getSelectedListItem(editor)).toEqual([undefined, undefined]);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("should return falsy if not in list", () => {
    console.error = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'heading-three', children: [{text: "Cras sed viverra ante"}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "Fusce pretium nisi non fermentum auctor."}]},
          {type: 'list-item', children: [{text: "Aliquam hendrerit in nulla pharetra"}]},
        ]
      },
    ];
    Transforms.select(editor, {
      anchor: {path: [0, 0], offset: 21},
      focus:  {path: [0, 0], offset: 21},
    });

    expect(getRelevantBlockType(editor)).toEqual('heading-three');
    expect(getSelectedListItem(editor)).toEqual([undefined, undefined]);
    expect(console.error).not.toHaveBeenCalled();
  });

  for (const blockType of ['bulleted-list', 'numbered-list', 'task-list', 'sequence-list']) {
    it(`should return list and path if selection in ${blockType} at any level`, () => {
      console.error = jest.fn();
      const editor = withHtml(withReact(createEditor()));
      editor.children = [
        {type: 'heading-three', children: [{text: "Nunc nulla diam, maximus in rutrum vitae"}]},
        {type: blockType, children: [
            {type: 'list-item', children: [{text: "Aliquam at arcu sed magna tempor cursus"}]},
            {type: 'list-item', children: [
                {type: 'paragraph', children: [
                    {text: "Nullam dapibus pharetra urna"},
                  ]},
                {type: 'table', children: [
                    {type: 'table-row', children: [
                        {type: 'table-cell', children: [
                            {text: "Nam a fermentum lectus."},
                          ]},
                        {type: 'table-cell', children: [
                            {text: "Donec aliquam at enim at aliquet."},
                          ]},
                      ]}
                  ]}
              ]},
            {type: 'list-item', children: [{text: "Nunc ultrices arcu eu mi fermentum"}]},
          ]
        },
      ];
      Transforms.select(editor, {
        anchor: {path: [1, 1, 1, 0, 1, 0], offset: 25},
        focus: {path: [1, 1, 1, 0, 1, 0], offset: 25},
      });

      expect(getRelevantBlockType(editor)).toEqual('table-cell');
      const [selectedListItem, selectedListItemPath] = getSelectedListItem(editor);
      expect(selectedListItem).toHaveProperty('type', 'list-item');
      expect(selectedListItem).toHaveProperty('children.length', 2);
      expect(Array.isArray(selectedListItemPath)).toBeTruthy();
      expect(selectedListItemPath).toHaveLength(2);
      expect(console.error).not.toHaveBeenCalled();
    });
  }
});

describe("getSelectedTable", () => {
  it("should return falsy if no selection", () => {
    console.error = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    const nodes = [
      {type: 'heading-two', children: [{text: "Sed sed velit quis mauris accumsan aliquet."}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "Nam ac lacinia nibh."}]},
          {type: 'list-item', children: [{text: "Integer eu dolor vitae ante consequat"}]},
          {type: 'list-item', children: [{text: "Nullam mattis risus ut nulla gravida"}]},
        ]},
    ];
    editor.children = nodes;
    Transforms.deselect(editor);

    expect(getRelevantBlockType(editor)).toEqual('n/a');
    expect(getSelectedTable(editor)).toEqual([undefined, undefined]);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("should return falsy if not in table", () => {
    console.error = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    const nodes = [
      {type: 'heading-two', children: [{text: "Sed sed velit quis mauris accumsan aliquet."}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "Nam ac lacinia nibh."}]},
          {type: 'list-item', children: [{text: "Integer eu dolor vitae ante consequat"}]},
          {type: 'list-item', children: [{text: "Nullam mattis risus ut nulla gravida"}]},
        ]},
    ];
    editor.children = nodes;
    Transforms.select(editor, {
      anchor: {path: [1, 1, 0], offset: 28},
      focus:  {path: [1, 1, 0], offset: 28},
    });

    expect(getRelevantBlockType(editor)).toEqual('list-item');
    expect(getSelectedTable(editor)).toEqual([undefined, undefined]);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("should return table and path if selection in table at any level", () => {
    console.error = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "Quisque id metus mattis", bold: true},
                ]},
              {type: 'table-cell', children: [
                  {text: "vehicula tortor a, tincidunt mi.", bold: true},
                ]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {type: 'paragraph', children: [
                      {text: "Integer placerat, nisl nec fringilla placerat,"},
                    ]},
                  {type: 'numbered-list', children: [
                      {type: 'list-item', children: [
                          {type: 'paragraph', children: [
                              {text: "lectus enim aliquet nisl,"},
                            ]},
                        ]},
                      {type: 'list-item', children: [
                          {type: 'paragraph', children: [
                              {text: "quis venenatis mauris erat et orci."},
                              {text: "Mauris condimentum", bold: true},
                            ]},
                        ]},
                    ]},
                ]},
              {type: 'table-cell', children: [
                  {text: "felis sed posuere euismod."},
                ]},
            ]},
        ]},
    ];
    editor.selection = {
      anchor: { path: [0, 1, 0, 1, 1, 0, 0], offset: 31 },
      focus:  { path: [0, 1, 0, 1, 1, 0, 0], offset: 31 },
    };

    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    const [selectedTable, selectedTablePath] = getSelectedTable(editor);
    expect(selectedTable).toHaveProperty('type', 'table');
    expect(selectedTable).toHaveProperty('children.length', 2);
    expect(Array.isArray(selectedTablePath)).toBeTruthy();
    expect(selectedTablePath).toHaveLength(1);
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("tabRight", () => {
  it("should insert space (not create sublist) if first item in list", () => {
    console.info = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    const nodes = [
      {type: 'heading-two', children: [{text: "Vivamus id ligula justo."}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "this"}]},
          {type: 'list-item', children: [{text: "won't"}]},
          {type: 'list-item', children: [{text: "change"}]},
        ]},
    ];
    editor.children = nodes;
    Transforms.select(editor, {
      anchor: {path: [1, 0, 0], offset: 4},
      focus:  {path: [1, 0, 0], offset: 4}
    });

    expect(getRelevantBlockType(editor)).toEqual('list-item');
    tabRight(editor);

    expect(editor.children[0]).toEqual(nodes[0]);
    expect(editor.children[1].type).toEqual('bulleted-list');
    expect(editor.children[1].children[0]).toEqual({type: 'list-item', children: [{text: "this    "}]});
    expect(editor.children[1].children.slice(1)).toEqual(nodes[1].children.slice(1));
    expect(editor.selection).toEqual({
      anchor: {path: [1, 0, 0], offset: 8},
      focus:  {path: [1, 0, 0], offset: 8}
    });
  });

  for (const blockType of ['bulleted-list', 'numbered-list']) {
    it(`should create a ${blockType} sublist in ${blockType}`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: blockType, children: [
            {type: 'list-item', children: [{text: "aleph"}]},
            {type: 'list-item', children: [{text: "beis"}, {text: "BEIS", bold: true}]},
            {type: 'list-item', children: [{text: "veis"}]},
            {type: 'list-item', children: [{text: "gimmel"}]},
          ]},
      ];
      Transforms.select(editor, {anchor: {path: [0, 2, 0], offset: 4}, focus: {path: [0, 2, 0], offset: 4}});
      expect(getRelevantBlockType(editor)).toEqual('list-item');

      tabRight(editor);

      expect(editor.children).toEqual([
        {type: blockType, children: [
            {type: 'list-item', children: [{text: "aleph"}]},
            {type: 'list-item', children: [
                {type: 'paragraph', children: [{text: "beis"}, {text: "BEIS", bold: true}]},
                {type: blockType, children: [
                    {type: 'list-item', children: [{text: "veis"}]},
                  ]},
              ]},
            {type: 'list-item', children: [{text: "gimmel"}]},
          ]},
      ]);
      expect(editor.selection).toEqual({
        anchor: {path: [0, 1, 1, 0, 0], offset: 4},
        focus: {path: [0, 1, 1, 0, 0], offset: 4},
      });
    });
  }

  for (const blockType of ['task-list', 'sequence-list']) {
    it(`should create a ${blockType} sublist in ${blockType}`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: blockType, children: [
            {type: 'list-item', checked: false, children: [{text: "aleph"}]},
            {type: 'list-item', checked: true, children: [{text: "beis"}, {text: "BEIS", bold: true}]},
            {type: 'list-item', checked: true, children: [{text: "veis"}]},
            {type: 'list-item', checked: true, children: [{text: "gimmel"}]},
          ]},
      ];
      Transforms.select(editor, {anchor: {path: [0, 2, 0], offset: 4}, focus: {path: [0, 2, 0], offset: 4}});
      expect(getRelevantBlockType(editor)).toEqual('list-item');

      tabRight(editor);

      expect(editor.children).toEqual([
        {type: blockType, children: [
            {type: 'list-item', checked: false, children: [{text: "aleph"}]},
            {type: 'list-item', checked: true, children: [
                {type: 'paragraph', children: [{text: "beis"}, {text: "BEIS", bold: true}]},
                {type: blockType, children: [
                    {type: 'list-item', checked: true, children: [{text: "veis"}]},
                  ]},
              ]},
            {type: 'list-item', checked: true, children: [{text: "gimmel"}]},
          ]},
      ]);
      expect(editor.selection).toEqual({
        anchor: {path: [0, 1, 1, 0, 0], offset: 4},
        focus: {path: [0, 1, 1, 0, 0], offset: 4},
      });
    });
  }

  for (const {outerListType, innerListType} of [
    {outerListType: 'bulleted-list', innerListType: 'numbered-list'},
    {outerListType: 'numbered-list', innerListType: 'bulleted-list'}
  ]) {
    it(`should move ${outerListType} item to existing sublist of ${innerListType}`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: outerListType, children: [
            {type: 'list-item', children: [{text: "apple"}]},
            {type: 'list-item', children: [
                {type: 'paragraph', children: [{text: "banana"}]},
                {type: innerListType, children: [
                    {type: 'list-item', children: [{text: "banana split"}]},
                  ]},
              ]},
            {type: 'list-item', children: [{text: "cake"}]},
            {type: 'list-item', children: [{text: "dessert"}]},
          ]},
      ];
      Transforms.select(editor, {anchor: {path: [0, 2, 0], offset: 4}, focus: {path: [0, 2, 0], offset: 4}});
      expect(getRelevantBlockType(editor)).toEqual('list-item');

      tabRight(editor);

      expect(editor.children).toEqual([
        {type: outerListType, children: [
            {type: 'list-item', children: [{text: "apple"}]},
            {type: 'list-item', children: [
                {type: 'paragraph', children: [{text: "banana"}]},
                {type: innerListType, children: [
                    {type: 'list-item', children: [{text: "banana split"}]},
                    {type: 'list-item', children: [{text: "cake"}]},
                  ]},
              ]},
            {type: 'list-item', children: [{text: "dessert"}]},
          ]},
      ]);
    });
  }

  it("should create a sublist of same type, with all selected items", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "aleph"}, {text: "ALEPH", bold: true}]},
          {type: 'list-item', children: [{text: "beis"}]},
          {type: 'list-item', children: [{text: "veis"}]},
          {type: 'list-item', children: [{text: "gimmel"}]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 2, 0], offset: 2}, focus: {path: [0, 1, 0], offset: 2}});
    expect(getRelevantBlockType(editor)).toEqual('numbered-list');

    tabRight(editor);

    expect(editor.children).toEqual([
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "aleph"}, {text: "ALEPH", bold: true}]},
              {type: 'numbered-list', children: [
                  {type: 'list-item', children: [{text: "beis"}]},
                  {type: 'list-item', children: [{text: "veis"}]},
                ]},
            ]},
          {type: 'list-item', children: [{text: "gimmel"}]},
        ]},
    ]);
  });

  it("should create a sublist of same type, with all selected items & children", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "one"}]},
          {type: 'list-item', children: [{text: "two"}, {text: "TWO", bold: true}]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "three"}, {text: "THREE", bold: true}]},
              {type: 'bulleted-list', children: [
                  {type: 'list-item', children: [{text: "three one"}]},
                ]},
            ]},
          {type: 'list-item', children: [{text: "four"}]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 2, 0, 0], offset: 2}, focus: {path: [0, 2, 0, 1], offset: 3}});
    expect(getRelevantBlockType(editor)).toEqual('paragraph');

    tabRight(editor);

    expect(editor.children).toEqual([
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "one"}]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "two"}, {text: "TWO", bold: true}]},
              {type: 'numbered-list', children: [
                  {type: 'list-item', children: [
                      {type: 'paragraph', children: [{text: "three"}, {text: "THREE", bold: true}]},
                      {type: 'bulleted-list', children: [
                          {type: 'list-item', children: [{text: "three one"}]},
                        ]},
                    ]},
                ]},
            ]},
          {type: 'list-item', children: [{text: "four"}]},
        ]},
    ]);
  });

  it("should move all selected items & their children to existing sublist", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "aaa"}]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "bbb"}, {text: "BBB", bold: true}]},
              {type: 'bulleted-list', children: [
                  {type: 'list-item', children: [{text: "bbb one"}]},
                  {type: 'list-item', children: [{text: "bbb two"}]},
                ]},
            ]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "ccc"}, {text: "CCC", bold: true}]},
              {type: 'bulleted-list', children: [
                  {type: 'list-item', children: [{text: "ccc one"}]},
                  {type: 'list-item', children: [{text: "ccc two"}]},
                ]},
            ]},
          {type: 'list-item', children: [{text: "ddd"}]},
        ]},
    ];
    Transforms.select(editor, {anchor: {path: [0, 2, 0, 0], offset: 2}, focus: {path: [0, 2, 0, 1], offset: 2}});
    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    tabRight(editor);

    expect(editor.children).toEqual([
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "aaa"}]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "bbb"}, {text: "BBB", bold: true}]},
              {type: 'bulleted-list', children: [
                  {type: 'list-item', children: [{text: "bbb one"}]},
                  {type: 'list-item', children: [{text: "bbb two"}]},
                  {type: 'list-item', children: [
                      {type: 'paragraph', children: [{text: "ccc"}, {text: "CCC", bold: true}]},
                      {type: 'bulleted-list', children: [
                          {type: 'list-item', children: [{text: "ccc one"}]},
                          {type: 'list-item', children: [{text: "ccc two"}]},
                        ]},
                    ]},
                ]},
            ]},
          {type: 'list-item', children: [{text: "ddd"}]},
        ]},
    ]);
  });

  for (const listType of ['task-list', 'sequence-list']) {
    it(`should change regular list items to ${listType} items`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: 'quote', children: [
            {type: 'numbered-list', children: [
                {type: 'list-item', children: [{text: "quis leo"}, {text: "QUIS LEO", bold: true}]},
                {type: 'list-item', children: [
                    {type: 'paragraph', children: [{text: "vel aliquet"}]},
                    {type: listType, children: [
                        {type: 'list-item', checked: true, children: [{text: "Vestibulum eget"}]},
                      ]},
                  ]},
                {type: 'list-item', children: [{text: "mobilis in mobili"}]},
                {type: 'list-item', children: [{text: "semper lacus"}]},
              ]},
          ]},
      ];
      Transforms.select(editor, {
        anchor: {path: [0, 0, 2, 0], offset: 0},
        focus:  {path: [0, 0, 2, 0], offset: 0},
      });
      expect(getRelevantBlockType(editor)).toEqual('list-item');

      tabRight(editor);

      expect(editor.children).toEqual([
        {type: 'quote', children: [
            {type: 'numbered-list', children: [
                {type: 'list-item', children: [{text: "quis leo"}, {text: "QUIS LEO", bold: true}]},
                {type: 'list-item', children: [
                    {type: 'paragraph', children: [{text: "vel aliquet"}]},
                    {type: listType, children: [
                        {type: 'list-item', checked: true, children: [{text: "Vestibulum eget"}]},
                        {type: 'list-item', checked: false, children: [{text: "mobilis in mobili"}]},
                      ]},
                  ]},
                {type: 'list-item', children: [{text: "semper lacus"}]},
              ]},
          ]},
      ]);
    });

    it(`should change ${listType} items to regular list items`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: 'quote', children: [
            {type: listType, children: [
                {type: 'list-item', checked: true, children: [{text: "vehicula nisl"}]},
                {type: 'list-item', checked: true, children: [
                    {type: 'paragraph', children: [{text: "Fusce volutpat"}]},
                    {type: 'numbered-list', children: [
                        {type: 'list-item', children: [{text: "condimentum rutrum"}]},
                      ]},
                  ]},
                {type: 'list-item', checked: true, children: [{text: "This one is moved"}]},
                {type: 'list-item', checked: true, children: [{text: "Quisque justo"}]},
              ]},
          ]},
      ];
      Transforms.select(editor, {
        anchor: {path: [0, 0, 2, 0], offset: 0},
        focus: {path: [0, 0, 2, 0], offset: 0},
      });
      expect(getRelevantBlockType(editor)).toEqual('list-item');

      tabRight(editor);

      expect(editor.children).toEqual([
        {type: 'quote', children: [
            {type: listType, children: [
                {type: 'list-item', checked: true, children: [{text: "vehicula nisl"}]},
                {type: 'list-item', checked: true, children: [
                    {type: 'paragraph', children: [{text: "Fusce volutpat"}]},
                    {type: 'numbered-list', children: [
                        {type: 'list-item', children: [{text: "condimentum rutrum"}]},
                        {type: 'list-item', children: [{text: "This one is moved"}]},
                      ]},
                  ]},
                {type: 'list-item', checked: true, children: [{text: "Quisque justo"}]},
              ]},
          ]},
      ]);
    });
  }

  it("move collapsed selection in table to beginning of next column of table", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    const nodes = [
      {type: "quote", children: [
          {type: 'table', children: [
              {type: 'table-row', children: [
                  {type: 'table-cell', children: [
                      {text: "Aenean non metus quam."},
                    ]},
                  {type: 'table-cell', children: [
                      {type: 'paragraph', children: [{text: "Nulla nec pretium sem."}]},
                      {type: 'paragraph', children: [{text: "Ut condimentum nisl lorem, et suscipit neque vestibulum non."}]},
                    ]},
                  {type: 'table-cell', children: [
                      {type: 'image', url: 'https://storage.com/?q=pet',
                        title: "Pet of the day",
                        children: [{text: "an alert chinchilla"}]
                      },
                      {type: 'paragraph', children: [{text: "Ut condimentum nisl lorem, et suscipit neque vestibulum non."}]},
                    ]},
                ]},
              {type: 'table-row', children: [
                  {type: 'table-cell', children: [
                      {text: "Proin gravida, magna ut accumsan vestibulum, justo metus euismod elit.", bold: true},
                    ]},
                  {type: 'table-cell', children: [
                      {text: "Donec tempus faucibus enim, a ornare nunc laoreet et.", bold: true},
                    ]},
                  {type: 'table-cell', children: [
                      {text: "Suspendisse vel nisl pulvinar, pretium nulla vel, bibendum diam.", bold: true},
                    ]},
                ]},
            ]},
        ]},
    ];
    editor.children = nodes;
    editor.selection = {
      anchor: { path: [0, 0, 0, 1, 0, 0], offset: 18 },
      focus:  { path: [0, 0, 0, 1, 0, 0], offset: 18 },
    };

    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    tabRight(editor);

    expect(editor.children).toEqual(nodes);
    expect(editor.selection).toEqual({
      anchor: { path: [0, 0, 0, 2, 0, 0], offset: 0 },
      focus:  { path: [0, 0, 0, 2, 0, 0], offset: 0 },
    });
  });

  it("moves collapsed selection in last column to beginning of next row of table", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    const nodes = [
      {type: "quote", children: [
          {type: 'table', children: [
              {type: 'table-row', children: [
                  {type: 'table-cell', children: [
                      {text: "Aenean non metus quam."},
                    ]},
                  {type: 'table-cell', children: [
                      {type: 'paragraph', children: [{text: "Nulla nec pretium sem."}]},
                      {type: 'paragraph', children: [{text: "Ut condimentum nisl lorem, et suscipit neque vestibulum non."}]},
                    ]},
                  {type: 'table-cell', children: [
                      {type: 'image', url: 'https://storage.com/?q=pet',
                        title: "Pet of the day",
                        children: [{text: "an alert chinchilla"}]
                      },
                      {type: 'paragraph', children: [{text: "Ut condimentum nisl lorem, et suscipit neque vestibulum non."}]},
                    ]},
                ]},
              {type: 'table-row', children: [
                  {type: 'table-cell', children: [
                      {type: 'numbered-list', children: [
                          {type: 'list-item', children: [{text: "Proin gravida, magna ut accumsan vestibulum, justo metus euismod elit."}]}
                        ]},
                      {type: 'paragraph', children: [{text: "Proin gravida, magna ut accumsan vestibulum, justo metus euismod elit."}]},
                    ]},
                  {type: 'table-cell', children: [
                      {text: "Donec tempus faucibus enim, a ornare nunc laoreet et.", bold: true},
                    ]},
                  {type: 'table-cell', children: [
                      {text: "Suspendisse vel nisl pulvinar, pretium nulla vel, bibendum diam.", bold: true},
                    ]},
                ]},
            ]},
        ]},
    ];
    editor.children = nodes;
    editor.selection = {
      anchor: { path: [0, 0, 0, 2, 0, 0], offset: 15 },
      focus:  { path: [0, 0, 0, 2, 0, 0], offset: 15 },
    };

    expect(getRelevantBlockType(editor)).toEqual('image');
    tabRight(editor);

    expect(editor.children).toEqual(nodes);
    expect(editor.selection).toEqual({
      anchor: { path: [0, 0, 1, 0, 0, 0, 0], offset: 0 },
      focus:  { path: [0, 0, 1, 0, 0, 0, 0], offset: 0 },
    });
  });

  it("appends paragraph when in table at end of document", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    const nodes = [
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "Vestibulum nec erat"}]},
              {type: 'table-cell', children: [{text: "id purus mattis"}]},
            ]},
        ]},
    ];
    editor.children = nodes;
    const lastPoint = Editor.end(editor, []);
    editor.selection = {
      anchor: JSON.parse(JSON.stringify(lastPoint)),
      focus:  JSON.parse(JSON.stringify(lastPoint))
    };

    expect(getRelevantBlockType(editor)).toEqual('table-cell');
    tabRight(editor);

    expect(editor.children).toEqual([
      ...nodes,
      {type: 'paragraph', children: [{text: ""}]}
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [1, 0], offset: 0},
      focus:  {path: [1, 0], offset: 0},
    });
  });

  it("wraps whole table in block quote", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    const tableNodes = [
        {type: 'table', children: [
            {type: 'table-row', children: [
                {type: 'table-cell', children: [
                    {type: 'paragraph', children: [{text: "blandit tincidunt volutpat"}]},
                    {type: 'paragraph', children: [{text: "Proin sit amet "}]},
                  ]},
                {type: 'table-cell', children: [
                    {type: 'image', url: 'https://storage.com/?q=animal',
                      title: "Animal of the day",
                      children: [{text: "an alert axolotl"}]
                    },
                    {type: 'paragraph', children: [{text: "iaculis justo ut"}]},
                  ]},
              ]},
            {type: 'table-row', children: [
                {type: 'table-cell', children: [
                    {type: 'numbered-list', children: [
                        {type: 'list-item', children: [{text: "pretium leo"}]}
                      ]},
                    {type: 'paragraph', children: [{text: ""}]},
                  ]},
                {type: 'table-cell', children: [
                    {text: "Phasellus ultricies enim"},
                  ]},
              ]},
          ]},
    ];
    const nodes = [
      {type: 'heading-one', children: [{text: "Etiam imperdiet"}]},
        ...tableNodes.slice(0),
      {type: 'code', children: [{text: "let h = i * j;"}]}
    ];
    editor.children = nodes;
    editor.selection = {
      anchor: { path: [1, 0, 0, 0, 0], offset: 0 },
      focus:  { path: [1, 1, 1, 0], offset: 24 },
    };

    expect(getRelevantBlockType(editor)).toEqual('table');
    tabRight(editor);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "Etiam imperdiet"}]},
      {type: 'quote', children: tableNodes},
      {type: 'code', children: [{text: "let h = i * j;"}]}
    ]);
    // expect(editor.selection).toEqual({
    //   anchor: { path: [0, 0, 1, 0, 0, 0, 0], offset: 0 },
    //   focus:  { path: [0, 0, 1, 0, 0, 0, 0], offset: 0 },
    // });
  });

  it("changes a paragraph to a block quote, when selection at start of block", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'heading-one', children: [{text: "Curabitur nec mi non nisi cursus aliquam."}]},
      {type: 'paragraph', children: [
          {text: "Sed sed euismod ante."},
          {text: "Donec tempor, nibh eu tincidunt vulputate ", bold: true},
          {text: "ex odio vestibulum mauris"},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [1, 0], offset: 0},
      focus: {path: [1, 0], offset: 0}
    });

    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    tabRight(editor);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "Curabitur nec mi non nisi cursus aliquam."}]},
      {type: 'quote', children: [
          {text: "Sed sed euismod ante."},
          {text: "Donec tempor, nibh eu tincidunt vulputate ", bold: true},
          {text: "ex odio vestibulum mauris"},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('quote');
  });

  it("wraps multiple blocks in a block quote, when selection at start of block", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'heading-one', children: [{text: "Etiam varius suscipit tortor vel"}]},
      {type: 'paragraph', children: [
          {text: "Nunc nibh est"},
        ]},
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "efficitur vitae nunc eu"},
                ]},
            ]},
        ]},
      {type: 'paragraph', children: [
          {text: "cursus pharetra enim"},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [2, 0, 0, 0], offset: 23},
      focus: {path: [1, 0], offset: 0},
    });

    expect(getRelevantBlockType(editor)).toEqual('multiple');
    tabRight(editor);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "Etiam varius suscipit tortor vel"}]},
      {type: 'quote', children: [
          {type: 'paragraph', children: [
              {text: "Nunc nibh est"},
            ]},
          {type: 'table', children: [
              {type: 'table-row', children: [
                  {type: 'table-cell', children: [
                      {text: "efficitur vitae nunc eu"},
                    ]},
                ]},
            ]},
        ]},
      {type: 'paragraph', children: [
          {text: "cursus pharetra enim"},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('quote');
  });

  it("doesn't change a paragraph to a block quote, when selection at start of leaf", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'heading-one', children: [{text: "Pellentesque sollicitudin mauris et ligula convallis hendrerit."}]},
      {type: 'paragraph', children: [
          {text: "Vivamus, "},
          {text: "dapibus ut odio.", bold: true},
          {text: "Maecenas dictum porttitor eros"},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [1, 1], offset: 0},
      focus: {path: [1, 1], offset: 0}
    });

    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    tabRight(editor);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "Pellentesque sollicitudin mauris et ligula convallis hendrerit."}]},
      {type: 'paragraph', children: [
          {text: "Vivamus, "},
          {text: "   dapibus ut odio.", bold: true},
          {text: "Maecenas dictum porttitor eros"},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('paragraph');
  });

  it("inserts spaces to advance to next multiple of four characters in top-level paragraph", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'heading-one', children: [{text: "Maecenas sed mauris vel purus vulputate varius."}]},
      {type: 'paragraph', children: [
          {text: "Nulla dignissim libero et ante commodo, vehicula fermentum odio fringilla"},
          {text: "Quisque scelerisque ullamcorper nunc, eu commodo eros consequat in.", bold: true},
          {text: "Proin sollicitudin diam quis nulla lobortis, sed semper purus vehicula."},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [1, 1], offset: 1},
      focus: {path: [1, 1], offset: 1}
    });

    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    tabRight(editor);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "Maecenas sed mauris vel purus vulputate varius."}]},
      {type: 'paragraph', children: [
          {text: "Nulla dignissim libero et ante commodo, vehicula fermentum odio fringilla"},
          {text: "Q  uisque scelerisque ullamcorper nunc, eu commodo eros consequat in.", bold: true},
          {text: "Proin sollicitudin diam quis nulla lobortis, sed semper purus vehicula."},
        ]},
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [1, 1], offset: 3},
      focus: {path: [1, 1], offset: 3}
    });

    tabRight(editor);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "Maecenas sed mauris vel purus vulputate varius."}]},
      {type: 'paragraph', children: [
          {text: "Nulla dignissim libero et ante commodo, vehicula fermentum odio fringilla"},
          {text: "Q      uisque scelerisque ullamcorper nunc, eu commodo eros consequat in.", bold: true},
          {text: "Proin sollicitudin diam quis nulla lobortis, sed semper purus vehicula."},
        ]},
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [1, 1], offset: 7},
      focus: {path: [1, 1], offset: 7}
    });
  });

  it("inserts spaces to advance to next multiple of four characters in monospaced", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'heading-one', children: [{text: "Quisque iaculis tristique porttitor."}]},
      {type: 'code', children: [
          {text: `  def update
    @article = `},
          {text: `Article`, bold: true},
          {text: `.find(params[:id])
`},
          {text: `if @article.update(article_params)`, italic: true},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [1, 2], offset: 2},
      focus:  {path: [1, 2], offset: 2}
    });

    expect(getRelevantBlockType(editor)).toEqual('code');
    tabRight(editor);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "Quisque iaculis tristique porttitor."}]},
      {type: 'code', children: [
          {text: `  def update
    @article = `},
          {text: `Article`, bold: true},
          {text: `.f   ind(params[:id])
`},
          {text: `if @article.update(article_params)`, italic: true},
        ]},
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [1, 2], offset: 5},
      focus:  {path: [1, 2], offset: 5}
    });

    tabRight(editor);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "Quisque iaculis tristique porttitor."}]},
      {type: 'code', children: [
          {text: `  def update
    @article = `},
          {text: `Article`, bold: true},
          {text: `.f       ind(params[:id])
`},
          {text: `if @article.update(article_params)`, italic: true},
        ]},
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [1, 2], offset: 9},
      focus:  {path: [1, 2], offset: 9}
    });
  });

  it("doesn't insert spaces if selection expanded", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    const originalNodes = [
      {type: 'heading-one', children: [{text: "Sed iaculis sed sapien vitae semper."}]},
      {type: 'code', children: [
          {text: `   <%= form.select :status, ['public', 'private', 'archived'],`},
        ]},
    ];
    editor.children = originalNodes;
    const originalSelection = {
      anchor: {path: [1, 0], offset: 7},
      focus:  {path: [1, 0], offset: 11}
    };
    Transforms.select(editor, originalSelection);

    expect(getRelevantBlockType(editor)).toEqual('code');
    tabRight(editor);

    expect(editor.children).toEqual(originalNodes);
    expect(editor.selection).toEqual(originalSelection);
  });

  it("doesn't change block type if Markdown", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'markdown;hint=COMMONMARK';
    const originalNodes = [
      {type: 'paragraph', children: [
          {text: `Curabitur quis molestie quam.`},
        ]},
    ];
    editor.children = originalNodes;
    const originalSelection = {
      anchor: {path: [0, 0], offset: 0},
      focus:  {path: [0, 0], offset: 0}
    };
    Transforms.select(editor, originalSelection);

    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    tabRight(editor);

    expect(editor.children).toEqual([
      {type: 'paragraph', children: [
          {text: `    Curabitur quis molestie quam.`},
        ]},
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [0, 0], offset: 4},
      focus:  {path: [0, 0], offset: 4}
    });
    expect(getRelevantBlockType(editor)).toEqual('paragraph');
  });
});

describe("tabLeft", () => {
  for (const listType of ['bulleted-list', 'numbered-list', 'task-list', 'sequence-list']) {
    it(`should do nothing if ${listType} item not in sub-list`, () => {
      console.info = jest.fn();
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      const nodes = [
        {type: 'heading-two', children: [{text: "Vestibulum sollicitudin dignissim justo placerat cursus."}]},
        {type: listType, children: [
            {type: 'list-item', children: [{text: "unchanged"}]},
            {type: 'list-item', children: [{text: "unaltered"}]},
            {type: 'list-item', children: [{text: "unaffected"}]},
          ]},
      ];
      editor.children = nodes;
      Transforms.select(editor, {
        anchor: {path: [1, 1, 0], offset: 2},
        focus: {path: [1, 1, 0], offset: 2},
      });

      expect(getRelevantBlockType(editor)).toEqual('list-item');
      tabLeft(editor);

      expect(editor.children).toEqual(nodes);
      expect(editor.selection).toEqual({
        anchor: {path: [1, 1, 0], offset: 2},
        focus: {path: [1, 1, 0], offset: 2},
      });
    });

    it(`should do nothing if middle item in ${listType} sub-list`, () => {
      console.info = jest.fn();
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      const nodes = [
        {type: 'heading-two', children: [{text: "Vivamus id ligula justo."}]},
        {type: 'bulleted-list', children: [
            {type: 'list-item', children: [{text: "this"}]},
            {type: 'list-item', children: [
                {type: 'paragraph', children: [{text: "won't"}]},
                {type: listType, children: [
                    {type: 'list-item', children: [{text: " change"}]},
                    {type: 'list-item', children: [{text: " at", italic: true}]},
                    {type: 'list-item', children: [{text: " all"}]},
                  ]},

              ]},
            {type: 'list-item', children: [{text: "Nope!"}]},
          ]},
      ];
      editor.children = nodes;
      Transforms.select(editor, {
        anchor: {path: [1, 1, 1, 1], offset: 2},
        focus:  {path: [1, 1, 1, 1], offset: 2},
      });

      expect(getRelevantBlockType(editor)).toEqual('list-item');
      tabLeft(editor);

      expect(editor.children).toEqual(nodes);
      expect(editor.selection).toEqual({
        anchor: {path: [1, 1, 1, 1], offset: 2},
        focus:  {path: [1, 1, 1, 1], offset: 2},
      });
    });
  }

  for (const listType of ['bulleted-list', 'numbered-list']) {
    it(`should make first item in ${listType} sub-list a new item in parent list`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: 'heading-two', children: [{text: "Pellentesque eu tellus accumsan"}]},
        {type: 'bulleted-list', children: [
            {type: 'list-item', children: [{text: "static"}]},
            {type: 'list-item', children: [
                {type: 'paragraph', children: [{text: "still "}, {text: "top-level", bold: true}]},
                {type: listType, children: [
                    {type: 'list-item', children: [
                        {text: "changes to "},
                        {text: "top-level", bold: true},
                      ]},
                    {type: 'list-item', children: [
                        {text: "remains "},
                        {text: "sub-item", bold: true},
                      ]},
                  ]},

              ]},
            {type: 'list-item', children: [{text: "unmoved"}]},
          ]},
      ];
      Transforms.select(editor, {
        anchor: {path: [1, 1, 1, 0, 0], offset: 7},
        focus:  {path: [1, 1, 1, 0, 0], offset: 7},
      });

      expect(getRelevantBlockType(editor)).toEqual('list-item');
      tabLeft(editor);

      expect(editor.children).toEqual([
        {type: 'heading-two', children: [{text: "Pellentesque eu tellus accumsan"}]},
        {type: 'bulleted-list', children: [
            {type: 'list-item', children: [{text: "static"}]},
            {type: 'list-item', children: [{text: "still "}, {text: "top-level", bold: true}]},
            {type: 'list-item', children: [
                {type: 'paragraph', children: [
                    {text: "changes to "},
                    {text: "top-level", bold: true},
                  ]},
                {type: listType, children: [
                    {type: 'list-item', children: [
                        {text: "remains "},
                        {text: "sub-item", bold: true},
                      ]},
                  ]},
              ]},
            {type: 'list-item', children: [{text: "unmoved"}]},
          ]},
      ]);
      expect(editor.selection).toEqual({
        anchor: {path: [1, 2, 0, 0], offset: 0},
        focus:  {path: [1, 2, 0, 0], offset: 0},
      });
    });
  }

  for (const listType of ['task-list', 'sequence-list']) {
    it(`should make first item in ${listType} sub-list a new item in parent list`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: 'heading-two', children: [{text: "Pellentesque eu tellus accumsan"}]},
        {type: 'bulleted-list', children: [
            {type: 'list-item', children: [{text: "static"}]},
            {type: 'list-item', children: [
                {type: 'paragraph', children: [{text: "still "}, {text: "top-level", bold: true}]},
                {type: listType, children: [
                    {type: 'list-item', checked: true, children: [
                        {text: "changes to "},
                        {text: "top-level", bold: true},
                      ]},
                    {type: 'list-item', checked: true, children: [
                        {text: "remains "},
                        {text: "sub-item", bold: true},
                      ]},
                  ]},

              ]},
            {type: 'list-item', children: [{text: "unmoved"}]},
          ]},
      ];
      Transforms.select(editor, {
        anchor: {path: [1, 1, 1, 0, 0], offset: 7},
        focus:  {path: [1, 1, 1, 0, 0], offset: 7},
      });

      expect(getRelevantBlockType(editor)).toEqual('list-item');
      tabLeft(editor);

      expect(editor.children).toEqual([
        {type: 'heading-two', children: [{text: "Pellentesque eu tellus accumsan"}]},
        {type: 'bulleted-list', children: [
            {type: 'list-item', children: [{text: "static"}]},
            {type: 'list-item', children: [{text: "still "}, {text: "top-level", bold: true}]},
            {type: 'list-item', children: [
                {type: 'paragraph', children: [
                    {text: "changes to "},
                    {text: "top-level", bold: true},
                  ]},
                {type: listType, children: [
                    {type: 'list-item', checked: true, children: [
                        {text: "remains "},
                        {text: "sub-item", bold: true},
                      ]},
                  ]},
              ]},
            {type: 'list-item', children: [{text: "unmoved"}]},
          ]},
      ]);
      expect(editor.selection).toEqual({
        anchor: {path: [1, 2, 0, 0], offset: 0},
        focus:  {path: [1, 2, 0, 0], offset: 0},
      });
    });
  }

  for (const listType of ['task-list', 'sequence-list']) {
    it(`should make first item in sub-list a new item in parent ${listType}`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: 'heading-two', children: [{text: "volutpat nec"}]},
        {type: listType, children: [
            {type: 'list-item', checked: true, children: [{text: "dui sit amet"}]},
            {type: 'list-item', checked: true, children: [
                {type: 'paragraph', children: [{text: "vehicula sagittis"}]},
                {type: 'numbered-list', children: [
                    {type: 'list-item', children: [
                        {text: "moves to "},
                        {text: "top-level", bold: true},
                      ]},
                    {type: 'list-item', children: [
                        {text: "stays in "},
                        {text: "sub-list", bold: true},
                      ]},
                  ]},

              ]},
            {type: 'list-item', checked: true, children: [{text: "Aenean nec"}]},
          ]},
      ];
      Transforms.select(editor, {
        anchor: {path: [1, 1, 1, 0, 0], offset: 7},
        focus:  {path: [1, 1, 1, 0, 0], offset: 7},
      });

      expect(getRelevantBlockType(editor)).toEqual('list-item');
      tabLeft(editor);

      expect(editor.children).toEqual([
        {type: 'heading-two', children: [{text: "volutpat nec"}]},
        {type: listType, children: [
            {type: 'list-item', checked: true, children: [{text: "dui sit amet"}]},
            {type: 'list-item', checked: true, children: [
                {text: "vehicula sagittis"},
              ]},
            {type: 'list-item', checked: false, children: [
                {type: 'paragraph', children: [
                    {text: "moves to "},
                    {text: "top-level", bold: true},
                  ]},
                {type: 'numbered-list', children: [
                    {type: 'list-item', children: [
                        {text: "stays in "},
                        {text: "sub-list", bold: true},
                      ]},
                  ]},
              ]},
            {type: 'list-item', checked: true, children: [{text: "Aenean nec"}]},
          ]},
      ]);
      expect(editor.selection).toEqual({
        anchor: {path: [1, 2, 0, 0], offset: 0},
        focus:  {path: [1, 2, 0, 0], offset: 0},
      });
    });
  }

  it("should move item which contains whole selection", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'heading-two', children: [{text: "Pellentesque eu tellus accumsan"}]},
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "111"}]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "222"}]},
              {type: 'bulleted-list', children: [
                  {type: 'list-item', children: [{text: "222AAA"}]},
                  {type: 'list-item', children: [
                      {type: 'paragraph', children: [{text: "222BBB"}]},
                      {type: 'numbered-list', children: [
                          {type: 'list-item', children: [{text: "222BBBi"}]},
                          {type: 'list-item', children: [
                              {type: 'paragraph', children: [{text: "222BBBii"}]},
                              {type: 'bulleted-list', children: [
                                  {type: 'list-item', children: [{text: "222BBBiia a"}]},
                                  {type: 'list-item', children: [{text: "222BBBiib b"}]},
                                ]},
                            ]},
                          {type: 'list-item', children: [
                              {type: 'paragraph', children: [{text: "222BBBii"}]},
                              {type: 'bulleted-list', children: [
                                  {type: 'list-item', children: [{text: "222BBBiiia a"}]},
                                  {type: 'list-item', children: [{text: "222BBBiiib b"}]},
                                ]},
                            ]},
                        ]},
                    ]},
                ]},
            ]},
          {type: 'list-item', children: [{text: "333"}]},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [1, 1, 1, 1, 1, 1, 1, 1, 0], offset: 10},
      focus:  {path: [1, 1, 1, 1, 1, 2, 1, 0, 0], offset: 10},
    });

    expect(getRelevantBlockType(editor)).toEqual('numbered-list');
    tabLeft(editor);

    expect(editor.children).toEqual([
      {type: 'heading-two', children: [{text: "Pellentesque eu tellus accumsan"}]},
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "111"}]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "222"}]},
              {type: 'bulleted-list', children: [
                  {type: 'list-item', children: [{text: "222AAA"}]},
                ]},
            ]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "222BBB"}]},
              {type: 'numbered-list', children: [
                  {type: 'list-item', children: [{text: "222BBBi"}]},
                  {type: 'list-item', children: [
                      {type: 'paragraph', children: [{text: "222BBBii"}]},
                      {type: 'bulleted-list', children: [
                          {type: 'list-item', children: [{text: "222BBBiia a"}]},
                          {type: 'list-item', children: [{text: "222BBBiib b"}]},
                        ]},
                    ]},
                  {type: 'list-item', children: [
                      {type: 'paragraph', children: [{text: "222BBBii"}]},
                      {type: 'bulleted-list', children: [
                          {type: 'list-item', children: [{text: "222BBBiiia a"}]},
                          {type: 'list-item', children: [{text: "222BBBiiib b"}]},
                        ]},
                    ]},
                ]},
            ]},
          {type: 'list-item', children: [{text: "333"}]},
        ]},
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [1, 2, 0, 0], offset: 0},
      focus:  {path: [1, 2, 0, 0], offset: 0},
    });
  });

  it("should handle list items containing blocks", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'heading-two', children: [{text: "Proin volutpat sapien vel ante porttitor varius."}]},
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "motionless"}]},
          {type: 'list-item', children: [
              {type: 'quote', children: [
                  {text: "visible in "},
                  {text: "parent list", bold: true}
                ]},
              {type: 'bulleted-list', children: [
                  {type: 'list-item', children: [
                      {type: 'code', children: [
                          {text: "moves to "},
                          {text: "parent list", bold: true},
                        ]},
                    ]},
                  {type: 'list-item', children: [
                      {type: 'quote', children: [
                          {text: "stays in "},
                          {text: "sublist", bold: true},
                        ]},
                    ]},
                ]},

            ]},
          {type: 'list-item', children: [{text: "no change"}]},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [1, 1, 1, 0, 0, 1], offset: 6},
      focus:  {path: [1, 1, 1, 0, 0, 1], offset: 6},
    });

    expect(getRelevantBlockType(editor)).toEqual('code');
    tabLeft(editor);

    expect(editor.children).toEqual([
      {type: 'heading-two', children: [{text: "Proin volutpat sapien vel ante porttitor varius."}]},
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "motionless"}]},
          {type: 'list-item', children: [
              {type: 'quote', children: [
                  {text: "visible in "},
                  {text: "parent list", bold: true}
                ]},
            ]},
          {type: 'list-item', children: [
              {type: 'code', children: [
                  {text: "moves to "},
                  {text: "parent list", bold: true},
                ]},
              {type: 'bulleted-list', children: [
                  {type: 'list-item', children: [
                      {type: 'quote', children: [
                          {text: "stays in "},
                          {text: "sublist", bold: true},
                        ]},
                    ]},
                ]},
            ]},
          {type: 'list-item', children: [{text: "no change"}]},
        ]},
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [1, 2, 0, 0], offset: 0},
      focus:  {path: [1, 2, 0, 0], offset: 0},
    });
  });

  it("should revert tabRight", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    const originalNodes = [
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "ichi"}]},
          {type: 'list-item', children: [{text: "ni"}, {text: "NI", bold: true}]},
          {type: 'list-item', children: [{text: "san"}, {text: "SAN",bold: true}]},
          {type: 'list-item', children: [{text: "shi"}]},
        ]},
    ];
    editor.children = originalNodes;
    Transforms.select(editor, {
      anchor: {path: [0, 2, 0], offset: 2},
      focus: {path: [0, 2, 0], offset: 2}
    });
    expect(getRelevantBlockType(editor)).toEqual('list-item');

    tabRight(editor);

    expect(editor.children).toEqual([
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "ichi"}]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "ni"}, {text: "NI", bold: true}]},
              {type: 'numbered-list', children: [
                  {type: 'list-item', children: [{text: "san"}, {text: "SAN",bold: true}]},
                ]},
            ]},
          {type: 'list-item', children: [{text: "shi"}]},
        ]},
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [0, 1, 1, 0, 0], offset: 2},
      focus: {path: [0, 1, 1, 0, 0], offset: 2},
    });
    expect(getRelevantBlockType(editor)).toEqual('list-item');

    tabLeft(editor);

    expect(editor.children).toEqual(originalNodes);
  });

  it("should move sub-sub-list items to sub-list", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'heading-one', children: [{text: "Etiam tempor nisl quis eros gravida pulvinar."}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "oceans unmoving"}]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "remains "}, {text: "top-level", bold: true}]},
              {type: 'numbered-list', children: [
                  {type: 'list-item', children: [
                      {type: 'paragraph', children: [
                          {text: "altered to "},
                          {text: "top-level", bold: true},
                        ]},
                      {type: 'bulleted-list', children: [
                          {type: 'list-item', children: [
                              {text: "follows as "},
                              {text: "sub-item of top-level", bold: true},
                            ]},
                          {type: 'list-item', children: [
                              {text: "also follows "},
                              {text: "as sub-item of top-level", bold: true},
                            ]},
                        ]},
                    ]},
                  {type: 'list-item', children: [{text: "second in sub-list"}]},
                ]},
            ]},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [1, 1, 1, 0, 0, 1], offset: 4},
      focus:  {path: [1, 1, 1, 0, 0, 1], offset: 4},
    });

    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    tabLeft(editor);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "Etiam tempor nisl quis eros gravida pulvinar."}]},
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "oceans unmoving"}]},
          {type: 'list-item', children: [{text: "remains "}, {text: "top-level", bold: true}]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [
                  {text: "altered to "},
                  {text: "top-level", bold: true},
                ]},
              {type: 'numbered-list', children: [
                  {type: 'list-item', children: [
                      {text: "follows as "},
                      {text: "sub-item of top-level", bold: true},
                    ]},
                  {type: 'list-item', children: [
                      {text: "also follows "},
                      {text: "as sub-item of top-level", bold: true},
                    ]},
                  {type: 'list-item', children: [{text: "second in sub-list"}]},
                ]},
            ]},
        ]},
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [1, 2, 0, 0], offset: 0},
      focus:  {path: [1, 2, 0, 0], offset: 0},
    });
  });

  it("should make last item in sub-list a new item in parent list, keeping its children", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "A bedrock"}]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "B parent "}, {text: "item", italic: true}]},
              {type: 'bulleted-list', children: [
                  {type: 'list-item', children: [{text: "C first child"}]},
                  {type: 'list-item', children: [{text: "D poor middle child"}]},
                  {type: 'list-item', children: [
                      {type: 'paragraph', children: [
                          {text: "E last "},
                          {text: "child", italic: true},
                        ]},
                      {type: 'numbered-list', children: [
                          {type: 'list-item', children: [
                              {text: "F first "},
                              {text: "sub-sub-item", italic: true},
                            ]},
                          {type: 'list-item', children: [
                              {text: "G second "},
                              {text: "sub-sub-item", italic: true},
                            ]},
                        ]},
                    ]},
                ]},
            ]},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [0, 1, 1, 2, 0, 1], offset: 5},
      focus:  {path: [0, 1, 1, 2, 0, 1], offset: 5},
    });

    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    tabLeft(editor);

    expect(editor.children).toEqual([
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "A bedrock"}]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "B parent "}, {text: "item", italic: true}]},
              {type: 'bulleted-list', children: [
                  {type: 'list-item', children: [{text: "C first child"}]},
                  {type: 'list-item', children: [{text: "D poor middle child"}]},
                ]},
            ]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [
                  {text: "E last "},
                  {text: "child", italic: true},
                ]},
              {type: 'numbered-list', children: [
                  {type: 'list-item', children: [
                      {text: "F first "},
                      {text: "sub-sub-item", italic: true},
                    ]},
                  {type: 'list-item', children: [
                      {text: "G second "},
                      {text: "sub-sub-item", italic: true},
                    ]},
                ]},
            ]},
        ]},
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [0, 2, 0, 0], offset: 0},
      focus:  {path: [0, 2, 0, 0], offset: 0},
    });
  });

  for (const listType of ['task-list', 'sequence-list']) {
    it(`should make last item in ${listType} a new item in parent ordered-list, keeping its children`, () => {
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: 'numbered-list', children: [
            {type: 'list-item', children: [{text: "alpha"}]},
            {type: 'list-item', children: [
                {type: 'paragraph', children: [{text: "beta parent"}]},
                {type: listType, children: [
                    {type: 'list-item', checked: false, children: [{text: "gamma erste kind"}]},
                    {type: 'list-item', checked: true, children: [{text: "delta mittel kind"}]},
                    {type: 'list-item', checked: false, children: [
                        {type: 'quote', children: [{text: "epsilon letzte kind"}]},
                        {type: 'bulleted-list', children: [
                            {type: 'list-item', children: [{text: "zeta uno"}]},
                            {type: 'list-item', children: [{text: "eta dos"}]},
                          ]},
                      ]},
                  ]},
              ]},
          ]},
      ];
      Transforms.select(editor, {
        anchor: {path: [0, 1, 1, 2, 0, 0], offset: 3},
        focus:  {path: [0, 1, 1, 2, 0, 0], offset: 3},
      });

      expect(getRelevantBlockType(editor)).toEqual('quote');
      tabLeft(editor);

      expect(editor.children).toEqual([
        {type: 'numbered-list', children: [
            {type: 'list-item', children: [{text: "alpha"}]},
            {type: 'list-item', children: [
                {type: 'paragraph', children: [{text: "beta parent"}]},
                {type: listType, children: [
                    {type: 'list-item', checked: false, children: [{text: "gamma erste kind"}]},
                    {type: 'list-item', checked: true, children: [{text: "delta mittel kind"}]},
                  ]},
              ]},
            {type: 'list-item', children: [
                {type: 'quote', children: [{text: "epsilon letzte kind"}]},
                {type: 'bulleted-list', children: [
                    {type: 'list-item', children: [{text: "zeta uno"}]},
                    {type: 'list-item', children: [{text: "eta dos"}]},
                  ]},
              ]},
          ]},
      ]);
      expect(editor.selection).toEqual({
        anchor: {path: [0, 2, 0, 0], offset: 0},
        focus:  {path: [0, 2, 0, 0], offset: 0},
      });
    });
  }

  it("move collapsed selection in table to beginning of previous column or row of table", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    const nodes = [
      {type: "quote", children: [
          {type: 'table', children: [
              {type: 'table-row', children: [
                  {type: 'table-cell', children: [
                      {text: "Aenean ultricies augue arcu"},
                    ]},
                  {type: 'table-cell', children: [
                      {type: 'paragraph', children: [{text: "Nunc non finibus nisi"}]},
                      {type: 'paragraph', children: [{text: "Integer risus metus, pretium vitae ligula ut,"}]},
                    ]},
                  {type: 'table-cell', children: [
                      {type: 'image', url: 'https://storage.com/?q=wildanimal',
                        title: "Wild Animal of the day",
                        children: [{text: "a drowsy crocodile"}]
                      },
                      {type: 'paragraph', children: [{text: "Nunc non finibus nisi."}]},
                    ]},
                ]},
              {type: 'table-row', children: [
                  {type: 'table-cell', children: [
                      {text: "Suspendisse sollicitudin mi sit amet nisi congue, at feugiat sapien tempor."},
                      {text: "Vestibulum eget ultricies ligula.", bold: true},
                    ]},
                  {type: 'table-cell', children: [
                      {type: 'paragraph', children: [{text: "Maecenas rutrum, sapien ac fermentum varius"}]},
                      {type: 'paragraph', children: [{text: "Pellentesque habitant morbi tristique senectus"}]},
                    ]},
                  {type: 'table-cell', children: [
                      {text: "Interdum et malesuada fames ac ante ipsum primis in faucibus.", bold: true},
                    ]},
                ]},
            ]},
        ]},
    ];
    editor.children = nodes;
    editor.selection = {
      anchor: { path: [0, 0, 1, 1, 1, 0], offset: 68 },
      focus:  { path: [0, 0, 1, 1, 1, 0], offset: 68 },
    };

    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    tabLeft(editor);

    expect(editor.children).toEqual(nodes);
    expect(editor.selection).toEqual({
      anchor: { path: [0, 0, 1, 0, 1], offset: 33 },
      focus:  { path: [0, 0, 1, 0, 1], offset: 33 },
    });

    expect(getRelevantBlockType(editor)).toEqual('table-cell');
    tabLeft(editor);

    expect(editor.children).toEqual(nodes);
    expect(editor.selection).toEqual({
      anchor: { path: [0, 0, 0, 2, 1, 0], offset: 22 },
      focus:  { path: [0, 0, 0, 2, 1, 0], offset: 22 },
    });
  });

  it("prepends paragraph when in table at beginning of document", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    const nodes = [
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "Vestibulum nec erat"}]},
              {type: 'table-cell', children: [{text: "id purus mattis"}]},
            ]},
        ]},
    ];
    editor.children = nodes;
    const firstPoint = Editor.start(editor, []);
    editor.selection = {
      anchor: JSON.parse(JSON.stringify(firstPoint)),
      focus:  JSON.parse(JSON.stringify(firstPoint))
    };

    expect(getRelevantBlockType(editor)).toEqual('table-cell');
    tabLeft(editor);

    expect(editor.children).toEqual([
      {type: 'paragraph', children: [{text: ""}]},
      ...nodes
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [0, 0], offset: 0},
      focus:  {path: [0, 0], offset: 0},
    });
  });

  it("should change block quote to paragraph", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'code', children: [{text: "nec feugiat diam"}]},
      {
        type: 'quote', children: [
          {text: "metus nec eleifend"},
          {text: "enim magna egestas", italic: true},
        ]
      },
      {type: 'heading-three', children: [{text: "nisl non purus"}]}
    ];
    Transforms.select(editor, {
      anchor: {path: [1, 0], offset: 0},
      focus: {path: [1, 0], offset: 0}
    });

    expect(getRelevantBlockType(editor)).toEqual('quote');
    tabLeft(editor);

    expect(editor.children).toEqual([
      {type: 'code', children: [{text: "nec feugiat diam"}]},
      {type: 'paragraph', children: [
          {text: "metus nec eleifend"},
          {text: "enim magna egestas", italic: true},
        ]},
      {type: 'heading-three', children: [{text: "nisl non purus"}]}
    ]);
    expect(getRelevantBlockType(editor)).toEqual('paragraph');
  });

  it("unwraps a top-level block quote, when selection at start of block", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'heading-one', children: [{text: "condimentum velit facilisis vel"}]},
      {type: 'quote', children: [
          {type: 'paragraph', children: [
              {text: "Fusce pretium "},
              {text: "eros molestie semper fermentum", bold: true},
              {text: " ligula neque volutpat purus"},
            ]},
          {type: 'numbered-list', children: [
              {type: 'list-item', children: [
                  {text: "Mauris blandit felis ut neque mollis ultricies."}
                ]},
            ]},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [1, 0, 0], offset: 0},
      focus: {path: [1, 0, 0], offset: 0}
    });

    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    tabLeft(editor);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "condimentum velit facilisis vel"}]},
      {type: 'paragraph', children: [
          {text: "Fusce pretium "},
          {text: "eros molestie semper fermentum", bold: true},
          {text: " ligula neque volutpat purus"},
        ]},
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [
              {text: "Mauris blandit felis ut neque mollis ultricies."}
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('paragraph');
  });

  it("unwraps a block quote, when selection at start of second block", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'heading-one', children: [{text: "condimentum velit facilisis vel"}]},
      {type: 'quote', children: [
          {type: 'paragraph', children: [
              {text: "Fusce pretium "},
              {text: "eros molestie semper fermentum", bold: true},
              {text: " ligula neque volutpat purus"},
            ]},
          {type: 'numbered-list', children: [
              {type: 'list-item', children: [
                  {text: "Mauris blandit felis ut neque mollis ultricies."}
                ]},
            ]},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [1, 1, 0, 0], offset: 0},
      focus: {path: [1, 1, 0, 0], offset: 0}
    });

    expect(getRelevantBlockType(editor)).toEqual('list-item');
    tabLeft(editor);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "condimentum velit facilisis vel"}]},
      {type: 'paragraph', children: [
          {text: "Fusce pretium "},
          {text: "eros molestie semper fermentum", bold: true},
          {text: " ligula neque volutpat purus"},
        ]},
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [
              {text: "Mauris blandit felis ut neque mollis ultricies."}
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('list-item');
  });

  it("doesn't unwrap a top-level block quote, when selection at start of leaf", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'heading-one', children: [{text: "condimentum velit facilisis vel"}]},
      {type: 'quote', children: [
          {type: 'paragraph', children: [
              {text: "Fusce pretium "},
              {text: "eros molestie semper fermentum", bold: true},
              {text: " ligula neque volutpat purus"},
            ]},
          {type: 'numbered-list', children: [
              {type: 'list-item', children: [
                  {text: "Mauris blandit felis ut neque mollis ultricies."}
                ]},
            ]},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [1, 0, 1], offset: 0},
      focus: {path: [1, 0, 1], offset: 0}
    });

    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    tabLeft(editor);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "condimentum velit facilisis vel"}]},
      {type: 'quote', children: [
          {type: 'paragraph', children: [
              {text: "Fusce pretiu"},
              {text: "eros molestie semper fermentum", bold: true},
              {text: " ligula neque volutpat purus"},
            ]},
          {type: 'numbered-list', children: [
              {type: 'list-item', children: [
                  {text: "Mauris blandit felis ut neque mollis ultricies."}
                ]},
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('paragraph');
  });

  it("unwraps a mid-level block quote, when selection at start of block", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'heading-one', children: [{text: "eget sollicitudin mauris"}]},
      {type: 'quote', children: [
          {type: 'quote', children: [
              {type: 'paragraph', children: [
                  {text: "Nullam lacus arcu, "},
                  {text: "rutrum vel ante in,", bold: true},
                  {text: " placerat commodo quam."},
                ]},
            ]},
          {type: 'quote', children: [
              {type: 'paragraph', children: [
                  {text: "Fusce pretium "},
                  {text: "eros molestie semper fermentum", bold: true},
                  {text: " ligula neque volutpat purus"},
                ]},
            ]},
         ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [1, 0, 0, 0], offset: 0},
      focus: {path: [1, 0, 0, 0], offset: 0}
    });

    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    tabLeft(editor);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "eget sollicitudin mauris"}]},
      {type: 'quote', children: [
          {type: 'paragraph', children: [
              {text: "Nullam lacus arcu, "},
              {text: "rutrum vel ante in,", bold: true},
              {text: " placerat commodo quam."},
            ]},
          {type: 'quote', children: [
              {type: 'paragraph', children: [
                  {text: "Fusce pretium "},
                  {text: "eros molestie semper fermentum", bold: true},
                  {text: " ligula neque volutpat purus"},
                ]},
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('paragraph');
  });

  it("removes characters to move back to previous multiple of four characters",() => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'heading-one', children: [{text: "Pellentesque eget pellentesque magna."}]},
      {type: 'code', children: [
          {text: `    def destroy`},
        ]},
      {type: 'code', children: [
          {text: `      `},
          {text: `@comment`, bold: true},
          {text: ` = @article.comments.find(params[:id])`},
        ]},
      {type: 'code', children: [
          {text: `   end`},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [2, 2], offset: 3},
      focus:  {path: [2, 2], offset: 3},
    });

    expect(getRelevantBlockType(editor)).toEqual('code');
    tabLeft(editor);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "Pellentesque eget pellentesque magna."}]},
      {type: 'code', children: [
          {text: `    def destroy`},
        ]},
      {type: 'code', children: [
          {text: `      `},
          {text: `@comment`, bold: true},
          {text: ` =@article.comments.find(params[:id])`},
        ]},
      {type: 'code', children: [
          {text: `   end`},
        ]},
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [2, 2], offset: 2},
      focus:  {path: [2, 2], offset: 2},
    });
  });

  it("doesn't remove characters from previous block", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    const originalNodes = [
      {type: 'heading-one', children: [{text: "Phasellus neque purus, ornare id tellus eget"}]},
      {type: 'code', children: [
          {text: `params.require(:comment).permit(:commenter, :body, :status)`},
        ]},
    ];
    editor.children = originalNodes;
    const originalSelection = {anchor: {path: [1, 0], offset: 0}, focus:  {path: [1, 0], offset: 0}};
    Transforms.select(editor, originalSelection);

    expect(getRelevantBlockType(editor)).toEqual('code');
    tabLeft(editor);

    expect(editor.children).toEqual(originalNodes);
    expect(editor.selection).toEqual(originalSelection);
  });

  it("doesn't remove characters if selection expanded", () => {
    const editor = withHtml(withReact(createEditor()));
    const originalNodes = [
      {type: 'heading-one', children: [{text: "Nam vel pulvinar massa"}]},
      {type: 'code', children: [
          {text: ` <% article.errors.full_messages_for(:body).each do |message| %>`},
        ]},
    ];
    editor.children = originalNodes;
    const originalSelection = {
      anchor: {path: [1, 0], offset: 4},
      focus:  {path: [1, 0], offset: 11}
    };
    Transforms.select(editor, originalSelection);

    expect(getRelevantBlockType(editor)).toEqual('code');
    tabLeft(editor);

    expect(editor.children).toEqual(originalNodes);
    expect(editor.selection).toEqual(originalSelection);
  });
});

describe("toggleCheckListItem", () => {
  it("should move newly-checked task item to end", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'heading-one', children: [{text: "Class aptent taciti sociosqu "}]},
      {type: 'quote', children: [
          {type: 'task-list', children: [
              {type: 'list-item', checked: false, children: [{text: "Donec imperdiet"}]},
              {type: 'list-item', checked: false, children: [
                  {text: "target"},
                  {text: "item", bold: true}
                ]},
              {type: 'list-item', checked: false, children: [{text: "eros sit"}]},
              {type: 'list-item', checked: true, children: [{text: "amet nunc"}]},
              {type: 'list-item', checked: true, children: [{text: "non commodo"}]},
              {type: 'list-item', checked: true, children: [{text: "mauris pulvinar."}]},
            ]},
        ]},
    ];

    toggleCheckListItem(editor, [1, 0, 1], true);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "Class aptent taciti sociosqu "}]},
      {type: 'quote', children: [
          {type: 'task-list', children: [
              {type: 'list-item', checked: false, children: [{text: "Donec imperdiet"}]},
              {type: 'list-item', checked: false, children: [{text: "eros sit"}]},
              {type: 'list-item', checked: true, children: [{text: "amet nunc"}]},
              {type: 'list-item', checked: true, children: [{text: "non commodo"}]},
              {type: 'list-item', checked: true, children: [{text: "mauris pulvinar."}]},
              {type: 'list-item', checked: true, children: [
                  {text: "target", strikethrough: true},
                  {text: "item", bold: true, strikethrough: true}
                ]},
            ]},
        ]},
    ]);
  });

  it("shouldn't move newly-checked sequence item", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'heading-one', children: [{text: "Class aptent taciti sociosqu "}]},
      {type: 'quote', children: [
          {type: 'sequence-list', children: [
              {type: 'list-item', checked: false, children: [{text: "Donec imperdiet"}]},
              {type: 'list-item', checked: false, children: [{text: "target"}]},
              {type: 'list-item', checked: false, children: [{text: "eros sit"}]},
              {type: 'list-item', checked: true, children: [{text: "amet nunc"}]},
              {type: 'list-item', checked: true, children: [{text: "non commodo"}]},
              {type: 'list-item', checked: true, children: [{text: "mauris pulvinar."}]},
            ]},
        ]},
    ];

    toggleCheckListItem(editor, [1, 0, 1], true);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "Class aptent taciti sociosqu "}]},
      {type: 'quote', children: [
          {type: 'sequence-list', children: [
              {type: 'list-item', checked: false, children: [{text: "Donec imperdiet"}]},
              {type: 'list-item', checked: true, children: [{text: "target"}]},
              {type: 'list-item', checked: false, children: [{text: "eros sit"}]},
              {type: 'list-item', checked: true, children: [{text: "amet nunc"}]},
              {type: 'list-item', checked: true, children: [{text: "non commodo"}]},
              {type: 'list-item', checked: true, children: [{text: "mauris pulvinar."}]},
            ]},
        ]},
    ]);
  });

  it(`shouldn't move newly-checked task list item already at end`, () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'heading-one', children: [{text: "a volutpat."}]},
      {type: 'quote', children: [
          {type: 'task-list', children: [
              {type: 'list-item', checked: false, children: [{text: "Donec imperdiet"}]},
              {type: 'list-item', checked: false, children: [{text: "Nam vel eros"}]},
              {type: 'list-item', checked: false, children: [{text: "eu mauris"}]},
              {type: 'list-item', checked: false, children: [
                {text: "this shouldn't move"}]},
            ]},
        ]},
    ];

    toggleCheckListItem(editor, [1, 0, 3], true);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "a volutpat."}]},
      {type: 'quote', children: [
          {type: 'task-list', children: [
              {type: 'list-item', checked: false, children: [{text: "Donec imperdiet"}]},
              {type: 'list-item', checked: false, children: [{text: "Nam vel eros"}]},
              {type: 'list-item', checked: false, children: [{text: "eu mauris"}]},
              {type: 'list-item', checked: true, children: [
                {text: "this shouldn't move", strikethrough: true}]},
            ]},
        ]},
    ]);
  });

  it(`shouldn't move newly-checked sequence list item already at end`, () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'heading-one', children: [{text: "a volutpat."}]},
      {type: 'quote', children: [
          {type: 'sequence-list', children: [
              {type: 'list-item', checked: false, children: [{text: "Donec imperdiet"}]},
              {type: 'list-item', checked: false, children: [{text: "Nam vel eros"}]},
              {type: 'list-item', checked: false, children: [{text: "eu mauris"}]},
              {type: 'list-item', checked: false, children: [{text: "this shouldn't move"}]},
            ]},
        ]},
    ];

    toggleCheckListItem(editor, [1, 0, 3], true);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "a volutpat."}]},
      {type: 'quote', children: [
          {type: 'sequence-list', children: [
              {type: 'list-item', checked: false, children: [{text: "Donec imperdiet"}]},
              {type: 'list-item', checked: false, children: [{text: "Nam vel eros"}]},
              {type: 'list-item', checked: false, children: [{text: "eu mauris"}]},
              {type: 'list-item', checked: true, children: [{text: "this shouldn't move"}]},
            ]},
        ]},
    ]);
  });

  it("should move newly-unchecked task item before first checked item", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'heading-one', children: [{text: "ad litora torquent per conubia"}]},
      {type: 'quote', children: [
          {type: 'task-list', children: [
              {type: 'list-item', checked: false, children: [{text: "per inceptos"}]},
              {type: 'list-item', checked: false, children: [{text: "Curabitur gravida"}]},
              {type: 'list-item', checked: false, children: [{text: "mi eu urna laoreet"}]},
              {type: 'list-item', checked: true, children: [{text: "sit amet pulvinar"}]},
              {type: 'list-item', checked: true, children: [{text: "moved", strikethrough: true}]},
              {type: 'list-item', checked: true, children: [{text: "Curabitur at augue"}]},
            ]},
        ]},
    ];

    toggleCheckListItem(editor, [1, 0, 4], false);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "ad litora torquent per conubia"}]},
      {type: 'quote', children: [
          {type: 'task-list', children: [
              {type: 'list-item', checked: false, children: [{text: "per inceptos"}]},
              {type: 'list-item', checked: false, children: [{text: "Curabitur gravida"}]},
              {type: 'list-item', checked: false, children: [{text: "mi eu urna laoreet"}]},
              {type: 'list-item', checked: false, children: [{text: "moved"}]},
              {type: 'list-item', checked: true, children: [{text: "sit amet pulvinar"}]},
              {type: 'list-item', checked: true, children: [{text: "Curabitur at augue"}]},
            ]},
        ]},
    ]);
  });

  it("shouldn't move newly-unchecked sequence item", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'heading-one', children: [{text: "ad litora torquent per conubia"}]},
      {type: 'quote', children: [
          {type: 'sequence-list', children: [
              {type: 'list-item', checked: false, children: [{text: "per inceptos"}]},
              {type: 'list-item', checked: false, children: [{text: "Curabitur gravida"}]},
              {type: 'list-item', checked: false, children: [{text: "mi eu urna laoreet"}]},
              {type: 'list-item', checked: true, children: [{text: "sit amet pulvinar"}]},
              {type: 'list-item', checked: true, children: [
                {text: "unchecked", strikethrough: true}]},
              {type: 'list-item', checked: true, children: [{text: "Curabitur at augue"}]},
            ]},
        ]},
    ];

    toggleCheckListItem(editor, [1, 0, 4], false);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "ad litora torquent per conubia"}]},
      {type: 'quote', children: [
          {type: 'sequence-list', children: [
              {type: 'list-item', checked: false, children: [{text: "per inceptos"}]},
              {type: 'list-item', checked: false, children: [{text: "Curabitur gravida"}]},
              {type: 'list-item', checked: false, children: [{text: "mi eu urna laoreet"}]},
              {type: 'list-item', checked: true, children: [{text: "sit amet pulvinar"}]},
              {type: 'list-item', checked: false, children: [
                {text: "unchecked", strikethrough: true}]},
              {type: 'list-item', checked: true, children: [{text: "Curabitur at augue"}]},
            ]},
        ]},
    ]);
  });

  it(`shouldn't move newly-unchecked task list item already before first remaining checked item`, () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'heading-one', children: [{text: "ac mi feugiat"}]},
      {type: 'quote', children: [
          {type: 'task-list', children: [
              {type: 'list-item', checked: false, children: [{text: "consectetur at eget"}]},
              {type: 'list-item', checked: false, children: [{text: "Duis tincidunt"}]},
              {type: 'list-item', checked: false, children: [{text: "gravida sapien"}]},
              {type: 'list-item', checked: true, children: [{text: "this shouldn't move", strikethrough: true}]},
              {type: 'list-item', checked: true, children: [{text: "Cras maximus"}]},
              {type: 'list-item', checked: true, children: [{text: "eget sapien"}]},
            ]},
        ]},
    ];

    toggleCheckListItem(editor, [1, 0, 3], false);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "ac mi feugiat"}]},
      {type: 'quote', children: [
          {type: 'task-list', children: [
              {type: 'list-item', checked: false, children: [{text: "consectetur at eget"}]},
              {type: 'list-item', checked: false, children: [{text: "Duis tincidunt"}]},
              {type: 'list-item', checked: false, children: [{text: "gravida sapien"}]},
              {type: 'list-item', checked: false, children: [{text: "this shouldn't move"}]},
              {type: 'list-item', checked: true, children: [{text: "Cras maximus"}]},
              {type: 'list-item', checked: true, children: [{text: "eget sapien"}]},
            ]},
        ]},
    ]);
  });

  it(`shouldn't move newly-unchecked sequence list item already before first remaining checked item`, () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'heading-one', children: [{text: "ac mi feugiat"}]},
      {type: 'quote', children: [
          {type: 'sequence-list', children: [
              {type: 'list-item', checked: false, children: [{text: "consectetur at eget"}]},
              {type: 'list-item', checked: false, children: [{text: "Duis tincidunt"}]},
              {type: 'list-item', checked: false, children: [{text: "gravida sapien"}]},
              {type: 'list-item', checked: true, children: [{text: "this shouldn't move"}]},
              {type: 'list-item', checked: true, children: [{text: "Cras maximus"}]},
              {type: 'list-item', checked: true, children: [{text: "eget sapien"}]},
            ]},
        ]},
    ];

    toggleCheckListItem(editor, [1, 0, 3], false);

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "ac mi feugiat"}]},
      {type: 'quote', children: [
          {type: 'sequence-list', children: [
              {type: 'list-item', checked: false, children: [{text: "consectetur at eget"}]},
              {type: 'list-item', checked: false, children: [{text: "Duis tincidunt"}]},
              {type: 'list-item', checked: false, children: [{text: "gravida sapien"}]},
              {type: 'list-item', checked: false, children: [{text: "this shouldn't move"}]},
              {type: 'list-item', checked: true, children: [{text: "Cras maximus"}]},
              {type: 'list-item', checked: true, children: [{text: "eget sapien"}]},
            ]},
        ]},
    ]);
  });

});

describe("deleteCompletedTasks", () => {
  it("should delete checked Task items", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'heading-one', children: [{text: "Class aptent taciti sociosqu "}]},
      {type: 'quote', children: [
          {type: 'task-list', children: [
              {type: 'list-item', checked: false, children: [{text: "Donec imperdiet"}]},
              {type: 'list-item', checked: false, children: [{text: "eros sit"}]},
              {type: 'list-item', checked: true, children: [{text: "amet nunc", strikethrough: true}]},
              {type: 'list-item', checked: true, children: [{text: "non commodo", strikethrough: true}]},
            ]},
        ]},
    ];

    deleteCompletedTasks(editor)

    expect(editor.children).toEqual([
      {type: 'heading-one', children: [{text: "Class aptent taciti sociosqu "}]},
      {type: 'quote', children: [
          {type: 'task-list', children: [
              {type: 'list-item', checked: false, children: [{text: "Donec imperdiet"}]},
              {type: 'list-item', checked: false, children: [{text: "eros sit"}]},
            ]},
        ]},
    ]);
  });

  it("should not change a Sequence list", () => {
    const editor = withHtml(withReact(createEditor()));
    const originalNodes = [
      {type: 'heading-one', children: [{text: "Class aptent taciti sociosqu "}]},
      {type: 'quote', children: [
          {type: 'sequence-list', children: [
              {type: 'list-item', checked: false, children: [{text: "Donec imperdiet"}]},
              {type: 'list-item', checked: false, children: [{text: "target"}]},
              {type: 'list-item', checked: false, children: [{text: "eros sit"}]},
              {type: 'list-item', checked: true, children: [{text: "amet nunc"}]},
              {type: 'list-item', checked: true, children: [{text: "non commodo"}]},
              {type: 'list-item', checked: true, children: [{text: "mauris pulvinar."}]},
            ]},
        ]},
    ];
    editor.children = originalNodes.slice(0);

    deleteCompletedTasks(editor);

    expect(editor.children).toEqual(originalNodes);
  });
});

describe("flipTableRowsToColumns", () => {
  it("should flip table inside list", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "Aenean fringilla massa vel ipsum"}]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "Nam quis nibh mattis libero rutrum"}]},
              {type: 'table', children: [
                  {type: 'table-row', children: [
                      {type: 'table-cell', children: [{text: "A1"}]},
                      {type: 'table-cell', children: [{text: "A2"}]},
                      {type: 'table-cell', children: [{text: "A3"}]},
                    ]},
                  {type: 'table-row', children: [
                      {type: 'table-cell', children: [{text: "B1"}]},
                      {type: 'table-cell', children: [{text: "B2"}]},
                      {type: 'table-cell', children: [{text: "B3"}]},
                    ]},
                ]},
            ]},
          {type: 'list-item', children: [{text: "Morbi mattis augue ac mauris porttitor"}]},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [0, 1, 1, 0, 1, 0], offset: 1},
      focus:  {path: [0, 1, 1, 1, 0, 0], offset: 1},
    });

    expect(getRelevantBlockType(editor)).toEqual('table');
    flipTableRowsToColumns(editor);

    expect(editor.children).toEqual([
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "Aenean fringilla massa vel ipsum"}]},
          {type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "Nam quis nibh mattis libero rutrum"}]},
              {type: 'table', children: [
                  {type: 'table-row', children: [
                      {type: 'table-cell', children: [{text: "A1"}]},
                      {type: 'table-cell', children: [{text: "B1"}]},
                    ]},
                  {type: 'table-row', children: [
                      {type: 'table-cell', children: [{text: "A2"}]},
                      {type: 'table-cell', children: [{text: "B2"}]},
                    ]},
                  {type: 'table-row', children: [
                      {type: 'table-cell', children: [{text: "A3"}]},
                      {type: 'table-cell', children: [{text: "B3"}]},
                    ]},
                ]},
            ]},
          {type: 'list-item', children: [{text: "Morbi mattis augue ac mauris porttitor"}]},
        ]},
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [0, 1, 1, 0, 0, 0], offset: 0},
      focus:  {path: [0, 1, 1, 0, 0, 0], offset: 0},
    });
  });

  it("should flip table inside checklist", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'sequence-list', children: [
          {type: 'list-item', checked: false, children: [{text: "ornare justo"}]},
          {type: 'list-item', checked: true, children: [
              {type: 'paragraph', children: [{text: "Curabitur luctus"}]},
              {type: 'table', children: [
                  {type: 'table-row', children: [
                      {type: 'table-cell', children: [{text: "alpha one"}]},
                      {type: 'table-cell', children: [{text: "alpha two"}]},
                    ]},
                  {type: 'table-row', children: [
                      {type: 'table-cell', children: [{text: "beta one"}]},
                      {type: 'table-cell', children: [{text: "beta two"}]},
                    ]},
                  {type: 'table-row', children: [
                      {type: 'table-cell', children: [{text: "gamma one"}]},
                      {type: 'table-cell', children: [{text: "gamma two"}]},
                    ]},
                ]},
            ]},
          {type: 'list-item', checked: false, children: [{text: "ante vel"}]},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [0, 1, 1, 0, 1, 0], offset: 1},
      focus:  {path: [0, 1, 1, 1, 0, 0], offset: 1},
    });

    expect(getRelevantBlockType(editor)).toEqual('table');
    flipTableRowsToColumns(editor);

    expect(editor.children).toEqual([
      {type: 'sequence-list', children: [
          {type: 'list-item', checked: false, children: [{text: "ornare justo"}]},
          {type: 'list-item', checked: true, children: [
              {type: 'paragraph', children: [{text: "Curabitur luctus"}]},
              {type: 'table', children: [
                  {type: 'table-row', children: [
                      {type: 'table-cell', children: [{text: "alpha one"}]},
                      {type: 'table-cell', children: [{text: "beta one"}]},
                      {type: 'table-cell', children: [{text: "gamma one"}]},
                    ]},
                  {type: 'table-row', children: [
                      {type: 'table-cell', children: [{text: "alpha two"}]},
                      {type: 'table-cell', children: [{text: "beta two"}]},
                      {type: 'table-cell', children: [{text: "gamma two"}]},
                    ]},
                ]},
            ]},
          {type: 'list-item', checked: false, children: [{text: "ante vel"}]},
        ]},
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [0, 1, 1, 0, 0, 0], offset: 0},
      focus:  {path: [0, 1, 1, 0, 0, 0], offset: 0},
    });
  });

  it("should flip table outside list", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.children = [
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "alpha one"}]},
              {type: 'table-cell', children: [{text: "alpha two"}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "beta one"}]},
              {type: 'table-cell', children: [
                  {type: 'paragraph', children: [{text: "beta two"}]},
                  {type: 'numbered-list', children: [
                      {type: 'list-item', children: [{text: "Etiam sed feugiat lacus."}]},
                      {type: 'list-item', children: [
                          {type: 'quote', children: [{text: "Nullam eleifend dui sit amet"}]},
                        ]},
                      {type: 'list-item', children: [{text: "Mauris leo elit, venenatis in"}]},
                    ]},
                ]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "gamma one"}]},
              {type: 'table-cell', children: [{text: "gamma two"}]},
            ]},
        ]},
    ];
    Transforms.select(editor, {
      anchor: {path: [0, 1, 1, 1, 0, 0], offset: 6},
      focus:  {path: [0, 1, 1, 1, 1, 0, 0], offset: 24},
    });

    expect(getRelevantBlockType(editor)).toEqual('numbered-list');
    flipTableRowsToColumns(editor);

    expect(editor.children).toEqual([
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "alpha one"}]},
              {type: 'table-cell', children: [{text: "beta one"}]},
              {type: 'table-cell', children: [{text: "gamma one"}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "alpha two"}]},
              {type: 'table-cell', children: [
                  {type: 'paragraph', children: [{text: "beta two"}]},
                  {type: 'numbered-list', children: [
                      {type: 'list-item', children: [{text: "Etiam sed feugiat lacus."}]},
                      {type: 'list-item', children: [
                          {type: 'quote', children: [{text: "Nullam eleifend dui sit amet"}]},
                        ]},
                      {type: 'list-item', children: [{text: "Mauris leo elit, venenatis in"}]},
                    ]},
                ]},
              {type: 'table-cell', children: [{text: "gamma two"}]},
            ]},
        ]},
    ]);
    expect(editor.selection).toEqual({
      anchor: {path: [0, 0, 0, 0], offset: 0},
      focus:  {path: [0, 0, 0, 0], offset: 0},
    });
  });
});

xdescribe("changeContentType", () => {
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
          {text: "Quotable dialog"},
        ]}
    );
    expect(editor.children[1]).toEqual({type: 'heading-one', children: [
        {text: "Review of "}, {italic: true, text: "Epic Movie"}
      ]});
    expect(editor.children[2]).toEqual({type: 'numbered-list', listStart: 1, children: [
        {type: 'list-item', children: [
            {text: "Acting uneven"},
          ]},
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
      children: [{text: ""}]});
    expect(editor.children[2]).toEqual({type: 'paragraph',
      children: [{text: "## A *Dramatic* Article Title"}]});
    expect(editor.children[3]).toEqual({type: 'paragraph',
      children: [{text: ""}]});
    expect(editor.children[4]).toEqual({type: 'paragraph',
      children: [{text: "1. First point"}]});
    expect(editor.children[5]).toEqual({type: 'paragraph',
      children: [{text: "2. **Second** point"}]});
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
    console.info = jest.fn();
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
    expect(editor.children[2].children).toEqual([{text: "Acting uneven"}]);
    expect(editor.children[3].children).toEqual([{text: "Separate paragraph of first item"}]);
    expect(editor.children[4].children).toEqual([{text: "General Electric Big Blow"}]);
    expect(editor.children.length).toBeGreaterThanOrEqual(5);

    expect(editor.subtype).toEqual(newSubtype);
    expect(editor.children[0].noteSubtype).toEqual(newSubtype);

    expect(console.info).toHaveBeenCalledWith("markdown;hint=COMMONMARK => plain");
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
