// slateHtmlPlugin.js — Slate plugin to customize Slate for HTML/JSX for Notes Together
// Copyright © 2021–2024 Doug Reeder under the MIT License

import {INLINE_ELEMENTS} from "./constants.js";
import {
  Editor,
  Element as SlateElement,
  Node as SlateNode,
  Path, Point,
  Range as SlateRange,
  Text as SlateText,
  Text,
  Transforms
} from "slate";
import {deserializeHtml} from "./slateHtmlUtil.js";
import {coerceToPlainText, getCommonBlock} from "./slateUtil.js";
import {extractUserMessage, transientMsg} from "./util/extractUserMessage.js";
import {isLikelyMarkdown} from "./util.js";
import {determineParseType} from "./fileImportUtil.js";
import {deserializeMarkdown, serializeMarkdown} from "./slateMark.js";
import {imageFileToDataUrl} from "./util/imageFileToDataUrl.js";


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

function withHtml(editor) {   // defines Slate plugin for Notes Together
  const {isVoid, normalizeNode, deleteBackward, deleteForward, insertBreak, insertData} = editor;

  editor.isInline = element => {
    return INLINE_ELEMENTS.includes(element?.type);
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
      if (Editor.hasBlocks(editor, node)) {
        const nodeRef = Editor.pathRef(editor, path);

        let wrapBlock;
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
          case 'task-list':   // an inline shouldn't be a child of this, but...
          case 'sequence-list':   // an inline shouldn't be a child of this, but...
            wrapBlock = {type: 'list-item', checked: false, children: []};
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

    if (SlateElement.isElement(node) && editor.isInline(node) && isBlank(node)) {
      Transforms.removeNodes(editor, {at: path});
      return;
    }

    if (ChildDeleteOrWrap('list-item', ['bulleted-list', 'numbered-list', 'task-list', 'sequence-list'], true)) {
      return;
    }

    if (ParentDeleteSetOrWrap(['bulleted-list', 'numbered-list', 'task-list', 'sequence-list'], 'list-item')) {
      return;
    }

    if (ChildDeleteOrWrap('table-cell', ['table-row'], false)) { return; }

    if (ChildDeleteOrWrap('table-row', ['table'], true)) { return; }

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
          const textDescendantEntries = SlateNode.descendants(row.children[row.children.length - 1], {pass: ([n, _p]) => SlateText.isText(n)});
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
        if (SlateText.isText(child) || editor.isInline(child)) {
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

    /**
     * deletes or wraps child not in proper parent
     *
     * @param {string} childType
     * @param {[string]} parentTypes starting with unchecked types, ending with checked
     * @param {boolean} deleteIfEmpty
     * @returns {boolean}
     */
    function ChildDeleteOrWrap(childType, parentTypes, deleteIfEmpty) {
      if (node.type === childType) {
        let parent = undefined;
        if (path.length > 1) {
          parent = SlateNode.get(editor, Path.parent(path));
        }
        if (parentTypes.includes(parent?.type)) {
          if (deleteIfEmpty && 0 === node.children.length) {
            Transforms.removeNodes(editor, {at: path});
            console.warn(`removed empty child:`, node);
            return true;
          }
        } else {   // child is orphaned
          if (isBlank(node)) {
            Transforms.removeNodes(editor, {at: path});
            console.warn(`removed blank orphan:`, node);
            return true;
          } else {
            const parentType = 'checked' in node ? parentTypes[parentTypes.length-1] : parentTypes[0];
            const parent = {type: parentType, children: []};
            Transforms.wrapNodes(editor, parent, {at: path});
            console.warn("wrapped orphan with", parent, ":", node);
            return true;
          }
        }
      }
      return false;
    }

    /** ensure all children of parent are child type */
    function ParentDeleteSetOrWrap(parentTypes, childType) {
      if (parentTypes.includes(node.type)) {
        if (0 === node.children.length) {
          Transforms.removeNodes(editor, {at: path});
          return true;
        }

        const isChecklist = ['task-list', 'sequence-list'].includes(node.type);
        let isChanged = false;
        for (let i=node.children.length-1; i>=0; --i) {
          const child = node.children[i];
          const childPath = [...path, i];
          if (childType !== child.type) {
            if (isBlank(child)) {
              Transforms.removeNodes(editor, {at: childPath});
              console.warn(`removed blank misplaced:`, child);
              isChanged = true;
            } else {
              if (['paragraph', 'quote','heading-one','heading-two','heading-three'].includes(child.type)) {
                if (isChecklist) {
                  Transforms.setNodes(editor, {type: childType, checked: false}, {at: childPath});
                } else {
                  Transforms.setNodes(editor, {type: childType}, {at: childPath});
                }
                console.warn(`changed type to ${childType}:`, child);
                isChanged = true;
              } else {
                const item = isChecklist ?
                  {type: childType, checked: false, children: []} :
                  {type: childType, children: []};
                Transforms.wrapNodes(editor, item, {at: childPath});
                console.warn(`wrapped in ${childType}:`, child);
                isChanged = true;
              }
            }
          } else if (isChecklist && !('checked' in child)) {
            Transforms.setNodes(editor, {checked: false}, {at: childPath});
            console.warn(`added 'checked' property to:`, child);
          }
        }
        return isChanged;
      }
      return false;
    }
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
    try {
      const {selection} = editor;
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
              Transforms.unsetNodes(editor, 'checked', {at: newPath});
              Transforms.select(editor, newPath);
            });
          } else {
            if ('checked' in block) {
              const newBlock = {type: 'list-item', checked: false, children: [{text: ""}]};
              const newPath = [...blockPath.slice(0, -1), blockPath.at(-1) + 1];
              Transforms.insertNodes(editor, newBlock, {at: newPath});
              Transforms.select(editor, newPath);
            } else {
              insertBreak();
            }
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
          if (['list-item', 'quote'].includes(parent.type) &&
            blockPath[blockPath.length - 1] === parent.children.length - 1
            && isEmpty(block)) {   // last block child of list-item is empty
            Editor.withoutNormalizing(editor, () => {
              Transforms.removeNodes(editor, {at: blockPath});
              const insertPath = [...blockPath.slice(0, -2), blockPath[blockPath.length - 2] + 1];
              const newNodeType = 'quote' === parent.type ? 'paragraph' : parent.type;
              Transforms.insertNodes(editor, {type: newNodeType, children: [{text: ""}]}, {at: insertPath});
              const selectionPath = [...insertPath, 0];
              Transforms.select(editor, {
                anchor: {path: selectionPath, offset: 0},
                focus: {path: selectionPath, offset: 0}
              });
            });
          } else if (SlateRange.isCollapsed(editor.selection) &&
            Point.equals(Editor.end(editor, blockPath) , SlateRange.end(editor.selection)) &&
            'code' !== block.type) {   // at end of editor
            Editor.withoutNormalizing(editor, () => {
              const newPath = [...blockPath.slice(0, -1), blockPath[blockPath.length-1]+1];
              Transforms.insertNodes(editor, {type: 'paragraph', children: [{text: ""}]}, {at: newPath});
              Transforms.select(editor, {
                anchor: {path: [...newPath, 0], offset: 0},
                focus: {path: [...newPath, 0], offset: 0}
              });
            });
          } else {
            insertBreak();
          }
          return;
        default:
          insertBreak();
          return;
      }
    } catch (err) {
      console.error("insertBreak:", err);
      transientMsg(extractUserMessage(err));
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
      transientMsg(err?.userMsg || "Can you open that in another app and copy?");
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
                transientMsg(`Can you open “${file.name}” in another app and copy?`);
                reject(err);
              }
            };
            reader.onerror = () => {
              console.error("reader.onerror:", reader.error);
              transientMsg(`Can you open “${file.name}” in another app and copy?`);
              reject(reader.error);
            };
            reader.readAsText(file);
          });
        } else {
          console.warn("not pasteable:", file.name, file.type, fileInfo.message);
          transientMsg(`Can you open “${file.name}” in another app and copy?`, 'warning');
        }
      }
    } else {   // use default handling, which probably does nothing
      console.warn("default handling", ...dataTransfer.items);
      transientMsg("Can you open that in another app and copy?", 'warning');
      insertData(dataTransfer)
    }
  }


  function pasteHtmlToRichText(html) {
    const slateNodes = deserializeHtml(html);
    // console.log("HTML -> slateNodes:", slateNodes);
    Editor.insertFragment(editor, slateNodes);
  }

  function pasteUriListToRichText(uriList) {
    const slateNodes = [];
    let comment = "", url;
    for (const line of uriList.split(/\r\n|\n|\r/)) {
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
    const syntaxTree = deserializeHtml(html);
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
    for (const line of uriList.split(/\r\n|\n|\r/)) {
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
    const slateNodes = deserializeHtml(html);
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

export {withHtml};
