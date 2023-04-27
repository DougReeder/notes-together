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

  xit("should map SVG as having tags", () => {
    expect(hasTagsLikeHtml("image/svg+xml")).toBeTruthy();
  });

  xit("should map XML as having tags", () => {
    expect(hasTagsLikeHtml("text/xml;charset=ISO-8859-1")).toBeTruthy();
  });

  it("should map *.xo (XOXO outline) as having tags", () => {
    expect(hasTagsLikeHtml("", ".xo")).toBeTruthy();
  });

  it("should map *.jsp as not having tags", () => {
    expect(hasTagsLikeHtml("", ".jsp")).toBeFalsy();
  });

  it("should map *.asp as not having tags", () => {
    expect(hasTagsLikeHtml("", ".asp")).toBeFalsy();
  });

  it("should map *.njk (Nunjucks template) as not having tags", () => {
    expect(hasTagsLikeHtml("", ".njk")).toBeFalsy();
  });

  it("should map *.webc (WebC template) as not having tags", () => {
    expect(hasTagsLikeHtml("", ".webc")).toBeFalsy();
  });
});
