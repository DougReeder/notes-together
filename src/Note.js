// Note.js - in-memory Note model for Notes Together
// Copyright © 2021 Doug Reeder

const TITLE_MAX = 400;

function createMemoryNote(id, text, date) {
  if (!Number.isFinite(id)) {
    id = Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER);
  }

  return {
    id,
    text: text || "",
    date: date || new Date(),
  }
}


export {TITLE_MAX, createMemoryNote};
