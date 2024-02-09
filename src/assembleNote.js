// assembleNote.js — constructs a single note from multiple parts
// Copyright © 2024 Doug Reeder under the MIT License

import hasTagsLikeHtml from "./util/hasTagsLikeHtml.js";
import {NodeNote} from "./Note.js";
import {deserializeHtml} from "./slateHtml.jsx";
import {imageFileToDataUrl} from "./util/imageFileToDataUrl.js";
import {extractUserMessage} from "./util/extractUserMessage.js";
import {urlRunningTextRE, normalizeUrl} from "./util.js";
import {unsupportedTextSubtypes} from "./FileImport.jsx";
import {postTransientMessage, shorten} from "./service-worker-utils";

export async function assembleNote(title, text, url, files, clientId) {
  let slateNodes = [], suffix = [], hasRealContent = false;

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
        slateNodes.push(...divider(subtype, undefined, undefined));
      }

      const fileSubtype = /\/(?:x-|vnd\.|x\.)?([^;]+)/.exec(file.type)?.[1];
      if (unsupportedTextSubtypes.includes(fileSubtype)) {
        slateNodes.push({type: 'quote',
          children: [{text: `Import of “${file.name}” (${file.type}) not supported`, bold: true}]});
        // doesn't push name into suffix
        lastFileWasText = true;
        lastFileHadProblem = true;
          console.warn(`Import of “${file.name}” (${file.type}) not supported`);
        postTransientMessage(`Import of “${file.name}” (${file.type}) not supported`, 'warning');
        continue;
      } else if (0 === file.size) {
        suffix.push(file.name);
        hasRealContent = true;
        // doesn't set lastFileWasText nor lastFileHadProblem
        console.warn(`“${file.name}” is empty.`);
        postTransientMessage(`“${file.name}” is empty.`, 'warning');
        continue;
      } else if (file.type?.startsWith('image')) {
        const {dataUrl, alt} = await imageFileToDataUrl(file);
        if (lastFileHadProblem) {
          slateNodes.push(...divider(subtype, undefined, undefined));
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
            if (hasTagsLikeHtml(file.type)) {
              // eslint-disable-next-line no-undef
              const htmlNodes = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope ?
                await clientDeserializeHtml(evt.target.result, clientId) :
                deserializeHtml(evt.target.result);
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
          slateNodes.push({type: 'quote', children: [{text: msg, bold: true}]})
          lastFileWasText = true;
          lastFileHadProblem = true;
          reject(new Error(msg))
        });
        reader.addEventListener('abort', evt => {
          const msg = `read of “${file.name}” was aborted`;
          console.warn(msg, evt);
          postTransientMessage(`“Import of ${file.name}” was interrupted`, 'warning');
          slateNodes.push({type: 'quote', children: [{text: msg, bold: true}]});
          lastFileWasText = true;
          lastFileHadProblem = true;
          resolve();
        });
        reader.readAsText(file);
      });
    } catch (err) {
      const intro = `error processing “${file.name}” (${file.type})`;
      console.error(intro, err);
      const msg = intro + ": " + extractUserMessage(err);
      postTransientMessage(msg);
      slateNodes.push({type: 'quote', children: [{text: msg, bold: true}]})
      lastFileWasText = true;
      lastFileHadProblem = true;
    }
  }
  if (hasRealContent) {
    if (suffix.length > 0) {
      slateNodes.push(...divider(subtype, undefined, suffix.join(", ")));
      if (needsTitleMaterial) {
        slateNodes.unshift(...divider(subtype, suffix.join(", "), undefined));
      }
    }
    return new NodeNote(undefined, subtype, slateNodes, date, undefined);
  } else {
    throw new Error("No usable content in Share");
  }
}

function divider(subtype, beforeText, afterText) {
  const slateNodes = [];
  if ('html' === subtype) {
    beforeText && slateNodes.push({type: 'paragraph', children: [{text: beforeText, italic: true}]});
    slateNodes.push({type: 'thematic-break', children: [{text: ""}]});
    afterText && slateNodes.push({type: 'paragraph', children: [{text: afterText, italic: true}]});
  } else if ('markdown' === subtype) {
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


const CLIENT_TIMEOUT = 9_000;

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
    const client = await getClient(clientId);

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

const RETRY_INTERVAL = 100;
const RETRY_TIMEOUT = 9_000;

async function getClient(clientId) {
  let client = await self.clients.get(clientId);
  if (client) { return client; }

  let clients, start = Date.now();
  do {
    clients = await self.clients.matchAll({includeUncontrolled: true});
    if (clients.length > 0) {
      console.debug(`found client after ${Date.now() - start} ms`);
      return clients[0];
    }
    if (Date.now() - start > RETRY_TIMEOUT) { break; }
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
  } while (true);   // eslint-disable-line no-constant-condition

  console.debug(`opening window because no clients exist`);
  client = await self.clients.openWindow(self.location.origin + import.meta.env.BASE_URL);
  if (client) { return client; }

  if (!client) {
    throw new Error(`no client available for [${clientId}] & can't open window`);
  }
}
