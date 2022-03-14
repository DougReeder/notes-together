// setUtil.js - Utilities for Sets
// Copyright © 2022 Doug Reeder


function setEquals(set1, set2) {
  if (! (set1 instanceof Set)) {
    throw new Error(`“${set1}” is not a Set`);
  }
  if (! (set2 instanceof Set)) {
    throw new Error(`“${set2}” is not a Set`);
  }

  if (set1.size !== set2.size) {
    return false;
  }

  for (const value1 of set1.values()) {
    if (!set2.has(value1)) {
      return false;
    }
  }
  return true;
}


export {setEquals};
