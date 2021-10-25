// mergeConflicts.test.js - automated tests for merging two notes for Notes Together
// Copyright © 2021 Doug Reeder

import {tokenize, mergeConflicts} from "./mergeConflicts";

const markup1 = `
<body BGCOLOR="#FFFFFF">
<TABLE BORDER=0 CELLPADDING=3 CELLSPACING=0><TR><TD ID=smez>
<a href="manual.html">Back To Manual Contents</a><br>
<a name="n0"></a><h1>1 Introduction</h1><p>
<a name="n1"></a><h2> What is Nutshell?</h2>
Nutshell allows developers to distribute a single PRC file instead of multiple files.  Beyond the obvious advantage of eliminating customer support surrounding missing files, Nutshell provides many other major advantages over a basic installation procedure:
<UL>
<LI>Cross-platform.
<LI>Control <b>which files</b> get installed.
<LI>Instant over-the-air (OTA) delivery solution.
<LI>Trusted by major software companies for stability and reliability.
</UL>
<hr />
`;

const markupSvg = `<svg width="120" height="240" version="1.1" xmlns="http://www.w3.org/2000/svg">
  <defs>
      <linearGradient id="Gradient1">
        <stop class="stop1" offset="0%"/>
        <stop class="stop2" offset="50%"/>
        <stop class="stop3" offset="100%"/>
      </linearGradient>
      <linearGradient id="Gradient2" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="red"/>
        <stop offset="50%" stop-color="black" stop-opacity="0"/>
        <stop offset="100%" stop-color="blue"/>
      </linearGradient>
      <style type="text/css"><![CDATA[
        #rect1 { fill: url(#Gradient1); }
        .stop1 { stop-color: red; }
        .stop2 { stop-color: black; stop-opacity: 0; }
        .stop3 { stop-color: blue; }
      ]]></style>
  </defs>

  <rect id="rect1" x="10" y="10" rx="15" ry="15" width="100" height="100"/>
  <rect x="10" y="120" rx="15" ry="15" width="100" height="100" fill="url(#Gradient2)"/>

</svg>`;


describe("tokenize", () => {
  it("should reject non-strings", () => {
    expect(() => tokenize(null)).toThrow("string");
  });

  it("should parse HTML into tags and text nodes", () => {
    const tokens = tokenize(markup1);
    expect(tokens).toBeInstanceOf(Array);
    expect(tokens.length).toEqual(52);
    expect(tokens[1]).toEqual({tagName: 'body', attributes: { "bgcolor": "#FFFFFF" }});
    expect(tokens[7]).toEqual({tagName: 'a', attributes: { "href": "manual.html" }});
    expect(tokens[8]).toEqual("Back To Manual Contents");
    expect(tokens[9]).toEqual({tagName: 'a'});
    expect(tokens[42]).toEqual("Trusted by major software companies for stability and reliability.\n");
    expect(tokens[43]).toEqual({tagName: 'li'});
    expect(tokens[46]).toEqual({tagName: 'hr', attributes: {}});
  });

  it("should parse SVG into tags and whitespace", () => {
    const tokens = tokenize(markupSvg);
    expect(tokens[0]).toEqual({tagName: 'svg', attributes: {width:"120", height:"240" , version:"1.1", xmlns:"http://www.w3.org/2000/svg"}});
    expect(tokens[6]).toEqual({tagName: 'stop', attributes: {class:"stop1", offset:"0%"}});
    expect(tokens[7]).toMatch(/\s+/);
    expect(tokens[8]).toEqual({tagName: 'stop', attributes: {class:"stop2", offset:"50%"}});
    expect(tokens.length).toEqual(35);
  });
});

