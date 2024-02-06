import {precacheAndRoute} from 'workbox-precaching';
import {registerRoute} from 'workbox-routing';
import {init, upsertNote} from "./storage.js";
import {assembleNote} from "./assembleNote.js";
import {extractUserMessage} from "./util/extractUserMessage.js";


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

async function acceptShare({request, event}) {
  try {
    const formData = await request.formData();
    console.debug("formData:", Array.from(formData));
    const title = formData.get('title') || "";
    const text = formData.get('text') || "";
    const url = formData.get('url') || "";
    const files = formData.getAll('files');

    const nodeNote = await assembleNote(title, text, url, files, event.clientId);
    if (!initPrms) {
      const err = new Error("initPrms is falsy when acceptShare called");
      throw Object.assign(err, {userMsg: "Tell the developer about this message"});
    }
    await initPrms;
    const storedNote = await upsertNote(nodeNote, undefined);
    const label = shorten(title) || shorten(text) || shorten(storedNote?.title) ||
      shorten(files[0]?.name) || shorten(url) || `${files.length} file(s)`;

    console.info(`accepting share “${label}”`);
    postTransientMessage(`accepting share “${label}”`, 'info');

    return respond(`<h1>Sharing Succeeded</h1><p>created “${title}”</p>`);
  } catch (err) {
    console.error(`while creating from share ”${err.name}” (${err.message}):`, err);
    let msg;
    if ("Failed to fetch" === err.message) {
      msg = "Bad Share. Try breaking it up or Sharing it differently.";
    } else {
      msg = "Sharing failed: " + extractUserMessage(err);
    }
    postTransientMessage(msg, 'error');

    return respond(`<h1>Sharing Failed</h1><p>${msg}</p><p>Go to <a href="/">list of notes</a></p>`);
  }
}

function shorten(str) {
  if ('string' !== typeof str) {
    return "";
  }
  str = str.trim();
  if (str.length <= 50) {
    return str;
  } else {
    return str.slice(0, 49) + "…";
  }
}

function postTransientMessage(message, severity = 'info') {
  new Promise(resolve => setTimeout(resolve, 1000)).then(async () => {
    const msgObj = {
      kind: 'TRANSIENT_MSG',
      message,
      severity,
    };
    const clients = await self.clients.matchAll({includeUncontrolled: true});
    for (const client of clients) {
      // console.log(`posting TRANSIENT_MSG to client ${client?.id} ${client?.url} ${client?.type} ${client?.frameType}`)
      client?.postMessage(msgObj);
    }
  });
}

async function respond(content, status = 303, statusText = "See Other") {
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

  return new Response(body, {
    status, statusText, headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': body.length.toString(),
      'Location': self.location.origin + import.meta.env.BASE_URL,
    }
  });
}
