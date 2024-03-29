// util.js — tests for various utilty funtions for Notes Together
// Copyright © 2021–2024 Doug Reeder

import {adHocTextReplacements, isLikelyMarkdown, normalizeUrl, urlRunningTextRE, visualViewportMatters} from "./util";

describe("isLikelyMarkdown", () => {
  test("should not flag plain text starting or ending in newline", () => {
    expect(isLikelyMarkdown("\nThe rain in Spain\n")).toBeFalsy();
  });


  test("should flag emphasis using asterisks", () => {
    expect(isLikelyMarkdown("plain *italic_text* plain")).toBeTruthy();
  });

  test("should flag emphasis using underscores", () => {
    expect(isLikelyMarkdown("_italic*text_")).toBeTruthy();
  });

  test("should not flag internal underscores", () => {
    expect(isLikelyMarkdown("multiword_programming_identifier")).toBeFalsy();
  });

  test("should not flag repeated leading underscores", () => {
    expect(isLikelyMarkdown("foo __identifier __other ")).toBeFalsy();
  });


  test("should flag strong emphasis using asterisks", () => {
    expect(isLikelyMarkdown("plain **bold__text** plain")).toBeTruthy();
  });

  test("should flag strong emphasis using underscores", () => {
    expect(isLikelyMarkdown("__bold*text__")).toBeTruthy();
  });


  test("should flag strikethrough using double tilde surrounded by space", () => {
    expect(isLikelyMarkdown("We use ~~the old way~~ the new way to...")).toBeTruthy();
  });
  test("should not flag tildes indicating approximation", () => {
    expect(isLikelyMarkdown("add ~1 c. flour and ~2 tbsp. sugar")).toBeFalsy();
  });


  test("should flag code", () => {
    expect(isLikelyMarkdown("like this `rm -r *~` usually")).toBeTruthy();
  });

  test("should flag code blocks", () => {
    expect(isLikelyMarkdown(`foo
   \`\`\`
{
  "firstName": "John",
  "lastName": "Smith",
  "age": 25
}
 \`\`\``)).toBeTruthy();
  });


  test("should not flag header 1 (it's ambiguous)", () => {
    expect(isLikelyMarkdown("# this is a code comment line")).toBeFalsy();
  });

  test("should flag header 2", () => {
    expect(isLikelyMarkdown("   ## Chapter 17")).toBeTruthy();
  });

  test("should flag header 6", () => {
    expect(isLikelyMarkdown("   ###### Subparagraph")).toBeTruthy();
  });

  test("should flag block quotes", () => {
    expect(isLikelyMarkdown("   >some bad argument")).toBeTruthy();
  });


  test("should flag links", () => {
    expect(isLikelyMarkdown("Surf to [our page](https://www.example.com) of stuff")).toBeTruthy();
  });


  test("should flag ordered lists using dot", () => {
    expect(isLikelyMarkdown("   9. erste\n  6. zwitte")).toBeTruthy();
  });
  test("should not flag multiple digits and dot", () => {   // probably section label
    expect(isLikelyMarkdown("   10. erste\n  11. zwitte")).toBeFalsy();
  });

  test("should flag ordered lists using parenthesis", () => {
    expect(isLikelyMarkdown("  8) erste\n   5) zwitte")).toBeTruthy();
  });
  test("should not flag multiple digits and parenthesis", () => {   // probably section label
    expect(isLikelyMarkdown("   12) erste\n  13) zwitte")).toBeFalsy();
  });

  test("should not flag mixed ordered list indicators", () => {
    expect(isLikelyMarkdown("  2. erste\n   3) zwitte")).toBeFalsy();
  });

  test("should flag unordered lists using asterisk", () => {
    expect(isLikelyMarkdown("   * erste\n  * zwitte")).toBeTruthy();
  });

  test("should flag unordered lists using dash", () => {
    expect(isLikelyMarkdown("  - erste\n  - zwitte")).toBeTruthy();
  });

  test("should flag unordered lists using plus", () => {
    expect(isLikelyMarkdown(" + erste\n  + zwitte")).toBeTruthy();
  });

  test("should not flag mixed unordered list indicators", () => {
    expect(isLikelyMarkdown(" * erste\n  - zwitte\n  + dritte")).toBeFalsy();
  });

  test("should flag table delimiter row", () => {
    expect(isLikelyMarkdown(`
| :--- | ---: 
`)).toBeTruthy();
  });

  test("should flag link", () => {
    expect(isLikelyMarkdown("[link with title](http://nodeca.github.io/pica/demo/ \"title text!\")) An adorable corgi!")).toBeTruthy();
  });

  test("should flag image", () => {
    expect(isLikelyMarkdown("![cardigan corgi](https://images.dog.ceo/breeds/corgi-cardigan/n02113186_1030.jpg) An adorable corgi!")).toBeTruthy();
  });

  test("should not flag letter-caret-1", () => {
    expect(isLikelyMarkdown("...as asserted by Fong^1")).toBeFalsy();
  });
});

