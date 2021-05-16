import React, {useState} from 'react';
import List from './List';
import Detail from './Detail'
import './App.css';

function App() {
  const [searchStr, setSearchStr] = useState("");
  const [count, setCount] = useState(0);
  const [selectedNoteId] = useState(null);

  const onChange = event => setSearchStr(event.target.value);

  const changeCount = value => setCount(value);

  return (
      <div className="App panelContainer">
        <div className="panelMain">
          <header className="App-header">
            <input type="search" placeholder="Enter search word(s)"
                   title="Enter the first several letters of one or more search words." aria-label="search notes" value={searchStr} onChange={onChange} />
            <div className="count">{count}</div>
          </header>
          <List searchStr={searchStr} selectedNoteId={selectedNoteId} changeCount={changeCount}></List>
        </div>
        <div className="panelDetail">
          <Detail noteId={selectedNoteId}></Detail>
        </div>
      </div>
  );
}

export default App;
