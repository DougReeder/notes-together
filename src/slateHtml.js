// slateHtml.js - constants & functions to customize Slate for HTML/JSX
// Copyright © 2021 Doug Reeder under the MIT License

import React from "react";
import { jsx } from 'slate-hyperscript';
import escapeHtml from 'escape-html'
import sanitizeHtml from "sanitize-html";
import {semanticOnly} from "./sanitizeNote";
import {isLikelyMarkdown} from "./util";
import {deserializeMarkdown} from "./slateMark";
import {Text, Element, Transforms} from "slate";
import {useSelected, useFocused} from 'slate-react'

function withHtml(editor) {   // defines Slate plugin
  const { insertData, isInline, isVoid } = editor

  editor.isInline = element => {
    switch (element.type) {
      case 'link':
        return true;
      default:
        return isInline(element);
    }
  }

  editor.isVoid = element => {
    switch (element.type) {
      // images are funny in Slate, and not void
      case 'thematic-break':
        return true;
      default:
        return isVoid(element)
    }
  }

  // paste or drag & drop
  editor.insertData = dataTransfer => {
    try {
      if (dataTransfer.types.indexOf('text/html') > -1) {
        let html = dataTransfer.getData('text/html');
        // console.log("raw HTML", html);
        html = sanitizeHtml(html, semanticOnly);
        console.log("sanitized HTML", html);
        const slateNodes = deserializeHtml(html, editor);
        console.log("HTML -> slateNodes:", slateNodes);
        prependDummyBlock(slateNodes)
        Transforms.insertFragment(editor, slateNodes);
      } else if (dataTransfer.types.indexOf('text/plain') > -1) {
        const text = dataTransfer.getData('text/plain');
        if (isLikelyMarkdown(text)) {
          const slateNodes = deserializeMarkdown(text);
          console.log("MD -> slateNodes:", slateNodes);
          prependDummyBlock(slateNodes)
          Transforms.insertFragment(editor, slateNodes);
        } else {   // plain text
          console.log("plain text", dataTransfer.items);
          insertData(dataTransfer);   // default handling
        }
      } else {   // use default handling for images, etc.
        console.log("default handling", ...dataTransfer.items);
        insertData(dataTransfer)
        // // TODO: convert text/rtf to HTML
        // // TODO: extract image metadata and append
      }
      // Editor.normalize(editor, {force: true});
    } catch (err) {
      console.error("while pasting:", err);
      window.postMessage({kind: 'TRANSIENT_MSG', message: "Can you type in the info?"}, window?.location?.origin);
    }
  }

  /** hacky workaround for Slate bug */
  function prependDummyBlock(slateNodes) {
    if (Element.isElement(slateNodes[0])) {
      switch (slateNodes[0].type) {
        case undefined:
        case 'paragraph':
          break;
        default:
          slateNodes.unshift({type: 'paragraph', children: [{text: ""}]});
      }
    }
  }

  return editor;
}


const ELEMENT_TAGS = {
  A: el => ({ type: 'link', url: decodeURI(el.getAttribute('href')), title: el.getAttribute('title') }),
  BLOCKQUOTE: () => ({ type: 'quote' }),
  H1: () => ({ type: 'heading-one' }),
  H2: () => ({ type: 'heading-two' }),
  H3: () => ({ type: 'heading-three' }),
  HR: () => ({ type: 'thematic-break'}),
  IMG: el => ({ type: 'image', url: decodeURI(el.getAttribute('src')), alt: el.getAttribute('alt'), title: el.getAttribute('title') }),
  LI: () => ({ type: 'list-item' }),
  OL: () => ({ type: 'numbered-list' }),
  UL: () => ({ type: 'bulleted-list' }),
  P: () => ({ type: 'paragraph' }),
  PRE: () => ({ type: 'code' }),

  // DIV: () => ({ }),
  DT: () => ({ type: 'paragraph' }),   // TODO: implement natively
  DD: () => ({ type: 'paragraph' }),   // TODO: implement natively
}

const TEXT_TAGS = {
  CODE: () => ({ code: true }),
  KBD: () => ({ code: true }),
  SAMP: () => ({ code: true }),
  DEL: () => ({ strikethrough: true }),
  EM: () => ({ italic: true }),
  I: () => ({ italic: true }),
  S: () => ({ strikethrough: true }),
  B: () => ({ bold: true }),
  STRONG: () => ({ bold: true }),
  U: () => ({ underline: true }),
}

