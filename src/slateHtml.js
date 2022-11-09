// slateHtml.js - constants & functions to customize Slate for HTML/JSX
// Copyright © 2021-2022 Doug Reeder under the MIT License

import React from "react";
import { jsx } from 'slate-hyperscript';
import escapeHtml from 'escape-html'
import sanitizeHtml from "sanitize-html";
import {semanticOnly} from "./sanitizeNote";
import {isLikelyMarkdown} from "./util";
import {deserializeMarkdown, serializeMarkdown} from "./slateMark";
import {
  Text,
  Node as SlateNode,
  Element as SlateElement,
  Path,
  Transforms,
  Editor,
  Range as SlateRange,
  Point,
  Text as SlateText
} from "slate";
import {useSelected, useFocused} from 'slate-react';
import {imageFileToDataUrl} from "./util/imageFileToDataUrl";
import {addSubstitution} from "./urlSubstitutions";
import {determineParseType} from "./FileImport";
import {getCommonBlock, coerceToPlainText} from "./slateUtil";

function isEmpty(node) {
  if (Text.isText(node)) {
    return 0 === SlateNode.string(node).length;
  } else {
    switch (node.type) {
      case 'image':
      case 'thematic-break':
        return false;
      case 'link':
        return 0 === SlateNode.string(node).length;
      default:
        return ! node?.children?.some(child => ! isEmpty(child));
    }
  }
}

function isBlank(node) {
  if (Text.isText(node)) {
    return /^\s*$/.test(SlateNode.string(node));   // contains non-space character
  } else {
    switch (node.type) {
      case 'image':
      case 'thematic-break':
        return false;
      case 'link':
        return /^\s*$/.test(SlateNode.string(node));
      default:
        return ! node?.children?.some(child => ! isBlank(child));
    }
  }
}

