// decodeEntities.js - utility to decode important HTML entities
// Copyright © 2021 Doug Reeder

const named = {
  "lt": "<",
  "gt": ">",
  "quot": '"',
  "amp": "&",
  "apos": "'",
  "nbsp": " ",
}

function decodeEntities(str) {
  return str?.replace(
      /&(#(\d{1,7})|#x([a-zA-Z0-9]{1,6})|([a-z]{1,4}));/g,
      (match, p1, p2, p3, p4) => {
        if (p2) {
          return String.fromCodePoint(parseInt(p2));
        } else if (p3) {
          return String.fromCodePoint(parseInt(p3, 16));
        } else if (p4 && named[p4]) {
          return named[p4];
        } else {
          return match;
        }
      }
  );
}

export default decodeEntities;
