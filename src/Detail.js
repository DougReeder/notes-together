import {isLikelyMarkdown} from "./util";
import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {getNote, upsertNote} from "./idbNotes";
import ContentEditable from 'react-contenteditable';
import sanitizeHtml from 'sanitize-html';
import {Parser, HtmlRenderer} from 'commonmark';
import "./Detail.css";


const markdownReader = new Parser({smart: true});
const markdownWriter = new HtmlRenderer({softbreak: "<br />"});


// eslint-disable-next-line
const semanticOnly = {
  allowedTags: ['h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'ul', 'ol',
    'li', 'dl', 'dt', 'dd', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
    'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre',
    'img', 'del', 'ins', 'kbd', 'q', 'samp', 'sub', 'sup', 'var',
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
    'h1': 'h2',
    'header': 'div',
    'footer': 'div',
    'main': 'div',
    'section': 'div',
    'article': 'div',
    'aside': 'div',
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
  nonTextTags: [ 'style', 'script', 'noscript', 'nav', 'nl' ],
  allowProtocolRelative: false,
  enforceHtmlBoundary: true,
  parser: {
    decodeEntities: false,
    lowerCaseTags: false,
    lowerCaseAttributeNames: false,
  }
};

function Detail({noteId}) {

  const [text, setText] = useState(null);
  // console.log("Detail noteId:", noteId, "   text:", text?.slice(0, 50));

  useEffect(() => {
    if (Number.isFinite(noteId)) {
      getNote(noteId).then(theNote => {
        setText(theNote.text);
      }).catch(err => {
        console.error(err);
      });
    }
  }, [noteId]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = async evt => {
    try {
      setText(evt.target.value);
      await upsertNote(noteId, evt.target.value);
    } catch (err) {
      console.error("while handling Detail text change:", err);
    }
  }

  const pasteSemanticOnly = evt => {
    // console.log("pasteSemanticOnly types:", evt.clipboardData.types);

    if (evt.clipboardData.types.indexOf('text/html') > -1) {
      evt.preventDefault();
      const html = evt.clipboardData.getData('text/html');
      pasteHtml(html);
      return true;
    } else if (evt.clipboardData.types.indexOf('image/svg+xml') > -1) {
      evt.preventDefault();
      const svg = evt.clipboardData.getData('image/svg+xml');
      pasteHtml(svg);
      return true;
    } else if (evt.clipboardData.types.indexOf('text/plain') > -1) {
      evt.preventDefault();
      const text = evt.clipboardData.getData('text/plain');
      if (isLikelyMarkdown(text)) {
        const parsed = markdownReader.parse(text);
        const html = markdownWriter.render(parsed);
        pasteHtml(html);
      } else if (/<svg\s[^>]*>/.test(text)) {
        pasteHtml(text);
      } else {
        document.execCommand('insertText', false, text);
      }
      return true;
    } else {   // use default handling for images, etc.
      // TODO: convert text/rtf to HTML
      // TODO: extract image metadata and append
      return false;
    }

    function pasteHtml(html) {
      html = sanitizeHtml(html, semanticOnly);
      document.execCommand('insertHTML', false, html);
    }
  };


  let content;
  if ('string' === typeof text) {
    content =
        (<ContentEditable
            html={sanitizeHtml(text, semanticOnly)} // innerHTML of the editable div
            disabled={false}       // use true to disable editing
            onChange={handleChange} // handle innerHTML change
            onPaste={pasteSemanticOnly}
            tagName='article' // Use a custom HTML tag (uses a div by default)
        />);
  } else {
    content =
        (<div>
          <div className="advice">Select a note on the left to display it in full.</div>
        </div>);
  }
  return content;
}

Detail.propTypes = {
  noteId: PropTypes.number,
};

export default Detail;
