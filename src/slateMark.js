// slateMark.js - constants & functions to customize Slate for Markdown
// Copyright © 2021-2024 Doug Reeder under the MIT License

import {adHocTextReplacements} from "./util";
import {Element as SlateElement, Text as SlateText} from 'slate';
import {fromMarkdown} from 'mdast-util-from-markdown';
import {gfmTable} from 'micromark-extension-gfm-table';
import {gfmTableFromMarkdown} from 'mdast-util-gfm-table';
import {gfmTaskListItem} from 'micromark-extension-gfm-task-list-item';
import {gfmTaskListItemFromMarkdown} from 'mdast-util-gfm-task-list-item';
import {gfmStrikethrough} from 'micromark-extension-gfm-strikethrough'
import {gfmStrikethroughFromMarkdown} from 'mdast-util-gfm-strikethrough'
import {deserializeHtml, INLINE_ELEMENTS} from "./slateHtml";

function deserializeMarkdown(markdown) {
  const root = fromMarkdown(markdown, {
    extensions: [gfmTable, gfmTaskListItem, gfmStrikethrough()],
    mdastExtensions: [gfmTableFromMarkdown, gfmTaskListItemFromMarkdown, gfmStrikethroughFromMarkdown]
  });
  const definitions = extractDefinitions(root, new Map());
  const isChecklistStack = [];
  return slateNodesFromMdNodes(root.children);

  function slateNodesFromMdNodes(mdNodes, italic = false, bold = false, superscript = false, subscript= false, underline = false, strikethrough = false, deleted = false, inserted = false) {
    const slateNodes = [];
    let tableRowNum = 0;
    for (const mdNode of mdNodes) {
      try {
        if (mdNode.children) {
          let children;
          switch (mdNode.type) {
            case 'list':
              isChecklistStack.push(false);
              /* fallthrough */
            case 'paragraph':
            case 'heading':
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
              if (['blockquote'].includes(mdNode.type) && 1 === children.length && 'paragraph' === children[0].type) {
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
                type: slateType(mdNode, isChecklistStack[isChecklistStack.length-1]),
                children,
              };
              if ('list' === mdNode.type && 'number' === typeof mdNode.start) {
                slateNode.listStart = mdNode.start;
              }
              slateNodes.push(slateNode, ...hoistedChildren);
              break;
            case 'listItem':
              children = slateNodesFromMdNodes(mdNode.children, false, bold);
              if (1 === children.length && 'paragraph' === children[0].type) {
                children = children[0].children;
              }
              const slateNodeItem = {
                type: 'list-item',
                children,
              };
              if ('boolean' === typeof mdNode.checked) {
                slateNodeItem.checked = mdNode.checked;
                isChecklistStack[isChecklistStack.length-1] = true;
              } else if (isChecklistStack[isChecklistStack.length-1]) {
                slateNodeItem.checked = false;
              }
              slateNodes.push(slateNodeItem);
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
                  const sNodes = deserializeHtml(mdNode.value);
                  slateNodes.push(...sNodes);
              }
              break;
            default:
              console.error(`Unknown Markdown leaf:`, mdNode);
          }
        }
      } catch (err) {
        console.error(`while processing Markdown ${mdNode}:`, err);
      } finally {
        if ('list' === mdNode.type) {
          isChecklistStack.pop();
        }
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

function slateType(mdNode, isChecklist) {
  switch (mdNode.type) {
    case 'heading':
      switch (mdNode.depth) {
        case 1:
          return 'heading-one';
        case 2:
          return 'heading-two';
        default:
          return 'heading-three';
      }
    case 'paragraph':
      return 'paragraph';
    case 'list':
      if (mdNode.ordered) {
        return isChecklist ? 'sequence-list' : 'numbered-list';
      } else {
        return isChecklist ? 'task-list' : 'bulleted-list';
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

function serializeMarkdown(slateNodes, replaceDataUrlImgs) {
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
      if (INLINE_ELEMENTS.includes(slateNode?.type)) {
        const childrenText = slateNode.children.map(serializeSlateNode).join('');
        const titleMarkup = slateNode.title ? ` "${escapeMarkdown(slateNode.title)}"` : '';
        return `[${childrenText}](${escapeMarkdown(slateNode.url)}${titleMarkup})`;
      } else {   // block
        switch (slateNode.type) {   // before children
          case 'bulleted-list':
          case 'numbered-list':
          case 'task-list':
          case 'sequence-list':
            if (hierarchy.some(container => 'list-item' === container.type)) {
              break;
            }
            /* fallthrough */
          case 'heading-one':
          case 'heading-two':
          case 'heading-three':
          case 'paragraph':
          case 'table':
          case 'quote':
            if (ind > 0) {
              lines.push(hierarchy.reduce((acc, curr) => 'quote' === curr.type ? acc + "> " : acc, ""));
            }
            break;
          case 'code':
            inCodeBlock = true;
            break;
          default:
        }
        hierarchy.push({type: slateNode.type, ind, checked: slateNode.checked});
        let text = slateNode.children.map(serializeSlateNode).join('');
        switch (slateNode.type) {   // after children
          case 'code':
            text = '```\n' + text + '\n```';
            inCodeBlock = false;
            break;
          case 'image':
            if (replaceDataUrlImgs && /^data:/.test(slateNode.url)) {
              if (!text?.trim()) {
                text = slateNode.title?.trim().length > 0 ? slateNode.title : "«graphic»";
              }
              // else just pass through the children, which are the alt text
            } else {
              if (slateNode.title) {
                text = `![${text}](${slateNode.url} "${slateNode.title}")`;
              } else {
                text = `![${text}](${slateNode.url})`;
              }
            }
            break;
          case 'thematic-break':
            text = `\n- - - - - - - - - - - - - - - `;
            break;
          case 'table-row':
            if (1 === tableRowNum++) {
              let delimiterRow = '';
              for (let i=0; i<numTableCol; ++i) { delimiterRow += '| --- '; }
              lines.push(indentText(...assemblePrefix(hierarchy, ind), delimiterRow));
            }
            break;
          case 'table':
            tableRowNum = 0;
            numTableCol = 0;
            break;
          default:
        }
        if (text) {
          lines.push(indentText(...assemblePrefix(hierarchy, ind), text));
        }
      }
      hierarchy.pop();
      return null;
    } else {
      console.error("neither Element nor Text:", slateNode);
      return null;
    }
  }

  function assemblePrefix(hierarchy, indChild) {
    let indent = "";
    let prefix = "";
    for (let level=0; level<hierarchy.length; ++level) {
      const ancestor = hierarchy[level];
      switch(ancestor.type) {
        case 'heading-one':
          prefix += "# ";
          break;
        case 'heading-two':
          prefix += "## ";
          break;
        case 'heading-three':
          prefix += "### ";
          break;
        case 'list-item':
          const hasChildItem = hierarchy.slice(level+1).some(container => 'list-item' === container.type);
          const isContinuation = level < hierarchy.length - 1 && indChild > 0;
          if (hasChildItem || isContinuation) {
            prefix += "    ";
          } else {
            const listParent = hierarchy.findLast(container => ['bulleted-list', 'numbered-list', 'task-list', 'sequence-list'].includes(container.type))
            if (['bulleted-list', 'task-list'].includes(listParent.type)) {
              prefix += "* ";
            } else {
              prefix += (ancestor.ind + 1) + ". ";
            }
            if ('boolean' === typeof ancestor.checked) {
              prefix += `[${ancestor.checked ? "x" : " "}] `;
            }
          }
          break;
        case 'quote':
          indent += "> ";
          break;
        default:
      }
    }
    return [indent, prefix];
  }

  function indentText(indent, prefix, text) {
    if (text) {
      const prefix2 = prefix.length < SPACES.length ? SPACES[prefix.length] : "      ";
      const lines = text.split('\n');
      const firstLine = lines.shift();
      const indentedLines = [indent + prefix + firstLine, ...(lines.map(line => indent + prefix2 + line))];
      return indentedLines.join("\n");
    } else {
      return null;
    }
  }
}

const SPACES = ["", " ", "  ", "   ", "    ", "     "];

/* punctuation that might need escaping: \ ` * _ { } [ ] ( ) # + - . ! */
function escapeMarkdown(text) {
  // TODO: write version that doesn't use lookbehind, which is not supported in Safari
  return text;
  // return text.replace(/(?<=([*_]).*)\1|(?<=^\s*)\*(?=\s)|(?<=^\s*\d+)\.(?=\s)|(?<=])\(/gm, "\\$&");
}

export {deserializeMarkdown, serializeMarkdown, escapeMarkdown};
