// mergeConflicts.js - merging two notes for Notes Together
// Copyright © 2021-2022 Doug Reeder

import htmlparser from "htmlparser2";
import {extractUserMessage} from "./util/extractUserMessage";

const selfClosingTags = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'rect', 'stop', 'use'];

function tokenize(markup) {
  if ('string' !== typeof markup) {
    throw new Error("markup must be string");
  }

  const tokens = [];

  const parser = new htmlparser.Parser({
    onopentag(tagName, attributes) {
      tokens.push({tagName, attributes});
    },
    ontext(text) {
      tokens.push(text);
    },
    onclosetag(tagName) {
      if (-1 === selfClosingTags.indexOf(tagName)) {
        tokens.push({tagName});
      }
    },
    onerror(err) {
      console.error("while parsing HTML:", err);
      window.postMessage({kind: 'TRANSIENT_MSG', message: extractUserMessage(err)}, window?.location?.origin);
    }
  }, {recognizeSelfClosing: false, recognizeCDATA: false});

  parser.write(markup);
  parser.end();

  return tokens;
}

// doesn't handle all the edge cases of a general-purpose deep equals
function equals(o1, o2) {
  if (typeof o1 !== typeof o2) {
    return false;
  }
  if ('object' !== typeof o1) {
    return o1 === o2;
  } else {
    for (const [key, value] of Object.entries(o1)) {
      if (! equals(value, o2[key])) {
        return false;
      }
    }
    return true;
  }
}

function mergeConflicts(markup1, markup2, documentHasTags = true) {
  let tokens1, tokens2;
  if (documentHasTags) {
    tokens1 = tokenize(markup1);
    tokens2 = tokenize(markup2);
  } else {
    tokens1 = markup1.split('\n');
    tokens2 = markup2.split('\n');
  }

  const mergedTokens = [];
  let matchedInd1 = 0, matchedInd2 = 0;
  let diagonal = 0, searchInd1 = 0;
  let numChecksThisDiagonal = 0;
  while (matchedInd1 < tokens1.length && matchedInd2 < tokens2.length) {
    const areTokensAvailable = matchedInd1 + searchInd1 < tokens1.length &&
        matchedInd2 + diagonal - searchInd1 < tokens2.length;
    if (areTokensAvailable) {
      ++numChecksThisDiagonal;
    }
    if (areTokensAvailable &&
        equals(tokens1[matchedInd1 + searchInd1], tokens2[matchedInd2 + diagonal - searchInd1])) {
      pushConflictTokens(tokens1, matchedInd1, matchedInd1 + searchInd1, 'del');

      pushConflictTokens(tokens2, matchedInd2, matchedInd2 + diagonal - searchInd1, 'ins');

      matchedInd1 += searchInd1;
      matchedInd2 += diagonal - searchInd1;
      checkPreviousAndPush(tokens1[matchedInd1]);   // matched token
      ++matchedInd1;
      ++matchedInd2;
      diagonal = 0;
      searchInd1 = 0;
      numChecksThisDiagonal = 0;
    } else {
      if (0 === searchInd1) {   // finished diagonal
        if (diagonal > 0 && 0 === numChecksThisDiagonal) {
          break;   // ends with a mismatch
        }
        ++diagonal;
        searchInd1 = diagonal;
        numChecksThisDiagonal = 0;
      } else {
        --searchInd1;
      }
    }
  }

  pushConflictTokens(tokens1, matchedInd1, tokens1.length, 'del');

  pushConflictTokens(tokens2, matchedInd2, tokens2.length, 'ins');

  const mergedMarkup = mergedTokens.map(token => {
    if ('string' === typeof token) {
      return token;
    } else if ('attributes' in token) {
      return '<' +
          token.tagName +
          Object.entries(token.attributes).map(([attrName, attrValue]) => ` ${attrName}="${attrValue}"`).join('') +
          (selfClosingTags.indexOf(token.tagName) > -1 ? ' />' : '>');
    } else {
      if (-1 === selfClosingTags.indexOf(token.tagName)) {
        return '</' + token.tagName + '>';
      } else {
        return '';
      }
    }
  }).join('');

  return mergedMarkup;

  function pushConflictTokens(source, start, end, conflictTagName) {
    if (end === start) {
      return;
    }

    let chunkHasContent = false;
    for (let i = start; i < end; ++i) {
      if ('string' === typeof source[i] || ['img', 'hr'].includes(source[i]?.tagName)) {
        chunkHasContent = true;
        break;
      }
    }

    if (chunkHasContent) {
      if (documentHasTags) {
        mergedTokens.push({tagName: conflictTagName, attributes: {}});
      } else {
        if ('del' === conflictTagName) {   // is there a better way to do this?
          mergedTokens.push('\n');
        }
      }
    }
    for (let i = start; i < end; ++i) {
      checkPreviousAndPush(source[i]);
    }
    if (chunkHasContent) {
      mergedTokens.push(documentHasTags ? {tagName: conflictTagName} : '\n');
    }
  }

  function checkPreviousAndPush(token) {
    if ('string' === typeof token &&
        mergedTokens.length > 0 && 'string' === typeof mergedTokens[mergedTokens.length-1]) {
      mergedTokens.push(documentHasTags ? ' ' : '\n');
    }
    mergedTokens.push(token);
  }
}


export {tokenize, mergeConflicts};
