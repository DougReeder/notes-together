import {createMemoryNote} from './Note';
import {init, upsertNote, parseWords, deleteNote} from './storage';
import {findFillerNoteIds} from './idbNotes';
import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {useSearchParams} from "react-router-dom";
import List from './List';
import Detail from './Detail'
import './App.css';
import {
  AppBar,
  Fab,
  IconButton,
  Menu,
  MenuItem,
  Snackbar, Toolbar
} from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import Slide from '@mui/material/Slide';
import AddIcon from '@mui/icons-material/Add';
import MenuIcon from '@mui/icons-material/Menu';
import FileImport, {allowedExtensions, allowedFileTypesNonText} from './FileImport';
import {Alert, AlertTitle} from '@mui/material';
import {useSnackbar} from "notistack";
import {randomNote, seedNotes, hammerStorage} from "./fillerNotes";
import Widget from "remotestorage-widget";
import {visualViewportMatters} from "./util";
import HelpPane from "./HelpPane";
import {Delete, Help} from "@mui/icons-material";

const useStyles = makeStyles((theme) => ({
  appbar: {
    '& input': {
      marginLeft: '1.5ch',
      flex: '1 1 auto',
      minWidth: '10ch',
      fontSize: '18px',
    },
    '& .count': {
      marginLeft: '1.5ch',
      marginRight: '1.5ch',
      minWidth: '3ch',
    }
  },
}));

