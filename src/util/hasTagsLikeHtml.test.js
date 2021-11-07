// Copyright © 2021 Doug Reeder

import hasTagsLikeHtml from "./hasTagsLikeHtml";

describe("hasTagsLikeHtml", () => {
  it("should map semantic HTML as having tags", () => {
    expect(hasTagsLikeHtml("text/html;hint=SEMANTIC")).toBeTruthy();
  });

  it("should map XHTML as having tags", () => {
    expect(hasTagsLikeHtml("application/xhtml+xml")).toBeTruthy();
  });

  it("should map undefined as not having tags", () => {
    expect(hasTagsLikeHtml()).toBeFalsy();
  });

  it("should map null as not having tags", () => {
    expect(hasTagsLikeHtml(null)).toBeFalsy();
  });

  it("should map plain text as not having tags", () => {
    expect(hasTagsLikeHtml('text/plain;charset=ISO-8859-1')).toBeFalsy();
  });

  it("should map SVG as having tags", () => {
    expect(hasTagsLikeHtml("image/svg+xml")).toBeTruthy();
  });

  it("should map XML as having tags", () => {
    expect(hasTagsLikeHtml("text/xml;charset=ISO-8859-1")).toBeTruthy();
  });
});
