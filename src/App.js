import React, {useState} from 'react';
import List from './List';
import Detail from './Detail'
import './App.css';

function App() {
  const [searchStr, setSearchStr] = useState("");
  const [selectedNoteId] = useState(null);

  const onChange = event => setSearchStr(event.target.value);

  return (
      <div className="App panelContainer">
        <div className="panelMain">
          <header className="App-header">
            <input type="search" placeholder="Enter search words"
                   title="Enter the first several letters of one or more search words." aria-label="search notes" value={searchStr} onChange={onChange} />
          </header>
          <List searchStr={searchStr} selectedNoteId={selectedNoteId}></List>
        </div>
        <div className="panelDetail">
          <Detail noteId={selectedNoteId}></Detail>
        </div>
      </div>
  );
}

export default App;
