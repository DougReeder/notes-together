// Copyright © 2021 Doug Reeder under the MIT License

import {withHtml, deserializeHtml, serializeHtml} from "./slateHtml";
import sanitizeHtml from "sanitize-html";
import {semanticOnly} from "./sanitizeNote";
import {Element, Text} from "slate";

const editor = withHtml({
  isInline: () => false,
  isVoid: () => false
})

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
    const html = serializeHtml([{type: 'image', url: 'https://mozilla.org/?x=шеллы', alt: "Grapefruit slice atop a pile of other slices", title: "Grapefruit slice", children: []}]);
    expect(html).toEqual('<img src="https://mozilla.org/?x=%D1%88%D0%B5%D0%BB%D0%BB%D1%8B" alt="Grapefruit slice atop a pile of other slices" title="Grapefruit slice">');

    const cleanHtml = sanitizeHtml(html, semanticOnly);
    expect(cleanHtml).toEqual('<img src="https://mozilla.org/?x=%D1%88%D0%B5%D0%BB%D0%BB%D1%8B" alt="Grapefruit slice atop a pile of other slices" title="Grapefruit slice" />');
  });
});


describe("deserializeHtml", () => {
  it("should retain blank Leaves between inline Elements", () => {
    const html = `leading text <a href="http://example.com"> anchor text </a> trailing text`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes.length).toEqual(3);
    expect(slateNodes[0]?.text).toEqual("leading text ");
    expect(slateNodes[1]?.type).toEqual('link');
    expect(slateNodes[2]?.text).toEqual(" trailing text");
  });

  it("should drop blank Leaves between block Elements, so all the children of an Element are the same", () => {
    const html = `<p>first paragraph</p>
<p>second paragraph</p>`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes.length).toEqual(2);
    expect(slateNodes[0].type).toEqual("paragraph");
    expect(slateNodes[1].type).toEqual("paragraph");
  });

  it("should coerce bare text to Elements, so all the children of an Element are the same", () => {
    const html = `<h2>Book Title</h2>
bare text`;

    const slateNodes = deserializeHtml(html, editor);

    expect(slateNodes.length).toEqual(2);
    expect(slateNodes[0].type).toEqual("heading-two");
    expect(slateNodes[1]).toBeInstanceOf(Object);
    expect(slateNodes[1].children?.length).toEqual(1);
    expect(slateNodes[1].children[0]).toEqual({text: "\nbare text"});
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

  it("should wrap links, so all the children of an Element are the same", () => {
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
    expect(slateNodes[1].text).toEqual("\nipso facto");
  });
});


describe("serializeHtml and deserializeHtml", () => {
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
      {text: "const a = b + c;", code: true},
      {text: " as needed"},
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });

  it("should round-trip hard line breaks", () => {
    const original = [
      {text: "first line \n  indented second line"},
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
      {type: 'heading-four', children: [
          {text: "Subsidiary considerations"},
        ]},
      {type: 'heading-five', children: [
          {text: "Subsidiary considerations"},
        ]},
      {type: 'heading-six', children: [
          {text: "Subsidiary considerations"},
        ]},
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

  it("should round-trip code blocks", () => {
    const original = [
      {
        type: 'code', children: [
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

  it("should round-trip horizontal rules", () => {
    const original = [
      {type: 'paragraph', children: [{text: "first section"},]},
      {type: 'thematic-break', children: []},
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
      {type: 'image', url: 'http://example.org', alt: "a mini-lop", title: "tooltip?", children: [{text: ""}]},
      {type: 'paragraph', children: [
          {type: 'image', url: 'https://mozilla.org/?x=шеллы', alt: "graph", title: "Bell curve", children: [{text: ""}]}
        ]},
    ];

    let html = serializeHtml(original);
    html = sanitizeHtml(html, semanticOnly);
    const reloaded = deserializeHtml(html, editor);

    expect(reloaded).toEqual(original);
  });
});