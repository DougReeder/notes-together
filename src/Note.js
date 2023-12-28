// Note.js - in-memory Note models for Notes Together
// Copyright © 2021-2024 Doug Reeder


import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import normalizeDate from "./util/normalizeDate.js";

const TITLE_MAX = 400;

/**
 * @property {string} id: UUID
 * @property {string} subtype: everything after 'text/' in the MIME type
 * @property {[SlateNode]} nodes - typically editor.children
 * @property {Date} date
 * @property {boolean} isLocked
 */
class NodeNote {
  /**
   * Validates & copies arguments
   * @param {string} id - UUID
   * @param {string} subtype - everything after 'text/' in the MIME type
   * @param {[SlateNode]} nodes - typically editor.children
   * @param {Date} [date]
   * @param {boolean} [isLocked]
   */
  constructor(id, subtype, nodes, date, isLocked) {
    this.id = uuidValidate(id) ? id : uuidv4();
    this.subtype = subtype || "";
    this.nodes = Array.isArray(nodes) ? nodes.slice(0) : [];
    this.date = normalizeDate(date);
    this.isLocked = Boolean(isLocked);
  }
}

/**
 * @property {string} id: UUID
 * @property {string} subtype: everything after 'text/' in the MIME type
 * @property {[SlateNode]} nodes
 * @property {Date} date
 * @property {boolean} isLocked
 */

class SerializedNote {
  /**
   * Does no validation
   * @param {string} id: UUID
   * @param {string} mimeType - of content
   * @param {string} title - always plain text
   * @param {string} content
   * @param {Date|string} date - IDB notes have Date value, remote notes have string value
   * @param {boolean} isLocked
   * @param {[string]} wordArr: normalized keywords extracted from content
   */
  constructor(id, mimeType, title, content, date, isLocked, wordArr) {
    this.id = id;
    this.mimeType = mimeType;
    this.title = title;
    this.content = content;
    this.date = date;
    this.isLocked = isLocked;
    this.wordArr = wordArr;
  }
}


export {TITLE_MAX, NodeNote, SerializedNote};
