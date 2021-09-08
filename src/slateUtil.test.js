// Copyright © 2021 Doug Reeder under the MIT License

import {getRelevantBlockType} from "./slateUtil";
import {createEditor} from 'slate'
import {withHtml} from "./slateHtml";
import {withReact} from "slate-react";

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
