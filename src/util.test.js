import {isLikelyMarkdown} from "./util";

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

  test("should flag ordered lists using paren", () => {
    expect(isLikelyMarkdown("  8) erste\n   5) zwitte")).toBeTruthy();
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

  test("should flag letter-caret-2", () => {
    expect(isLikelyMarkdown("r^2")).toBeTruthy();
  });

  test("should flag letter-caret-3", () => {
    expect(isLikelyMarkdown("I^3C")).toBeTruthy();
  });

  test("should not flag letter-caret-1", () => {
    expect(isLikelyMarkdown("...as asserted by Fong^1")).toBeFalsy();
  });
});
