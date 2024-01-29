// service-worker-utils.js — functions for service worker in Notes Together
// Copyright © 2024 Doug Reeder under the MIT License

export function shorten(str) {
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

export function postTransientMessage(message, severity) {
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
