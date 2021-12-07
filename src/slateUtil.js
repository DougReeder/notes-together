// slateUtil.js - utility functions for Slate editor
// © 2021 Doug Reeder under the MIT License

import {Editor, Element as SlateElement, Node as SlateNode, Transforms} from 'slate';
import {deserializeMarkdown, serializeMarkdown} from "./slateMark";
import {createMemoryNote} from "./Note";
import {upsertNote} from "./storage";
import {HtmlRenderer, Parser} from "commonmark";
import encodeEntities from "./util/encodeEntities";


function getRelevantBlockType(editor) {
  const selection = editor.selection;
  if (selection == null) {
    return 'n/a';
  }

  const topLevelBlockNodesInSelection = Editor.nodes(editor, {
    at: editor.selection,
    mode: "highest",
    match: (n) => Editor.isBlock(editor, n),
  });

  let blockType = 'n/a';
  let nodeEntry = topLevelBlockNodesInSelection.next();
  while (!nodeEntry.done) {
    const [node] = nodeEntry.value;
    if ('n/a' === blockType) {
      blockType = node.type || 'n/a';
      // console.log(`relevant block type ${node.type}`)
    } else if (blockType !== node.type) {
      // console.log(`multiple block types ${node.type}`)
      if (node.type === 'image') {
        return 'image';   // here meaning 'multiple including image'
      } else {
        return "multiple";
      }
    }

    nodeEntry = topLevelBlockNodesInSelection.next();
  }

  return blockType;
}


function isBlockActive(editor, format) {
  const [match] = Editor.nodes(editor, {
    match: n =>
        !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === format,
  });
  return Boolean(match);
}


const LIST_TYPES = ['numbered-list', 'bulleted-list'];

function changeBlockType(editor, type) {
  const isActive = isBlockActive(editor, type);
  const isList = LIST_TYPES.includes(type);

  Transforms.unwrapNodes(editor, {
    match: n =>
        LIST_TYPES.includes(
            !Editor.isEditor(n) && SlateElement.isElement(n) && n.type
        ),
    split: true,
  });
  const newProperties = {
    type: isActive ? 'paragraph' : isList ? 'list-item' : type,
  }
  Transforms.setNodes(editor, newProperties);

  if (!isActive && isList) {
    const block = { type: type, children: [] }
    Transforms.wrapNodes(editor, block);
  }
}

async function changeContentType(editor, oldSubtype, newSubtype, noteId, noteDate) {
  let content;
  if (!newSubtype || newSubtype.startsWith('plain')) {
    if (oldSubtype?.startsWith('markdown')) {   // convert to rich text in editor
      const text = editor.children.map(node => SlateNode.string(node)).join('\n');
      const slateNodes = deserializeMarkdown(text);
      Transforms.select(editor, []);
      Editor.insertFragment(editor, slateNodes);
    }

    const imageElmnts = Editor.nodes(editor, {
      at: [],
      match: (node, path) => 'image' === node.type,
    });
    for (const nodeEntry of imageElmnts) {
      const altText = SlateNode.string(nodeEntry[0]) || nodeEntry[0].title || /\/([^/]+)$/.exec(nodeEntry[0].url)?.[1] || "☹︎";
      Transforms.select(editor, nodeEntry[1]);
      Editor.insertFragment(editor, [{text: altText}]);
    }

    Transforms.unwrapNodes(editor,
        {
          at: [],
          match: node => !Editor.isEditor(node) && node.children?.every(child => Editor.isBlock(editor, child)),
          mode: "all",
        }
    );
    content = editor.children.map(node => SlateNode.string(node)).join('\n');
  } else if (newSubtype.startsWith('markdown')) {
    if (oldSubtype?.startsWith('html')) {
      content = serializeMarkdown(editor.children);
    } else {   // includes Markdown-in-plain -> Markdown
      content = editor.children.map(node => SlateNode.string(node)).join('\n');
    }
  } else if (newSubtype.startsWith('html')) {
    if (oldSubtype?.startsWith('markdown')) {
      const text = editor.children.map(node => SlateNode.string(node)).join('\n');
      const reader = new Parser();
      const writer = new HtmlRenderer();
      const mdDoc = reader.parse(text); // mdDoc is a 'Node' tree
      content = writer.render(mdDoc); // result is a String
    } else {   // plain text lines -> HTML paragraphs
      content = editor.children.map(node => `<p>${encodeEntities(SlateNode.string(node))}</p>`).join('');
    }
  }
  console.log(`${noteId} ${oldSubtype} -> ${newSubtype}\n${content}`)
  const newNote = createMemoryNote(noteId, content, noteDate, 'text/' + newSubtype);
  await upsertNote(newNote);
  // no initiator, as Details doesn't have this yet.
}

export {getRelevantBlockType, isBlockActive, changeBlockType, changeContentType};
