// slateHtml.js - constants & functions to customize Slate for HTML/JSX
// Copyright © 2021 Doug Reeder under the MIT License

import React from "react";
import { jsx } from 'slate-hyperscript';
import escapeHtml from 'escape-html'
import sanitizeHtml from "sanitize-html";
import {semanticOnly} from "./sanitizeNote";
import {isLikelyMarkdown} from "./util";
import {deserializeMarkdown, serializeMarkdown} from "./slateMark";
import {Text, Node as SlateNode, Element, Transforms} from "slate";
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
      if (editor.subtype?.startsWith('html')) {
        if (dataTransfer.types.indexOf('text/html') > -1) {
          let html = dataTransfer.getData('text/html');
          // console.log("raw HTML", html);
          html = sanitizeHtml(html, semanticOnly);
          console.log("sanitized HTML", html);
          const slateNodes = deserializeHtml(html, editor);
          console.log("HTML -> slateNodes:", slateNodes);
          Transforms.insertFragment(editor, slateNodes);
        } else if (dataTransfer.types.indexOf('text/plain') > -1) {
          const text = dataTransfer.getData('text/plain');
          if (isLikelyMarkdown(text)) {
            const slateNodes = deserializeMarkdown(text);
            console.log("MD -> slateNodes:", slateNodes);
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
      } else if (editor.subtype?.startsWith('markdown') && dataTransfer.types.includes('text/html')) {
        console.log("reserializing HTML as Markdown");
        const html = dataTransfer.getData('text/html');
        const syntaxTree = deserializeHtml(html, editor);
        const markdown = serializeMarkdown(syntaxTree);
        const lines = markdown.split('\n');
        let slateNodes;
        if (1 === lines.length) {
          slateNodes = [{text: lines[0]}]
        } else {
          slateNodes = lines.map(line => {
            return {type: 'paragraph', children: [{text: line}]};
          });
        }
        Transforms.insertFragment(editor, slateNodes);
      } else {   // not rich text
        console.log("plain text; using default handling", ...dataTransfer.items);
        insertData(dataTransfer)
      }
      // Editor.normalize(editor, {force: true});
    } catch (err) {
      console.error("while pasting:", err);
      window.postMessage({kind: 'TRANSIENT_MSG', message: "Can you type in the info?"}, window?.location?.origin);
    }
  }

  return editor;
}


const ELEMENT_TAGS = {
  A: el => ({ type: 'link', url: decodeURI(el.getAttribute('href')), title: el.getAttribute('title') || undefined }),
  BLOCKQUOTE: () => ({ type: 'quote' }),
  H1: () => ({ type: 'heading-one' }),
  H2: () => ({ type: 'heading-two' }),
  H3: () => ({ type: 'heading-three' }),
  HR: () => ({ type: 'thematic-break'}),
  IMG: el => ({ type: 'image', url: decodeURI(el.getAttribute('src')), title: el.getAttribute('title') || "" , children: [{text: el.getAttribute('alt') || ""}]}),
  LI: () => ({ type: 'list-item' }),
  OL: () => ({ type: 'numbered-list' }),
  UL: () => ({ type: 'bulleted-list' }),
  P: () => ({ type: 'paragraph' }),
  PRE: () => ({ type: 'code' }),

  // DIV: () => ({ }),
  FIGURE: () => ({ type: 'paragraph' }),
  DETAILS: () => ({ type: 'paragraph' }),
  DT: () => ({ type: 'paragraph' }),   // TODO: implement natively
  DD: () => ({ type: 'paragraph' }),   // TODO: implement natively
}

const TEXT_TAGS = {
  CODE: () => ({ code: true }),
  KBD: () => ({ code: true }),
  SAMP: () => ({ code: true }),
  TT: () => ({ code: true }),
  DEL: () => ({ strikethrough: true }),
  EM: () => ({ italic: true }),
  I: () => ({ italic: true }),
  Q: () => ({ italic: true }),
  DFN: () => ({ italic: true }),
  CITE: () => ({ italic: true }),
  VAR: () => ({ italic: true }),
  ABBR: () => ({ italic: true }),
  S: () => ({ strikethrough: true }),
  STRIKE: () => ({ strikethrough: true }),
  B: () => ({ bold: true }),
  STRONG: () => ({ bold: true }),
  U: () => ({ underline: true }),
}

function deserializeHtml(html, editor) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');

  let activeMarkStack = [{}];
  let activeCodeBlockStack = [false];
  const slateNodes = domNodeToSlateNodes(parsed.body);
  if (activeMarkStack.length !== 1){
    console.error("activeMarkStack corrupt:", activeMarkStack);
  }
  if (activeCodeBlockStack.length !== 1) {
    console.error("activeCodeBlockStack corrupt", activeCodeBlockStack);
  }

  return slateNodes;

  function domNodeToSlateNodes(el) {
    let nodeName;
    try {
      const marks = activeMarkStack[activeMarkStack.length-1];
      if (el.nodeType === 3 || el.nodeType === 4) {   // TEXT_NODE or CDATA_SECTION_NODE
        let text = el.textContent;
        if (! activeCodeBlockStack[activeCodeBlockStack.length-1]) {
          text = text?.replace(/\s+/g, " ");
        }
        if (Object.keys(marks).length > 0) {
          return {text, ...marks}
        } else {
          return text;
        }
      } else if (el.nodeType !== 1) {   // not ELEMENT_NODE
        return null
      } else if (el.nodeName === 'BR') {
        return '\n'
      }

      nodeName = el.nodeName;

      if (TEXT_TAGS[nodeName]) {
        const tagMarks = TEXT_TAGS[nodeName](el);
        activeMarkStack.push({...activeMarkStack[activeMarkStack.length-1], ...tagMarks});
      }

      if ('PRE' === nodeName) {
        activeCodeBlockStack.push(true);
      }

      let parent = el;
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
        return jsx('fragment', {}, children);
      }

      // Slate requires elements to have a child.
      if (children.length === 0) {
        if (Object.keys(marks).length > 0) {
          children = [{text: '', ...marks}];
        } else {
          children = [{text: ''}];
        }
      }

      if (ELEMENT_TAGS[nodeName]) {
        const attrs = ELEMENT_TAGS[nodeName](el)
        if (attrs.children instanceof Array) {
          for (const child of attrs.children) {
            Object.assign(child, marks);
          }
          return jsx('element', attrs, attrs.children);
        } else {
          return jsx('element', attrs, children);
        }
      }

      return children;
    } catch (err) {
      console.error("while deserializing HTML:", err);
      return [{text: el.innerText || ""}];
    } finally {
      if ('PRE' === nodeName) {
        activeCodeBlockStack.pop();
      }

      if (TEXT_TAGS[nodeName]) {
        activeMarkStack.pop();
      }
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
            alt=""
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
    children = <s>{children}</s>
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
        if (slateNode.code) {
          html = `<code>${html}</code>`;
        }
        if (slateNode.bold) {
          html = `<strong>${html}</strong>`;
        }
        if (slateNode.italic) {
          html = `<em>${html}</em>`;
        }
        if (slateNode.underline) {
          html = `<u>${html}</u>`;
        }
        if (slateNode.strikethrough) {
          html = `<s>${html}</s>`;
        }
        if (inCodeBlock) {
          return html;
        } else {
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
          return `<img src="${encodeURI(slateNode.url)}" alt="${SlateNode.string(slateNode)}" title="${slateNode.title}">`;
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
