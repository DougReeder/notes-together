// mergeConflicts.js - merging two notes for Notes Together
// Copyright © 2021–2026 Doug Reeder

import {deserializeMarkdown, serializeMarkdown} from "./slateMark.js";
import {deserializeHtml, serializeHtml} from "./slateHtmlUtil.js";
import {Element, Text} from "slate";
import {INLINE_ELEMENTS} from "./constants.js";
import {SerializedNote} from "./Note.js";
import normalizeDate from "./util/normalizeDate.js";
import {calculateSubtype} from "./util.js";


// doesn't handle all the edge cases of a general-purpose deep equals
function equals(o1, o2) {
  if (typeof o1 !== typeof o2) {
    return false;
  }
  if ('object' !== typeof o1) {
    return o1 === o2;
  } else {
    for (const [key, value] of Object.entries(o1)) {
      if (! equals(value, o2[key])) {
        return false;
      }
    }
    return true;
  }
}

function isInline(node) {
  return Text.isText(node) || INLINE_ELEMENTS.includes(node?.type);
}

function hasInlines(element) {
  return element.children.every(
      c => isInline(c)
  );
}

function matchElements(element1, element2) {
  // allows undefined property to match property w/ undefined value
  const propSet = new Set(Object.keys(element1));
  for (const prop of Object.keys(element2)) {
    propSet.add(prop);
  }
  for (const prop of propSet) {
    if (!(['children', 'title'].includes(prop)) && element1[prop] !== element2[prop]) {
      return 'DIFFERENT';
    }
  }

  const element1hasInlines = hasInlines(element1);
  const element2hasInlines = hasInlines(element2);
  if (element1hasInlines && !element2hasInlines || !element1hasInlines && element2hasInlines) {
    return 'DIFFERENT';
  }
  if (element1.children.length !== element2.children.length) {
    return 'MERGEABLE';
  }
  if (element1hasInlines) {   // both have inlines
    for (let i = 0; i < element1.children.length; ++i) {
      if (! equals(element1.children[i], element2.children[i])) {
        return 'MERGEABLE';
      }
    }
    return 'EQUAL';
  } else {   // both have blocks
    for (let i = 0; i < element1.children.length; ++i) {
      const matchResult = matchElements(element1.children[i], element2.children[i]);
      if ('EQUAL' !== matchResult) {
        return 'MERGEABLE';
      }
    }
    return 'EQUAL';
  }
}

/**
 * Converts content to Slate nodes, merges them, and converts back to markup.
 * @param {SerializedNote} oldNote
 * @param {SerializedNote} newNote
 * @param {SerializedNote} [lastCommonNote]
 * @returns {SerializedNote}
 */
function mergeNotes(oldNote, newNote, lastCommonNote) {
  const oldDate = normalizeDate(oldNote?.date);
  const newDate = normalizeDate(newNote?.date);
  const mergedDate = oldDate > newDate ? oldDate : newDate;
  const mergedIsLocked = Boolean(oldNote.isLocked || newNote.isLocked);

  const oldSubtype = calculateSubtype(oldNote?.mimeType);
  const newSubtype = calculateSubtype(newNote?.mimeType);
  let mergedMimeType;
  if (oldSubtype?.startsWith('html')) {
    mergedMimeType = oldNote?.mimeType;
  } else if (newSubtype?.startsWith('html')) {
    mergedMimeType = newNote?.mimeType;
  } else if (oldSubtype?.startsWith('markdown')) {
    mergedMimeType = oldNote?.mimeType;
  } else if (newSubtype?.startsWith('markdown')) {
    mergedMimeType = newNote?.mimeType;
  } else {
    mergedMimeType = oldNote?.mimeType ?? newNote?.mimeType ?? lastCommonNote?.mimeType;
  }
  const mergedSubtype = calculateSubtype(mergedMimeType);

  let slateNodes1;
  if (oldSubtype?.startsWith('html')) {
    slateNodes1 = deserializeHtml(oldNote.content);
  } else if (oldSubtype?.startsWith('markdown') ||
      (!oldSubtype || oldSubtype?.startsWith('plain')) && mergedSubtype?.startsWith('markdown')) {
    slateNodes1 = deserializeMarkdown(oldNote.content);
  } else {
    slateNodes1 = oldNote.content.split("\n").map(line => {return {type: 'paragraph', children: [{text: line}]}});
  }
  let slateNodes2
  if (newSubtype?.startsWith('html')) {
    slateNodes2 = deserializeHtml(newNote.content);
  } else if (newSubtype?.startsWith('markdown') ||
      (!newSubtype || newSubtype?.startsWith('plain')) && mergedSubtype?.startsWith('markdown')) {
    slateNodes2 = deserializeMarkdown(newNote.content);
  } else {
    slateNodes2 = newNote.content.split("\n").map(line => {return {type: 'paragraph', children: [{text: line}]}});
  }

  const finalNodes = mergeNodes(slateNodes1, slateNodes2);

  let mergedMarkup;
  if (mergedSubtype.startsWith('html')) {
    mergedMarkup = serializeHtml(finalNodes);
  } else if (mergedSubtype.startsWith('markdown')) {
    mergedMarkup = serializeMarkdown(finalNodes);
  } else {
    mergedMarkup = finalNodes.map(node => {
      const lines = [];

      for (const child of node.children) {
        if (child.deleted) {
          lines.push("- " + child.text);
        } else if (child.inserted) {
          lines.push("+ " + child.text);
        } else {
          lines.push(child.text);
        }
      }

      return lines.join('\n');
    }).join('\n');
  }

  return new SerializedNote(oldNote.id, mergedMimeType, "", mergedMarkup, mergedDate, mergedIsLocked, []);
}

