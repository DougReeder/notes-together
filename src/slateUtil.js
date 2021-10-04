// slateUtil.js - utility functions for Slate editor
// © 2021 Doug Reeder under the MIT License

import {Editor, Element as SlateElement, Transforms} from 'slate';


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
      return "multiple";
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
    const block = { type: type, children: [] }
    Transforms.wrapNodes(editor, block);
  }
}

export {getRelevantBlockType, isBlockActive, changeBlockType};
