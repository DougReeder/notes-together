// util.js — various utilty funtions for Notes Together
// Copyright © 2021–2024 Doug Reeder

/* eslint-env browser, worker */

function extractSubtype(mimeType) {
  return /\/(?:x-|vnd\.|x\.)?([^;]+)/.exec(mimeType)?.[1];
}

function extractExtension(file) {
  return /\.[^.\\/:*?"<>|\s]{1,255}$/.exec(file?.name)?.[0]?.toLowerCase() || "";
}

function isLikelyMarkdown(text) {
  if (/(^|\s)(__|\*\*|~~)(?=\S).+(\2(\s|$))/.test(text)) {
    return true;   // strong emphasis or strikethrough
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
    return true;   // header 2-6 (1 octothorp might be non-Markdown bullet)
  }
  if (/(^|\n)\s{0,3}>/.test(text)) {
    return true;   // block quote
  }

  const numberDotPatt = /^\s{0,3}\d\.[ \t ]+\S/gm;
  let numListItems = 0;
  while(numListItems < 2 && numberDotPatt.test(text)) { ++numListItems; }
  if (numListItems >= 2) { return true; }

  const numberParenPatt = /^\s{0,3}\d\)[ \t ]+\S/gm;
  numListItems = 0;
  while(numListItems < 2 && numberParenPatt.test(text)) { ++numListItems; }
  if (numListItems >= 2) { return true; }

  const starItemPatt = /^\s{0,3}\*[ \t ]+\S/gm;
  numListItems = 0;
  while(numListItems < 2 && starItemPatt.test(text)) { ++numListItems; }
  if (numListItems >= 2) { return true; }

  const plusItemPatt = /^\s{0,3}\+[ \t ]+\S/gm;
  numListItems = 0;
  while(numListItems < 2 && plusItemPatt.test(text)) { ++numListItems; }
  if (numListItems >= 2) { return true; }

  const dashItemPatt = /^\s{0,3}-[ \t ]+\S/gm;
  numListItems = 0;
  while(numListItems < 2 && dashItemPatt.test(text)) { ++numListItems; }
  if (numListItems >= 2) { return true; }

  if (/\[[^\]]+]\([^)]+\)/.test(text)) {
    return true;   // link (images also match this)
  }

  if (/\n(\|\s*:?-{3,}:?\s*){2,}/.test(text)) {
    return true;   // table delimiter row w/ 2 or more columns
  }

  return false;
}

function adHocTextReplacements(text) {
  text = text.replace(/([A-Za-z])\^2(?![\dA-Za-z])/g, "$1²");
  text = text.replace(/([A-Za-z])\^3(?![\dA-Za-z])/g, "$1³");
  text = text.replace(/([A-Za-z])\^1(?![\dA-Za-z])/g, "$1¹");
  text = text.replace(/([A-Za-z])\^0(?![\dA-Za-z])/g, "$1⁰");
  text = text.replace(/([A-Za-z])\^4(?![\dA-Za-z])/g, "$1⁴");
  text = text.replace(/([A-Za-z])\^5(?![\dA-Za-z])/g, "$1⁵");
  text = text.replace(/([A-Za-z])\^6(?![\dA-Za-z])/g, "$1⁶");
  text = text.replace(/([A-Za-z])\^7(?![\dA-Za-z])/g, "$1⁷");
  text = text.replace(/([A-Za-z])\^8(?![\dA-Za-z])/g, "$1⁸");
  text = text.replace(/([A-Za-z])\^9(?![\dA-Za-z])/g, "$1⁹");
  text = text.replace(/(\d)--(\d)/g, "$1–$2");
  text = text.replace(/([A-Za-z]\s*)---(\s*[A-Za-z])/g, "$1—$2");
  return text;
}

// based on https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent#Mobile_Device_Detection
function visualViewportMatters() {
  if (navigator.userAgentData) {
    return navigator.userAgentData.mobile;
  } else if ("maxTouchPoints" in navigator) {
    return navigator.maxTouchPoints > 0;
  } else {
    const mQ = window.matchMedia && matchMedia("(pointer:coarse)");
    if (mQ && mQ.media === "(pointer:coarse)") {
      return !!mQ.matches;
    } else if ('orientation' in window) {
      return true; // deprecated, but good fallback
    } else {
      // Only as a last resort, fall back to user agent sniffing
      const UA = navigator.userAgent;
      return (
          /\b(BlackBerry|webOS|iPhone|IEMobile)\b/i.test(UA) ||
          /\b(Android|Windows Phone|iPad|iPod)\b/i.test(UA)
      );
    }
  }
}

// Numeric IP addresses are not allowed — local network addresses are unstable and others are a security problem
const urlRunningTextRE = /(\b(?:([A-Za-z][A-Za-z+-]{2,25}:(?:\/\/)?)(?:[\w;:&=+$,-]+@)?|www\.)([A-Za-z0-9-]{1,63}\.)+[A-Za-z]{2,6}(?::\d{1,5})?)(\/[\w+~%/.)(-]*)?(\?[-+=&;%@.,!\w_]*)?(#[.!/\\\w=,*-]*)?/g

const BLOCKED_SCHEMES = ['javascript:', 'file:', 'data:'];

const BROWSER_SPECIFIC_SCHEMES = ['microsoft-edge:', 'microsoft-edge-holographic:', 'googlechrome:', 'opera-http:',
  'read:http:', 'read:https:', 'intent:http:', 'intent:https:'];

function normalizeUrl(str) {
  try {
    const url = new URL(str);
    if (BLOCKED_SCHEMES.includes(url.protocol)) {
      return '';
    } else if (BROWSER_SPECIFIC_SCHEMES.includes(url.protocol)) {
      return url.href.replace(url.protocol, 'https:');   // setting protocol has no effect in test
    } else {
      return url.href;
    }
  } catch (err) {
    try {
      if (str.startsWith('www.') || str.startsWith('WWW.')) {
        const url = new URL('https://' + str);
        return url.href;
      } else {
        return '';
      }
    } catch (err) {
      return '';
    }
  }
}


export {extractSubtype, extractExtension, isLikelyMarkdown, adHocTextReplacements, visualViewportMatters, urlRunningTextRE, normalizeUrl};
