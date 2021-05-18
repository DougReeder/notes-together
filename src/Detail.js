import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {getNote, upsertNote} from "./idbNotes";
import ContentEditable from 'react-contenteditable';
import sanitizeHtml from 'sanitize-html-react';
// import {Parser, HtmlRenderer} from 'commonmark';
import "./Detail.css";


// eslint-disable-next-line
const semanticOnly = {
  allowedTags: ['h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'ul', 'ol',
    'li', 'dl', 'dt', 'dd', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
    'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre',
    'img', 'del', 'ins', 'kbd', 'q', 'samp', 'sub', 'sup', 'var'],
  disallowedTagsMode: 'discard',
  allowedAttributes: {
    a: [ 'href', 'name', 'target' ],
    img: [ 'src', 'srcset', 'alt' ]
  },
  allowedSchemes: [ 'http', 'https', 'data' ],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: [ 'href', 'src', 'cite' ],
  transformTags: {
    'h1': 'h2',
    'header': 'div',
    'footer': 'div',
    'main': 'div',
    'section': 'div',
    'article': 'div',
    'aside': 'div',
    'textarea': 'div',
    'em': 'i',
    'strong': 'b',
  },
  nonTextTags: [ 'style', 'script', 'noscript', 'nav', 'nl' ],
  allowProtocolRelative: false,
  parser: {
    lowerCaseTags: true,
    lowerCaseAttributeNames: true,
  }
};
// TODO: allow SVG tags

function Detail({noteId}) {

  const [text, setText] = useState(null);
  console.log("Detail noteId:", noteId, text?.slice(0, 50));

  useEffect(() => {
    if (Number.isFinite(noteId)) {
      getNote(noteId).then(theNote => {
        setText(theNote.text);
      }).catch(err => {
        console.error(err);
      });
    }
  }, [noteId]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = async evt => {
    try {
      setText(evt.target.value);
      await upsertNote(noteId, evt.target.value);
    } catch (err) {
      console.error("while handling Detail text change:", err);
    }
  }

  // const markdownReader = new Parser({smart: true});
  // const markdownWriter = new HtmlRenderer({softbreak: "<br />"});

  let content;
  if ('string' === typeof text) {
    content =
        (<ContentEditable
            html={sanitizeHtml(text, semanticOnly)} // innerHTML of the editable div
            disabled={false}       // use true to disable editing
            onChange={handleChange} // handle innerHTML change
            // onPaste={this.pasteSemanticOnly}
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