function withHtml(editor) {   // defines Slate plugin
  const {isInline, isVoid, normalizeNode, deleteBackward, deleteForward, insertBreak, insertData} = editor;

  editor.isInline = element => {
    switch (element?.type) {
      case 'link':
        return true;
      default:
        return isInline(element);
    }
  }

  editor.isVoid = element => {
    switch (element?.type) {
      // images are funny in Slate, and not void
      case 'thematic-break':
        return true;
      default:
        return isVoid(element)
    }
  }

  editor.normalizeNode = entry => {
    const [node, path] = entry;
    // console.log("normalizeNode:", path, path.length > 0 ? node : 'editor')

    if (Text.isText(node) && node.deleted && node.inserted) {
      Transforms.unsetNodes(editor, 'deleted', {at: path, mode: "highest"});
      return;
    }

    // moves blocks (e.g images) out of inlines (e.g. links)
    if (SlateElement.isElement(node) && editor.isInline(node)) {
      if (node.children.some(child => SlateElement.isElement(child) && !editor.isInline(child))) {
        const nodeRef = Editor.pathRef(editor, path);

        let wrapBlock;
        // eslint-disable-next-line default-case
        switch (SlateNode.get(editor, Path.parent(path))?.type) {
          case 'list-item':
          case 'table-cell':
          case 'quote':
          case undefined:   // parent is editor
            wrapBlock = {type: 'paragraph', children: []};
            break;
          case 'bulleted-list':   // an inline shouldn't be a child of this, but...
          case 'numbered-list':   // an inline shouldn't be a child of this, but...
            wrapBlock = {type: 'list-item', children: []};
            break;
          case 'table-row':   // an inline shouldn't be a child of this, but...
            wrapBlock = {type: 'table-cell', children: []};
            break;
        }
        if (wrapBlock) {
          Transforms.wrapNodes(editor, wrapBlock, {
            at: path.slice(0, -1),
            match: (n, p) => p.length === path.length && (Text.isText(n) || SlateElement.isElement(n) && editor.isInline(n))
          });
        }

        for (let i=node.children.length-1; i>=0; --i) {
          const child = node.children[i];
          const childPath = [...nodeRef.current, i];
          if (SlateElement.isElement(child) && !editor.isInline(child)) {
            let newPath;
            if (nodeRef.current.length > 1) {
              newPath = [...nodeRef.current.slice(0, -2), nodeRef.current[nodeRef.current.length - 2] + 1];
            } else {
              newPath = [nodeRef.current[0] + 1];
            }
            Transforms.moveNodes(editor, {at: childPath, to: newPath});
            if ('link' === node.type && 1 === node.children.length) {
              // the moved node was the only child
              const linkText = /([^/]+)\/?$/.exec(node.url)?.[1]?.slice(0, 52) || 'link';
              Transforms.insertNodes(editor, {text: linkText}, {at: [...nodeRef.current, 0]});
            }
            nodeRef.unref();
            return;
          }
        }
      }
    }

    if (editor.isInline(node) && isBlank(node)) {
      Transforms.removeNodes(editor, {at: path});
      return;
    }

    // deletes or wraps list items outside a list
    if ('list-item' === node.type) {
      let parent = undefined;
      if (path.length > 1) {
        parent = SlateNode.get(editor, Path.parent(path));
      }
      if (! ['bulleted-list', 'numbered-list'].includes(parent?.type)) {
        if (isBlank(node)) {
          Transforms.removeNodes(editor, {at: path});
          return;
        } else {
          const list = {type: 'bulleted-list', children: []};
          Transforms.wrapNodes(editor, list, {at: path});
          return;
        }
      }
    }

    // ensure all children of lists are list-items
    if (['bulleted-list', 'numbered-list'].includes(node.type)) {
      if (0 === node.children.length) {
        Transforms.removeNodes(editor, {at: path});
        return;
      }

      let changed = false;
      for (let i=node.children.length-1; i>=0; --i) {
        const child = node.children[i];
        const childPath = [...path, i];
        if ('list-item' !== child.type) {
          if (isBlank(child)) {
            Transforms.removeNodes(editor, {at: childPath});
            changed = true;
          } else {
            if (['paragraph','heading-one','heading-two','heading-three'].includes(child.type)) {
              Transforms.setNodes(editor, {type: 'list-item'}, {at: childPath});
              changed = true;
            } else {
              const item = {type: 'list-item', children: []};
              Transforms.wrapNodes(editor, item, {at: childPath});
              changed = true;
            }
          }
        }
      }
      if (changed) {
        return;
      }
    }

    // deletes or wraps table cells outside a table-row
    if ('table-cell' === node.type) {
      let parent = undefined;
      if (path.length > 1) {
        parent = SlateNode.get(editor, Path.parent(path));
      }
      if ('table-row' !== parent?.type) {
        if (isBlank(node)) {
          Transforms.removeNodes(editor, {at: path});
          return;
        } else {
          const row = {type: 'table-row', children: []};
          Transforms.wrapNodes(editor, row, {at: path});
          return;
        }
      }
    }

    // deletes or wraps table rows outside a table
    if ('table-row' === node.type) {
      let parent = undefined;
      if (path.length > 1) {
        parent = SlateNode.get(editor, Path.parent(path));
      }
      if ('table' === parent?.type) {
        if (0 === node.children.length) {
          Transforms.removeNodes(editor, {at: path});
          return;
        }
      } else {
        if (isBlank(node)) {
          Transforms.removeNodes(editor, {at: path});
          return;
        } else {
          Transforms.wrapNodes(editor, {type: 'table', children: []}, {at: path});
          return;
        }
      }
    }

    // ensures tables are normalized
    if ('table' === node.type) {
      if (0 === node.children.length) {
        Transforms.removeNodes(editor, {at: path});
        return;
      }

      let maxWidth = 1;
      for (let r=0; r < node.children.length; ++r) {
        const child = node.children[r];
        if ('table-row' !== child.type) {
          if (isBlank(child)) {
            Transforms.removeNodes(editor, {at: [...path, r]});
          } else {
            Transforms.wrapNodes(editor, {type: 'table-row', children: []},
                {at: [...path, r]});
          }
          return;
        }
        for (let c=0; c < child.children.length; ++c) {
          const grandchild = child.children[c];
          if ('table-cell' !== grandchild.type) {
            Transforms.wrapNodes(editor,
                {type: 'table-cell', children: []},
                {at: [...path, r, c]});
            return;
          }
        }
        if (child.children.length > maxWidth) {
          maxWidth = child.children.length;
        }
      }

      let isChanged = false;
      for (let r=0; r < node.children.length; ++r) {
        const row = node.children[r];
        let isHeader;
        if (0 === r) {
          const textDescendantEntries = SlateNode.descendants(row.children[row.children.length - 1], {pass: ([n, p]) => SlateText.isText(n)});
          isHeader = Boolean(textDescendantEntries.next()?.value?.[0]?.bold);
        } else {
          isHeader = false;
        }
        isChanged = isChanged || row.children.length < maxWidth;
        for (let c = row.children.length; c < maxWidth; ++c) {
          Transforms.insertNodes(editor,
              {type: 'table-cell', children: [isHeader ? {text: "", bold: true} : {text: ""}]},
              {at: [...path, r, c]});
        }
      }
      if (isChanged) { return; }
    }

    // If an Element has one block child, all others must also be blocks
    if (Editor.isEditor(node) || SlateElement.isElement(node) && Editor.hasBlocks(editor, node)) {
      let isChanged = false;
      for (const [child, childPath] of SlateNode.children(editor, path)) {
        if (! Editor.isBlock(editor, child)) {
          Transforms.wrapNodes(editor, {type: 'paragraph'}, {at: childPath});
          isChanged = true;
        }
      }
      if (isChanged) {
        return;
      }
    }

    // Typeless top-level elements are converted to paragraphs.
    if (1 === path.length && SlateElement.isElement(node) && !node.type) {
      Transforms.setNodes(editor, {type: 'paragraph'}, {at: path});
      return;
    }

    // Ensures editor has at least one child
    if (Editor.isEditor(node) && 0 === node.children.length) {
      Transforms.insertNodes(editor,
          {type: 'paragraph', children: [{text: ""}]});
      return;
    }

    normalizeNode(entry);
  }

  editor.deleteBackward = unit => {
    const { selection } = editor

    if (selection && SlateRange.isCollapsed(selection)) {
      const [cell] = Editor.nodes(editor, {
        match: n =>
            !Editor.isEditor(n) &&
            SlateElement.isElement(n) &&
            'table-cell' === n.type,
      });

      if (cell) {
        const [, cellPath] = cell
        const start = Editor.start(editor, cellPath);

        if (Point.equals(selection.anchor, start)) {
          return;   // doesn't delete cell
        }
      }
    }

    deleteBackward(unit);
  }

  editor.deleteForward = unit => {
    const { selection } = editor

    if (selection && SlateRange.isCollapsed(selection)) {
      const [cell] = Editor.nodes(editor, {
        match: n =>
            !Editor.isEditor(n) &&
            SlateElement.isElement(n) &&
            'table-cell' === n.type,   // doesn't delete cell
      });

      if (cell) {
        const [, cellPath] = cell
        const end = Editor.end(editor, cellPath);

        if (Point.equals(selection.anchor, end)) {
          return;
        }
      }
    }

    deleteForward(unit);
  }

  editor.insertBreak = () => {
    const { selection } = editor
    if (!selection) { return; }

    const {block, blockPath} = getCommonBlock(editor);
    switch (block.type) {
      case 'image':
        Editor.withoutNormalizing(editor, () => {
          const insertPath = [...blockPath.slice(0, -1), blockPath[blockPath.length - 1] + 1];
          Transforms.insertNodes(editor, {type: 'paragraph', children: [{text: ""}]}, {at: insertPath});
          const selectionPath = [...insertPath, 0];
          Transforms.select(editor, {
            anchor: {path: selectionPath, offset: 0},
            focus: {path: selectionPath, offset: 0}
          });
        });
        return;
      case 'table':
      case 'table-row':
        return;
      case 'table-cell':
        Transforms.wrapNodes(editor, {type: 'paragraph', children: []}, {
          at: blockPath,
          match: n => SlateText.isText(n) || editor.isInline(n),
          mode: 'highest',
          split: true,
        });
        insertBreak();
        return;
      case 'list-item':
        if (isEmpty(block) && blockPath.length >= 2) {
          Editor.withoutNormalizing(editor, () => {
            const parentPathLength = blockPath.length - 1;
            Transforms.unwrapNodes(editor,
                {
                  at: blockPath,
                  match: (n, p) => p.length === parentPathLength,
                  split: true
                });
            const newPath = [...blockPath.slice(0,-2), blockPath[blockPath.length-2] + 1];
            Transforms.setNodes(editor, {type: 'paragraph'}, {at: newPath});
            Transforms.select(editor, newPath);
          });
        } else {
          insertBreak();
        }
        break;
      case 'heading-one':
      case 'heading-two':
      case 'heading-three':
      case 'paragraph':
      case 'quote':
      case 'code':
      case 'thematic-break':
        const parent = SlateNode.parent(editor, blockPath);
        if ('list-item' === parent.type &&
            blockPath[blockPath.length - 1] === parent.children.length - 1
            && isEmpty(block)) {
          Editor.withoutNormalizing(editor, () => {
            Transforms.removeNodes(editor, {at: blockPath});
            const insertPath = [...blockPath.slice(0, -2), blockPath[blockPath.length - 2] + 1];
            Transforms.insertNodes(editor, {type: 'list-item', children: [{text: ""}]}, {at: insertPath});
            const selectionPath = [...insertPath, 0];
            Transforms.select(editor, {
              anchor: {path: selectionPath, offset: 0},
              focus: {path: selectionPath, offset: 0}
            });
          });
        } else if (SlateRange.isCollapsed(editor.selection) &&
            Point.equals(Editor.end(editor, blockPath) , SlateRange.end(editor.selection)) &&
            'code' !== block.type) {
          Editor.withoutNormalizing(editor, () => {
            const newPath = [...blockPath.slice(0, -1), blockPath[blockPath.length-1]+1];
            Transforms.insertNodes(editor, {type: 'paragraph', children: [{text: ""}]}, {at: newPath});
            Transforms.select(editor, {anchor: {path: [...newPath, 0], offset: 0}, focus: {path: [...newPath, 0], offset: 0}});
          });
        } else {
          insertBreak();
        }
        return;
      default:
        insertBreak();
        return;
    }
  }

  // paste or drag & drop
  editor.insertData = async dataTransfer => {
    // console.log("types:", JSON.stringify(dataTransfer.types), "   files:", JSON.stringify(dataTransfer.files));
    try {
      if (editor.subtype?.startsWith('html')) {
        await processDataTransfer(dataTransfer, pasteHtmlToRichText, pasteUriListToRichText, pasteMarkdownToRichText, pasteText, pasteGraphicFileToRichText);
      } else if (editor.subtype?.startsWith('markdown')) {
        await processDataTransfer(dataTransfer, pasteHtmlToMarkdown, pasteUriListToMarkdown, pasteText, pasteText, pasteGraphicFileToMarkdown);
      } else {   // plain text mode
        await processDataTransfer(dataTransfer, pasteHtmlToPlainText, pasteText, pasteText, pasteText, pasteGraphicFileToPlainText);
      }
    } catch (err) {
      console.error("while pasting:", err);
      const userMsg = err?.userMsg || "Can you open that in another app and copy?";
      window.postMessage({kind: 'TRANSIENT_MSG', message: userMsg}, window?.location?.origin);
    }
  }

  async function processDataTransfer(dataTransfer, pasteHtml, pasteUriList, pasteMarkdown, pastePlainText, pasteGraphicFile) {
    if (dataTransfer.types.indexOf('text/html') > -1 && pasteHtml !== pasteHtmlToPlainText) {
      let html = dataTransfer.getData('text/html');
      pasteHtml(html);
    } else if (dataTransfer.types.indexOf('text/uri-list') > -1) {
      const uriList = dataTransfer.getData('text/uri-list');
      pasteUriList(uriList);
    } else if (dataTransfer.types.indexOf('text/plain') > -1) {
      const text = dataTransfer.getData('text/plain');
      if (isLikelyMarkdown(text)) {
        pasteMarkdown(text);
      } else {   // plain text
        pastePlainText(text)
      }
    } else if (dataTransfer.files.length > 0) {
      for (const file of dataTransfer.files) {
        const fileInfo = await determineParseType(file);
        if (fileInfo.isMarkdown) {   // presumes Markdown heuristics are correct
          fileInfo.parseType = 'text/markdown';
        }
        if (fileInfo.parseType.startsWith('image/')) {
          await pasteGraphicFile(file);
        } else if (!fileInfo.message) {   // no message means usable
          await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async evt => {
              try {
                const text = evt.target.result;
                switch (fileInfo.parseType) {
                  case 'text/html':
                    pasteHtml(text);
                    break;
                  case 'text/uri-list':
                    pasteUriList(text);
                    break;
                  case 'text/markdown':
                    pasteMarkdown(text);
                    break;
                  default:   // some kind of text not excluded by determineParseType()
                    pastePlainText(text)
                    break;
                }
                resolve();
              } catch (err) {
                console.error("while pasting file:", err);
                window.postMessage({kind: 'TRANSIENT_MSG', message: `Can you open “${file.name}” in another app and copy?`}, window?.location?.origin);
                reject(err);
              }
            };
            reader.onerror = () => {
              console.error("reader.onerror:", reader.error);
              window.postMessage({kind: 'TRANSIENT_MSG', message: `Can you open “${file.name}” in another app and copy?`}, window?.location?.origin);
              reject(reader.error);
            };
            reader.readAsText(file);
          });
        } else {
          console.warn("not pasteable:", file.name, file.type, fileInfo.message);
          window.postMessage({kind: 'TRANSIENT_MSG', severity: 'warning', message: `Can you open “${file.name}” in another app and copy?`}, window?.location?.origin);
        }
      }
    } else {   // use default handling, which probably does nothing
      console.warn("default handling", ...dataTransfer.items);
      window.postMessage({kind: 'TRANSIENT_MSG', severity: 'warning', message: "Can you open that in another app and copy?"}, window?.location?.origin);
      insertData(dataTransfer)
    }
  }


  function pasteHtmlToRichText(html) {
    html = sanitizeHtml(html, semanticOnly);
    // console.log("sanitized HTML", html.slice(0, 1024));
    const slateNodes = deserializeHtml(html, editor);
    // console.log("HTML -> slateNodes:", slateNodes);
    Editor.insertFragment(editor, slateNodes);
  }

  function pasteUriListToRichText(uriList) {
    const slateNodes = [];
    let comment = "", url;
    for (const line of uriList.split(/\r\n|\n/)) {
      if ('#' === line[0]) {
        comment = /#\s*(.*)/.exec(line)[1] || "";
      } else if ((url = line?.trim())) {
        slateNodes.push({
          type: 'link',
          url: url,
          title: "",
          children: [{text: comment || url}]
        });
        comment = "";
      } else {
        comment = "";
      }
    }
    console.info('URI list -> link element(s):', slateNodes);
    Editor.insertFragment(editor, slateNodes);
  }

  function pasteMarkdownToRichText(text) {
    const slateNodes = deserializeMarkdown(text);
    // console.log("MD -> slateNodes:", slateNodes);
    Editor.insertFragment(editor, slateNodes);
  }

  function pasteText(text) {
    // console.log("pasting text:", text);
    Editor.insertText(editor, text);
  }

  async function pasteGraphicFileToRichText(file) {
    const {dataUrl, alt} = await imageFileToDataUrl(file);
    if (!dataUrl) {
      console.error("Can't convert to data URL:", file);
      return;
    }
    console.info(`${file.name} ${file.type} -> image element:`);
    const slateNodes = [
      {type: 'paragraph', children: [{text: ""}]},
      {
        type: 'image',
        url: dataUrl,
        title: "",
        children: [{text: alt}]
      },
      {type: 'paragraph', children: [{text: ""}]},
    ];
    Editor.insertFragment(editor, slateNodes);
  }


  function pasteHtmlToMarkdown(html) {
    html = sanitizeHtml(html, semanticOnly);
    const syntaxTree = deserializeHtml(html, editor);
    const markdown = serializeMarkdown(syntaxTree);
    const lines = markdown.split('\n');
    console.info("HTML -> Markdown:", markdown);

    let slateNodes;
    if (1 === lines.length) {
      slateNodes = [{text: lines[0]}]
    } else {
      slateNodes = lines.map(line => {
        return {type: 'paragraph', children: [{text: line}]};
      });
    }
    Editor.insertFragment(editor, slateNodes);
  }

  function pasteUriListToMarkdown(uriList) {
    let markdown = "";
    let comment = "", url;
    for (const line of uriList.split(/\r\n|\n/)) {
      if ('#' === line[0]) {
        comment = /#\s*(.*)/.exec(line)[1] || "";
      } else if ((url = line?.trim())) {
        markdown += `[${comment || url}](${url})`;
        comment = "";
      } else {
        comment = "";
      }
    }
    console.info("URI list -> Markdown:", markdown);
    Editor.insertText(editor, markdown);
  }

  async function pasteGraphicFileToMarkdown(file) {
    const {dataUrl, alt} = await imageFileToDataUrl(file);
    if (!dataUrl) {
      console.error("Can't convert to data URL:", file);
      return;
    }
    console.info(`${file.name} ${file.type} -> Markdown img:`);
    const markdown = `![${alt}](${dataUrl} "")`;
    Editor.insertText(editor, markdown);
  }


  function pasteHtmlToPlainText(html) {
    // console.log("HTML -> slateNodes -> coerceToPlainText");
    html = sanitizeHtml(html, semanticOnly);
    const slateNodes = deserializeHtml(html, editor);
    Editor.withoutNormalizing(editor, () => {
      Editor.insertFragment(editor, slateNodes);
      coerceToPlainText(editor);
    });
  }

  async function pasteGraphicFileToPlainText(file) {
    const {alt} = await imageFileToDataUrl(file);
    console.info(`${file.name} ${file.type} -> alt text:`, alt);

    Editor.insertText(editor, alt);
  }

  return editor;
}


