// Copyright © 2021 Doug Reeder under the MIT License

import {withHtml, deserializeHtml, serializeHtml} from "./slateHtml";
import sanitizeHtml from "sanitize-html";
import {semanticOnly} from "./sanitizeNote";
import {createEditor, Editor, Element, Text} from "slate";
import {withReact} from "slate-react";
import {base64DecToArr} from "./util/testUtil";
import {getRelevantBlockType, getCommonBlock} from "./slateUtil";

class DataTransfer {
  constructor() {
    this._items = new Map();
    this.files = [];
  }

  get types() {
    return Array.from(this._items.keys());
  }

  get items() {
    return Array.from(this._items).map(([type, data]) => {return {kind: 'string', type}});
  }

  setData(type, data) {
    this._items.set(type, data);
  }

  getData(type) {
    return this._items.get(type) || "";
  }
}

describe("HTML plugin normalizer", () => {
  it("should ensure at least one node exists", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [];
    editor.selection = null;

    Editor.normalize(editor, {force: true});

    expect(editor.children).toHaveLength(1);
    expect(editor.children[0]).toEqual({type: 'paragraph', children: [{text: ""}]});
  });

  it("should wrap top-level text nodes in Elements", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {text: "opening remarks"},
      {type: "paragraph", children: [
          {text: "To be, or not to be, that is the question."}
      ]},
      {text: "coda"},
    ];
    editor.selection = null;

    Editor.normalize(editor, {force: true});

    expect(editor.children[0]).toEqual({type: 'paragraph', children: [{text: "opening remarks"}]});
    expect(editor.children[2]).toEqual({type: 'paragraph', children: [{text: "coda"}]});
  });

  it("should wrap top-level links in paragraph elements", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {text: "Lorem ipsum"},
      {type: "link", url: "https://example.com/",
        children: [{text: "some link"}]
      },
    ];
    editor.selection = null;

    Editor.normalize(editor, {force: true});

    expect(editor.children).toEqual([
      {type: 'paragraph', children: [
          {text: "Lorem ipsum"},
        ]},
      {type: 'paragraph', children: [
          {text: ""},
          {type: "link", url: "https://example.com/",
            children: [{text: "some link"}]
          },
          {text: ""},
        ]},
    ]);
  });

  it("should assign type of 'paragraph' to top-level elements without a type", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {children: [{text: "opening remarks"}]},
      {type: "paragraph", children: [
          {text: "To be, or not to be, that is the question."}
      ]},
      {children: [{text: "coda"}]},
    ];
    editor.selection = null;

    Editor.normalize(editor, {force: true});

    expect(editor.children[0]).toEqual({type: 'paragraph', children: [{text: "opening remarks"}]});
    expect(editor.children[2]).toEqual({type: 'paragraph', children: [{text: "coda"}]});
  });

  it("should ensure a nonempty list-item is a direct child of bulleted-list or numbered-list", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'list-item', children: [{text: "foo"}]},
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "bar"}]},
        ]},
      {type: 'quote', children: [
          {type: 'list-item', children: [{text: "spam"}]},
        ]},
    ];
    editor.selection = null;

    Editor.normalize(editor, {force: true});

    expect(editor.children).toEqual([
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [{text: "foo"}]},
        ]},
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "bar"}]},
        ]},
      {type: 'quote', children: [
          {type: 'bulleted-list', children: [
              {type: 'list-item', children: [{text: "spam"}]},
            ]},
        ]},
    ]);
  });

  it("should remove a blank list-item that is not a direct child of bulleted-list or numbered-list", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "foo"}]},
        ]},
      {type: 'list-item', children: [{text: "\n"}]},
      {type: 'quote', children: [
          {type: 'list-item', children: [{text: "\t"}]},
        ]},
    ];
    editor.selection = null;

    Editor.normalize(editor, {force: true});

    expect(editor.children).toEqual([
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [{text: "foo"}]},
        ]},
      {type: 'quote', children: [
          {text: ""}
        ]},
    ]);
  });

  it("should ensure all children of lists are list-items", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'quote', children: [
          {type: 'numbered-list', children: [
            {type: 'heading-one', children: [{text: "\t"}]},
            {type: 'heading-one', children: [
                {text: "elvis"},
                {text: "lives!", superscript: true}
            ]},
            {type: 'paragraph', children: [{text: "hut one"}]},
            {type: 'code', children: [{text: "\n"}]},
            {type: 'list-item', children: [{text: "hut two"}]},
            {type: 'list-item', children: [{text: ""}]},
            {text: 'hike!'},
            {type: 'image',
              url: 'https://mozilla.org/?x=шеллы',
              title: "Slice of grapefruit",
              children: [
                {text: "Grapefruit slice", bold: true},
                {text: " atop a pile of other slices"}
              ]
            },
            {type: 'link', url: 'https://example.org/', children: [
                {text: "description of", strikethrough: true},
                {text: "contents"}
            ]},
          ]},
      ]},
    ];
    editor.selection = null;

    Editor.normalize(editor, {force: true});

    expect(editor.children).toEqual([
      {type: 'quote', children: [
          {type: 'numbered-list', children: [
              {type: 'list-item', children: [
                {text: "elvis"},
                {text: "lives!", superscript: true}
              ]},
              {type: 'list-item', children: [{text: "hut one"}]},
              {type: 'list-item', children: [{text: "hut two"}]},
              {type: 'list-item', children: [{text: ""}]},
              {type: 'list-item', children: [{text: 'hike!'}]},
              {type: 'list-item', children: [
                {type: 'image',
                  url: 'https://mozilla.org/?x=шеллы',
                  title: "Slice of grapefruit",
                  children: [
                    {text: "Grapefruit slice", bold: true},
                    {text: " atop a pile of other slices"}
                  ]
                },
              ]},
              {type: 'list-item', children: [
                {text: ""},
                {type: 'link', url: 'https://example.org/', children: [
                    {text: "description of", strikethrough: true},
                    {text: "contents"}
                ]},
                {text: ""}
              ]},
            ]},
        ]},
    ]);
  });

  it("should remove a list with no list-items and no non-blank children", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'quote', children: [
          {type: 'numbered-list', children: [
              {type: 'heading-one', children: [{text: "\t"}]},
              {type: 'code', children: [{text: "\n"}]},
              {type: 'paragraph', children: [{text: ""}]},
            ]},
        ]},
    ];
    editor.selection = null;

    Editor.normalize(editor, {force: true});

    expect(editor.children).toEqual([
      {type: 'quote', children: [
          {text: ""}
        ]},
    ]);
  });

  it("should remove all blank links", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'quote', children: [
          {text: "one"},
          {type: "link", url: "https://example.com/user/jdoe#profile",
            children: [{text: ""}]
          },
          {text: "three"},
          {type: "link", url: "https://example.com/",
            children: [{text: ""}]
          },
          {text: "five"},
      ]}
    ];
    editor.selection = null;

    Editor.normalize(editor, {force: true});

    expect(editor.children).toEqual([
      {type: 'quote', children: [
          {text: "onethreefive"},
      ]},
    ]);
  });

  it("should move (block) images out of (inline) links", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'quote', children: [
          {text: ""},
          {type: "link", url: "https://example.com/grapefruit-img",
            children: [{
              type: 'image',
              url: 'https://mozilla.org/?x=шеллы',
              title: "Slice of grapefruit",
              children: [
                {text: "Grapefruit slice atop a pile of other slices"}]
            }]
          },
          {text: ""},
      ]},
      {type: 'paragraph', children: [
          {text: ""},
          {type: "link", url: "https://alpha.com/link",
            children: [
              {text: "some text inside the link"},
              { type: 'image',
                url: 'https://alpha.com/image',
                title: "Some title",
                children: [
                  {text: "Some label"}]
              }]
          },
          {text: ""},
      ]},
      {type: "link", url: "https://example.com/foo",
        children: [{
          type: 'image',
          url: 'https://example.org',
          title: "Something",
          children: [
            {text: "Some sort of thing"}]
        }]
      },
      {type: "link", url: "https://beta.org/spam",
        children: [
          { type: 'image',
            url: 'https://beta.org/frotz',
            title: "Etwas",
            children: [
              {text: "Description of spam or frotz"}]
          },
          {text: "more about spam"}
        ]
      },
    ];
    editor.selection = null;

    Editor.normalize(editor, {force: true});

    expect(editor.children).toEqual([
      {type: 'quote', children: [
        {type: 'paragraph', children: [
          {text: ""},
          {type: "link", url: "https://example.com/grapefruit-img",
            children: [{text: "grapefruit-img"}]
          },
          {text: ""},
        ]},
        {type: 'image',
          url: 'https://mozilla.org/?x=шеллы',
          title: "Slice of grapefruit",
          children: [
            {text: "Grapefruit slice atop a pile of other slices"}]
        },
      ]},
      {type: 'paragraph', children: [
          {text: ""},
          {type: "link", url: "https://alpha.com/link",
            children: [{text: "some text inside the link"}]
          },
          {text: ""},
      ]},
      {
        type: 'image',
        url: 'https://alpha.com/image',
        title: "Some title",
        children: [
          {text: "Some label"}]
      },
      {type: 'paragraph', children: [
        {text: ""},
        {type: "link", url: "https://example.com/foo",
          children: [{text: "foo"}]
        },
        {text: ""},
        { type: "link", url: "https://beta.org/spam",
          children: [{text: "more about spam"}]
        },
        {text: ""},
      ]},
      {
        type: 'image',
        url: 'https://example.org',
        title: "Something",
        children: [
          {text: "Some sort of thing"}]
      },
      { type: 'image',
        url: 'https://beta.org/frotz',
        title: "Etwas",
        children: [
          {text: "Description of spam or frotz"}]
      },
    ]);
  });

  it("should change text nodes marked both 'deleted' and 'inserted' to just 'inserted'", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [{children: [
      {text: "Lorem ipsum", deleted: true},
      {text: "dolor sit amet,", deleted: true, inserted: true},
      {text: "consectetur adipiscing elit,", inserted: true},
    ]}];
    editor.selection = null;

    Editor.normalize(editor, {force: true});

    expect(editor.children).toEqual([{type: "paragraph", children: [
        {text: "Lorem ipsum", deleted: true},
        {text: "dolor sit amet,consectetur adipiscing elit,", inserted: true},
      ]}]);
  });

  it("should normalise tables", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [{type: 'numbered-list', children: [
        {type: 'list-item', children: [
          {type: 'table', children: [
            {type: 'table-row', children: [
              {type: 'table-cell', children: [
                {text: "Lorem ipsum dolor", bold: true},
              ]},
            ]},
            {type: 'table-row', children: [
              {type: 'table-cell', children: [
                {text: "sit amet, consectetur", bold: true},
              ]},
              {type: 'table-cell', children: [
                {text: "adipiscing elit"},
              ]},
              {type: 'image', url: 'https://storage.org/?q=cat',
                title: "Cat of the day",
                children: [{text: "a sleeping Persian"}]
              },
            ]},
            {type: 'quote', children: [{text: ""}]},
            {type: 'paragraph', children: [{text: "And another thing..."}]},
          ]},
        ]},
        {type: 'list-item', children: [{text: "second"}]},
      ]}];
    editor.selection = null;

    Editor.normalize(editor, {force: true});

    expect(editor.children).toEqual([{type: 'numbered-list', children: [
        {type: 'list-item', children: [
          {type: 'table', children: [
            {type: 'table-row', children: [
              {type: 'table-cell', children: [
                {text: "Lorem ipsum dolor", bold: true},
              ]},
              {type: 'table-cell', children: [
                {text: "", bold: true},
              ]},
              {type: 'table-cell', children: [
                {text: "", bold: true},
              ]},
            ]},
            {type: 'table-row', children: [
              {type: 'table-cell', children: [
                {text: "sit amet, consectetur", bold: true},
              ]},
              {type: 'table-cell', children: [
                {text: "adipiscing elit"},
              ]},
              {type: 'table-cell', children: [
                {type: 'image', url: 'https://storage.org/?q=cat',
                  title: "Cat of the day",
                  children: [{text: "a sleeping Persian"}]
                }
              ]},
            ]},
              {type: 'table-row', children: [
                {type: 'table-cell', children: [
                  {type: 'paragraph', children: [{text: "And another thing..."}]},
                ]},
                {type: 'table-cell', children: [
                  {text: ""},
                ]},
                {type: 'table-cell', children: [
                  {text: ""},
                ]},
              ]},
          ]},
        ]},
        {type: 'list-item', children: [{text: "second"}]},
      ]}]);
  });

  it("should delete tables with no table-rows and no non-blank children", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [{type: 'numbered-list', children: [
        {type: 'list-item', children: [
            {type: 'table', children: [
                {type: 'quote', children: [{text: ""}]},
                {type: 'paragraph', children: [{text: ""}]},
              ]},
          ]},
        {type: 'list-item', children: [{text: "trailer"}]},
      ]}];
    editor.selection = null;

    Editor.normalize(editor, {force: true});

    expect(editor.children).toEqual([{type: 'numbered-list', children: [
        {type: 'list-item', children: [
            {text: ""}
          ]},
        {type: 'list-item', children: [{text: "trailer"}]},
      ]}]);
  });

  it("should delete tables with no columns", () => {
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [{type: 'numbered-list', children: [
        {type: 'list-item', children: [
            {type: 'table', children: [
                {type: 'table-row', children: [
                  ]},
                {type: 'table-row', children: []},
              ]},
          ]},
        {type: 'list-item', children: [{text: "trailer"}]},
      ]}];
    editor.selection = null;

    Editor.normalize(editor, {force: true});

    expect(editor.children).toEqual([{type: 'numbered-list', children: [
        {type: 'list-item', children: [
            {text: ""}
          ]},
        {type: 'list-item', children: [{text: "trailer"}]},
      ]}]);
  });
});

