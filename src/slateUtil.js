// slateUtil.js - utility functions for Slate editor
// © 2021 Doug Reeder under the MIT License

import {
  Editor,
  Element as SlateElement,
  Node as SlateNode,
  Text as SlateText,
  Transforms,
  Range as SlateRange,
} from 'slate';
import {deserializeMarkdown, serializeMarkdown} from "./slateMark";
import {arraylikeEqual} from "./util/arrayUtil";


function getRelevantBlockType(editor) {
  try {
    const selection = editor.selection;
    if (selection == null) {
      return 'n/a';
    }

    const {block, blockPath} = getCommonBlock(editor);

    if (Editor.isEditor(block)) {
      return 'multiple';
    } else {
      switch (block.type) {
        case 'table-row':
          if (blockPath.length >= 2) {
            const parent = SlateNode.parent(editor, blockPath);
            return parent.type;
          } else {
            return 'multiple';   // no table parent
          }
        default:
          return block.type;
      }
    }
  } catch (err) {
    console.error("while getting relevant block:", err);
    Transforms.deselect(editor);
    return 'n/a';
  }
}

const LIST_TYPES = ['numbered-list', 'bulleted-list', 'list-item'];
const TABLE_TYPES = ['table', 'table-row', 'table-cell'];
const COMPOUND_TYPES = [...LIST_TYPES, ...TABLE_TYPES];
// wrapping with compound type is handled by other code
const IMAGE_WRAP_TYPES = ['quote', 'list-item', 'table-cell'];

function changeBlockType(editor, newType) {
  Editor.withoutNormalizing(editor, () => {
    Transforms.setSelection(editor, Editor.unhangRange(editor, editor.selection, {voids: true}))

    const newIsList = LIST_TYPES.includes(newType);
    const newIsTable = TABLE_TYPES.includes(newType);

    let {block, blockPath} = getCommonBlock(editor);
    let changePathLength = Editor.isEditor(block) ? 1 : blockPath.length;
    const allowSplit = SlateRange.isExpanded(editor.selection) && 'image' !== block.type;

    // if needed, adjusts block & changePathLength & inserts blocks to be changed
    if ('image' === block.type && IMAGE_WRAP_TYPES.includes(newType)) {
      // wrapping with compound type is handled by other code
      // It's not clear why this node isn't wrapped by later wrapNodes
      Transforms.wrapNodes(editor, {children: []}, {split: false});
    } else if (['list-item', 'table-row'].includes(block.type)) {
      if (changePathLength >= 2) {
        block = SlateNode.parent(editor, blockPath);
        // no need to change blockPath as only changePathLength is used after this
        --changePathLength;
      } else {
        throw new Error(`lost child: ${blockPath} ${SlateNode.string(block)}`);
      }
    } else if ('table-cell' === block.type) {
      if (changePathLength >= 3) {
        changePathLength = changePathLength - 2;
        block = SlateNode.get(editor, blockPath.slice(0, changePathLength));
        // no need to change blockPath as only changePathLength is used after this
      } else {
        throw new Error(`lost cell: ${blockPath} ${SlateNode.string(block)}`);
      }
    }

    let isTypeSame = block.type === newType;

    // unwraps old compound types
    Transforms.unwrapNodes(editor, {
      mode: 'highest',
      match: (n, p) => p.length === changePathLength && COMPOUND_TYPES.includes(n.type),
      split: allowSplit,
    });
    for (const [node, path] of Editor.nodes(editor, {
      mode: 'highest',
      match: (n, p) => p.length === changePathLength+1 &&
          TABLE_TYPES.includes(n.type),
      split: allowSplit,
    })) {
      if (Editor.hasBlocks(editor, node)) {
        Transforms.unwrapNodes(editor, {
          at: path,
          split: allowSplit
        });
      } else {
        Transforms.setNodes(editor, {type: 'paragraph'}, {
          at: path,
          split: allowSplit
        });
      }
    }

    if (isTypeSame && (COMPOUND_TYPES.includes(newType) || changePathLength > 1)) {
      // de-formats
      Transforms.unwrapNodes(editor, {
        match: (n, p) => p.length === changePathLength,
        split: allowSplit});
    } else {
      // here's where the actual block change is done
      const newProperties = {
        type: isTypeSame ? 'paragraph' : newIsList ? 'list-item' : newIsTable ? 'table-cell' : newType,
      }
      Transforms.setNodes(editor, newProperties, {
        match: (n, p) => p.length === changePathLength && 'image' !== n.type,
        split: allowSplit
      });

      // wraps new compound types
      if (newIsList) {
        Transforms.wrapNodes(editor, {type: newType, children: []}, {
          mode: 'highest',
          match: (n, p) => p.length === changePathLength,
        });
      } else if (newIsTable) {
        Transforms.wrapNodes(editor, {type: 'table', children: []});
        const [, tablePath] = Editor.above(editor, {at: editor.selection.focus.path, match: n => 'table' === n.type});
        for (const [, cellPath] of SlateNode.children(editor, tablePath)) {
          Transforms.wrapNodes(editor, {type: 'table-row', children: []}, {at: cellPath});
        }
      }
    }
  });
}

function insertListAfter(editor, newType) {
  insertAfter(editor,
      {type: newType, children: [{type: 'list-item', children: [{text: ""}]}]},
      [0, 0]);
}

