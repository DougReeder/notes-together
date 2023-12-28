// normalizeDate.js - convert string or number to Date
// Copyright © 2021-2024 Doug Reeder
function normalizeDate(value) {
  let date;
  if (value instanceof Date || 'string' === typeof value || 'number' === typeof value) {
    date = new Date(value);
    if (Number.isNaN(date.valueOf())) {
      date = new Date();
    }
  } else {
    date = new Date();
  }
  return date;
}

export default normalizeDate;
