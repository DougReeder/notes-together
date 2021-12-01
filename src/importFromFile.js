// importFromFile.js - import for Notes Together
// Copyright © 2021 Doug Reeder

import {isLikelyMarkdown} from "./util";
import {createMemoryNote} from "./Note";
import {upsertNote} from "./storage";

const allowedFileTypesNonText = ['application/xhtml+xml','application/mathml+xml','application/javascript','application/x-yaml','application/json','image/svg+xml'];

function checkForMarkdown(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target.result;
      const isLikely = isLikelyMarkdown(text);
      resolve(isLikely);
    };
    reader.onerror = evt => {
      reject(reader.error);
    };
    reader.readAsText(file);
  });
}

function importMultipleNotes(file, parseType) {
  console.log(`importMultipleNotes "${file.name}" ${parseType}`);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async evt => {
      try {
        const text = evt.target.result;
        console.log('onload', '“' + text.slice(0, 100) + '...”');
        const coda = file.name;   // TODO: remove file extension

        let noteIds
        switch (parseType) {
          case 'text/html':
            noteIds = await importHtml(text, file.lastModified, coda);
            break;
          case 'text/plain':
          case 'text/markdown':
            noteIds = await splitIntoNotes(text, file.lastModified, coda, parseType);
            break;
          default:
            throw new Error(parseType + " not yet implemented");
        }

        console.log(`finished importing ${noteIds.length} notes from "${file.name}"`)
        resolve(noteIds);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = evt => {
      reject(reader.error);
    };
    reader.readAsText(file);
  });
}

async function importHtml(html, fileDateValue, coda) {
  if (coda) {
    let endPos = html.indexOf('</body>');
    if (endPos < 0) {
      endPos = html.indexOf('</BODY>');
    }
    if (endPos < 0) {
      endPos = html.indexOf('</html>');
    }
    if (endPos < 0) {
      endPos = html.indexOf('</HTML>');
    }

    if (endPos >= 0) {
      html = html.slice(0, endPos) + '<p>' + coda + '</p>' + html.slice(endPos);
    } else {
      html += '<p>' + coda + '</p>';
    }
  }

  const newNote = createMemoryNote(null, html, new Date(fileDateValue), 'text/html;hint=SEMANTIC');

  const cleanNote = await upsertNote(newNote);

  return [cleanNote.id]
}

async function splitIntoNotes(text, fileDateValue, coda, parseType) {
  const buffer = [];
  let emptyLineCount = 0;
  let lineMatch;
  const linePatt = /^(.*)(\r\n|\n|\r)/gm;
  const emptyLinePatt = /^\s*$/;
  const ids = [];
  let lastLastIndex = 0;

  while ((lineMatch = linePatt.exec(text)) !== null) {
    if (emptyLinePatt.test(lineMatch[1])) {
      ++emptyLineCount;
    } else {
      if (emptyLineCount >= 3) {
        // non-blank line after 3 blank, so forms note from previous
        try {
          const note = linesToNote(buffer, fileDateValue--, coda, parseType);
          const cleanNote = await upsertNote(note);
          ids.push(cleanNote.id);
        } catch (err) {
          console.error(err);
          if (err.name !== 'QuietError') {
            window.postMessage({
              kind: 'TRANSIENT_MSG',
              message: err.userMsg || err.message,
              key: coda
            }, window?.location?.origin);
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

  let lastLine;
  if ((lastLine = text.slice(lastLastIndex))) {   // file doesn't end with newline
    if (!emptyLinePatt.test(lastLine)) {   // not blank
      buffer.push(lastLine);
    }
  }
  if (buffer.length > 0) {   // forms one last note
    try {
      const note = linesToNote(buffer, fileDateValue--, coda, parseType);
      const cleanNote = await upsertNote(note);
      ids.push(cleanNote.id);
    } catch (err) {
      console.error(err);
      if (err.name !== 'QuietError') {
        window.postMessage({
          kind: 'TRANSIENT_MSG',
          message: err.userMsg || err.message,
          key: coda
        }, window?.location?.origin);
      }
    }
  }

  return ids;
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
function linesToNote(lines, noteDefaultDateValue, coda, parseType) {
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
  if (noteChars > 600000) {
    throw new Error(`Divide “${coda}” manually before importing.`);
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
    content += '\n\n' + coda;
  }
  return createMemoryNote(null, content, new Date(dateValue), parseType);
}


/** Throwable, but should not be reported to the user */
function QuietError(message) {
  this.message = message;
}

QuietError.prototype = Object.create(Error.prototype);
QuietError.prototype.name = "QuietError";


export {allowedFileTypesNonText, checkForMarkdown, importMultipleNotes};
