// listUtil.js - utilities for lists of notes, for Notes Together
// Copyright © 2021 Doug Reeder

const uniformList = {allowedTags: [ 'p', 'div',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'strike', 'sub', 'sup',
    'code', 'br', 'hr', 'pre',
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
  },
  nonTextTags: [ 'style', 'script', 'noscript', 'nav', 'nl', 'rp', 'rt' ],
  enforceHtmlBoundary: true,
  parser: {
    decodeEntities: false,
  }
};


function updateListWithChanges(oldNotes, notesChanged, notesDeleted, searchWords) {
  const newNotes = [];
  const listChanges = new Set();
  // updates and/or deletes old notes
  oldNotes.forEach((note) => {
    if (notesDeleted.hasOwnProperty(note.id)) {
      listChanges.add(note.id);   // doesn't add to newNotes
    } else if (notesChanged.hasOwnProperty(note.id)) {
      // TODO: verify that it still matches search string
      newNotes.push(notesChanged[note.id]);
      listChanges.add(note.id);
    } else {
      newNotes.push(note);
    }
  });

  // adds new notes that match
  outer: for (const changedNote of Object.values(notesChanged)) {
    if (listChanges.has(changedNote.id)) continue;

    for (const searchWord of searchWords) {
      if (!changedNote.wordArr.some(noteWord => noteWord.startsWith(searchWord))) {
        continue outer;   // searchWord not in note
      }
    }
    newNotes.unshift(changedNote);
    listChanges.add(changedNote.id);
  }

  // checks if re-sorting is required
  let isSortRequired = false;
  let lastDate = new Date(275760, 8, 12);
  for (const note of newNotes) {
    if (note.date > lastDate) {
      isSortRequired = true;
      break;
    }
    lastDate = note.date;
  }
  if (isSortRequired) {
    newNotes.sort(compareByDate);
  }

  const isChanged = listChanges.size > 0;
  return {isChanged, newNotes}
}

function compareByDate(itemA, itemB) {
  return itemB.date - itemA.date;
}

export {uniformList, updateListWithChanges};
