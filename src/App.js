import {createMemoryNote} from './Note';
import {init, upsertNote, parseWords, deleteNote} from './storage';
import {findFillerNoteIds} from './idbNotes';
import React, {useState, useEffect} from 'react';
import List from './List';
import Detail from './Detail'
import './App.css';
import {Menu, MenuItem, Snackbar} from "@material-ui/core";
import {Alert, AlertTitle} from "@material-ui/lab";
import {randomNote, seedNotes} from "./fillerNotes";
import Widget from "remotestorage-widget";

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
  const handleSelect = id => setSelectedNoteId(id);

  const [focusOnLoad, setFocusOnLoad] = useState(false);
  async function addNote() {
    try {
      const initialText = searchStr.trim() ? "<br />" + searchStr.trim() + "&nbsp;" : "";
      const newNote = createMemoryNote(null, initialText);
      // console.log("adding note:", newNote);
      await upsertNote(newNote);
      setFocusOnLoad(true);
      setSelectedNoteId(newNote.id);
    } catch (err) {
      setTransientErr(err);
    }
  }
  function clearFocusOnLoad() {
    setFocusOnLoad(false);
  }

  const externalChangeListener = evt => {
    if (evt.origin !== window.location.origin || evt.data?.kind !== 'NOTE_CHANGE') return;

    const notesDeleted = evt.data?.notesDeleted || {};
    if (notesDeleted.hasOwnProperty(selectedNoteId)) {
      console.log("selected note deleted", notesDeleted);
      setSelectedNoteId(null);
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

  return (
      <div className="App panelContainer" role="application">
        <div className="panelMain" id="panelMain">
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
              <MenuItem onClick={handleDeleteFillerNotes}>Delete Filler Notes</MenuItem>
            </Menu>
          </header>
          <List searchWords={searchWords} changeCount={changeCount} selectedNoteId={selectedNoteId} handleSelect={handleSelect} setTransientErr={setTransientErr}></List>
          <button className="actionBtn" onClick={addNote}><span>+</span></button>
          <Snackbar open={Boolean(transientErr)} autoHideDuration={6000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
            <Alert onClose={handleSnackbarClose} severity="error">
              <AlertTitle>{transientErr?.userMsg || "Restart your device"}</AlertTitle>
              {transientErr?.message || transientErr?.name || transientErr?.toString()}
            </Alert>
          </Snackbar>
        </div>
        <div className="panelDetail">
          <Detail noteId={selectedNoteId} searchStr={searchStr} focusOnLoadCB={focusOnLoad ? clearFocusOnLoad : null}></Detail>
        </div>
      </div>
  );
}

export default App;