const ELEMENT_TAGS = {
  A: el => ({ type: 'link', url: decodeURI(el.getAttribute('href')), title: el.getAttribute('title') || undefined }),
  BLOCKQUOTE: () => ({ type: 'quote' }),
  H1: () => ({ type: 'heading-one' }),
  H2: () => ({ type: 'heading-two' }),
  H3: () => ({ type: 'heading-three' }),
  HR: () => ({ type: 'thematic-break'}),
  IMG: el => {
    if (el.hasAttribute('src')) {
      const src = decodeURI(el.getAttribute('src'));
      if (src.startsWith('blob:')) {
        addSubstitution(src);
      }
      return { type: 'image',
        url: src,
        title: el.getAttribute('title') || "" ,
        children: [{text: el.getAttribute('alt') || ""}]
      };
    } else {
      return {};
    }
  },
  LI: () => ({ type: 'list-item' }),
  OL: () => ({ type: 'numbered-list' }),
  UL: () => ({ type: 'bulleted-list' }),
  P: () => ({ type: 'paragraph' }),
  PRE: () => ({ type: 'code' }),
  TABLE: () => ({ type: 'table' }),   // presumes it contains a tbody
  TR: () => ({ type: 'table-row' }),
  TD: () => ({ type: 'table-cell'}),
  TH: () => ({ type: 'table-cell'}),   // also sets bold

  // DIV: () => ({ }),
  FIGCAPTION: () => ({ type: 'paragraph' }),   // also sets italic
  DETAILS: () => ({ type: 'paragraph' }),
  DT: () => ({ type: 'paragraph' }),   // also sets bold
  DD: () => ({ type: 'quote' }),   // visual appearance does what we want
}

