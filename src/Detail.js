import {createMemoryNote, semanticOnly} from './Note';
import {isLikelyMarkdown} from "./util";
import React, {useEffect, useRef} from 'react';
import PropTypes from 'prop-types';
import {getNote, upsertNote} from "./idbNotes";
import ContentEditable from 'react-contenteditable';
import sanitizeHtml from 'sanitize-html';
import {Parser, HtmlRenderer} from 'commonmark';
import "./Detail.css";


const markdownReader = new Parser({smart: true});
const markdownWriter = new HtmlRenderer({softbreak: "<br />"});
const semanticAddMark = JSON.parse(JSON.stringify(semanticOnly));

function Detail({noteId, searchStr}) {
  const articleRef = useRef(null);

  // console.log("Detail noteId:", noteId, "   searchStr:", searchStr);

  useEffect(() => {
    if (Number.isFinite(noteId)) {
      getNote(noteId).then(theNote => {
        articleRef.current.el.current.innerHTML =
            sanitizeHtml(theNote.text, semanticAddMark);
      }).catch(err => {
        console.error("while getting note:", err);
        alert("Restart your device: " + err.message);
      });
    }
  });  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
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
  }, [searchStr]);

  const handleChange = async evt => {
    try {
      await upsertNote(createMemoryNote(noteId, evt.target.value));
    } catch (err) {
      console.error("while handling Detail text change:", err);
    }
  }

  const pasteSemanticOnly = evt => {
    // console.log("pasteSemanticOnly types:", evt.clipboardData.types);

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

    function pasteHtml(html) {
      html = sanitizeHtml(html, semanticOnly);
      document.execCommand('insertHTML', false, html);
    }
  };


  return (<ContentEditable
            html=""
            disabled={false}       // use true to disable editing
            onChange={handleChange} // handle innerHTML change
            onPaste={pasteSemanticOnly}
            tagName='article' // Use a custom HTML tag (uses a div by default)
            ref={articleRef}
        />);
}

Detail.propTypes = {
  noteId: PropTypes.number,
};

export default Detail;
