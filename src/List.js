// List.js - List component for Notes Together
// Copyright © 2021 Doug Reeder

import React, {useState, useEffect} from 'react';
import {searchNotes} from "./idbNotes";
import sanitizeHtml from 'sanitize-html';
import './List.css';

const uniformList = {allowedTags: [ 'p', 'div',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'i', 'b', 'strike', 'sub', 'sup',
    'br', 'hr', 'pre',
    'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: [ 'href', 'name', 'target' ],
    img: [ 'src', 'srcset', 'alt' ]
  },
  allowedSchemes: [ 'data' ],
  transformTags: {
    'h1': 'div',
    'h2': 'div',
    'h3': 'div',
    'h4': 'div',
    'h5': 'div',
    'h6': 'div',
    'header': 'div',
    'footer': 'div',
    'main': 'div',
    'section': 'div',
    'article': 'div',
    'aside': 'div',
    'textarea': 'div',
    'blockquote': 'div',
    'code': 'div',
    'em': 'i',
    'strong': 'b'
  },
  nonTextTags: [ 'style', 'script', 'noscript', 'nav', 'nl' ],
  enforceHtmlBoundary: true,
  parser: {
    decodeEntities: false,
  }
};
// TODO: allow SVG tags

function List(props) {
  const {searchStr, changeCount, selectedNoteId, handleSelect} = props;

  const [notes, setNotes] = useState([]);
  // console.log("List props:", props, "   notes:", notes);

  useEffect(() => {
    searchNotes(searchStr).then(notes => {
      setNotes(notes);
      changeCount(notes.length);
    })
  }, [searchStr]);  // eslint-disable-line react-hooks/exhaustive-deps

  function onClick(evt) {
    const article = evt.target.closest("article");
    const id = Number(article?.dataset?.id);
    if (Number.isFinite(id)) {
      handleSelect(id);
    }
  }

  const externalChangeListener = evt => {
    if (evt.origin !== window.location.origin || evt.data?.kind !== 'NOTE_CHANGE') return;
    const notesChanged = evt.data?.notesChanged || {};
    const notesAdded = evt.data?.notesAdded || {};
    const notesDeleted = evt.data?.notesDeleted || {};
    console.log("List externalChange", notesChanged, notesAdded, notesDeleted);

    const newNotes = [];
    notes.forEach((note, i) => {
      if (notesChanged.hasOwnProperty(note.id)) {
        // TODO: verify that it still matches search string
        newNotes.push(notesChanged[note.id]);
      } else if (! notesDeleted.hasOwnProperty(note.id)) {
        newNotes.push(note);
      }
    });
    // TODO: add notes from notesAdded that match (& sort?)
    setNotes(newNotes);
  };
  useEffect( () => {
    window.addEventListener("message", externalChangeListener);

    return function removeExternalChangeListener() {
      window.removeEventListener("message", externalChangeListener);
    };
  });

  let listItems;
  if (notes.length > 0) {
    listItems = notes.map(
        (note) => {
          const incipit = note.text.slice(0, 300);
          const cleanHtml = sanitizeHtml(incipit, uniformList);
          return <article data-id={note.id} key={note.id.toString()} dangerouslySetInnerHTML={{__html: cleanHtml}}
                          className={note.id === selectedNoteId ? 'selected' : ''}
          ></article>
        }
    );
  } else {
    listItems = <div className="advice">No notes</div>
  }
  return (
      <div className="list" onClick={onClick}>
        {listItems}
      </div>
  );
}

export default List;
