// slateUtil.js - utility functions for Slate editor
// © 2021 Doug Reeder under the MIT License

import {Editor, Element as SlateElement, Node as SlateNode, Transforms} from 'slate';
import {deserializeMarkdown, serializeMarkdown} from "./slateMark";


function getRelevantBlockType(editor) {
  const selection = editor.selection;
  if (selection == null) {
    return 'n/a';
  }

  const topLevelBlockNodesInSelection = Editor.nodes(editor, {
    at: editor.selection,
    mode: "highest",
    match: (n) => Editor.isBlock(editor, n),
  });

  let blockType = 'n/a';
  let nodeEntry = topLevelBlockNodesInSelection.next();
  while (!nodeEntry.done) {
    const [node] = nodeEntry.value;
    if ('n/a' === blockType) {
      blockType = node.type || 'n/a';
      // console.log(`relevant block type ${node.type}`)
    } else if (blockType !== node.type) {
      // console.log(`multiple block types ${node.type}`)
      if (node.type === 'image') {
        return 'image';   // here meaning 'multiple including image'
      } else {
        return "multiple";
      }
    }

    nodeEntry = topLevelBlockNodesInSelection.next();
  }

  return blockType;
}


function isBlockActive(editor, format) {
  const [match] = Editor.nodes(editor, {
    match: n =>
        !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === format,
  });
  return Boolean(match);
}


const LIST_TYPES = ['numbered-list', 'bulleted-list'];

function changeBlockType(editor, type) {
  Editor.withoutNormalizing(editor, () => {
    const isActive = isBlockActive(editor, type);
    const isList = LIST_TYPES.includes(type);

    Transforms.unwrapNodes(editor, {
      match: n =>
          LIST_TYPES.includes(
              !Editor.isEditor(n) && SlateElement.isElement(n) && n.type
          ),
      split: true,
    });
    const newProperties = {
      type: isActive ? 'paragraph' : isList ? 'list-item' : type,
    }
    Transforms.setNodes(editor, newProperties);

    if (!isActive && isList) {
      const block = {type: type, children: []}
      Transforms.wrapNodes(editor, block);
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
  console.log(`${oldSubtype} => ${newSubtype}`)
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