describe("HTML plugin insertData", () => {
  it("should prefer pasting HTML into rich text, & paste as rich text", () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      { type: "heading-one",
        children: [
          {text: "A Suitable Title"}
        ]},
      { type: "quote",
        children: [
          {text: "To be, or not to be, that is the question."}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 20 },
      focus:  { path: [1, 0], offset: 20 },
    };

    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', "E pluribus unum");
    dataTransfer.setData('text/html', "<code>let a = b + c;</code>");
    editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      { type: "heading-one",
        children: [
          {text: "A Suitable Title"}
        ]},
      { type: "quote",
        children: [
          {text: "To be, or not to be,"},
          {text: "let a = b + c;", code: true},
          {text: " that is the question."},
        ]},
    ]);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });

  it("should prefer pasting URLs, over plain text, into rich text", async () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      { type: "heading-one",
        children: [
          {text: "A Boring Title"}
        ]},
      { type: "quote",
        children: [
          {text: "Whenever you find yourself on the side of the majority, it is time to pause and reflect. —Mark Twain"}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 9 },
      focus:  { path: [1, 0], offset: 12 },
    };

    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/uri-list', `https://www.mozilla.org
# A second link
http://www.example.com`);
    dataTransfer.setData('text/plain', `https://www.mozilla.org
http://www.example.com`);
    await editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      { type: "heading-one",
        children: [
          {text: "A Boring Title"}
        ]},
      { type: "quote",
        children: [
          {text: "Whenever "},
          {type: 'link', url: 'https://www.mozilla.org', title: '', children: [
              {text: "https://www.mozilla.org"}
            ]},
          {text: ""},
          {type: 'link', url: 'http://www.example.com', title: '', children: [
              {text: "A second link"}
            ]},
          {text: " find yourself on the side of the majority, it is time to pause and reflect. —Mark Twain"},
        ]},
    ]);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });


  it("should paste URL list files into rich text", async () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      { type: "heading-two",
        children: [
          {text: "Another Title"}
        ]},
      { type: "quote",
        children: [
          {text: "The greatest wealth is to live content with little. —Plato"}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 4 },
      focus:  { path: [1, 0], offset: 12 },
    };

    const dataTransfer = new DataTransfer();
    const file = new File([`https://w3.org
# Internet Assigned Numbers Authority   
http://iana.org`], "organizations.uri", {type: 'text/uri-list'});
    dataTransfer.files = [file];
    await editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      { type: "heading-two",
        children: [
          {text: "Another Title"}
        ]},
      { type: "quote",
        children: [
          {text: "The "},
          {type: 'link', url: 'https://w3.org', title: '', children: [
              {text: "https://w3.org"}
            ]},
          {text: ""},
          {type: 'link', url: 'http://iana.org', title: '', children: [
              {text: "Internet Assigned Numbers Authority   "}
            ]},
          {text: " wealth is to live content with little. —Plato"},
        ]},
    ]);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });

  it("should paste Markdown files into rich text", async () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      { type: "heading-two",
        children: [
          {text: "Nembutol"}
        ]},
      { type: "quote",
        children: [
          {text: "Today is the first day of the rest of your life."}
        ]},
      { type: "code",
        children: [
          {text: "let a = b + c;"}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 9 },
      focus:  { path: [1, 0], offset: 48 },
    };

    const dataTransfer = new DataTransfer();
    const file = new File([`**stuff**
1. only item`], "minimal-markdown", {type: 'text/markdown'});
    dataTransfer.files = [file];
    await editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      { type: "heading-two",
        children: [
          {text: "Nembutol"}
        ]},
      { type: "quote",
        children: [
          {text: "Today is "},
          {text: "stuff", bold: true},
        ]},
      { type: "numbered-list", listStart: 1, children: [
          {type: "list-item", children: [
              {text: "only item"},
            ]},
        ]},
      { type: "code",
        children: [
          {text: "let a = b + c;"}
        ]},
    ]);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });

  it("should paste plain text into rich text and match style", () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      { type: "heading-one",
        children: [
          {text: "A Suitable Title"}
        ]},
      { type: "quote",
        children: [
          {text: "To be, or not to be, that is the question.", italic: true}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 20 },
      focus:  { path: [1, 0], offset: 20 },
    };

    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', "E pluribus unum");
    editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      { type: "heading-one",
        children: [
          {text: "A Suitable Title"}
        ]},
      { type: "quote",
        children: [
          {text: "To be, or not to be,E pluribus unum that is the question.", italic: true},
        ]},
    ]);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });

  it("should paste a graphic file into rich text as rich text, replacing a blank paragraph", async () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      { type: "heading-three",
        children: [
          {text: "My Essay"}
        ]},
      { type: "paragraph",
        children: [
          {text: ""}
        ]},
      { type: "quote",
        children: [
          {text: "Something appropriate."}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 0 },
      focus:  { path: [1, 0], offset: 0 },
    };

    const dataTransfer = new DataTransfer();
    const svg = `<svg width="400" height="410" xmlns="http://www.w3.org/2000/svg">
<circle cx="200" cy="200" r="69" fill="orage" />
</svg>`;
    const file = new File([svg],
        "disk.svg", {type: 'image/svg+xml'});
    dataTransfer.files = [file];
    await editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      { type: "heading-three",
        children: [
          {text: "My Essay"}
        ]},
      { type: "paragraph",
        children: [
          {text: ""}
        ]},
      {type: "image",
        url: expect.anything(),
        title: "",
        children: [
          {text: "disk.svg"}
        ]},
      { type: "paragraph",
        children: [
          {text: ""}
        ]},
      { type: "quote",
        children: [
          {text: "Something appropriate."}
        ]},
    ]);
    expect(editor.children[2].url).toMatch(/^data:image\/svg\+xml/);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });

  it("should paste a graphic file into rich text as rich text, replacing text", async () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      { type: "heading-three",
        children: [
          {text: "My Essay"}
        ]},
      { type: "paragraph",
        children: [
          {text: "lead-in argument summary"}
        ]},
      { type: "quote",
        children: [
          {text: "Something appropriate."}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 8 },
      focus:  { path: [1, 0], offset: 16 },
    };

    const dataTransfer = new DataTransfer();
    const svg = `<svg width="400" height="410" xmlns="http://www.w3.org/2000/svg">
<circle cx="200" cy="200" r="69" fill="orage" />
</svg>`;
    const file = new File([svg],
        "disk.svg", {type: 'image/svg+xml'});
    dataTransfer.files = [file];
    await editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      { type: "heading-three",
        children: [
          {text: "My Essay"}
        ]},
      { type: "paragraph",
        children: [
          {text: "lead-in "}
        ]},
      {type: "image",
        url: expect.anything(),
        title: "",
        children: [
          {text: "disk.svg"}
        ]},
      { type: "paragraph",
        children: [
          {text: " summary"}
        ]},
      { type: "quote",
        children: [
          {text: "Something appropriate."}
        ]},
    ]);
    expect(editor.children[2].url).toMatch(/^data:image\/svg\+xml/);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });


  it("should prefer pasting plain text into plain text", () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = undefined;
    editor.children = [
      { type: "paragraph",
        children: [
          {text: "A Suitable Title"}
        ]},
      { type: "paragraph",
        children: [
          {text: "To be, or not to be, that is the question."}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 20 },
      focus:  { path: [1, 0], offset: 20 },
    };

    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', "E pluribus unum");
    dataTransfer.setData('text/html', "<code>let a = b + c;</code>");
    editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      { type: "paragraph",
        children: [
          {text: "A Suitable Title"}
        ]},
      { type: "paragraph",
        children: [
          {text: "To be, or not to be,E pluribus unum that is the question."},
        ]},
    ]);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });


  it("should prefer pasting HTML into Markdown", () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'markdown';
    editor.children = [
      { type: "paragraph",
        children: [
          {text: "# Some Provocative Title"}
        ]},
      { type: "paragraph",
        children: [
          {text: "* First list item"}
        ]},
      { type: "paragraph",
        children: [
          {text: "* Second list item"}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 7 },
      focus:  { path: [1, 0], offset: 7 },
    };

    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', "`foo => 2 * foo`");
    dataTransfer.setData('text/html', "<code>let a = b + c;</code>");
    editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      { type: "paragraph",
        children: [
          {text: "# Some Provocative Title"}
        ]},
      { type: "paragraph",
        children: [
          {text: "* First`let a = b + c;` list item"}
        ]},
      { type: "paragraph",
        children: [
          {text: "* Second list item"}
        ]},
    ]);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });

  it("should prefer pasting URI lists, over text, into Markdown", async () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'markdown';
    editor.children = [
      { type: "paragraph",
        children: [
          {text: "# Some Dull Title"}
        ]},
      { type: "paragraph",
        children: [
          {text: "> All that we are is the result of what we have thought. —Buddha"}
        ]},
      { type: "paragraph",
        children: [
          {text: "> The most courageous act is still to think for yourself. Aloud. —Coco Chanel "}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 6 },
      focus:  { path: [1, 0], offset: 10 },
    };

    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/uri-list', `https://reed.edu
# The paradigmatic example
https://www.example.org`);
    dataTransfer.setData('text/plain', `https://reed.edu
https://www.example.org`);
    await editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      { type: "paragraph",
        children: [
          {text: "# Some Dull Title"}
        ]},
      { type: "paragraph",
        children: [
          {text: "> All [https://reed.edu](https://reed.edu)[The paradigmatic example](https://www.example.org) we are is the result of what we have thought. —Buddha"},
        ]},
      { type: "paragraph",
        children: [
          {text: "> The most courageous act is still to think for yourself. Aloud. —Coco Chanel "}
        ]},
    ]);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });

  it("should paste text into Markdown", () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'markdown';
    editor.children = [
      { type: "paragraph",
        children: [
          {text: "# Another Title"}
        ]},
      { type: "paragraph",
        children: [
          {text: "> A block quote"}
        ]},
      { type: "paragraph",
        children: [
          {text: "`code` and **bold**"}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 4 },
      focus:  { path: [1, 0], offset: 9 },
    };

    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', "*italic text*");
    editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      { type: "paragraph",
        children: [
          {text: "# Another Title"}
        ]},
      { type: "paragraph",
        children: [
          {text: "> A *italic text* quote"}
        ]},
      { type: "paragraph",
        children: [
          {text: "`code` and **bold**"}
        ]},
    ]);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });

  it("should paste a text file into Markdown", async () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'markdown';
    editor.children = [
      { type: "paragraph",
        children: [
          {text: "# Yet Another Title"}
        ]},
      { type: "paragraph",
        children: [
          {text: "before target after"}
        ]},
      { type: "paragraph",
        children: [
          {text: "> Yadda yadda"}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 7 },
      focus:  { path: [1, 0], offset: 13 },
    };

    const dataTransfer = new DataTransfer();
    const file = new File(["A man, a plan, a canal, Panama!"], "palindrome.text", {type: 'text/csv'});
    dataTransfer.files = [file];
    await editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      { type: "paragraph",
        children: [
          {text: "# Yet Another Title"}
        ]},
      { type: "paragraph",
        children: [
          {text: "before A man, a plan, a canal, Panama! after"}
        ]},
      { type: "paragraph",
        children: [
          {text: "> Yadda yadda"}
        ]},
    ]);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });

  it("should paste an HTML file into Markdown as Markdown", async () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'markdown';
    editor.children = [
      { type: "paragraph",
        children: [
          {text: "### Something Minor"}
        ]},
      { type: "paragraph",
        children: [
          {text: "before **target** after"}
        ]},
      { type: "paragraph",
        children: [
          {text: "> Yadda yadda"}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 7 },
      focus:  { path: [1, 0], offset: 23 },
    };

    const dataTransfer = new DataTransfer();
    const file = new File([`<code>const NUMBER = 42;</code><img src="http://example.com/pic" alt="natter"/>`], "stuff.html", {type: 'text/html'});
    dataTransfer.files = [file];
    await editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      { type: "paragraph",
        children: [
          {text: "### Something Minor"}
        ]},
      { type: "paragraph",
        children: [
          {text: 'before `const NUMBER = 42;`'},
        ]},
      { type: 'paragraph', children: [
          {text: '![natter](http://example.com/pic)'},
        ]},
      { type: "paragraph",
        children: [
          {text: "> Yadda yadda"}
        ]},
    ]);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });

  it("should paste a graphic file into Markdown as Markdown", async () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'markdown';
    editor.children = [
      { type: "paragraph",
        children: [
          {text: "## My Vacation"}
        ]},
      { type: "paragraph",
        children: [
          {text: "foretext **selected** aftertext"}
        ]},
      { type: "paragraph",
        children: [
          {text: "> this and that"}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 11 },
      focus:  { path: [1, 0], offset: 19 },
    };

    const dataTransfer = new DataTransfer();
    const svg = `<svg width="100" height="110" xmlns="http://www.w3.org/2000/svg">
<circle cx="50" cy="55" r="50" fill="blue" />
</svg>`;
    const dataUrlSvg = 'data:image/svg+xml;base64,' + btoa(svg);
    const file = new File([svg],
        "circle.svg", {type: 'image/svg+xml'});
    dataTransfer.files = [file];
    await editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      { type: "paragraph",
        children: [
          {text: "## My Vacation"}
        ]},
      { type: "paragraph",
        children: [
          {text: `foretext **![circle.svg](${dataUrlSvg} "")** aftertext`}
        ]},
      { type: "paragraph",
        children: [
          {text: "> this and that"}
        ]},
    ]);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });


  it("should paste an HTML file into plain text as plain text", async () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = undefined;
    editor.children = [
      { type: "paragraph",
        children: [
          {text: "A first line"}
        ]},
      { type: "paragraph",
        children: [
          {text: "A second line"}
        ]},
      { type: "paragraph",
        children: [
          {text: "A third line"}
        ]},
    ];
    editor.selection = {
      anchor: { path: [1, 0], offset: 2 },
      focus:  { path: [1, 0], offset: 8 },
    };

    const dataTransfer = new DataTransfer();
    const html = `<em>emphasized text</em>`;
    const file = new File([html],
        "short.html", {type: 'text/html'});
    dataTransfer.files = [file];
    await editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      { type: "paragraph",
        children: [
          {text: "A first line"}
        ]},
      { type: "paragraph",
        children: [
          {text: "A emphasized text line"}
        ]},
      { type: "paragraph",
        children: [
          {text: "A third line"}
        ]},
    ]);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });

  it("should paste a Markdown file into plain text as Markdown", async () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = undefined;
    editor.children = [
      {
        type: "paragraph",
        children: [
          {text: "Some first line"}
        ]
      },
      {
        type: "paragraph",
        children: [
          {text: "Some second line"}
        ]
      },
      {
        type: "paragraph",
        children: [
          {text: "Some third line"}
        ]
      },
    ];
    editor.selection = {
      anchor: {path: [1, 0], offset: 5},
      focus: {path: [1, 0], offset: 11},
    };

    const dataTransfer = new DataTransfer();
    const markdown = `1. erste
2. zwitte`;
    const file = new File([markdown],
        "list.md", {type: 'text/markdown'});
    dataTransfer.files = [file];
    await editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      {
        type: "paragraph",
        children: [
          {text: "Some first line"}
        ]
      },
      {
        type: "paragraph",
        children: [
          {
            text: `Some 1. erste
2. zwitte line`
          }
        ]
      },
      {
        type: "paragraph",
        children: [
          {text: "Some third line"}
        ]
      },
    ]);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });

  it("should paste a graphic file into plain text as a file name", async () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = undefined;
    editor.children = [
      {
        type: "paragraph",
        children: [
          {text: "Another first line"}
        ]
      },
      {
        type: "paragraph",
        children: [
          {text: "Another second line"}
        ]
      },
      {
        type: "paragraph",
        children: [
          {text: "Another third line"}
        ]
      },
    ];
    editor.selection = {
      anchor: {path: [1, 0], offset: 8},
      focus: {path: [1, 0], offset: 14},
    };

    const dataTransfer = new DataTransfer();
    const svg = `<svg width="100" height="110" xmlns="http://www.w3.org/2000/svg">
<rect width="30" height="30" fill="cyan" />
</svg>`;
    // const dataUrlSvg = 'data:image/svg+xml;base64,' + btoa(svg);
    const file = new File([svg],
        "square.svg", {type: 'image/svg+xml'});
    dataTransfer.files = [file];
    await editor.insertData(dataTransfer);

    expect(editor.children).toEqual([
      {
        type: "paragraph",
        children: [
          {text: "Another first line"}
        ]
      },
      {
        type: "paragraph",
        children: [
          {
            text: `Another square.svg line`
          }
        ]
      },
      {
        type: "paragraph",
        children: [
          {text: "Another third line"}
        ]
      },
    ]);
    expect(window.postMessage).toHaveBeenCalledTimes(0);
  });

  it("should post a message if the paste type isn't handled", async () => {
    console.warn = jest.fn();
    window.postMessage = jest.fn();

    const editor = withHtml(withReact(createEditor()));
    editor.subtype = undefined;
    editor.children = [{type: "paragraph", children: [{text: ""}]}];
    editor.selection = null;

    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/xml', '<?xml version="1.0" encoding="UTF-8"?>');
    await editor.insertData(dataTransfer);

    expect(window.postMessage).toHaveBeenCalledTimes(1);
    expect(window.postMessage).toHaveBeenLastCalledWith({kind: 'TRANSIENT_MSG', severity: 'warning', message: "Can you open that in another app and copy?"}, expect.anything());
    expect(console.warn).toHaveBeenCalledWith("default handling", ...dataTransfer.items);
  })
});

