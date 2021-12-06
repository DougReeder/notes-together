// FileImport.js - file import dialog & functions
// Copyright © 2021 Doug Reeder

import {extractUserMessage} from "./util/extractUserMessage";
import {
  AppBar,
  Button, Checkbox, CircularProgress,
  Dialog,
  IconButton,
  Table, TableBody, TableCell,
  TableHead,
  TableRow,
  Toolbar,
  Typography
} from "@material-ui/core";
import hasTagsLikeHtml from "./util/hasTagsLikeHtml";
import React, {useEffect, useRef, useState} from "react";
import PropTypes from 'prop-types';
import CloseIcon from '@material-ui/icons/Close';
import {isLikelyMarkdown} from "./util";
import {createMemoryNote} from "./Note";
import {upsertNote} from "./storage";

function FileImport({files, isMultiple, doCloseImport}) {
  const [imports, setImports] = useState([]);
  const importPhase = useRef('');   // PREPARING, ACTIVE, or DONE
  const numNotesCreated = useRef(0);
  const lastSuccessfulFileName = useRef("");

  useEffect(() => {
    async function determineParseTypes(files) {
      const newImports = [];
      for (const file of files) {
        try {
          newImports.push(await determineParseType(file));
        } catch (err) {
          let message;
          if (['NotFoundError', 'NotReadableError'].includes(err.name)) {   // Firefox, Safari
            message = "Ask your administrator for permission to read this.";
          } else {
            message = extractUserMessage(err);
          }
          newImports.push({file, message});
        }
      }
      importPhase.current = 'PREPARING';
      lastSuccessfulFileName.current = "";
      setImports(newImports);
      numNotesCreated.current = 0;
    }
    determineParseTypes(files)
  }, [files]);

  async function determineParseType(file) {
    // console.log(`selected file “${file.name}” "${file.type}"`)
    // TODO: Convert a JPEG to data URL
    const extMatch = /\.[^.]+$/.exec(file.name);
    const extension = extMatch?.[0]?.toLowerCase();
    if (hasTagsLikeHtml(file.type, extension)) {
      return {file, parseType: 'text/html'};
    } else {
      if (!file.type.startsWith('text') &&
          !allowedFileTypesNonText.includes(file.type) &&
          !(!file.type && allowedExtensions.includes(extension))) {
        console.error(`Not importable: “${file.name}” "${file.type}"`);
        return {file, parseType: file.type, message: "Not importable. Open in appropriate app & copy."};
      }

      const result = /\/([^;]+)/.exec(file.type);
      switch (result?.[1]) {
        case 'markdown':
          return {file, parseType: 'text/markdown'};
        case 'plain':
          const isMarkdown = await checkForMarkdown(file);
          // console.log(`text file "${file.name}"; likely Markdown ${isMarkdown}`);
          return {file, parseType: 'text/plain', isMarkdown};
        case 'rtf':
        case 'xml':
        case 'svg+xml':
        case 'x-uuencode':
          console.error(`Not importable: “${file.name}” "${file.type}"`);
          return {file, parseType: file.type, message: "Not importable. Open in appropriate app & copy."};
        default:
          return {file, parseType: 'text/' + (result?.[1] || extension.slice(1) || 'plain')};
      }
    }
  }

  function handleToggleMarkdown(i, evt, isMarkdown) {
    imports[i].isMarkdown = isMarkdown;
    setImports(imports.slice(0));
  }

  async function handleImportOrCancel() {
    if ('ACTIVE' === importPhase.current) {
      importPhase.current = 'DONE';   // cancel
      setImports([...imports]);   // forces render
      return;
    }

    importPhase.current = 'ACTIVE';
    for (const record of imports) {
      try {
        if ('message' in record) {
          continue;
        }
        let {file, parseType, isMarkdown} = record;
        record.isImporting = true
        setImports([...imports]);
        if ('text/plain' === file.type && isMarkdown) {
          // console.log(`changing parseType of "${file.name}" to Markdown`)
          parseType = 'text/markdown';
        }
        const {noteIds, message} = await importFromFile(file, parseType, isMultiple);
        record.message = message;
        numNotesCreated.current += noteIds.length
        if (noteIds.length > 0) {
          lastSuccessfulFileName.current = file.name;
        }
      } catch (err) {
        record.message = extractUserMessage(err);
      } finally {
        record.isImporting = false
        setImports([...imports]);
        if ('ACTIVE' !== importPhase.current) {
          break;
        }
      }
    }
    importPhase.current = 'DONE';
    setImports([...imports]);   // forces render
  }

  let dialogTitle;
  if ('DONE' === importPhase.current) {
    dialogTitle = 1 === numNotesCreated.current ?
        "Imported 1 Note" :
        `Imported ${numNotesCreated.current} Notes`;
  } else {   // PREPARING or ACTIVE
    if (isMultiple) {
      if (window.innerWidth >= 430) {
        dialogTitle = "Importing Multiple Notes/File";
      } else if (window.innerWidth >= 380) {
        dialogTitle = "Import. Multiple Notes/File";
      } else {
        dialogTitle = "Imp. Mult. Notes/File";
      }
    } else {
      dialogTitle = 1 === imports.length ?
          "Importing 1 File" :
          `Importing ${imports.length} Files`;
    }
  }

  return (
      <Dialog fullScreen open={files.length > 0} aria-labelledby="import-title">
        <AppBar style={{position: 'sticky'}}>
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={doCloseImport.bind(this, lastSuccessfulFileName.current)} aria-label="Close" >
              <CloseIcon />
            </IconButton>
            <Typography id="import-title" sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              {dialogTitle}
            </Typography>
            <Button autoFocus disabled={'DONE' === importPhase.current} color="inherit" onClick={handleImportOrCancel}>
              {'PREPARING' === importPhase.current ? "Import" : "Cancel"}
            </Button>
          </Toolbar>
        </AppBar>
        <Table size="small" style={{maxWidth: '80em', marginLeft: 'auto',
          marginRight: 'auto'}}>
          <TableHead>
            <TableRow>
              <TableCell><strong>File Name</strong></TableCell>
              <TableCell><strong>Contains Markdown</strong></TableCell>
              <TableCell><strong>Result</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {imports.map(({file, parseType, isMarkdown, isImporting, message}, i) => (<TableRow key={i}>
              <TableCell>{file.name}</TableCell>
              <TableCell>{
                ('text/plain' === parseType && <Checkbox checked={isMarkdown} disabled={Boolean(message)} onChange={handleToggleMarkdown.bind(this, i)} />) ||
                ('text/markdown' === parseType && <Checkbox checked={true} disabled={true}/>)
              }</TableCell>
              <TableCell>{message || (isImporting && <CircularProgress size="2ex" />)}</TableCell>
            </TableRow>))}
          </TableBody>
        </Table>
      </Dialog>
  );
}

