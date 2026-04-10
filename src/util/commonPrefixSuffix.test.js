// commonPrefixSuffix.test.js
// Copyright © 2026 Doug Reeder

import { commonPrefixLength, commonSuffixLength } from './commonPrefixSuffix.js';

describe('commonPrefixLength', () => {
  it('should return zero for dissimilar strings', () => {
    expect(commonPrefixLength('abc\ndef', 'uvw\nxyz')).toEqual(0);
  });

  it('should return length of shorter string when it’s a prefix', () => {
    expect(commonPrefixLength('abcd', 'abcdef')).toEqual(4);
    expect(commonPrefixLength('abcdef', 'ab')).toEqual(2);
  });

  it('should find the length of the longest common prefix', () => {
    expect(commonPrefixLength('ijk\nlmn', 'ijklmn')).toEqual(3);
  });
});


describe('commonSuffixLength', () => {
  it('should return zero for dissimilar strings', () => {
    expect(commonSuffixLength('123\n456', 'uvw\nxyz')).toEqual(0);
  });

  it('should return length of shorter string when it’s a suffix', () => {
    expect(commonSuffixLength('23456', '123456')).toEqual(5);
    expect(commonSuffixLength('123456', '6')).toEqual(1);
  });

  it('should find the length of the longest common suffix', () => {
    expect(commonSuffixLength('pqrst\nuv', 'stuv')).toEqual(2);
  });
});
