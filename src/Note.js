// Note.js - in-memory Note model for Notes Together
// Copyright © 2021 Doug Reeder

function createMemoryNote(id, text) {
  if (!Number.isFinite(id)) {
    id = Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER);
  }

  return {
    id,
    text: text || ""
  }
}

export {createMemoryNote};
