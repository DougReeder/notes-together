// service-worker-utils.js — functions for service worker in Notes Together
// Copyright © 2024 Doug Reeder under the MIT License

export function shorten(str) {
  if ('string' !== typeof str) {
    return "";
  }
  str = str.trim();
  if (str.length <= 50) {
    return str;
  } else {
    return str.slice(0, 49) + "…";
  }
}
