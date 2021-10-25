// decodeEntities.test.js - automated tests for utility
// Copyright © 2021 Doug Reeder

import decodeEntities from './decodeEntities';

describe("decodeEntities", () => {
  it("should decode less-than and greater-than", () => {
    expect(decodeEntities(" &lt;tag&gt; a&gt;b c&lt;d")).toEqual(" <tag> a>b c<d");
  });

  it("should decode apostrophes and double quotes", () => {
    expect(decodeEntities(" Jill&#39;s boss said &quot;Hey, F&#39;lar&apos;s kid!&quot; ")).
    toEqual(" Jill's boss said \"Hey, F'lar's kid!\" ");
  });

  it("should decode ampersands", () => {
    expect(decodeEntities(" Alice &amp; Bob &amp; Carol ")).toEqual(" Alice & Bob & Carol ");
  });

  it("should decode non-breaking spaces", () => {
    expect(decodeEntities(" John&nbsp;Jacob&nbsp;Doe ")).toEqual(" John Jacob Doe ");
  });

  it("should decode decimal entities", () => {
    expect(decodeEntities(" &#0931; of all fears ")).toEqual(" Σ of all fears ");
  });

  it("should decode hexadecimal entities", () => {
    expect(decodeEntities(" &#xC6;lfred ")).toEqual(" Ælfred ");
  });


  it("shouldn't double decode", () => {
    expect(decodeEntities(" &amp;#223; ")).toEqual(" &#223; ");
  });

  it("shouldn't mangle unsupported named entities", () => {
    expect(decodeEntities(" &aleph;&beth; ")).toEqual(" &aleph;&beth; ");
  });
});
