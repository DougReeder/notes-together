// idbNotes.js - IndexedDB facade for Notes Together
// Copyright © 2021 Doug Reeder

import {createMemoryNote} from "./Note";

const notes = {
  101: "<h1>The rain in Spain</h1> stays mainly in the plain <i>foo",
  102: "<UL><LI>H<sub>2</sub>O</LI><li>C<SUP>3</SUP>I</li><li>dritte",
  103: `Lincoln's Gettysburg Address<blockquote>
    <p>Four score and seven years ago our fathers brought forth on this continent a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.</p>

    <p>Now we are engaged in a great civil war, testing whether that nation or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this.

    <p>But, in a larger sense, we can not dedicate—we can not consecrate—we can not hallow—this ground. The brave men, living and dead, who struggled here, have consecrated it, far above our poor power to add or detract. The world will little note, nor long remember what we say here, but it can never forget what they did here. It is for us the living, rather, to be dedicated here to the unfinished work which they who fought here have thus far so nobly advanced. It is rather for us to be here dedicated to the great task remaining before us—that from these honored dead we take increased devotion to that cause for which they gave the last full measure of devotion—that we here highly resolve that these dead shall not have died in vain—that this nation, under God, shall have a new birth of freedom—and that government of the people, by the people, for the people, shall not perish from the earth.
 <strike>foo`,
  104: "<dl><dt>Here we go</dt><dd>gathering nuts in May <b>foo",
  105: "<pre>The dao that is seen\nis not the true dao\nuntil you bring fresh toner",
  106: "<textarea>These are the times that try men's souls. The summer soldier and the sunshine patriot will, in this crisis, shrink from the service of their country; but he that stands it now, deserves the love and thanks of man and woman. <sub>foo",
  107: `tensile structures
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
`,
  108: "<h2>Star Trek II: The Wrath of Khan</h2>The best one"
};

async function searchNotes(searchStr) {
  return await new Promise((resolve, reject) => {
    setTimeout(() => {
      const foundNotes = [];
      if (!searchStr) {
        for (const [key, value] of Object.entries(notes)) {
          foundNotes.push(createMemoryNote(Number(key), value));
        }
      } else {
        const re = new RegExp("\\b" + searchStr, "i");
        for (const [key, value] of Object.entries(notes)) {
          if (re.test(value)) {
            foundNotes.push({id:Number(key), text: value});
          }
        }
      }
      // console.log(`searchNotes returning ${foundNotes.length} notes`);
      resolve(foundNotes);
    }, 500);
  });
}

function getNote(id) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (notes.hasOwnProperty(id)) {
        resolve({id: id, text: notes[id]});
      } else {
        reject(new Error("no note with id="+id));
      }
    }, 100);
  });
}

function upsertNote(note) {
  if (!Number.isSafeInteger(note.id)) {
    throw new Error("id must be safe integer");
  } else if ('string' !== typeof note.text) {
    throw new Error("newText must be string");
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      const notesChanged = {}, notesAdded = {};
      if (notes.hasOwnProperty(note.id)) {
        notesChanged[note.id] = note;   // postMessage will clone
      } else {
        notesAdded[note.id] = note;   // postMessage will clone
      }
      notes[note.id] = note.text;
      console.log("upsertNote", note.id, note.text?.slice(0, 50));
      window.postMessage({kind: 'NOTE_CHANGE', notesChanged, notesAdded, notesDeleted: {}}, window.location.origin);
      resolve(note.id);
    }, 100);
  });
}

export {searchNotes, getNote, upsertNote};
