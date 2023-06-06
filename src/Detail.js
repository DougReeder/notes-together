// noinspection ExceptionCaughtLocallyJS

import {validate as uuidValidate} from 'uuid';
import {createMemoryNote} from './Note';
import {semanticOnly} from './sanitizeNote';
import React, {useEffect, useState, useMemo, useCallback, useReducer, useRef} from 'react';
import PropTypes from 'prop-types';
import {ErrorBoundary} from 'react-error-boundary'
import useViewportScrollCoords from './web-api-hooks/useViewportScrollCoords';
import {getNote, upsertNote, normalizeWord} from './storage';
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
  Toolbar, Menu, Divider
} from "@mui/material";
import Checkbox from "@mui/material/Checkbox";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import CodeIcon from '@mui/icons-material/Code';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import {
  AddCircleOutline, Lock,
  MoreVert,
  Photo,
  Redo,
  RemoveCircleOutline,
  StrikethroughS,
  TextFormat,
  Undo
} from "@mui/icons-material";
import {Alert, AlertTitle} from '@mui/material';
import {createEditor, Editor, Node as SlateNode, Range as SlateRange, Transforms, Text} from 'slate'
import {Slate, Editable, withReact, ReactEditor} from 'slate-react';
import { withHistory } from 'slate-history';
import {withHtml, deserializeHtml, RenderingElement, Leaf, serializeHtml} from './slateHtml';
import isHotkey from 'is-hotkey';
import {
  getRelevantBlockType,
  changeBlockType,
  changeContentType,
  insertListAfter,
  insertTableAfter,
  tabRight,
  tabLeft,
  getSelectedTable,
  getSelectedListItem,
  flipTableRowsToColumns,
  insertAfter,
  getSelectedQuote,
  insertCheckListAfter
} from "./slateUtil";
import {globalWordRE, isLikelyMarkdown, visualViewportMatters} from "./util";
import hasTagsLikeHtml from "./util/hasTagsLikeHtml";
import {extractUserMessage} from "./util/extractUserMessage";
import DateCompact from "./DateCompact";
import makeStyles from '@mui/styles/makeStyles';
import {clearSubstitutions, currentSubstitutions} from "./urlSubstitutions";
import {allowedExtensions, allowedFileTypesNonText} from "./FileImport";
import decodeEntities from "./util/decodeEntities";
import removeDiacritics from "./diacritics";


const useStyles = makeStyles((theme) => ({
  widgetAppBar: {
    marginLeft: '1.5ch',
    marginRight: '1.5ch',
  },
}));

const BLOCK_TYPE_DISPLAY = {
  'heading-one': <h1>Title</h1>,
  'heading-two': <h2>Heading</h2>,
  'heading-three': <h3>Subheading</h3>,
  'paragraph': "Paragraph",
  'bulleted-list': <><b>•</b><span> Bulleted List</span></>,
  'numbered-list': "Numbered List",
  'task-list': "✔️ Task List",
  'sequence-list': "✔️ Sequence",
  'list-item': "List Item",
  'table': "Table",
  'table-row': "Table Row",   // not supposed to be returned, currently
  'table-cell': "Table Cell",
  'quote': <><span/><span>Block Quote</span></>,
  'code': <code>Monospaced</code>,
  'thematic-break': <><div>Rule</div><hr style={{marginLeft: '1ex', flex: '1 1 auto'}} /></>,
  'image': <><span>Graphic </span><Photo/></>,
  'multiple': "(Multiple)",
  'n/a': "(n/a)",
}

const BLOCK_ITEMS_DEFAULT = [
  {cmd: 'heading-one', label: <h1>Title</h1>},
  {cmd: 'heading-two', label: <h2>Heading</h2>},
  {cmd: 'heading-three', label: <h3>Subheading</h3>},
  {cmd: 'paragraph', label: "Paragraph"},
  {cmd: 'bulleted-list', label: <><b>•</b><span> Bulleted List</span></>},
  {cmd: 'numbered-list', label: "Numbered List"},
  {cmd: 'task-list', label: "✔️ Task List"},
  {cmd: 'sequence-list', label: "✔️ Sequence"},
  {cmd: 'table', label: "Table"},
  {cmd: 'quote', label: <><span/><span>Block Quote</span></>},
  {cmd: 'code', label: <code>Monospaced</code>},
];

const BLOCK_ITEMS_DELETE = [
  {cmd: '', label: "Delete"},   // divider
  {cmd: 'delete-table-row', label: "Table Row"},
  {cmd: 'delete-table-column', label: "Table Column"},
];

