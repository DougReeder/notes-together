// Copyright © 2021 Doug Reeder under the MIT License

import {deserializeMarkdown, serializeMarkdown, escapeMarkdown} from "./slateMark";

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
  it("should convert MD unordered list to Slate bulleted list", () => {
    const mdText = `   * erste 
   *  zwitte   
  *   dritte`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([{type: "bulleted-list", children: [
        {type: 'list-item', children: [{text: "erste"}]},
        {type: 'list-item', children: [{text: "zwitte"}]},
        {type: 'list-item', children: [{text: "dritte"}]},
      ]}]);
  });

  it("should extract text of HTML that's not specially handled", () => {
    const mdText = "something <samp>special</samp> for you";

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([{type: "paragraph", children: [{text: "something "}, {text: "special"}, {text: " for you"}]}]);
  });
})


describe("serializeMarkdown", () => {
  it("should not escape inside code blocks", () => {
    const slateNodes = [
        {type: 'code', children: [{text: "let a = b**c, x = y**z;"}]}
    ];

    const md = serializeMarkdown(slateNodes);

    expect(md).toEqual(`\`\`\`
let a = b**c, x = y**z;
\`\`\``);
  });

  // it("should escape asterisks outside code blocks", () => {
  //   const slateNodes = [
  //     {type: 'paragraph', children: [{text: "this *is not* italic"}]}
  //   ];
  //
  //   const md = serializeMarkdown(slateNodes);
  //
  //   expect(md).toEqual(`this *is not\\* italic`);
  // });

  // it("should escape underscores outside code blocks", () => {
  //   const slateNodes = [
  //     {type: 'paragraph', children: [{text: "Use __FILE__ and __LINE__."}]}
  //   ];
  //
  //   const md = serializeMarkdown(slateNodes);
  //
  //   expect(md).toEqual(`Use _\\_FILE\\_\\_ and \\_\\_LINE\\_\\_.`);
  // });

  it("should not escape underscores in inline code", () => {
    const slateNodes = [
      {type: 'paragraph', children: [
          {text: "Use "},
          {text: "__FILE__", "code": true},
          {text: " and "},
          {text: "__LINE__", "code": true},
          {text: "."}
        ]}
    ];

    const md = serializeMarkdown(slateNodes);

    expect(md).toEqual(`Use \`__FILE__\` and \`__LINE__\`.`);
  });

  it("should serialize unordered lists", () => {
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

    const md = serializeMarkdown(slateNodes);

    expect(md).toEqual(`* erste
* zwitte`);
  });

  it("should save children of graphic as alt text", () => {
    const slateNodes = [
      { type: 'image', url: 'http://example.com/pic', title: 'still life', children: [
          {text: "tromp "},
          {text: "l'oeil", bold: true},
        ]}
    ];

    const md = serializeMarkdown(slateNodes);

    expect(md).toEqual(`![tromp **l'oeil**](http://example.com/pic "still life")`);
  });

  it("should omit title of graphic when empty", () => {
    const slateNodes = [
      { type: 'image', url: 'https://example.com/other', children: [
          {text: "Not a pipe"},
        ]}
    ];

    const md = serializeMarkdown(slateNodes);

    expect(md).toEqual(`![Not a pipe](https://example.com/other)`);
  });
});

describe("serializeMarkdown & deserializeMarkdown", () => {
  it("should round-trip emphasis", () => {
    const original = [
      {type: 'paragraph', children: [
          {text: "Legano", italic: true},
          {text: "plain"},
          {text: "forte", bold: true},
        ]}
    ];

    const mdText = serializeMarkdown(original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  // it("should round-trip adjacent emphasis", () => {
  //   const original = [
  //     {type: 'paragraph', children: [
  //         {text: "al forno ", italic: true},
  //         {text: "forte", italic: true, bold: true},
  //       ]}
  //   ];
  //
  //   const mdText = serializeMarkdown(original);
  //   const reloaded = deserializeMarkdown(mdText);
  //
  //   expect(reloaded).toEqual(original);
  // });

  it("should round-trip paragraphs", () => {
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

    const mdText = serializeMarkdown(original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip a heading followed by a paragraph", () => {
    const original = [
      {type: 'heading-one', children: [
          {text: "Some Dull Report"},
        ]},
      {type: 'paragraph', children: [
          {text: "The proposal was "},
          {text: "completely", italic: true},
          {text: " ineffective."},
        ]},
    ];

    const mdText = serializeMarkdown(original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip links", () => {
    const original = [
      {type: 'paragraph', children: [
          {text: "The "},
          {type: "link",
            url: "https://developer.mozilla.org/en-US/docs/Web/HTML",
            title: "Hypertext Markup Language",
            children: [
              {text: "HTML", bold: true}
            ]},
          {text: " specification"},
        ]}
    ];

    const mdText = serializeMarkdown(original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip images", () => {
    const original = [
      {type: 'paragraph', children: [
          {text: "My "},
          {type: "image",
            url: "https://example.com/pic",
            title: "Rover",
            children: [
              {text: "dog", italic: true}
            ]},
          {text: " is a spaniel"},
        ]}
    ];

    const mdText = serializeMarkdown(original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip a bulleted list", () => {
    const original = [
      {type: "bulleted-list", children: [
          {type: 'list-item', children: [{text: "un gato"}]},
          {type: 'list-item', children: [{text: "dos perros"}]},
          {type: 'list-item', children: [{text: "tres ratones ciegos"}]},
        ]},
    ];

    const mdText = serializeMarkdown(original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip a numbered list", () => {
    const original = [
      {type: "numbered-list", "listStart": 1, children: [
          {type: 'list-item', children: [{text: "erste"}]},
          {type: 'list-item', children: [{text: "zwitte"}]},
          {type: 'list-item', children: [{text: "dritte"}]},
        ]},
    ];

    const mdText = serializeMarkdown(original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });

  // it("should round-trip multiple paragraphs per list item", () => {
  //   const original = [{type: "bulleted-list", children: [
  //       {type: 'list-item', children: [
  //           {type: "paragraph", children: [{text: "unus cattus"}]}
  //         ]},
  //       {type: 'list-item', children: [
  //           {type: "paragraph", children: [{text: "duo canes"}, {text: "in domo sua", italic: true}]}
  //         ]},
  //       {type: 'list-item', children: [
  //           {type: "paragraph", children: [{text: "tres caecos mures"}]},
  //           {type: "paragraph", children: [{text: "vide quomodo currunt"}]}
  //         ]},
  //     ]}];
  //
  //   const mdText = serializeMarkdown(original);
  //   const reloaded = deserializeMarkdown(mdText);
  //
  //   expect(reloaded).toEqual(original);
  // });

  it("should round-trip a code block followed by a paragraph", () => {
    const original = [
      {type: "code", children: [
          {text: "let a = b - c;\nfoo(a);"},
        ]},
      {type: "paragraph", children: [
          {text: "using the usual algorithm"}
        ]},
    ];

    const mdText = serializeMarkdown(original);
    const reloaded = deserializeMarkdown(mdText);

    expect(reloaded).toEqual(original);
  });
});
