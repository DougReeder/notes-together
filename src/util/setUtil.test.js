// setUtil.test.js - Unit test for Utilities for Sets
// Copyright © 2022 Doug Reeder

import {setEquals} from "./setUtil";


describe("setEquals", () => {
  it("should throw an error for non-Sets", () => {
    expect(() => setEquals(new Set(), "foo")).toThrow();
    expect(() => setEquals(undefined, new Set())).toThrow();
  });

  it("should return false for Sets of different size", () => {
    expect(setEquals(new Set(["foo"]), new Set(["foo", "bar"]))).toBeFalsy();
  });

  it("should return true for empty Sets", () => {
    expect(setEquals(new Set(), new Set())).toBeTruthy();
  });

  it("should return true for Sets of strings", () => {
    expect(setEquals(new Set(["man", "cave"]), new Set(["cave", "man"]))).toBeTruthy();
  });

  it("should return true for Sets of mixed values", () => {
    expect(setEquals(new Set([42, 69, "hike!"]), new Set([69, "hike!", 42]))).toBeTruthy();
  });
});
