// sanitizeNote.js - subroutine for Notes module for RemoteStorage
// Copyright © 2021 Doug Reeder under the MIT license

import {v4 as uuidv4, validate as uuidValidate} from 'uuid';
import sanitizeHtml from "sanitize-html";
import {TITLE_MAX} from "./Note";
import decodeEntities from "./util/decodeEntities";
import hasTagsLikeHtml from "./util/hasTagsLikeHtml";

// eslint-disable-next-line
const semanticOnly = {
  allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'ul', 'ol',
    'header', 'footer', 'main', 'section', 'aside',
    'li', 'dl', 'dt', 'dd', 'b', 'i', 'strong', 'em', 'u', 's', 'strike', 'code', 'hr', 'br', 'div',
    'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre',
    'a', 'img', 'del', 'ins', 'kbd', 'q', 'samp', 'tt', 'sub', 'sup', 'cite', 'var', 'dfn', 'abbr', 'address',
    'figure', 'details',
    'ruby', 'rp', 'rt',
    'circle', 'clipPath', 'defs', 'desc', 'ellipse',
    'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feConvolveMatrix', 'feDropShadow',
    'feGaussianBlur', 'filter',
    'foreignObject', 'g', 'hatch', 'hatchpath', 'line', 'linearGradient',
    'marker', 'mask', 'path', 'pattern', 'polygon', 'polyline',
    'radialGradient', 'rect', 'stop', 'svg', 'symbol',
    'text', 'textPath', 'title', 'tspan', 'use', 'view'
  ],
  disallowedTagsMode: 'discard',
  allowedAttributes: {
    a: [ 'href', 'title', 'download'],
    img: [ 'src', 'alt', 'srcset', 'sizes', 'title'],
    th: ['colspan'],
    circle: ['cx', 'cy', 'r', 'pathLength', 'style'],
    clipPath: ['id', 'clipPathUnits', 'style'],
    ellipse: ['cx', 'cy', 'rx', 'ry', 'pathLength', 'style'],
    feBlend: ['in', 'in2', 'mode', 'style'],
    feColorMatrix: ['in', 'type', 'values', 'style'],
    feComponentTransfer: ['in', 'style'],
    feDropShadow: ['dx', 'dy', 'stdDeviation', 'x', 'y', 'result', 'flood-color', 'flood-opacity'],
    feConvolveMatrix: ['in', 'order', 'kernelMatrix', 'divisor', 'bias', 'targetX', 'targetY', 'edgeMode', 'kernelUnitLength', 'preserveAlpha'],
    feGaussianBlur: ['in', 'stdDeviation', 'edgeMode'],
    filter: ['x', 'y', 'filterRes', 'filterUnits', 'primitiveUnits'],
    foreignObject: ['height', 'x', 'y', 'style'],
    g: ['pointer-events', 'shape-rendering', 'style'],
    hatch: ['x', 'y', 'pitch', 'rotate', 'hatchUnits', 'hatchContentUnits', 'transform', 'href', 'style'],
    hatchpath: ['d', 'offset', 'style'],
    line: ['x1', 'x2', 'y1', 'y2', 'pathLength', 'style'],
    linearGradient: ['gradientUnits', 'gradientTransform', 'href', 'spreadMethod', 'x1', 'x2', 'y1', 'y2', 'style'],
    marker: ['marker*', 'orient', 'preserveAspectRatio', 'refX', 'refY', 'viewBox', 'style'],
    mask: ['height', 'maskContentUnits', 'maskUnits', 'x', 'y', 'style'],
    path: ['d', 'pathLength', 'style'],
    pattern: ['height', 'href', 'pattern*', 'preserveAspectRatio', 'viewBox', 'x', 'y', 'style'],
    polygon: ['points', 'pathLength', 'style'],
    polyline: ['points', 'pathLength', 'style'],
    radialGradient: ['cx', 'cy', 'fr', 'fx', 'fy', 'gradient*', 'href', 'r', 'spreadMethod', 'style'],
    rect: ['x', 'y', 'rx', 'ry', 'pathLength', 'style'],
    stop: ['offset', 'stop-*', 'style'],
    svg: ['height', 'preserveAspectRatio', 'viewBox', 'x', 'y', 'xmlns*', 'style'],
    symbol: ['height', 'preserveAspectRatio', 'refX', 'refY', 'viewBox', 'x', 'y', 'style'],
    text: ['x', 'y', 'dx', 'dy', 'rotate', 'lengthAdjust', 'text*', 'style'],
    textPath: ['href', 'lengthAdjust', 'method', 'path', 'side', 'spacing', 'startOffset', 'text*', 'style'],
    tspan: ['x', 'y', 'dx', 'dy', 'rotate', 'lengthAdjust', 'textLength', 'style'],
    use: ['href', 'x', 'y', 'style'],
    view: ['viewBox', 'preserveAspectRatio', 'zoomAndPan', 'viewTarget'],
    '*': ['id', 'tabindex', 'clip*', 'color*', 'cursor', 'display', 'fill*', 'height', 'mask', 'opacity', 'overflow', 'stroke*', 'transform', 'vector-effect', 'visibility', 'width', 'xlink*']
  },
  allowedSchemes: [ 'http', 'https', 'data', 'blob', 'mailto', 'tel' ],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: [ 'href', 'src', 'cite' ],
  transformTags: {
    'h4': 'h3',
    'h5': 'h3',
    'h6': 'h3',
    'article': 'div',
    'textarea': 'div',
    'i': 'em',
    'b': 'strong',
    'svg': function(tagName, attribs) {
      if (! attribs.hasOwnProperty('viewBox')) {
        if (! attribs.hasOwnProperty('width') ) {
          attribs.width = '100%';
        }
        if (! attribs.hasOwnProperty('height')) {
          attribs.height = '50vw';   // about as tall as wide
        }
        attribs.preserveAspectRatio = 'xMidYMid meet';
      }
      if ('string' === typeof attribs.width && /\d(px)?\s*$/.test(attribs.width) && parseInt(attribs.width, 10) >= 320) {
        attribs.width = '100%';
        delete attribs.height;
        attribs.preserveAspectRatio = 'xMidYMid meet';
      }
      return {tagName, attribs};
    }
  },
  nonTextTags: ['head', 'style', 'script', 'noscript', 'nav', 'button', 'select', 'nl'],
  allowProtocolRelative: false,
  enforceHtmlBoundary: true,
  parser: {
    decodeEntities: false,
    lowerCaseTags: true,
    lowerCaseAttributeNames: true,
  }
};
Object.freeze(semanticOnly);

