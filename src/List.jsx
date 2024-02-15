// List.js - List component for Notes Together
// Copyright © 2021–2024 Doug Reeder

import {validate as uuidValidate} from "uuid";
import {updateListWithChanges} from "./listUtil";
import {findStubs, deleteNote, init, getNote} from "./storage";
import {useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle} from 'react';
import PropTypes from 'prop-types';
import './List.css';
import {CSSTransition} from "react-transition-group";
import humanDate from "./util/humanDate";
import {Button, IconButton} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {extractUserMessage, transientMsg} from "./util/extractUserMessage";
import InstallCheck from "./InstallCheck.jsx";
import {shortenTitle} from "./Note.js";
import {sharingContent, wrapInFile} from "./util/sharingContent.js";
import {NonmodalDialog} from "./NonmodalDialog.jsx";
import {extractSubtype} from "./util.js";

const LONG_PRESS_DURATION = 500;   // ms

const List = forwardRef( function List (props, imperativeRef) {
  const {searchWords = new Set(), changeCount, selectedNoteId, handleSelect} = props;

  const DEFAULT_SHARE = 'function' === typeof navigator.share ? "Share file" : "Send text via email";

  const [listErr, setListErr] = useState(null);
  const [notes, setNotes] = useState([]);

  const [itemButtonsIds, setItemButtonsIds] = useState({});

  const exitItemButtons = useCallback(id => {
    try {
      const newItemButtonIds = Object.assign({}, itemButtonsIds);
      delete newItemButtonIds[id];
      setItemButtonsIds(newItemButtonIds);
    } catch (err) {
      console.error("exitItemButtons:", err);
      transientMsg(extractUserMessage(err));
    }
  }, [itemButtonsIds]);

  useEffect(() => {
    // console.log("launching search")
    findStubs(searchWords, callback);

    function callback(err, notes, {isPartial, _isFinal} = {}) {
      try {
        if (err) {
          return setListErr(err);
        } else {
          setListErr(null);
        }
        // console.log(`search returned with ${notes?.length} notes`);

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

      // console.log("List externalChange", isChanged, notesChanged, notesDeleted);
      if (isChanged) {
        setNotes(newNotes);
        changeCount(newNotes.length);
      }
    } catch (err) {
      console.error("externalChangeListener:", err);
      transientMsg(extractUserMessage(err));
    }
  };
  useEffect( () => {
    window.addEventListener("message", externalChangeListener);
    navigator.serviceWorker?.addEventListener('message', externalChangeListener);

    return function removeExternalChangeListener() {
      window.removeEventListener("message", externalChangeListener);
      navigator.serviceWorker?.removeEventListener('message', externalChangeListener);
    };
  });

  const list = useRef();

  const inactivateAndActivateItemButtons = useCallback(
      (evt, newActiveId) => {
    setItemButtonsIds(oldItemButtonIds => {
      const newItemButtonIds = {};
      for (const [id, isActive] of Object.entries(oldItemButtonIds)) {
        if (isActive) {
          newItemButtonIds[id] = false;
          evt?.stopPropagation();   // Escape key handled
        }   // discards inactive entries
      }
      if (newActiveId) {
        evt?.stopPropagation();
        newItemButtonIds[newActiveId] = true;
        list.current?.focus();
      }
      return newItemButtonIds;
    });
  }, []);

  const pointerRef = useRef({});

  function handlePointerDown(evt) {
    try {
      if (pointerRef.current.longPressTimeoutId) {   // long-press in progress
        clearTimeout(pointerRef.current.longPressTimeoutId);   // prevent long-press
      }
      if (0 !== evt.button || evt.target.closest("button")) {
        return;
      }
      const noteEl = evt.target.closest("li.summary");
      const id = noteEl?.dataset?.id;
      pointerRef.current = uuidValidate(id) ?
          {
            downId: id,
            longPressTimeoutId: setTimeout(longPress, LONG_PRESS_DURATION),
            downScroll: list.current?.scrollTop
          } :
          {};
      function longPress() {
        if (Math.abs(list.current?.scrollTop - pointerRef.current?.downScroll) < 63) {
          inactivateAndActivateItemButtons(evt, id);
          actionToConfirm.current = DEFAULT_SHARE;
        }
        pointerRef.current = {suppressClickId: id};
      }
    } catch (err) {
      console.error("handlePointerDown:", err);
      transientMsg(extractUserMessage(err));
    }
  }

  function handlePointerUp(_evt) {
    try {
      if (pointerRef.current.longPressTimeoutId) {   // long-press hasn't happened
        clearTimeout(pointerRef.current.longPressTimeoutId);   // prevent long-press
      }
    } catch (err) {
      console.error("handlePointerUp:", err);
      transientMsg(extractUserMessage(err));
    } finally {
      pointerRef.current = {...(pointerRef.current.suppressClickId && { suppressClickId: pointerRef.current.suppressClickId })};
    }
  }

  function handleClick(evt) {
    const noteEl = evt.target.closest("li.summary");
    const id = noteEl?.dataset?.id;
    if (1 === evt.detail && !evt.target.closest("div.itemButtons")) {   // single-click, not item button
      if (id && id === pointerRef.current.suppressClickId) {
        evt.preventDefault();
        evt.stopPropagation();
        pointerRef.current = {};
      } else if (id) {   // clicked on list item
        handleSelect(id, 'DETAIL');
      } else {   // clicked on list below items
        handleSelect(null, undefined);
        inactivateAndActivateItemButtons(evt, null);
      }
    }
  }

  function handleContextMenu(evt) {
    try {
      const noteEl = evt.target.closest("li.summary");
      const id = noteEl?.dataset?.id;
      if (id) {
        evt.preventDefault();   // prevents browser content menu
        actionToConfirm.current = DEFAULT_SHARE;
      }
      inactivateAndActivateItemButtons(evt, id);
    } catch (err) {
      console.error("handleContextMenu:", err);
    }
  }

  useImperativeHandle(imperativeRef, () => {
    return {
      showSelectedItemButtons() {
        if (selectedNoteId) {
          inactivateAndActivateItemButtons(null, selectedNoteId);
          actionToConfirm.current = DEFAULT_SHARE;
        }
      },
    };
  }, [selectedNoteId, inactivateAndActivateItemButtons, DEFAULT_SHARE]);

  useEffect(() => {
    try {
      const entry = Object.entries(itemButtonsIds).find(([, active]) => active)
      if (entry) {
        const buttons = Array.from(document.querySelectorAll(`li[data-id="${entry[0]}"] button`));
        const buttonToConfirm = buttons.find(button => actionToConfirm.current === button.innerHTML);
        buttonToConfirm?.focus();
        actionToConfirm.current = '';
      }
    } catch (err) {
      console.error("while focusing after itemButtonIds changed:", err);
    }
  }, [selectedNoteId, itemButtonsIds])

  const actionToConfirm = useRef('');

  const documentKeyListener = useCallback(async evt => {
    if (![document.body, list.current].includes(document.activeElement) ) {
      return;
    }
    if (evt.target.dataset.slateEditor || evt.isComposing || evt.keyCode === 229) {
      return;
    }
    switch (evt.key) {
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
        if (selectedNoteId && (evt.ctrlKey || evt.metaKey)) {
          actionToConfirm.current = 'Delete';
          inactivateAndActivateItemButtons(evt, selectedNoteId);
        }
        break;
      case '.':
        if (!(evt.ctrlKey || evt.metaKey)) { return; }
        /* fallthrough */
      case 'ContextMenu':
        if (selectedNoteId) {
          actionToConfirm.current = DEFAULT_SHARE;
          inactivateAndActivateItemButtons(evt, selectedNoteId);
        }
        break;
      case ',':
        if (selectedNoteId && (evt.ctrlKey || evt.metaKey)) {
          actionToConfirm.current = 'function' === typeof navigator.share ? "Share text" : "Send text via email";
          inactivateAndActivateItemButtons(evt, selectedNoteId);
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
  }, [handleSelect, notes, selectedNoteId, inactivateAndActivateItemButtons, DEFAULT_SHARE]);
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
    switch (evt.code) {
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


  const handleBlur = useCallback(evt => {
    if (!evt.relatedTarget?.closest("ol.list")) {   // element being focussed is outside list
      inactivateAndActivateItemButtons(evt, null);
    }
  }, [inactivateAndActivateItemButtons]);


  const selectedElmntRef = useRef(null);

  useEffect(() => {
    if ('function' === typeof selectedElmntRef.current?.scrollIntoView) {   // workaround for vitest?/jsdom? issue
      selectedElmntRef.current?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    }
  }, [selectedNoteId])

  async function deleteItem(evt) {
    let id;
    try {
      evt.preventDefault();
      evt.stopPropagation();
      const noteEl = evt.target.closest("li.summary");
      id = noteEl?.dataset?.id;
      await deleteNote(id);
      exitItemButtons(id);
      if (id === selectedNoteId) {
        handleSelect(null);
      }
    } catch (err) {
      console.error(`deleteItem [${id}]:`, err);
      transientMsg(extractUserMessage(err), err.severity);
    } finally {
      inactivateAndActivateItemButtons(evt, null);
    }
  }

  const [sharingIssue, setSharingIssue] = useState(null);

  /**
   * Attempts to use Web Share API and calls setSharingIssue if there's a problem
   * @param {Event} evt
   * @param {boolean} useShare
   * @param {boolean} includeFile
   * @returns {Promise<void>}
   */
  async function shareItem(evt, useShare, includeFile = true) {
    let id, note, shareTitle, data;
    try {
      evt.preventDefault();
      evt.stopPropagation();
      id = evt.target.closest("li.summary")?.dataset?.id;
      note = await getNote(id);
      if (note) {
        shareTitle = note.title?.split(/\r\n|\n|\r/)?.[0]?.replace(/[<>\\/^•]/g, " ").trim().slice(0, 90) || "«note»";
        const text = sharingContent(note);
        const file = includeFile ? wrapInFile(note) : null;
        data = { title: shareTitle, text: text, ...(file && { files: [file] })};
        await tryShare(data, useShare);
      } else {
        console.error(`Note [${id}] not in database`);
        transientMsg("Did you delete this note in another tab?");
      }
    } catch (err) {
      const label = note?.title ? `“${shortenTitle(note?.title)}”` : `[${id}]`;
      console.error(`unforeseen error preparing share ${label}:`, err);
      transientMsg("Report this to developer:" + extractUserMessage(err));
    } finally {
      inactivateAndActivateItemButtons(evt, null);
    }
  }

  /**
   * Uses args to try share or use mailto: URL. Sets sharingIssue to new value.
   * @param {Object} data
   * @param {string} data.title
   * @param {string} data.text
   * @param {File[]} [data.files]
   * @param {boolean} useShare
   * @returns {Promise<void>}
   */
  async function tryShare(data, useShare) {
    try {
      if (useShare) {
        if (!navigator.canShare(data)) {
          if (data?.files) {   // Drops file from share; user can cancel at Share dialog
            console.warn("The browser does not allow sharing files.");
            transientMsg("The browser only allowed a text version to be shared.", 'warning', true);
            data = { title: data.title, text: data.text };   // presumes files are the reason
          } else {   // Shows dialog before proceeding; cancelling email is awkward
            console.error("Permission to Share has not been granted.");
            setSharingIssue({dialogTitle: `Send text version of “${data.title}” via email?`,
              message: "Permission to Share has not been granted.", useShare: false, data});
            return;
          }
        }
        console.info(`trying share:`, data);
        await navigator.share(data);
        setSharingIssue(null);
      } else {
        const url =
          `mailto:?subject=${encodeURIComponent(data.title)}&body=${encodeURIComponent(data.text)}`;
        setSharingIssue(null);
        console.info("sending via:", url);

        const a = document.createElement('a');
        a.href = url;
        a.target= '_blank';
        a.rel = 'noreferrer';
        a.referrerPolicy = 'no-referrer';
        a.click();
      }
    } catch (err) {
      if ('AbortError' === err.name) {
        console.info(`user aborted sharing “${sharingIssue?.data?.title}”:`, err);
        setSharingIssue(null);
      } else if ('NotAllowedError' === err.name && data?.files?.length > 0) {
        const oldFile = data.files?.[0];
        console.error(`Permission to share “${data.title}” as ${oldFile?.type} file wasn't granted.`, err);
        if (oldFile?.type?.startsWith('text/')
          && ! ['text/plain', 'text/html', 'text/css', 'text/csv'].includes(oldFile?.type)) {
          const newData ={ title: data.title, text: data.text,
            files: [new File([oldFile], oldFile.name + '.txt',
              {type: 'text/plain', endings: 'native' /*, lastModified: note.lastEdited*/})] };
          const subtype = extractSubtype(oldFile?.type) || 'unknown';
          setSharingIssue({dialogTitle: `Share “${data.title}” as plain text file?`,
            message: `You aren't allowed to Share that as a ${subtype} file.`, useShare: true, data: newData});
        } else {
          const newData = { title: data.title, text: data.text };
          setSharingIssue({dialogTitle: `Share text version of “${data.title}” without file?`,
            message: "You aren't allowed to Share that as a file.", useShare: true, data: newData});
        }
      } else {
        console.error(`tried share “${data?.title}”:`, err);
        const message = 'NotAllowedError' === err.name ? "You aren't allowed to Share that." : extractUserMessage(err);
        setSharingIssue({dialogTitle: `Send text version of “${data?.title}” via email?`,
          message, useShare: false, data});
      }
    }
  }

  const [isFirstLaunch, setIsFirstLaunch] = useState(false);

  useEffect( () => {
    async function checkFirstLaunch() {
      const {isFirstLaunch} = await init();   // init is idempotent
      setIsFirstLaunch(isFirstLaunch);
    }
    checkFirstLaunch().catch(err => {
      console.error("Error launching:", err);
      transientMsg("Restart your browser — error launching");

    });
  }, []);

  const [gettingStartedDisplayed, setGettingStartedDisplayed] = useState(true);

  function hideGettingStarted(evt) {
    evt.stopPropagation();
    setGettingStartedDisplayed(false);
  }

  const adviceGettingStarted = <>
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'end'}}>
      <h2>Free your mind from mundane details!</h2>
      <IconButton title="Close" aria-label="Close" size="large" onClick={hideGettingStarted}>
        <CloseIcon/>
      </IconButton>
    </div>
    <p><b>Toss in text and pictures</b> — take a photo or use voice dictation. Paste or drag a message or article (with its pictures) into the editor pane. Drag files into the list pane.</p>
    <p><b>Find any note</b> on any device — type to search for any words in the note, or tap to select a saved tag.</p>
    <p><b>Connect Your Storage</b> below︎ to take control of your data.</p>
    <p><b>Never spend time tidying up</b> — unless you want to!</p>
  </>;

  let listItems;
  if (listErr) {
    listItems = <div className="error"><h2>Close and re-open this tab</h2>{listErr.message}</div>
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
            listItems.push(<li className="divider" role="separator" key={Math.random()}>
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
            titleDiv = <div className="title" id={'title-'+note.id}>{titleLines[0]}<br/>{titleLines[1]}</div>
          } else {
            titleDiv = <div className="title untitled">Untitled</div>
          }
          let itemButtons;
          if (note.id in itemButtonsIds) {
            itemButtons = (
                <CSSTransition in={itemButtonsIds[note.id]} appear={true} timeout={333} classNames="slideFromLeft" onExited={() => {exitItemButtons(note.id)}}>
                  <div className="itemButtons">
                    <Button variant="contained" color="warning" onClick={deleteItem}>Delete</Button>
                    {'function' === typeof navigator.share ?
                      <>
                        <Button variant="contained" onClick={evt => shareItem(evt, true, false)}>Share text</Button>
                        <Button variant="contained" onClick={evt => shareItem(evt, true, true)}>Share file</Button>
                      </> :
                      <Button variant="contained" onClick={evt => shareItem(evt, false, false)}>Send text via email</Button>}
                  </div>
                </CSSTransition>);
          }
          listItems.push(
            note.id === selectedNoteId ?
              <li data-id={note.id} key={note.id} ref={selectedElmntRef}
                  className="summary selected" aria-labelledby={'title-'+note.id}>
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
    if (isFirstLaunch && notes.length < 16 && 0 === searchWords.size && gettingStartedDisplayed) {
      listItems.push(<div key="advice" className="advice trailing" onClick={handleSelect.bind(this, undefined, 'HELP')}>{adviceGettingStarted}</div>);
    }
  } else {
    if (searchWords.size > 0) {
      listItems = <div className="advice solo" onClick={handleSelect.bind(this, undefined, 'HELP')}>
        <h2>No Matching Notes</h2>
        Try just the first few letters of your search word(s), or synonyms of them.
      </div>
    } else {
      listItems = isFirstLaunch && gettingStartedDisplayed ?
          <div className="advice solo" onClick={handleSelect.bind(this, undefined, 'HELP')}>{adviceGettingStarted}</div> :
          null;
    }
  }

  return <>
      <ol ref={list} tabIndex="-1" className="list" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onClick={handleClick} onContextMenu={handleContextMenu} onBlur={handleBlur} aria-label="note titles">
        {listItems}
      </ol>
      <NonmodalDialog open={Boolean(sharingIssue?.dialogTitle)}
                      title={sharingIssue?.dialogTitle || ""} message={sharingIssue?.message || ""}
                      okName={sharingIssue?.useShare ? "Share" : "Send email"}
                      onOk={() => tryShare(sharingIssue.data, sharingIssue.useShare)}
                      onCancel={() => setSharingIssue(null)} ></NonmodalDialog>
      <InstallCheck notesLength={notes.length} isFirstLaunch={isFirstLaunch}></InstallCheck>
    </>;
});

List.propTypes = {
  searchWords: PropTypes.instanceOf(Set),
  changeCount: PropTypes.func.isRequired,
  selectedNoteId: PropTypes.string,
  handleSelect: PropTypes.func.isRequired,
}

export default List;
