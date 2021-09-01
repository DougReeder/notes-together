import {createMemoryNote} from './Note';
import {semanticOnly} from './sanitizeNote';
import React, {useEffect, useState, useMemo, useCallback} from 'react';
import PropTypes from 'prop-types';
import {getNote, upsertNote} from './storage';
import sanitizeHtml from 'sanitize-html';
import "./Detail.css";
import {AppBar, Box, IconButton, Input, Toolbar} from "@material-ui/core";
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import {Alert, AlertTitle} from "@material-ui/lab";
import {createEditor, Element} from 'slate'
import { Slate, Editable, withReact} from 'slate-react';
import { withHistory } from 'slate-history';
import {withHtml, deserializeHtml, RenderingElement, Leaf, serializeHtml} from './slateHtml';


// const semanticAddMark = JSON.parse(JSON.stringify(semanticOnly));

function Detail({noteId, searchStr = "", focusOnLoadCB, setMustShowPanel}) {

  // useEffect(() => {
  //   try {
  //     if (/\S/.test(searchStr)) {
  //       semanticAddMark.textFilter = function (text, tagName) {
  //         const re = new RegExp('\\b(' + searchStr + ')', 'ig');
  //         const highlighted = '<mark>$1</mark>';
  //         const newText = text.replace(re, highlighted);
  //         return newText;
  //       }
  //     } else {
  //       delete semanticAddMark.textFilter;
  //     }
  //   } catch (err) {
  //     console.error("Detail set textFilter:", err);
  //     window.postMessage({kind: 'TRANSIENT_MSG', message: err.userMsg || err.message}, window?.location?.origin);
  //   }
  // }, [searchStr]);

  const [editorValue, setEditorValue] = useState([{
    type: 'paragraph',
    children: [{ text: 'Initial editor value' }],
  }]);
  const editor = useMemo(
      () => withHtml(withReact(withHistory(createEditor()))),
      []
  );
  const [noteDate, setNoteDate] = useState();

  useEffect(() => {
    setNoteErr(null);
    if (Number.isFinite(noteId)) {
      getNote(noteId).then(theNote => {
        if ('object' === typeof theNote) {
          replaceNote(theNote);

          if ('function' === typeof focusOnLoadCB) {
            // editable?.current?.el?.current?.focus();
            focusOnLoadCB();
          }
        } else {
          const err = new Error("no note with id=" + noteId);
          err.userMsg = "Did you delete this note in another tab?"
          err.severity = 'warning';
          setNoteErr(err);
        }
      }).catch(err => {
        switch (err.name) {
          case "SyntaxError":   // RegEx
            err.userMsg = "You can't search on that"
            err.severity = 'warning';
            break;
          default:
        }
        setNoteErr(err);
      });
    } else {
      setEditorValue([{type: 'paragraph', children: [{text: ""}]}]);
      setNoteDate(null);
    }
  }, [noteId, searchStr, focusOnLoadCB]);

  function replaceNote(theNote) {
    try {
      const html = sanitizeHtml(theNote.text, semanticOnly);
      console.log("sanitized HTML:", html);
      let slateNodes = deserializeHtml(html, editor);
      console.log("slateNodes:", slateNodes);

      // Editor can't be empty (though pasted content can be).
      if (0 === slateNodes.length) {
        slateNodes.push({type: 'paragraph', children: [{text: ""}]});
      }
      // Children of editor must be Elements.
      const containsElement = slateNodes.some(slateNode => Element.isElement(slateNode));
      if (!containsElement) {
        slateNodes = [{type: 'paragraph', children: slateNodes}];
        console.log("slateNodes encased in paragraph:", slateNodes);
      }
      setEditorValue(slateNodes);
      // Editor.normalize(editor, {force: true});
      setNoteDate(theNote.date);
    } catch (err) {
      console.error("while replacing note:", err);
      setNoteErr(err);
    }
  }

  async function handleSlateChange(newValue) {
    try {
      setNoteErr(null);
      setEditorValue(newValue);

      const isAstChange = editor.operations.some(op => 'set_selection' !== op.type);
      if (isAstChange) {
        console.log(`AST change ${noteId}:`, editor.operations.map(op => op.type), newValue);
        const html = serializeHtml(newValue);
        console.log(`HTML ${noteId}:`, html);
        await upsertNote(createMemoryNote(noteId, html, noteDate), 'DETAIL');
      } else {
        console.log("selection change:", editor.operations.map(op => op.type));
      }
    } catch (err) {
      console.error("handleSlateChange:", err);
      setNoteErr(err);
    }
  }

  async function handleDateChange(evt) {
    try {
      const year = parseInt(evt.target.value.slice(0, 4), 10);
      const month = parseInt(evt.target.value.slice(5, 7), 10);
      const day = parseInt(evt.target.value.slice(8, 10), 10);
      const newDate = new Date(year, month-1, day, noteDate.getHours(), noteDate.getMinutes(), noteDate.getSeconds(), noteDate.getMilliseconds());
      setNoteDate(newDate);
      const html = serializeHtml(editor.children);
      console.log('handleDateChange:', newDate, editor.children, html);
      await upsertNote(createMemoryNote(noteId, html, newDate), 'DETAIL');
    } catch (err) {
      console.error("Detail handleDateChange:", err);
      window.postMessage({kind: 'TRANSIENT_MSG', message: err.userMsg || err.message}, window?.location?.origin);
    }
  }

  const [noteErr, setNoteErr] = useState();

  const monthStr = ("0" + (noteDate?.getMonth()+1)).slice(-2);
  const dayStr = ("0" + noteDate?.getDate()).slice(-2);
  const dateStr = `${noteDate?.getFullYear()}-${monthStr}-${dayStr}`;

  const externalChangeListener = evt => {
    try {
      if (evt.origin !== window.location.origin || evt.data?.kind !== 'NOTE_CHANGE' ||
          'DETAIL' === evt.data?.initiator) return;
      const notesChanged = evt.data?.notesChanged || {};
      if (! notesChanged.hasOwnProperty(noteId)) return;
      console.log("Detail externalChange", notesChanged);

      setNoteErr(null);
      replaceNote(notesChanged[noteId]);
    } catch (err) {
      setNoteErr(err);
    }
  };
  useEffect( () => {
    window.addEventListener("message", externalChangeListener);

    return function removeExternalChangeListener() {
      window.removeEventListener("message", externalChangeListener);
    };
  });

  const renderElement = useCallback(props => <RenderingElement {...props} />, [])
  const renderLeaf = useCallback(props => <Leaf {...props} />, [])

  let content;
  if (noteErr) {
    content = (<Alert severity={noteErr.severity || "error"} style={{margin: "2ex"}}>
      <AlertTitle>{noteErr?.userMsg || "Restart your device"}</AlertTitle>
      {noteErr?.message || noteErr?.name || noteErr?.toString()}
    </Alert>);
  } else if (!noteDate) {
    content = (<svg fill="none" strokeLinecap="square" strokeMiterlimit="10" viewBox="0 0 226.77 226.77" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(8.964 4.2527)" fillRule="evenodd" stroke="#000" strokeLinecap="butt" strokeLinejoin="round" strokeWidth="4">
            <path d="m63.02 200.61-43.213-174.94 173.23 49.874z"></path>
            <path d="m106.39 50.612 21.591 87.496-86.567-24.945z"></path>
            <path d="m84.91 125.03-10.724-43.465 43.008 12.346z"></path>
            <path d="m63.458 38.153 10.724 43.465-43.008-12.346z"></path>
            <path d="m149.47 62.93 10.724 43.465-43.008-12.346z"></path>
            <path d="m84.915 125.06 10.724 43.465-43.008-12.346z"></path>
          </g>
        </svg>
    );
  } else {
    content = (
      <Slate editor={editor} value={editorValue} onChange={handleSlateChange} >
        <Editable
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            placeholder="Type or paste some text or an image."
        />
      </Slate>
    );
  }

  return (<Box style={{height: "100%"}} display="flex" flexDirection="column" alignItems="stretch" bgcolor="background.paper">
      <AppBar position="sticky" style={{flexGrow: 0, backgroundColor: "#ccc"}}>
        <Toolbar display="flex" style={{justifyContent: "space-between"}}>
          <IconButton className="narrowLayoutOnly" edge="start" onClick={setMustShowPanel?.bind(this, 'LIST')} >
            <ArrowBackIcon />
          </IconButton>
          {Boolean(noteDate) && ! noteErr ? <Input type="date" value={dateStr} onChange={handleDateChange} /> : null}
        </Toolbar>
      </AppBar>
      <Box style={{overflowY: "auto", flexGrow: 1, flexShrink: 1, backgroundColor: "#fff"}}>
        {content}
      </Box>
  </Box>);
}

Detail.propTypes = {
  noteId: PropTypes.number,
  searchStr: PropTypes.string,
  focusOnLoadCB: PropTypes.func,
};

export default Detail;
