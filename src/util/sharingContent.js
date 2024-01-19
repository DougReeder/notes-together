// sharingContent.js —  for Notes Together
// Copyright © 2024 Doug Reeder

import hasTagsLikeHtml from "./hasTagsLikeHtml.js";
import {serializeMarkdown} from "../slateMark.js";
import {deserializeHtml} from "../slateHtml.jsx";
import {shortenTitle} from "../Note.js";

/**
 * Converts note to Markdown or plain text; wraps content in file if not plain nor Markdown.
 * @param {SerializedNote} note
 * @returns {{text: string, file: File|undefined}}
 */
export function sharingContent(note) {
  let text, file;
  if (hasTagsLikeHtml(note.mimeType)) {
    text = serializeMarkdown(deserializeHtml(note.content));
    file = wrapInFile(note);
  } else if (/^text\//.test(note.mimeType)) {
    text = note.content;
    file = wrapInFile(note);
  } else if (!note.mimeType) {
    text = note.content;
    file = wrapInFile(note);
  } else {
    const err = new Error(`Can't export ${note.mimeType} note “${shortenTitle(note.title)}” [${note.id}]`);
    err.userMsg = `Can't export “${note.mimeType}” note`;
    throw err;
  }

  return {text, file};
}

function wrapInFile(note) {
  const subtype = /^[-\w.]+\/([-\w.]+)/.exec(note.mimeType)?.[1] || 'plain';
  // if (['plain', 'markdown'].includes(subtype)) { return undefined; }

  let extension = map[subtype];
  if (!extension) {
    if (subtype.startsWith('x-')) {
      extension = '.' + subtype.slice(2);
    } else if (subtype.startsWith('vnd.')) {
      extension = '.' + subtype.slice(4);
    } else {
      extension = '.' + subtype;
    }
  }
  const fileName = (note.title?.split("\n")?.[0].replace(/[<>\\/^•]/g, " ").trim() || "note") + extension;
  const fileType = /^([-\w.]+\/[-\w.]+)/.exec(note.mimeType)?.[1] || 'text/plain';
  return new File([note.content], fileName,
    {type: fileType, endings: 'native' /*, lastModified: note.lastEdited*/});
}

// maps subtype to file extension, when the subtype is not the the extension, or 'x-foo'
const map = {
  'xhtml+xml': '.xhtml',
  'mathml+xml': '.mml',
  'mathml-presentation+xml': '.mml',
  'mathml': '.mml',
  'plain': '.txt',
  'readme': '.txt',
  'me': '.txt',
  '1st': '.txt',
  'markdown': '.md',
  'mkd': '.md',
  'mkdn': '.md',
  'mdown': '.md',
  'yml': '.yaml',
  'vcard': '.vcf',
  'calendar': '.ics',
  'rfc822': '.eml',
  'x-uuencode': '.uue',
  'tab-separated-values': '.tsv',
  'x-shellscript': '.sh',
  'javascript': '.js',
  'x-javascript': '.js',
  'ecmascript': '.js',
  'x-python-script': '.py',
  'elisp': '.el',
  'gvy': '.groovy',
  'gy': '.groovy',
  'gsh': '.groovy',
  'make': '.nmk',   // Classically makefiles don't have an extension, but we have to use something
  'mak': '.nmk',
  'mk': '.nmk',
  'x-troff': '.t',
  'x-httpd-php': '.php',
  'uri-list': '.uri',
  'vnd.uri-map': '.urim',
  'vnd.ascii-art': '.txt',   // so recipients can handle appropriately
  'ascii': '.txt',
  'vnd.dvb.subtitle': '.sub',
  'mathematica': '.nb',
}
