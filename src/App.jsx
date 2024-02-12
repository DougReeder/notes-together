// Copyright © 2021-2024 Doug Reeder

import {
  init,
  upsertNote, deleteNote,
  parseWords,
  checkpointSearch, listSuggestions,
  saveTag, deleteTag, listTags
} from './storage';
import {deserializeNote} from "./serializeNote.js";
import {findFillerNoteIds} from './idbNotes';
import React, {useState, useEffect, useRef, useCallback, useMemo, useReducer} from 'react';
import {useSearchParams} from "react-router-dom";
import List from './List';
import Detail from './Detail'
import './App.css';
import {
  AppBar, CircularProgress,
  Fab,
  IconButton,
  Menu,
  MenuItem,
  Toolbar
} from "@mui/material";
import Slide from '@mui/material/Slide';
import AddIcon from '@mui/icons-material/Add';
import MenuIcon from '@mui/icons-material/Menu';
import FileImport, {allowedExtensions, allowedFileTypesNonText} from './FileImport';
import {useSnackbar} from "notistack";
import {randomNote, seedNotes, hammerStorage} from "./fillerNotes";
import Widget from "remotestorage-widget";
import HelpPane from "./HelpPane";
import {DeleteOutline, Help, Label} from "@mui/icons-material";
import {setEquals} from "./util/setUtil";
import {extractUserMessage, transientMsg} from "./util/extractUserMessage";
import {fileExportMarkdown} from "./fileExport";
import {deserializeHtml} from "./slateHtml.jsx";
import {assembleNote} from "./assembleNote.js";
import {shortenTitle} from "./Note.js";
import {shorten} from "./util/shorten.js";


window.doDeserializeHtml = deserializeHtml;

