import {createMemoryNote} from './Note';
import {semanticOnly} from './sanitizeNote';
import React, {useEffect, useState, useMemo, useCallback, useReducer} from 'react';
import PropTypes from 'prop-types';
import {useViewportScrollCoords} from 'web-api-hooks';
import {getNote, upsertNote} from './storage';
import sanitizeHtml from 'sanitize-html';
import "./Detail.css";
import {AppBar, Box, IconButton, Input, MenuItem, Select, Toolbar} from "@material-ui/core";
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import FormatBoldIcon from '@material-ui/icons/FormatBold';
import FormatItalicIcon from '@material-ui/icons/FormatItalic';
import CodeIcon from '@material-ui/icons/Code';
import {Alert, AlertTitle} from "@material-ui/lab";
import {createEditor, Editor, Element as SlateElement} from 'slate'
import {Slate, Editable, withReact, ReactEditor} from 'slate-react';
import { withHistory } from 'slate-history';
import {withHtml, deserializeHtml, RenderingElement, Leaf, serializeHtml} from './slateHtml';
import isHotkey from 'is-hotkey';
import {getRelevantBlockType, changeBlockType} from "./slateUtil";
import {visualViewportMatters} from "./util";


// const semanticAddMark = JSON.parse(JSON.stringify(semanticOnly));

