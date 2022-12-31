// Note.js - in-memory Note model for Notes Together
// Copyright © 2021 Doug Reeder


import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

const TITLE_MAX = 400;

function createMemoryNote(id, content, date, mimeType, isLocked) {
  if (!uuidValidate(id)) {
    id = uuidv4();
  }

  return {
    id,
    content: content || "",
    date: date || new Date(),
    mimeType: mimeType,
    isLocked: Boolean(isLocked),
  }
}


export {TITLE_MAX, createMemoryNote};