const TEXT_TAGS = {
  CODE: () => ({ code: true }),
  KBD: () => ({ code: true }),
  SAMP: () => ({ code: true }),
  TT: () => ({ code: true }),
  DEL: () => ({ deleted: true }),
  INS: () => ({ inserted: true }),
  EM: () => ({ italic: true }),
  I: () => ({ italic: true }),
  Q: () => ({ italic: true }),
  DFN: () => ({ italic: true }),
  CITE: () => ({ italic: true }),
  VAR: () => ({ italic: true }),
  ABBR: () => ({ italic: true }),
  ADDRESS: () => ({ italic: true }),
  SUP: () => ({ superscript: true}),
  SUB: () => ({ subscript: true}),
  S: () => ({ strikethrough: true }),
  STRIKE: () => ({ strikethrough: true }),
  B: () => ({ bold: true }),
  STRONG: () => ({ bold: true }),
  U: () => ({ underline: true }),
  DT: () => ({ bold: true }),   // also paragraph element
  FIGCAPTION: () => ({ italic: true }),   // also paragraph element
  TH: () => ({ bold: true }),   // also table-cell element
}

function deserializeHtml(html, editor) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');

  let activeMarkStack = [{}];
  let activeCodeBlockStack = [false];
  const slateNodes = domNodeToSlateNodes(parsed.body);
  if (activeMarkStack.length !== 1){
    console.error("activeMarkStack corrupt:", activeMarkStack);
  }
  if (activeCodeBlockStack.length !== 1) {
    console.error("activeCodeBlockStack corrupt", activeCodeBlockStack);
  }

  return slateNodes;

  function domNodeToSlateNodes(el) {
    let nodeName;
    try {
      const marks = activeMarkStack[activeMarkStack.length-1];
      if (el.nodeType === 3 || el.nodeType === 4) {   // TEXT_NODE or CDATA_SECTION_NODE
        let text = el.textContent;
        if (! activeCodeBlockStack[activeCodeBlockStack.length-1]) {
          text = text?.replace(/\s+/g, " ");
        }
        if (Object.keys(marks).length > 0) {
          return {text, ...marks}
        } else {
          return text;
        }
      } else if (el.nodeType !== 1) {   // not ELEMENT_NODE
        return null
      } else if (el.nodeName === 'BR') {
        return '\n'
      }

      nodeName = el.nodeName;

      if (TEXT_TAGS[nodeName]) {
        const tagMarks = TEXT_TAGS[nodeName](el);
        activeMarkStack.push({...activeMarkStack[activeMarkStack.length-1], ...tagMarks});
      }

      if ('PRE' === nodeName) {
        activeCodeBlockStack.push(true);
      }

      let parent = el;
      if (
          nodeName === 'PRE' &&
          el.childNodes[0] &&
          el.childNodes[0].nodeName === 'CODE'
      ) {
        parent = el.childNodes[0]
      }

      let children = Array.from(parent.childNodes)
          .map(domNodeToSlateNodes)
          .flat();

      const shouldChildrenBeBlocks = children.some(
          child => SlateElement.isElement(child) && !editor.isInline(child)
      );
      if (shouldChildrenBeBlocks) {
        // drops blank leaves between blocks
        children = children.filter(child => {
          if ('string' === typeof child) {
            return /\S/.test(child);
          } else if (! SlateElement.isElement(child) && Text.isText(child)) {
            return /\S/.test(child.text);
          } else {
            return true;
          }
        });
        // creates blocks to contain Leaves
        children = children.map(child => {
          if (SlateElement.isElement(child)) {
            if (editor.isInline(child)) {
              return {children: [child]};
            } else {
              return child;
            }
          } else if (Text.isText(child)) {
            return {children: [child]};
          } else if ('string' === typeof child) {
            return {children: [{text: child}]};
          } else {
            console.error("child not SlateElement, Text, nor string:", child);
            return {children: [{text: '\ufffd'}]};
          }
        });
      }

      if (nodeName === 'BODY') {
        return jsx('fragment', {}, children);
      }

      // Slate requires elements to have a child.
      if (children.length === 0) {
        if (Object.keys(marks).length > 0) {
          children = [{text: '', ...marks}];
        } else {
          children = [{text: ''}];
        }
      }

      if (ELEMENT_TAGS[nodeName]) {
        const attrs = ELEMENT_TAGS[nodeName](el)
        if (Array.isArray(attrs.children)) {
          for (const child of attrs.children) {
            Object.assign(child, marks);
          }
          return jsx('element', attrs, attrs.children);
        } else {
          return jsx('element', attrs, children);
        }
      }

      return children;
    } catch (err) {
      console.error("while deserializing HTML:", err);
      return [{text: el?.innerText || ""}];
    } finally {
      if ('PRE' === nodeName) {
        activeCodeBlockStack.pop();
      }

      if (TEXT_TAGS[nodeName]) {
        activeMarkStack.pop();
      }
    }
  }
}


