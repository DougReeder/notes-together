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
import {Button, IconButton} from "@mui/material";
import {Cancel} from "@mui/icons-material";

const LONG_PRESS_DURATION = 500;   // ms

function List(props) {
  const {searchWords = new Set(), changeCount, selectedNoteId, handleSelect, setTransientErr} = props;

  const [listErr, setListErr] = useState(null);
  const [notes, setNotes] = useState([]);
  // console.log("List props:", props, "   notes:", notes);

  const [itemButtonsIds, setItemButtonsIds] = useState({});

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

  const list = useRef();

  const inactivateAndActivateItemButtons = useCallback(
      (evt, newActiveId) => {
    const newItemButtonIds = {};
    for (const [id, isActive] of Object.entries(itemButtonsIds)) {
      newItemButtonIds[id] = false;
      if (isActive) { evt?.stopPropagation(); }   // Escape key handled
    }
    if (newActiveId) {
      evt?.stopPropagation();
      newItemButtonIds[newActiveId] = true;
      list.current?.focus();
    }
    setItemButtonsIds(newItemButtonIds);
  }, [itemButtonsIds]);

  const pointerRef = useRef({});

  function handlePointerDown(evt) {
    try {
      if (pointerRef.current.longPressTimeoutId) {   // long-press in progress
        clearTimeout(pointerRef.current.longPressTimeoutId);   // prevent long-press
      }
      if (1 !== evt.buttons || evt.target.closest("button")) {
        return;
      }
      evt.preventDefault();
      evt.stopPropagation();
      const noteEl = evt.target.closest("li.summary");
      const id = noteEl?.dataset?.id;
      pointerRef.current = uuidValidate(id) ?
          {
            downId: id,
            longPressTimeoutId: setTimeout(longPress, LONG_PRESS_DURATION)
          } :
          {};
      function longPress() {
        pointerRef.current = {};
        inactivateAndActivateItemButtons(evt, id);
      }
    } catch (err) {
      setTransientErr(err);
    }
  }

  function handlePointerUp(evt) {
    try {
      if (pointerRef.current.longPressTimeoutId) {   // long-press hasn't happened
        clearTimeout(pointerRef.current.longPressTimeoutId);   // prevent long-press
      } else {   // long-press has happened, so this event is ignored
        return;
      }
      if (evt.target.closest("button")) {
        return;
      }
      evt.preventDefault();
      evt.stopPropagation();
      if (! evt.target.closest("div.itemButtons")) {
        handleSelect(pointerRef.current.downId, 'DETAIL');
      }
    } catch (err) {
      setTransientErr(err);
    } finally {
      pointerRef.current = {};
    }
  }


  const actionToConfirm = useRef('');

  const documentKeyListener = useCallback(async evt => {
    if (![document.body, list.current].includes(document.activeElement) ) {
      return;
    }
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
      case 'Backspace':
      case 'Delete':
        actionToConfirm.current = 'DELETE';
        // eslint-disable-next-line no-fallthrough
      case 'ContextMenu':
        if (selectedNoteId) {
          inactivateAndActivateItemButtons(evt, selectedNoteId);
        }
        break;
      case 'Enter':   // The App key handler also handles this - that's ok.
      case 'Space':
        if (itemButtonsIds[selectedNoteId]) {
          switch (actionToConfirm.current) {   // eslint-disable-line default-case
            case 'DELETE':
              await deleteNote(selectedNoteId);
              break;
          }
          actionToConfirm.current = '';
        }
        break;
      // default:
      //   console.log("List documentKeyListener:", evt.code, evt)
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
        const newPanel = selectedNoteId ? null : 'DETAIL'
        handleSelect(newId, newPanel);
      }
    }
  }, [handleSelect, notes, selectedNoteId, itemButtonsIds, inactivateAndActivateItemButtons]);
  useEffect(() => {
    document.addEventListener('keydown', documentKeyListener);

    return function removeKeyListener(){
      document.removeEventListener('keydown', documentKeyListener);
    }
  }, [documentKeyListener]);

  const listKeyListener = useCallback(evt => {
    if (evt.isComposing || evt.keyCode === 229) {
      return;
    }
    switch (evt.code) {   // eslint-disable-line default-case
      case 'Escape':
        inactivateAndActivateItemButtons(evt, null);
        break;
    }
    // return true;
  }, [inactivateAndActivateItemButtons]);

  useEffect(() => {
    const currentList = list.current;
    currentList?.addEventListener('keydown', listKeyListener);

    return function removeListListener(){
      currentList?.removeEventListener('keydown', listKeyListener);
    }
  }, [listKeyListener]);

  const deleteBtn = useRef();
  const cancelItemButtonsBtn = useRef();

  const blurHandler = useCallback(evt => {
    if ([deleteBtn.current, cancelItemButtonsBtn.current].includes(evt.relatedTarget)) {
      return;
    }

    inactivateAndActivateItemButtons(evt, null);
  }, [inactivateAndActivateItemButtons]);

  useEffect(() => {
    const currentList = list.current;
    currentList?.addEventListener('blur', blurHandler);

    return function removeListListener(){
      currentList?.removeEventListener('blur', blurHandler);
    }
  }, [blurHandler])


  const selectedElmntRef = useRef(null);

  useEffect(() => {
    selectedElmntRef.current?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
  }, [selectedNoteId])

  function exitItemButtons(id) {
    try {
      const newItemButtonIds = Object.assign({}, itemButtonsIds);
      delete newItemButtonIds[id];
      setItemButtonsIds(newItemButtonIds);
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
                    <Button ref={deleteBtn} variant="contained" onClick={deleteItem}>Delete</Button>
                    {/*<Button type="button">Share</Button>*/}
                    <IconButton ref={cancelItemButtonsBtn} title="Cancel" onClick={evt => {inactivateAndActivateItemButtons(evt, null);}}>
                      <Cancel color="primary" sx={{fontSize: '3rem', backgroundColor: 'white', borderRadius: '0.5em'}} />
                    </IconButton>
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
      <ol ref={list} tabIndex="-1" className="list" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
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
