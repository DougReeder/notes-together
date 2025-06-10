// fileImportUtil.js — functions for FileImport element for Notes Together
// Copyright © 2021–2024 Doug Reeder under the MIT License

import {extractExtension, extractSubtype, isLikelyMarkdown} from "./util.js";
import hasTagsLikeHtml from "./util/hasTagsLikeHtml.js";
import {allowedExtensions, allowedFileTypesNonText, unsupportedTextSubtypes} from "./constants.js";
import {imageFileToDataUrl} from "./util/imageFileToDataUrl.js";
import {upsertNote} from "./storage.js";
import {deserializeNote} from "./serializeNote.js";
import {extractUserMessage} from "./util/extractUserMessage.js";
import QuietError from "./util/QuietError.js";
import {CONTENT_MAX} from "./Note.js";

const TOO_LONG_COPY = "Too long. Copy only the parts you need.";

async function determineParseType(file) {
  // console.log(`selected file “${file.name}” "${file.type}"`)
  const extension = extractExtension(file);
  if (file.type.startsWith('image/')) {
    return {file, parseType: file.type};
  } else if (hasTagsLikeHtml(file.type, extension)) {
    return {file, parseType: 'text/html'};
  } else {
    if (!file.type.startsWith('text') &&
      !allowedFileTypesNonText.includes(file.type) &&
      !(!file.type && allowedExtensions.includes(extension))) {
      console.error(`Not importable: “${file.name}” (${file.type})`);
      return {file, parseType: file.type, message: "Not importable. Open in appropriate app & copy."};
    }

    const subtype = extractSubtype(file.type);
    if ('markdown' === subtype) {
      return {file, parseType: 'text/markdown'};
    } else if ('plain' === subtype) {
      const isMarkdown = await checkForMarkdown(file);
      // console.log(`text file "${file.name}"; likely Markdown ${isMarkdown}`);
      return {file, parseType: 'text/plain', isMarkdown};
    } else if (unsupportedTextSubtypes.includes(subtype)) {
      console.error(`Not importable: “${file.name}” (${file.type})`);
      return {file, parseType: file.type, message: "Not importable. Open in appropriate app & copy."};
    } else {
      return {file, parseType: 'text/' + (subtype || extension?.slice(1) || 'plain')};
    }
  }
}

function checkForMarkdown(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target.result;
      const isLikely = isLikelyMarkdown(text);
      resolve(isLikely);
    };
    reader.onerror = _evt => {
      reject(reader.error);
    };
    reader.readAsText(file);
  });
}

/** @returns Promise */
function importFromFile(file, parseType, isMultiple) {
  // console.log(`importFromFile "${file.name}" ${parseType}`);
  if (parseType.startsWith('image/')) {
    return importGraphic(file);
  } else {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async evt => {
        try {
          const text = evt.target.result;
          const coda = isMultiple && ['text/plain', 'text/markdown'].includes(file.type) && /\bserene-notes\b/i.test(file.name) ? '' : file.name;

          let response;
          switch (parseType) {
            case 'text/html':
              response = await importHtml(text, file.lastModified, coda);
              break;
            case 'text/plain':
            case 'text/markdown':
              if (isMultiple) {
                response = await splitIntoNotes(text, file.lastModified, coda, parseType);
              } else {
                response = await importText(text, file.lastModified, coda, parseType);
              }
              break;
            default:
              response = await importText(text, file.lastModified, coda, parseType);
              break;
          }
          console.info(`Imported ${response.noteIds.length} ${parseType} note(s) from "${file.name}"`, response.messages);

          const msgs = response.messages || [];
          if (response.noteIds.length > 1) {
            msgs.unshift(`${response.noteIds.length} notes`);
          } else if (1 === response.noteIds.length) {
            msgs.unshift("1 note");
          } else if (0 === msgs.length) {   // 0 === response.noteIds.length
            msgs.unshift("No notes");
          }
          resolve({noteIds: response.noteIds, message: msgs.join("; "), coda});
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = _evt => {
        reject(reader.error);
      };
      reader.readAsText(file);
    });
  }
}

async function importGraphic(file) {
  const {dataUrl, alt} = await imageFileToDataUrl(file);
  const html = `<h1></h1><img alt="${alt}" src="${dataUrl}" /><p></p>`;

  const raw = {mimeType: 'text/html;hint=SEMANTIC', content: html, date: file.lastModified};
  const {id} = await upsertNote(deserializeNote(raw), undefined);
  console.info(`Created 1 HTML note from "${file.name}" (${file.type})`);
  return {noteIds: [id], message: "1 note"};
}

async function importHtml(html, fileDateValue, coda) {
  try {
    if (/^\s*$/.test(html)) {
      return {noteIds: [], messages: []};
    }
    if (coda) {
      let startPos = 0;
      const bodyRE = /<body[^>]*>/ig;
      const headRE = /<\/head *>/ig;
      const htmlRE = /<html[^>]*>/ig;
      if (bodyRE.test(html)) {
        startPos = bodyRE.lastIndex;
      } else if (headRE.test(html)) {
        startPos = headRE.lastIndex;
      } else if (htmlRE.test(html)) {
        startPos = htmlRE.lastIndex;
      }

      html = html.slice(0, startPos) + '<p><em>' + coda + '</em></p><hr />' + html.slice(startPos);
    }

    const raw = {mimeType: 'text/html;hint=SEMANTIC', content: html, date: fileDateValue};

    const {id} = await upsertNote(deserializeNote(raw), undefined);
    return {noteIds: [id], messages: []};
  } catch (err) {
    let messages = [];
    if ('/properties/content/maxLength' === err?.error?.schemaPath) {
      messages.push(TOO_LONG_COPY);
    } else {
      messages.push(extractUserMessage(err));
    }
    return {noteIds: [], messages}
  }
}