function mergeNodes(nodes1, nodes2) {
  const matchedInd = {one: 0, two: 0};
  let diagonal = 0, searchInd1 = 0;
  let numChecksThisDiagonal = 0;
  const mergeableIndexes = [];
  const equalPoints = [];
  while (matchedInd.one < nodes1.length && matchedInd.two < nodes2.length) {
    const candidate1 = matchedInd.one + searchInd1;
    const candidate2 = matchedInd.two + diagonal - searchInd1;
    const areNodesAvailable = candidate1 < nodes1.length &&
        candidate2 < nodes2.length;
    let nodeMatch;
    if (areNodesAvailable) {
      ++numChecksThisDiagonal;
      const node1 = nodes1[candidate1];
      const node1IsElement = Element.isElement(node1);
      const node2 = nodes2[candidate2];
      const node2IsElement = Element.isElement(node2);
      if (node1IsElement && node2IsElement) {
        nodeMatch = matchElements(node1, node2);
      } else if (!node1IsElement && !node2IsElement) {
        nodeMatch = equals(node1, node2) ? 'EQUAL' : 'DIFFERENT';
      } else {
        nodeMatch = 'DIFFERENT';
      }
    } else {
      nodeMatch = 'MISSING';
    }

    if ('EQUAL' === nodeMatch) {
      equalPoints.push({one: candidate1, two: candidate2, mergeableIndexes: structuredClone(mergeableIndexes)});
    } else if ('MERGEABLE' === nodeMatch) {
      mergeableIndexes.push({one: candidate1, two: candidate2});
    }

    if (searchInd1 > 0) {
      --searchInd1;
    } else {   // finished diagonal
      if (diagonal > 0 && 0 === numChecksThisDiagonal) {   // ends search
        return selectFinal(nodes1, nodes2, equalPoints, mergeableIndexes);
      }
      ++diagonal;
      searchInd1 = diagonal;
      numChecksThisDiagonal = 0;
    }
  }
}

function selectFinal(nodes1, nodes2, equalPoints, finalMergeableIndexes) {
  const equalPointsToUse = [];
  let secondLast1 = -2, secondLast2 = -2;
  let last1 = -1, last2 = -1;
  for (const equalPoint of equalPoints) {
    if (equalPoint.one > last1 && equalPoint.two > last2) {   // a later match
      equalPointsToUse.push(equalPoint);
      secondLast1 = last1; secondLast2 = last2;
      last1 = equalPoint.one; last2 = equalPoint.two;
      continue;
    }
    const improvedCentralness = Math.abs((last1-secondLast1) - (last2-secondLast2)) - Math.abs((equalPoint.one-secondLast1) - (equalPoint.two-secondLast2));
    const increasedDiagonality = (equalPoint.one - last1) + (equalPoint.two - last2);
    if (improvedCentralness >= increasedDiagonality) {   // a better match
      equalPointsToUse.pop();
      equalPointsToUse.push(equalPoint);
      last1 = equalPoint.one; last2 = equalPoint.two;
    }
  }

  const mergedNodes = [];
  const matchedInd = {one: 0, two: 0};
  for (const equalPoint of equalPointsToUse) {
    mergeToEqualNode(equalPoint.mergeableIndexes, equalPoint.one, equalPoint.two, nodes1, nodes2, matchedInd, mergedNodes);
  }
  // Pushes conflict and merged nodes after the last equal node.
  mergeToEqualNode(finalMergeableIndexes, nodes1.length, nodes2.length, nodes1, nodes2, matchedInd, mergedNodes);

  return mergedNodes;
}

