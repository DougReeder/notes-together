// fileExport.js - file export function for Notes Together
// Copyright © 2024 Doug Reeder

import {findNoteIds, getNote} from "./storage";
import hasTagsLikeHtml from "./util/hasTagsLikeHtml";
import {deserializeHtml} from "./slateHtml";
import {serializeMarkdown} from "./slateMark";
import {shortenTitle} from "./Note.js";
import {transientMsg} from "./util/extractUserMessage.js";
import {extractExtension} from "./util.js";

export async function fileExportMarkdown(searchStr, searchWords) {
  if (!('showSaveFilePicker' in window)) {
    const err = new Error("This browser can't stream to files. Try Chrome, Edge or Opera on a computer.");
    err.severity = 'info';
    throw err;
  }

  // synchronously gets a file handle (during event)
  const d = new Date();
  const dateName = "notes-together-" + d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  const fileHandle = await window.showSaveFilePicker({
    id: 'export',
    suggestedName: `${searchStr.trim() || dateName}.md`, types: [
      {description: "Markdown", accept: {"text/markdown": [".md"]}},
    ]
  });
  const extension = extractExtension(fileHandle);
  if (! ['.md', '.mkd', '.mkdn', '.mdown', '.markdown', '.txt'].includes(extension)) {
    transientMsg(`A file extension of “${extension}” will make it difficult for you to access Markdown text.`, 'warning');
  }

  // asynchronously writes file
  const writableStream = await fileHandle.createWritable();

  const ids = await findNoteIds(searchWords);
  let numWritten = 0;
  for (const id of ids) {
    const note = await getNote(id)

    let content;
    if (hasTagsLikeHtml(note.mimeType)) {
      const slateNodes = deserializeHtml(note.content);
      content = serializeMarkdown(slateNodes)
    } else if (!note.mimeType || /^text\//.test(note.mimeType)) {
      content = note.content;
    } else {
      const msg = `Can't export “${note.mimeType}” note`;
      console.error(msg);
      transientMsg(msg);
      continue;
    }

    const blob = new Blob([content, "\n", note.date?.toISOString(), "\n\n\n\n"], {type: 'text/plain'});
    console.info(`writing “${shortenTitle(note.title)}” ${note.date.toISOString()}`);
    await writableStream.write(blob);
    ++numWritten;
  }

  await writableStream.close();

  const message = `Wrote ${numWritten} notes to ${fileHandle.name}`;
  console.info(message);
  transientMsg(message, 'success');

  return numWritten;
}