function insertTableAfter(editor) {
  insertAfter(editor,{type: 'table', children: [
      {type: 'table-row', children: [
          {type: 'table-cell', children: [{text: "", bold: true}]},
          {type: 'table-cell', children: [{text: "", bold: true}]},
        ]},
      {type: 'table-row', children: [
          {type: 'table-cell', children: [{text: ""}]},
          {type: 'table-cell', children: [{text: ""}]},
        ]},
    ]},
      [0, 0, 0]);
}

function insertAfter(editor, newNodes, selectionPathFromInsert) {
  Editor.withoutNormalizing(editor, () => {
    let {block, blockPath} = getCommonBlock(editor);
    const allowSplit = SlateRange.isExpanded(editor.selection) && 'image' !== block.type;

    let insertPath;
    if (Editor.hasBlocks(editor, block)) {
      const endPnt = SlateRange.end(editor.selection);
      insertPath = [...blockPath, endPnt.path[blockPath.length] + 1];
    } else {
      Transforms.wrapNodes(editor, {type: 'paragraph', children: []}, {
        at: blockPath,
        match: n => SlateText.isText(n) || editor.isInline(n),
        mode: 'highest',
        split: allowSplit,
      });
      insertPath = [...blockPath, 1];
    }
    Transforms.insertNodes(editor,
        newNodes, {at: insertPath});
    const selectionPath = [...insertPath, ...selectionPathFromInsert];
    Transforms.select(editor, {anchor: {path: selectionPath, offset: 0}, focus: {path: selectionPath, offset: 0}});
  });
}

function getCommonBlock(editor) {
  const range = Editor.unhangRange(editor, editor.selection, {voids: true});

  let [common, path] = SlateNode.common(editor, range.anchor.path, range.focus.path);
  while (!Editor.isBlock(editor, common) && !Editor.isEditor(common)) {
    path = path.slice(0, -1);
    common = SlateNode.get(editor, path);
  }
  return {block: common, blockPath: path}
}

function tabRight(editor) {
  if (!editor.selection) return;
  const [, firstPath] = Editor.first(editor, editor.selection);
  const [, lastPath] = Editor.last(editor, editor.selection);
  // searches upward for a block to operate on
  for (const [candidate, candidatePath] of SlateNode.levels(editor, firstPath, {reverse: true})) {
    try {
      if ('table-cell' === candidate.type) {
        const endPnt = Editor.end(editor, candidatePath);
        const afterPnt = Editor.after(editor, endPnt);
        Transforms.select(editor, {anchor: afterPnt, focus: afterPnt});
        return;
      } else if ('list-item' === candidate.type) {
        // calculates a normalized source range from selection
        const startPath = firstPath.slice(0, candidatePath.length);
        const endPath = lastPath.slice(0, candidatePath.length);
        const sourceRange = {anchor: Editor.start(editor, startPath),
                             focus:  Editor.end(editor, endPath)};
        // If a list exists at the destination, moves source items to it.
        let [sibling, siblingPath] = Editor.previous(editor, {at: candidatePath});
        for (const [child, childPath] of SlateNode.children(editor, siblingPath, {reverse: true})) {
          if (['bulleted-list', 'numbered-list'].includes(child.type)) {
            const destination = [...childPath, child.children.length];
            Transforms.moveNodes(editor, {at: sourceRange, to: destination, match: (n,p) => p.length === candidatePath.length});
            return;
          }
        }

        // If no list exists at the destination, moves source items & wraps them in list.
        Editor.withoutNormalizing(editor, () => {
          if (SlateText.isText(sibling.children[0])) {
            const wrapRange = {anchor: Editor.start(editor, siblingPath),
                               focus: Editor.end(editor, siblingPath)};
            Transforms.wrapNodes(editor, {type: 'paragraph', children: []}, {at: wrapRange, match: (n,p) => siblingPath.length + 1 === p.length});
            sibling = SlateNode.get(editor, siblingPath);
          }
          const destination = [...siblingPath, sibling.children.length];
          const [parent] = Editor.parent(editor, candidatePath);
          Transforms.moveNodes(editor, {at: sourceRange, to: destination, match: (n,p) => p.length === candidatePath.length});
          const wrapRange = {anchor: Editor.start(editor, destination),
                             focus: Editor.end(editor, siblingPath)};
          Transforms.wrapNodes(editor, {type: parent.type, children: []}, {at: wrapRange, match: (n,p) => p.length === destination.length});
        });
        return;
      }
    } catch (err) {
      // The action on this candidate failed; continues searching.
    }
  }
  // searches upward for a block to operate on
  for (const [candidate, candidatePath] of SlateNode.levels(editor, firstPath, {reverse: true})) {
    try {
      if (['paragraph', 'quote', 'code'].includes(candidate.type)) {
        const [startPnt] = Editor.edges(editor, editor.selection);
        let selectionOffset = 0;
        for (const [child, childPath] of SlateNode.texts(candidate)) {
          if (arraylikeEqual([...candidatePath, ...childPath], startPnt.path)) {
            selectionOffset += startPnt.offset;
            break;
          } else {
            selectionOffset += SlateNode.string(child).length;
          }
        }
        const numSpaces = 4 - selectionOffset % 4;
        const spaces = new Array(numSpaces).fill(' ').join('');
        Transforms.insertText(editor, spaces, {voids: true});
        return;
      }
    } catch (err) {
      console.error("while tabbing right (2):", err);
      // The action on this candidate failed; continues searching.
    }
  }
  console.info("nothing that can tab right");
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
      const content = serializeMarkdown(editor, editor.children);
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

export {getRelevantBlockType, changeBlockType, getCommonBlock, insertListAfter, insertTableAfter, tabRight, changeContentType, coerceToPlainText};
