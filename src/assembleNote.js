// assembleNote.js — constructs a single note from multiple parts
// Copyright © 2024 Doug Reeder under the MIT License

import hasTagsLikeHtml from "./util/hasTagsLikeHtml.js";
import {NodeNote} from "./Note.js";
import {imageFileToDataUrl} from "./util/imageFileToDataUrl.js";
import {extractUserMessage, transientMsg} from "./util/extractUserMessage.js";
import {urlRunningTextRE, normalizeUrl, extractSubtype, extractExtension} from "./util.js";
import {allowedExtensions, allowedFileTypesNonText, unsupportedTextSubtypes} from "./FileImport.jsx";
import {shorten} from "./util/shorten.js";

/**
 * Concatenates arguments, prepending file names if there's no other material for the note title.
 * doDeserializeHtml must have been set on the global object to either deserializeHtml or clientDeserializeHtml.
 * @param {string} title
 * @param {string} text
 * @param {string} url
 * @param {[File]} files
 * @param clientId
 * @returns {Promise<NodeNote>}
 */
export async function assembleNote(title, text, url, files, clientId) {
  let slateNodes = [], suffix = [], hasRealContent = false;

  let noteSubtype = url ? 'html' : undefined;
  let lastModified = Number.NEGATIVE_INFINITY;
  for (const file of files) {
    const fileSubtype = extractSubtype(file.type);
    const extension = extractExtension(file);
    if (hasTagsLikeHtml(file.type, extension)) {
      noteSubtype = 'html';
    } else if (file.type?.startsWith('image')) {
      noteSubtype = 'html';
    } else if (file.type && !unsupportedTextSubtypes.includes(fileSubtype)) {
      if ('markdown' === fileSubtype && 'html' !== noteSubtype) {
        noteSubtype = 'markdown';
      } else if (!noteSubtype) {
        noteSubtype = fileSubtype;
      }
    } else if (allowedExtensions.includes(extension)) {
      if (!noteSubtype) {
        noteSubtype = extension.slice(1);
      }
    } else {
      continue;   // ignores lastModified date of unsupported file
    }
    if (file.lastModified > lastModified) {
      lastModified = file.lastModified;
    }
  }
  noteSubtype = noteSubtype || 'html';   // text field by itself is treated as rich text
  const date = lastModified > Number.NEGATIVE_INFINITY ? new Date(lastModified) : new Date();

  if (/\S/.test(title)) {
    switch (noteSubtype) {
      case 'html':
        slateNodes.push({type: 'heading-one', children: [{text: title}]});
        break;
      case 'markdown':
        slateNodes.push({type: 'paragraph', children: [{text: "# " + title}]});
        break;
      default:
        slateNodes.push({type: 'paragraph', children: [{text: title}]});
    }
  }

  if (/\S/.test(text)) {
    slateNodes.push(...linkHeuristics(text, noteSubtype));
    hasRealContent = true;
    console.info(`Imported text “${shorten(text)}”`);
  }

  if (/\S/.test(url)) {
    const normalizedUrl = normalizeUrl(url);
    slateNodes.push({type: 'paragraph', children: [{text: ""},
        {type: 'link', url: normalizedUrl, children: [{text: url}]},
        {text: ""}]});
    hasRealContent = true;
    console.info(`Imported URL “${shorten(url)}”`);
  }

  let needsTitleMaterial = (0 === slateNodes.length);

  let lastFileWasText = true;
  let lastFileHadProblem = false;
  for (const file of files) {
    try {
      if (!/^image/.test(file.type) && slateNodes.length > 0 && lastFileWasText) {
        slateNodes.push(...divider(noteSubtype, undefined, undefined));
      }

      const fileSubtype = extractSubtype(file.type);
      if (unsupportedTextSubtypes.includes(fileSubtype) ||
          file.type?.startsWith('application') && ! allowedFileTypesNonText.includes(file.type)) {
        slateNodes.push({type: 'quote',
          children: [{text: `Import of “${file.name}” (${file.type}) not supported`, bold: true}]});
        // doesn't push name into suffix
        lastFileWasText = true;
        lastFileHadProblem = true;
          console.warn(`Import of “${file.name}” (${file.type}) not supported`);
        transientMsg(`Import of “${file.name}” (${file.type}) not supported`, 'warning');
        continue;
      } else if (0 === file.size) {
        suffix.push(file.name);
        hasRealContent = true;
        // doesn't set lastFileWasText nor lastFileHadProblem
        console.warn(`“${file.name}” is empty.`);
        transientMsg(`“${file.name}” is empty.`, 'warning');
        continue;
      } else if (file.type?.startsWith('image')) {
        const {dataUrl, alt} = await imageFileToDataUrl(file);
        if (lastFileHadProblem) {
          slateNodes.push(...divider(noteSubtype, undefined, undefined));
        }
        slateNodes.push({type: 'paragraph', children: [{text: ""}]});
        slateNodes.push({type: 'image', url: dataUrl, children: [{text: alt}]});
        slateNodes.push({type: 'paragraph', children: [{text: ""}]});
        // file name is in alt text, so it's not added to suffix
        hasRealContent = true;
        lastFileWasText = false;
        lastFileHadProblem = false;
        console.info(`Imported “${file.name}” (${file.type}) as graphic`);
        continue;
      }

      await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', async (evt) => {
          try {
            const extension = extractExtension(file);
            if (hasTagsLikeHtml(file.type, extension)) {
              // eslint-disable-next-line no-undef
              const htmlNodes = await doDeserializeHtml(evt.target.result, clientId);
              if (htmlNodes.some(node => ['heading-one', 'heading-two', 'heading-three'].includes(node.type))) {
                needsTitleMaterial = false;
              }
              slateNodes.push(...htmlNodes);
              suffix.push(file.name);
              hasRealContent = true;
              lastFileWasText = true;
              lastFileHadProblem = false;
              console.info(`Imported “${file.name}” (${file.type}) as HTML`);
            } else {   // supported text type
              const paragraphs = evt.target.result.split(/\r\n|\n|\r/)
                .map(line => {return {type: 'paragraph', children: [{text: line}]}});
              slateNodes.push(...paragraphs);
              suffix.push(file.name);
              hasRealContent = true;
              lastFileWasText = true;
              lastFileHadProblem = false;
              console.info(`Imported “${file.name}” (${file.type}) as text`);
            }
            resolve();
          } catch (err) {
            reject(err);
          }
        });
        reader.addEventListener('error', _evt => {
          const msg = `error while reading “${file.name}”`;
          if ('thematic-break' !== slateNodes.at(-1)?.type) {
            slateNodes.push(...divider(noteSubtype, undefined, undefined));
          }
          slateNodes.push({type: 'quote', children: [{text: msg, bold: true}]})
          lastFileWasText = true;
          lastFileHadProblem = true;
          reject(new Error(msg))
        });
        reader.addEventListener('abort', evt => {
          const msg = `read of “${file.name}” was aborted`;
          console.warn(msg, evt);
          transientMsg(`“Import of ${file.name}” was interrupted`, 'warning');
          if ('thematic-break' !== slateNodes.at(-1)?.type) {
            slateNodes.push(...divider(noteSubtype, undefined, undefined));
          }
          slateNodes.push({type: 'quote', children: [{text: msg, bold: true}]});
          lastFileWasText = true;
          lastFileHadProblem = true;
          resolve();
        });
        reader.readAsText(file);
      });
    } catch (err) {
      const genericMsg = `error processing “${file.name}” (${file.type})`;
      console.error(genericMsg, err);
      const msg = extractUserMessage(err) + ": " + genericMsg;
      transientMsg(msg);
      if ('thematic-break' !== slateNodes.at(-1)?.type) {
        slateNodes.push(...divider(noteSubtype, undefined, undefined));
      }
      slateNodes.push({type: 'quote', children: [{text: msg, bold: true}]})
      lastFileWasText = true;
      lastFileHadProblem = true;
    }
  }
  if (hasRealContent) {
    if (suffix.length > 0) {
      slateNodes.push(...divider(noteSubtype, undefined, suffix.join(", ")));
      if (needsTitleMaterial) {
        slateNodes.unshift(...divider(noteSubtype, suffix.join(", "), undefined));
      }
    }
    return new NodeNote(undefined, noteSubtype, slateNodes, date, undefined);
  } else {
    throw new Error("No usable content");
  }
}

