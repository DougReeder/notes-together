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
  Toolbar, Checkbox, Menu
} from "@material-ui/core";
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import FormatBoldIcon from '@material-ui/icons/FormatBold';
import FormatItalicIcon from '@material-ui/icons/FormatItalic';
import CodeIcon from '@material-ui/icons/Code';
import FormatUnderlinedIcon from '@material-ui/icons/FormatUnderlined';
import {MoreVert, Redo, StrikethroughS, TextFormat, Undo} from "@material-ui/icons";
import {Alert, AlertTitle} from "@material-ui/lab";
import {createEditor, Editor, Node as SlateNode, Transforms, Range as SlateRange} from 'slate'
import {Slate, Editable, withReact, ReactEditor} from 'slate-react';
import { withHistory } from 'slate-history';
import {withHtml, deserializeHtml, RenderingElement, Leaf, serializeHtml} from './slateHtml';
import isHotkey from 'is-hotkey';
import {getRelevantBlockType, changeBlockType, changeContentType} from "./slateUtil";
import {isLikelyMarkdown, visualViewportMatters} from "./util";
import hasTagsLikeHtml from "./util/hasTagsLikeHtml";
import {extractUserMessage} from "./util/extractUserMessage";
import DateCompact from "./DateCompact";
import {makeStyles} from "@material-ui/core/styles";
import {clearSubstitutions, currentSubstitutions} from "./urlSubstitutions";
import {allowedExtensions, allowedFileTypesNonText} from "./FileImport";


const useStyles = makeStyles((theme) => ({
  widgetAppBar: {
    marginLeft: '1.5ch',
    marginRight: '1.5ch',
  },
}));

// const semanticAddMark = JSON.parse(JSON.stringify(semanticOnly));

let saveFn;   // Exposes side door for testing (rather than hidden button).