const RenderingElement = props => {
  const { attributes, children, element } = props

  switch (element.type) {
    case 'paragraph':
      return <p {...attributes}>{children}</p>
    case 'quote':
      return <blockquote {...attributes}>{children}</blockquote>
    case 'code':
      return (
          <pre>
          <code {...attributes}>{children}</code>
        </pre>
      )
    case 'bulleted-list':
      return <ul {...attributes}>{children}</ul>
    case 'heading-one':
      return <h1 {...attributes}>{children}</h1>
    case 'heading-two':
      return <h2 {...attributes}>{children}</h2>
    case 'heading-three':
      return <h3 {...attributes}>{children}</h3>
    case 'list-item':
      return <li {...attributes}>{children}</li>
    case 'numbered-list':
      if (element.listStart) {
        return <ol start={element.listStart} {...attributes}>{children}</ol>
      } else {
        return <ol {...attributes}>{children}</ol>
      }
    case 'link':
      return (
          <a href={element.url} title={element.title} target="_blank" rel="noreferrer" referrerPolicy="no-referrer" {...attributes}>
            {children}
          </a>
      )
    case 'image':
      return <ImageElement {...props} />
    case 'thematic-break':
      return <div {...attributes} contentEditable={false}>
        {children}
        <hr />
      </div>
    case 'table':
      return (
          <table>
            <tbody {...attributes}>{children}</tbody>
          </table>
      )
    case 'table-row':
      return <tr {...attributes}>{children}</tr>
    case 'table-cell':
      return <td {...attributes}>{children}</td>
    default:
      return children;
  }
}

