// slateMark.js - constants & functions to customize Slate for Markdown
// Copyright © 2021-2022 Doug Reeder under the MIT License

import {adHocTextReplacements} from "./util";
import {Element as SlateElement, Text as SlateText} from 'slate';
import {fromMarkdown} from 'mdast-util-from-markdown';
import {gfmTable} from 'micromark-extension-gfm-table';
import {gfmTableFromMarkdown} from 'mdast-util-gfm-table';
import {gfmStrikethrough} from 'micromark-extension-gfm-strikethrough'
import {gfmStrikethroughFromMarkdown} from 'mdast-util-gfm-strikethrough'

function deserializeMarkdown(markdown) {
  const root = fromMarkdown(markdown, {
    extensions: [gfmTable, gfmStrikethrough()],
    mdastExtensions: [gfmTableFromMarkdown, gfmStrikethroughFromMarkdown]
  });
  const definitions = extractDefinitions(root, new Map());
  return slateNodesFromMdNodes(root.children);

  function slateNodesFromMdNodes(mdNodes, italic = false, bold = false, superscript = false, subscript= false, underline = false, strikethrough = false, deleted = false, inserted = false) {
    const slateNodes = [];
    let tableRowNum = 0;
    for (const mdNode of mdNodes) {
      try {
        if (mdNode.children) {
          let children;
          switch (mdNode.type) {
            case 'paragraph':
            case 'heading':
            case 'list':
            case 'listItem':
            case 'table':
            case 'tableRow':
            case 'tableCell':
            case 'blockquote':
              if ('tableRow' === mdNode.type) {
                bold = 0 === tableRowNum++;
              }
              children = slateNodesFromMdNodes(mdNode.children, false, bold);
              const hoistedChildren = [];
              if ('paragraph' === mdNode.type) {
                for (let i = children.length - 1; i >= 0; --i) {
                  if ('image' === children[i].type) {
                    hoistedChildren.unshift(children.splice(i, 1)[0]);
                  }
                }
              }
              if (['listItem', 'blockquote'].includes(mdNode.type) && 1 === children.length && 'paragraph' === children[0].type) {
                children = children[0].children;
              }
              if (0 === children.length) {
                if ('tableCell' === mdNode.type) {
                  children.push(textNode(""))
                } else {
                  slateNodes.push(...hoistedChildren);
                  break;   // doesn't instantiate empty block
                }
              }
              const slateNode = {
                type: slateType(mdNode),
                children,
              };
              if ('list' === mdNode.type && 'number' === typeof mdNode.start) {
                slateNode.listStart = mdNode.start;
              }
              slateNodes.push(slateNode, ...hoistedChildren);
              break;
            case 'link':
              children = slateNodesFromMdNodes(mdNode.children, italic, bold, superscript, subscript, underline, strikethrough, deleted, inserted);
              if (/\S/.test(mdNode.url)) {
                if (0 === children.length) {
                  children.push(textNode(mdNode.title || mdNode.url, {italic, bold, superscript, subscript, underline, strikethrough, deleted, inserted}));
                }
                slateNodes.push({
                  type: 'link',
                  url: mdNode.url,
                  title: mdNode.title,
                  children,
                });
              } else {   // if no URL doesn't create a Slate link node
                slateNodes.push(...children);
              }
              break;
            case 'linkReference':
              children = slateNodesFromMdNodes(mdNode.children, italic, bold, superscript, subscript, underline, strikethrough, deleted, inserted);
              const definition = definitions.get(mdNode.identifier);
              if (0 === children.length) {
                children.push(textNode(definition.title || definition.label || definition.url, {italic, bold, superscript, subscript, underline, strikethrough, deleted, inserted}));
              }
              slateNodes.push({
                type: 'link',
                url: definition.url,
                title: definition.title,
                children,
              });
              break;
            case 'emphasis':
              children = slateNodesFromMdNodes(mdNode.children, true, bold, superscript, subscript, underline, strikethrough, deleted, inserted);
              slateNodes.push(...children);
              break;
            case 'strong':
              children = slateNodesFromMdNodes(mdNode.children, italic, true, superscript, subscript, underline, strikethrough, deleted, inserted);
              slateNodes.push(...children);
              break;
            case 'delete':
              children = slateNodesFromMdNodes(mdNode.children, italic, bold, superscript, subscript, underline, true, deleted, inserted);
              slateNodes.push(...children);
              break;
            default:
              console.error(`Unknown Markdown block:`, mdNode);
          }
        } else {   // leaf node
          switch (mdNode.type) {
            case 'text':
              let text = adHocTextReplacements(mdNode.value);
              text = text.replace(/\n/g, ' ');   // soft line breaks correspond to a single space
              slateNodes.push(textNode(text, {italic, bold, superscript, subscript, underline, strikethrough, deleted, inserted}));
              break;
            case 'break':   // hard line break
              // TODO: check that normalization merges this node
              slateNodes.push(textNode("\n", {italic, bold, superscript, subscript, underline, strikethrough, deleted, inserted}));
              break;
            case 'inlineCode':
              const node = textNode(mdNode.value, {code: true, italic, bold, superscript, subscript, underline, strikethrough, deleted, inserted});
              slateNodes.push(node);
              break;
            case 'code':
              slateNodes.push({type: "code", children: [
                  textNode(mdNode.value, {italic, bold, superscript, subscript, underline, strikethrough, deleted, inserted})
                ]});
              break;
            case 'image':
              if (/\S/.test(mdNode.url)) {
                const slateNode = {
                  type: 'image',
                  url: mdNode.url,
                  title: mdNode.title,
                  children: [{text: mdNode.alt}]
                };
                slateNodes.push(slateNode);
              } else {   // doesn't create a Slate image node
                if (/\S/.test(mdNode.alt)) {
                  slateNodes.push(textNode(mdNode.alt, {italic, bold, superscript, subscript, underline, strikethrough, deleted, inserted}));
                }
              }
              break;
            case 'imageReference':
              const definition = definitions.get(mdNode.identifier);
              slateNodes.push({
                type: 'image',
                url: definition.url,
                title: definition.title,
                children: [textNode(mdNode.alt || definition.title || definition.label, {italic, bold, superscript, subscript, underline, strikethrough, deleted, inserted})]
              });
              break;
            case 'thematicBreak':
              slateNodes.push({type: 'thematic-break', children: [{text: ""}]});
              break;
            case 'definition':
              break;   // no Slate node is needed
            case 'html':
              // TODO: handle table tags
              const value = mdNode.value.replace(/\/>$/, '>').replace(/\s/g, '');
              switch (value) {
                case '<u>':
                  underline = true;
                  break;
                case '</u>':
                  underline = false;
                  break;
                case '<sup>':
                  superscript = true;
                  break;
                case '</sup>':
                  superscript = false;
                  break;
                case '<sub>':
                  subscript = true;
                  break;
                case '</sub>':
                  subscript = false;
                  break;
                case '<s>':
                  strikethrough = true;
                  break;
                case '</s>':
                  strikethrough = false;
                  break;
                case '<del>':
                  deleted = true;
                  break;
                case '</del>':
                  deleted = false;
                  break;
                case '<ins>':
                  inserted = true;
                  break;
                case '</ins>':
                  inserted = false;
                  break;
                case '<br>':
                  slateNodes.push(textNode("\n", {italic, bold, superscript, subscript, underline, strikethrough, deleted, inserted}));
                  break;
                default:
                  const parsed = new DOMParser().parseFromString(mdNode.value, 'text/html');
                  // TODO: call deserializeHTML(html, editor)
                  const text = parsed.documentElement.textContent.trim();
                  if (text) {
                    slateNodes.push(textNode(text, {italic, bold, superscript, subscript, underline, strikethrough, deleted, inserted}));
                    console.warn(`extracted “${text}” from:`, mdNode);
                  } else {
                    console.warn(`ignoring HTML:`, mdNode);
                  }
              }
              break;
            default:
              console.error(`Unknown Markdown leaf:`, mdNode);
          }
        }
      } catch (err) {
        console.error(`while processing Markdown ${mdNode}:`, err);
      }
    }

    return slateNodes;
  }
}

