// idbNotes.js - IndexedDB facade for Notes Together
// Copyright © 2021 Doug Reeder

import removeDiacritics from "./diacritics";
import {semanticOnly} from "./Note";
import sanitizeHtml from "sanitize-html";

/** callback may be called *multiple* times */

const notes = {};

/**
 * Searches for notes which match (as a prefix) each word in searchStr.
 * @param searchStr
 * @param callback may be called *multiple* times; isPartial means there are more results; isFinal means no more results will be returned; *both* will be true when there are more than 500 matching notes
 */
function searchNotes(searchStr, callback) {
  setTimeout(() => {
    try {
      const foundNotes = [];
      const searchWords = parseWords(searchStr);
      if (searchWords.size === 0) {
        for (const note of Object.values(notes)) {
          foundNotes.push(Object.assign({}, note));
        }
      } else {
        for (const note of Object.values(notes)) {
          let noteMatch = true;
          for (let searchWord of searchWords) {
            let searchWordMatch = note.wordArr.some(keyword => keyword.startsWith(searchWord));
            if (!searchWordMatch) {
              noteMatch = false;
            }
          }
          if (noteMatch) {
            foundNotes.push(Object.assign({}, note));
          }
        }
      }
      // console.log(`searchNotes returning ${foundNotes.length} notes`);
      callback(null, foundNotes.slice(0,3), {isPartial: true, isFinal: false});

      setTimeout( () => {
        callback(null, foundNotes, {isPartial: false, isFinal: true});
      }, 500);
    } catch (err) {
      callback(err);
    }
  }, 500);
}

function getNote(id) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (notes.hasOwnProperty(id)) {
        resolve(Object.assign({}, notes[id]));
      } else {
        reject(new Error("no note with id="+id));
      }
    }, 100);
  });
}

function upsertNote(note) {
  if (!Number.isFinite(note.id)) {
    throw new Error("id must be finite");
  } else if ('string' !== typeof note.text) {
    throw new Error("newText must be string");
  }
  const dbNote = toDbNote(note)

  return new Promise((resolve) => {
    setTimeout(() => {
      const notesChanged = {}, notesAdded = {};
      if (notes.hasOwnProperty(dbNote.id)) {
        notesChanged[dbNote.id] = dbNote;   // postMessage will clone
      } else {
        notesAdded[dbNote.id] = dbNote;   // postMessage will clone
      }
      notes[dbNote.id] = dbNote;
      // console.log("upsertNote", dbNote.id, dbNote.text?.slice(0, 50));
      window.postMessage({kind: 'NOTE_CHANGE', notesChanged, notesAdded, notesDeleted: {}}, window.location.origin);
      resolve(dbNote);
    }, 100);
  });
}

function deleteNote(id) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Number.isFinite(id)) {
        delete notes[id];

        const notesDeleted = {};
        notesDeleted[id] = true;
        window.postMessage({kind: 'NOTE_CHANGE', notesChanged: {}, notesAdded: {}, notesDeleted}, window.location.origin);

        resolve(id);
      } else {
        reject(new Error("not finite: " + id));
      }
    }, 100);
  });
}


const semanticExtractKeywords = JSON.parse(JSON.stringify(semanticOnly));

function toDbNote(memoryNote) {
  if (! memoryNote || !Number.isFinite(memoryNote.id) || typeof memoryNote.text !== 'string') {
    throw new Error("can't store malformed memoryNote: " + JSON.stringify(memoryNote));
  }

  const wordSet = new Set();
  semanticExtractKeywords.textFilter = function (text) {
    const someWords = parseWords(text);
    for (let word of someWords) {
      wordSet.add(word);
    }
    return text;
  }
  const sanitizedText = sanitizeHtml(memoryNote.text, semanticExtractKeywords);
  for (let candidateWord of wordSet) {
    for (let otherWord of wordSet) {
      if (otherWord !== candidateWord && candidateWord.startsWith(otherWord)) {
        wordSet.delete(otherWord);
      }
    }
  }

  return {
    id: memoryNote.id,
    text: sanitizedText,
    wordArr: Array.from(wordSet),
    date: memoryNote.date || new Date(),
  };
}

