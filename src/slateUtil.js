// slateUtil.js - utility functions for Slate editor
// © 2021-2023 Doug Reeder under the MIT License

import {
  Editor,
  Element as SlateElement,
  Node as SlateNode,
  Text as SlateText,
  Transforms,
  Point as SlatePoint,
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

const LIST_TYPES = ['numbered-list', 'bulleted-list', 'task-list', 'sequence-list', 'list-item'];
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
    let oldHasChecklist = false;
    for (const [node] of Editor.nodes(editor, {
      match: (n, p) => p.length === changePathLength
    })) {
      if (['task-list', 'sequence-list'].includes(node.type)) {
        oldHasChecklist = true;
        break;
      }
    }

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
      if (SlateElement.isElement(node) && Editor.hasBlocks(editor, node)) {
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
      const newIsChecklist = ['task-list', 'sequence-list'].includes(newType);
      if (newIsChecklist && !oldHasChecklist) {
        newProperties.checked = false;
      } else if (oldHasChecklist && !newIsChecklist) {
        Transforms.unsetNodes(editor, 'checked', {
          match: (n, p) => p.length === changePathLength});
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

function insertCheckListAfter(editor, newType) {
  insertAfter(editor,
    {type: newType, children: [{type: 'list-item', checked: false, children: [{text: ""}]}]},
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
  const [block, blockPath] = getSelectedBlock(['list-item', 'table-cell', 'quote'], editor);
  if (!block) {
    const err = new Error("Reduce your selection, first");
    err.severity = 'info';
    throw err;
  }
  Editor.withoutNormalizing(editor, () => {
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
  while (SlateText.isText(common) || editor.isInline(common)) {
    path = path.slice(0, -1);
    common = SlateNode.get(editor, path);
  }
  return {block: common, blockPath: path}
}

const getSelectedListItem = getSelectedBlock.bind(null, ['list-item']);

const getSelectedTable = getSelectedBlock.bind(null, ['table']);

const getSelectedQuote = getSelectedBlock.bind(null, ['quote']);

function getSelectedBlock(blockTypes, editor) {
  if (!editor.selection) return [undefined, undefined];
  const {blockPath} = getCommonBlock(editor);
  // searches upward for block of appropriate type
  for (const [candidate, candidatePath] of SlateNode.levels(editor, blockPath, {reverse: true})) {
    try {
      if (blockTypes.includes(candidate.type)) {
        return [candidate, candidatePath];
      }
    } catch (err) {
      console.error(`while searching for selected ${blockTypes.join()}:`, err);
    }
  }
  return [undefined, undefined];
}

function tabRight(editor) {
  if (!editor.selection) return;
  const {blockPath} = getCommonBlock(editor);
  const firstPoint = Editor.start(editor, editor.selection);
  const firstPath = firstPoint.path;
  // searches upward for a list or table block to operate on
  for (const [candidate, candidatePath] of SlateNode.levels(editor, blockPath, {reverse: true})) {
    try {
      if ('table-cell' === candidate.type) {
        const endPnt = Editor.end(editor, candidatePath);
        const afterPnt = Editor.after(editor, endPnt);
        Transforms.select(editor, {anchor: afterPnt, focus: afterPnt});
        return;
      } else if ('list-item' === candidate.type) {
        nestListItems(editor, firstPath, candidatePath);
        return;
      } else if (['bulleted-list', 'numbered-list', 'task-list', 'sequence-list'].includes(candidate.type)) {
        nestListItems(editor, firstPath, firstPath.slice(0, candidatePath.length+1));
        return;
      }
    } catch (err) {
      // The action on this candidate failed; continues searching.
    }
  }
  // searches upward for any block to operate on
  for (const [candidate, candidatePath] of SlateNode.levels(editor, firstPath, {reverse: true})) {
    try {
      if (SlateText.isText(candidate) || editor.isInline(candidate)) { continue; }
      const candidateStart = Editor.start(editor, candidatePath);
      const comparison = SlatePoint.compare(candidateStart, firstPoint);
      if (0 === comparison && editor.subtype?.startsWith('html')) {
        if (SlateRange.isCollapsed(editor.selection) && 'paragraph' === candidate.type) {
          Transforms.setNodes(editor, {type: 'quote'}, {match: (n, p) => candidatePath.length === p.length});
          return;
        } else if (['heading-one', 'heading-two', 'heading-three', 'paragraph', 'bulleted-list', 'numbered-list', 'task-list', 'sequence-list', 'table', 'quote', 'code'].includes(candidate.type)) {
          const wrapDepth = Math.max(blockPath.length, 1);
          Transforms.wrapNodes(editor, {type: 'quote'}, {match: (n, p) => wrapDepth === p.length});
          return;
        }
      } else if (SlateRange.isCollapsed(editor.selection)) {
        const selectionOffset = measureOffset(editor, candidate, candidatePath);
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

function nestListItems(editor, firstPath, sourceItemPath) {
  const [, lastPath] = Editor.last(editor, editor.selection);
  // calculates a normalized source range from selection
  const startPath = firstPath.slice(0, sourceItemPath.length);
  const endPath = lastPath.slice(0, sourceItemPath.length);
  const sourceRange = {anchor: Editor.start(editor, startPath),
    focus:  Editor.end(editor, endPath)};
  // If a list exists at the destination, moves source items to it.
  let [sibling, siblingPath] = Editor.previous(editor, {at: sourceItemPath});
  for (const [child, childPath] of SlateNode.children(editor, siblingPath, {reverse: true})) {
    if (['bulleted-list', 'numbered-list', 'task-list', 'sequence-list'].includes(child.type)) {
      const destination = [...childPath, child.children.length];
      Editor.withoutNormalizing(editor, () => {
        Transforms.moveNodes(editor, {
          at: sourceRange,
          to: destination,
          match: (n, p) => p.length === sourceItemPath.length
        });
        if (['task-list', 'sequence-list'].includes(child.type)) {
          Transforms.setNodes(editor, {checked: false}, {
            at: destination,
            match: (n,p) => p.length === destination.length && !('checked' in n)});
        } else {
          Transforms.unsetNodes(editor, 'checked', {at: destination});
        }
      });
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
    const [parent] = Editor.parent(editor, sourceItemPath);
    Transforms.moveNodes(editor, {at: sourceRange, to: destination, match: (n,p) => p.length === sourceItemPath.length});
    const wrapRange = {anchor: Editor.start(editor, destination),
      focus: Editor.end(editor, siblingPath)};
    Transforms.wrapNodes(editor, {type: parent.type, children: []}, {at: wrapRange, match: (n,p) => p.length === destination.length});
  });
}

function tabLeft(editor) {
  if (!editor.selection) return;
  const firstPoint = Editor.start(editor, editor.selection);
  const firstPath = firstPoint.path;
  const {blockPath} = getCommonBlock(editor);
  // searches upward for a list or table block to operate on
  if (editor.subtype?.startsWith('html')) {
    for (const [candidate, candidatePath] of SlateNode.levels(editor, blockPath, {reverse: true})) {
      try {
        if ('table-cell' === candidate.type) {
          const startPnt = Editor.start(editor, candidatePath);
          const beforePnt = Editor.before(editor, startPnt);
          Transforms.select(editor, {anchor: beforePnt, focus: beforePnt});
          return;
        } else if ('list-item' === candidate.type) {
          if (candidatePath.length < 4) continue;
          // only moves first or last sublist item
          const sublist = SlateNode.ancestor(editor, candidatePath.slice(0, -1));
          const childItemInd = candidatePath[candidatePath.length-1];
          if (childItemInd > 0 && childItemInd < sublist.children.length - 1) { continue }
          // calculates destination
          const parentItem = SlateNode.ancestor(editor, candidatePath.slice(0, -2));
          if ('list-item' !== parentItem.type) { continue }
          unnestListItem(editor, firstPath, candidate, candidatePath);
          return;
        }
      } catch (err) {
        console.error("while tabbing left (1):", err);
        // The action on this candidate failed; continues searching.
      }
    }

    // searches upward for a block quote to operate on
    let comparison;
    for (const [candidate, candidatePath] of SlateNode.levels(editor, firstPath, {reverse: true})) {
      try {
        if (undefined === comparison && SlateElement.isElement(candidate) && Editor.isBlock(editor, candidate)) {
          const candidateStart = Editor.start(editor, candidatePath);
          comparison = SlatePoint.compare(candidateStart, firstPoint);
        }
        if ('quote' !== candidate.type || comparison !== 0) { continue; }
        if (!Editor.hasBlocks(editor, candidate)) {
          Transforms.setNodes(editor, {type: 'paragraph'}, {at: candidatePath})
        } else {
          Transforms.unwrapNodes(editor, {match: (n, p) => candidatePath.length === p.length});
        }
        return;
      } catch (err) {
        console.error("while tabbing left (2):", err);
        // The action on this candidate failed; continues searching.
      }
    }
  }
  if (SlateRange.isCollapsed(editor.selection)) {
    // searches upward for a block to delete characters from
    for (const [candidate, candidatePath] of SlateNode.levels(editor, firstPath, {reverse: true})) {
      try {
        if (['paragraph', 'quote', 'code'].includes(candidate.type)) {
          const selectionOffset = measureOffset(editor, candidate, candidatePath);
          if (selectionOffset > 0) {
            const numChars = selectionOffset % 4 || 4;
            Transforms.delete(editor, {distance: numChars, unit: 'character', reverse: true});
          }
          return;
        }
      } catch (err) {
        console.error("while tabbing left (3):", err);
        // The action on this candidate failed; continues searching.
      }
    }
  }
  console.info("nothing that can tab left");
}

function unnestListItem(editor, firstPath, childItem, childItemPath) {
  const [, lastPath] = Editor.last(editor, editor.selection);

  // calculates a normalized source range from selection
  const startPath = firstPath.slice(0, childItemPath.length);
  const endPath = lastPath.slice(0, childItemPath.length);
  const sourceRange = {
    anchor: Editor.start(editor, startPath),
    focus: Editor.end(editor, endPath)
  };
  const parentItemPath = childItemPath.slice(0, -2)
  const itemDestination = [...parentItemPath.slice(0, -1),
    1 + parentItemPath[parentItemPath.length - 1]];
  Editor.withoutNormalizing(editor, () => {
    // moves list-item
    Transforms.moveNodes(editor, {at: sourceRange, to: itemDestination,
      match: (n,p) => childItemPath.length === p.length});
    const parentList = SlateNode.ancestor(editor, parentItemPath.slice(0, -1));
    if (['task-list', 'sequence-list'].includes(parentList.type)) {
      Transforms.setNodes(editor, {checked: false}, {
        at: itemDestination,
        match: (n,p) => p.length === itemDestination.length && !('checked' in n)});
    } else {
      Transforms.unsetNodes(editor, 'checked', {at: itemDestination});
    }
    if (0 === childItemPath[childItemPath.length-1]) {
      // moves sub-sub-list items (if any) to sub-list
      const maybeListPath = [...itemDestination, childItem.children.length - 1];
      const maybeList = SlateNode.get(editor, maybeListPath);
      if (['bulleted-list', 'numbered-list', 'task-list', 'sequence-list'].includes(maybeList.type)) {
        Transforms.moveNodes(editor, {
          at: maybeListPath,
          match: (n, p) => maybeListPath.length + 1 === p.length,
          to: childItemPath
        });
      }
      // moves or deletes sub-list
      const sublistPath = childItemPath.slice(0, -1);
      const changedSublist = SlateNode.get(editor, sublistPath);
      if (changedSublist.children.length > 0) {
        if (SlateText.isText(childItem.children[0])) {
          Transforms.wrapNodes(editor, {type: 'paragraph', children: []}, {
            at: itemDestination,
            match: (n, p) => itemDestination.length + 1 === p.length
          });
        }
        const changedCandidate = SlateNode.get(editor, itemDestination);
        const listDestination = [...itemDestination, changedCandidate.children.length];
        Transforms.moveNodes(editor, {at: sublistPath, to: listDestination});
      } else {
        Transforms.removeNodes(editor, {at: sublistPath});
      }
    }
    // unwraps parent item
    const changedParentItem = SlateNode.get(editor, parentItemPath);
    if (1 === changedParentItem.children.length) {
      if ('paragraph' === changedParentItem.children[0].type) {
        Transforms.unwrapNodes(editor, {at: parentItemPath, match: (n,p) => parentItemPath.length+1 === p.length});
      }
    }
    const changedStart = Editor.start(editor, itemDestination);
    Transforms.select(editor, {anchor: changedStart, focus: changedStart});
  });
}

function measureOffset(editor, block, blockPath) {
  const [startPnt] = Editor.edges(editor, editor.selection);
  let selectionOffset = 0;
  for (const [child, childPath] of SlateNode.texts(block)) {
    if (arraylikeEqual([...blockPath, ...childPath], startPnt.path)) {
      selectionOffset += startPnt.offset;
      break;
    } else {
      selectionOffset += SlateNode.string(child).length;
    }
  }
  return selectionOffset;
}

function toggleCheckListItem(editor, path, checked) {
  let finalPath = path;
  const list = SlateNode.parent(editor, path);
  if ('task-list' === list.type) {
    if (checked) {
      Transforms.setNodes(editor, {strikethrough: true},
        {at: path, match: (n,p) => SlateText.isText(n) && p.length > path.length});

      finalPath = [...path.slice(0, -1), list.children.length - 1];
    } else {
      Transforms.unsetNodes(editor, 'strikethrough',
        {at: path, match: (n,p) => SlateText.isText(n) && p.length > path.length});

      let firstCheckedInd = 0;
      while (false === list.children[firstCheckedInd].checked &&
      firstCheckedInd < list.children.length - 1) {
        ++firstCheckedInd;
      }
      finalPath = [...path.slice(0, -1), firstCheckedInd];
    }
    Transforms.moveNodes(editor, {at: path, to: finalPath});
  } else if ('sequence-list' !== list.type) {
    console.error(`parent of checklist item is “${list.type}”`);
  }

  Transforms.setNodes(editor, {checked: checked}, { at: finalPath });
}

function flipTableRowsToColumns(editor) {
  const [selectedTable, selectedTablePath] = getSelectedTable(editor);
  const oldNumRow = selectedTable.children.length;
  const oldNumCol = SlateNode.child(selectedTable, 0).children.length;
  Editor.withoutNormalizing(editor, () => {
    for (let newRow = 0; newRow < oldNumCol; ++newRow) {
      const rowPath = [...selectedTablePath, newRow];
      Transforms.insertNodes(editor, {type: 'table-row', children: []}, {at: rowPath});
      for (let newCol = 0; newCol < oldNumRow; ++newCol) {
        const oldPath = [...selectedTablePath, 1 + newRow + newCol, 0];
        const newPath = [...rowPath, newCol]
        Transforms.moveNodes(editor, {at: oldPath, to: newPath});
      }
    }

    const startPnt = Editor.start(editor, selectedTablePath);
    Transforms.select(editor, {anchor: startPnt, focus: startPnt});
  });
}

async function changeContentType(editor, oldSubtype, newSubtype) {
  if (!newSubtype || newSubtype.startsWith('plain')) {
    Editor.withoutNormalizing(editor, () => {
      if (oldSubtype?.startsWith('markdown')) {   // convert to rich text in editor
        const text = editor.children.map(node => SlateNode.string(node)).join('\n');
        const slateNodes = deserializeMarkdown(text, editor);
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
      const slateNodes = deserializeMarkdown(text, editor);
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
        match: node => !Editor.isEditor(node) && SlateElement.isElement(node) && Editor.hasBlocks(editor, node),
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

export {getRelevantBlockType, changeBlockType, getCommonBlock, insertListAfter, insertCheckListAfter, insertTableAfter, insertAfter, getSelectedListItem, getSelectedTable, getSelectedQuote, tabRight, tabLeft, toggleCheckListItem, flipTableRowsToColumns, changeContentType, coerceToPlainText};
