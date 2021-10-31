// List.js - List component for Notes Together
// Copyright © 2021 Doug Reeder

import {validate as uuidValidate} from "uuid";
import {updateListWithChanges} from "./listUtil";
import {findStubs, deleteNote} from "./storage";
import React, {useState, useEffect, useRef} from 'react';
import PropTypes from 'prop-types';
import './List.css';
import {CSSTransition} from "react-transition-group";
import humanDate from "./util/humanDate";


function List(props) {
  const {searchWords = new Set(), changeCount, selectedNoteId, handleSelect, setTransientErr} = props;

  const [listErr, setListErr] = useState(null);
  const [notes, setNotes] = useState([]);
  // console.log("List props:", props, "   notes:", notes);

  const lastSelectedNoteId = useRef([]);
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

  function onClick(evt) {
    try {
      evt.preventDefault();
      evt.stopPropagation();
      const noteEl = evt.target.closest("li.summary");
      const id = noteEl?.dataset?.id;
      if (uuidValidate(id)) {
        lastSelectedNoteId.current.unshift(selectedNoteId);
        lastSelectedNoteId.current.length = 2;
        handleSelect(id);
      }
    } catch (err) {
      setTransientErr(err);
    }
  }

  // TODO: mobile-friendly way to invoke this, such as swipe
  function onDoubleClick(evt) {
    try {
      evt.preventDefault();
      evt.stopPropagation();
      const noteEl = evt.target.closest("li.summary");
      const id = noteEl?.dataset?.id;
      const newItemButtonIds = Object.assign({}, itemButtonsIds);
      for (let currentId in newItemButtonIds) {
        newItemButtonIds[currentId] = false;
      }
      if (uuidValidate(id) && !(id in newItemButtonIds)) {
        handleSelect(lastSelectedNoteId.current[1]);
        newItemButtonIds[id] = true;
      }
      setItemButtonIds(newItemButtonIds);
    } catch (err) {
      setTransientErr(err);
    }
  }

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
          const titleLines = ('string' === typeof note.title ? note.title : "⸮").split('\n');
          let itemButtons;
          if (note.id in itemButtonsIds) {
            itemButtons = (
                <CSSTransition in={itemButtonsIds[note.id]} appear={true} timeout={333} classNames="slideFromLeft" onExited={() => {exitItemButtons(note.id)}}>
                  <div className="itemButtons">
                    <button type="button" onClick={deleteItem}>Delete</button>
                    {/*<button type="button">Share</button>*/}
                  </div>
                </CSSTransition>);
          }
          listItems.push(
            <li data-id={note.id} key={note.id}
                className={'summary' + (note.id === selectedNoteId ? ' selected' : '')}>
              <div className="title">{titleLines[0]}<br/>{titleLines[1]}</div>
              {itemButtons}
            </li>
          );
    }
  } else {
    if (searchWords.size > 0) {
      listItems = <div className="advice">
        <h2>No Matching Notes</h2>
        Try just the first few letters of your search word(s), or synonyms of them.
      </div>
    } else {
      listItems = <div className="advice">
        <h2>Write or sync some notes!</h2>
        <p>To create a new note, tap the <button className="actionBtn" style={{position:"static", transform: "scale(0.7)", verticalAlign: "middle"}}><span>+</span></button> button.
          You can paste text and images into it.</p>
        <p>Connect to Storage to sync your notes with a remote server.</p>
      </div>
      // TODO: and insert pictures
      // TODO: To import text, Markdown or HTML notes, tap the menu button, then <b>Import file as multiple notes</b>.
    }
  }
  return (
      <ol className="list" onClick={onClick} onDoubleClick={onDoubleClick}>
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
