// slateUtil.js - utility functions for Slate editor
// © 2021 Doug Reeder under the MIT License

import {Editor, Element as SlateElement, Node as SlateNode, Transforms, Range as SlateRange} from 'slate';
import {deserializeMarkdown, serializeMarkdown} from "./slateMark";


function getRelevantBlockType(editor) {
  const selection = editor.selection;
  if (selection == null) {
    return 'n/a';
  }

  let [common, path] = SlateNode.common(editor, selection.anchor.path, selection.focus.path);
  while (!Editor.isEditor(common) && !Editor.isBlock(editor, common)) {
    path = path.slice(0, -1);
    common = SlateNode.get(editor, path);
  }

  if (Editor.isEditor(common)) {
    return 'multiple';
  } else {
    switch (common.type) {
      case 'list-item':
        if (path.length >= 2) {
          const parent = SlateNode.parent(editor, path);
          return parent.type;
        } else {
          return 'multiple';   // no list parent
        }
      case 'table-cell':
        if (path.length >= 3) {
          const grandparent = SlateNode.get(editor, path.slice(0, -2))
          return grandparent.type;
        } else {
          return 'multiple';   // no table parent
        }
      case 'table-row':
        if (path.length >= 2) {
          const parent = SlateNode.parent(editor, path);
          return parent.type;
        } else {
          return 'multiple';   // no table parent
        }
      default:
        return common.type;
    }
  }
}


function isBlockActive(editor, format) {
  const [match] = Editor.nodes(editor, {
    match: n =>
        !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === format,
  });
  return Boolean(match);
}


const LIST_TYPES = ['numbered-list', 'bulleted-list'];
const TABLE_TYPES = ['table', 'table-row'];
const COMPOUND_TYPES = [...LIST_TYPES, ...TABLE_TYPES];

function changeBlockType(editor, type) {
  Editor.withoutNormalizing(editor, () => {
    const isActive = isBlockActive(editor, type);
    const isList = LIST_TYPES.includes(type);
    const isTable = TABLE_TYPES.includes(type);

    Transforms.unwrapNodes(editor, {
      match: n =>
          COMPOUND_TYPES.includes(
              !Editor.isEditor(n) && SlateElement.isElement(n) && n.type
          ),
      split: true,
    });
    Transforms.unwrapNodes(editor, {
      match: n =>
          TABLE_TYPES.includes(
              !Editor.isEditor(n) && SlateElement.isElement(n) && n.type
          ),
      split: true,
    });
    const newProperties = {
      type: isActive ? 'paragraph' : isList ? 'list-item' : isTable ? 'table-cell' : type,
    }
    if (isTable) {
      newProperties.isHeader = false;
    }
    Transforms.setNodes(editor, newProperties, {split: SlateRange.isExpanded(editor.selection)});

    if (!isActive) {
      if (isList) {
        const block = {type: type, children: []}
        Transforms.wrapNodes(editor, block);
      } else if (isTable) {
        Transforms.wrapNodes(editor, {type: 'table', children: []});
        const [, tablePath] = Editor.above(editor, {at: editor.selection.focus.path, match: n => 'table' === n.type});
        for (const [, cellPath] of SlateNode.children(editor, tablePath)) {
          Transforms.wrapNodes(editor, {type: 'table-row', children: []}, {at: cellPath});
        }
      }
    }
  });
}

async function changeContentType(editor, oldSubtype, newSubtype) {
  if (!newSubtype || newSubtype.startsWith('plain')) {
    Editor.withoutNormalizing(editor, () => {
      if (oldSubtype?.startsWith('markdown')) {   // convert to rich text in editor
        const text = editor.children.map(node => SlateNode.string(node)).join('\n');
        const slateNodes = deserializeMarkdown(text);
        Transforms.select(editor, []);
        Editor.insertFragment(editor, slateNodes);
      }

      coerceToPlainText(editor);
    });
  } else if (newSubtype.startsWith('markdown')) {
    if (oldSubtype?.startsWith('html')) {
      const content = serializeMarkdown(editor.children);
      const slateNodes = content.split('\n').map(line => {
        return {type: 'paragraph', children: [{text: line}]};
      });
      Transforms.select(editor, []);
      Transforms.insertFragment(editor, slateNodes);
    }
  } else if (newSubtype.startsWith('html')) {
    if (oldSubtype?.startsWith('markdown')) {   // convert to rich text in editor
      const text = editor.children.map(node => SlateNode.string(node)).join('\n');
      const slateNodes = deserializeMarkdown(text);
      Transforms.select(editor, []);
      Editor.insertFragment(editor, slateNodes);
    }
  }
  editor.subtype = newSubtype;
  Transforms.setNodes(editor, {noteSubtype: newSubtype}, {at: [0]});
  console.info(`${oldSubtype} => ${newSubtype}`)
}

function coerceToPlainText(editor) {
  const imageElmnts = Editor.nodes(editor, {
    at: [],
    match: (node, path) => 'image' === node.type,
  });
  for (const nodeEntry of imageElmnts) {
    const altText = SlateNode.string(nodeEntry[0]) || nodeEntry[0].title || /\/([^/]+)$/.exec(nodeEntry[0].url)?.[1] || "☹︎";
    Transforms.select(editor, nodeEntry[1]);
    Editor.insertFragment(editor, [{text: altText}]);
  }

  Transforms.unwrapNodes(editor,
      {
        at: [],
        match: node => !Editor.isEditor(node) && node.children?.every(child => Editor.isBlock(editor, child)),
        mode: "all",
      }
  );

  Transforms.select(editor, []);
  editor.removeMark('italic');
  editor.removeMark('bold');
  editor.removeMark('code');
  editor.removeMark('underline');
  editor.removeMark('strikethrough');
  Transforms.deselect(editor);

  Transforms.unsetNodes(editor, ['type', 'url', 'title'], {
    at: [],
    match: (node, path) => SlateElement.isElement(node)
  });
}

export {getRelevantBlockType, isBlockActive, changeBlockType, changeContentType, coerceToPlainText};
