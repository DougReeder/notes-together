// FileImport.js - file import dialog & functions
// Copyright © 2021-2024 Doug Reeder

import {extractUserMessage, transientMsg} from "./util/extractUserMessage";
import {
  AppBar,
  Button, CircularProgress,
  Dialog,
  IconButton,
  Table, TableBody, TableCell,
  TableHead,
  TableRow,
  Toolbar,
  Typography
} from "@mui/material";
import Checkbox from "@mui/material/Checkbox";
import hasTagsLikeHtml from "./util/hasTagsLikeHtml";
import {useCallback, useEffect, useRef, useState} from "react";
import PropTypes from 'prop-types';
import CloseIcon from '@mui/icons-material/Close';
import {isLikelyMarkdown} from "./util";
import {upsertNote} from "./storage";
import {imageFileToDataUrl} from "./util/imageFileToDataUrl";
import {deserializeNote} from "./serializeNote.js";
import {CONTENT_MAX} from "./Note.js";
import QuietError from "./util/QuietError.js";

function FileImport({files, isMultiple, doCloseImport}) {
  const [imports, setImports] = useState([]);
  const [isMarkdownColumnShown, setIsMarkdownColumnShown] = useState(true);
  const [skipReview, setSkipReview] = useState(false);
  const importPhase = useRef('');   // PREPARING, ACTIVE, or DONE
  const numNotesCreated = useRef(0);
  const lastSuccessfulFileName = useRef("");
  const importBtnRef = useRef();

  useEffect(() => {
    if (files.length > 0) {
      console.group(`Importing ${files.length} file(s)`);
    }

    async function determineParseTypes(files) {
      let isMarkdownColumnRequired = false;
      let isReviewRequired = false;
      const newImports = [];
      for (const file of files) {
        try {
          const importMetadata = await determineParseType(file);
          newImports.push(importMetadata);
          if (['text/markdown', 'text/plain'].includes(importMetadata.parseType)) {
            isMarkdownColumnRequired = true;
          }
          if ('text/plain' === importMetadata.parseType || importMetadata.message) {
            isReviewRequired = true;
          }
        } catch (err) {   // typically an unreadable text file
          isMarkdownColumnRequired = true;
          isReviewRequired = true;
          let message;
          if (['NotFoundError', 'NotReadableError'].includes(err.name)) {   // Firefox, Safari
            console.error(`File not readable: “${file.name}” (${file.type})`);
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

      setIsMarkdownColumnShown(isMarkdownColumnRequired);
      if (!isReviewRequired) {
        setSkipReview(true);
      }
    }
    determineParseTypes(files).catch(err => {
      console.error("while determining parse types:", err);
      transientMsg("Import those files one by one.");
    });

    return () => {   // cleanup
      if (files.length > 0) {   // files.length is the old value
        console.groupEnd();
      }
    };
  }, [files]);

  useEffect(() => {
    if ('PREPARING' === importPhase.current && skipReview) {
      console.log("clicking import button for user")
      importBtnRef.current?.click();
    }
  }, [skipReview]);

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
        const {noteIds, message, coda} = await importFromFile(file, parseType, isMultiple);
        record.message = message;
        numNotesCreated.current += noteIds.length
        if (noteIds.length > 0 && coda) {
          lastSuccessfulFileName.current = coda;
        }
      } catch (err) {
        record.message = extractUserMessage(err);
      } finally {
        record.isImporting = false
        setImports([...imports]);
        if ('ACTIVE' !== importPhase.current) {
          break;   // eslint-disable-line no-unsafe-finally
        }
      }
    }
    importPhase.current = 'DONE';
    setImports([...imports]);   // forces render
  }

  const keyListener = useCallback(evt => {
    if (evt.isComposing || evt.keyCode === 229) {
      return;
    }
    if ('Escape' === evt.code) {
      doCloseImport(lastSuccessfulFileName.current);
    }
  }, [doCloseImport]);

  const fileDlgRef = useRef();
  useEffect(() => {
    const fileDlg = fileDlgRef.current;
    fileDlg?.addEventListener('keydown', keyListener);

    return function removeKeyListener() {
      fileDlg?.removeEventListener('keydown', keyListener);
    }
  }, [fileDlgRef.current, keyListener]); // eslint-disable-line react-hooks/exhaustive-deps

  let dialogTitle;
  if ('DONE' === importPhase.current) {
    dialogTitle = 1 === numNotesCreated.current ?
      "Imported 1 Note" :
      `Imported ${numNotesCreated.current} Notes`;
  } else if ('ACTIVE' === importPhase.current) {
    dialogTitle = "Importing...";
  } else {   // PREPARING
    if (isMultiple) {
      if (window.innerWidth >= 490) {
        dialogTitle = "Review Import (Multiple Notes/File)";
      } else {
        dialogTitle = "Review Import";
      }
    } else {
      if (window.innerWidth >= 450) {
        dialogTitle = "Review Import (One Note/File)";
      } else {
        dialogTitle = "Review Import";
      }
    }
  }

  return (
    <Dialog ref={fileDlgRef} fullScreen open={files.length > 0} aria-labelledby="import-title">
      <AppBar>
        <Toolbar>
          <IconButton edge="start" color="inherit"
                      title="Close" size="large"
                      onClick={doCloseImport.bind(this, lastSuccessfulFileName.current)}>
            <CloseIcon />
          </IconButton>
          <Typography id="import-title" sx={{ ml: 2, flex: "0 0 auto" }} variant="h6">
            {dialogTitle}
          </Typography>
          <Button ref={importBtnRef} variant="contained" color="secondary" disabled={'DONE' === importPhase.current} style={{marginRight: '1ch', backgroundColorX: '#e0e0e0', colorX: 'black'}} onClick={handleImportOrCancel}>
            {'PREPARING' === importPhase.current ? "Import" : "Cancel"}
          </Button>
        </Toolbar>
      </AppBar>
      <Table size="small" style={{maxWidth: '80em', marginLeft: 'auto',
        marginRight: 'auto'}}>
        <TableHead>
          <TableRow>
            <TableCell><strong>File Name</strong></TableCell>
            {isMarkdownColumnShown && <TableCell><strong>Contains Markdown</strong></TableCell>}
            <TableCell><strong>Result</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {imports.map(({file, parseType, isMarkdown, isImporting, message}, i) => (<TableRow key={i}>
            <TableCell>{file.name}</TableCell>
            {isMarkdownColumnShown && <TableCell>{
              ('text/plain' === parseType && <Checkbox checked={isMarkdown} disabled={Boolean(message)} onChange={handleToggleMarkdown.bind(this, i)} />) ||
              ('text/markdown' === parseType && <Checkbox checked={true} disabled={true}/>)
            }</TableCell>}
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


const allowedFileTypesNonText = ['application/mathml+xml','application/xhtml+xml','image/svg+xml', 'application/yaml','application/x-yaml', 'application/json', 'application/ld+json', 'application/sql','application/javascript', 'application/x-javascript', 'application/ecmascript','message/rfc822','message/global', 'application/mbox', 'application/x-shellscript', 'application/x-sh', 'application/x-csh', 'application/x-tex', 'application/x-troff', 'application/x-info', 'application/vnd.uri-map', 'application/mathematica', 'application/vnd.dart', 'application/x-httpd-php'];

const allowedExtensions = ['.txt', '.text', '.readme', '.me', '.1st', '.plain', '.ascii', '.log', '.markdown', '.md', '.mkd', '.mkdn', '.mdown', '.markdown', '.adoc', '.textile', '.rst', '.etx', '.org', '.apt', '.pod', '.html', '.htm', '.xhtml', '.mml', '.mathml', '.msg', '.eml', '.mbox', '.tex', '.t', '.php', '.jsp', '.asp', '.mustache', '.hbs', '.erb', '.njk', '.ejs', '.haml', '.pug', '.erb', '.webc', '.liquid', '.xo', '.json', '.yaml', '.yml', '.awk', '.vcs', '.ics', '.abc', '.js', '.ts', '.jsx', '.css', '.less', '.sass', '.glsl', '.webmanifest', '.m', '.java', '.properties', '.groovy', '.gvy', '.gy', '.gsh', '.el', '.sql', '.c', '.h', '.pch', '.cc', '.cxx', '.cpp', '.hpp', '.strings', '.p', '.py', '.rb', '.pm', '.dart', '.erl', '.hs', '.wat', '.asm', '.rcp', '.diff', '.make', '.mak', '.mk', '.nmk', '.cmake', '.snap', '.hbx', '.sh', '.bash', '.csh', '.bat', '.inf', '.ni', '.gradle', '.ldif', '.url', '.uri', '.uris', '.urim', '.urimap', '.meta', '.mtl', '.obj', '.gltf', '.service', '.toml'];

// The file filter allows all text/* types
const unsupportedTextSubtypes = ['rtf', 'xml', 'xml-external-parsed-entity', 'SGML', 'uuencode'];

async function determineParseType(file) {
  // console.log(`selected file “${file.name}” "${file.type}"`)
  const extMatch = /\.[^.]+$/.exec(file.name);
  const extension = extMatch?.[0]?.toLowerCase();
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

    const subtype = /\/(?:x-|vnd\.|x\.)?([^;]+)/.exec(file.type)?.[1];
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
        html = html.slice(0, endPos) + '<hr /><p><em>' + coda + '</em></p>' + html.slice(endPos);
      } else {
        html += '<hr /><p><em>' + coda + '</em></p>';
      }
    }

    const raw = {mimeType: 'text/html;hint=SEMANTIC', content: html, date: fileDateValue};

    const {id} = await upsertNote(deserializeNote(raw), undefined);
    return {noteIds: [id], messages: []};
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
        text += '\n\n------------------------------\n' + coda;
      } else {
        text += '\n\n' + coda;
      }
    }
    const raw = {mimeType: parseType, content: text, date: fileDateValue};

    const {id} = await upsertNote(deserializeNote(raw), undefined);

    return {noteIds: [id], messages: []};
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


export default FileImport;
export {determineParseType, allowedFileTypesNonText, allowedExtensions, unsupportedTextSubtypes, checkForMarkdown, importFromFile};
