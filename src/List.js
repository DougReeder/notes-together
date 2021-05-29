// List.js - List component for Notes Together
// Copyright © 2021 Doug Reeder

import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
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
    const noteEl = evt.target.closest("li.note");
    const id = Number(noteEl?.dataset?.id);
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
    let isSelectedInList = false;
    notes.forEach((note, i) => {
      if (notesChanged.hasOwnProperty(note.id)) {
        // TODO: verify that it still matches search string
        newNotes.push(notesChanged[note.id]);
      } else if (! notesDeleted.hasOwnProperty(note.id)) {
        newNotes.push(note);
      }

      if (note.id === selectedNoteId) {
        isSelectedInList = true;
      }
    });
    // TODO: add notes from notesAdded that match (& sort?)

    if (!isSelectedInList) {
      let selectedNote = notesChanged[selectedNoteId] || notesAdded[selectedNoteId];
      if (selectedNote && ! notesDeleted.hasOwnProperty(selectedNoteId)) {
        newNotes.unshift(selectedNote);
      }
    }

    setNotes(newNotes);
    changeCount(newNotes.length);
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
          return <li data-id={note.id} key={note.id.toString()} dangerouslySetInnerHTML={{__html: cleanHtml}}
                          className={'note ' + (note.id === selectedNoteId ? 'selected' : '')}
          ></li>
        }
    );
  } else {
    listItems = <div className="advice">No notes</div>
  }
  return (
      <ol className="list" onClick={onClick}>
        {listItems}
      </ol>
  );
}

List.propTypes = {
  searchStr: PropTypes.string,
  changeCount: PropTypes.func,
  selectedNoteId: PropTypes.number,
  handleSelect: PropTypes.func
}

export default List;