async function splitIntoNotes(text, fileDateValue, coda, parseType) {
  const buffer = [];
  let emptyLineCount = 0;
  let lineMatch;
  const linePatt = /^(.*)(\r\n|\n|\r|$)/gm;
  const emptyLinePatt = /^\s*$/;
  const noteIds = [];
  const messages = [];
  let lastLastIndex = 0;

  while (linePatt.lastIndex < text.length && (lineMatch = linePatt.exec(text)) !== null) {
    if (emptyLinePatt.test(lineMatch[1])) {
      ++emptyLineCount;
    } else {
      if (emptyLineCount >= 3) {
        // non-blank line after 3 blank, so forms note from previous
        try {
          const note = await linesToNote(buffer, fileDateValue--, coda, parseType);
          const {id} = await upsertNote(note, undefined);
          noteIds.push(id);
        } catch (err) {
          console.error("splitIntoNotes:", err);
          const msg = extractUserMessage(err);
          if (err.name !== 'QuietError' && ! messages.includes(msg)) {
            messages.push(msg);
          }
        } finally {
          buffer.length = 0;
        }
      }
      emptyLineCount = 0;
    }

    // This stores EACH line, blank or non-blank
    buffer.push(lineMatch[1]);
    lastLastIndex = linePatt.lastIndex;
  }

  let lastLine;   // TODO: determine if this can be deleted
  if ((lastLine = text.slice(lastLastIndex))) {   // file doesn't end with newline
    if (!emptyLinePatt.test(lastLine)) {   // not blank
      buffer.push(lastLine);
    }
  }
  if (buffer.length > 0) {   // forms one last note
    try {
      const note = await linesToNote(buffer, fileDateValue--, coda, parseType);
      const {id} = await upsertNote(note, undefined);
      noteIds.push(id);
    } catch (err) {
      console.error("while forming last note:", err);
      const msg = extractUserMessage(err);
      if (err.name !== 'QuietError' && ! messages.includes(msg)) {
        messages.push(msg);
      }
    }
  }

  return {noteIds, messages};
}

/**
 * trims trailing blank lines and returns note object
 *
 * @arg {array of String} lines
 * @arg {integer} noteDefaultDateValue if no date found in last line
 * @arg {string} coda
 * @arg {string} parseType
 * @returns {Object} note
 */
async function linesToNote(lines, noteDefaultDateValue, coda, parseType) {
  const emptyLinePatt = /^\s*$/;
  while (emptyLinePatt.test(lines[lines.length - 1])) {
    --lines.length;
    if (lines.length === 0) {
      throw new QuietError('all lines are blank');
    }
  }
  const noteChars = lines.reduce(function (previousValue, currentString) {
    return previousValue + currentString.length;
  }, 0);
  const isMarkdown = 'text/markdown' === parseType;
  if (noteChars > (isMarkdown ? CONTENT_MAX : CONTENT_MAX / 10)) {
    throw new Error(`Divide manually before importing`);
  }
  // last line may or may not be date
  const lastLine = lines[lines.length - 1].trim();
  let dateValue = Date.parse(lastLine);
  if (/^\d\d\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(T[\d:.Z+-➖]{2,24})?$/.test(lastLine) &&
    !isNaN(dateValue)) {
    --lines.length;
  } else {
    dateValue = noteDefaultDateValue;
  }
  // previous lines are content
  let content;
  content = lines.join('\n');
  if (coda) {
    content += '\n\n' + (isMarkdown ? '------------------------------\n*' : '') + coda + (isMarkdown ? '*' : '');
  } else {
    content += '\n';
  }
  return deserializeNote({mimeType: parseType, content, date: dateValue});
}

async function importText(text, fileDateValue, coda, parseType) {
  try {
    if (/^\s*$/.test(text)) {
      return {noteIds: [], messages: []};
    }
    text = text.replace(/\r\n|\r/g, '\n');   // replaces carriage returns with newlines
    if (coda) {
      if ('text/markdown' === parseType) {
        text = `*${coda}*\n\n------------------------------\n` + text;
      } else {
        text = coda + '\n\n' + text;
      }
    }
    const raw = {mimeType: parseType, content: text, date: fileDateValue};

    const {id} = await upsertNote(deserializeNote(raw), undefined);

    return {noteIds: [id], messages: []};
  } catch (err) {
    let messages = [];
    if ('/properties/content/maxLength' === err?.error?.schemaPath) {
      messages.push(TOO_LONG_COPY);
    } else {
      messages.push(extractUserMessage(err));
    }
    return {noteIds: [], messages}
  }
}

export {determineParseType, checkForMarkdown, importFromFile};
