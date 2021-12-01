import {createMemoryNote} from './Note';
import {init, upsertNote, parseWords, deleteNote} from './storage';
import {findFillerNoteIds} from './idbNotes';
import React, {useState, useEffect, useRef, useCallback} from 'react';
import List from './List';
import Detail from './Detail'
import './App.css';
import {
  Button,
  Checkbox, CircularProgress,
  Dialog, DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  IconButton,
  Menu,
  MenuItem,
  Snackbar, Table, TableBody, TableCell, TableHead, TableRow
} from "@material-ui/core";
import {makeStyles} from '@material-ui/core/styles';
import Slide from '@material-ui/core/Slide';
import AddIcon from '@material-ui/icons/Add';
import MenuIcon from '@material-ui/icons/Menu';
import {allowedFileTypesNonText, checkForMarkdown, importMultipleNotes} from "./importFromFile";
import {Alert, AlertTitle} from "@material-ui/lab";
import {useSnackbar} from "notistack";
import {randomNote, seedNotes, hammerStorage} from "./fillerNotes";
import Widget from "remotestorage-widget";
import hasTagsLikeHtml from "./util/hasTagsLikeHtml";

const useStyles = makeStyles((theme) => ({
  root: {
    '& > *': {
      margin: theme.spacing(1),
    },
  },
  fab: {
    position: 'absolute',
    right: '0.75rem',
    bottom: '0.75rem',
  },
}));

