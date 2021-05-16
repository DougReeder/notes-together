import React, {useState} from 'react';
import List from './List';
import Detail from './Detail'
import './App.css';

function App() {
  const [searchStr, setSearchStr] = useState("");
  const onSearchChange = event => setSearchStr(event.target.value);

  const [count, setCount] = useState(0);
  const changeCount = value => setCount(value);

  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const handleSelect = id => setSelectedNoteId(id);

  return (
      <div className="App panelContainer">
        <div className="panelMain">
          <header className="App-header">
            <input type="search" placeholder="Enter search word(s)"
                   title="Enter the first several letters of one or more search words." aria-label="search notes" value={searchStr} onChange={onSearchChange} />
            <div className="count">{count}</div>
          </header>
          <List searchStr={searchStr} changeCount={changeCount} selectedNoteId={selectedNoteId} handleSelect={handleSelect}></List>
        </div>
        <div className="panelDetail">
          <Detail noteId={selectedNoteId}></Detail>
        </div>
      </div>
  );
}

export default App;