function Detail({noteId, searchStr = "", focusOnLoadCB, setMustShowPanel}) {
  const classes = useStyles();

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
  const saveOnAstChangeRef = useRef(true);

  const replaceNote = useCallback(theNote => {
    try {
      let slateNodes;
      if (hasTagsLikeHtml(theNote.mimeType)) {
        editor.subtype = 'html;hint=SEMANTIC';
        const html = sanitizeHtml(theNote.content, semanticOnly);
        console.log("sanitized HTML:", html.slice(0, 1024));
        slateNodes = deserializeHtml(html, editor);
      } else if (!theNote.mimeType || /^text\//.test(theNote.mimeType)) {
        editor.subtype = /\/(.+)/.exec(theNote.mimeType)?.[1];
        slateNodes = theNote.content.split("\n").map(line => {return {type: 'paragraph', children: [{text: line}]}});
      } else {
        throw new Error("Can't display this type of note");
      }
      console.log("initializing slateNodes:", slateNodes);

      // Editor can't be empty (though pasted content can be).
      // Does this here (rather than normalizeNode) so noteSubtype can be set.
      if (0 === slateNodes.length) {
        slateNodes.push({type: 'paragraph', children: [{text: ""}]});
      }
      slateNodes[0].noteSubtype = editor.subtype;

      Transforms.deselect(editor);
      setPreviousSelection(null);
      setPreviousBlockType('n/a');
      setEditableKey(Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER));
      setEditorValue(slateNodes);
      saveOnAstChangeRef.current = false;
      Editor.normalize(editor, {force: true});
      setNoteDate(theNote.date);
      clearSubstitutions();
    } catch (err) {
      console.error(`while replacing note ${theNote.id}:`, err);
      setNoteErr(err);
    } finally {
      queueMicrotask(() => {
        saveOnAstChangeRef.current = true;
      });
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
      setNoteErr(null);
      setEditorValue(newValue);

      if (! ('noteSubtype' in editor.children[0]) && 'subtype' in editor) {
        console.warn("preserve subtype 1:", editor.children[0].noteSubtype, '<-', editor.subtype)
        queueMicrotask(() => {
          console.warn("preserve subtype 2:", editor.children[0].noteSubtype, '<-', editor.subtype)
          saveOnAstChangeRef.current = false;
              Transforms.setNodes(editor, {noteSubtype: editor.subtype}, {at: [0]})
          queueMicrotask(() => {
            saveOnAstChangeRef.current = true;
          });
        });
      } else {
        // console.log("preserve subtype:", editor.children[0].noteSubtype, '->', editor.subtype)
        editor.subtype = editor.children[0].noteSubtype;
      }

      const isAstChange = editor.operations.some(op => 'set_selection' !== op.type);
      if (isAstChange) {
        console.log(`AST change ${noteId}:`, editor.operations, newValue);
        if (saveOnAstChangeRef.current) {
          await save(noteDate);
        }
      } else {
        forceUpdate();   // updates the mark indicators
        console.log("selection change:", editor.operations);
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
      if (201 === err?.error?.code && '/content' === err?.error?.dataPath) {
        window.postMessage({kind: 'TRANSIENT_MSG', message: "Can't save. Split this note into multiple notes"}, window?.location?.origin);
      } else {
        setNoteErr(err);
        setPreviousSelection(null);
        setPreviousBlockType('n/a');
      }
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
      content = serializeHtml(editor.children, await currentSubstitutions());
      console.log('save HTML:', noteId, editor.children, content.slice(0, 1024), date);
    } else {
      content = editor.children.map(node => SlateNode.string(node)).join('\n')
      console.log('save text:', noteId, editor.children, content, date);
    }
    await upsertNote(createMemoryNote(noteId, content, date, editor.subtype ? 'text/'+editor.subtype : undefined), 'DETAIL');
  }
  saveFn = save;

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

  const [detailsMenuAnchorEl, setDetailsMenuAnchorEl] = React.useState(null);
  function handleDetailsMenuClick(evt) {
    setDetailsMenuAnchorEl(evt.currentTarget);
  }

  const [markMenuAnchorEl, setMarkMenuAnchorEl] = React.useState(null);

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
    const targetType = evt.target.value;
    queueMicrotask(() => {
      ReactEditor.focus(editor);
      // console.log("handleSelectedBlockTypeChange previousSelection:", JSON.stringify(previousSelection))
      if (previousSelection && (!SlateRange.isCollapsed(previousSelection) || 0 === SlateNode.string(SlateNode.get(editor, previousSelection?.anchor?.path)).length)) {
        // changes block type
        Transforms.select(editor, previousSelection);
        if (['image', 'link'].indexOf(previousBlockType) > -1) {
          window.postMessage({
            kind: 'TRANSIENT_MSG',
            severity: 'warning',
            message: "Only text blocks can be changed."
          }, window?.location?.origin);
          return;
        }
        // console.log(`${previousBlockType} -> ${targetType}`);
        switch (targetType) {
          default:
            changeBlockType(editor, targetType);
            return;
          case 'multiple':
          case 'list-item':
          case 'image':
          case 'n/a':
          case '':
            window.postMessage({
              kind: 'TRANSIENT_MSG',
              severity: 'warning',
              message: "That wouldn't make sense."
            }, window?.location?.origin);
            return;
        }
      } else {
        // appends block
        let path;
        if (previousSelection) {
          let point = Editor.after(editor, previousSelection?.anchor?.path?.slice(0, 1));
          if (point) {
            path = point.path.slice(0, 1);
          } else {
            path = [editor.children.length];
          }
        } else {
          path = [editor.children.length];
        }
        switch (targetType) {
          default:
            Transforms.insertNodes(editor,
                {type: targetType, children: [{text: ""}]},
                {at: path}
            );
            Transforms.select(editor, path);
            return;
          case 'bulleted-list':
          case 'numbered-list':
            Transforms.insertNodes(editor,
                {type: targetType, children: [
                    {type: 'list-item', children: [{text: ""}]}
                  ]},
                {at: path}
            );
            Transforms.select(editor, path);
            return;
          case 'multiple':
          case 'list-item':   // shouldn't happen
          case 'image':
          case 'n/a':
          case '':
            window.postMessage({
              kind: 'TRANSIENT_MSG',
              severity: 'warning',
              message: "Can't insert that!"
            }, window?.location?.origin);
            return;
        }
      }
    });
  }

  const [isContentTypeDialogOpen, setIsContentTypeDialogOpen] = useState(false);

  function handleEffectiveCheckbox(evt, isMarkdown) {
    setEffectiveSubtype(isMarkdown ? 'markdown' : 'plain');
  }

  async function handleChangeContentType(newSubtype) {
    await changeContentType(editor, effectiveSubtype, newSubtype);
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
            placeholder="Type, or paste some rich text or a graphic."
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
                      Editor.withoutNormalizing(editor, () => {
                        const listPath = parentPath.slice(0, -1);
                        const listElmnt = SlateNode.get(editor, listPath);
                        let newPath;
                        if (['bulleted-list', 'numbered-list'].includes(listElmnt.type) && 1 === listElmnt.children.length) {
                          Transforms.removeNodes(editor, {at: listPath});
                          newPath = listPath;
                        } else {
                          Transforms.removeNodes(editor, {at: parentPath});
                          newPath = [...parentPath.slice(0, -2), parentPath[parentPath.length - 2] + 1];
                        }
                        Transforms.insertNodes(editor, {type: 'paragraph', children: [{text: ""}]}, {at: newPath});
                        Transforms.select(editor, {
                          anchor: {path: [...newPath, 0], offset: 0},
                          focus: {path: [...newPath, 0], offset: 0}
                        });
                      });
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

    const dateControl = editor.subtype?.startsWith('html') ?
        <DateCompact date={noteDate} onChange={handleDateChange}/> :
        <Input type="date" value={dateStr} onChange={handleDateChange} className={classes.widgetAppBar}/>;

    function handleMarkItem(mark) {
      queueMicrotask(() => {
        ReactEditor.focus(editor);
        if (previousSelection) {
          Transforms.select(editor, previousSelection);
        }
        toggleMark(editor, mark);
      });
      setMarkMenuAnchorEl(null);
    }

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
          <MenuItem value={'image'}>(Graphic)</MenuItem>
          <MenuItem value={'multiple'}>(Multiple)</MenuItem>
          <MenuItem value={'n/a'}>(n/a)</MenuItem>
        </Select>

        <IconButton aria-controls="mark-menu" aria-haspopup="true" aria-label="Text Format" onClick={evt => setMarkMenuAnchorEl(evt.currentTarget)}>
          <TextFormat/>
        </IconButton>
        <Menu
            id="mark-menu"
            role="menu"
            aria-label="Text Format Menu"
            anchorEl={markMenuAnchorEl}
            keepMounted
            open={Boolean(markMenuAnchorEl)}
            onClose={evt => {
              setMarkMenuAnchorEl(null);
              queueMicrotask(() => {
                ReactEditor.focus(editor);
              });
            }}
        >
          <MenuItem style={{justifyContent: "space-between"}} onClick={handleMarkItem.bind(this, 'italic')}>
            Italic &nbsp;<FormatItalicIcon color={isMarkActive(editor, 'italic') ? 'primary' : 'inherit'}/>
          </MenuItem>
          <MenuItem style={{justifyContent: "space-between"}} onClick={handleMarkItem.bind(this, 'bold')}>
              Bold &nbsp;<FormatBoldIcon color={isMarkActive(editor, 'bold') ? 'primary' : 'inherit'}/>
          </MenuItem>
          <MenuItem style={{justifyContent: "space-between"}} onClick={handleMarkItem.bind(this, 'code')}>
            Monospaced &nbsp;<CodeIcon color={isMarkActive(editor, 'code') ? 'primary' : 'inherit'}/>
          </MenuItem>
          <MenuItem style={{justifyContent: "space-between"}} onClick={handleMarkItem.bind(this, 'superscript')}>
            Superscript &nbsp;<b style={{color: isMarkActive(editor, 'superscript') ? '#3f51b5' : 'inherit'}}>x<sup>2</sup></b>
          </MenuItem>
          <MenuItem style={{justifyContent: "space-between"}} onClick={handleMarkItem.bind(this, 'subscript')}>
            Subscript &nbsp;<b style={{color: isMarkActive(editor, 'subscript') ? '#3f51b5' : 'inherit'}}>x<sub>a</sub></b>
          </MenuItem>
          <MenuItem style={{justifyContent: "space-between"}} onClick={handleMarkItem.bind(this, 'underline')}>
            Underlined &nbsp;<FormatUnderlinedIcon color={isMarkActive(editor, 'underline') ? 'primary' : 'inherit'}/>
          </MenuItem>
          <MenuItem style={{justifyContent: "space-between"}} onClick={handleMarkItem.bind(this, 'strikethrough')}>
            Strikethrough &nbsp;<StrikethroughS color={isMarkActive(editor, 'strikethrough') ? 'primary' : 'inherit'}/>
          </MenuItem>
        </Menu>
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
        <Button variant="outlined" onClick={prepareContentTypeDialog} className={classes.widgetAppBar}>{typeLabel}</Button>
      </>);
    }
    noteControls = (<>
      {dateControl}
      <IconButton aria-controls="details-menu" aria-haspopup="true" aria-label="Details menu" onClick={handleDetailsMenuClick}>
        <MoreVert/>
      </IconButton>
      <Menu
          id="details-menu"
          role="menu"
          aria-label="Details menu"
          anchorEl={detailsMenuAnchorEl}
          keepMounted
          open={Boolean(detailsMenuAnchorEl)}
          onClose={evt => setDetailsMenuAnchorEl(null)}
      >
        <MenuItem onClick={evt => {
          editor.undo();
          setDetailsMenuAnchorEl(null);
        }}>
          Undo &nbsp;<Undo/>
        </MenuItem>
        <MenuItem onClick={evt => {
          editor.redo();
          setDetailsMenuAnchorEl(null);
        }}>
          Redo &nbsp;<Redo/>
        </MenuItem>
        <MenuItem onClick={evt => {
          pasteFileInput.current.click();
          setDetailsMenuAnchorEl(null);
        }}>
          Paste Files...
        </MenuItem>
        <MenuItem onClick={evt => {
          setDetailsMenuAnchorEl(null);
          setEffectiveSubtype('html');
          setIsContentTypeDialogOpen(true);
        }}>
          Change note type...
        </MenuItem>
      </Menu>
      {formatControls}
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

  const boxRef = useRef(null);

  function toggleFocus(evt) {
    if (noteErr || !noteDate) { return; }
    let edge;
    if (evt.target.classList?.contains('MuiToolbar-root')) {
      edge = 'start';
    } else if (evt.target.classList?.contains('MuiBox-root')) {
      edge = 'end';
    }
    if (edge) {
      if (previousSelection) {
        ReactEditor.deselect(editor);
        ReactEditor.blur(editor);
        setPreviousSelection(null);
        setPreviousBlockType('n/a');
      } else {
        ReactEditor.focus(editor);
        Transforms.select(editor, Editor.point(editor, [], {edge}));
        if ('start' === edge) {
          boxRef.current.scrollTop = 0;
        }
      }
    }
  }

  const pasteFileInput = useRef(null);

  function pasteFileChange(evt) {
    try {
      // console.log("paste files:", evt.target.files)
      ReactEditor.focus(editor);
      if (previousSelection) {
        Transforms.select(editor, previousSelection);
      }
      const dataTransfer = new DataTransfer();
      for (const file of evt.target.files) {
        dataTransfer.items.add(file);
      }
      editor.insertData(dataTransfer);
    } catch (err) {
      console.error("while pasting files:", err);
      window.postMessage({kind: 'TRANSIENT_MSG', message: extractUserMessage(err)}, window?.location?.origin);
    } finally {
      pasteFileInput.current.value = "";
    }
  }

  const appbarStyle = {flexGrow: 0, backgroundColor: "#94bbe6"};
  if (visualViewportMatters()) {
    appbarStyle.transform = `translate(${viewportScrollX}px, ${viewportScrollY}px)`;
  }

  return (<>
      <AppBar onClick={toggleFocus} position="sticky" style={appbarStyle}>
        <Toolbar>
          <IconButton title="back" className="narrowLayoutOnly" edge={false} onClick={setMustShowPanel?.bind(this, 'LIST')} >
            <ArrowBackIcon />
          </IconButton>
          {Boolean(noteDate) && ! noteErr ? noteControls : null}
        </Toolbar>
      </AppBar>
      <Box ref={boxRef} onClick={toggleFocus} style={{flexGrow: 1, flexShrink: 1, width: '100%', overflowX: 'clip', overflowY: "auto"}}>
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
      <input id="pasteFileInput" type="file" hidden={true} ref={pasteFileInput} onChange={pasteFileChange} multiple={true}
           accept={"image/*,text/plain,text/markdown,text/html,text/csv,text/tab-separated-values," + allowedFileTypesNonText.join(',') + ',text/vcard,text/calendar,text/troff,' + allowedExtensions.join(',')}/>

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
export {saveFn};