function extractDefinitions(node, definitions) {
  if ('definition' === node.type) {
    if (/\S/.test(node.url)) {
      if (definitions.get(node.identifier)) {
        console.warn(`ignoring duplicate Markdown definition “${node.identifier}”:`, node);
      } else {
        definitions.set(node.identifier, node);
      }
    }
  } else if (node.children) {
    for (const child of node.children) {
      extractDefinitions(child, definitions);
    }
  }
  return definitions;
}

function slateType(mdNode) {
  switch (mdNode.type) {
    case 'heading':
      switch (mdNode.depth) {
        case 1:
          return 'heading-one';
        case 2:
          return 'heading-two';
        case 3:
          return 'heading-three';
        case 4:
          return 'heading-three';
        case 5:
          return 'heading-three';
        default:
          return 'heading-three';
      }
    case 'paragraph':
      return 'paragraph';
    case 'list':
      if (mdNode.ordered) {
        return 'numbered-list'
      } else {
        return 'bulleted-list';
      }
    case 'listItem':
      return 'list-item';
    case 'table':
      return 'table';
    case 'tableRow':
      return 'table-row';
    case 'tableCell':
      return 'table-cell';
    case 'blockquote':
      return 'quote';
    case 'link':
      return 'link';

    default:
      console.error("unknown MD container node:", mdNode);
      return 'paragraph';
  }
}

function textNode(text, {italic, bold, code, superscript, subscript, underline, strikethrough, deleted, inserted} = {}) {
  const node = {text};
  if (italic) {
    node.italic = true;
  }
  if (bold) {
    node.bold = true;
  }
  if (code) {
    node.code = true;
  }
  if (superscript) {
    node.superscript = true;
  }
  if (subscript) {
    node.subscript = true;
  }
  if (underline) {
    node.underline = true;
  }
  if (strikethrough) {
    node.strikethrough = true;
  }
  if (deleted) {
    node.deleted = true;
  }
  if (inserted) {
    node.inserted = true;
  }
  return node;
}

