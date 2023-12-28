// listUtil.js - utilities for lists of notes, for Notes Together
// Copyright © 2021,2024 Doug Reeder


function updateListWithChanges(oldNotes, notesChanged, notesDeleted, searchWords) {
  const newNotes = [];
  const listChanges = new Set();
  // updates and/or deletes old notes
  oldNotes.forEach((note) => {
    if (Object.hasOwn(notesDeleted, note.id)) {
      listChanges.add(note.id);   // doesn't add to newNotes
    } else if (Object.hasOwn(notesChanged, note.id)) {
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

export {updateListWithChanges};