describe("insertBreak", () => {
  /** These block types all change the next block to paragraph. 'code' does not. */
  for (const blockType of ['heading-one', 'heading-two', 'heading-three', 'paragraph', 'quote']) {
    it(`should add another ${blockType}, in a table cell`, () => {
      window.postMessage = jest.fn();
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: 'table', children: [
            {type: 'table-row', children: [
                {type: 'table-cell', children: [
                    {type: blockType, children: [
                        {text: "The paragraph text"}
                      ]},
                  ]},
                {type: 'table-cell', children: [
                    {text: "A2"}
                  ]},
              ]},
            {type: 'table-row', children: [
                {type: 'table-cell', children: [
                    {text: "B1"}
                  ]},
                {type: 'table-cell', children: [
                    {text: "B2"}
                  ]},
              ]},
          ]},
      ];
      editor.selection = {
        anchor: { path: [0, 0, 0, 0, 0], offset: 18 },
        focus:  { path: [0, 0, 0, 0, 0], offset: 18 },
      };

      expect(getRelevantBlockType(editor)).toEqual(blockType);
      editor.insertBreak();

      expect(editor.children).toEqual([
        {type: 'table', children: [
            {type: 'table-row', children: [
                {type: 'table-cell', children: [
                    {type: blockType, children: [
                        {text: "The paragraph text"}
                      ]},
                    {type: 'paragraph', children: [
                        {text: ""}
                      ]},
                  ]},
                {type: 'table-cell', children: [
                    {text: "A2"}
                  ]},
              ]},
            {type: 'table-row', children: [
                {type: 'table-cell', children: [
                    {text: "B1"}
                  ]},
                {type: 'table-cell', children: [
                    {text: "B2"}
                  ]},
              ]},
          ]},
      ]);
      expect(getRelevantBlockType(editor)).toEqual('paragraph');
      expect(editor.selection).toHaveProperty('anchor.path', [0, 0, 0, 1, 0]);
      expect(editor.selection).toHaveProperty('anchor.offset', 0);
      expect(editor.selection).toHaveProperty('focus.path', [0, 0, 0, 1, 0]);
      expect(editor.selection).toHaveProperty('focus.offset', 0);
    });
  }

  it("should wrap existing text in split paragraphs, in a table cell", () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "The cell text"}
                ]},
              {type: 'table-cell', children: [
                  {text: "A2"}
                ]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "B1"}
                ]},
              {type: 'table-cell', children: [
                  {text: "B2"}
                ]},
            ]},
        ]},
    ];
    editor.selection = {
      anchor: { path: [0, 0, 0, 0], offset: 8 },
      focus:  { path: [0, 0, 0, 0], offset: 8 },
    };

    expect(getRelevantBlockType(editor)).toEqual('table-cell');
    editor.insertBreak();

    expect(editor.children).toEqual([
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {type: 'paragraph', children: [
                      {text: "The cell"}
                    ]},
                  {type: 'paragraph', children: [
                      {text: " text"}
                    ]},
                ]},
              {type: 'table-cell', children: [
                  {text: "A2"}
                ]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "B1"}
                ]},
              {type: 'table-cell', children: [
                  {text: "B2"}
                ]},
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    expect(editor.selection).toHaveProperty('anchor.path', [0, 0, 0, 1, 0]);
    expect(editor.selection).toHaveProperty('anchor.offset', 0);
    expect(editor.selection).toHaveProperty('focus.path', [0, 0, 0, 1, 0]);
    expect(editor.selection).toHaveProperty('focus.offset', 0);
  });

  /** These block types all change the next block to paragraph. 'code' does not. */
  for (const blockType of ['heading-one', 'heading-two', 'heading-three', 'paragraph', 'quote']) {
    it(`should not replace a trailing blank ${blockType} with a list item`, () => {
      window.postMessage = jest.fn();
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: 'numbered-list', children: [
            {type: 'list-item', children: [
                {text: "erste"}
              ]},
            {type: 'list-item', children: [
                {type: 'paragraph', children: [
                    {text: "zwitte"}
                  ]},
                {type: blockType, children: [
                    {text: " "}
                  ]},
              ]},
            {type: 'list-item', children: [
                {text: "vierte"}
              ]},
          ]},
      ];
      editor.selection = {
        anchor: {path: [0, 1, 1, 0], offset: 1},
        focus: {path: [0, 1, 1, 0], offset: 1},
      };

      expect(getRelevantBlockType(editor)).toEqual(blockType);
      editor.insertBreak();

      expect(editor.children).toEqual([
        {type: 'numbered-list', children: [
            {type: 'list-item', children: [
                {text: "erste"}
              ]},
            {type: 'list-item', children: [
                {type: 'paragraph', children: [
                    {text: "zwitte"}
                  ]},
                {type: blockType, children: [
                    {text: " "}
                  ]},
                {type: 'paragraph', children: [
                    {text: ""}
                  ]},
              ]},
            {type: 'list-item', children: [
                {text: "vierte"}
              ]},
          ]},
      ]);
      expect(getRelevantBlockType(editor)).toEqual('paragraph');
      expect(editor.selection).toHaveProperty('anchor.path', [0, 1, 2, 0]);
      expect(editor.selection).toHaveProperty('anchor.offset', 0);
      expect(editor.selection).toHaveProperty('focus.path', [0, 1, 2, 0]);
      expect(editor.selection).toHaveProperty('focus.offset', 0);
    });
  }

  /** These block types all change the next block to paragraph. 'code' does not. */
  for (const blockType of ['heading-one', 'heading-two', 'heading-three', 'paragraph', 'quote']) {
    it(`should not replace an interior empty ${blockType} with a list item`, () => {
      window.postMessage = jest.fn();
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {
          type: 'numbered-list', children: [
            {
              type: 'list-item', children: [
                {text: "erste"}
              ]
            },
            {
              type: 'list-item', children: [
                {
                  type: 'paragraph', children: [
                    {text: "zwitte"}
                  ]
                },
                {
                  type: blockType, children: [
                    {text: ""}
                  ]
                },
                {
                  type: 'paragraph', children: [
                    {text: "dritte"}
                  ]
                },
              ]
            },
            {
              type: 'list-item', children: [
                {text: "vierte"}
              ]
            },
          ]
        },
      ];
      editor.selection = {
        anchor: {path: [0, 1, 1, 0], offset: 0},
        focus: {path: [0, 1, 1, 0], offset: 0},
      };

      expect(getRelevantBlockType(editor)).toEqual(blockType);
      editor.insertBreak();

      expect(editor.children).toEqual([
        {
          type: 'numbered-list', children: [
            {
              type: 'list-item', children: [
                {text: "erste"}
              ]
            },
            {
              type: 'list-item', children: [
                {
                  type: 'paragraph', children: [
                    {text: "zwitte"}
                  ]
                },
                {
                  type: blockType, children: [
                    {text: ""}
                  ]
                },
                {
                  type: 'paragraph', children: [
                    {text: ""}
                  ]
                },
                {
                  type: 'paragraph', children: [
                    {text: "dritte"}
                  ]
                },
              ]
            },
            {
              type: 'list-item', children: [
                {text: "vierte"}
              ]
            },
          ]
        },
      ]);
      expect(getRelevantBlockType(editor)).toEqual('paragraph');
      expect(editor.selection).toHaveProperty('anchor.path', [0, 1, 2, 0]);
      expect(editor.selection).toHaveProperty('anchor.offset', 0);
      expect(editor.selection).toHaveProperty('focus.path', [0, 1, 2, 0]);
      expect(editor.selection).toHaveProperty('focus.offset', 0);
    });
  }

  for (const blockType of ['heading-one', 'heading-two', 'heading-three', 'paragraph', 'quote', 'code']) {
    it(`should replace a trailing empty ${blockType} with a list item`, () => {
      window.postMessage = jest.fn();
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {
          type: 'numbered-list', children: [
            {
              type: 'list-item', children: [
                {text: "erste"}
              ]
            },
            {
              type: 'list-item', children: [
                {
                  type: 'paragraph', children: [
                    {text: "zwitte"}
                  ]
                },
                {
                  type: blockType, children: [
                    {text: ""}
                  ]
                },
              ]
            },
            {
              type: 'list-item', children: [
                {text: "vierte"}
              ]
            },
          ]
        },
      ];
      editor.selection = {
        anchor: {path: [0, 1, 1, 0], offset: 0},
        focus: {path: [0, 1, 1, 0], offset: 0},
      };

      expect(getRelevantBlockType(editor)).toEqual(blockType);
      editor.insertBreak();

      expect(editor.children).toEqual([
        {
          type: 'numbered-list', children: [
            {
              type: 'list-item', children: [
                {text: "erste"}
              ]
            },
            {
              type: 'list-item', children: [
                {
                  type: 'paragraph', children: [
                    {text: "zwitte"}
                  ]
                },
              ]
            },
            {
              type: 'list-item', children: [
                {text: ""}
              ]
            },
            {
              type: 'list-item', children: [
                {text: "vierte"}
              ]
            },
          ]
        },
      ]);
      expect(getRelevantBlockType(editor)).toEqual('list-item');
      expect(editor.selection).toHaveProperty('anchor.path', [0, 2, 0]);
      expect(editor.selection).toHaveProperty('anchor.offset', 0);
      expect(editor.selection).toHaveProperty('focus.path', [0, 2, 0]);
      expect(editor.selection).toHaveProperty('focus.offset', 0);
    });
  }

  it("should not duplicate an image", () => {
    window.postMessage = jest.fn();
    const editor = withHtml(withReact(createEditor()));
    editor.subtype = 'html;hint=SEMANTIC';
    editor.children = [
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [
              {text: "before"}
            ]},
          {type: 'list-item', children: [
              {type: 'image', url: "https://example.xyz/", title: "some title", children: [
                  {text: "some alt text"}
                ]},
            ]},
          {type: 'list-item', children: [
              {text: "after"}
            ]},
        ]},
    ];
    editor.selection = {
      anchor: { path: [0, 1, 0, 0], offset: 13 },
      focus:  { path: [0, 1, 0, 0], offset: 13 },
    };

    expect(getRelevantBlockType(editor)).toEqual('image');
    editor.insertBreak();

    expect(editor.children).toEqual([
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [
              {text: "before"}
            ]},
          {type: 'list-item', children: [
              {type: 'image', url: "https://example.xyz/", title: "some title", children: [
                  {text: "some alt text"}
                ]},
              {type: 'paragraph', children: [
                  {text: ""}
                ]},
            ]},
          {type: 'list-item', children: [
              {text: "after"}
            ]},
        ]},
    ]);
    expect(getRelevantBlockType(editor)).toEqual('paragraph');
    expect(editor.selection).toHaveProperty('anchor.path', [0, 1, 1, 0]);
    expect(editor.selection).toHaveProperty('anchor.offset', 0);
    expect(editor.selection).toHaveProperty('focus.path', [0, 1, 1, 0]);
    expect(editor.selection).toHaveProperty('focus.offset', 0);
  });

  for (const listType of ['bulleted-list', 'numbered-list']) {
    it(`should divide ${listType}, when in empty item`, () => {
      window.postMessage = jest.fn();
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {
          type: listType, children: [
            {
              type: 'list-item', children: [
                {text: "un"}
              ]
            },
            {
              type: 'list-item', children: [
                {text: "deux"}
              ]
            },
            {
              type: 'list-item', children: [
                {text: ""}
              ]
            },
            {
              type: 'list-item', children: [
                {
                  type: 'image', url: "https://example.xyz/", title: "some title", children: [
                    {text: "quatre"}
                  ]
                },
              ]
            },
            {
              type: 'list-item', children: [
                {text: "cinq"}
              ]
            },
          ]
        },
      ];
      editor.selection = {
        anchor: {path: [0, 2, 0], offset: 0},
        focus: {path: [0, 2, 0], offset: 0},
      };

      expect(getRelevantBlockType(editor)).toEqual('list-item');
      editor.insertBreak();

      expect(editor.children).toEqual([
        {
          type: listType, children: [
            {
              type: 'list-item', children: [
                {text: "un"}
              ]
            },
            {
              type: 'list-item', children: [
                {text: "deux"}
              ]
            },
          ]
        },
        {
          type: 'paragraph', children: [
            {text: ""}
          ]
        },
        {
          type: listType, children: [
            {
              type: 'list-item', children: [
                {
                  type: 'image', url: "https://example.xyz/", title: "some title", children: [
                    {text: "quatre"}
                  ]
                },
              ]
            },
            {
              type: 'list-item', children: [
                {text: "cinq"}
              ]
            },
          ]
        },
      ]);
      expect(getRelevantBlockType(editor)).toEqual('paragraph');
      expect(editor.selection).toHaveProperty('anchor.path', [1, 0]);
      expect(editor.selection).toHaveProperty('anchor.offset', 0);
      expect(editor.selection).toHaveProperty('focus.path', [1, 0]);
      expect(editor.selection).toHaveProperty('focus.offset', 0);
    });
  }

  for (const type of ['heading-one', 'heading-two', 'heading-three', 'quote', 'thematic-break']) {
    it(`should produce paragraph when selection at end of ${type}`, () => {
      window.postMessage = jest.fn();
      const editor = withHtml(withReact(createEditor()));
      editor.subtype = 'html;hint=SEMANTIC';
      editor.children = [
        {type: type, children: [
            {text: "The Title"}
          ]},
        {type: 'code', children: [
            {text: "poke($8000)"}
          ]},
      ];
      editor.selection = {
        anchor: {path: [0, 0], offset: 9},
        focus: {path: [0, 0], offset: 9},
      };

      expect(getRelevantBlockType(editor)).toEqual(type);
      editor.insertBreak();

      expect(editor.children).toEqual([
        {
          type: type, children: [
            {text: "The Title"}
          ]
        },
        {
          type: 'paragraph', children: [
            {text: ""}
          ]
        },
        {type: 'code', children: [
            {text: "poke($8000)"}
          ]},
      ]);
      expect(getRelevantBlockType(editor)).toEqual('paragraph');
      expect(editor.selection).toHaveProperty('anchor.path', [1, 0]);
      expect(editor.selection).toHaveProperty('anchor.offset', 0);
      expect(editor.selection).toHaveProperty('focus.path', [1, 0]);
      expect(editor.selection).toHaveProperty('focus.offset', 0);
    });
  }
});

