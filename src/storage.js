// storage.js - abstraction for for RemoteStorage and IndexedDB for Notes Together
// Copyright © 2021 Doug Reeder

import {initDb, upsertNoteDb, getNoteDb, deleteNoteDb, findStubs, parseWords} from "./idbNotes";
import RemoteStorage from 'remotestoragejs';
import RemoteNotes from "./RemoteNotes";

let initPrms;

function init(dbName) {
  if (!initPrms) {
    initPrms = initDb(dbName).then(initRemote);
  }
  return initPrms;
}

let remotePrms;

function initRemote() {
  remotePrms = new Promise((resolve) => {
    const remoteStorage = new RemoteStorage({modules: [RemoteNotes], cache: true});
    remoteStorage.access.claim('notes', 'rw');

    remoteStorage.caching.enable('/notes/');

    remoteStorage.on('ready', function () {
      console.log("remoteStorage ready");
      resolve(remoteStorage);

      remoteStorage.notes.subscribe(async evt => {
        try {
          switch (evt.origin) {   // eslint-disable-line default-case
            case 'remote':
              if (evt.newValue) {   // create or update
                console.log("remoteStorage incoming upsert:", evt.newValue);
                upsertNoteDb(evt.newValue);
              } else {   // delete
                console.log("remoteStorage incoming delete:", evt.oldValue);
                deleteNoteDb(evt.oldValue.id);
              }
              break;
            case 'conflict':
              if (!evt.oldValue && !evt.newValue) {
                console.log("remoteStorage deleted on both", evt.relativePath);
              } else {
                console.warn("remoteStorage conflict:", evt.lastCommonValue, evt.oldValue, evt.newValue);
              }
              break;
            // case 'local':
            //   console.log("remoteStorage local record:", evt.newValue);
            //   break;
          }
        } catch (err) {
          console.error("remoteStorage notes subscribe:", err);
          // TODO: notify user
        }
      });
    });

    remoteStorage.on('connected', async () => {
      const userAddress = remoteStorage.remote.userAddress;
      console.log(`remoteStorage connected to “${userAddress}”`);
    });

    remoteStorage.on('not-connected', function () {
      console.log("remoteStorage not-connected (anonymous mode)", remoteStorage.remote.token);
    });

    remoteStorage.on('disconnected', function () {
      console.log("remoteStorage disconnected", arguments);
    });

    remoteStorage.on('error', function (err) {
      console.error("remoteStorage error", err);
    });

    remoteStorage.on('network-offline', () => {
      console.debug(`remoteStorage offline now.`);
    });

    remoteStorage.on('network-online', () => {
      console.debug(`remoteStorage back online.`);
    });
  });

  return remotePrms;
}


function upsertNote(memoryNote) {
  return remotePrms.then(remoteStorage => {
    return remoteStorage.notes.upsert(memoryNote)
  }).then(upsertNoteDb);
}


function deleteNote(id) {
  return remotePrms.then(remoteStorage => {
    return Promise.all([remoteStorage.notes.delete(id), deleteNoteDb(id)]);
  });
}

export {init, upsertNote, getNoteDb as getNote, deleteNote, findStubs, parseWords};
