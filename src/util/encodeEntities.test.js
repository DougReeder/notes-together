// encodeEntities.test.js - automated tests for utility
// Copyright © 2021 Doug Reeder

import encodeEntities from './encodeEntities';

describe("encodeEntities", () => {
  it("should encode less-than and greater-than", () => {
    expect(encodeEntities("Non-semantic tag: <b>bold</b> x > y")).toEqual("Non-semantic tag: &lt;b&gt;bold&lt;/b&gt; x &gt; y");
  });

  it("should encode double and single quotes", () => {
    expect(encodeEntities(`It's called "Bob's Bar"`)).toEqual("It&apos;s called &quot;Bob&apos;s Bar&quot;");
  });

  it("should encode ampersands", () => {
    expect(encodeEntities(`Alice & Bob & Carol`)).toEqual("Alice &amp; Bob &amp; Carol");
  });
});