function divider(noteSubtype, beforeText, afterText) {
  const slateNodes = [];
  if ('html' === noteSubtype) {
    beforeText && slateNodes.push({type: 'paragraph', children: [{text: beforeText, italic: true}]});
    slateNodes.push({type: 'thematic-break', children: [{text: ""}]});
    afterText && slateNodes.push({type: 'paragraph', children: [{text: afterText, italic: true}]});
  } else if ('markdown' === noteSubtype) {
    beforeText && slateNodes.push({type: 'paragraph', children: [{text: `*${beforeText}*`}]});
    slateNodes.push({type: 'paragraph', children: [{text: "------------------------------"}]});
    afterText && slateNodes.push({type: 'paragraph', children: [{text: `*${afterText}*`}]});
  } else {
    beforeText && slateNodes.push({type: 'paragraph', children: [{text: beforeText}]});
    slateNodes.push({type: 'paragraph', children: [{text: ""}]});
    afterText && slateNodes.push({type: 'paragraph', children: [{text: afterText}]});
  }
  return slateNodes;
}

function linkHeuristics(text, noteSubtype) {
  try {
    if ('html' === noteSubtype) {
      if (! /\s/.test(text.trim())) {
        try {                          // Android system Share doesn't have a dedicated url field
          const url = new URL(text);   // This doesn't use the heuristic urlRunningTextRE.
          return [{type: 'paragraph', children: [{text: ""},
              {type: 'link', url: url.href, children: [{text: text.trim()}]},
              {text: ""}]}];
        } catch (_err) {
          // proceeds using the heuristic urlRunningTextRE
        }
      }
      return urlsByLine(text);
    } else {
      return text.split("\n").map(line => {return {type: 'paragraph', children: [{text: line}]}});
    }
  } catch (err) {
    const genericMsg = `error processing text`;
    console.error(genericMsg, err);
    const msg = extractUserMessage(err) + ": " + genericMsg;
    transientMsg(msg);
    return [{type: 'paragraph', children: [{text: ""}]},
      {type: 'quote', children: [{text: msg, bold: true}]},
      {type: 'paragraph', children: [{text: ""}]}];
  }
}

const lineBreakRE = /\r\n|\n|\r/g;

function urlsByLine(text) {
  const nodes = [];
  let lineStart = lineBreakRE.lastIndex = 0;
  let breakMatch;
  while ((breakMatch = lineBreakRE.exec(text))) {
    nodes.push(urls2links(text.slice(lineStart, breakMatch.index)));
    lineStart = lineBreakRE.lastIndex;
  }
  nodes.push(urls2links(text.slice(lineStart, text.length)));
  return nodes;
}

function urls2links(line) {
    const children = [];
    let chunkStart = urlRunningTextRE.lastIndex = 0;
    let match;
    while ((match = urlRunningTextRE.exec(line))) {
      children.push({text: line.slice(chunkStart, match.index)});
      const urlText = line.slice(match.index, urlRunningTextRE.lastIndex);
      const url = normalizeUrl(urlText);
      if (url) {
        children.push({type: 'link', url: url, children: [{text: urlText}]});
      } else {
        children.push({text: urlText});
      }
      chunkStart = urlRunningTextRE.lastIndex;
    }
    children.push({text: line.slice(chunkStart, line.length)});
    return {type: 'paragraph', children};
}