describe("mergeConflicts", () => {
  it("should normalize markup when both versions are equal", () => {
    const mergedMarkup = mergeConflicts(markup1, markup1);
    expect(mergedMarkup).toEqual(`
<body bgcolor="#FFFFFF">
<table border="0" cellpadding="3" cellspacing="0"><tr><td id="smez">
<a href="manual.html">Back To Manual Contents</a><br />
<a name="n0"></a><h1>1 Introduction</h1><p>
<a name="n1"></a></p><h2> What is Nutshell?</h2>
Nutshell allows developers to distribute a single PRC file instead of multiple files.  Beyond the obvious advantage of eliminating customer support surrounding missing files, Nutshell provides many other major advantages over a basic installation procedure:
<ul>
<li>Cross-platform.
</li><li>Control <b>which files</b> get installed.
</li><li>Instant over-the-air (OTA) delivery solution.
</li><li>Trusted by major software companies for stability and reliability.
</li></ul>
<hr />
</td></tr></table></body>`);
  });

  it("should handle different beginnings", () => {
    const mergedMarkup = mergeConflicts('foo<b>bold</b>end', 'bar<i>italic</i>end');
    expect(mergedMarkup).toEqual('foo<b>bold</b>bar<i>italic</i>end');
  });

  it("should handle delete at beginning of markup 1", () => {
    const mergedMarkup = mergeConflicts('end', '<h1>title</h1>end');
    expect(mergedMarkup).toEqual('<h1>title</h1>end');
  });

  it("should handle delete at beginning of markup 2", () => {
    const mergedMarkup = mergeConflicts('<h1>title</h1>end', 'end');
    expect(mergedMarkup).toEqual('<h1>title</h1>end');
  });

  it("should handle delete at end of markup 1", () => {
    const mergedMarkup = mergeConflicts('start<p>something</p>', 'start');
    expect(mergedMarkup).toEqual('start<p>something</p>');
  });

  it("should handle delete at end of markup 2", () => {
    const mergedMarkup = mergeConflicts('start', 'start<p>something</p>');
    expect(mergedMarkup).toEqual('start<p>something</p>');
  });

  it("should handle different ends", () => {
    const mergedMarkup = mergeConflicts('start<b>bold</b>foo', 'start<i>italic</i>bar');
    expect(mergedMarkup).toEqual('start<b>bold</b>foo<i>italic</i>bar');

    const mergedMarkup2 = mergeConflicts('<hr>alpha', '<hr>beta');
    expect(mergedMarkup2).toEqual('<hr />alpha beta');
  });

  it("should include all of totally different markups", () => {
    const mergedMarkup = mergeConflicts('<h2>title</h2><blockquote>first</blockquote>', '<p>first paragraph</p><p>second paragraph</p>');
    expect(mergedMarkup).toEqual('<h2>title</h2><blockquote>first</blockquote><p>first paragraph</p><p>second paragraph</p>');

    const mergedMarkup2 = mergeConflicts('first', 'second');
    expect(mergedMarkup2).toEqual('first second');
  });

  it("should insert a space between alternate text (to avoid joining words)", () => {
    const mergedMarkup = mergeConflicts('<h3>one way</h3>', '<h3>point forward</h3>');
    expect(mergedMarkup).toEqual('<h3>one way point forward</h3>');
  });

  it("should handle text replaced by tag", () => {
    const mergedMarkup = mergeConflicts('Figure 1: (image goes here)', 'Figure 1: <img src="fig1.jpg">');
    expect(mergedMarkup).toEqual('Figure 1: (image goes here) Figure 1: <img src="fig1.jpg" />');
  });

  it("should include both versions of differing markup", () => {
    const markup2 = `
<body BGCOLOR="#FFFFFF">
<TABLE BORDER=0 CELLPADDING=3 CELLSPACING=0><TR><TD ID=smez>
<a href="manual.html">Back To Manual Contents</a><br>
<a name="n0"></a><h1>1 Intro</h1><p>
<a name="n1"></a><h2> What is Nutshell?</h2>
Nutshell allows developers to distribute a single PRC file instead of multiple files.  Beyond the obvious advantage of eliminating customer support surrounding missing files, Nutshell provides many other major advantages over a basic installation procedure:
<UL>
<LI>Cross-platform.
<LI>Control <i>which files</i> get installed.
<LI>Instant over-the-air (OTA) delivery solution.
</UL>
<hr />
`;
    const mergedMarkup = mergeConflicts(markup1, markup2);
    expect(mergedMarkup).toEqual(`
<body bgcolor="#FFFFFF">
<table border="0" cellpadding="3" cellspacing="0"><tr><td id="smez">
<a href="manual.html">Back To Manual Contents</a><br />
<a name="n0"></a><h1>1 Introduction 1 Intro</h1><p>
<a name="n1"></a></p><h2> What is Nutshell?</h2>
Nutshell allows developers to distribute a single PRC file instead of multiple files.  Beyond the obvious advantage of eliminating customer support surrounding missing files, Nutshell provides many other major advantages over a basic installation procedure:
<ul>
<li>Cross-platform.
</li><li>Control <b><i>which files</b></i> get installed.
</li><li>Instant over-the-air (OTA) delivery solution.
</li><li>Trusted by major software companies for stability and reliability.
</li></ul>
<hr />
</td></tr></table></body>`);
  });

  it("should merge SVG changes into legal SVG", () => {
    const markupSvg2 = `<svg width="120" height="240" version="1.1" xmlns="http://www.w3.org/2000/svg">
  <defs>
      <linearGradient id="Gradient1">
        <stop class="stop1" offset="0%"/>
        <stop class="stop2" offset="50%"/>
        <stop class="stop3" offset="100%"/>
      </linearGradient>
      <linearGradient id="Gradient2" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="red"/>
        <stop offset="60%" stop-color="black" stop-opacity="0"/>
        <stop offset="100%" stop-color="blue"/>
      </linearGradient>
      <style type="text/css"><![CDATA[
        #rect1 { fill: url(#Gradient1); }
        .stop1 { stop-color: red; }
        .stop2 { stop-color: green; stop-opacity: 0.2; }
        .stop3 { stop-color: blue; }
      ]]></style>
  </defs>

  <rect id="rect1" x="10" y="10" rx="15" ry="15" width="100" height="100"/>
  <rect x="10" y="120" rx="15" ry="20" width="100" height="100" fill="url(#Gradient1)"/>

</svg>`;

    const mergedMarkup = mergeConflicts(markupSvg, markupSvg2);

    expect(mergedMarkup).toEqual(`<svg width="120" height="240" version="1.1" xmlns="http://www.w3.org/2000/svg">
  <defs>
      <lineargradient id="Gradient1">
        <stop class="stop1" offset="0%" />
        <stop class="stop2" offset="50%" />
        <stop class="stop3" offset="100%" />
      </lineargradient>
      <lineargradient id="Gradient2" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="red" />
        <stop offset="50%" stop-color="black" stop-opacity="0" /><stop offset="60%" stop-color="black" stop-opacity="0" />
        <stop offset="100%" stop-color="blue" />
      </lineargradient>
      <style type="text/css"><![CDATA[
        #rect1 { fill: url(#Gradient1); }
        .stop1 { stop-color: red; }
        .stop2 { stop-color: black; stop-opacity: 0; }
        .stop3 { stop-color: blue; }
      ]]> <![CDATA[
        #rect1 { fill: url(#Gradient1); }
        .stop1 { stop-color: red; }
        .stop2 { stop-color: green; stop-opacity: 0.2; }
        .stop3 { stop-color: blue; }
      ]]></style>
  </defs>

  <rect id="rect1" x="10" y="10" rx="15" ry="15" width="100" height="100" />
  <rect x="10" y="120" rx="15" ry="15" width="100" height="100" fill="url(#Gradient2)" /><rect x="10" y="120" rx="15" ry="20" width="100" height="100" fill="url(#Gradient1)" />

</svg>`);
  });
});
