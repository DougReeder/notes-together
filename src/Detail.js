import {createMemoryNote, semanticOnly} from './Note';
import {isLikelyMarkdown} from "./util";
import React, {useEffect, useState} from 'react';
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

  const [text, setText] = useState(null);
  // console.log("Detail noteId:", noteId, "   text:", text?.slice(0, 50));

  useEffect(() => {
    if (Number.isFinite(noteId)) {
      getNote(noteId).then(theNote => {
        setText(theNote.text);
      }).catch(err => {
        console.error(err);
      });
    }
  }, [noteId]);  // eslint-disable-line react-hooks/exhaustive-deps

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
      setText(evt.target.value);
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
        const html = markdownWriter.render(parsed);
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


  let content;
  if ('string' === typeof text) {
    content =
        (<ContentEditable
            html={sanitizeHtml(text, semanticAddMark)} // innerHTML of the editable div
            disabled={false}       // use true to disable editing
            onChange={handleChange} // handle innerHTML change
            onPaste={pasteSemanticOnly}
            tagName='article' // Use a custom HTML tag (uses a div by default)
        />);
  } else {
    content =
        (<div>
          <div className="advice">Select a note on the left to display it in full.</div>
        </div>);
  }
  return content;
}

Detail.propTypes = {
  noteId: PropTypes.number,
};

export default Detail;
