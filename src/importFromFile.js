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
    reader.onload = evt => {
      try {
        const text = evt.target.result;
        console.log('onload', text.slice(0, 100) + '...');
        const lastModified = file.lastModified;
        const coda = file.name;

        let noteIds
        switch (parseType) {
          case 'text/html':
            noteIds = importHtml(text, lastModified, coda);
            break;
          default:
            throw new Error(parseType + " not yet implemented");
        }

        console.log("finished importing", file.name)
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

async function importHtml(html, lastModified, coda) {
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

  const newNote = createMemoryNote(null, html, new Date(lastModified), 'text/html;hint=SEMANTIC');

  const cleanNote = await upsertNote(newNote);

  return [cleanNote.id]
}


export {allowedFileTypesNonText, checkForMarkdown, importMultipleNotes};
