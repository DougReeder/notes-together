// Note.js - in-memory Note model for Notes Together
// Copyright © 2021 Doug Reeder

const TITLE_MAX = 400;

function createMemoryNote(id, content, date) {
  if (!Number.isFinite(id)) {
    id = Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER);
  }

  return {
    id,
    content: content || "",
    date: date || new Date(),
  }
}


export {TITLE_MAX, createMemoryNote};