describe("serializeHtml", () => {
  it("should encode HTML reserved characters", () => {
    expect(serializeHtml([
      {text: "this & that"},
      {text: " a<b, c>d"},
      {text: " \"Give me liberty, or give me death!\""},
    ])).toEqual("this &amp; that a&lt;b, c&gt;d &quot;Give me liberty, or give me death!&quot;");
  });

  it("should encode emphasis", () => {
    expect(serializeHtml([
      {text: "bold text ", bold: true},
      {text: "bold and italic", bold: true, italic: true},
      {text: "only italic", italic: true},
    ])).toEqual("<strong>bold text </strong><em><strong>bold and italic</strong></em><em>only italic</em>");
  });

  it("should encode deletion and insertion", () => {
    expect(serializeHtml([
      {text: "bow "},
      {text: "deleted text", deleted: true},
      {text: "inserted text", inserted: true},
      {text: " stern"},
    ])).toEqual("bow <del>deleted text</del><ins>inserted text</ins> stern");
  });

  it("should encode inline code", () => {
    expect(serializeHtml([
      {text: "assign using "},
      {text: "const a = b + c;", code: true},
      {text: " as needed"},
    ])).toEqual("assign using <code>const a = b + c;</code> as needed");
  });

  it("should encode hard line breaks", () => {
    expect(serializeHtml([
      {text: "first line \n  indented second line"},
      {text: "book title", italic: true},
    ])).toEqual("first line <br />  indented second line<em>book title</em>");
  });

  it("should encode code blocks", () => {
    const html = serializeHtml([
      {
        type: 'code', children: [
          {
            text: `function adHocTextReplacements(text) {
  if (a&&b<c) { return null; }
  text = text.replace(/([A-Za-z])\\^2(?![\\dA-Za-z])/g, "$1²");
  text = text.replace(/([A-Za-z])\\^3(?![\\dA-Za-z])/g, "$1³");
  return text;
}
`
          },
        ]
      },
    ]);
    expect(html).toEqual(`<pre><code>function adHocTextReplacements(text) {
  if (a&amp;&amp;b&lt;c) { return null; }
  text = text.replace(/([A-Za-z])\\^2(?![\\dA-Za-z])/g, &quot;$1²&quot;);
  text = text.replace(/([A-Za-z])\\^3(?![\\dA-Za-z])/g, &quot;$1³&quot;);
  return text;
}
</code></pre>`);

    const cleanHtml = sanitizeHtml(html, semanticOnly);
    expect(cleanHtml).toEqual(`<pre><code>function adHocTextReplacements(text) {
  if (a&amp;&amp;b&lt;c) { return null; }
  text = text.replace(/([A-Za-z])\\^2(?![\\dA-Za-z])/g, &quot;$1²&quot;);
  text = text.replace(/([A-Za-z])\\^3(?![\\dA-Za-z])/g, &quot;$1³&quot;);
  return text;
}
</code></pre>`);
  });

  it("should encode links", () => {
    const html = serializeHtml([{type: 'link', url: 'https://mozilla.org/?x=шеллы', title: "Cool Example", children: [
        {text: "a cool example"},
      ]}]);
    expect(html).toEqual('<a href="https://mozilla.org/?x=%D1%88%D0%B5%D0%BB%D0%BB%D1%8B" title="Cool Example">a cool example</a>');

    const cleanHtml = sanitizeHtml(html, semanticOnly);
    expect(cleanHtml).toEqual('<a href="https://mozilla.org/?x=%D1%88%D0%B5%D0%BB%D0%BB%D1%8B" title="Cool Example">a cool example</a>');
  });

  it("should encode images", () => {
    const html = serializeHtml([{
      type: 'image',
      url: 'https://mozilla.org/?x=шеллы',
      title: "Slice of grapefruit",
      children: [
        {text: "Grapefruit slice "},
        {text: "atop", italic: true},
        {text: " a pile of other slices"}]
    }]);
    expect(html).toEqual('<img src="https://mozilla.org/?x=%D1%88%D0%B5%D0%BB%D0%BB%D1%8B" alt="Grapefruit slice atop a pile of other slices" title="Slice of grapefruit">');

    const cleanHtml = sanitizeHtml(html, semanticOnly);
    expect(cleanHtml).toEqual('<img src="https://mozilla.org/?x=%D1%88%D0%B5%D0%BB%D0%BB%D1%8B" alt="Grapefruit slice atop a pile of other slices" title="Slice of grapefruit" />');
  });

  it("should substitute data URLs for object URLs in images", () => {
    const substitutions = new Map();
    substitutions.set('blob:http://192.168.1.74:3000/2fd265e6-86f4-4826-9fc6-98812c4b0bb5',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAABlBMVEUAAAD///+l2Z/dAAAACXBIWXMAAAAAAAAAAACdYiYyAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==');
    const html = serializeHtml([{
      type: 'image',
      url: 'blob:http://192.168.1.74:3000/2fd265e6-86f4-4826-9fc6-98812c4b0bb5',
      title: "something",
      children: [
        {text: "a thing"}]
    }], substitutions);
    expect(html).toEqual('<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAABlBMVEUAAAD///+l2Z/dAAAACXBIWXMAAAAAAAAAAACdYiYyAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==" alt="a thing" title="something">');

    const cleanHtml = sanitizeHtml(html, semanticOnly);
    expect(cleanHtml).toEqual('<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAABlBMVEUAAAD///+l2Z/dAAAACXBIWXMAAAAAAAAAAACdYiYyAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==" alt="a thing" title="something" />');
  });

  it("should drop images containing an object URL with no substitution", () => {
    console.error = jest.fn();

    const html = serializeHtml([{
      type: 'image',
      url: 'blob:http://192.168.1.74:3000/2fd265e6-86f4-4826-9fc6-98812c4b0bb5',
      title: "something",
      children: [
        {text: "a thing"}]
    }], new Map());
    expect(html).toEqual('');

    expect(console.error).toHaveBeenCalledWith(expect.stringMatching("No substitution for"), expect.stringMatching("blob:http://192.168.1.74:3000/"));
  });
});


describe("deserializeHtml", () => {
  const editor = withHtml({
    isInline: () => false,
    isVoid: () => false
  });

  it("should return an array of Slate nodes, even for empty string", () => {
    const html = ``;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes.length).toEqual(0);
  });

  it("should return an array of Slate nodes, even for plain text", () => {
    const html = `foo`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes[0]).toEqual({text: "foo"});
    expect(slateNodes.length).toEqual(1);
  });

  it("should merge the text of ignored tags", () => {
    const html = `<ruby>  明日 <rp>(</rp><rt>Ashita</rt><rp>)</rp></ruby>`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes[0]).toEqual({text: ` 明日 (Ashita)`});
    expect(slateNodes.length).toEqual(1);
  });

  it("should parse <code> <kbd> and <samp> tags as code marks", () => {
    const html = `The <code>push()</code> method <kbd>help mycommand</kbd> look for <samp>0 files</samp> foo`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes[0]).toEqual({text: "The "});
    expect(slateNodes[1]).toEqual({text: "push()", code: true});
    expect(slateNodes[2]).toEqual({text: " method "});
    expect(slateNodes[3]).toEqual({text: "help mycommand", code: true});
    expect(slateNodes[4]).toEqual({text: " look for "});
    expect(slateNodes[5]).toEqual({text: "0 files", code: true});
    expect(slateNodes[6]).toEqual({text: " foo"});
    expect(slateNodes.length).toEqual(7);
  });

  it("should parse <em> <i> <q> <dfn> <cite> <var> <abbr> and <address> tags as italic marks", () => {
    const html = `The <em>upper</em> thing <i>everyone</i> needs <q>supposedly</q> a <dfn>validator</dfn> like <cite>Nineteen Eighty-Four</cite> foo <var>x<sub>1</sub></var> bar <abbr title="Laugh Out Loud">LOL</abbr> spam <address><a href="mailto:jdoe@google.com">jdoe@google.com</a></address>`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes[0]).toEqual({text: "The "});
    expect(slateNodes[1]).toEqual({text: "upper", italic: true});
    expect(slateNodes[2]).toEqual({text: " thing "});
    expect(slateNodes[3]).toEqual({text: "everyone", italic: true});
    expect(slateNodes[4]).toEqual({text: " needs "});
    expect(slateNodes[5]).toEqual({text: "supposedly", italic: true});
    expect(slateNodes[6]).toEqual({text: " a "});
    expect(slateNodes[7]).toEqual({text: "validator", italic: true});
    expect(slateNodes[8]).toEqual({text: " like "});
    expect(slateNodes[9]).toEqual({text: "Nineteen Eighty-Four", italic: true});
    expect(slateNodes[10]).toEqual({text: " foo "});
    expect(slateNodes[11]).toEqual({text: "x", italic: true});
    expect(slateNodes[12]).toEqual({text: "1", italic: true, subscript: true});
    expect(slateNodes[13]).toEqual({text: " bar "});
    expect(slateNodes[14]).toEqual({text: "LOL", italic: true});
    expect(slateNodes[15]).toEqual({text: " spam "});
    expect(slateNodes[16]).toEqual({type: "link", url: "mailto:jdoe@google.com", title: undefined,
      children: [{text: "jdoe@google.com", italic: true}]});
    expect(slateNodes.length).toEqual(17);
  });

  it("should correctly parse italic marks inside italic marks", () => {
    const html = `<em>outer <em>inner</em> again outer</em> plain`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes[0]).toEqual({text: "outer ", italic: true});
    expect(slateNodes[1]).toEqual({text: "inner", italic: true});
    expect(slateNodes[2]).toEqual({text: " again outer", italic: true});
    expect(slateNodes[3]).toEqual({text: " plain"});
    expect(slateNodes.length).toEqual(4);
  });

  it("should parse <s> and <strike> tags as strikethrough marks", () => {
    const html = `leading text <s>struck text</s> interquel1 <strike>more struck text</strike> trailing text`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes[0]).toEqual({text: "leading text "});
    expect(slateNodes[1]).toEqual({text: "struck text", strikethrough: true});
    expect(slateNodes[2]).toEqual({text: " interquel1 "});
    expect(slateNodes[3]).toEqual({text: "more struck text", strikethrough: true});
    expect(slateNodes[4]).toEqual({text: " trailing text"});
    expect(slateNodes.length).toEqual(5);
  });

  it("should parse <del> and <ins> tags", () => {
    const html = `prolog <del>local text</del><ins>remote text</ins> epilogue`

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes[0]).toEqual({text: "prolog "});
    expect(slateNodes[1]).toEqual({text: "local text", deleted: true});
    expect(slateNodes[2]).toEqual({text: "remote text", inserted: true});
    expect(slateNodes[3]).toEqual({text: " epilogue"});
    expect(slateNodes.length).toEqual(4);
  });

  it("should parse <p> <figcaption> <details> <dt> and <dd> tags as paragraphs", () => {
    const html = `<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
<figure>
  <img src="favicon-192x192.png">
  <figcaption>MDN Logo</figcaption>
</figure>
<details>
    <summary>Sorry</summary>
    Syntax error in line 42
</details>
<dl>
  <dt>Firefox</dt>
  <dt>Mozilla Firefox</dt>
  <dd>
    A free, open source, cross-platform, graphical web browser. 
  </dd>
</dl>
`;

    const cleanHtml = sanitizeHtml(html, semanticOnly);
    const slateNodes = deserializeHtml(cleanHtml, editor);

    expect(slateNodes[0]).toEqual({type: 'paragraph', children: [{text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit."}]});

    expect(slateNodes[1].type).toEqual('image');
    expect(slateNodes[1].url).toEqual('favicon-192x192.png');
    expect(slateNodes[2].type).toEqual('paragraph');
    expect(slateNodes[2].children[0].text).toMatch(/MDN Logo/);
    expect(slateNodes[2].children[0].italic).toEqual(true);

    expect(slateNodes[3].type).toEqual('paragraph');
    expect(slateNodes[3].children[0].text).toMatch(/Sorry/);
    expect(slateNodes[3].children[0].text).toMatch(/Syntax error in line 42/);

    expect(slateNodes[4].type).toEqual('paragraph');
    expect(slateNodes[4].children[0]).toEqual({text: "Firefox", bold: true});
    expect(slateNodes[5].type).toEqual('paragraph');
    expect(slateNodes[5].children[0]).toEqual({text: "Mozilla Firefox", bold: true});
    expect(slateNodes[6].type).toEqual('quote');   // This treatment is a hack
    expect(slateNodes[6].children[0].text).toMatch(/A free, open source, cross-platform, graphical web browser./);

    expect(slateNodes.length).toEqual(7);
  });

  it("should retain blank Leaves between inline Elements", () => {
    const html = `leading text <a href="http://example.com"> anchor text </a> trailing text`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes.length).toEqual(3);
    expect(slateNodes[0]?.text).toEqual("leading text ");
    expect(slateNodes[1]?.type).toEqual('link');
    expect(slateNodes[2]?.text).toEqual(" trailing text");
  });

  it("should parse a link inside bold as bold inside a link", () => {
    const html = `<b><a href=“https://developer.mozilla.org/en-US/docs/Glossary/Style_origin”>style origin</a></b>`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes[0]?.type).toEqual('link');
    expect(slateNodes[0].children[0]).toEqual({text: "style origin", bold: true});
    expect(slateNodes.length).toEqual(1);
  });

  it("should parse an image inside emphasis as emphasis inside image", () => {
    const html = `<em><img class="fit-picture"
     src="/media/cc0-images/grapefruit-slice-332-332.jpg" alt="a slice of grapefruit"/></em>`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes[0]?.type).toEqual('image');
    expect(slateNodes[0].children.length).toEqual(1);
    expect(slateNodes[0].children[0]).toEqual({text: "a slice of grapefruit", italic: true});
    expect(slateNodes.length).toEqual(1);
  });

  it("should parse image without src as not an image", () => {
    const html = `<img src="ftp://ftp.funet.fi/pub/chicken.gif" alt="rooster"/>`;
    const cleanHtml = sanitizeHtml(html, semanticOnly);

    const slateNodes = deserializeHtml(cleanHtml, editor);

    expect(slateNodes[0]?.type).not.toEqual('image');
    expect(slateNodes.length).toBeLessThanOrEqual(1);
    // expect(slateNodes).toEqual([{"children": [{"text": ""}]}]);
  });

  it("should drop blank Leaves between block Elements, so all the children of an Element are the same", () => {
    const html = `<p>first paragraph</p>
<p>second paragraph</p>`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes.length).toEqual(2);
    expect(slateNodes[0].type).toEqual("paragraph");
    expect(slateNodes[1].type).toEqual("paragraph");
  });

  it("should coerce leaf text to Elements, so all the children of an Element are the same", () => {
    const html = `<h2>Book Title</h2>
leaf text`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes.length).toEqual(2);
    expect(slateNodes[0].type).toEqual("heading-two");
    expect(slateNodes[1]).toBeInstanceOf(Object);
    expect(slateNodes[1].children?.length).toEqual(1);
    expect(slateNodes[1].children[0]).toEqual({text: " leaf text"});
  });

  it("should coerce marked leaf text to Elements, so all the children of an Element are the same", () => {
    const html = `<strong>marked leaf text<p>paragraph text</p></strong>`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes[0].children[0]).toEqual({text: "marked leaf text", bold: true});
    expect(slateNodes[0].children.length).toEqual(1);
    expect(slateNodes[1].type).toEqual('paragraph');
    expect(slateNodes[1].children[0]).toEqual({text: "paragraph text", bold: true});
    expect(slateNodes.length).toEqual(2);
  });

  it("should coerce leaf tags to Elements, so all the children of an Element are the same", () => {
    const html = `<pre>let a = b;</pre>
<strong>exclamation!</strong>`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes.length).toEqual(2);
    expect(slateNodes[0].type).toEqual("code");
    expect(slateNodes[1]).toBeInstanceOf(Object);
    expect(slateNodes[1].children?.length).toEqual(1);
    expect(slateNodes[1].children[0]).toEqual({text: "exclamation!", bold: true});
  });

  it("should coerce DIV content to Elements, so all the children of an Element are the same", () => {
    const html = `<h2>About your trash collection schedule:</h2>
    <div>
     Some residents are assigned a “color” that establishes when their collection day will be. 
     If you reside in a “color” collection zone, your collection day moves forward one day after every observed holiday. 
     These “color zones” are: Navy, Pink, Ruby, Gold, or Gray.
   </div>
   <div>
    If you’re unsure of your next collection day, you’re encouraged to call the Color Collection hotline, 
    24 hours, 7 days a week, to find out your collection schedule. 
    </div>
    <div>
   \tNAVY customers can call 614-645-NAVY (6289); 
    </div>`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes.length).toEqual(4);
    expect(slateNodes[0].type).toEqual("heading-two");
    for (const node of slateNodes) {
      expect(node).toBeInstanceOf(Object);
      expect(node.children?.length).toEqual(1);
    }
  });

  it("should wrap links sibling to blocks, so all the children of an Element are the same", () => {
    const html = `<a href="http://example.com">link text</a>
<p>lorem ipsum</p>`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes.length).toEqual(2);
    expect(Element.isElement(slateNodes[0])).toBeTruthy();
    expect(slateNodes[0].type).toBeUndefined();
    expect(slateNodes[0].children.length).toEqual(1);
    const child = slateNodes[0].children[0];
    expect(child.type).toEqual('link');
    expect(child.url).toEqual("http://example.com");
  });

  it("should not wrap text, because of a link sibling, so all the children of an Element are the same", () => {
    const html = `<a href="http://example.com">link text</a>
ipso facto`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes.length).toEqual(2);
    expect(Element.isElement(slateNodes[0])).toBeTruthy();
    expect(slateNodes[0].type).toEqual('link');
    expect(slateNodes[0].url).toEqual("http://example.com");
    expect(Text.isText(slateNodes[1])).toBeTruthy();
    expect(slateNodes[1].text).toEqual(" ipso facto");
  });

  it("should parse a TH element as a TD plus bold mark", () => {
    const html = `<table>
    <tr><th></th><th>Name</th><th>Age</th></tr>
    <tr><th>Pitcher</th><td>Alice</td><td>34</td></tr>
</table>`;

    const slateNodes = deserializeHtml(html, editor);

    expect(Element.isElement(slateNodes[0])).toBeTruthy();
    expect(slateNodes[0].type).toEqual('table');
    expect(slateNodes.length).toEqual(1);

    expect(Element.isElement(slateNodes[0].children[0])).toBeTruthy();
    expect(slateNodes[0].children[0].type).toEqual('table-row');
    expect(Element.isElement(slateNodes[0].children[1])).toBeTruthy();
    expect(slateNodes[0].children[1].type).toEqual('table-row');
    expect(slateNodes[0].children).toHaveLength(2);

    expect(Element.isElement(slateNodes[0].children[0].children[1])).toBeTruthy();
    expect(slateNodes[0].children[0].children[1].type).toEqual('table-cell');
    expect(slateNodes[0].children[0].children[1].children[0]).toEqual({text: "Name", bold: true});
    expect(slateNodes[0].children[0].children[2].children[0]).toEqual({text: "Age", bold: true});

    expect(Element.isElement(slateNodes[0].children[1].children[0])).toBeTruthy();
    expect(slateNodes[0].children[1].children[0].type).toEqual('table-cell');
    expect(slateNodes[0].children[1].children[0].children[0]).toEqual({text: "Pitcher", bold: true});
    expect(slateNodes[0].children[1].children[1].children[0]).toEqual({text: "Alice"});
    expect(slateNodes[0].children[1].children[2].children[0]).toEqual({text: "34"});
  });

  it("should parse a table caption as a bold paragraph before the table", () => {
    const html = `
<table>
  <caption><strike>Example</strike> Caption</caption>
  <tr>
    <th>Login</th>
    <th>Emails</th>
  </tr>
  <tr>
    <td>user1</td>
    <td>user1@sample.com</td>
  </tr>
  <tr>
    <td>user2</td>
    <td><table>
        <tr><td>user2@sample.com</td></tr>
        <tr><td>user2@sample.edu</td></tr>
    </table></td>
  </tr>
</table>`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes[0].type).toEqual('paragraph');
    expect(slateNodes[0].children[0].text).toMatch(/Example/);
    expect(slateNodes[0].children[0]).toHaveProperty('bold', true);
    expect(slateNodes[0].children[0]).toHaveProperty('strikethrough', true);
    expect(slateNodes[0].children[1].text).toMatch(/ Caption/);
    expect(slateNodes[0].children[1]).toHaveProperty('bold', true);
    expect(slateNodes[0].children).toHaveLength(2);
    expect(slateNodes[1].type).toEqual('table');
    expect(slateNodes[1].children).toHaveLength(3);
    expect(slateNodes[1].children[2].children[1].children[0]).toHaveProperty('type', 'table');
    expect(slateNodes[1].children[2].children[1].children).toHaveLength(1);
    expect(slateNodes).toHaveLength(2);
  });
});


