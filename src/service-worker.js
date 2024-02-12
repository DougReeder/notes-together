import {precacheAndRoute} from 'workbox-precaching';
import {registerRoute} from 'workbox-routing';
import {init, upsertNote} from "./storage.js";
import {assembleNote} from "./assembleNote.js";
import {extractUserMessage, transientMsg} from "./util/extractUserMessage.js";
import {shorten} from "./util/shorten.js";
import {unsupportedTextSubtypes} from "./FileImport.jsx";
import {clientDeserializeHtml} from "./service-worker-utils.js";
import {shortenTitle} from "./Note.js";


precacheAndRoute(self.__WB_MANIFEST);   // replaced during build w/ serialized precache manifest entries

registerRoute(new RegExp('/create-from-share'), acceptShare, 'POST');

const initPrms = init().then(instances => {
  console.debug(`IndexedDB & remoteStorage initialized:`, instances);
  if (instances?.isFirstLaunch) {
    console.warn(`Created IndexedDB in Service Worker; did the user erase all data?`);
  }
}).catch(err => {
  console.error("while initializing IndexedIB and remoteStorage:", err);
})

self.doDeserializeHtml = clientDeserializeHtml;

async function acceptShare({request, event}) {
  let title, text, url, files
  try {
    console.debug(`acceptShare   bodyUsed: ${request.bodyUsed}   stream locked: ${request.body?.locked}`);
    const formData = await request.formData();
    console.debug("formData:", Array.from(formData));
    title = formData.get('title') || "";
    text = formData.get('text') || "";
    url = formData.get('url') || "";
    files = formData.getAll('files');

    let hasContent = /\S/.test(text) || /\S/.test(url);
    for (const file of files) {
      const fileSubtype = /\/(?:x-|vnd\.|x\.)?([^;]+)/.exec(file.type)?.[1];
      if (!unsupportedTextSubtypes.includes(fileSubtype)) {
        hasContent = true;
      }
    }

    if (!hasContent) {
      throw new Error("No usable content in Share");
    } else if (!initPrms) {
      const err = new Error("initPrms is falsy when acceptShare called");
      throw Object.assign(err, {userMsg: "Tell the developer about this message"});
    } else {
      initPrms.then(save).catch(postError);
    }

    return respond(`<h1>Sharing In Progress</h1><p>creating “${title}”</p>`, {title, text, url, files});
  } catch (err) {
    const msg = postError(err);
    return respond(`<h1>Sharing Failed</h1><p>${msg}</p><p>Go to <a href="${import.meta.env.BASE_URL}">list of notes</a></p>`, {title, text, url, files});
  }


  async function save() {
    const nodeNote = await assembleNote(title, text, url, files, event.clientId);
    const storedNote = await upsertNote(nodeNote, undefined);
    const label = shorten(title) || shorten(text) || shortenTitle(storedNote?.title) ||
      shorten(files[0]?.name) || shorten(url) || `${files.length} file(s)`;

    console.info(`accepting share “${label}”`);
    transientMsg(`accepting share “${label}”`, 'info');
  }
}

function postError(err) {
  console.error(`while preparing to share ”${err.name}” (${err.message}):`, err);
  let msg;
  if ("Failed to fetch" === err.message) {
    msg = "Bad Share. Try breaking up the Share, Copy & Paste, or Importing files.";
  } else {
    msg = "Sharing failed: " + extractUserMessage(err);
  }
  transientMsg(msg, 'error');

  return msg;
}

// upsertNoteDb and deleteNoteDb call a global postMessage function
self.postMessage = async function (msgObj, _targetOrigin) {
  setTimeout(async () => {
    for (const client of await self.clients.matchAll({includeUncontrolled: true})) {
      // console.log(`posting to client ${client?.id} ${client?.url} ${client?.type} ${client?.frameType}:`, msgObj)
      client?.postMessage(msgObj);
    }
  }, 1000);
}

async function respond(content, {title, text, url, files}, status = 303, statusText = "See Other") {
  const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#d1e8f1" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <title>Notes Together</title>
  </head>
  <body>
${content}
  </body>
</html>
`;

  let searchWords = encodeURIComponent(title?.trim() || text?.trim() || url?.trim() || files.map(file => file?.name?.trim()).join(", "));
  return new Response(body, {
    status, statusText, headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': body.length.toString(),
      'Location': self.location.origin + import.meta.env.BASE_URL + '?words=' + searchWords,
    }
  });
}