function serializeMarkdown(editor, slateNodes) {
  const hierarchy = [];
  let inCodeBlock = false;
  let tableRowNum = 0;
  let numTableCol = 0;
  const lines = [];

  const text = slateNodes.map(serializeSlateNode).join('');
  if (text) {
    lines.push(text);
  }
  return lines.join("\n");

  /** blocks are written to lines[], but text is returned */
  function serializeSlateNode(slateNode, ind) {
    if ('table-cell' === slateNode.type) {
      if (0 === tableRowNum) { ++numTableCol; }
      const childrenText = slateNode.children.map(serializeSlateNode).join('');
      return "| " + childrenText + " ";
    } else if (SlateText.isText(slateNode)) {
      if (inCodeBlock) {
        return slateNode.text;
      } else if (slateNode.code) {
        if (/`/.test(slateNode.text)) {
          return "``" + slateNode.text + "``";
        } else {
          return "`" + slateNode.text + "`";
        }
      } else {
        let string = slateNode.text;
        string = escapeMarkdown(string);
        if (slateNode.bold) {
          string = `**${string}**`;
        }
        if (slateNode.italic) {
          string = `*${string}*`;
        }
        if (slateNode.superscript) {
          string = `<sup>${string}</sup>`;
        }
        if (slateNode.subscript) {
          string = `<sub>${string}</sub>`;
        }
        if (slateNode.underline) {
          string = `<u>${string}</u>`;
        }
        if (slateNode.strikethrough) {
          string = `<s>${string}</s>`;
        }
        if (slateNode.deleted) {
          string = `<del>${string}</del>`;
        }
        if (slateNode.inserted) {
          string = `<ins>${string}</ins>`;
        }
        // newline -> hard break
        string = string.replace(/\n/g, "  \n");
        return string;
      }
    } else if (SlateElement.isElement(slateNode)) {
      hierarchy.unshift(slateNode.type);
      if (editor.isInline(slateNode)) {
        const childrenText = slateNode.children.map(serializeSlateNode).join('');
        const titleMarkup = slateNode.title ? ` "${escapeMarkdown(slateNode.title)}"` : '';
        return `[${childrenText}](${escapeMarkdown(slateNode.url)}${titleMarkup})`;
      } else {   // block
        if ('code' === slateNode.type) {
          inCodeBlock = true;
        }
        let text = slateNode.children.map(serializeSlateNode).join('');
        if (ind > 0 && 'paragraph' === hierarchy[0]) {
          text = prefixText("\n", text);
        }
        for (let level = 0; level < hierarchy.length; ++level) {
          // eslint-disable-next-line default-case
          switch (hierarchy[level]) {
            case 'heading-one':
              text = prefixText("# ", text);
              break;
            case 'heading-two':
              text = prefixText("## ", text);
              break;
            case 'heading-three':
              text = prefixText("### ", text);
              break;
            case 'quote':
              text = prefixText("> ", text);
              break;
            case 'code':
              text = '```\n' + text + '\n```';
              inCodeBlock = false;
              break;
            case 'image':
              if (slateNode.title) {
                text = `![${text}](${slateNode.url} "${slateNode.title}")`;
              } else {
                text = `![${text}](${slateNode.url})`;
              }
              break;
            case 'list-item':
              const listParent = hierarchy.find(type => ['bulleted-list', 'numbered-list'].includes(type));
              let prefix;
              if ('bulleted-list' === listParent) {
                prefix = "* ";
              } else if ('numbered-list' === listParent) {
                prefix = (ind + 1) + ". ";
              }
              const innermost = hierarchy.findIndex(type => 'list-item' === type);
              if (level > 0) {
                if (level === innermost) {
                  if (0 !== ind) {
                    prefix = prefix.replace(/\S/, " ");
                  }
                } else {
                  prefix = "    ";
                }
              }
              text = prefixText(prefix, text);
              break;
            case 'thematic-break':
              text = `\n------------------------------\n`;
              break;
            case 'table-row':
              if (0 === level) {
                if (1 === tableRowNum++) {
                  let delimiterRow = '';
                  for (let i=0; i<numTableCol; ++i) { delimiterRow += '| --- '; }
                  lines.push(delimiterRow);
                }
              }
              break;
            case 'table':
              if (0 === level) {
                tableRowNum = 0;
              }
              break;
          }
        }
        if (text) {
          lines.push(text);
        }
      }
      hierarchy.shift();
      return null;
    } else {
      console.error("neither Element nor Text:", slateNode);
      return null;
    }
  }

  function prefixText(prefix, text) {
    if (text) {
      return text.split('\n').map(line => prefix + line).join('\n');
    } else {
      return null;
    }
  }
}

/* punctuation that might need escaping: \ ` * _ { } [ ] ( ) # + - . ! */
function escapeMarkdown(text) {
  // TODO: write version that doesn't use lookbehind, which is not supported in Safari
  return text;
  // return text.replace(/(?<=([*_]).*)\1|(?<=^\s*)\*(?=\s)|(?<=^\s*\d+)\.(?=\s)|(?<=])\(/gm, "\\$&");
}

export {deserializeMarkdown, serializeMarkdown, escapeMarkdown};
