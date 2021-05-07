// idbNotes.js - IndexedDB facade for Notes Together
// Copyright © 2021 Doug Reeder

const notes = {
  101: "<h1>The rain in Spain</h1> stays mainly in the plain <i>foo",
  102: "<UL><LI>erste</LI><li><SUP>foo</li><li>dritte",
  103: "<blockquote>Four score and seven years ago, our forefathers set forth on this continent a new nation <strike>foo",
  104: "<dl><dt>Here we go</dt><dd>gathering nuts in May <b>foo",
  105: "<pre>The dao that is seen\nis not the true dao\nuntil you bring fresh toner",
  106: "<textarea>These are the times that try men's souls. The summer soldier and the sunshine patriot will, in this crisis, shrink from the service of their country; but he that stands it now, deserves the love and thanks of man and woman. <sub>foo",
  107: "<h2>Star Trek II: The Wrath of Khan</h2>The best one"
};

async function searchNotes(searchStr) {
  return await new Promise((resolve, reject) => {
    setTimeout(() => {
      const foundNotes = [];
      if (!searchStr) {
        for (const [key, value] of Object.entries(notes)) {
          foundNotes.push({id:key, text: value});
        }
      } else {
        const re = new RegExp(searchStr, "i");
        for (const [key, value] of Object.entries(notes)) {
          if (re.test(value)) {
            foundNotes.push({id:key, text: value});
          }
        }
      }
      // console.log(`searchNotes returning ${foundNotes.length} notes`);
      resolve(foundNotes);
    }, 500);
  });
}

export {searchNotes};
