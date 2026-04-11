// ContentTooLongError.js — Throwable
// Copyright © 2026 Doug Reeder

import {shortenTitle, TITLE_LOG_MAX} from "../Note.js";

export default class ContentTooLongError extends Error {
  /**
   * An edited or imported note would cause unacceptable performance.
   * @param {string} title of note
   * @param {Error} [cause]
   * @param {number} [contentLength]
   */
  constructor(title, cause, contentLength) {
    super(`“${shortenTitle(title, TITLE_LOG_MAX)}” has ${contentLength ?? "too many"} characters`);
    this.userMsg = `“${shortenTitle(title)}” is too long. Split into multiple notes.`;
    if (cause) {
      this.cause = cause;
    }
    this.name = "ContentTooLongError";
  }
}
