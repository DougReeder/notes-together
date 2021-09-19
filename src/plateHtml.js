// plateHtml.js - constants & functions to configure Plate (plugins for Slate)
// Copyright © 2021 Doug Reeder under the MIT License

import {
  createBlockquotePlugin,
  createBoldPlugin,
  createCodeBlockPlugin,
  createCodePlugin, createExitBreakPlugin,
  createHeadingPlugin,
  createHistoryPlugin, createImagePlugin,
  createItalicPlugin, createLinkPlugin, createListPlugin,
  createParagraphPlugin,
  createReactPlugin, createSelectOnBackspacePlugin, createSoftBreakPlugin,
  ELEMENT_BLOCKQUOTE,
  ELEMENT_CODE_BLOCK,
  ELEMENT_IMAGE, ELEMENT_TD, KEYS_HEADING
} from "@udecode/plate";

const optionsSoftBreakPlugin = {
  rules: [
    { hotkey: 'shift+enter' },
    {
      hotkey: 'enter',
      query: {
        allow: [ELEMENT_CODE_BLOCK, ELEMENT_BLOCKQUOTE, ELEMENT_TD],
      },
    },
  ],
};
const optionsExitBreakPlugin = {
  rules: [
    {
      hotkey: 'mod+enter',
    },
    {
      hotkey: 'mod+shift+enter',
      before: true,
    },
    {
      hotkey: 'enter',
      query: {
        start: true,
        end: true,
        allow: KEYS_HEADING,
      },
    },
  ],
};

const pluginsBasic = [
  // editor
  createReactPlugin(),          // withReact
  createHistoryPlugin(),        // withHistory
  createSoftBreakPlugin(optionsSoftBreakPlugin),
  createExitBreakPlugin(optionsExitBreakPlugin),

  // marks
  createBoldPlugin(),           // bold mark
  createItalicPlugin(),         // italic mark
  createCodePlugin(),           // code mark

  // elements
  createParagraphPlugin(),      // paragraph element
  createBlockquotePlugin(),     // blockquote element
  createCodeBlockPlugin(),      // code block element
  createHeadingPlugin(),        // heading elements
  createLinkPlugin(),
  createListPlugin(),
  createImagePlugin(),
  createSelectOnBackspacePlugin({ allow: [ELEMENT_IMAGE] }),
];


export {pluginsBasic};