const ImageElement = ({ attributes, children, element }) => {
  const selected = useSelected();
  const focused = useFocused();
  return (
      <div {...attributes}>
        {children}
        <img
            src={element.url}
            title={element.title}
            alt=""
            style={{display: 'block', maxWidth: '100%', maxHeight: '75vh', boxShadow: selected && focused ? '0 0 0 2px blue' : 'none'}}
        />
      </div>
  )
}

const Leaf = ({ attributes, children, leaf }) => {
  let markup = <span {...attributes}
                     {...(leaf.highlight && {'className': 'highlight'})}
  >
    {children}
  </span>

  if (leaf.bold) {
    markup = <strong>{markup}</strong>
  }

  if (leaf.code) {
    markup = <code>{markup}</code>
  }

  if (leaf.italic) {
    markup = <em>{markup}</em>
  }

  if (leaf.superscript) {
    markup = <sup>{markup}</sup>
  }

  if (leaf.subscript) {
    markup = <sub>{markup}</sub>
  }

  if (leaf.underline) {
    markup = <u>{markup}</u>
  }

  if (leaf.strikethrough) {
    markup = <s>{markup}</s>
  }

  if (leaf.deleted) {
    markup = <del>{markup}</del>
  }

  if (leaf.inserted) {
    markup = <ins>{markup}</ins>
  }

  return markup;
}


