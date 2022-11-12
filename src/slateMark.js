// slateMark.js - constants & functions to customize Slate for Markdown
// Copyright © 2021-2022 Doug Reeder under the MIT License

import {adHocTextReplacements} from "./util";
import {Element as SlateElement, Text as SlateText} from 'slate';
import {Parser} from "commonmark";

const markdownReader = new Parser({smart: true});

function deserializeMarkdown(markdown) {
  const mdDoc = markdownReader.parse(markdown);

  const slateNodeStack = [[]];
  let italic = false, bold = false;
  const walker = mdDoc.walker();
  let event;
  while ((event = walker.next())) {
    try {
      const mdNode = event.node;
      if (mdNode.isContainer) {
        switch (mdNode.type) {
          case 'document':
            break;   // discard

          default:
            console.error(event.entering ? '>' : '<', mdNode.type, mdNode.literal);
            // falls through
          case 'paragraph':
          case 'heading':
          case 'list':
          case 'item':
          case 'block_quote':
            // console.log(event.entering ? '>' : '<', mdNode.type, mdNode.level, mdNode.listType);
            if (event.entering) {
              slateNodeStack.push([])
            } else {
              const children = slateNodeStack.pop();
              if (0 === children.length) {
                break;   // the children have been moved out, so doesn't instantiate this
              }
              const slateNode = {
                type: slateType(mdNode),
                children,
              };
              if ('list' === mdNode.type && mdNode.listStart) {
                slateNode.listStart = mdNode.listStart;
              }
              slateNodeStack[slateNodeStack.length-1].push(slateNode);
            }
            break;

          case 'link':
            // console.log(event.entering ? '>' : '<', mdNode.type, mdNode.title, mdNode.destination);
            if (event.entering) {
              slateNodeStack.push([])
            } else {
              const children = slateNodeStack.pop();
              if (0 === children.length) {
                children.push(textNode("", italic, bold));
              }
              slateNodeStack[slateNodeStack.length-1].push({
                type: 'link',
                url: mdNode.destination,
                title: mdNode.title || "",
                children,
              });
            }
            break;
          case 'image':
            // console.log(event.entering ? '>' : '<', mdNode.type, mdNode.title, mdNode.destination);
            if (event.entering) {
              slateNodeStack.push([])
            } else {
              const children = slateNodeStack.pop();
              if (0 === children.length) {
                children.push(textNode("", italic, bold));
              }
              slateNodeStack[slateNodeStack.length-2].push({
                type: 'image',
                url: mdNode.destination,
                title: mdNode.title || "",
                children,
              });
            }
            break;

          case 'emph':
            // console.log(event.entering ? '>' : '<', mdNode.type);
            italic = event.entering;
            break;
          case 'strong':
            // console.log(event.entering ? '>' : '<', mdNode.type);
            bold = event.entering;
            break;
        }
      } else {   // not container
        switch (mdNode.type) {
          case 'text':
            let text = adHocTextReplacements(mdNode.literal);
            // console.log(mdNode.type, text, italic, bold);
            slateNodeStack[slateNodeStack.length-1].push(textNode(text, italic, bold));
            break;

          case 'softbreak':
            // console.log(mdNode.type, italic, bold);
            slateNodeStack[slateNodeStack.length-1].push(textNode(" ", italic, bold));
            break;

          case 'linebreak':
            // console.log(mdNode.type, italic, bold);
            slateNodeStack[slateNodeStack.length-1].push(textNode("\n", italic, bold));
            break;

          case 'code':
            // console.log(mdNode.type, mdNode.literal);
            slateNodeStack[slateNodeStack.length-1].push({text: mdNode.literal, code: true});
            break;

          case 'code_block':
            const blockContent = mdNode.literal?.trimRight();
            // console.log(mdNode.type, blockContent);
            slateNodeStack[slateNodeStack.length-1].push({
              type: 'code',
              children: [{text: blockContent}],
            });
            // mdNode.info
            break;

          case 'thematic_break':
            // console.log(mdNode.type);
            slateNodeStack[slateNodeStack.length-1].push({
              type: 'thematic-break',
              children: [{text: ""}],
            });
            break;

          case 'html_inline':
          case 'html_block':
            // These special cases could be removed.
            switch (mdNode.literal) {
              case '<br />':
              case '<p>':
              case '</p>':
              case '<div>':
              case '</div>':
              case '<blockquote>':
              case '</blockquote>':
                slateNodeStack[slateNodeStack.length-1].push(textNode("\n", italic, bold));
                break;
              case '<i>':
              case '<em>':
                italic = true;
                break;
              case '</i>':
              case '</em>':
                italic = false;
                break;
              case '<b>':
              case '<strong>':
                bold = true;
                break;
              case '</b>':
              case '</strong>':
                bold = false;
                break;
              default:
                const parsed = new DOMParser().parseFromString(mdNode.literal, 'text/html');
                const text = parsed.documentElement.textContent.trim();
                if (text) {
                  slateNodeStack[slateNodeStack.length-1].push({children: [textNode(text, italic, bold)]});
                }
            }
            break;

          default:
            console.error("unknown MD:", mdNode?.type, mdNode?.literal);
        }
      }
    } catch (err) {
      console.error("while walking MD:", err);
    }
  }

  return slateNodeStack[0];
}

function slateType(mdNode) {
  switch (mdNode.type) {
    case 'heading':
      switch (mdNode.level) {
        case 1:
          return 'heading-one';
        case 2:
          return 'heading-two';
        case 3:
          return 'heading-three';
        case 4:
          return 'heading-four';
        case 5:
          return 'heading-five';
        default:
          return 'heading-six';
      }
    case 'paragraph':
      return 'paragraph';
    case 'list':
      if ('bullet' === mdNode.listType) {
        return 'bulleted-list';
      } else {
        return 'numbered-list'
      }
    case 'item':
      return 'list-item';
    case 'block_quote':
      return 'quote';

    default:
      console.error("unknown MD container node:", mdNode);
      return 'paragraph';
  }
}

function textNode(text, italic, bold) {
  if (italic) {
    if (bold) {
      return {text, italic, bold};
    } else {
      return {text, italic};
    }
  } else {
    if (bold) {
      return {text, bold};
    } else {
      return {text};
    }
  }
}

function serializeMarkdown(editor, slateNodes) {
  const hierarchy = [];
  let inCodeBlock = false;
  const lines = [];

  const text = slateNodes.map(serializeSlateNode).join('');
  if (text) {
    lines.push(text);
  }
  return lines.join("\n");

  /** blocks are written to lines[], but text is returned */
  function serializeSlateNode(slateNode, ind) {
    if ('table-cell' === slateNode.type) {
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
                text = text + "|";
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
