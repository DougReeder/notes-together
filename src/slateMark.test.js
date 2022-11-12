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
  it("should convert MD unordered list to Slate bulleted list", () => {
    const mdText = `   * erste 
   *  zwitte   
  *   dritte`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([{type: "bulleted-list", children: [
        {type: 'list-item', children: [
            {type: 'paragraph', children: [{text: "erste"}]}
          ]},
        {type: 'list-item', children: [
            {type: 'paragraph', children: [{text: "zwitte"}]},
          ]},
        {type: 'list-item', children: [
            {type: 'paragraph', children: [{text: "dritte"}]},
          ]},
      ]}]);
  });

  it("should extract text of HTML that's not specially handled", () => {
    const mdText = "something <samp>special</samp> for you";

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes).toEqual([{type: "paragraph", children: [{text: "something "}, {text: "special"}, {text: " for you"}]}]);
  });

  it("should deserialize image in paragraph as separate block", () => {
    const mdText = `before
![description](https://delta.edu/a.png "some title")
after`;

    const slateNodes = deserializeMarkdown(mdText);

    expect(slateNodes[0]).toEqual(
      {type: 'image', url: 'https://delta.edu/a.png', title: "some title", children: [
          {text: "description"},
        ]});
    expect(slateNodes[1].children[0]).toEqual({text: "before"});
    expect(slateNodes[1].children[slateNodes[1].children.length-1]).toEqual({text: "after"});
    expect(slateNodes).toHaveLength(2);
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

    expect(mdText).toEqual(`| **At vero** | **eos et accusamus** |
| et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum | deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident |`);
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

  it("should round-trip links", () => {
    const editor = withHtml(withReact(createEditor()));
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
        title: "Rover",
        children: [
          {text: "My dog", italic: true}
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

  // it("should round-trip a bulleted list", () => {
  //   const editor = withHtml(withReact(createEditor()));
  //   const original = [
  //     {type: "bulleted-list", children: [
  //         {type: 'list-item', children: [{text: "un gato"}]},
  //         {type: 'list-item', children: [{text: "dos perros"}]},
  //         {type: 'list-item', children: [{text: "tres ratones ciegos"}]},
  //       ]},
  //   ];
  //
  //   const mdText = serializeMarkdown(editor, original);
  //   const reloaded = deserializeMarkdown(mdText);
  //
  //   expect(reloaded).toEqual(original);
  // });

  // it("should round-trip a numbered list", () => {
  //   const editor = withHtml(withReact(createEditor()));
  //   const original = [
  //     {type: "numbered-list", "listStart": 1, children: [
  //         {type: 'list-item', children: [{text: "erste"}]},
  //         {type: 'list-item', children: [{text: "zwitte"}]},
  //         {type: 'list-item', children: [{text: "dritte"}]},
  //       ]},
  //   ];
  //
  //   const mdText = serializeMarkdown(editor, original);
  //   const reloaded = deserializeMarkdown(mdText);
  //
  //   expect(reloaded).toEqual(original);
  // });

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
            {type: "paragraph", children: [{text: "unus cattus"}]}
          ]},
        {type: 'list-item', children: [
            {type: "paragraph", children: [{text: "duo canes"}, {text: "in domo sua", italic: true}]}
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
