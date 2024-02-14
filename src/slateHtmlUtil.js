// slateHtmlUtil.js — functions for Slate editor for Notes Together
// Copyright © 2021–2024 Doug Reeder under the MIT License

import {Element as SlateElement, Node as SlateNode, Text} from "slate";
import {addSubstitution} from "./urlSubstitutions.js";
import {INLINE_ELEMENTS} from "./constants.js";
import {jsx} from "slate-hyperscript";
import escapeHtml from "escape-html";


const ELEMENT_TAGS = {
  A: el => ({
    type: 'link',
    url: decodeURI(el.getAttribute('href')),
    title: el.getAttribute('title') && "undefined" !== el.getAttribute('title') ? el.getAttribute('title') : undefined
  }),
  BLOCKQUOTE: () => ({ type: 'quote' }),
  H1: () => ({ type: 'heading-one' }),
  H2: () => ({ type: 'heading-two' }),
  H3: () => ({ type: 'heading-three' }),
  H4: () => ({ type: 'heading-three' }),
  H5: () => ({ type: 'heading-three' }),
  H6: () => ({ type: 'heading-three' }),
  HR: () => ({ type: 'thematic-break'}),
  IMG: el => {
    if (el.hasAttribute('src')) {
      const src = decodeURI(el.getAttribute('src'));
      if (src.startsWith('blob:')) {
        addSubstitution(src);
      }
      return { type: 'image',
        url: src,
        title: el.getAttribute('title') || "" ,
        children: [{text: el.getAttribute('alt') || ""}]
      };
    } else {
      return {};
    }
  },
  LI: () => ({ type: 'list-item' }),
  OL: () => ({ type: 'numbered-list' }),
  UL: () => ({ type: 'bulleted-list' }),
  P: () => ({ type: 'paragraph' }),
  PRE: () => ({ type: 'code' }),
  TABLE: () => ({ type: 'table' }),   // presumes it contains a tbody
  TR: () => ({ type: 'table-row' }),
  TD: () => ({ type: 'table-cell'}),
  TH: () => ({ type: 'table-cell'}),   // also sets bold

  // DIV: () => ({ }),
  FIGCAPTION: () => ({ type: 'paragraph' }),   // also sets italic
  DETAILS: () => ({ type: 'paragraph' }),
  DT: () => ({ type: 'paragraph' }),   // also sets bold
  DD: () => ({ type: 'quote' }),   // visual appearance does what we want
}

const TEXT_TAGS = {
  CODE: () => ({ code: true }),
  KBD: () => ({ code: true }),
  SAMP: () => ({ code: true }),
  TT: () => ({ code: true }),
  DEL: () => ({ deleted: true }),
  INS: () => ({ inserted: true }),
  EM: () => ({ italic: true }),
  I: () => ({ italic: true }),
  Q: () => ({ italic: true }),
  DFN: () => ({ italic: true }),
  CITE: () => ({ italic: true }),
  VAR: () => ({ italic: true }),
  ABBR: () => ({ italic: true }),
  ADDRESS: () => ({ italic: true }),
  SUP: () => ({ superscript: true}),
  SUB: () => ({ subscript: true}),
  S: () => ({ strikethrough: true }),
  STRIKE: () => ({ strikethrough: true }),
  B: () => ({ bold: true }),
  STRONG: () => ({ bold: true }),
  U: () => ({ underline: true }),
  DT: () => ({ bold: true }),   // also paragraph element
  FIGCAPTION: () => ({ italic: true }),   // also paragraph element
  TH: () => ({ bold: true }),   // also table-cell element
  CAPTION: () => ({ bold: true }),   // also specially handled
}