const semanticExtractKeywords = JSON.parse(JSON.stringify(semanticOnly));

function sanitizeNote(memoryNote, textFilter) {
  let id;
  if (uuidValidate(memoryNote.id)) {
    id = memoryNote.id;
  } else {
    id = uuidv4();
  }

  if ('string' !== typeof memoryNote.content) {
    throw new Error("content field must be string");
  }

  semanticExtractKeywords.textFilter = textFilter;

  if ('function' === typeof textFilter) {
    semanticExtractKeywords.transformTags.img = (tagName, attribs) => {
      if (attribs.alt) {
        textFilter(attribs.alt);
      }
      return {tagName, attribs};
    };
  }

  let sanitizedContent, title;
  if (hasTagsLikeHtml(memoryNote.mimeType)) {
    if ('string' === typeof memoryNote.title) {
      sanitizedContent = sanitizeHtml(memoryNote.content, semanticExtractKeywords);
      title = memoryNote.title;   // plain text doesn't need to be sanitized
    } else {
      const result = sanitizeAndExtractTitle(memoryNote.content, semanticExtractKeywords);
      sanitizedContent = result.sanitizedText;
      title = result.title;
    }
  } else {
    sanitizedContent = memoryNote.content;   // plain text doesn't need to be sanitized
    if ('function' === typeof textFilter) {
      textFilter(memoryNote.content);
    }
    if ('string' === typeof memoryNote.title) {
      title = memoryNote.title;
    } else {
      title = memoryNote.content.slice(0, TITLE_MAX).trim();
    }
  }

  let date;
  if (memoryNote.date instanceof Date) {
    date = memoryNote.date;
  } else if ('string' === typeof memoryNote.date || 'number' === typeof memoryNote.date) {
    date = new Date(memoryNote.date);
  } else {
    date = new Date();
  }

  return {
    id: id,
    content: sanitizedContent,
    title: title,
    date: date,
    mimeType: memoryNote.mimeType,
  };
}

function sanitizeAndExtractTitle(memoryText, semanticExtractKeywords) {
  const titles = {
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    highValue: [],
    ordinary: [],
    lowValue: [],
  }
  function extractTitles(frame) {
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(frame.tag)) {
      const title = frame.text?.trim();
      if (title) {
        titles[frame.tag].push(decodeEntities(title));
      }
    } else if (['p','blockquote', 'main', 'section', 'div', 'li', 'caption'].includes(frame.tag)) {
      if (titles.highValue.length < 2) {
        const txt = frame.text?.trim();
        if (txt) {
          if ('li' === frame.tag) {
            titles.highValue.push("• " + decodeEntities(txt));
          } else {
            titles.highValue.push(decodeEntities(txt));
          }
        }
      }
    } else if (['i', 'em', 'b', 'strong', 'u', 'code', 'span', 'a', 'aside', 'del', 's', 'strike', 'sub', 'sup', 'cite', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup', 'ruby', 'rp', 'rt'].includes(frame.tag)) {
      if (titles.lowValue.length < 2) {
        const txt = frame.text?.trim();
        if (txt) {
          titles.lowValue.push(decodeEntities(txt));
        }
      }
    } else if (titles.ordinary.length < 2) {   // includes <pre>
      if ('img' === frame.tag) {
        const alt = frame.attribs?.alt?.trim() || frame.attribs?.title?.trim();
        if (alt) {
          titles.ordinary.push(decodeEntities(alt));
        }
      } else {
        const txt = frame.text?.trim();
        if (txt) {
          titles.ordinary.push(decodeEntities(txt));
        }
      }
    }
    return false;   // don't filter out any tags
  }

  semanticExtractKeywords.exclusiveFilter = extractTitles;
  const sanitizedText = sanitizeHtml(memoryText, semanticExtractKeywords);

  let title = [...titles.h1, ...titles.h2, ...titles.h3, ...titles.h4, ...titles.h5, ...titles.h6, ...titles.highValue, ...titles.ordinary].slice(0, 2).join("\n").slice(0, TITLE_MAX);
  if (!title) {
    title = titles.lowValue.join("\n").slice(0, TITLE_MAX);
  }
  if (!title && !/<\/?[a-zA-Z][^<>]*>/.test(sanitizedText)) {
    title = sanitizedText.trim().slice(0, TITLE_MAX);
  }

  return {sanitizedText, title};
}

export {semanticOnly, sanitizeNote};
