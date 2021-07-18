// RemoteNotes.js - RemoteStorage module for notes containing semantic HTML
// Copyright © 2021 Doug Reeder under the MIT License

import {sanitizeNote} from "./sanitizeNote";

const subscriptions = new Set();

// Ids for normal notes should be >= -9007199254740991 and <= 9007199254740991.
// Finite ids outside that range are reserved for testing.
const RemoteNotes = {
  name: 'notes',
  builder: function (privateClient, publicClient) {
    privateClient.declareType('note', {
      "type": "object",
      "properties": {
        "id": {
          "type": "integer",
          "maximum": Number.MAX_SAFE_INTEGER
        },
        "text": {   // may contain semantic HTML tags
          "type": "string",
          "default": "",
          "maxLength": 600000   // allows for one small raster image in a data URL
        },
        "date": {   // RFC 3339, section 5.6 (a subset of ISO 8601)
          "type": "string",
          "format": "date-time"
        }
      },
      "required": ["id", "text", "date" ]
    });

    privateClient.on('change', evt => {
      if (evt.oldValue instanceof Object) {
        evt.oldValue.date = new Date(evt.oldValue?.date || Date.now());
      }
      if (evt.newValue instanceof Object) {
        evt.newValue.date = new Date(evt.newValue?.date || Date.now());
      }
      for (const callback of subscriptions) {
        try {
          callback(evt);
        } catch (err) {
          console.error("notes change subscriber:", err);
          window.postMessage({kind: 'TRANSIENT_MSG', message: err.userMsg || err.message}, window?.location?.origin);
        }
      }
    });

    let working = false;
    const queue = [];
    const recent = new Set();
    function enqueueStoreObject(remoteNote) {
      return new Promise((resolve, reject) => {
        // console.log("enqueueing upsert", working, recent.size, queue.length);
        const prevSameInd = queue.findIndex(entry => {
          return entry.remoteNote.id === remoteNote.id;
        });
        if (prevSameInd > -1) {
          queue[prevSameInd]?.resolve();
          queue.splice(prevSameInd, 1, {remoteNote, resolve, reject});
        } else {
          queue.push({remoteNote, resolve, reject});
        }
        dequeueStoreObject();
      });
    }
    async function dequeueStoreObject() {
      if (working) { return; }
      // find the next item in the queue, with an ID not recently used
      const nextCleanInd = queue.findIndex(entry => {
        return ! recent.has(entry?.remoteNote?.id);
      });
      if (-1 === nextCleanInd) {
        return;
      }
      const [item] = queue.splice(nextCleanInd, 1);
      // console.log("next clean item:", nextCleanInd, item?.remoteNote);
      try {
        working = true;
        const {remoteNote, resolve} = item;
        recent.add(remoteNote.id);
        const path = remoteNote.id.toFixed();
        const value = await privateClient.storeObject("note", path, remoteNote);
        resolve(value);
      } catch (err) {
        item.reject(err);
      } finally {
        working = false;
        // console.log("dequeueing upsert", queue.length);
        dequeueStoreObject();
        // remotestorage.js can't keep up; timeout is an ugly hack
        setTimeout(() => {
          // console.log("(delayed) dequeueing upsert", queue.length);
          recent.delete(item?.remoteNote?.id);
          dequeueStoreObject();
        }, 1000);
      }
    }

    return {
      exports: {
        // available as remoteStorage.notes.upsert();
        upsert: async function (memoryNote, textFilter) {
          // console.debug("notes.upsert", memoryNote);
          const cleanNote = sanitizeNote(memoryNote, textFilter);

          const remoteNote = {id: cleanNote.id, text: cleanNote.text, date: cleanNote.date.toISOString()};
          await enqueueStoreObject(remoteNote);
          return cleanNote;
        },

        // list: async function () {
        //   console.log("remotestorage notes list");
        //   return privateClient.getListing('/');
        // },
        //
        // getAll: async function () {
        //   console.log("remotestorage notes getAll");
        //   return privateClient.getAll('/');
        // },

        get: async function (id) {
          // console.debug("remoteStorage notes get", id);
          return privateClient.getObject(id.toFixed()).then(toMemoryNote);
        },

        delete: async function (id) {
          return privateClient.remove(id.toFixed());
        },

        subscribe: function (callback) {
          if ('function' === typeof callback) {
            subscriptions.add(callback);
          } else {
            throw new Error("not a function: " + callback)
          }
        },

        unsubscribe: function (callback) {
          subscriptions.delete(callback);
        },
      }
    }
  }
};

function toMemoryNote(remoteNote) {
  // console.log("remoteNote:", remoteNote);
  if (!(remoteNote instanceof Object)) return remoteNote;

  if (! Number.isFinite(remoteNote.id)) {
    throw new Error("remote note has bad id=" + remoteNote.id);
  }

  if ('string' !== typeof remoteNote.text) {
    throw new Error("remote note lacks text property");
  }

  let date;
  if ('string' === typeof remoteNote.date || 'number' === typeof remoteNote.date) {
    // ms since epoch, string RFC 2822, or string ISO 8601
    date = new Date(remoteNote.date);
  } else {
    date = new Date();
  }
  return {
    id: remoteNote.id,
    text: remoteNote.text,
    date: date,
  };
}

export default RemoteNotes;
