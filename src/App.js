import {createMemoryNote} from './Note';
import {init, upsertNote, parseWords, deleteNote} from './storage';
import {findFillerNoteIds} from './idbNotes';
import React, {useState, useEffect} from 'react';
import List from './List';
import Detail from './Detail'
import './App.css';
import {Fab, Menu, MenuItem, Snackbar} from "@material-ui/core";
import {makeStyles} from '@material-ui/core/styles';
import Slide from '@material-ui/core/Slide';
import AddIcon from '@material-ui/icons/Add';
import {Alert, AlertTitle} from "@material-ui/lab";
import {useSnackbar} from "notistack";
import {randomNote, seedNotes, hammerStorage} from "./fillerNotes";
import Widget from "remotestorage-widget";

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
  function handleSelect(id) {
    setSelectedNoteId(id);
    setMustShowPanel('DETAIL');
  }

  const [focusOnLoad, setFocusOnLoad] = useState(false);
  async function addNote() {
    try {
      const initialText = searchStr.trim() ? `<p></p><p>${searchStr.trim()}&nbsp;</p>` : "";
      const newNote = createMemoryNote(null, initialText);
      // console.log("adding note:", newNote);
      await upsertNote(newNote);
      setFocusOnLoad(true);
      setSelectedNoteId(newNote.id);
      setMustShowPanel('DETAIL');
    } catch (err) {
      setTransientErr(err);
    }
  }
  function clearFocusOnLoad() {
    setFocusOnLoad(false);
  }

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
        <div className="panel panelMain" id="panelMain">
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
          </header>
          <List searchWords={searchWords} changeCount={changeCount} selectedNoteId={selectedNoteId} handleSelect={handleSelect} setTransientErr={setTransientErr}></List>
          <Fab onClick={addNote} className={classes.fab} color="primary" aria-label="add"><AddIcon /></Fab>
          <Snackbar open={Boolean(transientErr)} autoHideDuration={6000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
            <Alert onClose={handleSnackbarClose} severity="error">
              <AlertTitle>{transientErr?.userMsg || "Restart your device"}</AlertTitle>
              {transientErr?.message || transientErr?.name || transientErr?.toString()}
            </Alert>
          </Snackbar>
        </div>
        <div className="panel panelDetail">
          <Detail noteId={selectedNoteId} searchStr={searchStr} focusOnLoadCB={focusOnLoad ? clearFocusOnLoad : null} setMustShowPanel={setMustShowPanel}></Detail>
        </div>
      </div>
  );
}

export default App;
