// RemoteNotes.js - RemoteStorage module for notes containing semantic HTML
// Copyright © 2021 Doug Reeder under the MIT License

import {validate as uuidValidate} from 'uuid';
import {sanitizeNote} from "./sanitizeNote";
import {extractUserMessage} from "./util/extractUserMessage";

const DATE_DEFAULT_REMOTE = new Date(2020, 11, 31, 12, 0);
const SAVED_SEARCH_PATH = 'notes/savedSearches/';

const subscriptions = new Set();

const RemoteNotes = {
  name: 'documents',
  builder: function (privateClient, publicClient) {
    privateClient.declareType('note', {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid"
        },
        "content": {   // may contain semantic HTML tags
          "type": "string",
          "default": "",
          "maxLength": 600000   // allows for one small raster image in a data URL
        },
        "title": {
          "type": "string",
          "default": "☹",
          "maxLength": 400
        },
        "date": {   // RFC 3339, section 5.6 (a subset of ISO 8601)
          "type": "string",
          "format": "date-time"
        },
        mimeType: {   // example: text/markdown;hint=COMMONMARK
          type: "string",
          pattern: "^[a-z]{1,50}/[-+.a-zA-Z0-9]{1,100}(;[a-z]{1,35}=[-+.a-zA-Z0-9]{1,100})*$",
          default: "text/plain"
        },
      },
      "required": ["id", "content", "title", "date" ]
    });

    privateClient.declareType('savedSearch', {
      "type": "object",
      "properties": {
        "original": {type: "string", maxLength: 100},
      },
      "required": ["original" ]
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
          console.error("documents change subscriber:", err);
          window.postMessage({kind: 'TRANSIENT_MSG', message: extractUserMessage(err)}, window?.location?.origin);
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
        const path = 'notes/' + remoteNote.id;
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
        // available as remoteStorage.documents.upsert();
        upsert: async function (memoryNote, textFilter) {
          // console.debug("documents.upsert", memoryNote);
          const cleanNote = sanitizeNote(memoryNote, textFilter);

          let remoteNote;
          if (cleanNote.mimeType) {
            remoteNote = {id: cleanNote.id, content: cleanNote.content, title: cleanNote.title, date: cleanNote.date.toISOString(), mimeType: cleanNote.mimeType, lastEdited: Date.now()};

          } else {
            remoteNote = {id: cleanNote.id, content: cleanNote.content, title: cleanNote.title, date: cleanNote.date.toISOString(), lastEdited: Date.now()};

          }
          await enqueueStoreObject(remoteNote);
          return cleanNote;
        },

        // list: async function () {
        //   console.log("remotestorage documents list");
        //   return privateClient.getListing('/');
        // },
        //
        // getAll: async function () {
        //   console.log("remotestorage documents getAll");
        //   return privateClient.getAll('/');
        // },

        get: async function (id) {
          // console.debug("remoteStorage documents get", id);
          return privateClient.getObject('notes/' + id).then(toMemoryNote);
        },

        delete: async function (id) {
          return privateClient.remove('notes/' + id);
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

        // available as remoteStorage.documents.upsertTag();
        upsertTag: async function (searchWords, searchStr) {
          if (!(searchWords instanceof Set)) {
            throw new Error("searchWords must be Set");
          }
          const normalized = Array.from(searchWords).sort().join(' ');
          if (normalized.length < 2) {
            throw Object.assign(new Error("Tag must be 2 or more characters"), {severity: 'info'});
          }
          if (normalized.length > 100) {
            throw Object.assign(new Error("Tag must be 100 or less characters"), {severity: 'warning'});
          }

          if ('string' !== typeof searchStr) {
            throw new Error("searchStr must be string");
          }
          searchStr = searchStr.trim();

          const path = SAVED_SEARCH_PATH + normalized;
          await privateClient.storeObject("savedSearch", path, {original: searchStr});
          return normalized;
        },

        deleteTag: async function (searchWords) {
          if (!(searchWords instanceof Set)) {
            throw new Error("searchWords must be Set");
          }
          const normalized = Array.from(searchWords).sort().join(' ');
          if (0 === normalized.length) {
            throw Object.assign(new Error("First, select the tag"), {severity: 'info'});
          }
          const path = SAVED_SEARCH_PATH + normalized;
          await privateClient.remove(path);
          return normalized;
        },

        getAllTags: async function () {
          const originalTags = [];
          const normalizedTags = new Set();
          try {
            const tags = await privateClient.getAll(SAVED_SEARCH_PATH);
            for (const normalized in tags) {
              normalizedTags.add(normalized);
              try {
                const original = tags[normalized].original.trim();
                originalTags.push(original || normalized);
              } catch (err) {
                console.error(`while extracting tag “${normalized}”:`, err);
                originalTags.push(normalized);
              }
            }
          } catch (err) {
            console.error("while retrieving tags:", err);
            window.postMessage({kind: 'TRANSIENT_MSG', message: "Can't retrieve tags", severity: 'error'}, window?.location?.origin);
          }
          originalTags.sort( (a, b) => a.localeCompare(b));
          return {originalTags, normalizedTags};
        },
      }
    }
  }
};

function toMemoryNote(remoteNote) {
  // console.log("remoteNote:", remoteNote);
  if (!(remoteNote instanceof Object)) return remoteNote;

  if (! uuidValidate(remoteNote.id)) {
    throw new Error("remote note has bad id=" + remoteNote.id);
  }

  if ('string' !== typeof remoteNote.content) {
    throw new Error("remote note lacks content property");
  }

  let date;
  if ('string' === typeof remoteNote.date || 'number' === typeof remoteNote.date) {
    // ms since epoch, string RFC 2822, or string ISO 8601
    date = new Date(remoteNote.date);
  } else if ('number' === typeof remoteNote.lastEdited || 'string' === typeof remoteNote.lastEdited) {
    date = new Date(remoteNote.lastEdited);
  } else {
    date = new Date(DATE_DEFAULT_REMOTE);
  }
  return {
    id: remoteNote.id,
    content: remoteNote.content,
    title: 'string' === typeof remoteNote.title ? remoteNote.title : "⁂",
    date: date,
    mimeType: remoteNote.mimeType,
  };
}

export default RemoteNotes;
