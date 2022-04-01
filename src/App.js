import {createMemoryNote} from './Note';
import {
  init,
  upsertNote, deleteNote,
  parseWords,
  checkpointSearch, listSuggestions,
  saveSearch, deleteSavedSearch, listSavedSearches
} from './storage';
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
import {Delete, Help, SavedSearch, SearchOff} from "@mui/icons-material";
import {setEquals} from "./util/setUtil";
import {extractUserMessage} from "./util/extractUserMessage";

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
    if (searchStr.length > 1000) {
      searchStr.length = 1000;
    }
    let searchWords = parseWords(searchStr);
    if (searchWords.size > 10) {
      const wordArr = Array.from(searchWords.values());
      wordArr.sort((a,b) => b.length - a.length);
      searchWords = new Set(wordArr.slice(0, 10));
    }
    return {searchStr, searchWords};
  }, [searchParams]);
  const onSearchChange = evt => {
    setSearchParams(new URLSearchParams({words: evt.target.value?.trimLeft()}));
  }

  const [count, setCount] = useState(" ");
  const changeCount = (value, isPartial) => setCount(isPartial ? ">" + value : String(value));

  // LIST, DETAIL or HELP
  const [mustShowPanel, setMustShowPanel] = useState('LIST');

  const [selectedNoteId, setSelectedNoteId] = useState(null);

  const searchRef = useRef();
  const lastCheckpointRef = useRef(new Set());

  function handleSelect(id, newPanel) {
    if (id) {
      setSelectedNoteId(id);
    }
    if (newPanel) {
      setMustShowPanel(newPanel);
    } else if (id && 'HELP' === mustShowPanel) {
      setMustShowPanel('DETAIL');
    }
    searchRef.current?.blur();
  }

  const focusOnLoad = useRef(false);   // no re-render when changed
  async function addNote() {
    try {
      const initialText = searchStr.trim() ? `<h1></h1><p></p><hr /><p><em>${searchStr.trim()}</em></p>` : "<h1></h1><p></p>";
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
      case 'SAVED_SEARCH_CHANGE':
        combineSavedSearchesWithSuggestions();
        break;
      case 'TRANSIENT_MSG':
        enqueueSnackbar(evt.data?.message || "Restart your device", {
          anchorOrigin: {horizontal: 'right', vertical: visualViewportMatters() ? 'top' : 'bottom'},
          variant: evt.data?.severity || 'error',
          autoHideDuration: ['info', 'success'].includes(evt.data?.severity) ? 3000 : 8000,
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

  const [predefinedSearches, setPredefinedSearches] = useState([]);

  const combineSavedSearchesWithSuggestions = useCallback(async () => {
    const {originalSearches, normalizedSearches} = await listSavedSearches();

    const suggestions = await listSuggestions(100);
    for (const [original, normalized] of suggestions) {
      if (! normalizedSearches.has(normalized)) {
        originalSearches.push(original);
      }
    }
    // console.log("predefined searches:", originalSearches)
    setPredefinedSearches(originalSearches);
  }, []);

  useEffect( () => {
    startup();
    async function startup() {
      const remoteStorage = await init();   // init is idempotent
      console.log("remoteStorage displaying login widget");
      const widget = new Widget(remoteStorage);
      widget.attach('panelMain');   // login

      await combineSavedSearchesWithSuggestions();
     }
   }, [combineSavedSearchesWithSuggestions]);


  const keyListener = useCallback(evt => {
    if (evt.isComposing || evt.keyCode === 229) {
      return;
    }
    if ('Escape' === evt.code) {
      if (evt.target.dataset.slateEditor) {
        evt.target.blur();
      } else if (window.innerWidth < 641 && 'LIST' !== mustShowPanel) {
        setMustShowPanel('LIST');
      } else if (document.activeElement !== searchRef.current) {
        searchRef.current?.focus();
      } else {
        setSearchParams(new URLSearchParams());
      }
    }
    if (evt.target.dataset.slateEditor) {
      return;
    }
    if ('Enter' === evt.code) {
       searchRef.current?.blur();
    }
    if (document.activeElement && document.activeElement !== document.body) {
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


  async function handleSearchBlur() {
    if (! setEquals(searchWords, lastCheckpointRef.current)) {
      await checkpointSearch(searchWords, searchStr);
      await combineSavedSearchesWithSuggestions();
    }
    lastCheckpointRef.current = searchWords;
  }


  const [appMenuAnchorEl, setAppMenuAnchorEl] = useState(false);

  function openAppMenu(evt) {
    setAppMenuAnchorEl(evt.currentTarget);
  }

  function showHideHelp() {
    setMustShowPanel(window.innerWidth < 641 || mustShowPanel === 'DETAIL' ? 'HELP' : 'DETAIL');
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

  async function handleSaveSearch() {
    try {
      setAppMenuAnchorEl(null);
      await saveSearch(searchWords, searchStr);
      await combineSavedSearchesWithSuggestions();
      window.postMessage({kind: 'TRANSIENT_MSG', message: `Saved “${searchStr}”`, severity: 'success'}, window?.location?.origin);
    } catch (err) {
      window.postMessage({kind: 'TRANSIENT_MSG', message: extractUserMessage(err), severity: err.severity || 'error'}, window?.location?.origin);
    }
  }

  async function handleDeleteSavedSearch() {
    try {
      setAppMenuAnchorEl(null);
      await deleteSavedSearch(searchWords);
      await combineSavedSearchesWithSuggestions();
      window.postMessage({kind: 'TRANSIENT_MSG', message: `Deleted “${searchStr}”`, severity: 'success'}, window?.location?.origin);
      setSearchParams(new URLSearchParams());
    } catch (err) {
      window.postMessage({kind: 'TRANSIENT_MSG', message: extractUserMessage(err), severity: err.severity || 'error'}, window?.location?.origin);
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
                   title="Enter the first several letters of one or more search words." maxLength={1000}
                   value={searchStr} list="searchSuggestions" enterKeyHint="Search" ref={searchRef} onChange={onSearchChange} onBlur={handleSearchBlur} role="search"/>
            <datalist id="searchSuggestions">
              {predefinedSearches.map(search => (<option value={search} key={search}/>))}
            </datalist>
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
              <MenuItem onClick={showHideHelp}>Help <Help/></MenuItem>
              <MenuItem onClick={handleImportFileSingle}>Import one note per file...</MenuItem>
              <MenuItem onClick={handleImportFileMultiple}>Import multiple notes per file...</MenuItem>
              <MenuItem onClick={handleSaveSearch}>Save search <SavedSearch/></MenuItem>
              <MenuItem onClick={handleDeleteSavedSearch}>Delete saved search <SearchOff/></MenuItem>
              <MenuItem onClick={handleDeleteSelected}>Delete selected note <Delete/></MenuItem>
            </Menu>
            <input id="fileInput" type="file" hidden={true} ref={fileInput} onChange={fileChange} multiple={true}
                   accept={"text/plain,text/markdown,text/html,image/*,text/csv,text/tab-separated-values," + allowedFileTypesNonText.join(',') + ',text/uri-list,text/vcard,text/calendar,text/troff,' + allowedExtensions.join(',')}/>
          </Toolbar>
        </AppBar>
        <div style={{height: '4px', flex: '0 0 auto', backgroundColor: 'white'}}></div>
        <List searchWords={searchWords} changeCount={changeCount} selectedNoteId={selectedNoteId} handleSelect={handleSelect} setTransientErr={setTransientErr}></List>
        <Fab onClick={addNote} color="primary" title="Create new note"><AddIcon /></Fab>
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