function mergeToEqualNode(mergeableIndexes, cutoff1, cutoff2, nodes1, nodes2, matchedInd, mergedNodes) {
  const indexesToMerge = winnowMergeableIndexes(matchedInd, mergeableIndexes, cutoff1, cutoff2);
  if (indexesToMerge.length > 0) {
    pushConflictAndMergeable(nodes1, nodes2, matchedInd, mergedNodes, indexesToMerge);
  }

  // pushes the conflict nodes after a merged node
  mergedNodes.push(...conflictNodes(nodes1, matchedInd.one, cutoff1, 'deleted'));
  mergedNodes.push(...conflictNodes(nodes2, matchedInd.two, cutoff2, 'inserted'));

  if (cutoff1 < nodes1.length) {
    // pushes the equal node
    mergedNodes.push(nodes1[cutoff1]);   // matched node
    matchedInd.one = cutoff1 + 1;
    matchedInd.two = cutoff2 + 1;
  }
}

function winnowMergeableIndexes(matchedInd, mergeableIndexes, cutoff1, cutoff2) {
  // eliminates mergeable indexes that are no longer relevant
  for (let i=mergeableIndexes.length-1; i>=0; --i) {
    if (mergeableIndexes[i].one >= cutoff1 || mergeableIndexes[i].two >= cutoff2 ||
    mergeableIndexes[i].one < matchedInd.one || mergeableIndexes[i].two < matchedInd.two) {
      mergeableIndexes.splice(i, 1);
    }
  }
  const indexesToMerge = [];
  let last1 = -1, last2 = -1;
  for (const index of mergeableIndexes) {
    if (index.one > last1 && index.two > last2) {   // a later match
      indexesToMerge.push({one: index.one, two: index.two});
      last1 = index.one; last2 = index.two;
      continue;
    }
    const improvedCentralness = Math.abs((last1-matchedInd.one) - (last2-matchedInd.two)) - Math.abs((index.one-matchedInd.one) - (index.two-matchedInd.two));
    const increasedDiagonality = (index.one - last1) + (index.two - last2);
    if (improvedCentralness >= increasedDiagonality) {   // a better match
      indexesToMerge.at(-1).one = index.one;
      indexesToMerge.at(-1).two = index.two;
      last1 = index.one; last2 = index.two;
    }
  }
  return indexesToMerge;
}

function pushConflictAndMergeable(nodes1, nodes2, matchedInd, mergedNodes, indexesToMerge) {
  for (const indexes of indexesToMerge) {
    mergedNodes.push(...conflictNodes(nodes1, matchedInd.one, indexes.one, 'deleted'));
    mergedNodes.push(...conflictNodes(nodes2, matchedInd.two, indexes.two, 'inserted'));
    const newElement = Object.assign({}, nodes1[indexes.one],
        {children: mergeNodes(
          nodes1[indexes.one].children,
          nodes2[indexes.two].children
      )});
    mergedNodes.push(newElement);
    matchedInd.one = indexes.one + 1;
    matchedInd.two = indexes.two + 1;
  }
}

function conflictNodes(source, start, end, mark) {
  if (end === start) {
    return [];
  }

  const marks = {};
  marks[mark] = true;
  applyTextStyle(source.slice(start, end), marks);
  return source.slice(start, end);
}

function applyTextStyle(nodes, marks) {
  for (const n of nodes) {
    if (Element.isElement(n)) {
      applyTextStyle(n.children, marks);
    } else {
      Object.assign(n, marks);
    }
  }
}


export {matchElements, mergeNotes};
