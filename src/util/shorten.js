// shorten.js — function for user messages in Notes Together
// Copyright © 2024 Doug Reeder under the MIT License

export function shorten(str, maxLength = 50) {
  if ('string' !== typeof str) {
    return "";
  }
  str = str.trim();
  if (str.length <= maxLength) {
    return str;
  } else {
    return str.slice(0, maxLength-1) + "…";
  }
}
