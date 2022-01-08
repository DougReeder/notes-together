// slateMark.js - constants & functions to customize Slate for Markdown
// Copyright © 2021-2022 Doug Reeder under the MIT License

import {adHocTextReplacements} from "./util";
import {Text} from 'slate';
import {Parser} from "commonmark";

const markdownReader = new Parser({smart: true});

function deserializeMarkdown(markdown) {
  const mdDoc = markdownReader.parse(markdown);

  const slateNodeStack = [[]];
  let italic = false, bold = false;
  let listDepth = 0;
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
          case 'paragraph':   // TODO: normalize such paragraphs away, rather than this
            if (listDepth > 0) {
              break;
            }
            // falls through
          case 'heading':
          case 'list':
          case 'item':
          case 'block_quote':
            // console.log(event.entering ? '>' : '<', mdNode.type, mdNode.level, mdNode.listType);
            if (event.entering) {
              slateNodeStack.push([])
              if ('list' === mdNode.type) {
                ++listDepth
              }
            } else {
              if ('list' === mdNode.type) {
                --listDepth
              }
              const children = slateNodeStack.pop();
              if (0 === children.length) {
                children.push(textNode("", italic, bold));
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
              slateNodeStack[slateNodeStack.length-1].push({
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

function serializeMarkdown(slateNodes) {
  let inCodeBlock = false;
  const lists = [];
  return serializeSlateNodes(slateNodes);

  function serializeSlateNodes(slateNodes) {
    return slateNodes.map((slateNode, i) => {
      if (Text.isText(slateNode)) {
        if (inCodeBlock) {
          return slateNode.text;
        } else if (slateNode.code) {
          return `\`${slateNode.text}\``;
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
      }

      switch (slateNode.type) {   // eslint-disable-line default-case
        case 'bulleted-list':
          lists.push(slateNode)
          break;
        case 'numbered-list':
          lists.push(slateNode)
          break;
        case 'code':
          inCodeBlock = true;
          break;
      }

      const childrenText = serializeSlateNodes(slateNode.children);

      let str = "";   // some types don't use this
      if (i > 0) {
        str += "\n";
        if ('list-item' !== slateNode.type) {
          for (let j = 0; j < lists.length; ++j) {
            str += '    ';
          }
        }
      }

      switch (slateNode.type) {
        default:
        case 'paragraph':
          str += childrenText;
          break;
        case 'quote':
          str += `> ${childrenText}`;
          break;
        case 'heading-one':
          str += `# ${escapeMarkdown(childrenText)}`;
          break;
        case 'heading-two':
          str += `## ${escapeMarkdown(childrenText)}`;
          break;
        case 'heading-three':
          str += `### ${escapeMarkdown(childrenText)}`;
          break;
        case 'heading-four':
          str += `##### ${escapeMarkdown(childrenText)}`;
          break;
        case 'heading-five':
          str += `##### ${escapeMarkdown(childrenText)}`;
          break;
        case 'heading-six':
          str += `###### ${escapeMarkdown(childrenText)}`;
          break;
        case 'thematic-break':
          return `\n------------------------------\n`;

        case 'code':
          inCodeBlock = false;
          str += '```\n' + childrenText + '\n```';
          break;

        case 'bulleted-list':
        case 'numbered-list':
          lists.pop();
          str += `${childrenText}`
          break;
        case 'list-item':
          for (let j=1; j<lists.length; ++j) {
            str += '    ';
          }
          if ('numbered-list' === lists[lists.length-1].type) {
            str += `1. ${childrenText}`
          } else {
            str += `* ${childrenText}`
          }
          break;

        case 'link':
          const titleMarkup = slateNode.title ? ` "${escapeMarkdown(slateNode.title)}"` : '';
          return `[${childrenText}](${escapeMarkdown(slateNode.url)}${titleMarkup})`;
        case 'image':
          const titleMarkup2 = slateNode.title ? ` "${escapeMarkdown(slateNode.title)}"` : '';
          return `![${childrenText}](${escapeMarkdown(slateNode.url)}${titleMarkup2})`;
      }
      if (['paragraph', 'bulleted-list', 'numbered-list'].includes(slateNode.type) && i < slateNodes.length-1) {
        str += "\n";
      }
      return str;
    }).join("");
  }
}

/* punctuation that might need escaping: \ ` * _ { } [ ] ( ) # + - . ! */
function escapeMarkdown(text) {
  // TODO: write version that doesn't use lookbehind, which is not supported in Safari
  return text;
  // return text.replace(/(?<=([*_]).*)\1|(?<=^\s*)\*(?=\s)|(?<=^\s*\d+)\.(?=\s)|(?<=])\(/gm, "\\$&");
}

export {deserializeMarkdown, serializeMarkdown, escapeMarkdown};