describe("AdHocTextReplacements", () => {
  it("should only replace double hyphen with en-dash between numbers", () => {
    const replaced = adHocTextReplacements(`foo --long-option 34--56--78`);
    expect(replaced).toEqual(`foo --long-option 34–56–78`);
  });

  it("should only replace triple hyphen with em-dash when flanked by letters", () => {
    const replaced = adHocTextReplacements(`---
      ---what is this?
      foo--->bar
      this --- not that---nor the other--- and not the other other`);
    expect(replaced).toEqual(`---
      ---what is this?
      foo--->bar
      this — not that—nor the other— and not the other other`);
  });
});

describe("visualViewportMatters", () => {
  it("should not throw an exception", () => {
    expect(typeof visualViewportMatters()).toEqual('boolean');
  });
});

describe("urlRunningTextRE followed by normalizeUrl", () => {
  it("should return empty string for an email address", () => {
    urlRunningTextRE.lastIndex = 0;
    expect(normalizeUrl(urlRunningTextRE.exec('jsmith@sub.example.fun')?.[0] || '')).toEqual('');
  });

  it("should return empty string for a URL using an IP address", () => {
    urlRunningTextRE.lastIndex = 0;
    expect(normalizeUrl(urlRunningTextRE.exec('https://192.168.0.1')?.[0] || '')).toEqual('');
  });

  it("should return empty string for a bare domain name", () => {
    urlRunningTextRE.lastIndex = 0;
    expect(normalizeUrl(urlRunningTextRE.exec('java.sun.com')?.[0] || '')).toEqual('');
  });

  it("should allow bare domain names that start with www. as a special case", () => {
    urlRunningTextRE.lastIndex = 0;
    expect(normalizeUrl(urlRunningTextRE.exec('www.sun.com')?.[0] || '')).toEqual('https://www.sun.com/');
  });

  it("should allow parentheses in path", () => {
    urlRunningTextRE.lastIndex = 0;
    expect(normalizeUrl(urlRunningTextRE.exec('https://en.wikipedia.org/wiki/Hose_(clothing)')?.[0] || '')).toEqual('https://en.wikipedia.org/wiki/Hose_(clothing)');
  });

  it("should prepend https:// if needed", () => {
    urlRunningTextRE.lastIndex = 0;
    expect(normalizeUrl(urlRunningTextRE.exec('www.example.com/quux')?.[0] || ''))
      .toEqual('https://www.example.com/quux');
  });

  it("should normalize the path", () => {
    urlRunningTextRE.lastIndex = 0;
    expect(normalizeUrl(urlRunningTextRE.exec('ftp://example.edu/../a/./b/../b/%63/%7bfoo%7d')?.[0] || ''))
      .toEqual('ftp://example.edu/a/b/%63/%7bfoo%7d');
  });

  it("should allow mailto: URLs", () => {
    urlRunningTextRE.lastIndex = 0;
    expect(normalizeUrl(urlRunningTextRE.exec('mailto:bob@example.org?subject=Hey')?.[0] || ''))
      .toEqual('mailto:bob@example.org?subject=Hey');
  });

  it("should allow mailto: URLs w/ arbitrary subject and body", () => {
    urlRunningTextRE.lastIndex = 0;
    const match = urlRunningTextRE.exec('mailto:bob@example.org?subject=Hey,%20there!&body=You%20need%20to%20know...');
    expect(normalizeUrl(match?.[0] || '')).toEqual('mailto:bob@example.org?subject=Hey,%20there!&body=You%20need%20to%20know...');
  });

  it("should allow a fragment", () => {
    urlRunningTextRE.lastIndex = 0;
    expect(normalizeUrl(urlRunningTextRE.exec('http://example.com/data.csv#row=5-*')?.[0] || ''))
      .toEqual('http://example.com/data.csv#row=5-*');
  });

  it("should allow almost any scheme", () => {
    urlRunningTextRE.lastIndex = 0;
    expect(normalizeUrl(urlRunningTextRE.exec('coaps+tcp://example.com:5683/~sensors/temp.xml')?.[0] || ''))
      .toEqual('coaps+tcp://example.com:5683/~sensors/temp.xml');
  });

  it("should block the javascript: scheme", () => {
    urlRunningTextRE.lastIndex = 0;
    expect(normalizeUrl(urlRunningTextRE.exec('javascript:alert()')?.[0] || ''))
      .toEqual('');
  });

  it("should block the file: scheme", () => {
    urlRunningTextRE.lastIndex = 0;
    expect(normalizeUrl(urlRunningTextRE.exec('file:/etc/motd')?.[0] || ''))
      .toEqual('');
  });

  it("should normalize browser-specific URLs", () => {
    urlRunningTextRE.lastIndex = 0;
    expect(normalizeUrl(urlRunningTextRE.exec('microsoft-edge-holographic://microsoft.com/')?.[0] || ''))
      .toEqual('https://microsoft.com/');
  });
});
