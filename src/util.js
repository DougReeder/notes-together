

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

export {isLikelyMarkdown, adHocTextReplacements, visualViewportMatters};