FileImport.propTypes = {
  files: PropTypes.oneOfType([
    PropTypes.array,   // testing
    PropTypes.instanceOf(FileList)   // browser
  ]).isRequired,
  isMultiple: PropTypes.bool,
  doCloseImport: PropTypes.func.isRequired,
}


const allowedFileTypesNonText = ['application/xhtml+xml','application/mathml+xml','application/javascript', 'application/ecmascript','application/x-yaml','application/json', 'message/rfc822','image/svg+xml'];

const allowedExtensions = ['.rst', '.txt', '.text', '.readme', '.me', '.1st', '.log', '.markdown', '.md', '.mkd', '.mkdn', '.mdown', '.markdown', '.adoc', '.textile', '.rst', '.etx', '.org', '.apt', '.pod', '.html', '.htm', '.xhtml', '.php', '.jsp', '.asp', '.mustache', '.hbs', '.erb', '.njk', '.ejs', '.mustache', '.haml', '.pug', '.erb', '.json', '.yaml', '.yml', '.awk', '.vcs', '.ics', '.abc', '.js', '.ts', '.jsx', '.css', '.less', '.sass', '.m', '.java', '.properties', '.sql', '.c', '.h', '.cc', '.cxx', '.cpp', '.hpp', '.py', '.rb', '.pm', '.erl', '.hs', '.hbx', '.sh', '.csh', '.bat', '.inf', '.ni'];

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

function importFromFile(file, parseType, isMultiple) {
  // console.log(`importFromFile "${file.name}" ${parseType}`);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async evt => {
      try {
        const text = evt.target.result;
        // console.log('onload', '“' + text.slice(0, 100) + '...”');
        const coda = file.name;   // TODO: remove file extension

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
        console.info(`finished importing ${response.noteIds.length} ${parseType} notes from "${file.name}"`, response.messages);

        const msgs = response.messages || [];
        if (response.noteIds.length > 1) {
          msgs.unshift(`${response.noteIds.length} notes`);
        } else if (1 === response.noteIds.length) {
          msgs.unshift("1 note");
        } else if (0 === msgs.length) {   // 0 === response.noteIds.length
          msgs.unshift("No notes");
        }
        resolve({noteIds: response.noteIds, message: msgs.join("; ")});
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
  try {
    if (/^\s*$/.test(html)) {
      return {noteIds: [], messages: []};
    }
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
    return {noteIds: [cleanNote.id], messages: []};
  } catch (err) {
    let messages = [];
    if ('/properties/content/maxLength' === err?.error?.schemaPath) {
      messages.push("Too long. Copy the parts you need.");
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
          const note = linesToNote(buffer, fileDateValue--, coda, parseType);
          const cleanNote = await upsertNote(note);
          noteIds.push(cleanNote.id);
        } catch (err) {
          console.error(err);
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
      const note = linesToNote(buffer, fileDateValue--, coda, parseType);
      const cleanNote = await upsertNote(note);
      noteIds.push(cleanNote.id);
    } catch (err) {
      console.error(err);
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
  if (noteChars > ('text/plain' === parseType ? 60_000 : 600_000)) {
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
    content += '\n\n' + coda;
  }
  return createMemoryNote(null, content, new Date(dateValue), parseType);
}

async function importText(text, fileDateValue, coda, parseType) {
  try {
    if (/^\s*$/.test(text)) {
      return {noteIds: [], messages: []};
    }
    if (coda) {
      text += '\n\n' + coda;
    }
    const newNote = createMemoryNote(null, text, fileDateValue, parseType);

    const cleanNote = await upsertNote(newNote);

    return {noteIds: [cleanNote.id], messages: []};
  } catch (err) {
    let messages = [];
    if ('/properties/content/maxLength' === err?.error?.schemaPath) {
      messages.push("Too long. Copy the parts you need.");
    } else {
      messages.push(extractUserMessage(err));
    }
    return {noteIds: [], messages}
  }
}

/** Throwable, but should not be reported to the user */
function QuietError(message) {
  this.message = message;
}

QuietError.prototype = Object.create(Error.prototype);
QuietError.prototype.name = "QuietError";


export default FileImport;
export {allowedFileTypesNonText, allowedExtensions, checkForMarkdown, importFromFile};
