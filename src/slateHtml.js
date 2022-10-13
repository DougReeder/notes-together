// slateHtml.js - constants & functions to customize Slate for HTML/JSX
// Copyright © 2021 Doug Reeder under the MIT License

import React from "react";
import { jsx } from 'slate-hyperscript';
import escapeHtml from 'escape-html'
import sanitizeHtml from "sanitize-html";
import {semanticOnly} from "./sanitizeNote";
import {isLikelyMarkdown} from "./util";
import {deserializeMarkdown, serializeMarkdown} from "./slateMark";
import {Text, Node as SlateNode, Element, Path, Transforms, Editor} from "slate";
import {useSelected, useFocused} from 'slate-react'
import {imageFileToDataUrl} from "./util/imageFileToDataUrl";
import {addSubstitution} from "./urlSubstitutions";
import {determineParseType} from "./FileImport";
import {coerceToPlainText} from "./slateUtil";

function isBlank(node) {
  return /^\s*$/.test(SlateNode.string(node));
}

function withHtml(editor) {   // defines Slate plugin
  const {isInline, isVoid, normalizeNode, insertData} = editor

  editor.isInline = element => {
    switch (element?.type) {
      case 'link':
        return true;
      default:
        return isInline(element);
    }
  }

  editor.isVoid = element => {
    switch (element?.type) {
      // images are funny in Slate, and not void
      case 'thematic-break':
        return true;
      default:
        return isVoid(element)
    }
  }

  editor.normalizeNode = entry => {
    const [node, path] = entry;
    // console.log("normalizeNode:", path, path.length > 0 ? node : 'editor')

    if (Text.isText(node) && node.deleted && node.inserted) {
      Transforms.unsetNodes(editor, 'deleted', {at: path, mode: "highest"});
      return;
    }

    if (Element.isElement(node) && ! editor.isInline(node.type)) {
      const parentPath = Path.parent(path);
      const parent = SlateNode.get(editor, parentPath);
      if (editor.isInline(parent)) {
        let newPath;
        if (path.length > 2) {
          newPath = path.slice(0, -2);
        } else {
          newPath = path.slice(0, -1);
        }
        const parentRef = Editor.pathRef(editor, parentPath);
        Transforms.moveNodes(editor, {at: path, to: newPath});
        if (1 === parent.children.length) {   // the moved node was the only child
          Transforms.insertNodes(editor, {text: ""}, {at: [...parentRef.current, 0]});
        }
        parentRef.unref();
        return;
      }
    }

    if ('link' === node.type && isBlank(node)) {
      try {
        const linkText = /([^/]+)\/?$/.exec(node.url)?.[1]?.slice(0, 52) || 'link';
        Transforms.insertText(editor, linkText, {at: path});
        return;
      } catch (err) {
        console.error("while adding text to normalize link:", err);
      }
    }

    if (1 === path.length) {
      if (!Element.isElement(node) || editor.isInline(node)) {
        const block = {type: 'paragraph', children: []}
        Transforms.wrapNodes(editor, block, {at: path});
        return;
      } else if (!node.type) {
        Transforms.setNodes(editor, {type: 'paragraph'}, {at: path, mode: "highest"});
      }
    }

    if ('list-item' === node.type) {
      let parent = undefined;
      if (path.length > 1) {
        parent = SlateNode.get(editor, Path.parent(path));
      }
      if (! ['bulleted-list', 'numbered-list'].includes(parent?.type)) {
        if (isBlank(node)) {
          Transforms.removeNodes(editor, {at: path});
          return;
        } else {
          const list = {type: 'bulleted-list', children: []};
          Transforms.wrapNodes(editor, list, {at: path});
          return;
        }
      }
    }

    if (['bulleted-list', 'numbered-list'].includes(node.type)) {
      let changed = false;
      for (let i=node.children.length-1; i>=0; --i) {
        const child = node.children[i];
        const childPath = [...path, i];
        if ('list-item' !== child.type) {
          if (isBlank(child)) {
            Transforms.removeNodes(editor, {at: childPath});
            changed = true;
          } else {
            Transforms.unwrapNodes(editor, {at: childPath});
            const item = {type: 'list-item', children: []};
            Transforms.wrapNodes(editor, item, {at: childPath});
            changed = true;
          }
        }
      }
      if (changed) {
        return;
      }
    }

    normalizeNode(entry);
  }

  // paste or drag & drop
  editor.insertData = async dataTransfer => {
    // console.log("types:", JSON.stringify(dataTransfer.types), "   files:", JSON.stringify(dataTransfer.files));
    try {
      if (editor.subtype?.startsWith('html')) {
        await processDataTransfer(dataTransfer, pasteHtmlToRichText, pasteUriListToRichText, pasteMarkdownToRichText, pasteText, pasteGraphicFileToRichText);
      } else if (editor.subtype?.startsWith('markdown')) {
        await processDataTransfer(dataTransfer, pasteHtmlToMarkdown, pasteUriListToMarkdown, pasteText, pasteText, pasteGraphicFileToMarkdown);
      } else {   // plain text mode
        await processDataTransfer(dataTransfer, pasteHtmlToPlainText, pasteText, pasteText, pasteText, pasteGraphicFileToPlainText);
      }
    } catch (err) {
      console.error("while pasting:", err);
      const userMsg = err?.userMsg || "Can you open that in another app and copy?";
      window.postMessage({kind: 'TRANSIENT_MSG', message: userMsg}, window?.location?.origin);
    }
  }

  async function processDataTransfer(dataTransfer, pasteHtml, pasteUriList, pasteMarkdown, pastePlainText, pasteGraphicFile) {
    if (dataTransfer.types.indexOf('text/html') > -1 && pasteHtml !== pasteHtmlToPlainText) {
      let html = dataTransfer.getData('text/html');
      pasteHtml(html);
    } else if (dataTransfer.types.indexOf('text/uri-list') > -1) {
      const uriList = dataTransfer.getData('text/uri-list');
      pasteUriList(uriList);
    } else if (dataTransfer.types.indexOf('text/plain') > -1) {
      const text = dataTransfer.getData('text/plain');
      if (isLikelyMarkdown(text)) {
        pasteMarkdown(text);
      } else {   // plain text
        pastePlainText(text)
      }
    } else if (dataTransfer.files.length > 0) {
      for (const file of dataTransfer.files) {
        const fileInfo = await determineParseType(file);
        if (fileInfo.isMarkdown) {   // presumes Markdown heuristics are correct
          fileInfo.parseType = 'text/markdown';
        }
        if (fileInfo.parseType.startsWith('image/')) {
          await pasteGraphicFile(file);
        } else if (!fileInfo.message) {   // no message means usable
          await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async evt => {
              try {
                const text = evt.target.result;
                switch (fileInfo.parseType) {
                  case 'text/html':
                    pasteHtml(text);
                    break;
                  case 'text/uri-list':
                    pasteUriList(text);
                    break;
                  case 'text/markdown':
                    pasteMarkdown(text);
                    break;
                  default:   // some kind of text not excluded by determineParseType()
                    pastePlainText(text)
                    break;
                }
                resolve();
              } catch (err) {
                console.error("while pasting file:", err);
                window.postMessage({kind: 'TRANSIENT_MSG', message: `Can you open “${file.name}” in another app and copy?`}, window?.location?.origin);
                reject(err);
              }
            };
            reader.onerror = () => {
              console.error("reader.onerror:", reader.error);
              window.postMessage({kind: 'TRANSIENT_MSG', message: `Can you open “${file.name}” in another app and copy?`}, window?.location?.origin);
              reject(reader.error);
            };
            reader.readAsText(file);
          });
        } else {
          console.warn("not pasteable:", file.name, file.type, fileInfo.message);
          window.postMessage({kind: 'TRANSIENT_MSG', severity: 'warning', message: `Can you open “${file.name}” in another app and copy?`}, window?.location?.origin);
        }
      }
    } else {   // use default handling, which probably does nothing
      console.warn("default handling", ...dataTransfer.items);
      window.postMessage({kind: 'TRANSIENT_MSG', severity: 'warning', message: "Can you open that in another app and copy?"}, window?.location?.origin);
      insertData(dataTransfer)
    }
  }


  function pasteHtmlToRichText(html) {
    html = sanitizeHtml(html, semanticOnly);
    // console.log("sanitized HTML", html.slice(0, 1024));
    const slateNodes = deserializeHtml(html, editor);
    // console.log("HTML -> slateNodes:", slateNodes);
    Editor.insertFragment(editor, slateNodes);
  }

  function pasteUriListToRichText(uriList) {
    const slateNodes = [];
    let comment = "", url;
    for (const line of uriList.split(/\r\n|\n/)) {
      if ('#' === line[0]) {
        comment = /#\s*(.*)/.exec(line)[1] || "";
      } else if ((url = line?.trim())) {
        slateNodes.push({
          type: 'link',
          url: url,
          title: "",
          children: [{text: comment || url}]
        });
        comment = "";
      } else {
        comment = "";
      }
    }
    console.info('URI list -> link element(s):', slateNodes);
    Editor.insertFragment(editor, slateNodes);
  }

  function pasteMarkdownToRichText(text) {
    const slateNodes = deserializeMarkdown(text);
    // console.log("MD -> slateNodes:", slateNodes);
    Editor.insertFragment(editor, slateNodes);
  }

  function pasteText(text) {
    // console.log("pasting text:", text);
    Editor.insertText(editor, text);
  }

  async function pasteGraphicFileToRichText(file) {
    const {dataUrl, alt} = await imageFileToDataUrl(file);
    if (!dataUrl) {
      console.error("Can't convert to data URL:", file);
      return;
    }
    console.info(`${file.name} ${file.type} -> image element:`);
    const slateNodes = [
      {type: 'paragraph', children: [{text: ""}]},
      {
        type: 'image',
        url: dataUrl,
        title: "",
        children: [{text: alt}]
      },
      {type: 'paragraph', children: [{text: ""}]},
    ];
    Editor.insertFragment(editor, slateNodes);
  }


  function pasteHtmlToMarkdown(html) {
    html = sanitizeHtml(html, semanticOnly);
    const syntaxTree = deserializeHtml(html, editor);
    const markdown = serializeMarkdown(syntaxTree);
    const lines = markdown.split('\n');
    console.info("HTML -> Markdown:", markdown);

    let slateNodes;
    if (1 === lines.length) {
      slateNodes = [{text: lines[0]}]
    } else {
      slateNodes = lines.map(line => {
        return {type: 'paragraph', children: [{text: line}]};
      });
    }
    Editor.insertFragment(editor, slateNodes);
  }

  function pasteUriListToMarkdown(uriList) {
    let markdown = "";
    let comment = "", url;
    for (const line of uriList.split(/\r\n|\n/)) {
      if ('#' === line[0]) {
        comment = /#\s*(.*)/.exec(line)[1] || "";
      } else if ((url = line?.trim())) {
        markdown += `[${comment || url}](${url})`;
        comment = "";
      } else {
        comment = "";
      }
    }
    console.info("URI list -> Markdown:", markdown);
    Editor.insertText(editor, markdown);
  }

  async function pasteGraphicFileToMarkdown(file) {
    const {dataUrl, alt} = await imageFileToDataUrl(file);
    if (!dataUrl) {
      console.error("Can't convert to data URL:", file);
      return;
    }
    console.info(`${file.name} ${file.type} -> Markdown img:`);
    const markdown = `![${alt}](${dataUrl} "")`;
    Editor.insertText(editor, markdown);
  }


  function pasteHtmlToPlainText(html) {
    // console.log("HTML -> slateNodes -> coerceToPlainText");
    html = sanitizeHtml(html, semanticOnly);
    const slateNodes = deserializeHtml(html, editor);
    Editor.withoutNormalizing(editor, () => {
      Editor.insertFragment(editor, slateNodes);
      coerceToPlainText(editor);
    });
  }

  async function pasteGraphicFileToPlainText(file) {
    const {alt} = await imageFileToDataUrl(file);
    console.info(`${file.name} ${file.type} -> alt text:`, alt);

    Editor.insertText(editor, alt);
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

  // DIV: () => ({ }),
  FIGURE: () => ({ type: 'paragraph' }),
  DETAILS: () => ({ type: 'paragraph' }),
  DT: () => ({ type: 'paragraph' }),   // TODO: implement natively
  DD: () => ({ type: 'quote' }),   // TODO: implement natively
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
        if (Array.isArray(attrs.children)) {
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
      return <div {...attributes} contentEditable={false}>
        {children}
        <hr />
      </div>
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

  if (leaf.superscript) {
    children = <sup>{children}</sup>
  }

  if (leaf.subscript) {
    children = <sub>{children}</sub>
  }

  if (leaf.underline) {
    children = <u>{children}</u>
  }

  if (leaf.strikethrough) {
    children = <s>{children}</s>
  }

  if (leaf.deleted) {
    children = <del>{children}</del>
  }

  if (leaf.inserted) {
    children = <ins>{children}</ins>
  }

  return <span {...attributes}>{children}</span>
}


function serializeHtml(slateNodes, substitutions = new Map()) {
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
          if (slateNode.url.startsWith('blob:')) {
            const dataUrl = substitutions.get(slateNode.url);
            if (dataUrl) {
              return `<img src="${encodeURI(dataUrl)}" alt="${SlateNode.string(slateNode) || ''}" title="${slateNode.title || ''}">`;
            } else {
              console.error("No substitution for", slateNode?.url);
              return '';   // Doesn't save img tag.
            }
          } else {
            return `<img src="${encodeURI(slateNode.url)}" alt="${SlateNode.string(slateNode) || ''}" title="${slateNode.title || ''}">`;
          }
        default:
          return children
      }
    } catch (err) {
      console.error("serializeSlateNode:", err);
      return SlateNode.string(slateNode) || "";
    }
  }
}

export {withHtml, deserializeHtml, RenderingElement, ImageElement, Leaf, serializeHtml};
