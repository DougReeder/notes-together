// Copyright © 2021-2022 Doug Reeder under the MIT License

import {deserializeMarkdown, serializeMarkdown, escapeMarkdown} from "./slateMark";
import {withHtml} from "./slateHtml";
import {withReact} from "slate-react";
import {createEditor} from "slate";

describe("escapeMarkdown", () => {
  it("should escape only periods that look like ordered list items", () => {
    // expect(escapeMarkdown("foo\n23. TOC entry\n   24. another")).toEqual("foo\n23\\. TOC entry\n   24\\. another");

    expect(escapeMarkdown("19.2")).toEqual("19.2");
  });

  it("should escape only parentheses that look like links", () => {
    // expect(escapeMarkdown("[Link](http://a.com)")).toEqual("[Link]\\(http://a.com)");

    expect(escapeMarkdown("something (aside) more")).toEqual("something (aside) more");
  });

  it("should escape matching asterisks", () => {
    // expect(escapeMarkdown("foo *not italic* bar *also not*")).toEqual("foo *not italic\\* bar \\*also not\\*");

    expect(escapeMarkdown("3 * 4 = 12")).toEqual("3 * 4 = 12");

    // expect(escapeMarkdown("bar **not bold** spam **also not**")).toEqual("bar *\\*not bold\\*\\* spam \\*\\*also not\\*\\*");
  });
  // it("should escape asterisks that look like list bullets", () => {
  //   expect(escapeMarkdown("       * not an item")).toEqual("       \\* not an item");
  // });

});


