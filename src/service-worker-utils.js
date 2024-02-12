// service-worker-utils.js — functions for service worker in Notes Together
// Copyright © 2024 Doug Reeder under the MIT License


const CLIENT_TIMEOUT = 9_000;

// These are global to the Service Worker. Ugh.
let clientMessageResolve = console.warn;
let clientMessageReject  = console.warn;
// eslint-disable-next-line no-undef
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
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
}

export async function clientDeserializeHtml(html, clientId) {
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