describe("serializeHtml and deserializeHtml", () => {
  const editor = withHtml({
    isInline: () => false,
    isVoid: () => false
  });

  it("should round-trip HTML reserved characters", () => {
    const original = [
      {text: `this & that a<b, c>d "Give me liberty, or give me death!" Bob's bargains`},
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip emphasis", () => {
    const original = [
      {text: "bold text ", bold: true},
      {text: "bold and italic", bold: true, italic: true},
      {text: "only italic", italic: true},
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip inline code", () => {
    const original = [
      {text: "assign using "},
      {text: "const a = b + c;", code: true, bold: true},
      {text: " as needed"},
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip superscript", () => {
    const original = [
      {text: "x"},
      {text: "10", superscript: true},
      {text: " + y"},
      {text: "z", superscript: true},
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip subscript", () => {
    const original = [
      {text: "CH"},
      {text: "4", subscript: true},
      {text: " + O"},
      {text: "2", subscript: true},
      {text: " ---> CO"},
      {text: "2", subscript: true},
      {text: " + H"},
      {text: "2", subscript: true},
      {text: "O"}
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip underline", () => {
    const original = [
      {text: "The "},
      {text: "thing", underline: true},
      {text: " itself"},
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip strikethrough", () => {
    const original = [
      {text: "Use "},
      {text: "caution", strikethrough: true},
      {text: "prudence"},
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip hard line breaks", () => {
    const original = [
      {text: "first line \n indented second line"},
      {text: "book title", italic: true},
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip paragraphs", () => {
    const original = [
      {type: 'paragraph', children: [
          {text: "something old "},
          {text: " something new", italic: true},

        ]},
      {type: 'paragraph', children: [
          {text: "something borrowed ", bold: true},
          {text: "something blue"},
        ]},
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip headings", () => {
    const original = [
      {type: 'heading-one', children: [
          {text: "East "},
          {text: "of Eternity", italic: true},
        ]},
      {type: 'heading-two', children: [
          {text: "Illogic", bold: true},
          {text: "of Empire"},
        ]},
      {type: 'heading-three', children: [
          {text: "Subsidiary considerations"},
        ]},
        // not a true heading
      {type: 'paragraph', children: [
          {text: "Subsidiary considerations", bold: true},
        ]},
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip code blocks", () => {
    const original = [
      {type: 'code', children: [
          {text: `first line
    indented 4 spaces   
        indented 8 spaces   `},
          {text: `   emphasized
          followon`, italic: true},
        ]},
      {type: 'code', children: [
          {text: `h1 {
    margin-block-start: 0;
    margin-block-end: 1ex;
    margin-inline-start: 0;
    margin-inline-end: 0;
    font-size: 1.5em;
    text-align: center;
    text-transform: capitalize;
}
`},
        ]
      },
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip block quotes of paragraphs", () => {
    const original = [
      {
        type: 'quote', children: [
          {
            type: 'paragraph', children: [
              {text: "something old "},
              {text: " something new", italic: true},

            ]
          },
          {
            type: 'paragraph', children: [
              {text: "something borrowed ", bold: true},
              {text: "something blue"},
            ]
          },
        ]
      },
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip block quotes of text", () => {
    const original = [
      {
        type: 'quote', children: [
          {text: "something old "},
          {text: " something new", italic: true},
        ]
      },
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip unordered lists of text and paragraphs", () => {
    const original = [
      {
        type: 'bulleted-list', children: [
          {type: 'list-item', children: [
              {text: " rise anew "},
            ]
          },
          {type: 'list-item', children: [
              {type: 'paragraph', children: [
                  {text: "something borrowed ", bold: true},
                  {text: "something blue"},
              ]},
            ]
          },
        ]
      },
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip ordered lists of paragraphs and text", () => {
    const original = [
      {
        type: 'numbered-list', children: [
          {type: 'list-item', children: [
              {type: 'paragraph', children: [
                  {text: "something borrowed ", bold: true},
                  {text: "something blue"},
                ]},
            ]
          },
          {type: 'list-item', children: [
              {text: " rise anew "},
            ]
          },
        ]
      },
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip hierarchies of ordered and unordered lists", () => {
    const original = [
      {type: 'numbered-list', children: [
          {type: 'list-item', children: [
              {text: " first "},
            ]},
          {type: 'list-item', children: [
            {type: 'bulleted-list', children: [
              {type: 'list-item', children: [
                  {text: " second A ", bold: true},
              ]},
              {type: 'list-item', children: [
                {text: " second B"},
              ]},
            ]},
          ]},
        ]
      },
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip hierarchies of tables", () => {
    const original = [
      {type: 'table', children: [
        {type: 'table-row', children: [
            {type: 'table-cell', children: [{text: " A1 ", bold: true}]},
            {type: 'table-cell', children: [{text: " A2 ", bold: true}]},
        ]},
        {type: 'table-row', children: [
            {type: 'table-cell', children: [{text: " B1 ", bold: true}]},
            {type: 'table-cell', children: [{text: " B2 "}]},
        ]},
        ]
      },
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip horizontal rules", () => {
    const original = [
      {type: 'paragraph', children: [{text: "first section"},]},
      {type: 'thematic-break', children: [{text: ""}]},
      {type: 'code', children: [{text: `function deleteNote(id) {
  return remotePrms.then(remoteStorage => {
    return Promise.all([remoteStorage.notes.delete(id), deleteNoteDb(id)]);
  });
}
`},]},
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip links surrounding paragraphs", () => {
    const original = [
      {text: "to advance "},
      {type: 'link', url: 'http://example.org', title: "tooltip?", children: [
          {type: 'paragraph', children: [{text: `click here`}]}
        ]},
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip child links", () => {
    const original = [
      {type: 'paragraph', children: [
          {type: 'link', url: 'https://mozilla.org/?x=шеллы', title: "Cool Example", children: [
              {text: "a cool example"},
            ]},
          {text: " for you"},
        ]},
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });


  it("should round-trip images", () => {
    const original = [
      {type: 'image', url: 'http://example.org', title: "tooltip?", children: [{text: "a mini-lop"}]},
      {type: 'paragraph', children: [
          {type: 'image', url: 'https://mozilla.org/?x=шеллы', title: "Bell curve", children: [{text: "graph"}]}
        ]},
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });
});
