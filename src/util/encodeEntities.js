// encodeEntities.js - utility to encode important HTML entities
// Copyright © 2021 Doug Reeder

const table = {
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "&": "&amp;",
  "'": "&apos;",
}

function encodeEntities(str) {
  return str?.replace(/[<>"&']/g, match => table[match]);
}

export default encodeEntities;