function App() {
  // TODO: replace string with set of normalized search terms
  const [searchParams, setSearchParams] = useSearchParams();
  const {searchStr, searchWords} = useMemo(() => {
    const searchStr = searchParams.get('words') || "";
    return {searchStr, searchWords: parseWords(searchStr)};
  }, [searchParams]);
  const onSearchChange = evt => {
    setSearchParams(new URLSearchParams({words: evt.target.value}));
  }

  const [count, setCount] = useState(" ");
  const changeCount = (value, isPartial) => setCount(isPartial ? ">" + value : String(value));

  // LIST, DETAIL or HELP
  const [mustShowPanel, setMustShowPanel] = useState('LIST');

  const [selectedNoteId, setSelectedNoteId] = useState(null);

  function handleSelect(id, newPanel) {
    if (id) {
      setSelectedNoteId(id);
    }
    if (newPanel) {
      setMustShowPanel(newPanel);
    } else if (id && 'HELP' === mustShowPanel) {
      setMustShowPanel('DETAIL');
    }
  }

  const focusOnLoad = useRef(false);   // no re-render when changed
  async function addNote() {
    try {
      const initialText = searchStr.trim() ? `<h1></h1><p></p><p><em>${searchStr.trim()}</em></p>` : "<h1></h1><p></p>";
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
          anchorOrigin: {horizontal: 'right', vertical: visualViewportMatters() ? 'top' : 'bottom'},
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
      } else if (window.innerWidth < 641 && 'LIST' !== mustShowPanel) {
        setMustShowPanel('LIST');
      } else {
        setSearchParams(new URLSearchParams());
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
        if ('LIST' !== mustShowPanel) {
          setMustShowPanel('LIST');
        }
        break;
      // default:
      //   console.log("App keyListener:", evt.code, evt.target, mustShowPanel)
    }
  }, [mustShowPanel, setSearchParams]);
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

  function showHelp() {
    setMustShowPanel('HELP');
    setAppMenuAnchorEl(null);
  }

  const fileInput = useRef(null);
  const [importFiles, setImportFiles] = useState([]);
  const [isImportMultiple, setIsImportMultiple] = useState(false);

  function handleImportFileSingle(evt) {
    setIsImportMultiple(false);
    fileInput.current.click();
    setAppMenuAnchorEl(null);
  }

  function handleImportFileMultiple(evt) {
    setIsImportMultiple(true);
    fileInput.current.click();
    setAppMenuAnchorEl(null);
  }

  function fileChange(evt) {
    try {
      if (evt.target.files.length > 0) {
        setImportFiles(evt.target.files);
      } else {
        console.warn("no files selected");
      }
    } catch (err) {
      console.error("while selecting files to import:", err);
      setTransientErr(err);
    }
  }

  function preventDefault(evt) {
    evt.stopPropagation();
    evt.preventDefault();
  }

  function handleDrop(evt) {
    try {
      evt.stopPropagation();
      evt.preventDefault();

      if (evt.dataTransfer.files.length > 0) {
        setImportFiles(evt.dataTransfer.files);
        setIsImportMultiple(false);
      } else {
        window.postMessage({kind: 'TRANSIENT_MSG', message: "Drag that to the editor panel", severity: 'warning'}, window?.location?.origin);
      }
    } catch (err) {
      console.error("while dropping file:", err);
      setTransientErr(err);
    }
  }


  function doCloseImport(lastSuccessfulFileName) {
    // console.log("doCloseImport", lastSuccessfulFileName);
    setImportFiles([]);
    fileInput.current.value = "";
    if (lastSuccessfulFileName) {
      setSearchParams(new URLSearchParams({words: lastSuccessfulFileName}));
    }
  }

  function handleDeleteSelected(evt) {
    if (selectedNoteId) {
      deleteNote(selectedNoteId);
    } else {
      window.postMessage({kind: 'TRANSIENT_MSG', message: "First, select a note!", severity: 'info'}, window?.location?.origin);
    }
    setAppMenuAnchorEl(null);
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
        <AppBar position="sticky" className={classes.appbar}>
          <Toolbar>
            <input type="search" placeholder="Enter search word(s)"
                   title="Enter the first several letters of one or more search words."
                   value={searchStr} onChange={onSearchChange} role="search"/>
            <div className="count" title="Count of matching notes" draggable="true" onDragStart={openTestMenu}>{count}</div>
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
            <IconButton onClick={openAppMenu} title="Open application menu" size="large">
              <MenuIcon/>
            </IconButton>
            <Menu id="appMenu" anchorEl={appMenuAnchorEl} open={Boolean(appMenuAnchorEl)}
                  onClose={setAppMenuAnchorEl.bind(this, null)}>
              <MenuItem onClick={showHelp}>Help &nbsp; <Help/></MenuItem>
              <MenuItem onClick={handleImportFileSingle}>Import one note per file...</MenuItem>
              <MenuItem onClick={handleImportFileMultiple}>Import multiple notes per file...</MenuItem>
              <MenuItem onClick={handleDeleteSelected}>Delete selected note &nbsp; <Delete/></MenuItem>
            </Menu>
            <input id="fileInput" type="file" hidden={true} ref={fileInput} onChange={fileChange} multiple={true}
                   accept={"text/plain,text/markdown,text/html,image/*,text/csv,text/tab-separated-values," + allowedFileTypesNonText.join(',') + ',text/uri-list,text/vcard,text/calendar,text/troff,' + allowedExtensions.join(',')}/>
          </Toolbar>
        </AppBar>
        <div style={{height: '4px', flex: '0 0 auto', backgroundColor: 'white'}}></div>
        <List searchWords={searchWords} changeCount={changeCount} selectedNoteId={selectedNoteId} handleSelect={handleSelect} setTransientErr={setTransientErr}></List>
        <Fab onClick={addNote} color="primary" title="Add note"><AddIcon /></Fab>
        <Snackbar open={Boolean(transientErr)} autoHideDuration={6000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
          <Alert onClose={handleSnackbarClose} severity="error">
            <AlertTitle>{transientErr?.userMsg || "Restart your device"}</AlertTitle>
            {transientErr?.message || transientErr?.name || transientErr?.toString()}
          </Alert>
        </Snackbar>
        <FileImport files={importFiles} isMultiple={isImportMultiple} doCloseImport={doCloseImport} />
      </div>
      <div className="separator"></div>
      <div className="panel panelDetail">
        {'DETAIL' === mustShowPanel ? <Detail noteId={selectedNoteId} searchStr={searchStr}
                                             focusOnLoadCB={focusOnLoad.current ? clearFocusOnLoad : null}
                                             setMustShowPanel={setMustShowPanel}></Detail> :
            <HelpPane setMustShowPanel={setMustShowPanel}></HelpPane>
        }
      </div>
    </div>
  );
}

export default App;
