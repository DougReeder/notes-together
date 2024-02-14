// FileImport.js - file import dialog
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
import {useCallback, useEffect, useRef, useState} from "react";
import PropTypes from 'prop-types';
import CloseIcon from '@mui/icons-material/Close';
import {determineParseType, importFromFile} from "./fileImportUtil.js";

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
        const {noteIds, message} = await importFromFile(file, parseType, isMultiple);
        record.message = message;
        numNotesCreated.current += noteIds.length
        if (noteIds.length > 0 && file.name?.trim()) {
          lastSuccessfulFileName.current = file.name?.trim();
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
                      onClick={_evt => doCloseImport(lastSuccessfulFileName.current)}>
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

export default FileImport;