function App() {
  // TODO: replace string with set of normalized search terms
  const [searchParams, setSearchParams] = useSearchParams();
  const {searchStr, searchWords} = useMemo(() => {
    const searchStr = (searchParams.get('words') || "").slice(0, 1000);
    let searchWords = parseWords(searchStr);
    if (searchWords.size > 10) {
      const wordArr = Array.from(searchWords.values());
      wordArr.sort((a,b) => b.length - a.length);
      searchWords = new Set(wordArr.slice(0, 10));
    }
    return {searchStr, searchWords};
  }, [searchParams]);
  const onSearchChange = evt => {
    let words = evt.target.value?.trimStart();
    if (words.startsWith("━━━━━━━")) {
      words = "";
    }
    setSearchParams(new URLSearchParams({words}));
  }

  useEffect(() => {
    document.title = import.meta.env.VITE_APP_TITLE + (searchStr ? `: ${searchStr}` : "");
  },[searchStr])

  const [count, setCount] = useState(" ");
  const changeCount = (value, isPartial) => setCount(isPartial ? ">" + value : String(value));
  const [numBackgroundTasks, setNumBackgroundTasks] = useState(0);

  const [, forceRender] = useReducer(x => x + 1, 0);

  // LIST, DETAIL or HELP
  const mustShowPanel = sessionStorage.getItem('mustShowPanel') || 'LIST';
  function setMustShowPanel(panel) {
    sessionStorage.setItem('mustShowPanel', panel);
    forceRender();
  }

  const selectedNoteId = sessionStorage.getItem('selectedNoteId');
  function setSelectedNoteId(id) {
    sessionStorage.setItem('selectedNoteId', id || '');   // setItem coerces to string
    forceRender();
  }

  const searchRef = useRef();
  const lastCheckpointRef = useRef(new Set());

  /**
   * Sets selectedNoteId and mustShowPanel
   * @param {string|null|undefined} id UUID of item
   * @param {string|undefined} newPanel LIST, DETAIL, HELP or undefined
   */
  function handleSelect(id, newPanel) {
    if (undefined !== id) {
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
  const addNote = useCallback(async () => {
    try {
      const initialText = searchStr.trim() ? `<h1></h1><p></p><hr /><p><em>${searchStr.trim()}</em></p>` : "<h1></h1><p></p>";
      const raw = {mimeType: 'text/html;hint=SEMANTIC', content: initialText};
      const newNote = deserializeNote(raw);
      // console.log("adding note:", newNote);
      await upsertNote(newNote, undefined);
      setMustShowPanel('DETAIL');
      focusOnLoad.current = true;
      setSelectedNoteId(newNote.id);
    } catch (err) {
      console.error("addNote:", err);
      transientMsg(extractUserMessage(err));
    }
  }, [searchStr]);

  const clearFocusOnLoad = useCallback(() => {
    focusOnLoad.current = false;   // reference, so doesn't cause re-render
  }, []);

  const {enqueueSnackbar} = useSnackbar();

  const externalChangeListener = evt => {
    if (evt.origin !== window.location.origin) return;

    switch (evt.data?.kind) {
      case 'NOTE_CHANGE':
        const notesDeleted = evt.data?.notesDeleted || {};
        if (Object.hasOwn(notesDeleted, selectedNoteId)) {
          console.info("selected note deleted", notesDeleted);
          setSelectedNoteId(null);
        }
        break;
      case 'TAG_CHANGE':
        combineTagsWithSuggestions().catch(err => {
          console.error("while combining tags:", err);
          transientMsg("Can't retrieve tags - close and re-open this tab");
        });
        break;
      case 'TRANSIENT_MSG':
        enqueueSnackbar(evt.data?.message || "Close and re-open this tab", {
          anchorOrigin: {horizontal: 'left', vertical: evt.data?.atTop ? 'top' : 'bottom'},
          variant: evt.data?.severity || 'error',
          autoHideDuration: ['info', 'success'].includes(evt.data?.severity) ? 4000 : 8000,
          disableWindowBlurListener: true,
          TransitionComponent: Slide,
        });
        break;
      case 'DESERIALIZE_HTML':
        console.info(`deserializing HTML for Service Worker:`, evt.data?.html?.slice(0, 60));
        const slateNodes = deserializeHtml(evt.data?.html);
        navigator.serviceWorker?.controller?.postMessage({slateNodes});
        break;
    }
  }
  const newServiceWorker = _evt => {
    console.info("A new Service Worker has claimed this window.");
    // TODO: reload page? (after notifying user?)
  }
  useEffect( () => {
    window.addEventListener("message", externalChangeListener);
    navigator.serviceWorker?.addEventListener('message', externalChangeListener);
    navigator.serviceWorker?.addEventListener('controllerchange', newServiceWorker);

    return function removeExternalChangeListener() {
      window.removeEventListener("message", externalChangeListener);
      navigator.serviceWorker?.removeEventListener('message', externalChangeListener);
      navigator.serviceWorker?.removeEventListener('controllerchange', newServiceWorker);
    };
  });

  const [predefinedSearches, setPredefinedSearches] = useState([]);

  const combineTagsWithSuggestions = useCallback(async () => {
    const {originalTags, normalizedTags} = await listTags();
    if (originalTags.length > 0) {
      originalTags.push("━━━━━━━━━━━━");
    }

    const suggestions = await listSuggestions(100);
    for (const [original, normalized] of suggestions) {
      if (! normalizedTags.has(normalized)) {
        originalTags.push(original);
      }
    }
    // console.log("predefined searches:", originalTags)
    setPredefinedSearches(originalTags);
  }, []);

  useEffect( () => {
    async function startup() {
      const {remoteStorage, isFirstLaunch} = await init();   // init is idempotent
      if (isFirstLaunch && window.innerWidth >= 641) {
        requestIdleCallback(async () => {
          console.info("creating blank starter note");
          await addNote();
        });
      }

      const widget = document.getElementById('remotestorage-widget');
      if (!widget) {
        // console.info("remoteStorage displaying login widget");
        const widget = new Widget(remoteStorage);
        widget.attach('panelMain');   // login
      }

      await combineTagsWithSuggestions();
    }
    startup().catch(err => {
      console.error("during startup:", err);
      transientMsg("Error starting up - restart your browser");
    });
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps


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
    if (document.activeElement && document.activeElement !== document.body &&
      'OL' !== document.activeElement.tagName) {
      return;
    }
    switch (evt.code) {
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
      await combineTagsWithSuggestions();
    }
    lastCheckpointRef.current = searchWords;
  }


  const [appMenuAnchorEl, setAppMenuAnchorEl] = useState(false);

  function openAppMenu(evt) {
    setAppMenuAnchorEl(evt.currentTarget);
  }

  function showHideHelp() {
    setMustShowPanel(window.innerWidth < 641 || mustShowPanel !== 'HELP' ? 'HELP' : 'DETAIL');
    setAppMenuAnchorEl(null);
  }

  const importFileInput = useRef(null);
  const [importFiles, setImportFiles] = useState([]);
  const [isImportMultiple, setIsImportMultiple] = useState(false);
  const manyFilesIntoOneNote = useRef(false);

  function handleImportManyToOne(_evt) {
    manyFilesIntoOneNote.current = true;
    setIsImportMultiple(true);
    importFileInput.current.click();
    setAppMenuAnchorEl(null);
  }

  function handleImportFileSingle(_evt) {
    manyFilesIntoOneNote.current = false;
    setIsImportMultiple(false);
    importFileInput.current.click();
    setAppMenuAnchorEl(null);
  }

  function handleImportFileMultiple(_evt) {
    manyFilesIntoOneNote.current = false;
    setIsImportMultiple(true);
    importFileInput.current.click();
    setAppMenuAnchorEl(null);
  }

  async function fileChange(evt) {
    setNumBackgroundTasks( prevNumBackgroundTasks => prevNumBackgroundTasks + 1 );
    try {
      if (evt.target.files.length > 0) {
        if (manyFilesIntoOneNote.current) {
          const files = evt.target.files;
          const nodeNote = await assembleNote("", "", "", files, null);
          const storedNote = await upsertNote(nodeNote, undefined);
          const label = shortenTitle(storedNote?.title, 50) || shorten(files[0]?.name) || `${files.length} file(s)`;
          console.info(`importing “${label}”`, storedNote.date.toISOString());
          transientMsg(`importing “${label}”`, 'success');
          doCloseImport(label);
        } else {
          setImportFiles(evt.target.files);
        }
      } else {
        console.warn("no files selected");
      }
    } catch (err) {
      console.error("while selecting files to import:", err);
      transientMsg(extractUserMessage(err));
    } finally {
      setNumBackgroundTasks( prevNumBackgroundTasks => prevNumBackgroundTasks - 1 );
    }
  }


  async function handleExportSelectedMarkdown(_evt) {
    setAppMenuAnchorEl(null);
    setNumBackgroundTasks( prevNumBackgroundTasks => prevNumBackgroundTasks + 1 );
    try {
      console.group("Export to Markdown file")
      if ("0" === count) {
        transientMsg("Change the search to match some notes!", 'info');
        return;
      }

      await fileExportMarkdown(searchStr, searchWords);
    } catch (err) {
      console.error(`while exporting:`, err);
      if ('AbortError' !== err.name || "The user aborted a request." !== err.message) {
        transientMsg(extractUserMessage(err), err.severity);
      }
    } finally {
      setNumBackgroundTasks( prevNumBackgroundTasks => prevNumBackgroundTasks - 1 );
      console.groupEnd();
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

      const files = evt.dataTransfer.files;
      if (files.length > 0) {
        const nodeNote = await assembleNote("", "", "", files, null);
        const storedNote = await upsertNote(nodeNote, undefined);
        const label = shortenTitle(storedNote?.title, 50) || shorten(files[0]?.name) || `${files.length} file(s)`;
        console.info(`importing “${label}”`, storedNote.date.toISOString());
        transientMsg(`importing “${label}”`, 'success');
        doCloseImport(label);
      } else {
        transientMsg("Drag that to the editor panel", 'warning');
      }
    } catch (err) {
      console.error("while dropping file:", err);
      transientMsg(extractUserMessage(err));
    }
  }


  function doCloseImport(lastSuccessfulFileName) {
    // console.log("doCloseImport", lastSuccessfulFileName);
    setImportFiles([]);
    importFileInput.current.value = "";
    if (lastSuccessfulFileName) {
      setSearchParams(new URLSearchParams({words: lastSuccessfulFileName}));
    }
  }

  async function handleSaveTag() {
    try {
      setAppMenuAnchorEl(null);
      const saveResult = await saveTag(searchWords, searchStr);
      await combineTagsWithSuggestions();
      const message = 'string' === typeof saveResult ?
        `Saved tag “${searchStr}”` :
        `Updated tag “${saveResult?.original}” to “${searchStr}”`;
      console.info(message);
      transientMsg(message, 'success');
    } catch (err) {
      console.error(`while saving tag “${[...searchWords].join(' ')}”:`, err);
      transientMsg(extractUserMessage(err), err.severity);
    }
  }

  async function handleDeleteTag() {
    try {
      setAppMenuAnchorEl(null);
      await deleteTag(searchWords, searchStr);
      await combineTagsWithSuggestions();
      const message = `Deleted tag “${searchStr}”`;
      console.info(message);
      transientMsg(message, 'success');
      setSearchParams(new URLSearchParams());
    } catch (err) {
      console.error(`while deleting tag “${[...searchWords].join(' ')}”:`, err);
      transientMsg(extractUserMessage(err), err.severity);
    }
  }

  const imperativeRef = useRef();

  async function handleShowItemButtons(_evt) {
    if (selectedNoteId) {
      try {
        imperativeRef.current.showSelectedItemButtons();
      } catch (err) {
        console.error(`while showing item buttons for ${selectedNoteId}:`, err);
        transientMsg(extractUserMessage(err), err.severity);
      }
    } else {
      transientMsg("First, select a note!", 'info');
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
      setNumBackgroundTasks( prevNumBackgroundTasks => prevNumBackgroundTasks + 1 );
      await seedNotes();
    } catch (err) {
      console.error("handleAddSeedNotes:", err);
      transientMsg(extractUserMessage(err));
    } finally {
      setNumBackgroundTasks( prevNumBackgroundTasks => prevNumBackgroundTasks - 1 );
    }
  }

  async function handleAddMovieNotes() {
    try {
      console.groupCollapsed("Adding 100 movie or list notes")
      setTestMenuAnchorEl(null);
      setNumBackgroundTasks( prevNumBackgroundTasks => prevNumBackgroundTasks + 1 );
      for (let i = 0; i < 100; ++i) {
        await randomNote();
      }
    } catch (err) {
      console.error("handleAddMovieNotes:", err);
      transientMsg(extractUserMessage(err));
    } finally {
      setNumBackgroundTasks( prevNumBackgroundTasks => prevNumBackgroundTasks - 1 );
      console.groupEnd();
    }
  }

  async function handleHammer() {
    try {
      console.group("Hammering storage");
      setTestMenuAnchorEl(null);
      setNumBackgroundTasks( prevNumBackgroundTasks => prevNumBackgroundTasks + 1 );
      await hammerStorage();
    } catch (err) {
      console.error("handleHammer:", err);
      transientMsg(extractUserMessage(err));
    } finally {
      setNumBackgroundTasks( prevNumBackgroundTasks => prevNumBackgroundTasks - 1 );
      console.groupEnd();
    }
  }

  async function handleDeleteFillerNotes() {
    try {
      console.group("Delete Filler Notes");
      setTestMenuAnchorEl(null);
      setNumBackgroundTasks( prevNumBackgroundTasks => prevNumBackgroundTasks + 1 );
      for (const noteId of await findFillerNoteIds()) {
        try {
          await deleteNote(noteId);
          if (noteId === selectedNoteId) {
            handleSelect(null);
          }
        } catch (err2) {
          console.warn(`while deleting filler [${noteId}]:`, err2);
          transientMsg(extractUserMessage(err2), err2.severity);
        }
      }
    } catch (err) {
      console.warn("while deleting filler notes:", err);
      transientMsg(extractUserMessage(err), err.severity);
    } finally {
      setNumBackgroundTasks( prevNumBackgroundTasks => prevNumBackgroundTasks - 1 );
      console.groupEnd();
    }
  }


  return <>
    <div className={'LIST' === mustShowPanel ? "App panelContainer" : "App panelContainer right"} role="application">
      <div className="panel panelMain" id="panelMain" onDragEnter={preventDefault} onDragOver={preventDefault} onDrop={handleDrop}>
        <AppBar position="sticky" className="appbar">
          <Toolbar>
            <input type="search" placeholder="Enter search or select tag" maxLength={1000}
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
              <MenuItem onClick={handleAddMovieNotes}>Add 100 Movie or List Notes</MenuItem>
              <MenuItem onClick={handleHammer}>Hammer Storage</MenuItem>
              <MenuItem onClick={handleDeleteFillerNotes}>Delete Filler Notes</MenuItem>
            </Menu>
            {numBackgroundTasks > 0 ?
              <div className="workingInBackground"><CircularProgress /></div> :
              <IconButton onClick={openAppMenu} title="Open application menu" size="large">
                <MenuIcon/>
              </IconButton>
            }
            <Menu id="appMenu" anchorEl={appMenuAnchorEl} open={Boolean(appMenuAnchorEl)}
                  onClose={setAppMenuAnchorEl.bind(this, null)}>
              <MenuItem onClick={showHideHelp}>Help <Help/></MenuItem>
              <MenuItem className={(searchWords.size) ? '' : 'pseudoDisabled'} onClick={handleSaveTag}>Save search as tag<Label/></MenuItem>
              <MenuItem className={(searchWords.size) ? '' : 'pseudoDisabled'} onClick={handleDeleteTag}>Delete tag <DeleteOutline/></MenuItem>
              <MenuItem onClick={handleImportManyToOne}>Import multiple files into one note...</MenuItem>
              <MenuItem onClick={handleImportFileSingle}>Import one note per file...</MenuItem>
              <MenuItem onClick={handleImportFileMultiple}>Import multiple notes per file...</MenuItem>
              <MenuItem className={!('showSaveFilePicker' in window && "0" !== count) ? 'pseudoDisabled' : ''} onClick={handleExportSelectedMarkdown}>{`Export ${searchWords.size > 0 ? count : "all"} notes to Markdown...`}</MenuItem>
              <MenuItem className={(selectedNoteId) ? '' : 'pseudoDisabled'} onClick={handleShowItemButtons}>Delete or Share selected note...</MenuItem>
            </Menu>
            <input id="importFileInput" type="file" hidden={true} ref={importFileInput} onChange={fileChange} multiple={true}
                   accept={"text/plain,text/markdown,text/html,image/*,text/csv,text/tab-separated-values," + allowedFileTypesNonText.join(',') + ',text/uri-list,text/vcard,text/calendar,text/troff,' + allowedExtensions.join(',')}/>
            <label id="importFileLabel" htmlFor="importFileInput" hidden>Import file</label>
          </Toolbar>
        </AppBar>
        <div style={{height: '4px', flex: '0 0 auto', backgroundColor: 'white'}}></div>
        <List ref={imperativeRef} searchWords={searchWords} changeCount={changeCount} selectedNoteId={selectedNoteId} handleSelect={handleSelect}></List>
        <Fab onClick={addNote} color="primary" title="Create new note"><AddIcon /></Fab>
        <FileImport files={importFiles} isMultiple={isImportMultiple} doCloseImport={doCloseImport} />
      </div>
      <div className="separator"></div>
      <div className="panel panelDetail">
        {'HELP' !== mustShowPanel ? <Detail noteId={selectedNoteId} searchWords={searchWords}
                                            focusOnLoadCB={focusOnLoad.current ? clearFocusOnLoad : null}
                                            setMustShowPanel={setMustShowPanel}></Detail> :
          <HelpPane setMustShowPanel={setMustShowPanel}></HelpPane>
        }
      </div>
    </div>
  </>
}

export default App;
