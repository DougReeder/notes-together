import {createMemoryNote} from './Note';
import {semanticOnly} from './sanitizeNote';
import {isLikelyMarkdown} from "./util";
import React, {useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import {getNote, upsertNote} from './storage';
import ContentEditable from 'react-contenteditable';
import sanitizeHtml from 'sanitize-html';
import {Parser, HtmlRenderer} from 'commonmark';
import "./Detail.css";
import {AppBar, Box, IconButton, Input, Toolbar} from "@material-ui/core";
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import {Alert, AlertTitle} from "@material-ui/lab";


const markdownReader = new Parser({smart: true});
const markdownWriter = new HtmlRenderer({softbreak: "<br />"});
const semanticAddMark = JSON.parse(JSON.stringify(semanticOnly));

function Detail({noteId, searchStr = "", focusOnLoadCB, setMustShowPanel}) {

  useEffect(() => {
    try {
      setNoteErr(null);
      if (/\S/.test(searchStr)) {
        semanticAddMark.textFilter = function (text, tagName) {
          const re = new RegExp('\\b(' + searchStr + ')', 'ig');
          const highlighted = '<mark>$1</mark>';
          const newText = text.replace(re, highlighted);
          return newText;
        }
      } else {
        delete semanticAddMark.textFilter;
      }
    } catch (err) {
      console.error("Detail set textFilter:", err);
      setNoteErr(err);
    }
  }, [searchStr]);

  const [noteText, setNoteText] = useState();
  const [noteDate, setNoteDate] = useState();
  const editable = useRef(null);

  useEffect(() => {
    setNoteErr(null);
    if (Number.isFinite(noteId)) {
      getNote(noteId).then(theNote => {
        if ('object' === typeof theNote) {
          setNoteText(sanitizeHtml(theNote.text, semanticAddMark));
          setNoteDate(theNote.date);
          if ('function' === typeof focusOnLoadCB) {
            editable?.current?.el?.current?.focus();
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
      setNoteText("");
      setNoteDate(null);
    }
  }, [noteId, searchStr, focusOnLoadCB]);

  const handleTextChange = async evt => {
    try {
      setNoteErr(null);
      setNoteText(evt.target.value);
      await upsertNote(createMemoryNote(noteId, evt.target.value, noteDate), 'DETAIL');
    } catch (err) {
      console.error("Detail handleTextChange:", err);
      setNoteErr(err);
    }
  }

  async function handleDateChange(evt) {
    try {
      setNoteErr(null);
      const year = parseInt(evt.target.value.slice(0, 4), 10);
      const month = parseInt(evt.target.value.slice(5, 7), 10);
      const day = parseInt(evt.target.value.slice(8, 10), 10);
      const newDate = new Date(year, month-1, day, noteDate.getHours(), noteDate.getMinutes(), noteDate.getSeconds(), noteDate.getMilliseconds());
      setNoteDate(newDate);
      await upsertNote(createMemoryNote(noteId, noteText, newDate), 'DETAIL');
    } catch (err) {
      console.error("Detail handleDateChange:", err);
      setNoteErr(err);
    }
  }

  const pasteSemanticOnly = evt => {
    try {
      setNoteErr(null);
      if (evt.clipboardData.types.indexOf('text/html') > -1) {
        evt.preventDefault();
        const html = evt.clipboardData.getData('text/html');
        pasteHtml(html);
        return true;
      } else if (evt.clipboardData.types.indexOf('image/svg+xml') > -1) {
        evt.preventDefault();
        const svg = evt.clipboardData.getData('image/svg+xml');
        pasteHtml(svg);
        return true;
      } else if (evt.clipboardData.types.indexOf('text/plain') > -1) {
        evt.preventDefault();
        const text = evt.clipboardData.getData('text/plain');
        if (isLikelyMarkdown(text)) {
          const parsed = markdownReader.parse(text);
          let html = markdownWriter.render(parsed);
          html = html.replace(/([A-Za-z])\^2(?!\d)/g, "$1²");
          html = html.replace(/([A-Za-z])\^3(?!\d)/g, "$1³");
          html = html.replace(/([A-Za-z])\^1(?!\d)/g, "$1¹");
          html = html.replace(/([A-Za-z])\^0(?!\d)/g, "$1⁰");
          html = html.replace(/([A-Za-z])\^4(?!\d)/g, "$1⁴");
          html = html.replace(/([A-Za-z])\^5(?!\d)/g, "$1⁵");
          html = html.replace(/([A-Za-z])\^6(?!\d)/g, "$1⁶");
          html = html.replace(/([A-Za-z])\^7(?!\d)/g, "$1⁷");
          html = html.replace(/([A-Za-z])\^8(?!\d)/g, "$1⁸");
          html = html.replace(/([A-Za-z])\^9(?!\d)/g, "$1⁹");
          pasteHtml(html);
        } else if (/<svg\s[^>]*>/.test(text)) {
          pasteHtml(text);
        } else {
          document.execCommand('insertText', false, text);
        }
        return true;
      } else {   // use default handling for images, etc.
        // TODO: convert text/rtf to HTML
        // TODO: extract image metadata and append
        return false;
      }
    } catch (err) {
      err.userMsg = "Can you type in the info?"
      setNoteErr(err);
    }

    function pasteHtml(html) {
      html = sanitizeHtml(html, semanticOnly);
      document.execCommand('insertHTML', false, html);
    }
  };

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
      setNoteText(notesChanged[noteId].text);
      setNoteDate(notesChanged[noteId].date);
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

  let content;
  if (noteErr) {
    content = (<Alert severity={noteErr.severity || "error"} style={{margin: "2ex"}}>
      <AlertTitle>{noteErr?.userMsg || "Restart your device"}</AlertTitle>
      {noteErr?.message || noteErr?.name || noteErr?.toString()}
    </Alert>);
  } else {
    content = (<ContentEditable
        html={noteText || ""}
        disabled={false}       // use true to disable editing
        ref={editable}
        onChange={handleTextChange} // handle innerHTML change
        onPaste={pasteSemanticOnly}
        tagName='article' // Use a custom HTML tag (uses a div by default)
        style={{padding: "2ex"}}
    />);
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
