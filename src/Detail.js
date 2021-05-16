import React, {useEffect, useState} from 'react';
import {getNote} from "./idbNotes";
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

function Detail(props) {
  const {noteId} = props;

  const [note, setNote] = useState(null);
  console.log("Detail props:", props, "   note:", note);

  useEffect(() => {
    if (Number.isFinite(noteId)) {
      getNote(noteId).then(theNote => {
        setNote(theNote);
      }).catch(err => {
        console.error(err);
      });
    }
  }, [noteId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // const markdownReader = new Parser({smart: true});
  // const markdownWriter = new HtmlRenderer({softbreak: "<br />"});

  let content;
  if (note) {
    content =
        (<ContentEditable
            html={sanitizeHtml(note.text, semanticOnly)} // innerHTML of the editable div
            disabled={false}       // use true to disable editing
            // onChange={this.handleChange} // handle innerHTML change
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

export default Detail;
