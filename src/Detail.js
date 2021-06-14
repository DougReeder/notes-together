import {createMemoryNote, semanticOnly} from './Note';
import {isLikelyMarkdown} from "./util";
import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {getNote, upsertNote} from "./idbNotes";
import ContentEditable from 'react-contenteditable';
import sanitizeHtml from 'sanitize-html';
import {Parser, HtmlRenderer} from 'commonmark';
import "./Detail.css";
import {Alert, AlertTitle} from "@material-ui/lab";


const markdownReader = new Parser({smart: true});
const markdownWriter = new HtmlRenderer({softbreak: "<br />"});
const semanticAddMark = JSON.parse(JSON.stringify(semanticOnly));

function Detail({noteId, searchStr}) {

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
      console.error("Detail handleChange:", err);
      setNoteErr(err);
    }
  }, [searchStr]);

  const [noteText, setNoteText] = useState();

  useEffect(() => {
    if (Number.isFinite(noteId)) {
      getNote(noteId).then(theNote => {
        setNoteText(sanitizeHtml(theNote.text, semanticAddMark))
      }).catch(err => {
        // eslint-disable-next-line
        switch (err.name) {
          case "MissingError":
            err.userMsg = "Did you delete this note in another tab?"
            err.severity = 'warning';
            break;
          case "SyntaxError":   // RegEx
            err.userMsg = "You can't search on that"
            err.severity = 'warning';
        }
        setNoteErr(err);
      });
    }
  }, [noteId, searchStr]);

  const handleChange = async evt => {
    try {
      setNoteErr(null);
      await upsertNote(createMemoryNote(noteId, evt.target.value));
    } catch (err) {
      console.error("Detail handleChange:", err);
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
          html = html.replace(/(?<=[A-Za-z])\^2(?!\d)/g, "²");
          html = html.replace(/(?<=[A-Za-z])\^3(?!\d)/g, "³");
          html = html.replace(/(?<=[A-Za-z])\^1(?!\d)/g, "¹");
          html = html.replace(/(?<=[A-Za-z])\^0(?!\d)/g, "⁰");
          html = html.replace(/(?<=[A-Za-z])\^4(?!\d)/g, "⁴");
          html = html.replace(/(?<=[A-Za-z])\^5(?!\d)/g, "⁵");
          html = html.replace(/(?<=[A-Za-z])\^6(?!\d)/g, "⁶");
          html = html.replace(/(?<=[A-Za-z])\^7(?!\d)/g, "⁷");
          html = html.replace(/(?<=[A-Za-z])\^8(?!\d)/g, "⁸");
          html = html.replace(/(?<=[A-Za-z])\^9(?!\d)/g, "⁹");
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

  if (!noteErr) {
    return (<ContentEditable
        html={noteText || ""}
        disabled={false}       // use true to disable editing
        onChange={handleChange} // handle innerHTML change
        onPaste={pasteSemanticOnly}
        tagName='article' // Use a custom HTML tag (uses a div by default)
    />);
  } else {
    return (<Alert severity={noteErr.severity || "error"}>
      <AlertTitle>{noteErr?.userMsg || "Restart your device"}</AlertTitle>
      {noteErr?.message || noteErr?.name || noteErr?.toString()}
    </Alert>);
  }
}

Detail.propTypes = {
  noteId: PropTypes.number,
};

export default Detail;