describe("deserializeMarkdown", () => {
  it("should parse character entities", () => {
    const mdText = `23&ndash;45
To be &mdash; or not to be`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([
      {type: 'paragraph', children: [{text: `23–45 To be — or not to be`}]}
    ]);
  });

  it("should collapse softbreak plus spacing to single space", () => {
    const mdText = `foo 
  bar 
   spam`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([
      {type: 'paragraph', children: [{text: `foo bar spam`}]}
    ]);
  });

  it("should remove space after a hard break", () => {
    const mdText = `waldo fred
spam *frotz  
  nim* wibble`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([
      {type: 'paragraph', children: [
          {text: `waldo fred spam `},
          {text: `frotz`, italic: true},
          {text: `\n`, italic: true},
          {text: `nim`, italic: true},
          {text: ` wibble`},
        ]}
    ]);
  });

  it("should handle multiple mark types", () => {
    const mdText = 'plain *emphasized **also strongly emphasized ~~also strikethrough `also monospace` just three~~ just two** just emph* normal';

    const slateNodes = deserializeMarkdown(mdText);

    expect (slateNodes).toEqual([
      {type: 'paragraph', children: [
          {text: "plain "},
          {text: "emphasized ", italic: true},
          {text: "also strongly emphasized ", italic: true, bold: true},
          {text: "also strikethrough ", italic: true, bold: true, strikethrough: true},
          {text: "also monospace", italic: true, bold: true, strikethrough: true, code: true},
          {text: " just three", italic: true, bold: true, strikethrough: true},
          {text: " just two", italic: true, bold: true},
          {text: " just emph", italic: true},
          {text: " normal"},
        ]}
    ]);
  });

  it("should parse H3-H6 to heading-three", () => {
    const editor = withHtml(withReact(createEditor()));
    const mdText = `### third level
#### fourth level

##### fifth level

###### sixth level`;

    const slateNodes = deserializeMarkdown(mdText, editor);

    expect(slateNodes).toEqual([
      {type: 'heading-three', children: [{text: `third level`}]},
      {type: 'heading-three', children: [{text: `fourth level`}]},
      {type: 'heading-three', children: [{text: `fifth level`}]},
      {type: 'heading-three', children: [{text: `sixth level`}]},
    ]);
  });

  it("should convert MD unordered list to Slate bulleted list", () => {
    const mdText = `   * erste 

   *  zwitte A

      zwitte B   

  *   dritte`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([{type: "bulleted-list", children: [
        {type: 'list-item', children: [
            {text: "erste"},
          ]},
        {type: 'list-item', children: [
            {type: 'paragraph', children: [{text: "zwitte A"}]},
            {type: 'paragraph', children: [{text: "zwitte B"}]},
          ]},
        {type: 'list-item', children: [
            {text: "dritte"},
          ]},
      ]}]);
  });

  it("should discard empty link", () => {
    const mdText = `[]( )`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([]);
  });

  it("should normalize link w/o link text", () => {
    const mdText = `*plugh [](http://example.com/) xyzzy*`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([{type: 'paragraph', children: [
        {text: "plugh ", italic: true},
        {type: 'link', url: 'http://example.com/', title: null, children: [
            {text: "http://example.com/", italic: true}
          ]},
        {text: " xyzzy", italic: true}
      ]}]);
  });

  it("should retain link text of link w/o URL", () => {
    const mdText = `**thud [waugh oh]( ) limber**`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([{type: 'paragraph', children: [
        {text: "thud ", bold: true},
        {text: "waugh oh", bold: true},
        {text: " limber", bold: true},
      ]}]);
  });

  it("should pull definition into link reference", () => {
    console.error = jest.fn();
    const mdText = `For information, see the [Markdown][md] reference.
For the same information, see the [][md] reference.
For no information, see the [fake][nomatch] reference!  

 [md]: http://daringfireball.net/projects/markdown "Markdown [announcement post]"
`;
    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([
      {type: 'paragraph', children: [
          {text: "For information, see the "},
          {type: 'link', url: 'http://daringfireball.net/projects/markdown', title: "Markdown [announcement post]", children: [
              {text: "Markdown"},
            ]},
          {text: " reference. For the same information, see the "},
          {type: 'link', url: 'http://daringfireball.net/projects/markdown', title: "Markdown [announcement post]", children: [
              {text: "Markdown [announcement post]"},
            ]},
          {text: " reference. For no information, see the [fake][nomatch] reference!"},
        ]},
    ]);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("should parse autolinks", () => {
    console.error = jest.fn();
    const mdText = `before <http://foo.bar.baz> between <MAILTO:FOO@BAR.BAZ> after`;
    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([
      {type: 'paragraph', children: [
          {text: "before "},
          {type: 'link', url: 'http://foo.bar.baz', title: null, children: [
              {text: "http://foo.bar.baz"},
            ]},
          {text: " between "},
          {type: 'link', url: 'MAILTO:FOO@BAR.BAZ', title: null, children: [
              {text: "MAILTO:FOO@BAR.BAZ"},
            ]},
          {text: " after"},
        ]},
    ]);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("should parse GFM tables", () => {
    console.warn = jest.fn();
    const mdText = `
| Name | Occupation |
|:-----|:----------:|
| Conan [none] | Barbarian |
|| you know, that job
| Conan O'Brian | Talk Show Host |
|
| Aurthur [Conan Doyle](https://sf-encyclopedia.com/entry/doyle_arthur_conan) | Author |`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "Name", bold: true}]},
              {type: 'table-cell', children: [{text: "Occupation", bold: true}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "Conan [none]"}]},
              {type: 'table-cell', children: [{text: "Barbarian"}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: ""}]},
              {type: 'table-cell', children: [{text: "you know, that job"}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "Conan O'Brian"}]},
              {type: 'table-cell', children: [{text: "Talk Show Host"}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: ""}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "Aurthur "},
                  {type: 'link', url: 'https://sf-encyclopedia.com/entry/doyle_arthur_conan', title: null, children: [
                      {text: "Conan Doyle"}
                    ]}]},
              {type: 'table-cell', children: [{text: "Author"}]},
            ]},
        ]}
    ]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should parse GFM tables without leading & trailing pipes", () => {
    console.warn = jest.fn();
    const mdText = `
 Framework | Notes 
-----|----------:
 Mojo | webOS only 
 Enyo 1 | webOS \\| WebKit browser`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "Framework", bold: true}]},
              {type: 'table-cell', children: [{text: "Notes", bold: true}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "Mojo"}]},
              {type: 'table-cell', children: [{text: "webOS only"}]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [{text: "Enyo 1"}]},
              {type: 'table-cell', children: [{text: "webOS | WebKit browser"}]},
            ]},
        ]}
    ]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should extract text of HTML that's not specially handled", () => {
    console.warn = jest.fn();
    const mdText = "something <samp>special</samp> for you";

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([{type: "paragraph", children: [{text: "something "}, {text: "special"}, {text: " for you"}]}]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("should apply superscript tag to enclosed text", () => {
    console.warn = jest.fn();
    const mdText = "M<sup>lle</sup> Juliet";

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([{type: "paragraph", children: [
        {text: "M"},
        {text: "lle", superscript: true},
        {text: " Juliet"}
      ]}]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should apply subscript tag to enclosed text", () => {
    console.warn = jest.fn();
    const mdText = "Mason & Jones<sub>MJ</sub> found no such relationship";

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([{type: "paragraph", children: [
        {text: "Mason & Jones"},
        {text: "MJ", subscript: true},
        {text: " found no such relationship"}
      ]}]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should apply underline tag to enclosed text", () => {
    console.warn = jest.fn();
    const mdText = "the word <u>cheif</u> is misspelled";

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([{type: "paragraph", children: [
        {text: "the word "},
        {text: "cheif", underline: true},
        {text: " is misspelled"}
      ]}]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should apply strikethrough tag to enclosed text", () => {
    console.warn = jest.fn();
    const mdText = "shall <s>not</s> be accepted";

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([{type: "paragraph", children: [
        {text: "shall "},
        {text: "not", strikethrough: true},
        {text: " be accepted"}
      ]}]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should recognize break tag", () => {
    console.warn = jest.fn();
    const mdText = `grault garply
baz **qux<br />quux** corge`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([
      {type: 'paragraph', children: [
          {text: `grault garply baz `},
          {text: `qux`, bold: true},
          {text: `\n`, bold: true},
          {text: `quux`, bold: true},
          {text: ` corge`},
        ]}
    ]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should extract text from definition list", () => {
    console.error = jest.fn();
    const mdText = `<dl>
  <dt>Danish axe</dt>
  <dt>poleaxe</dt>
  <dd>A somewhat larger axehead on a two-handed haft</dd>
</dl>`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([{text: `Danish axe
  poleaxe
  A somewhat larger axehead on a two-handed haft`}]);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("should deserialize image in paragraph as separate block", () => {
    const mdText = `before
![description](https://delta.edu/a.png "some title")
after`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([
      {type: 'paragraph', children: [
          {text: "before "},
          {text: " after"},
        ]},
      {type: 'image', url: 'https://delta.edu/a.png', title: "some title", children: [
          {text: "description"},
        ]},
    ]);
  });

  it("should deserialize separate image as separate block", () => {
    const mdText = `before

![description](https://chi.edu/b.gif "some title")

after`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([
      {type: 'paragraph', children: [
          {text: "before"}
        ]},
      {type: 'image', url: "https://chi.edu/b.gif", title: "some title", children: [
          {text: "description"},
        ]},
      {type: 'paragraph', children: [
          {text: "after"}
        ]},
    ]);
  });

  it("should retain description text of image w/o URL", () => {
    const mdText = `~~pre ![some thing]( ) post~~`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([
      {type: 'paragraph', children: [
          {text: `pre `, strikethrough: true},
          {text: `some thing`, strikethrough: true},
          {text: ` post`, strikethrough: true},
        ]}
    ]);
  });

  it("should pull definition into image reference", () => {
    const mdText = `prelude ![first reference][foo *bar*] first interlude ![foo *bar*] second interlude ![][foo *bar*] afterword

[foo *bar*]: train.jpg "train & tracks"
`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([
      {type: 'paragraph', children: [
          {text: "prelude "},
          {text: " first interlude "},
          {text: " second interlude "},
          {text: " afterword"},
        ]},
      {type: 'image', url: "train.jpg", title: "train & tracks", children: [ {text: "first reference"} ]},
      {type: 'image', url: "train.jpg", title: "train & tracks", children: [ {text: "foo bar"} ]},
      {type: 'image', url: "train.jpg", title: "train & tracks", children: [ {text: "train & tracks"} ]},
    ]);
  });
});


describe("serializeMarkdown", () => {
  it("should not escape inside code blocks", () => {
    const editor = withHtml(withReact(createEditor()));
    const slateNodes = [
        {type: 'code', children: [{text: "let a = b**c, x = y**z;"}]}
    ];

    const md = serializeMarkdown(editor, slateNodes);

    expect(md).toEqual(`\`\`\`
let a = b**c, x = y**z;
\`\`\``);
  });

  // it("should escape asterisks outside code blocks", () => {
  //   const editor = withHtml(withReact(createEditor()));
  //   const slateNodes = [
  //     {type: 'paragraph', children: [{text: "this *is not* italic"}]}
  //   ];
  //
  //   const md = serializeMarkdown(editor, slateNodes);
  //
  //   expect(md).toEqual(`this *is not\\* italic`);
  // });

  // it("should escape underscores outside code blocks", () => {
  //   const editor = withHtml(withReact(createEditor()));
  //   const slateNodes = [
  //     {type: 'paragraph', children: [{text: "Use __FILE__ and __LINE__."}]}
  //   ];
  //
  //   const md = serializeMarkdown(editor, slateNodes);
  //
  //   expect(md).toEqual(`Use _\\_FILE\\_\\_ and \\_\\_LINE\\_\\_.`);
  // });

  it("should not escape underscores in inline code", () => {
    const editor = withHtml(withReact(createEditor()));
    const slateNodes = [
      {type: 'paragraph', children: [
          {text: "Use "},
          {text: "__FILE__", "code": true},
          {text: " and "},
          {text: "__LINE__", "code": true},
          {text: "."}
        ]}
    ];

    const md = serializeMarkdown(editor, slateNodes);

    expect(md).toEqual(`Use \`__FILE__\` and \`__LINE__\`.`);
  });

  it("should serialize unordered lists", () => {
    const editor = withHtml(withReact(createEditor()));
    const slateNodes = [
      {type: 'bulleted-list', children: [
        {type: 'list-item', children: [
          {type: 'paragraph', children: [
              {text: "erste"},
          ]}
        ]},
        {type: 'list-item', children: [
          {type: 'paragraph', children: [
              {text: "zwitte"},
          ]}
        ]},
      ]}
    ];

    const md = serializeMarkdown(editor, slateNodes);

    expect(md).toEqual(`* erste
* zwitte`);
  });

  it("should serialize ordered lists of simple items", () => {
    const editor = withHtml(withReact(createEditor()));
    const slateNodes = [
      {type: "numbered-list", "listStart": 1, children: [
          {type: 'list-item', children: [{text: "un"}]},
          {type: 'list-item', children: [{text: "deux"}]},
          {type: 'list-item', children: [{text: "troi"}]},
        ]},
    ];

    const md = serializeMarkdown(editor, slateNodes);

    expect(md).toEqual(`1. un
2. deux
3. troi`);
  });

  it("should serialize children of graphic as alt text", () => {
    const editor = withHtml(withReact(createEditor()));
    const slateNodes = [
      { type: 'image', url: 'http://example.com/pic', title: 'still life', children: [
          {text: "tromp "},
          {text: "l'oeil", bold: true},
        ]}
    ];

    const md = serializeMarkdown(editor, slateNodes);

    expect(md).toEqual(`![tromp **l'oeil**](http://example.com/pic "still life")`);
  });

  it("should omit title of graphic when empty", () => {
    const editor = withHtml(withReact(createEditor()));
    const slateNodes = [
      { type: 'image', url: 'https://example.com/other', children: [
          {text: "Not a pipe"},
        ]}
    ];

    const md = serializeMarkdown(editor, slateNodes);

    expect(md).toEqual(`![Not a pipe](https://example.com/other)`);
  });

  it("should serialize hierarchical lists", () => {
    const editor = withHtml(withReact(createEditor()));
    const slateNodes = [
      {type: 'bulleted-list', children: [
          {type: 'list-item', children: [
              {type: 'paragraph', children: [
                  {text: "un"},
                ]},
              {type: 'numbered-list', children: [
                  {type: 'list-item', children: [
                      {text: "un un"}
                    ]},
                  {type: 'list-item', children: [
                      {text: "un deux"}
                    ]},
                ]},
            ]},
          {type: 'list-item', children: [
              {text: "deux"},
            ]},
        ]}
    ];

    const md = serializeMarkdown(editor, slateNodes);

    expect(md).toEqual(`* un
    1. un un
    2. un deux
* deux`);
  });

  it("should serialize a table", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: "table", children: [
          {type: "table-row", children: [
              {type: 'table-cell', children: [
                  {text: "At vero", bold: true}
                ]},
              {type: 'table-cell', children: [
                  {text: "eos et accusamus", bold: true}
                ]},
            ]},
          {type: "table-row", children: [
              {type: 'table-cell', children: [
                  {text: "et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum"}
                ]},
              {type: 'table-cell', children: [
                  {text: "deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident"}
                ]},
            ]},
        ]},
    ];

    const mdText = serializeMarkdown(editor, original);

    expect(mdText).toEqual(`| **At vero** | **eos et accusamus** 
| --- | --- 
| et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum | deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident `);
  });

  it("should handle typeless blocks", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: "paragraph", children: [
          {text: "Duis facilisis luctus dui eu tristique."}
        ]},
      {children: [
          {type: 'image', url: 'https://epsilon.org/pic.png', children: [
              {text: "Sed eu dui in nunc elementum bibendum."},
            ]}
        ]},
      {type: "paragraph", children: [
          {text: "Praesent in cursus purus, nec blandit ipsum."}
        ]},
    ];

    const mdText = serializeMarkdown(editor, original);

    expect(mdText).toEqual(`Duis facilisis luctus dui eu tristique.
![Sed eu dui in nunc elementum bibendum.](https://epsilon.org/pic.png)

Praesent in cursus purus, nec blandit ipsum.`);
  });
});

