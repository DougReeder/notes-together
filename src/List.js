// List.js - List component for Notes Together
// Copyright © 2021 Doug Reeder

import {validate as uuidValidate} from "uuid";
import {updateListWithChanges} from "./listUtil";
import {findStubs, deleteNote} from "./storage";
import React, {useState, useEffect, useRef, useCallback} from 'react';
import PropTypes from 'prop-types';
import './List.css';
import {CSSTransition} from "react-transition-group";
import humanDate from "./util/humanDate";
import {Button} from "@mui/material";


function List(props) {
  const {searchWords = new Set(), changeCount, selectedNoteId, handleSelect, setTransientErr} = props;

  const [listErr, setListErr] = useState(null);
  const [notes, setNotes] = useState([]);
  // console.log("List props:", props, "   notes:", notes);

  const [itemButtonsIds, setItemButtonIds] = useState({});

  useEffect(() => {
    // console.log("launching search")
    findStubs(searchWords, callback);

    function callback(err, notes, {isPartial, isFinal} = {}) {
      try {
        if (err) {
          return setListErr(err);
        } else {
          setListErr(null);
        }
        console.log(`search returned with ${notes?.length} notes`);

        setNotes(notes);
        changeCount(notes.length, isPartial);
      } catch (err2) {
        setListErr(err2);
      }
    }
  }, [searchWords]);  // eslint-disable-line react-hooks/exhaustive-deps

  const externalChangeListener = evt => {
    try {
      if (evt.origin !== window.location.origin || evt.data?.kind !== 'NOTE_CHANGE') return;
      const notesChanged = evt.data?.notesChanged || {};
      const notesDeleted = evt.data?.notesDeleted || {};

      const {isChanged, newNotes} = updateListWithChanges(notes, notesChanged, notesDeleted, searchWords);

      console.log("List externalChange", isChanged, notesChanged, notesDeleted);
      if (isChanged) {
        setNotes(newNotes);
        changeCount(newNotes.length);
      }
    } catch (err) {
      setTransientErr(err);
    }
  };
  useEffect( () => {
    window.addEventListener("message", externalChangeListener);

    return function removeExternalChangeListener() {
      window.removeEventListener("message", externalChangeListener);
    };
  });

  const pointerRef = useRef({});

  function handlePointerDown(evt) {
    try {
      if (evt.target.closest("button")) {
        return;
      }
      evt.preventDefault();
      evt.stopPropagation();
      const noteEl = evt.target.closest("li.summary");
      const id = noteEl?.dataset?.id;
      pointerRef.current = {downId: id, downStamp: Date.now()};
    } catch (err) {
      setTransientErr(err);
    }
  }

  function handlePointerUp(evt) {
    try {
      if (evt.target.closest("button")) {
        return;
      }
      evt.preventDefault();
      evt.stopPropagation();
      const noteEl = evt.target.closest("li.summary");
      const id = noteEl?.dataset?.id;
      if (uuidValidate(id) && id === pointerRef.current.downId) {
        if (Date.now() - pointerRef.current.downStamp < 500) {   // click
          if (! evt.target.closest("div.itemButtons")) {
            handleSelect(id, 'DETAIL');
          }
        } else {   // long-press
          const newItemButtonIds = {};
          for (let currentId in itemButtonsIds) {
            newItemButtonIds[currentId] = false;   // dismiss existing
          }
          if (!(id in newItemButtonIds)) {
            newItemButtonIds[id] = true;
          }
          setItemButtonIds(newItemButtonIds);
        }
      }
    } catch (err) {
      setTransientErr(err);
    }
  }

  const keyListener = useCallback(evt => {
    if (evt.target.dataset.slateEditor || evt.isComposing || evt.keyCode === 229) {
      return;
    }
    switch (evt.code) {   // eslint-disable-line default-case
      case 'ArrowDown':
        if (evt.shiftKey) {
          incrementSelectedNote(+5);
        } else if (evt.altKey) {
          incrementSelectedNote(+25);
        } else if (evt.ctrlKey || evt.metaKey) {
          incrementSelectedNote(-1000000);
        } else {
          incrementSelectedNote(+1);
        }
        break;
      case 'PageDown':
        incrementSelectedNote(+10);   // TODO: calc # notes on screen
        break;
      case 'End':
        incrementSelectedNote(-1000000);
        break;
      case 'ArrowUp':
        if (evt.shiftKey) {
          incrementSelectedNote(-5);
        } else if (evt.altKey) {
          incrementSelectedNote(-25);
        } else if (evt.ctrlKey || evt.metaKey) {
          incrementSelectedNote(+1000000);
        } else {
          incrementSelectedNote(-1);
        }
        break;
      case 'PageUp':
        incrementSelectedNote(-10);   // TODO: calc # notes on screen
        break;
      case 'Home':
        incrementSelectedNote(+1000000);
        break;
      case 'ContextMenu':
        if (selectedNoteId) {
          const newItemButtonIds = {};
          for (let currentId in itemButtonsIds) {
            newItemButtonIds[currentId] = false;   // dismiss existing
          }
          if (!(selectedNoteId in newItemButtonIds)) {
            newItemButtonIds[selectedNoteId] = true;
          }
          setItemButtonIds(newItemButtonIds);
        }
        break;
      // default:
      //   console.log("List keyListener:", evt.code, evt)
    }

    function incrementSelectedNote(increment) {
      let selectedInd = notes.findIndex(note => note.id === selectedNoteId) + increment;
      // if not found, index is -1, which works with the following lines
      if (selectedInd >= notes.length) {   // wraps around from end to beginning
        selectedInd = 0
      }
      if (selectedInd < 0) {   // wraps around from beginning to end
        selectedInd = notes.length-1;
      }
      const newId = notes[selectedInd]?.id;
      if (uuidValidate(newId)) {
        handleSelect(newId, null);
      }
    }
  }, [handleSelect, notes, selectedNoteId, itemButtonsIds]);
  useEffect(() => {
    document.addEventListener('keydown', keyListener);

    return function removeKeyListener(){
      document.removeEventListener('keydown', keyListener);
    }
  }, [keyListener]);

  const selectedElmntRef = useRef(null);

  useEffect(() => {
    selectedElmntRef.current?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
  }, [selectedNoteId])

  function exitItemButtons(id) {
    try {
      const newItemButtonIds = Object.assign({}, itemButtonsIds);
      delete newItemButtonIds[id];
      setItemButtonIds(newItemButtonIds);
    } catch (err) {
      setTransientErr(err);
    }
  }

  async function deleteItem(evt) {
    try {
      evt.preventDefault();
      evt.stopPropagation();
      const noteEl = evt.target.closest("li.summary");
      const id = noteEl?.dataset?.id;
      await deleteNote(id);
    } catch (err) {
      setTransientErr(err);
    }
  }

  const adviceGettingStarted = <>
    <h2>Write, import or sync some notes!</h2>
    <p>To create a new note, tap the add button in the lower right of this pane. ➘
      You can paste or drag rich text and pictures into the editor pane.</p>
    <p>Drag text, Markdown, HTML or graphic files to this pane. Or from the application menu in the upper right of this pane ➚, select <b>Import ...</b></p>
    <p>Tap <b>Connect Your Storage</b> below ⬇︎ to back up your notes, and sync them between devices.</p>
  </>;

  let listItems;
  if (listErr) {
    listItems = <div className="error"><h2>Restart your device</h2>{listErr.message}</div>
  } else if (notes.length > 0) {
    listItems = [];
    let prevDateStr = null;
    for (const note of notes) {
          const dateStr = humanDate(note.date);
          if (dateStr !== prevDateStr) {
            prevDateStr = dateStr;
            let dateClassName = 'humanDate';
            if (dateStr.startsWith("Today")) {
              dateClassName += ' today';
            }
            listItems.push(<li className="divider" key={Math.random()}>
              <svg className="leftLine" version="1.1" viewBox="0 0 40 20">
                <line fill="none" stroke="#155477" x1="0" y1="10" x2="35" y2="10" strokeWidth="6" strokeLinecap="round" />
              </svg>
              <div className={dateClassName}>{dateStr}</div>
              <svg className="rightLine" version="1.1" viewBox="0 0 1000 20" preserveAspectRatio="xMinYMid slice">
                <line fill="none" stroke="#155477" x1="5" y1="10" x2="1000" y2="10" strokeWidth="6" strokeLinecap="round" />
              </svg>
            </li>);
          }
          let titleDiv;
          if ('string' === typeof note.title && /\S/.test(note.title)) {
            const titleLines = note.title.split('\n');
            titleDiv = <div className="title">{titleLines[0]}<br/>{titleLines[1]}</div>
          } else {
            titleDiv = <div className="title untitled">Untitled</div>
          }
          let itemButtons;
          if (note.id in itemButtonsIds) {
            itemButtons = (
                <CSSTransition in={itemButtonsIds[note.id]} appear={true} timeout={333} classNames="slideFromLeft" onExited={() => {exitItemButtons(note.id)}}>
                  <div className="itemButtons">
                    <Button variant="contained" onClick={deleteItem}>Delete</Button>
                    {/*<Button type="button">Share</Button>*/}
                  </div>
                </CSSTransition>);
          }
          listItems.push(
            note.id === selectedNoteId ?
              <li data-id={note.id} key={note.id} ref={selectedElmntRef}
                  className="summary selected">
                {titleDiv}
                {itemButtons}
              </li>
              :
              <li data-id={note.id} key={note.id}
                  className="summary">
                {titleDiv}
                {itemButtons}
              </li>
      );
    }
    if (notes.length < 16 && 0 === searchWords.size) {
      listItems.push(<div key="advice" className="advice trailing" onClick={handleSelect.bind(this, null, 'HELP')}>{adviceGettingStarted}</div>);
    }
  } else {
    if (searchWords.size > 0) {
      listItems = <div className="advice solo" onClick={handleSelect.bind(this, null, 'HELP')}>
        <h2>No Matching Notes</h2>
        Try just the first few letters of your search word(s), or synonyms of them.
      </div>
    } else {
      listItems = <div className="advice solo" onClick={handleSelect.bind(this, null, 'HELP')}>{adviceGettingStarted}</div>;
    }
  }
  return (
      <ol className="list" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
        {listItems}
      </ol>
  );
}

List.propTypes = {
  searchWords: PropTypes.instanceOf(Set),
  changeCount: PropTypes.func.isRequired,
  selectedNoteId: PropTypes.string,
  handleSelect: PropTypes.func.isRequired,
  setTransientErr: PropTypes.func.isRequired,
}

export default List;
