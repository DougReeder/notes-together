import {validate as uuidValidate} from 'uuid';
import {createMemoryNote} from './Note';
import {semanticOnly} from './sanitizeNote';
import React, {useEffect, useState, useMemo, useCallback, useReducer, useRef} from 'react';
import PropTypes from 'prop-types';
import {ErrorBoundary} from 'react-error-boundary'
import useViewportScrollCoords from './web-api-hooks/useViewportScrollCoords';
import {getNote, upsertNote} from './storage';
import sanitizeHtml from 'sanitize-html';
import "./Detail.css";
import {
  AppBar,
  Box,
  Button,
  Dialog, DialogActions, DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Input,
  MenuItem,
  Select,
  Toolbar, Checkbox
} from "@material-ui/core";
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import FormatBoldIcon from '@material-ui/icons/FormatBold';
import FormatItalicIcon from '@material-ui/icons/FormatItalic';
import CodeIcon from '@material-ui/icons/Code';
import FormatUnderlinedIcon from '@material-ui/icons/FormatUnderlined';
import {StrikethroughS} from "@material-ui/icons";
import {Alert, AlertTitle} from "@material-ui/lab";
import {createEditor, Editor, Element as SlateElement, Node as SlateNode, Transforms, Range as SlateRange} from 'slate'
import {Slate, Editable, withReact, ReactEditor} from 'slate-react';
import { withHistory } from 'slate-history';
import {withHtml, deserializeHtml, RenderingElement, Leaf, serializeHtml} from './slateHtml';
import isHotkey from 'is-hotkey';
import {getRelevantBlockType, changeBlockType, changeContentType} from "./slateUtil";
import {isLikelyMarkdown, visualViewportMatters} from "./util";
import hasTagsLikeHtml from "./util/hasTagsLikeHtml";
import {extractUserMessage} from "./util/extractUserMessage";


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
  //     window.postMessage({kind: 'TRANSIENT_MSG', message: extractUserMessage(err)}, window?.location?.origin);
  //   }
  // }, [searchStr]);

  const loadingIdRef = useRef(NaN);
  const ignoreChangesUntilReloadRef = useRef(false);
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
  const [effectiveSubtype, setEffectiveSubtype] = useState();

  const replaceNote = useCallback(theNote => {
    try {
      ignoreChangesUntilReloadRef.current = false;
      let slateNodes;
      if (hasTagsLikeHtml(theNote.mimeType)) {
        editor.subtype = 'html;hint=SEMANTIC';
        const html = sanitizeHtml(theNote.content, semanticOnly);
        console.log("sanitized HTML:", html);
        slateNodes = deserializeHtml(html, editor);
      } else if (!theNote.mimeType || /^text\//.test(theNote.mimeType)) {
        editor.subtype = /\/(.+)/.exec(theNote.mimeType)?.[1];
        slateNodes = theNote.content.split("\n").map(line => {return {type: 'paragraph', children: [{text: line}]}});
      } else {
        throw new Error("Can't display this type of note");
      }
      console.log("replacing slateNodes:", slateNodes);

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
      Transforms.deselect(editor);
      setPreviousSelection(null);
      setPreviousBlockType('n/a');
      setEditableKey(Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER));
      setEditorValue(slateNodes);
      // Editor.normalize(editor, {force: true});
      setNoteDate(theNote.date);
    } catch (err) {
      console.error(`while replacing note ${theNote.id}:`, err);
      setNoteErr(err);
    }
  }, [editor]);

  useEffect(() => {
    setNoteErr(null);
    if (uuidValidate(noteId)) {
      if (noteId === loadingIdRef.current) {
        return;
      }
      loadingIdRef.current = noteId;
      getNote(noteId).then(theNote => {
        loadingIdRef.current = NaN;
        if ('object' === typeof theNote) {
          replaceNote(theNote);

          if ('function' === typeof focusOnLoadCB) {
            focusOnLoadCB();
            ReactEditor.focus(editor);
            Transforms.select(editor, Editor.start(editor, []));
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
  }, [noteId, replaceNote, focusOnLoadCB, editor]);

  const [previousSelection, setPreviousSelection] = useState(null);
  const [previousBlockType, setPreviousBlockType] = useState('n/a');


  async function handleSlateChange(newValue) {
    try {
      if (ignoreChangesUntilReloadRef.current) {return;}

      setNoteErr(null);
      setEditorValue(newValue);

      const isAstChange = editor.operations.some(op => 'set_selection' !== op.type);
      if (isAstChange) {
        console.log(`AST change ${noteId}:`, editor.operations.map(op => op.type), newValue);
        await save(noteDate);
      } else {
        forceUpdate();   // updates the mark indicators
        console.log("selection change:", editor.operations.map(op => op.type));
      }

      if (editor.selection) {
        // For a Slate Range (or null), JSON is good enough (and deep clones).
        const copiedSelection = JSON.parse(JSON.stringify(editor.selection));
        setPreviousSelection(copiedSelection);
        setPreviousBlockType(getRelevantBlockType(editor));
        // console.log("copiedSelection:", JSON.stringify(copiedSelection));
      } else {
        console.log("not copying selection:", editor.selection);
      }
    } catch (err) {
      console.error("handleSlateChange:", err);
      setNoteErr(err);
      setPreviousSelection(null);
      setPreviousBlockType('n/a');
    }
  }

  async function handleDateChange(evt) {
    try {
      const year = parseInt(evt.target.value.slice(0, 4), 10);
      const month = parseInt(evt.target.value.slice(5, 7), 10);
      const day = parseInt(evt.target.value.slice(8, 10), 10);
      const newDate = new Date(year, month-1, day, noteDate.getHours(), noteDate.getMinutes(), noteDate.getSeconds(), noteDate.getMilliseconds());
      setNoteDate(newDate);
      console.log('handleDateChange:', newDate);
      await save(newDate);
    } catch (err) {
      console.error("Detail handleDateChange:", err);
      window.postMessage({kind: 'TRANSIENT_MSG', message: extractUserMessage(err)}, window?.location?.origin);
    }
  }

  async function save(date) {
    let content;
    if (editor.subtype?.startsWith('html')) {
      content = serializeHtml(editor.children);
      console.log('save HTML:', noteId, editor.children, content, date);
    } else {
      content = editor.children.map(node => SlateNode.string(node)).join('\n')
      console.log('save text:', noteId, editor.children, content, date);
    }
    await upsertNote(createMemoryNote(noteId, content, date, editor.subtype ? 'text/'+editor.subtype : undefined), 'DETAIL');
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

  function handleSelectedBlockTypeChange(evt) {
    // console.log("handleSelectedBlockTypeChange previousSelection:", JSON.stringify(previousSelection))
    const targetType = evt.target.value;
    if ('change-note-type' === targetType) {
      setEffectiveSubtype('html');
      setIsContentTypeDialogOpen(true);
      return;
    }

    if (previousSelection) {
      Transforms.select(editor, previousSelection);
      ReactEditor.focus(editor);
      if (['image', 'link'].indexOf(previousBlockType) > -1) {
        window.postMessage({kind: 'TRANSIENT_MSG', severity: 'warning', message: "Only text blocks can be changed."}, window?.location?.origin);
        return;
      }
      // console.log(`${previousBlockType} -> ${targetType}`);
      switch (targetType) {
        default:
          changeBlockType(editor, targetType);
          queueMicrotask(() => {
            ReactEditor.focus(editor);
          });
          return;
        case 'multiple':
        case 'list-item':
        case 'image':
        case 'n/a':
        case '':
          window.postMessage({kind: 'TRANSIENT_MSG', severity: 'warning', message: "That wouldn't make sense."}, window?.location?.origin);
          return;
      }
    } else {
      window.postMessage({kind: 'TRANSIENT_MSG', severity: 'warning', message: "nothing selected"}, window?.location?.origin);
    }
  }

  const [isContentTypeDialogOpen, setIsContentTypeDialogOpen] = useState(false);

  function handleEffectiveCheckbox(evt, isMarkdown) {
    setEffectiveSubtype(isMarkdown ? 'markdown' : 'plain');
  }

  async function handleChangeContentType(newSubtype) {
    ignoreChangesUntilReloadRef.current = true;
    await changeContentType(editor, effectiveSubtype, newSubtype, noteId, noteDate);
    setIsContentTypeDialogOpen(false);
  }

  let content;
  let noteControls = null;
  if (noteErr) {
    content = (<Alert severity={noteErr.severity || "error"} style={{margin: "2ex"}}>
      <AlertTitle>{noteErr?.userMsg || "Restart your device"}</AlertTitle>
      {noteErr?.message || noteErr?.name || noteErr?.toString()}
    </Alert>);
  } else if (!noteDate) {
    content = (<>
      <div style={{width: '100%', height: '100%', backgroundImage: 'url(' + process.env.PUBLIC_URL + '/icons/NotesTogether-icon-gray.svg)',
        backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat'}}></div>
      <div style={{position: 'absolute', bottom: '2em', left: '0', right: '0', textAlign: 'center', color: '#616161' }}>Select a note on the left to display it in full.</div>
    </>);
  } else {
    content = (<>
      <Slate editor={editor} value={editorValue} onChange={handleSlateChange} >
        <Editable
            key={editableKey}   // change the key to restart editor w/ new editorValue
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            placeholder="Type or paste some text or an image."
            className={editor.subtype?.startsWith('html') ? null : "unformatted"}
            onKeyDown={evt => {
              switch (evt.key) {   // eslint-disable-line default-case
                case 'Enter':
                  if (isHotkey('mod+Enter', { byKey: true }, evt)) {
                    evt.preventDefault();
                    editor.insertText('\n');
                  } else if (SlateRange.isCollapsed(editor.selection)) {
                    const textNode = SlateNode.get(editor, editor.selection?.anchor?.path);
                    const parentPath = editor.selection?.anchor?.path?.slice(0, -1);
                    const parentElmnt = SlateNode.get(editor, parentPath);
                    if (['heading-one', 'heading-two', 'heading-three'].includes(parentElmnt.type)) {
                      evt.preventDefault();
                      const newPath = [...parentPath.slice(0, -1), parentPath[parentPath.length-1]+1];
                      Transforms.insertNodes(editor, {type: 'paragraph', children: [{text: ""}]}, {at: newPath});
                      Transforms.select(editor, {anchor: {path: [...newPath, 0], offset: 0}, focus: {path: [...newPath, 0], offset: 0}});
                    } else if (/^\n*$/.test(textNode.text) && 'list-item' === parentElmnt.type) {
                      evt.preventDefault();
                      const listPath = parentPath.slice(0, -1);
                      const listElmnt = SlateNode.get(editor, listPath);
                      let newPath;
                      if (['bulleted-list', 'numbered-list'].includes(listElmnt.type) && 1 === listElmnt.children.length) {
                        Transforms.removeNodes(editor, {at: listPath});
                        newPath = listPath;
                      } else {
                        Transforms.removeNodes(editor, {at: parentPath});
                        newPath = [...parentPath.slice(0, -2), parentPath[parentPath.length-2]+1];
                      }
                      Transforms.insertNodes(editor, {type: 'paragraph', children: [{text: ""}]}, {at: newPath});
                      Transforms.select(editor, {anchor: {path: [...newPath, 0], offset: 0}, focus: {path: [...newPath, 0], offset: 0}});
                    }
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
      <Dialog open={isContentTypeDialogOpen} onClose={setIsContentTypeDialogOpen.bind(this, false)} aria-labelledby="content-type-dialog-title">
        <DialogTitle id="content-type-dialog-title">Change type of note?</DialogTitle>
        { !editor.subtype || editor.subtype.startsWith('plain') ? (
          <DialogContent>
            <FormControlLabel
                label="Note already contains Markdown notation"
                control={<Checkbox checked={'markdown' === effectiveSubtype} onChange={handleEffectiveCheckbox} name="writtenAsMarkdown" />}
            />
          </DialogContent>
        ) : null }
        <DialogActions>
          <Button disabled={!editor.subtype || editor.subtype?.startsWith('plain')} onClick={handleChangeContentType.bind(this, 'plain')}>
            Plain Text
          </Button>
          <Button disabled={editor.subtype?.startsWith('markdown')} onClick={handleChangeContentType.bind(this, 'markdown')}>
            Mark­down
          </Button>
          <Button disabled={editor.subtype?.startsWith('html')} onClick={handleChangeContentType.bind(this, 'html;hint=SEMANTIC')}>
            Rich Text
          </Button>
        </DialogActions>
      </Dialog>

    </>);
    let formatControls;
    if (editor.subtype?.startsWith('html')) {
      formatControls = (<>
        <Select
            title="Block type"
            id="type-select"
            value={previousBlockType}
            onChange={handleSelectedBlockTypeChange}
            style={{minWidth: '15ch'}}
        >
          <MenuItem value={'paragraph'}>Body</MenuItem>
          <MenuItem value={'heading-one'}><h1>Title</h1></MenuItem>
          <MenuItem value={'heading-two'}><h2>Heading</h2></MenuItem>
          <MenuItem value={'heading-three'}><h3>Subheading</h3></MenuItem>
          <MenuItem value={'bulleted-list'}>• Bulleted List</MenuItem>
          <MenuItem value={'numbered-list'}>Numbered List</MenuItem>
          <MenuItem value={'quote'}>Block Quote</MenuItem>
          <MenuItem value={'code'}><code>Monospaced</code></MenuItem>
          {/*<MenuItem value={'thematic-break'}>Thematic break</MenuItem>*/}
          <MenuItem value={'image'}>(Image)</MenuItem>
          <MenuItem value={'multiple'}>(Multiple)</MenuItem>
          <MenuItem value={'n/a'}>(n/a)</MenuItem>
          <MenuItem value={'change-note-type'}><strong>Change note type</strong></MenuItem>
        </Select>
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
        <IconButton aria-label="Format underline"
                    color={isMarkActive(editor, 'underline') ? 'primary' : 'default'}
                    onMouseDown={evt => {
                      evt.preventDefault();
                      toggleMark(editor, 'underline');
                    }}>
          <FormatUnderlinedIcon/>
        </IconButton>
        <IconButton aria-label="Format strikethrough"
                    color={isMarkActive(editor, 'strikethrough') ? 'primary' : 'default'}
                    onMouseDown={evt => {
                      evt.preventDefault();
                      toggleMark(editor, 'strikethrough');
                    }}>
          <StrikethroughS/>
        </IconButton>
      </>);
    } else {
      let typeLabel;
      if (!editor.subtype) {
        typeLabel = "plain text";
      } else if (editor.subtype.startsWith('markdown')) {
        typeLabel = "markdown";
      } else {
        typeLabel = editor.subtype + " text";
      }
      formatControls = (<>
        <Button variant="outlined" onClick={prepareContentTypeDialog}>{typeLabel}</Button>
      </>);
    }
    noteControls = (<>
      <Input type="date" value={dateStr} onChange={handleDateChange}/>
      {formatControls}
      <Button aria-label="Save" style={{position: 'absolute', left: -1000}} onPointerDown={evt => {
        save(noteDate);
      }}>
        Save
      </Button>
    </>);
  }

  function prepareContentTypeDialog() {
    let apparentSubtype = editor.subtype?.split(';')[0] || 'plain';
    if (apparentSubtype.startsWith('plain')) {
      if (isLikelyMarkdown(editor.children.map(node => SlateNode.string(node)).join('\n'))) {
        apparentSubtype = 'markdown';
      }
    }
    setEffectiveSubtype(apparentSubtype);

    setIsContentTypeDialogOpen(!isContentTypeDialogOpen)
  }

  function toggleFocus(evt) {
    if (noteErr || !noteDate) { return; }
    if (evt.target.classList.contains('MuiBox-root')) {
      if (editor.selection) {
        ReactEditor.deselect(editor);
        ReactEditor.blur(editor);
      } else {
        ReactEditor.focus(editor);
        Transforms.select(editor, Editor.end(editor, []));
      }
    }
  }

  const appbarStyle = {flexGrow: 0, backgroundColor: "#94bbe6"};
  if (visualViewportMatters()) {
    appbarStyle.transform = `translate(${viewportScrollX}px, ${viewportScrollY}px)`;
  }

  return (<>
      <AppBar position="sticky" style={appbarStyle}>
        <Toolbar>
          <IconButton title="back" className="narrowLayoutOnly" edge={false} onClick={setMustShowPanel?.bind(this, 'LIST')} >
            <ArrowBackIcon />
          </IconButton>
          {Boolean(noteDate) && ! noteErr ? noteControls : null}
        </Toolbar>
      </AppBar>
      <Box onClick={toggleFocus} style={{flexGrow: 1, flexShrink: 1, width: '100%', overflowX: 'clip', overflowY: "auto"}}>
        <ErrorBoundary
            FallbackComponent={ErrorFallback}
            onReset={() => {
              console.warn("resetting from error boundary");
              setEditorValue([{type: 'paragraph', children: [{text: ""}]}]);
              setNoteDate(null);
              setMustShowPanel('LIST');
            }}
            resetKeys={[editorValue]}
            onResetKeysChange={(prevResetKeys, resetKeys) => {
              console.warn("error boundary reset key changed:", prevResetKeys, resetKeys);
            }}
        >
          {content}
        </ErrorBoundary>
      </Box>
  </>);
}

function ErrorFallback({error, resetErrorBoundary}) {
  return (
      <div role="alert">
        <details>
          <summary><strong>Sorry, this note can't be displayed.</strong>
            <p>If you get this error repeatedly, this note is corrupt and should be deleted.</p>
            <Button variant="outlined" onClick={resetErrorBoundary}>Clear</Button>
          </summary>
          <p>{error.message}</p>
        </details>
      </div>
  )
}

Detail.propTypes = {
  noteId: PropTypes.string,
  searchStr: PropTypes.string,
  focusOnLoadCB: PropTypes.func,
  setMustShowPanel: PropTypes.func,
};

export default Detail;
