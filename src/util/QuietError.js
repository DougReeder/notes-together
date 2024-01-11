// QuietError.js — Throwable, but should not be reported to the user
// Copyright © 2024 Doug Reeder

export default class QuietError extends Error {
  /**
   *
   * @param {string} message
   * @param {Error} cause
   */
  constructor(message, cause = undefined) {
    super(message);
    if (cause) {
      this.cause = cause;
    }
    this.name = "QuietError";
  }
}
