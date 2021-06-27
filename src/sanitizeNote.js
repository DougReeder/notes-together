// sanitizeNote.js - subroutine for Notes module for RemoteStorage
// Copyright © 2021 Doug Reeder under the MIT license

import sanitizeHtml from "sanitize-html";

// eslint-disable-next-line
const semanticOnly = {
  allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'ul', 'ol',
    'header', 'footer', 'main', 'section', 'aside',
    'li', 'dl', 'dt', 'dd', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
    'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre',
    'img', 'del', 'ins', 'kbd', 'q', 'samp', 'sub', 'sup', 'var',
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
    a: [ 'href', 'name', 'target' ],
    img: [ 'src', 'srcset', 'alt' ],
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
  allowedSchemes: [ 'http', 'https', 'data' ],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: [ 'href', 'src', 'cite' ],
  transformTags: {
    'article': 'div',
    'textarea': 'div',
    'em': 'i',
    'strong': 'b',
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
  nonTextTags: [ 'style', 'script', 'noscript', 'nav', 'button', 'select', 'nl' ],
  allowProtocolRelative: false,
  enforceHtmlBoundary: true,
  parser: {
    decodeEntities: false,
    lowerCaseTags: false,
    lowerCaseAttributeNames: false,
  }
};
Object.freeze(semanticOnly);

const semanticExtractKeywords = JSON.parse(JSON.stringify(semanticOnly));

function sanitizeNote(memoryNote, textFilter) {
  let id;
  if (Number.isFinite(memoryNote.id)) {
    id = memoryNote.id;
  } else {
    id = Math.ceil((Math.random() - 0.5) * 2 * Number.MAX_SAFE_INTEGER);
  }

  if ('string' !== typeof memoryNote.text) {
    throw new Error("text field must be string");
  }
  semanticExtractKeywords.textFilter = textFilter;
  const sanitizedText = sanitizeHtml(memoryNote.text, semanticExtractKeywords);

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
    text: sanitizedText,
    date: date,
  };
}

export {semanticOnly, sanitizeNote};
