// sharingContent.js —  for Notes Together
// Copyright © 2024 Doug Reeder

import hasTagsLikeHtml from "./hasTagsLikeHtml.js";
import {serializeMarkdown} from "../slateMark.js";
import {deserializeHtml} from "../slateHtml.jsx";
import {shortenTitle} from "../Note.js";

/**
 * Converts note to Markdown or plain text.
 * @param {SerializedNote} note
 * @returns string
 */
export function sharingContent(note) {
  let text;
  if (hasTagsLikeHtml(note.mimeType)) {
    text = serializeMarkdown(deserializeHtml(note.content));
  } else if (!note.mimeType || /^text\//.test(note.mimeType)) {
    text = note.content;
  } else {
    const err = new Error(`Can't share ${note.mimeType} note “${shortenTitle(note.title)}” [${note.id}]`);
    err.userMsg = `Can't share “${note.mimeType}” note`;
    throw err;
  }

  return text;
}

/**
 * Creates a File object from the contents and type
 * @param {SerializedNote} note
 * @returns {File}
 */
export function wrapInFile(note) {
  const typeMatch = /^([A-Za-z]+\/([-\w.+]+))/.exec(note.mimeType);
  const fileType = typeMatch?.[1] || 'text/plain';
  const subtype = typeMatch?.[2] || 'plain';

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
  const fileName = (note.title?.split(/\r\n|\n|\r/)?.[0]?.replace(/[<>{}\\/^•]/g, " ").trim().slice(0, 90) || "note") + extension;
  return new File([note.content], fileName,
    {type: fileType, endings: 'native' /*, lastModified: note.lastEdited*/});
}

// maps subtype to file extension, when the subtype is not the the extension, 'x-extension' nor 'vnd.extension'
const map = {
  'xhtml+xml': '.xhtml',
  'mathml+xml': '.mml',
  'mathml-presentation+xml': '.mml',
  'mathml': '.mml',
  'plain': '.txt',
  'readme': '.txt',
  'me': '.txt',
  '1st': '.txt',
  'log': '.txt',
  'vnd.ascii-art': '.txt',   // so recipients can handle appropriately
  'ascii': '.txt',
  'markdown': '.md',
  'mkd': '.md',
  'mkdn': '.md',
  'mdown': '.md',
  'yml': '.yaml',
  'vcard': '.vcf',
  'calendar': '.ics',
  'rfc822': '.eml',
  'global': '.u8msg',
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
  'vnd.dvb.subtitle': '.sub',
  'mathematica': '.nb',
}