function serializeHtml(slateNodes, substitutions = new Map()) {
  let inCodeBlock = false;
  return serializeSlateNode({children: slateNodes});

  function serializeSlateNode(slateNode) {
    try {
      if (Text.isText(slateNode)) {
        let html = escapeHtml(slateNode.text);
        if (slateNode.code) {
          html = `<code>${html}</code>`;
        }
        if (slateNode.bold) {
          html = `<strong>${html}</strong>`;
        }
        if (slateNode.italic) {
          html = `<em>${html}</em>`;
        }
        if (slateNode.superscript) {
          html = `<sup>${html}</sup>`;
        }
        if (slateNode.subscript) {
          html = `<sub>${html}</sub>`;
        }
        if (slateNode.underline) {
          html = `<u>${html}</u>`;
        }
        if (slateNode.strikethrough) {
          html = `<s>${html}</s>`;
        }
        if (slateNode.deleted) {
          html = `<del>${html}</del>`;
        }
        if (slateNode.inserted) {
          html = `<ins>${html}</ins>`;
        }
        if (inCodeBlock) {
          return html;
        } else {
           // newline -> hard break
          html = html.replace(/\n/g, "<br />");
          return html;
        }
      }

      switch (slateNode.type) {   // eslint-disable-line default-case
        case 'code':
          inCodeBlock = true;
      }

      const children = slateNode.children.map(n => serializeSlateNode(n)).join('');

      switch (slateNode.type) {
        case 'paragraph':
          return `<p>${children}</p>`;
        case 'heading-one':
          return `<h1>${children}</h1>`;
        case 'heading-two':
          return `<h2>${children}</h2>`;
        case 'heading-three':
          return `<h3>${children}</h3>`;
        case 'quote':
          return `<blockquote>${children}</blockquote>`;
        case 'code':
          inCodeBlock = false;
          return `<pre><code>${children}</code></pre>`;
        case 'bulleted-list':
          return `<ul>${children}</ul>`;
        case 'numbered-list':
          return `<ol>${children}</ol>`;
        case 'list-item':
          return `<li>${children}</li>`;
        case 'thematic-break':
          return `<hr />`;
        case 'link':
          return `<a href="${encodeURI(slateNode.url)}" title="${slateNode.title}">${children}</a>`
        case 'image':
          if (slateNode.url.startsWith('blob:')) {
            const dataUrl = substitutions.get(slateNode.url);
            if (dataUrl) {
              return `<img src="${encodeURI(dataUrl)}" alt="${SlateNode.string(slateNode) || ''}" title="${slateNode.title || ''}">`;
            } else {
              console.error("No substitution for", slateNode?.url);
              return '';   // Doesn't save img tag.
            }
          } else {
            return `<img src="${encodeURI(slateNode.url)}" alt="${SlateNode.string(slateNode) || ''}" title="${slateNode.title || ''}">`;
          }
        case 'table':
          return `<table><tbody>${children}</tbody></table>`;
        case 'table-row':
          return `<tr>${children}</tr>`;
        case 'table-cell':
          return `<td>${children}</td>`;
        default:
          return children
      }
    } catch (err) {
      console.error("serializeSlateNode:", err);
      return SlateNode.string(slateNode) || "";
    }
  }
}

export {withHtml, deserializeHtml, RenderingElement, ImageElement, Leaf, serializeHtml};