export function deserializeHtml(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');

  let hasH1 = false;
  let activeMarkStack = [{}];
  let activeCodeBlockStack = [false];
  const isChecklistStack = [];
  let captionStack = [];
  const slateNodes = domNodeToSlateNodes(parsed.body);
  if (activeMarkStack.length !== 1){
    console.error("activeMarkStack corrupt:", activeMarkStack);
  }
  if (activeCodeBlockStack.length !== 1) {
    console.error("activeCodeBlockStack corrupt", activeCodeBlockStack);
  }
  if (isChecklistStack.length > 0) {
    console.error("isChecklistStack corrupt", isChecklistStack);
  }
  if (captionStack.length > 0) {
    console.warn("unused caption:", captionStack);
  }

  if (!hasH1) {
    for (const el of parsed.head.children) {
      if ('TITLE' === el.nodeName) {
        const text = el.text?.trim();
        if (text) {
          slateNodes.unshift({type: 'heading-one', children: [{text}]})
        }
      }
    }
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
        return '';
      } else if (el.nodeName === 'BR') {
        return '\n'
      } else if (['SCRIPT', 'NOSCRIPT', 'STYLE', 'INPUT', 'BUTTON', 'SELECT', 'NAV'].includes(el.nodeName)) {
        return '';
      }

      nodeName = el.nodeName;

      if (TEXT_TAGS[nodeName]) {
        const tagMarks = TEXT_TAGS[nodeName](el);
        activeMarkStack.push({...activeMarkStack[activeMarkStack.length-1], ...tagMarks});
      }

      const firstChild = el.childNodes[0] || {};

      switch (nodeName) {
        case 'IMG':
          if (!el.src) {
            return '';
          }
          break;
        case 'H1':
          if (el.textContent?.trim()) {
            hasH1 = true;
          }
          break;
        case 'PRE':
          activeCodeBlockStack.push(true);
          break;
        case 'UL':
        case 'OL':
          isChecklistStack.push(false);
          break;
        case 'LI':
          if ('INPUT' === firstChild.nodeName && 'checkbox' === firstChild.type && isChecklistStack.length > 0) {
            isChecklistStack[isChecklistStack.length-1] = true;
          }
          break;
        case 'TABLE':
          captionStack.push(null);
          break;
        default:
      }

      let parent = el;
      if (nodeName === 'PRE' && firstChild.nodeName === 'CODE') {
        parent = firstChild
      }

      let children = Array.from(parent.childNodes)
        .map(domNodeToSlateNodes)
        .flat();

      const shouldChildrenBeBlocks = children.some(
        child => SlateElement.isElement(child) && !INLINE_ELEMENTS.includes(child?.type)
      );
      if (shouldChildrenBeBlocks) {
        // drops blank leaves between blocks
        children = children.filter(child => {
          if ('string' === typeof child) {
            return /\S/.test(child);
          } else if (! SlateElement.isElement(child) && Text.isText(child)) {
            return /\S/.test(child.text);
          } else {
            return true;
          }
        });
        // creates blocks to contain Leaves
        children = children.map(child => {
          if (SlateElement.isElement(child)) {
            if (INLINE_ELEMENTS.includes(child?.type)) {
              return {children: [child]};
            } else {
              return child;
            }
          } else if (Text.isText(child)) {
            return {children: [child]};
          } else if ('string' === typeof child) {
            return {children: [{text: child}]};
          } else {
            console.error("child not SlateElement, Text, nor string:", child);
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

      if ('CAPTION' === nodeName) {
        captionStack[captionStack.length-1] = children;
        return "";
      }

      if (ELEMENT_TAGS[nodeName]) {
        const attrs = ELEMENT_TAGS[nodeName](el);

        if ('LI' === nodeName && (isChecklistStack[isChecklistStack.length-1] || 'INPUT' === firstChild.nodeName && 'checkbox' === firstChild.type)) {
          attrs.checked = Boolean(firstChild.checked);
        } else if ('UL' === nodeName && isChecklistStack[isChecklistStack.length-1]) {
          attrs.type = 'task-list';
        } else if ('OL' === nodeName && isChecklistStack[isChecklistStack.length-1]) {
          attrs.type = 'sequence-list';
        }

        if ('TABLE' === nodeName) {
          const elements = [jsx('element', attrs, children)];
          let captionChildren;
          if ((captionChildren = captionStack[captionStack.length-1])) {
            elements.unshift(jsx('element', {type: 'paragraph'}, captionChildren));
          }
          return jsx('fragment', null, elements);
        } else if (Array.isArray(attrs.children)) {
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
      return [{text: el?.innerText || ""}];
    } finally {
      switch (nodeName) {
        case 'TABLE':
          captionStack.pop();
          break;
        case 'UL':
        case 'OL':
          isChecklistStack.pop();
          break;
        case 'PRE':
          activeCodeBlockStack.pop();
          break;
        default:
      }

      if (TEXT_TAGS[nodeName]) {
        activeMarkStack.pop();
      }
    }
  }
}


export function serializeHtml(slateNodes, substitutions = new Map()) {
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
        if (slateNode.superscript) {
          html = `<sup>${html}</sup>`;
        }
        if (slateNode.subscript) {
          html = `<sub>${html}</sub>`;
        }
        if (slateNode.underline) {
          html = `<u>${html}</u>`;
        }
        if (slateNode.strikethrough) {
          html = `<s>${html}</s>`;
        }
        if (slateNode.deleted) {
          html = `<del>${html}</del>`;
        }
        if (slateNode.inserted) {
          html = `<ins>${html}</ins>`;
        }
        if (inCodeBlock) {
          return html;
        } else {
          // newline -> hard break
          html = html.replace(/\n/g, "<br />");
          return html;
        }
      }

      switch (slateNode.type) {
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
        case 'task-list':
          return `<ul>${children}</ul>`;
        case 'numbered-list':
        case 'sequence-list':
          return `<ol>${children}</ol>`;
        case 'list-item':
          if ('checked' in slateNode) {
            if (slateNode.checked) {
              return `<li><input type="checkbox" checked/>${children}</li>`;
            } else {
              return `<li><input type="checkbox"/>${children}</li>`;
            }
          } else {
            return `<li>${children}</li>`;
          }
        case 'thematic-break':
          return `<hr />`;
        case 'link':
          if (slateNode.title) {
            return `<a href="${encodeURI(slateNode.url)}" title="${slateNode.title}">${children}</a>`
          } else {
            return `<a href="${encodeURI(slateNode.url)}">${children}</a>`
          }
        case 'image':
          const altText = SlateNode.string(slateNode) || '';
          let url = slateNode.url;
          if (url.startsWith('blob:')) {
            url = substitutions.get(slateNode.url);
            if (!url) {
              console.error(`No substitution for “${altText}”`, slateNode?.url);
              return altText;   // Substitutes
            }
          }
          if (slateNode.title) {
            return `<img src="${encodeURI(url)}" alt="${altText}" title="${slateNode.title}">`;
          } else {
            return `<img src="${encodeURI(url)}" alt="${altText}">`;
          }
        case 'table':
          return `<table><tbody>${children}</tbody></table>`;
        case 'table-row':
          return `<tr>${children}</tr>`;
        case 'table-cell':
          return `<td>${children}</td>`;
        default:
          return children
      }
    } catch (err) {
      console.error("serializeSlateNode:", err);
      return SlateNode.string(slateNode) || "";
    }
  }
}
