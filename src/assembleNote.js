// assembleNote.js — constructs a single note from multiple parts
// Copyright © 2024 Doug Reeder under the MIT License

import hasTagsLikeHtml from "./util/hasTagsLikeHtml.js";
import {NodeNote, shortenTitle} from "./Note.js";
import {deserializeHtml} from "./slateHtml.jsx";
import {imageFileToDataUrl} from "./util/imageFileToDataUrl.js";
import {extractUserMessage} from "./util/extractUserMessage.js";
import {urlRunningTextRE, normalizeUrl} from "./util.js";
import {unsupportedTextSubtypes} from "./FileImport.jsx";

export async function assembleNote(title, text, url, files, clientId) {
  let slateNodes = [], hasRealContent = false;

  let subtype = url ? 'html' : undefined;
  let lastModified = Number.NEGATIVE_INFINITY;
  for (const file of files) {
    if (hasTagsLikeHtml(file.type)) {
      subtype = 'html';
    } else if (file.type?.startsWith('image')) {
      subtype = 'html';
    } else if (file.type?.startsWith('text') && !file.type?.startsWith('text/rtf')) {
      if (!subtype) {
        subtype = /\/(.+)/.exec(file.type)?.[1];
      }
    } else {
      continue;   // ignores lastModified date of unsupported file
    }
    if (file.lastModified > lastModified) {
      lastModified = file.lastModified;
    }
  }
  subtype = subtype || 'html';   // text field by itself is treated as rich text
  const date = lastModified > Number.NEGATIVE_INFINITY ? new Date(lastModified) : new Date();

  if (/\S/.test(title)) {
    switch (subtype) {
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
    slateNodes.push(...textHeuristics(text, subtype));
    hasRealContent = true;
    console.info(`Imported text “${shortenTitle(text)}”`);
  }

  if (/\S/.test(url)) {
    const normalizedUrl = normalizeUrl(url);
    slateNodes.push({type: 'paragraph', children: [{text: ""},
        {type: 'link', url: normalizedUrl, children: [{text: url}]},
        {text: ""}]});
    hasRealContent = true;
    console.info(`Imported URL “${shortenTitle(url)}”`);
  }

  for (const file of files) {
    try {
      await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', async (evt) => {
          try {
            const fileSubtype = /\/(?:x-|vnd\.|x\.)?([^;]+)/.exec(file.type)?.[1];

            if (hasTagsLikeHtml(file.type)) {
              // eslint-disable-next-line no-undef
              if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
                slateNodes.push(...await clientDeserializeHtml(evt.target.result, clientId));
              } else {   // needed for testing
                slateNodes.push(...deserializeHtml(evt.target.result));
              }
              hasRealContent ||= file.size > 0;
              console.info(`Imported “${file.name}” (${file.type}) as HTML`);
            } else if (file.type?.startsWith('image')) {
              const {dataUrl, alt} = await imageFileToDataUrl(file);
              slateNodes.push({type: 'paragraph', children: [{text: ""}]});
              slateNodes.push({type: 'image', url: dataUrl, children: [{text: alt}]});
              slateNodes.push({type: 'paragraph', children: [{text: ""}]});
              hasRealContent ||= file.size > 0;
              console.info(`Imported “${file.name}” (${file.type}) as graphic`);
            } else if (!unsupportedTextSubtypes.includes(fileSubtype)) {
              const paragraphs = evt.target.result.split(/\r\n|\n|\r/)
                .map(line => {return {type: 'paragraph', children: [{text: line}]}});
              slateNodes.push(...paragraphs);
              hasRealContent ||= file.size > 0;
              console.info(`Imported “${file.name}” (${file.type}) as text`);
            } else {   // unsupported text type
              slateNodes.push({type: 'paragraph', children: [{text: ""}]});
              slateNodes.push({type: 'quote', children: [{text: `«${file.name}»`, bold: true}]});
              slateNodes.push({type: 'paragraph', children: [{text: ""}]});
              console.warn(`Import of “${file.name}” (${file.type}) not supported`);
            }
            resolve();
          } catch (err) {
            reject(err);
          }
        });
        reader.addEventListener('error', _evt => {
          const msg = `error while reading “${file.name}”`;
          slateNodes.push({type: 'paragraph', children: [{text: ""}]});
          slateNodes.push({type: 'quote', children: [{text: msg, bold: true}]})
          slateNodes.push({type: 'paragraph', children: [{text: ""}]});
          reject(new Error(msg))
        });
        reader.addEventListener('abort', evt => {
          const msg = `read of “${file.name}” was aborted`;
          console.warn(msg, evt);
          slateNodes.push({type: 'paragraph', children: [{text: ""}]});
          slateNodes.push({type: 'quote', children: [{text: msg, bold: true}]});
          slateNodes.push({type: 'paragraph', children: [{text: ""}]});
          resolve();
        });
        reader.readAsText(file);
      });
    } catch (err) {
      const msg = `error processing “${file.name}” (${file.type})`;
      console.error(msg, err);
      slateNodes.push({type: 'paragraph', children: [{text: ""}]});
      slateNodes.push({type: 'quote', children: [{text: msg + ": " + extractUserMessage(err), bold: true}]})
      slateNodes.push({type: 'paragraph', children: [{text: ""}]});
    }
  }
  if (hasRealContent) {
    return new NodeNote(undefined, subtype, slateNodes, date, undefined);
  } else {
    throw new Error("No usable content");
  }
}

function textHeuristics(text, subtype) {
  try {
    if ('html' === subtype) {
      if (! /\s/.test(text.trim())) {
        try {                          // Android system Share doesn't have a dedicated url field
          const url = new URL(text);   // doesn't use the heuristic urlRunningTextRE
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
    const msg = `error processing text`;
    console.error(msg, err);
    return [{type: 'paragraph', children: [{text: ""}]},
      {type: 'quote', children: [{text: msg + ": " + extractUserMessage(err), bold: true}]},
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


const CLIENT_TIMEOUT = 7_0000;

// These are global to the Service Worker. Ugh.
let clientMessageResolve = console.warn;
let clientMessageReject  = console.warn;
addEventListener('message', evt => {
  console.debug(`Service Worker received: `, evt.data);
  const resolve = clientMessageResolve;
  const reject  = clientMessageReject
  clientMessageResolve = console.warn;
  clientMessageReject  = console.warn;

  if (Array.isArray(evt.data?.slateNodes)) {
    resolve(evt.data.slateNodes);
  } else {
    reject(Object.assign(new Error("no slateNodes returned:" + evt.data), {userMsg: "Contact the developer"}));
  }
});


async function clientDeserializeHtml(html, clientId) {
  let work;
  try {
    let client = await self.clients.get(clientId);
    if (!client) {
      console.warn(`getting all clients because no client for [${clientId}]`);
      const clients = await self.clients.matchAll({includeUncontrolled: true});
      client = clients?.[0];
    }
    if (!client) {
      console.warn(`opening window because no clients exist`);
      client = await self.clients.openWindow(self.location.origin + '/');
    }
    if (!client) {
      throw new Error(`no client available for [${clientId}] & can't open window`);
    }

    work = new Promise((resolve, reject) => {
      clientMessageResolve = resolve;
      clientMessageReject  = reject;
      client.postMessage({kind: 'DESERIALIZE_HTML', html});
    });
  } catch (err) {
    throw Object.assign(err, {userMsg: "Restarting your device might help, but probably not"});
  }

  return Promise.race([
    work,
    new Promise((_resolve, reject) =>
      setTimeout(reject, CLIENT_TIMEOUT, new Error("Your browser took too long to process this")))
  ]);
}
