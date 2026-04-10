// commonPrefixSuffix.js — calculates length of common prefix/suffix of two strings
// Copyright © 2026 Doug Reeder

/**
 * Utility to find the length of longest common prefix of two strings
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @return {number} - length of longest common prefix
 */
export function commonPrefixLength(s1, s2) {
  const minLength = Math.min(s1.length, s2.length);

  let i=0;
  for (; i < minLength; ++i) {
    if (s1[i] !== s2[i]) {
      return i;
    }
  }
  return i;
}


/**
 * Utility to find the length of longest common suffix of two strings
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @return {number} - length of longest common suffix
 */
export function commonSuffixLength(s1, s2) {
  const minLength = Math.min(s1.length, s2.length);

  let i=0;
  for (; i < minLength; ++i) {
    if (s1.at(-1-i) !== s2.at(-1-i)) {
      return i;
    }
  }
  return i;
}