function Detail({noteId, searchStr = "", focusOnLoadCB, setMustShowPanel}) {
  const [viewportScrollX, viewportScrollY] = useViewportScrollCoords();

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
  const [editableKey, setEditableKey] = useState(Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER));
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
            setTimeout(() => {
              focusOnLoadCB();
              ReactEditor.focus(editor);
            }, 4);
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
  }, [noteId, searchStr, focusOnLoadCB, editor]);

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
      const containsElement = slateNodes.some(slateNode => SlateElement.isElement(slateNode));
      if (!containsElement) {
        slateNodes = [{type: 'paragraph', children: slateNodes}];
        console.log("slateNodes encased in paragraph:", slateNodes);
      }
      setEditableKey(Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER));
      setEditorValue(slateNodes);
      // Editor.normalize(editor, {force: true});
      setNoteDate(theNote.date);
    } catch (err) {
      console.error(`while replacing note ${theNote.id}:`, err);
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
        forceUpdate();   // updates the mark indicators
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

  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Defines our own custom set of helpers.
  function isMarkActive(editor, format) {
    const marks = Editor.marks(editor);
    return marks ? marks[format] === true : false
  }

  function toggleMark(editor, format) {
    const isActive = isMarkActive(editor, format)

    if (isActive) {
      Editor.removeMark(editor, format)
    } else {
      Editor.addMark(editor, format, true)
    }
    forceUpdate();   // so buttons can change colors
  }

  const selectedBlockType = getRelevantBlockType(editor);
  console.log(`selectedBlockType: "${selectedBlockType}"`);

  function handleSelectedBlockTypeChange(evt) {
    const targetType = evt.target.value;
    console.log(`${selectedBlockType} -> ${targetType}`);
    switch (targetType) {
      default:
        changeBlockType(editor, targetType);
        return;
      case 'multiple':
      case 'list-item':
      case 'image':
      case 'n/a':
      case '':
        return;
    }
  }

  let content;
  let noteControls = null;
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
            key={editableKey}   // change the key to restart editor w/ new editorValue
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            placeholder="Type or paste some text or an image."
            onKeyDown={evt => {
              switch (evt.key) {   // eslint-disable-line default-case
                case 'Enter':
                  if (evt.shiftKey || isHotkey('mod+Enter', { byKey: true }, evt)) {
                    evt.preventDefault();
                    editor.insertText('\n');
                  }
                  break;
                case 'i':
                  if (isHotkey('mod+i', { byKey: true }, evt)) {
                    evt.preventDefault()
                    toggleMark(editor, 'italic');
                  }
                  break;
                case 'b':
                  if (isHotkey('mod+b', { byKey: true }, evt)) {
                    evt.preventDefault()
                    toggleMark(editor, 'bold');
                  }
                  break;
                case '`': {
                  if (isHotkey('mod+`', { byKey: true }, evt)) {
                    evt.preventDefault()
                    toggleMark(editor, 'code');
                  } else if (isHotkey('mod+shift+`', evt)) {
                    evt.preventDefault();
                    changeBlockType(editor, 'code');
                  }
                  break;
                }
              }
            }}
        />
      </Slate>
    );
    noteControls = (<>
      <Input type="date" value={dateStr} onChange={handleDateChange}/>
      <IconButton aria-label="Format italic"
                  color={isMarkActive(editor, 'italic') ? 'primary' : 'default'}
                  onMouseDown={evt => {
                    evt.preventDefault();
                    toggleMark(editor, 'italic');
                    // ReactEditor.focus(editor);
                  }}>
        <FormatItalicIcon/>
      </IconButton>
      <IconButton aria-label="Format bold"
                  color={isMarkActive(editor, 'bold') ? 'primary' : 'default'}
                  onMouseDown={evt => {
                    evt.preventDefault();
                    toggleMark(editor, 'bold');
                    // ReactEditor.focus(editor);
                  }}>
        <FormatBoldIcon/>
      </IconButton>
      <IconButton aria-label="Format monospaced"
                  color={isMarkActive(editor, 'code') ? 'primary' : 'default'}
                  onMouseDown={evt => {
                    evt.preventDefault();
                    toggleMark(editor, 'code');
                    // ReactEditor.focus(editor);
                  }}>
        <CodeIcon/>
      </IconButton>
      <Select
          labelId="type-select-label"
          id="type-select"
          value={selectedBlockType}
          onChange={handleSelectedBlockTypeChange}
          style={{minWidth: '15ch'}}
      >
        <MenuItem value={'paragraph'}>Body</MenuItem>
        <MenuItem value={'quote'}>Block Quote</MenuItem>
        <MenuItem value={'code'}><code>Monospaced</code></MenuItem>
        <MenuItem value={'bulleted-list'}>• Bulleted List</MenuItem>
        <MenuItem value={'numbered-list'}>1. Numbered List</MenuItem>
        <MenuItem value={'heading-one'}><h1>Title</h1></MenuItem>
        <MenuItem value={'heading-two'}><h2>Heading</h2></MenuItem>
        <MenuItem value={'heading-three'}><h3>Subheading</h3></MenuItem>
        <MenuItem value={'heading-four'}><h4>Subheading 4</h4></MenuItem>
        <MenuItem value={'heading-five'}><h5>Subheading 5</h5></MenuItem>
        <MenuItem value={'heading-six'}><h6>Subheading 6</h6></MenuItem>
        {/*<MenuItem value={'thematic-break'}>Thematic break</MenuItem>*/}
        <MenuItem value={'image'}>(Image)</MenuItem>
        <MenuItem value={'multiple'}>(Multiple)</MenuItem>
        <MenuItem value={'n/a'}>(n/a)</MenuItem>
      </Select>
    </>);
  }

  const toolbarStyle = {flexGrow: 0, backgroundColor: "#ccc"};
  if (visualViewportMatters()) {
    toolbarStyle.transform = `translate(${viewportScrollX}px, ${viewportScrollY}px)`;
  }

  return (<>
      <AppBar position="sticky" style={toolbarStyle}>
        <Toolbar display="flex" style={{justifyContent: "space-between"}}>
          <IconButton className="narrowLayoutOnly" edge="start" onClick={setMustShowPanel?.bind(this, 'LIST')} >
            <ArrowBackIcon />
          </IconButton>
          {Boolean(noteDate) && ! noteErr ? noteControls : null}
        </Toolbar>
      </AppBar>
      <Box style={{overflowY: "auto", flexGrow: 1, flexShrink: 1, backgroundColor: "#fff"}}>
        {content}
      </Box>
  </>);
}

Detail.propTypes = {
  noteId: PropTypes.number,
  searchStr: PropTypes.string,
  focusOnLoadCB: PropTypes.func,
};

export default Detail;
