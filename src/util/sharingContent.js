// sharingContent.js —  for Notes Together
// Copyright © 2024 Doug Reeder

import hasTagsLikeHtml from "./hasTagsLikeHtml.js";
import {serializeMarkdown} from "../slateMark.js";
import {deserializeHtml} from "../slateHtmlUtil.js";
import {shortenTitle} from "../Note.js";

/**
 * Converts note to Markdown or plain text.
 * @param {SerializedNote} note
 * @returns string
 */
export function sharingContent(note) {
  let text;
  if (hasTagsLikeHtml(note.mimeType)) {
    text = serializeMarkdown(deserializeHtml(note.content), true);
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
  const typeMatch = /^([A-Za-z]+\/(?:x-|vnd\.|x\.)?([-\w.+]+))/.exec(note.mimeType);
  const fileType = typeMatch?.[1] || 'text/plain';
  const subtype = typeMatch?.[2] || 'plain';

  const extension = map[subtype] || '.' + subtype;
  let fileName = shortenTitle(note.title, 90)?.replace(/[<>{}\\/^•]/g, " ").trim() || "note";
  if (! fileName.endsWith(extension)) {
    fileName += extension;
  }
  return new File([note.content], fileName,
    {type: fileType, endings: 'native' /*, lastModified: note.lastEdited*/});
}

// maps subtype to file extension, when the subtype is not the the extension
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
  'ascii-art': '.txt',   // so recipients can handle appropriately
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
  'uuencode': '.uue',
  'tab-separated-values': '.tsv',
  'shellscript': '.sh',
  'javascript': '.js',
  'ecmascript': '.js',
  'python-script': '.py',
  'python': '.py',
  'python3': '.py',
  'elisp': '.el',
  'gvy': '.groovy',
  'gy': '.groovy',
  'gsh': '.groovy',
  'perl': '.pl',
  'perl-script': '.pl',
  'ruby': '.rb',
  'erlang': '.erl',
  'haskell': '.hs',
  'pascal': '.pas',
  'csrc': '.c',
  'chdr': '.h',
  'c++src': '.cpp',
  'c++hdr': '.hpp',
  'objcsrc': '.m',
  'objective-c': '.m',
  'csharp': '.cs',
  'vbnet': '.vb',
  'common-lisp': '.cl',
  'scheme': '.scm',
  'ocaml': '.ml',
  'fortran': '.f',
  'make': '.nmk',   // Classically makefiles don't have an extension, but we have to use something
  'mak': '.nmk',
  'mk': '.nmk',
  'latex': '.tex',
  'troff': '.t',
  'httpd-php': '.php',
  'uri-list': '.uri',
  'uri-map': '.urim',
  'dvb.subtitle': '.sub',
  'mathematica': '.nb',
  'matlab': '.m',
}
