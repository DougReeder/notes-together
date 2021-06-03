import {createMemoryNote} from './Note';
import {upsertNote} from './idbNotes';
import React, {useState, useEffect} from 'react';
import List from './List';
import Detail from './Detail'
import './App.css';

function App() {
  // TODO: replace string with set of normalized search terms
  const [searchStr, setSearchStr] = useState("");
  const onSearchChange = event => setSearchStr(event.target.value);

  const [count, setCount] = useState(0);
  const changeCount = value => setCount(value);

  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const handleSelect = id => setSelectedNoteId(id);

  async function addNote() {
    const newNote = createMemoryNote(null, "<br />" + searchStr);
    // console.log("adding note:", newNote);
    setSelectedNoteId(newNote.id);
    await upsertNote(newNote);
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

    return (
      <div className="App panelContainer" role="application">
        <div className="panelMain">
          <header className="App-header">
            <input type="search" placeholder="Enter search word(s)"
                   title="Enter the first several letters of one or more search words." aria-label="search notes" value={searchStr} onChange={onSearchChange} role="search" />
            <div className="count">{count}</div>
          </header>
          <List searchStr={searchStr} changeCount={changeCount} selectedNoteId={selectedNoteId} handleSelect={handleSelect}></List>
          <button onClick={addNote}><span>+</span></button>
        </div>
        <div className="panelDetail">
          <Detail noteId={selectedNoteId} searchStr={searchStr}></Detail>
        </div>
      </div>
  );
}

export default App;