describe("serializeMarkdown & deserializeMarkdown", () => {
  it("should round-trip emphasis", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: 'paragraph', children: [
          {text: "Legano", italic: true},
          {text: "plain"},
          {text: "forte", bold: true},
        ]}
    ];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  // it("should round-trip adjacent emphasis", () => {
  //   const editor = withHtml(withReact(createEditor()));
  //   const original = [
  //     {type: 'paragraph', children: [
  //         {text: "al forno ", italic: true},
  //         {text: "forte", italic: true, bold: true},
  //       ]}
  //   ];
  //
  //   const mdText = serializeMarkdown(editor, original);
  //   const reloaded = deserializeMarkdown(mdText);
  //
  //   expect(reloaded).toEqual(original);
  // });

  it("should round-trip backticks in inline code", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: 'paragraph', children: [
          {text: "JavaScript uses the backtick to delimit template literals: "},
          // eslint-disable-next-line no-template-curly-in-string
          {text: "let template = `page ${n}`;", code: true},
          {text: " which are useful"},
        ]}
    ];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip superscripts and subscripts", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: "paragraph", children: [
          {text: "The 4"},
          {text: "th", superscript: true},
          {text: " isotope is "},
          {text: "48", superscript: true},
          {text: "22", subscript: true},
          {text: "Ti"},
        ]}
    ];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip underline and strikethrough", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: "paragraph", children: [
          {text: "My "},
          {text: "speling", underline: true},
          {text: " is "},
          {text: "good", strikethrough: true},
          {text: " bad"},
        ]}
    ];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip deleted and inserted text styles", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: "paragraph", children: [
          {text: "We "},
          {text: "never", deleted: true},
          {text: "sometimes", inserted: true},
          {text: " make mistakes"},
        ]}
    ];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip paragraphs", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: 'paragraph', children: [
          {text: "Use "},
          {text: "__FILE__", "code": true},
          {text: " and "},
          {text: "__LINE__", "code": true},
          {text: "."}
        ]},
      {type: 'paragraph', children: [
          {text: "Able was I ere I saw Elba."},
        ]},
    ];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip a heading followed by a paragraph", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: 'heading-one', children: [
          {text: "Some Dull Report"},
        ]},
      {type: 'paragraph', children: [
          {text: "The proposal was "},
          {text: "completely", italic: true},
          {text: " ineffective."},
        ]},
      {type: 'heading-two', children: [
          {text: "Rubric"}
        ]},
    ];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip block quotes w/ multiple paragraphs", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: 'quote', children: [
          {type: 'paragraph', children: [
              {text: "Donec pharetra nisi eget turpis fermentum, vel molestie nibh sagittis. Sed dignissim venenatis metus, sed euismod leo ultrices nec."}
            ]},
          {type: 'paragraph', children: [
              {text: "Quisque malesuada ipsum a dolor semper, ac eleifend turpis interdum. Cras id pretium tellus, at pellentesque enim."}
            ]},
        ]},
    ]

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip links w/ marked-up content", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: 'paragraph', children: [
          {text: "The "},
          {type: "link",
            url: "https://developer.mozilla.org/en-US/docs/Web/HTML",
            title: "HTML",
            children: [
              {text: "Hypertext "},
              {text: "Markup", bold: true},
              {text: " Language"},
            ]},
          {text: " specification"},
        ]}
    ];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip images", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: 'heading-one', children: [
          {text: "Pets"},
        ]},
      {type: 'image',
        url: "https://example.com/pic",
        title: "Rover boy",
        children: [
          {text: "My dog"}
        ]},
      {type: 'paragraph', children: [
          {text: "is a spaniel"},
        ]},
    ];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip a thematic break", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: 'paragraph', children: [
          {text: "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur?"},
        ]},
      {type: 'thematic-break', children: [{text: ""}]},
      {type: 'paragraph', children: [
          {text: "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?"},
        ]},
    ];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip a bulleted list", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: "bulleted-list", children: [
          {type: 'list-item', children: [{text: "un gato"}]},
          {type: 'list-item', children: [{text: "dos perros"}]},
          {type: 'list-item', children: [{text: "tres ratones ciegos"}]},
        ]},
    ];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip a numbered list", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: "numbered-list", "listStart": 1, children: [
          {type: 'list-item', children: [{text: "erste"}]},
          {type: 'list-item', children: [{text: "zwitte"}]},
          {type: 'list-item', children: [{text: "dritte"}]},
        ]},
    ];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip a bulleted list of paragraphs", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {
        type: "bulleted-list", children: [
          {
            type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "un gato"}]},
              {
                type: 'paragraph',
                children: [{text: "Phasellus rhoncus commodo ex, sit amet facilisis arcu elementum id."}]
              },
            ]
          },
          {
            type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "dos perros"}]},
              {type: 'paragraph', children: [{text: "Suspendisse efficitur massa eu felis dignissim malesuada."}]},
            ]
          },
          {
            type: 'list-item', children: [
              {type: 'paragraph', children: [{text: "tres ratones ciegos"}]},
              {
                type: 'paragraph',
                children: [{text: "Pellentesque justo arcu, varius maximus turpis blandit, accumsan blandit ligula."}]
              },
            ]
          },
        ]
      },
    ];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip multiple paragraphs per list item", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [{type: "bulleted-list", children: [
        {type: 'list-item', children: [
            {text: "unus cattus"},
          ]},
        {type: 'list-item', children: [
            {text: "duo canes"}, {text: "in domo sua", italic: true},
          ]},
        {type: 'list-item', children: [
            {type: "paragraph", children: [{text: "tres caecos mures"}]},
            {type: "paragraph", children: [{text: "vide quomodo currunt"}]}
          ]},
      ]}];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip a table", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: 'table', children: [
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "Name", bold: true},
                ]},
              {type: 'table-cell', children: [
                  {text: "Favorite Color", bold: true},
                ]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "Alice", bold: true},
                ]},
              {type: 'table-cell', children: [
                  {text: "fuscous", italic: true},
                  {text: " blue"},
                ]},
            ]},
          {type: 'table-row', children: [
              {type: 'table-cell', children: [
                  {text: "Bob", bold: true},
                ]},
              {type: 'table-cell', children: [
                  {text: "smalt "},
                  {type: 'link', url: 'data:foo', title: "swatch", children: [
                      {text: "cobalt"},
                    ]}
                ]},
            ]},
        ]},
    ];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip a code block followed by a paragraph", () => {
    const editor = withHtml(withReact(createEditor()));
    const original = [
      {type: "code", children: [
          {text: "let a = b - c;\nfoo(a);"},
        ]},
      {type: "paragraph", children: [
          {text: "using the usual algorithm"}
        ]},
    ];

    const mdText = serializeMarkdown(editor, original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });
});
