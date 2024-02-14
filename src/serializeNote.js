// serializeNote.js — converts Slate nodes to content & calculates title if needed
// Copyright © 2023 Doug Reeder

import {CONTENT_TOO_LONG, NodeNote, SerializedNote, shortenTitle, TITLE_MAX} from "./Note.js";
import {INLINE_ELEMENTS} from "./constants.js";
import {deserializeHtml, serializeHtml} from "./slateHtmlUtil.js";
import {Node as SlateNode} from "slate";
import {parseWords} from "./storage.js";
import {currentSubstitutions} from "./urlSubstitutions.js";
import hasTagsLikeHtml from "./util/hasTagsLikeHtml.js";
import {CONTENT_MAX} from "./Note.js";
import {extractSubtype} from "./util.js";

/**
 * Converts Slate nodes to text & extracts keywords
 * @param {NodeNote} nodeNote
 * @returns {SerializedNote}
 */
async function serializeNote(nodeNote) {
  let title, content, wordSet;

  const mimeType = nodeNote.subtype ? 'text/' + nodeNote.subtype : "";

  if (nodeNote.subtype?.startsWith('html')) {
    [title, content, wordSet] = await serializeNoteHtml(nodeNote);
  } else {
    [title, content, wordSet] = serializeNoteText(nodeNote);
  }

  const limit = nodeNote.subtype?.startsWith('html') || nodeNote.subtype?.startsWith('markdown') ?
    CONTENT_MAX : CONTENT_MAX / 10;
  if (content.length > limit) {
    const err = new Error(`“${shortenTitle(title)}” is too long: ${content.length} characters`);
    err.userMsg = CONTENT_TOO_LONG;
    throw err;
  }

  for (let candidateWord of wordSet) {
    for (let otherWord of wordSet) {
      if (otherWord !== candidateWord && candidateWord.startsWith(otherWord)) {
        wordSet.delete(otherWord);
      }
    }
  }
  const wordArr = Array.from(wordSet);

  return new SerializedNote(nodeNote.id, mimeType, title, content, nodeNote.date, nodeNote.isLocked, wordArr);
}

async function serializeNoteHtml(nodeNote) {
  const content = serializeHtml(nodeNote.nodes, await currentSubstitutions());

  const titles = {
    'heading-one': [],
    'heading-two': [],
    'heading-three': [],
    'paragraph': [],
    'other': [],
  };
  let relevantTitles = [];
  const wordSet = new Set();
  for (const topLevelNode of nodeNote.nodes) {
    for (const [element] of SlateNode.elements(topLevelNode)) {
      if (hasInlines(element)) {
        const text = SlateNode.string(element).trim();
        if (text) {
          switch (element.type) {
            case 'heading-one':
            case 'heading-two':
            case 'heading-three':
            case 'paragraph':
              if (titles[element.type].length < 2) {
                titles[element.type].push(text);
              }
              break;
            case 'list-item':
              if (titles['other'].length < 2) {
                titles['other'].push("• " + text);
              }
              break;
            default:
              if (titles['other'].length < 2) {
                titles['other'].push(text);
              }
          }

          for (const word of parseWords(text)) {
            wordSet.add(word);
          }
        }
      }
    }
  }

  if (titles['heading-one'].length) {
    relevantTitles = titles['heading-one'];
  } else if (titles['heading-two'].length) {
    relevantTitles = titles['heading-two'];
  } else if (titles['heading-three'].length) {
    relevantTitles = titles['heading-three'];
  } else if (titles['paragraph'].length) {
    relevantTitles = titles['paragraph'];
  } else if (titles['other'].length) {
    relevantTitles = titles['other'];
  }

  let title = relevantTitles.slice(0, 2).join("\n").slice(0, TITLE_MAX);

  if (!title) {
    const incipit = content.trim().slice(0, TITLE_MAX);
    if (!/<\/?[a-zA-Z][^<>]*>/.test(incipit)) {
      title = incipit;
    }
  }

  return [title, content, wordSet];
}

function hasInlines(element) {
  return element.children.some(c => 'string' === typeof c?.text || INLINE_ELEMENTS.includes(c?.type));
}


function serializeNoteText(nodeNote) {
  let i = 0
  const titleLines = [];
  while (i < nodeNote.nodes.length && titleLines.length < 2) {
    let text = SlateNode.string(nodeNote.nodes[i]);
    for (let line of text.split('\n')) {
      if (nodeNote.subtype?.startsWith('markdown')) {   // quick & dirty removal of Markdown
        line = line.replace(/={3,}|-{3,}|\*|_|^\s{0,3}#+|^\s{0,3}>|`+|!\[|~|\|/gm, '');
      }
      line = line.trim();

      if (line) {
        titleLines.push(line)
      }
    }
    ++i;
  }
  const title = titleLines.slice(0,2).join('\n').slice(0, TITLE_MAX);

  const content = nodeNote.nodes.map(node => SlateNode.string(node)).join('\n');

  const wordSet = new Set();
  for (const topLevelNode of nodeNote.nodes) {
    for (const word of parseWords(SlateNode.string(topLevelNode))) {
      wordSet.add(word);
    }
  }

  return [title, content, wordSet];
}


/**
 *
 * @param {Object} note - IDB note w/ Date date or remote note w/ string date
 * @returns {NodeNote}
 */
function deserializeNote(note) {
  let slateNodes, subtype;
  if (hasTagsLikeHtml(note.mimeType)) {
    subtype = 'html;hint=SEMANTIC';
    slateNodes = deserializeHtml(note.content);
  } else if (!note.mimeType || /^text\//.test(note.mimeType)) {
    subtype = extractSubtype(note.mimeType);
    if (subtype?.startsWith('markdown')) {
      subtype = 'markdown;hint=COMMONMARK';
    }
    slateNodes = (note.content || '').split("\n").map(line => {return {type: 'paragraph', children: [{text: line}]}});
  } else {
    throw new Error(`Can't handle “${note.mimeType}” note`);
  }

  return new NodeNote(note.id, subtype, slateNodes, note.date ?? note.lastEdited, note.isLocked);
}

export {serializeNote, deserializeNote};