const NO_SELECTION_MENU = [
    {cmd: '', label: "Append"},
  ...BLOCK_ITEMS_DEFAULT,
  {cmd: 'insert-thematic-break', label: <><div>Rule</div><hr style={{marginLeft: '1ex', flex: '1 1 auto'}} /></>}
];

const PLACE_CURSOR_IN_TABLE = "Place the cursor in a table";

let saveFn;   // Exposes side door for testing (rather than hidden button).

function Detail({noteId, searchWords = new Set(), focusOnLoadCB, setMustShowPanel}) {
  const classes = useStyles();

  const [viewportScrollX, viewportScrollY] = useViewportScrollCoords();

  const [isLoading, setIsLoading] = useState(false);
  const loadingIdRef = useRef(NaN);
  const [editorValue, setEditorValue] = useState([{
    type: 'paragraph',
    children: [{ text: 'Initial editor value' }],
  }]);
  const [editableKey, setEditableKey] = useState(Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER));
  const editor = useMemo(
      () => withHtml(withHistory(withReact(createEditor()))),
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
        // console.log("sanitized HTML:", html.slice(0, 1024));
        slateNodes = deserializeHtml(html, editor);
      } else if (!theNote.mimeType || /^text\//.test(theNote.mimeType)) {
        editor.subtype = /\/(.+)/.exec(theNote.mimeType)?.[1];
        slateNodes = theNote.content.split("\n").map(line => {return {type: 'paragraph', children: [{text: line}]}});
      } else {
        throw new Error(`Can't display “${theNote.mimeType}” note`);
      }
      // console.log("initializing slateNodes:", slateNodes);

      // Editor can't be empty (though pasted content can be).
      // Does this here (rather than normalizeNode) so noteSubtype can be set.
      if (0 === slateNodes.length) {
        slateNodes.push({type: 'paragraph', children: [{text: ""}]});
      }
      slateNodes[0].noteSubtype = editor.subtype;

      Transforms.deselect(editor);
      setEditableKey(Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER));
      setEditorValue(slateNodes);
      editor.children = slateNodes;
      saveOnAstChangeRef.current = false;
      Editor.normalize(editor, {force: true});
      setNoteDate(theNote.date);
      setIsLocked(Boolean(theNote.isLocked));
      clearSubstitutions();
    } catch (err) {
      console.error(`while replacing note ${theNote?.id}:`, err);
      setNoteErr(err);
    } finally {
      setIsLoading(false);
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
      setIsLoading(true);
      loadingIdRef.current = noteId;
      getNote(noteId).then(theNote => {
        loadingIdRef.current = NaN;
        if ('object' === typeof theNote) {
          boxRef.current.scrollTop = 0;
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


  const decorate = useCallback(([node, path]) => {
    const ranges = [];
    if (searchWords.size > 0 && Text.isText(node)) {
      const text = decodeEntities(node.text);
      const wordRE = new RegExp(globalWordRE);

      let wordMatch, normalizedWord;
      while ((wordMatch = wordRE.exec(text)) !== null) {
        if ((normalizedWord = normalizeWord(removeDiacritics(wordMatch[0])))) {
          for (const searchWord of searchWords) {
            if (normalizedWord.startsWith(searchWord)) {
              const range = {
                anchor: {path, offset: wordMatch.index},
                // The offset will sometimes but rarely be off. [shrug]
                focus: {path, offset: wordMatch.index + Math.round(searchWord.length / normalizedWord.length * wordMatch[0].length)},
                highlight: true,
              };
              ranges.push(range);
              break;
            }
          }
        }
      }
    }
    return ranges;
  }, [searchWords]);

  const canSave = useRef(true);
  const shouldSave = useRef(false);

  async function handleSlateChange(newValue) {
    try {
      setNoteErr(null);
      setEditorValue(newValue);

      if (! ('noteSubtype' in editor.children[0]) && 'subtype' in editor) {
        console.warn("preserve subtype 1:", editor.children[0]?.noteSubtype, '<-', editor.subtype)
        queueMicrotask(() => {
          console.warn("preserve subtype 2:", editor.children[0]?.noteSubtype, '<-', editor.subtype)
          saveOnAstChangeRef.current = false;
              Transforms.setNodes(editor, {noteSubtype: editor.subtype}, {at: [0]})
          queueMicrotask(() => {
            saveOnAstChangeRef.current = true;
          });
        });
      } else {
        // console.log("preserve subtype:", editor.children[0].noteSubtype, '->', editor.subtype)
        editor.subtype = editor.children[0]?.noteSubtype;
      }

      const isAstChange = editor.operations.some(op => 'set_selection' !== op.type);
      if (isAstChange) {
        // console.log(`AST change ${noteId}:`, editor.operations, newValue);
        if (saveOnAstChangeRef.current) {
          if (canSave.current) {
            await save(noteDate, isLocked);
          } else {
            shouldSave.current = true;
          }
        }
      } else {
        forceRender();   // updates the mark indicators
        // console.log("selection change:", editor.operations);
      }
    } catch (err) {
      console.error("handleSlateChange:", err);
      if (201 === err?.error?.code && '/content' === err?.error?.dataPath) {
        transientMsg("Can't save. Split this note into multiple notes");
      } else {
        setNoteErr(err);
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
      // console.log('handleDateChange:', newDate);
      if (canSave.current) {
        await save(newDate, isLocked);
      } else {
        shouldSave.current = true;
      }
    } catch (err) {
      console.error("Detail handleDateChange:", err);
      transientMsg(extractUserMessage(err))
    }
  }

  async function save(date, isLocked) {
    canSave.current = false;
    let content;
    if (editor.subtype?.startsWith('html')) {
      content = serializeHtml(editor.children, await currentSubstitutions());
      // console.log('save HTML:', noteId, editor.children, content.slice(0, 1024), date);
    } else {
      content = editor.children.map(node => SlateNode.string(node)).join('\n')
      // console.log('save text:', noteId, editor.children, content, date);
    }
    await upsertNote(createMemoryNote(noteId, content, date, editor.subtype ? 'text/'+editor.subtype : undefined, isLocked), 'DETAIL');
    setTimeout(async () => {
      canSave.current = true;
      if (shouldSave.current) {
        shouldSave.current = false;
        await save(noteDate, isLocked);
      }
    }, 1500);
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
      // console.log("Detail externalChange", notesChanged);

      setIsLoading(true);
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
    previousSelection.current = JSON.parse(JSON.stringify(editor.selection));
    setDetailsMenuAnchorEl(evt.currentTarget);
  }

  const [blockTypeMenuAnchorEl, setBlockTypeMenuAnchorEl] = React.useState(null);

  const [markMenuAnchorEl, setMarkMenuAnchorEl] = React.useState(null);

  const previousSelection = useRef(null);

  const [, forceRender] = useReducer(x => x + 1, 0);

  // Defines our own custom set of helpers.
  function isMarkActive(editor, format) {
    try {
      const marks = Editor.marks(editor);
      return marks ? marks[format] === true : false;
    } catch (err) {
      console.error(`while checking isMarkActive(${format}):`, err);
      return false;
    }
  }

  function toggleMark(editor, format) {
    const isActive = isMarkActive(editor, format)

    if ('deleted' === format && isMarkActive(editor, 'inserted')) {
      Editor.removeMark(editor, 'inserted');
    }
    if ('inserted' === format && isMarkActive(editor, 'deleted')) {
      Editor.removeMark(editor, 'deleted');
    }

    if (isActive) {
      Editor.removeMark(editor, format)
    } else {
      Editor.addMark(editor, format, true)
    }
    forceRender();   // so buttons can change colors
  }

  function handleSelectedBlockTypeChange(targetType) {
    queueMicrotask(() => {
      try {
      ReactEditor.focus(editor);
      if (! editor.selection && previousSelection.current) {
        Transforms.select(editor, previousSelection.current);
      }
      previousSelection.current = null;

      // eslint-disable-next-line default-case
      switch (targetType) {
        case 'insert-paragraph':
          insertAfter(editor,
              {type: 'paragraph', children: [{text: ""}]},
              [0]);
          return;
        case 'insert-bulleted-list':
          insertListAfter(editor, 'bulleted-list');
          return;
        case 'insert-numbered-list':
          insertListAfter(editor, 'numbered-list');
          return;
        case 'insert-task-list':
          insertCheckListAfter(editor, 'task-list');
          return;
        case 'insert-sequence-list':
          insertCheckListAfter(editor, 'sequence-list');
          return;
        case 'insert-table':
          insertTableAfter(editor);
          return;
      }

      if (editor.selection) {
        // changes block type
        const relevantBlockType = getRelevantBlockType(editor);
        switch (targetType) {
          case 'paragraph':
          case 'heading-one':
          case 'heading-two':
          case 'heading-three':
          case 'bulleted-list':
          case 'numbered-list':
          case 'task-list':
          case 'sequence-list':
          case 'table':
          case 'quote':
          case 'code':
            changeBlockType(editor, targetType);
            return;
            // A void block is inserted, rather than changing a text block to it.
          case 'insert-thematic-break':
            if ('thematic-break' !== relevantBlockType) {
              if (! SlateRange.isCollapsed(editor.selection)) {
                const point = SlateRange.end(editor.selection);
                Transforms.setSelection(editor, {anchor: point, focus: point});
              }
              Transforms.insertNodes(editor,
                  {type: 'thematic-break', children: [{text: ""}]},
                  {}
              );
            }
            return;
          case 'insert-table-row':
            insertTableRow();
            return;
          case 'insert-table-column':
            insertTableColumn();
            return;
          case 'delete-table-row':
            deleteTableRow();
            return;
          case 'delete-table-column':
            deleteTableColumn();
            return;
          default:
            transientMsg("That wouldn't make sense.", 'info');
            return;
        }
      } else {
        // appends block at end
        if ('insert-thematic-break' === targetType) { targetType = 'thematic-break'}
        let path = [editor.children.length];
        switch (targetType) {
          case 'paragraph':
          case 'heading-one':
          case 'heading-two':
          case 'heading-three':
          case 'quote':
          case 'code':
          case 'thematic-break':
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
          case 'task-list':
          case 'sequence-list':
            Transforms.insertNodes(editor,
                {type: targetType, children: [
                    {type: 'list-item', checked: false, children: [{text: ""}]}
                  ]},
                {at: path}
            );
            Transforms.select(editor, path);
            return;
          case 'table':
            appendTable(path);
            return;
          case 'insert-table-row':
          case 'insert-table-column':
            transientMsg(PLACE_CURSOR_IN_TABLE, 'info');
            return;
          default:
            transientMsg("Can't append that!", 'info');
            return;
        }
      }
      } catch (err) {
        console.error("while executing block command:", err);
        transientMsg(err.message, err.severity || 'error');
      }
    });
    setBlockTypeMenuAnchorEl(null);
  }

  function insertTableRow() {
    for (const [ancestor, ancestorPath] of SlateNode.ancestors(editor, editor.selection.focus.path, {reverse: true})) {
      if ('table-row' === ancestor.type) {
        const insertPath = [...ancestorPath.slice(0, -1), ancestorPath[ancestorPath.length-1] + 1];
        Transforms.insertNodes(editor,
            {type: 'table-row', children: [
                {type: 'table-cell', children: [{text: ""}]},
              ]},
            {at: insertPath, select: true}
        );
        return;
      }
    }
    transientMsg(PLACE_CURSOR_IN_TABLE, 'info');
  }

  function insertTableColumn() {
    let selectionPath;
    let insertIndex = 0, tablePath;
    for (const [ancestor, ancestorPath] of SlateNode.ancestors(editor, editor.selection.focus.path, {reverse: true})) {
      if ('table-cell' === ancestor.type) {
        insertIndex = ancestorPath[ancestorPath.length-1] + 1;
        selectionPath = [...ancestorPath.slice(0, -1), insertIndex, 0];
      } else if ('table' === ancestor.type) {
        tablePath = ancestorPath;
        break;
      }
    }
    if (tablePath) {
      Editor.withoutNormalizing(editor, () => {
        for (const [, rowPath] of SlateNode.children(editor, tablePath)) {
          const insertPath = [...rowPath, insertIndex];
          Transforms.insertNodes(editor,
              {type: 'table-cell', children: [{text: ""}]},
              {at: insertPath}
          );
        }
        Transforms.select(editor, {anchor: {path: selectionPath, offset: 0}, focus: {path: selectionPath, offset: 0}});
      });
    } else {
      transientMsg(PLACE_CURSOR_IN_TABLE, 'info');
    }
  }

  function deleteTableRow() {
    for (const [ancestor, ancestorPath] of SlateNode.ancestors(editor, editor.selection.focus.path, {reverse: true})) {
      if ('table-row' === ancestor.type) {
        Transforms.removeNodes(editor, {at: ancestorPath});
        return;
      }
    }
    transientMsg(PLACE_CURSOR_IN_TABLE, 'info');
  }

  function deleteTableColumn() {
    const endPoint = SlateRange.end(editor.selection);
    let selectionPath;
    let deleteIndex = 0, tablePath;
    for (const [ancestor, ancestorPath] of SlateNode.ancestors(editor, endPoint.path, {reverse: true})) {
      if ('table-cell' === ancestor.type) {
        deleteIndex = ancestorPath[ancestorPath.length-1];
        selectionPath = [...ancestorPath.slice(0, -1), deleteIndex, 0];
      } else if ('table' === ancestor.type) {
        tablePath = ancestorPath;
        break;
      }
    }
    if (tablePath) {
      Editor.withoutNormalizing(editor, () => {
        for (const [, rowPath] of SlateNode.children(editor, tablePath)) {
          const deletePath = [...rowPath, deleteIndex];
          Transforms.removeNodes(editor, {at: deletePath});
        }
        Transforms.select(editor, {anchor: {path: selectionPath, offset: 0}, focus: {path: selectionPath, offset: 0}});
      });
    } else {
      transientMsg(PLACE_CURSOR_IN_TABLE, 'info');
    }
  }

  function appendTable(path) {
    Transforms.insertNodes(editor, [
          {type: 'table', children: [
              {type: 'table-row', children: [
                  {type: 'table-cell', children: [{text: "", bold: true}]},
                  {type: 'table-cell', children: [{text: "", bold: true}]},
                ]},
              {type: 'table-row', children: [
                  {type: 'table-cell', children: [{text: ""}]},
                  {type: 'table-cell', children: [{text: ""}]},
                ]},
            ]},
          { type: 'paragraph', children: [   // TODO: handle via normalization
              {text: ""}
            ]}
        ],
        {at: path}
    );
    Transforms.select(editor, [...path, 0, 0]);
  }

  const [isContentTypeDialogOpen, setIsContentTypeDialogOpen] = useState(false);

  function handleEffectiveCheckbox(evt, isMarkdown) {
    setEffectiveSubtype(isMarkdown ? 'markdown' : 'plain');
  }

  async function handleChangeContentType(newSubtype) {
    setIsLoading(true);
    await changeContentType(editor, effectiveSubtype, newSubtype);
    setIsLoading(false);
    setIsContentTypeDialogOpen(false);
  }

  const appbarStyle = {};
  if (visualViewportMatters()) {
    appbarStyle.transform = `translate(${viewportScrollX}px, ${viewportScrollY}px)`;
  }

  const outBtn = <IconButton title="Out to list panel" className="narrowLayoutOnly"
      edge={false} size="large"
      onClick={setMustShowPanel?.bind(this, 'LIST')}>
    <ArrowBackIcon />
  </IconButton>;

  const [isLocked, setIsLocked] = useState(false);

  if (noteErr) {
    console.error("error in Details:", noteErr);
  }
  let content;
  let noteControls = null;
  if (noteErr) {
    content = <>
      <AppBar onClick={toggleFocus} position="sticky" style={appbarStyle}>
        <Toolbar>{outBtn}</Toolbar>
      </AppBar>
      <Alert severity={noteErr.severity || "error"} style={{margin: "2ex"}}>
        <AlertTitle>{noteErr?.userMsg || "Close and re-open this tab"}</AlertTitle>
        {noteErr?.message || noteErr?.name || noteErr?.toString()}
      </Alert>
    </>;
  } else if (!noteDate) {
    content = (<>
      <AppBar onClick={toggleFocus} position="sticky" style={appbarStyle}>
        <Toolbar>{outBtn}</Toolbar>
      </AppBar>
      <div style={{width: '100%', height: '100%', backgroundImage: 'url(' + process.env.PUBLIC_URL + '/icons/NotesTogether-icon-gray.svg)',
        backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat'}}></div>
    </>);
  } else {
    const dateControl = editor.subtype?.startsWith('html') ?
        <DateCompact date={noteDate} onChange={handleDateChange}/> :
        <Input type="date" value={dateStr} title="Change date" onChange={handleDateChange} className={classes.widgetAppBar}/>;

    function handleMarkItem(mark) {
      queueMicrotask(() => {
        ReactEditor.focus(editor);
        if (! editor.selection && previousSelection.current) {
          Transforms.select(editor, previousSelection.current);
        }
        previousSelection.current = null;
        toggleMark(editor, mark);
      });
      setMarkMenuAnchorEl(null);
    }

    const [selectedTable] = getSelectedTable(editor);
    let formatControls;
    if (editor.subtype?.startsWith('html')) {
      const relevantBlockType = getRelevantBlockType(editor);
      const [selectedListItem] = getSelectedListItem(editor);
      const [selectedQuote] = getSelectedQuote(editor);
      let menu;
      switch (relevantBlockType) {
        case 'paragraph':
        case 'heading-one':
        case 'heading-two':
        case 'heading-three':
        case 'quote':
        case 'code':
        case 'thematic-break':
        case 'list-item':
        case 'table-cell':
        default:
          menu = [...BLOCK_ITEMS_DEFAULT];
          addInsertsAndDeletes(menu, selectedListItem, selectedTable, selectedQuote, true);
          break;
        case 'bulleted-list':
        case 'numbered-list':
        case 'task-list':
        case 'sequence-list':
        case 'table':
        case 'table-row':
        case 'multiple':
          menu = [...BLOCK_ITEMS_DEFAULT];
          addInsertsAndDeletes(menu, selectedListItem, selectedTable, selectedQuote, false)
          break;
        case 'image':
          menu = [];
          addInsertsAndDeletes(menu, selectedListItem, selectedTable, selectedQuote, true)
          break;
        case 'n/a':
          menu = NO_SELECTION_MENU;
          break;
      }
      formatControls = (<>
        <Button variant="outlined" aria-haspopup="true" title="Open block type menu"
                sx={{width: '18.5ch', height: '36px', flexShrink: 1, color: 'black', borderColor: 'black'}}
            onClick={evt => {
              previousSelection.current = JSON.parse(JSON.stringify(editor.selection));
              setBlockTypeMenuAnchorEl(evt.currentTarget);
            }}>
          {BLOCK_TYPE_DISPLAY[relevantBlockType] || relevantBlockType || "?"}
        </Button>
        <Menu
            id="block-type-menu"
            role="menu"
            aria-label="Block type"
            anchorEl={blockTypeMenuAnchorEl}
            keepMounted
            open={Boolean(blockTypeMenuAnchorEl)}
            onClose={evt => {
              setBlockTypeMenuAnchorEl(null);
              previousSelection.current = null;
              queueMicrotask(() => {
                ReactEditor.focus(editor);
              });
            }}
        >
          {menu.map(({cmd, label}) =>
              cmd ?
                <MenuItem onClick={handleSelectedBlockTypeChange.bind(this, cmd)} key={cmd}>{label}</MenuItem> :
                <Divider key={label}>{label}</Divider>
          )}
        </Menu>

        <IconButton aria-haspopup="true" title="Open text style menu" size="large"
            onClick={evt => {
              previousSelection.current = JSON.parse(JSON.stringify(editor.selection));
              setMarkMenuAnchorEl(evt.currentTarget);
            }}>
          <TextFormat/>
        </IconButton>
        <Menu
            id="mark-menu"
            role="menu"
            aria-label="Text style menu"
            anchorEl={markMenuAnchorEl}
            keepMounted
            open={Boolean(markMenuAnchorEl)}
            onClose={evt => {
              setMarkMenuAnchorEl(null);
              previousSelection.current = null;
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
          <MenuItem style={{justifyContent: "space-between"}} onClick={handleMarkItem.bind(this, 'deleted')}>
            Deleted &nbsp;<RemoveCircleOutline color={isMarkActive(editor, 'deleted') ? 'primary' : 'inherit'}/>
          </MenuItem>
          <MenuItem style={{justifyContent: "space-between"}} onClick={handleMarkItem.bind(this, 'inserted')}>
            Inserted &nbsp;<AddCircleOutline color={isMarkActive(editor, 'inserted') ? 'primary' : 'inherit'}/>
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
        <Button variant="outlined" style={{color: "black", borderColor: "black", textTransform: "capitalize"}} title="Change content type" onClick={prepareContentTypeDialog} className={classes.widgetAppBar}>{typeLabel}</Button>
      </>);
    }

    if (isLocked) {
      noteControls = <>
        <div style={{margin: '0 1em'}}>{noteDate.toDateString()}</div>
        <IconButton title="Unlock note" size="large" onClick={evt => {
          setIsLocked(false);
          save(noteDate, false);
        }}><Lock/></IconButton>
      </>;
    } else {
      noteControls = (<>
        {dateControl}
        <IconButton aria-controls="details-menu" aria-haspopup="true"
                    title="Open Editor menu" size="large"
                    onClick={handleDetailsMenuClick}>
          <MoreVert/>
        </IconButton>
        <Menu
            id="details-menu"
            role="menu"
            aria-label="Editor menu"
            anchorEl={detailsMenuAnchorEl}
            keepMounted
            open={Boolean(detailsMenuAnchorEl)}
            onClose={evt => {
              previousSelection.current = null;
              setDetailsMenuAnchorEl(null)
            }}
        >
          <MenuItem onClick={evt => {
            previousSelection.current = null;
            editor.undo();
            setDetailsMenuAnchorEl(null);
          }}>
            Undo &nbsp;<Undo/>
          </MenuItem>
          <MenuItem onClick={evt => {
            previousSelection.current = null;
            editor.redo();
            setDetailsMenuAnchorEl(null);
          }}>
            Redo &nbsp;<Redo/>
          </MenuItem>
          <MenuItem onClick={evt => {
            if (!editor.selection && previousSelection.current) {
              Transforms.select(editor, previousSelection.current);
            }
            previousSelection.current = null;
            pasteFileInput.current.click();
            setDetailsMenuAnchorEl(null);
          }}>
            Paste files...
          </MenuItem>
          <MenuItem disabled={!selectedTable} onClick={evt => {
            if (!editor.selection && previousSelection.current) {
              Transforms.select(editor, previousSelection.current);
            }
            previousSelection.current = null;
            flipTableRowsToColumns(editor);
            setDetailsMenuAnchorEl(null);
          }}>
            Flip Table Rows To Columns
          </MenuItem>
          <MenuItem onClick={evt => {
            setDetailsMenuAnchorEl(null);
            setIsLocked(true);
            save(noteDate, true);
          }}>
            Lock note <Lock/>
          </MenuItem>
          <MenuItem onClick={evt => {
            Transforms.unsetNodes(editor, ['deleted', 'inserted'], {
              at: [],
              match: node => Text.isText(node),
              mode: 'all'
            });
            setDetailsMenuAnchorEl(null);
          }}>
            Clear Deleted &amp; Inserted styles
          </MenuItem>
          <MenuItem onClick={evt => {
            previousSelection.current = null;
            setDetailsMenuAnchorEl(null);
            prepareContentTypeDialog();
          }}>
            Change note type...
          </MenuItem>
        </Menu>
        {formatControls}
      </>);
    }

    content = (<>
      <Slate editor={editor} value={editorValue} onChange={handleSlateChange} >
        <AppBar onClick={toggleFocus} position="sticky" style={appbarStyle}>
          <Toolbar>
            {outBtn}
            {Boolean(noteDate) && ! noteErr ? noteControls : null}
          </Toolbar>
        </AppBar>
        {isLoading ? <Box sx={{position: "absolute", top: '52px', bottom: 0, left: 0, right: 0, zIndex: 1, backgroundColor: 'rgba(128,128,128,50%)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center'}}>
          <progress style={{marginTop: '4ch'}}/>
        </Box> : null}
        <Editable
            key={editableKey}   // change the key to restart editor w/ new editorValue
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            placeholder="Type, or paste or drag some text or a picture."
            className={editor.subtype?.startsWith('html') ? null : "unformatted"}
            onKeyDown={evt => {
              try {
              switch (evt.key) {   // eslint-disable-line default-case
                case 'Tab':
                  if (!evt.shiftKey) {
                    evt.preventDefault();
                    tabRight(editor);
                  } else {
                    evt.preventDefault();
                    tabLeft(editor);
                  }
                  break;
                case 'Enter':
                  if (isHotkey('mod+Enter', { byKey: true }, evt)) {
                    evt.preventDefault();
                    editor.insertText('\n');
                  }
                  break;
                case ' ':
                  if (isHotkey("shift+ ", { byKey: true }, evt)) {
                    evt.preventDefault();
                    evt.stopPropagation();
                    const checkListItemResult = Editor.above(editor, {
                      match: n => 'list-item' === n.type && 'checked' in n,
                      mode: 'lowest'
                    });
                    if (checkListItemResult) {
                      Transforms.setNodes(editor, {checked: ! checkListItemResult[0].checked},
                        { at: checkListItemResult[1] });
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
                case '*':
                case '8':
                case '-':
                  if (isHotkey('mod+*', { byKey: true }, evt) ||
                      isHotkey('mod+8', { byKey: true }, evt) ||
                      isHotkey('mod+shift+8', { byKey: true }, evt) ||
                      isHotkey('mod+-', { byKey: true }, evt) ||
                      isHotkey('mod+shift+-', { byKey: true }, evt)){
                    evt.preventDefault();
                    changeBlockType(editor, 'bulleted-list');
                  }
                  break;
                case '1':
                  if (isHotkey('mod+1', { byKey: true }, evt) ||
                      isHotkey('mod+shift+1', { byKey: true }, evt)) {
                    evt.preventDefault();
                    changeBlockType(editor, 'numbered-list');
                  }
                  break;
                case '[':
                  if (isHotkey('mod+[', { byKey: true }, evt) ||
                    isHotkey('mod+shift+[', { byKey: true }, evt)) {
                    evt.preventDefault();
                    changeBlockType(editor, 'task-list');
                  }
                  break;
                case ']':
                  if (isHotkey('mod+]', { byKey: true }, evt) ||
                    isHotkey('mod+shift+]', { byKey: true }, evt)) {
                    evt.preventDefault();
                    changeBlockType(editor, 'sequence-list');
                  }
                  break;
                case 't':   // blocked in Chrome
                  if (isHotkey('mod+shift+t', { byKey: true }, evt)) {
                    evt.preventDefault();
                    changeBlockType(editor, 'heading-one');
                  }
                  break;
                case 'h':
                  if (isHotkey('mod+shift+h', { byKey: true }, evt)) {
                    evt.preventDefault();
                    changeBlockType(editor, 'heading-two');
                  }
                  break;
                case 's':
                  if (isHotkey('mod+shift+s', { byKey: true }, evt)) {
                    evt.preventDefault();
                    changeBlockType(editor, 'heading-three');
                  }
                  break;
                case "'":
                case '"':
                  if (isHotkey("mod+'", { byKey: true }, evt) || isHotkey("mod+shift+'", { byKey: true }, evt)) {
                    evt.preventDefault();
                    changeBlockType(editor, 'quote');
                  }
                  break;
              }
              } catch (err) {
                console.error(`typed ${evt.key}:`, err);
                window.postMessage({kind: 'TRANSIENT_MSG', message: extractUserMessage(err), severity: err.severity}, window?.location?.origin);
              }
            }}
            // forcing an update preserves focus; unclear why
            onFocus={() => forceRender()}
            decorate={decorate}
            readOnly={isLocked}
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
  }

  function addInsertsAndDeletes(menu, listItem, table, quote, includeThematicBreak) {
    if (listItem || table || quote || includeThematicBreak) {
      menu.push({cmd: '', label: "Insert"});   // divider
    }
    if (listItem || table || quote) {
      menu.push(
          {cmd: 'insert-paragraph', label: "Paragraph"},
          {cmd: 'insert-bulleted-list', label: <><b>•</b><span> Bulleted List</span></>},
          {cmd: 'insert-numbered-list', label: "Numbered List"},
          {cmd: 'insert-task-list', label: "✔️ Task List"},
          {cmd: 'insert-sequence-list', label: "✔️ Sequence"},
          {cmd: 'insert-table', label: "Table"}
      );
    }
    if (table) {
      menu.push(
          {cmd: 'insert-table-row', label: "Table Row"},
          {cmd: 'insert-table-column', label: "Table Column"}
      );
    }
    if (includeThematicBreak && ! listItem && ! table) {
      menu.push({cmd: 'insert-thematic-break',
        label: <>
          <div>Rule</div>
          <hr style={{marginLeft: '1ex', flex: '1 1 auto'}}/>
        </>
      });
    }
    if (table) {
      menu.push(...BLOCK_ITEMS_DELETE);
    }
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
      if (editor.selection) {   // TODO: neither this nor focus are ever truthy here
        ReactEditor.deselect(editor);
        ReactEditor.blur(editor);
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

  async function pasteFileChange(evt) {
    try {
      // console.log("paste files:", evt.target.files)
      ReactEditor.focus(editor);
      const dataTransfer = new DataTransfer();
      for (const file of evt.target.files) {
        dataTransfer.items.add(file);
      }
      await editor.insertData(dataTransfer);
    } catch (err) {
      console.error("while pasting files:", err);
      transientMsg("Switch to another note, then back.");
    } finally {
      pasteFileInput.current.value = "";
    }
  }

  function transientMsg(message, severity = 'error') {
    window.postMessage({
      kind: 'TRANSIENT_MSG',
      severity,
      message
    }, window?.location?.origin);
  }

  return (<>
      <Box ref={boxRef} onClick={toggleFocus} className="details" style={{flexGrow: 1, flexShrink: 1, width: '100%', overflowX: 'clip', overflowY: "auto"}}>
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
           accept={"image/*,text/plain,text/markdown,text/html,text/csv,text/tab-separated-values," + allowedFileTypesNonText.join(',') + ',text/uri-list,text/vcard,text/calendar,text/troff,' + allowedExtensions.join(',')}/>
  </>);
}

function ErrorFallback({error, resetErrorBoundary}) {
  return (
      <div role="alert">
        <details>
          <summary><strong>Sorry, there was an error displaying this note.</strong>
            <p>Select another note or click the Clear button, and carry on.</p>
            <p>If you repeatedly get an error on this note, it is corrupt and should be deleted.</p>
            <Button variant="outlined" onClick={resetErrorBoundary}>Clear</Button>
          </summary>
          <p>{error.message}</p>
        </details>
      </div>
  )
}

Detail.propTypes = {
  noteId: PropTypes.string,
  searchWords: PropTypes.instanceOf(Set),
  focusOnLoadCB: PropTypes.func,
  setMustShowPanel: PropTypes.func,
};

export default Detail;
export {saveFn};