function deserializeHtml(html, editor) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const slateNodes = domNodeToSlateNodes(parsed.body);
  return slateNodes;

  function domNodeToSlateNodes(el) {
    try {
      if (el.nodeType === 3) {   // TEXT_NODE
        return el.textContent;
        // TODO: don't do this for preformatted text
        // return el.textContent?.replace(/^\s+/, " ")?.replace(/\s+$/, " ")?.replace(/\s+/g, " ");
      } else if (el.nodeType === 4) {   // CDATA_SECTION_NODE
        return el.textContent;
      } else if (el.nodeType !== 1) {   // not ELEMENT_NODE
        return null
      } else if (el.nodeName === 'BR') {
        return '\n'
      }

      const {nodeName} = el
      let parent = el

      if (
          nodeName === 'PRE' &&
          el.childNodes[0] &&
          el.childNodes[0].nodeName === 'CODE'
      ) {
        parent = el.childNodes[0]
      }

      let children = Array.from(parent.childNodes)
          .map(domNodeToSlateNodes)
          .flat();

      const shouldChildrenBeBlocks = children.some(
          child => Element.isElement(child) && !editor.isInline(child)
      );
      if (shouldChildrenBeBlocks) {
        // drops blank leaves between blocks
        children = children.filter(child => {
          if ('string' === typeof child) {
            return /\S/.test(child);
          } else if (! Element.isElement(child) && Text.isText(child)) {
            return /\S/.test(child.text);
          } else {
            return true;
          }
        });
        // creates blocks to contain Leaves
        children = children.map(child => {
          if (Element.isElement(child)) {
            if (editor.isInline(child)) {
              return {children: [child]};
            } else {
              return child;
            }
          } else if (Text.isText(child)) {
            return {children: [child]};
          } else if ('string' === typeof child) {
            return {children: [{text: child}]};
          } else {
            console.error("child not Element, Text, nor string:", child);
            return {children: [{text: '\ufffd'}]};
          }
        });
      }

      if (nodeName === 'BODY') {
        const slateNodes = jsx('fragment', {}, children);
        return slateNodes;
      }

      // Slate requires non-void elements to have a child.
      // Keep this in sync with isVoid()
      if (children.length === 0 && !(['HR'].includes(nodeName))) {
        children = [{text: ''}];
      }

      if (ELEMENT_TAGS[nodeName]) {
        const attrs = ELEMENT_TAGS[nodeName](el)
        const slateNodes = jsx('element', attrs, children);
        return slateNodes;
      }

      if (TEXT_TAGS[nodeName]) {
        const attrs = TEXT_TAGS[nodeName](el)
        const slateNodes = children.map(child => jsx('text', attrs, child));
        return slateNodes;
      }

      return children;
    } catch (err) {
      console.error("while deserializing HTML:", err);
      return jsx('element', {}, [{text: '\ufffd'}])
    }
  }
}


const RenderingElement = props => {
  const { attributes, children, element } = props

  switch (element.type) {
    default:
    case 'paragraph':
      return <p {...attributes}>{children}</p>
    case 'quote':
      return <blockquote {...attributes}>{children}</blockquote>
    case 'code':
      return (
          <pre>
          <code {...attributes}>{children}</code>
        </pre>
      )
    case 'bulleted-list':
      return <ul {...attributes}>{children}</ul>
    case 'heading-one':
      return <h1 {...attributes}>{children}</h1>
    case 'heading-two':
      return <h2 {...attributes}>{children}</h2>
    case 'heading-three':
      return <h3 {...attributes}>{children}</h3>
    case 'list-item':
      return <li {...attributes}>{children}</li>
    case 'numbered-list':
      if (element.listStart) {
        return <ol start={element.listStart} {...attributes}>{children}</ol>
      } else {
        return <ol {...attributes}>{children}</ol>
      }
    case 'link':
      return (
          <a href={element.url} title={element.title} target="_blank" rel="noreferrer" referrerPolicy="no-referrer" {...attributes}>
            {children}
          </a>
      )
    case 'image':
      return <ImageElement {...props} />
    case 'thematic-break':
      return <hr />
  }
}

const ImageElement = ({ attributes, children, element }) => {
  const selected = useSelected();
  const focused = useFocused();
  return (
      <div {...attributes}>
        {children}
        <img
            src={element.url}
            title={element.title}
            alt={element.alt}
            style={{display: 'block', maxWidth: '100%', maxHeight: '75vh', boxShadow: selected && focused ? '0 0 0 2px blue' : 'none'}}
        />
      </div>
  )
}

const Leaf = ({ attributes, children, leaf }) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>
  }

  if (leaf.code) {
    children = <code>{children}</code>
  }

  if (leaf.italic) {
    children = <em>{children}</em>
  }

  if (leaf.underline) {
    children = <u>{children}</u>
  }

  if (leaf.strikethrough) {
    children = <del>{children}</del>
  }

  return <span {...attributes}>{children}</span>
}


function serializeHtml(slateNodes) {
  let inCodeBlock = false;
  return serializeSlateNode({children: slateNodes});

  function serializeSlateNode(slateNode) {
    try {
      if (Text.isText(slateNode)) {
        let html = escapeHtml(slateNode.text);
        if (inCodeBlock) {
          return html;
        } else if (slateNode.code) {
          return `<code>${html}</code>`;
        } else {
          if (slateNode.bold) {
            html = `<strong>${html}</strong>`;
          }
          if (slateNode.italic) {
            html = `<em>${html}</em>`;
          }
          // newline -> hard break
          html = html.replace(/\n/g, "<br />");
          return html;
        }
      }

      switch (slateNode.type) {   // eslint-disable-line default-case
        case 'code':
          inCodeBlock = true;
      }

      const children = slateNode.children.map(n => serializeSlateNode(n)).join('');

      switch (slateNode.type) {
        case 'paragraph':
          return `<p>${children}</p>`;
        case 'heading-one':
          return `<h1>${children}</h1>`;
        case 'heading-two':
          return `<h2>${children}</h2>`;
        case 'heading-three':
          return `<h3>${children}</h3>`;
        case 'quote':
          return `<blockquote>${children}</blockquote>`;
        case 'code':
          inCodeBlock = false;
          return `<pre><code>${children}</code></pre>`;
        case 'bulleted-list':
          return `<ul>${children}</ul>`;
        case 'numbered-list':
          return `<ol>${children}</ol>`;
        case 'list-item':
          return `<li>${children}</li>`;
        case 'thematic-break':
          return `<hr />`;
        case 'link':
          return `<a href="${encodeURI(slateNode.url)}" title="${slateNode.title}">${children}</a>`
        case 'image':
          return `<img src="${encodeURI(slateNode.url)}" alt="${slateNode.alt}" title="${slateNode.title}">`;
        default:
          return children
      }
    } catch (err) {
      console.error("serializeSlateNode:", err);
      return "";
    }
  }
}

export {withHtml, deserializeHtml, RenderingElement, ImageElement, Leaf, serializeHtml};