function App() {
  // TODO: replace string with set of normalized search terms
  const [searchStr, setSearchStr] = useState("");
  const [searchWords, setSearchWords] = useState(new Set());
  const onSearchChange = evt => {
    setSearchStr(evt.target.value);
    setSearchWords(parseWords(evt.target.value));
  }

  const [count, setCount] = useState(" ");
  const changeCount = (value, isPartial) => setCount(isPartial ? ">" + value : String(value));

  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const handleSelect = useCallback((id, showDetail) => {
    setSelectedNoteId(id);
    if (showDetail) {
      setMustShowPanel('DETAIL');
    }
  }, []);

  const focusOnLoad = useRef(false);   // no re-render when changed
  async function addNote() {
    try {
      const initialText = searchStr.trim() ? `<p></p><p>${searchStr.trim()} </p>` : "";
      const newNote = createMemoryNote(null, initialText, null, 'text/html;hint=SEMANTIC');
      // console.log("adding note:", newNote);
      await upsertNote(newNote);
      setMustShowPanel('DETAIL');
      focusOnLoad.current = true;
      setSelectedNoteId(newNote.id);
    } catch (err) {
      setTransientErr(err);
    }
  }
  const clearFocusOnLoad = useCallback(() => {
    focusOnLoad.current = false;   // reference, so doesn't cause re-render
  }, []);

  // LIST or DETAIL
  const [mustShowPanel, setMustShowPanel] = useState('LIST');

  const {enqueueSnackbar} = useSnackbar();

  const externalChangeListener = evt => {
    if (evt.origin !== window.location.origin) return;

    switch (evt.data?.kind) {   // eslint-disable-line default-case
      case 'NOTE_CHANGE':
        const notesDeleted = evt.data?.notesDeleted || {};
        if (notesDeleted.hasOwnProperty(selectedNoteId)) {
          console.log("selected note deleted", notesDeleted);
          setSelectedNoteId(null);
        }
        break;
      case 'TRANSIENT_MSG':
        enqueueSnackbar(evt.data?.message || "Restart your device", {
          anchorOrigin: {horizontal: 'right', vertical: 'bottom'},
          variant: evt.data?.severity || 'error',
          key: evt.data?.key,
          TransitionComponent: Slide,
        });
        break;
    }
  }
  useEffect( () => {
    window.addEventListener("message", externalChangeListener);

    return function removeExternalChangeListener() {
      window.removeEventListener("message", externalChangeListener);
    };
  });

  useEffect( () => {
    init().then(remoteStorage => {   // init is idempotent
      console.log("remoteStorage displaying login widget");
      const widget = new Widget(remoteStorage);
      widget.attach('panelMain');   // login
    });
   }, []);

  const keyListener = useCallback(evt => {
    if (evt.isComposing || evt.keyCode === 229) {
      return;
    }
    if ('Escape' === evt.code) {
      if (evt.target.dataset.slateEditor) {
        evt.target.blur();
      } else if (window.innerWidth < 640 && 'DETAIL' === mustShowPanel) {
        setMustShowPanel('LIST');
      } else {
        setSearchStr("");
        setSearchWords(new Set());
      }
    }
    if (evt.target.dataset.slateEditor) {
      return;
    }
    switch (evt.code) {   // eslint-disable-line default-case
      case 'ArrowRight':
        if ('LIST' === mustShowPanel) {
          setMustShowPanel('DETAIL');
        }
        break;
      case 'ArrowLeft':
        if ('DETAIL' === mustShowPanel) {
          setMustShowPanel('LIST');
        }
        break;
      // default:
      //   console.log("App keyListener:", evt.code, evt.target, mustShowPanel)
    }
  }, [mustShowPanel]);
  useEffect(() => {
    document.addEventListener('keydown', keyListener);

    return function removeKeyListener(){
      document.removeEventListener('keydown', keyListener);
    }
  }, [keyListener]);


  const [appMenuAnchorEl, setAppMenuAnchorEl] = useState(false);

  function openAppMenu(evt) {
    setAppMenuAnchorEl(evt.currentTarget);
  }

  const fileInput = useRef(null)
  const [importFiles, setImportFiles] = useState([]);
  const isImportActive = useRef(false);

  function handleImportFile(evt) {
    fileInput.current.click();
    setAppMenuAnchorEl(null);
  }

  async function fileChange(evt) {
    try {
      if (evt.target.files.length > 0) {
        await determineParseTypes(evt.target.files);
      } else {
        console.warn("no files selected");
      }
    } catch (err) {
      console.error("while importing multiple notes:", err);
      setTransientErr(err);
    }
  }

  function preventDefault(evt) {
    evt.stopPropagation();
    evt.preventDefault();
  }

  async function handleDrop(evt) {
    try {
      evt.stopPropagation();
      evt.preventDefault();

      if (evt.dataTransfer.files.length > 0) {
        await determineParseTypes(evt.dataTransfer.files);
      } else {
        window.postMessage({kind: 'TRANSIENT_MSG', message: "Try dragging that to the editor panel", severity: 'warning'}, window?.location?.origin);
      }
    } catch (err) {
      console.error("while dropping file:", err);
      setTransientErr(err);
    }
  }

  async function determineParseTypes(files) {
    const newImportFiles = importFiles.slice(0);
    for (const file of files) {
      try {
        newImportFiles.push(await determineParseType(file));
      } catch (err) {
        let message;
        if (['NotFoundError', 'NotReadableError'].includes(err.name)) {   // Firefox, Safari
          message = `“${file.name}” is not readable`;
        } else {
          message = err.userMsg || err.message;
        }
        window.postMessage({kind: 'TRANSIENT_MSG', message: message, severity: 'warning', key: file.name}, window?.location?.origin);
      }
    }
    setImportFiles(newImportFiles);
  }

  async function determineParseType(file) {
    console.log(`file “${file.name}” "${file.type}"`)
    // TODO: Convert a JPEG to data URL
    if (!file.type.startsWith('text') && !allowedFileTypesNonText.includes(file.type)) {
      const err = new Error("Wrong type for import: " + file.type);
      err.userMsg = `Try opening “${file.name}” with an appropriate app, and copying from there.`
      throw err;
    }

    if (hasTagsLikeHtml(file.type)) {
      return {file, parseType: 'text/html'};
    } else {
      const result = /\/([^;]+)/.exec(file.type);
      switch (result?.[1]) {
        case 'markdown':
          return {file, parseType: 'text/markdown'};
        case 'plain':
          const isMarkdown = await checkForMarkdown(file);
          console.log(`text file "${file.name}"; likely Markdown ${isMarkdown}`);
          return {file, parseType: 'text/plain', isMarkdown};
        default:
          return {file, parseType: 'text/' + (result?.[1] || 'plain')};
      }
    }
  }

  function handleToggleMarkdown(i, evt, isMarkdown) {
    importFiles[i].isMarkdown = isMarkdown;
    setImportFiles(importFiles.slice(0));
  }

  function cancelImport() {
    console.info(`cancelled import of ${importFiles.length} files`);
    isImportActive.current = false;
    setImportFiles([]);
  }

  async function doImport() {
    let lastSuccessfulFileName = "";
    isImportActive.current = true;
    for (const record of importFiles) {
      try {
        let {file, parseType, isMarkdown} = record;
        record.isImporting = true
        setImportFiles([...importFiles]);
        if ('text/plain' === file.type && isMarkdown) {
          console.log(`changing parseType of "${file.name}" to Markdown`)
          parseType = 'text/markdown';
        }
        const newNoteIds = await importMultipleNotes(file, parseType);
        let message;
        if (newNoteIds.length > 1) {
          lastSuccessfulFileName = file.name;
          message = `Imported ${newNoteIds.length} notes from “${file.name}”`;
        } else if (newNoteIds.length === 1) {
          lastSuccessfulFileName = file.name;
          message = `Imported 1 note from “${file.name}”`;
        } else {
          message = `“${file.name}” is empty. Are your notes in a different file?`;
        }
        window.postMessage({
          kind: 'TRANSIENT_MSG',
          message,
          severity: newNoteIds.length > 0 ? 'success' : 'warning',
          key: file.name
        }, window?.location?.origin);
      } catch (err) {
        window.postMessage({kind: 'TRANSIENT_MSG', message: err.userMsg || err.message}, window?.location?.origin);
      } finally {
        if (isImportActive.current) {
          record.isImporting = false
          setImportFiles([...importFiles]);
        } else {
          break;
        }
      }
    }
    isImportActive.current = false;
    setImportFiles([]);
    if (lastSuccessfulFileName) {
      setSearchStr(lastSuccessfulFileName);
      setSearchWords(parseWords(lastSuccessfulFileName));
    }
  }

  const [testMenuAnchorEl, setTestMenuAnchorEl] = React.useState(null);

  function openTestMenu(evt) {
    setTestMenuAnchorEl(evt.currentTarget);
  }
  function closeTestMenu() {
    setTestMenuAnchorEl(null);
  }

  async function handleAddSeedNotes() {
    try {
      setTestMenuAnchorEl(null);
      await seedNotes();
    } catch (err) {
      setTransientErr(err);
    }
  }

  async function handleAddMovieNotes() {
    try {
      setTestMenuAnchorEl(null);
      for (let i = 0; i < 100; ++i) {
        await randomNote();
      }
    } catch (err) {
      setTransientErr(err);
    }
  }

  async function handleHammer() {
    try {
      setTestMenuAnchorEl(null);
      await hammerStorage();
    } catch (err) {
      setTransientErr(err);
    }
  }

  async function handleDeleteFillerNotes() {
    try {
      setTestMenuAnchorEl(null);
      for (const noteId of await findFillerNoteIds()) {
        await deleteNote(noteId);
      }
    } catch (err) {
      setTransientErr(err);
    }
  }

  const [transientErr, setTransientErr] = useState(null);

  function handleSnackbarClose(evt) {
    setTransientErr(null);
  }

  const classes = useStyles();

  return (
      <div className={'LIST' === mustShowPanel ? "App panelContainer" : "App panelContainer right"} role="application">
        <div className="panel panelMain" id="panelMain" onDragEnter={preventDefault} onDragOver={preventDefault} onDrop={handleDrop}>
          <header className="App-header">
            <input type="search" placeholder="Enter search word(s)"
                   title="Enter the first several letters of one or more search words." aria-label="search notes" value={searchStr} onChange={onSearchChange} role="search" />
            <div className="count" draggable="true" onDragStart={openTestMenu} >{count}</div>
            <Menu
                id="testMenu"
                anchorEl={testMenuAnchorEl}
                open={Boolean(testMenuAnchorEl)}
                onClose={closeTestMenu}
            >
              <MenuItem onClick={handleAddSeedNotes}>Add Seed Notes</MenuItem>
              <MenuItem onClick={handleAddMovieNotes}>Add 100 Movie Notes</MenuItem>
              <MenuItem onClick={handleHammer}>Hammer Storage</MenuItem>
              <MenuItem onClick={handleDeleteFillerNotes}>Delete Filler Notes</MenuItem>
            </Menu>
            <IconButton aria-label="Application menu" onClick={openAppMenu}>
              <MenuIcon />
            </IconButton>
            <Menu id="appMenu" anchorEl={appMenuAnchorEl} open={Boolean(appMenuAnchorEl)} onClose={setAppMenuAnchorEl.bind(this,null)} >
              {/*<MenuItem>Preferences & Help</MenuItem>*/}
              <MenuItem onClick={handleImportFile}>Import multiple notes per text, Markdown or HTML file</MenuItem>
            </Menu>
            <input id="fileInput" type="file" hidden={true} ref={fileInput} onChange={fileChange} multiple={true}
                   accept={"text/plain,text/markdown,text/html,text/csv,text/tab-separated-values,text/troff,text/vcard,text/rtf,text/xml," + allowedFileTypesNonText.join(',') + ",txt,text,readme,me,1st,log,markdown,md,mkd,mkdn,mdown,markdown,adoc,textile,rst,textile,etx,tex,texi,org,apt,pod,html,htm,xhtml,json,yaml,yml,awk,vcs,ics,abc,js,ts,jsx,css,less,sass,java,properties,sql,c,h,cc,cxx,cpp,hpp,py,rb,pm,erl,hs,hbx,sh,bat"}/>
          </header>
          <List searchWords={searchWords} changeCount={changeCount} selectedNoteId={selectedNoteId} handleSelect={handleSelect} setTransientErr={setTransientErr}></List>
          <Fab onClick={addNote} className={classes.fab} color="primary" aria-label="add"><AddIcon /></Fab>
          <Snackbar open={Boolean(transientErr)} autoHideDuration={6000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
            <Alert onClose={handleSnackbarClose} severity="error">
              <AlertTitle>{transientErr?.userMsg || "Restart your device"}</AlertTitle>
              {transientErr?.message || transientErr?.name || transientErr?.toString()}
            </Alert>
          </Snackbar>
          <Dialog open={importFiles.length > 0} aria-labelledby="import-markdown-dialog-title">
            <DialogTitle id="import-markdown-dialog-title">Importing {importFiles.length} Files</DialogTitle>
            <DialogContent>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>File Name</strong></TableCell>
                    <TableCell><strong>Contains Markdown</strong></TableCell>
                    <TableCell style={{width: '2ex'}}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {importFiles.map(({file, parseType, isMarkdown, isImporting}, i) => (<TableRow key={i}>
                    <TableCell>{file.name}</TableCell>
                    <TableCell>{
                      ('text/plain' === parseType && <Checkbox checked={isMarkdown} onChange={handleToggleMarkdown.bind(this, i)} />) ||
                      ('text/markdown' === parseType && <Checkbox checked={true} disabled={true}/>)
                    }</TableCell>
                    <TableCell>{isImporting ? <CircularProgress size="2ex" /> : "   "}</TableCell>
                  </TableRow>))}
                </TableBody>
              </Table>
            </DialogContent>
            <DialogActions>
              <Button onClick={cancelImport}>
                Cancel
              </Button>
              <Button disabled={isImportActive.current} onClick={doImport}>
                Import
              </Button>
            </DialogActions>
          </Dialog>
        </div>
        <div className="panel panelDetail">
          <Detail noteId={selectedNoteId} searchStr={searchStr} focusOnLoadCB={focusOnLoad.current ? clearFocusOnLoad : null} setMustShowPanel={setMustShowPanel}></Detail>
        </div>
      </div>
  );
}

export default App;
