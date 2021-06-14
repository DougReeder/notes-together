

function isLikelyMarkdown(text) {
  if (/(^|\s)(__|\*\*)(?=\S).+(\2(\s|$))/.test(text)) {
    return true;   // strong emphasis
  }
  if (/(^|\s)([_*`])(?!\2).+(\2(\s|$))/.test(text)) {
    return true;   // emphasis or code
  }
  if (/\[[^\]]+]\(https?:\/\/\S+\)/.test(text)) {
    return true;   // link
  }
  if (/(^|\n)\s{0,3}```(.*\n)+\s?```/.test(text)) {
    return true;   // code block
  }
  if (/(^|\n)\s{0,3}#{2,6}\s/.test(text)) {
    return true;   // header 2-6 (header 1 might be non-Markdown bullet)
  }
  if (/(^|\n)\s{0,3}>/.test(text)) {
    return true;   // block quote
  }
  if (/(^|\n)\s{0,3}\d[.)]\s.*\s+\d[.)]\s/.test(text)) {
    return true;   // ordered list
  }
  if (/(^|\n)\s{0,3}[*+-]\s.*\s+[*+-]\s/.test(text)) {
    return true;   // unordered list
  }
  if (/[A-Za-z]\^[23](?!\d)/.test(text)) {
    return true;   // letter-caret-2 or letter-caret-3
  }
  return false;
}

export {isLikelyMarkdown};