function parseWords(text) {
  text = removeDiacritics(text);

  const wordSet = new Set();
  // initializes regexp and its lastIndex property outside the loop
  // ASCII, Unicode, no-break & soft hyphens
  // ASCII apostrophe, right-single-quote, modifier-letter-apostrophe
  const wordRE = /[-‐‑­'’ʼ.^\wÑñ]+/g;
  let result, normalizedWord;

  while ((result = wordRE.exec(text)) !== null) {
    if ((normalizedWord = normalizeWord(result[0]))) {
      wordSet.add(normalizedWord);
    }
  }
  return wordSet
}

function normalizeWord(word) {
  // ASCII, Unicode, no-break & soft hyphens
  word = word.toUpperCase().replace(/-|‐|‑|­|_|^'+|'+$|\^/g, "");
  // not a word containing only digits and decimal points
  if (! /^[\d.]+$/.test(word)) {
    word = word.replace(/\./g, "");
  }
  return word;
}

upsertNote({id: Number.MAX_SAFE_INTEGER + 2, text:"<h1>The rain in Spain</h1> stays mainly in the plain <i>foo"});
upsertNote({id: Number.MAX_SAFE_INTEGER + 3, text: "<ul><li>H<sub>2</sub>O</li><li>C³I</li><li>2º libro, la Calle 3ª</li><li>grüßen"});
upsertNote({id: Number.MAX_SAFE_INTEGER + 4, text: `Lincoln's Gettysburg Address<blockquote>
    <p>Four score and seven years ago our fathers brought forth on this continent a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.</p>

    <p>Now we are engaged in a great civil war, testing whether that nation or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this.

    <p>But, in a larger sense, we can not dedicate—we can not consecrate—we can not hallow—this ground. The brave men, living and dead, who struggled here, have consecrated it, far above our poor power to add or detract. The world will little note, nor long remember what we say here, but it can never forget what they did here. It is for us the living, rather, to be dedicated here to the unfinished work which they who fought here have thus far so nobly advanced. It is rather for us to be here dedicated to the great task remaining before us—that from these honored dead we take increased devotion to that cause for which they gave the last full measure of devotion—that we here highly resolve that these dead shall not have died in vain—that this nation, under God, shall have a new birth of freedom—and that government of the people, by the people, for the people, shall not perish from the earth.
 <strike>foo`});
upsertNote({id: Number.MAX_SAFE_INTEGER + 7, text: "<dl><dt>Here we go</dt><dd>gathering nuts in May <code>foo"});
upsertNote({id: Number.MAX_SAFE_INTEGER + 8, text: "<pre>The dao that is seen\nis not the true dao\nuntil you bring fresh toner"});
upsertNote({id: Number.MAX_SAFE_INTEGER + 11, text: "<textarea>These are the times that try men's souls. The summer soldier and the sunshine patriot will, in this crisis, shrink from the service of their country; but he that stands it now, deserves the love and thanks of man and woman. <sub>foo"});
upsertNote({id: Number.MAX_SAFE_INTEGER + 12, text: `tensile structures
<svg fill="none" stroke-linecap="square" stroke-miterlimit="10" version="1.1" viewBox="0 0 226.77 226.77" xmlns="http://www.w3.org/2000/svg">
 <g transform="translate(8.964 4.2527)" fill-rule="evenodd" stroke="#000" stroke-linecap="butt" stroke-linejoin="round" stroke-width="4">
  <path d="m63.02 200.61-43.213-174.94 173.23 49.874z"/>
  <path d="m106.39 50.612 21.591 87.496-86.567-24.945z"/>
  <path d="m84.91 125.03-10.724-43.465 43.008 12.346z"/>
  <path d="m63.458 38.153 10.724 43.465-43.008-12.346z"/>
  <path d="m149.47 62.93 10.724 43.465-43.008-12.346z"/>
  <path d="m84.915 125.06 10.724 43.465-43.008-12.346z"/>
 </g>
</svg>
`});
upsertNote({id: Number.MAX_SAFE_INTEGER + 15, text: "<h1>Star Trek II: The Wrath of Khan</h1>the best of everything that was best about Star Trek TOS<br>adventure, science-fiction"});
upsertNote({id: Number.MAX_SAFE_INTEGER + 16, text: `The <ruby>
  漢 <rp>(</rp><rt>Kan</rt><rp>)</rp>
  字 <rp>(</rp><rt>ji</rt><rp>)</rp>
</ruby> for tomorrow is <ruby>
  明日 <rp>(</rp><rt>Ashita</rt><rp>)</rp>
</ruby>`});
upsertNote({id: Number.MAX_SAFE_INTEGER + 19, text: "<h2>Star Trek III: The Search for Spock</h2>has difficulties standing on its own; it relies heavily on knowledge of <em>Khan</em>.<br>adventure, science-fiction"});
upsertNote({id: Number.MAX_SAFE_INTEGER + 20, text: "<h3>Star Trek IV: The Voyage Home</h3>the funniest of all the star trek films due to the fact that it is played totally tongue in cheek<br>adventure, science-fiction"});
upsertNote({id: Number.MAX_SAFE_INTEGER + 23, text: "<h4>Star Wars: Episode IV - A New Hope</h4>the characters I liked most in this one are old Obi-Wan Kenobi, wonderfully portrayed by Alec Guinness, and Han Solo<br>adventure, science-fiction"});


export {searchNotes, getNote, upsertNote, deleteNote, parseWords};
