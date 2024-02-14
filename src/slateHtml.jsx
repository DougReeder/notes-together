// slateHtml.js — React elements to customize Slate for HTML/JSX
// Copyright © 2021–2024 Doug Reeder under the MIT License

import {useSelected, useFocused, useSlateStatic, useReadOnly, ReactEditor} from 'slate-react';
import {toggleCheckListItem} from "./slateUtil";
import PropTypes from "prop-types";


const RenderingElement = props => {
  const { attributes, children, element } = props

  switch (element.type) {
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
    case 'task-list':
      return <ul className="checklist" {...attributes}>{children}</ul>
    case 'sequence-list':
      return <ol className="checklist" {...attributes}>{children}</ol>
    case 'heading-one':
      return <h1 {...attributes}>{children}</h1>
    case 'heading-two':
      return <h2 {...attributes}>{children}</h2>
    case 'heading-three':
      return <h3 {...attributes}>{children}</h3>
    case 'list-item':
      if ('checked' in element) {
        return <CheckListItemElement {...props} />
      } else {
        return <li {...attributes}>{children}</li>
      }
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
    case 'table':
      return (
          <table>
            <tbody {...attributes}>{children}</tbody>
          </table>
      )
    case 'table-row':
      return <tr {...attributes}>{children}</tr>
    case 'table-cell':
      return <td {...attributes}>{children}</td>
    default:
      return children;
  }
}

RenderingElement.propTypes = {
  attributes: PropTypes.shape({
    'data-slate-node': PropTypes.string.isRequired,
    'data-slate-inline': PropTypes.bool,
    'data-slate-void': PropTypes.bool,
    dir: PropTypes.string,
    ref: PropTypes.any,
  }),
  children: PropTypes.any,
  element: PropTypes.object,
};

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

ImageElement.propTypes = {
  attributes: PropTypes.shape({
    'data-slate-node': PropTypes.string.isRequired,
    'data-slate-inline': PropTypes.bool,
    'data-slate-void': PropTypes.bool,
    dir: PropTypes.string,
    ref: PropTypes.any,
  }),
  children: PropTypes.any,
  element: PropTypes.object,
};

const CheckListItemElement = ({ attributes, children, element }) => {
  const editor = useSlateStatic();
  const readOnly = useReadOnly();
  const { checked } = element;
  return (
    <li
      className="checkListItem"
      {...attributes}
    >
      <span contentEditable={false}>
        <input
          type="checkbox"
          checked={checked}
          onChange={evt => {
            evt.stopPropagation();
            ReactEditor.blur(editor);

            const path = ReactEditor.findPath(editor, element);
            toggleCheckListItem(editor, path, evt.target.checked);
          }}
        />
      </span>
      <div contentEditable={!readOnly} suppressContentEditableWarning >
        {children}
      </div>
    </li>
  )
}
CheckListItemElement.propTypes = {
  attributes: PropTypes.shape({
    'data-slate-node': PropTypes.string.isRequired,
    'data-slate-inline': PropTypes.bool,
    'data-slate-void': PropTypes.bool,
    dir: PropTypes.string,
    ref: PropTypes.any,
  }),
  children: PropTypes.any,
  element: PropTypes.object,
};

CheckListItemElement.propTypes = {
  attributes: PropTypes.shape({
    'data-slate-node': PropTypes.string.isRequired,
    'data-slate-inline': PropTypes.bool,
    'data-slate-void': PropTypes.bool,
    dir: PropTypes.string,
    ref: PropTypes.any,
  }),
  children: PropTypes.any,
  element: PropTypes.object,
};

const Leaf = ({ attributes, children, leaf }) => {
  let markup = <span {...attributes}
                     {...(leaf.highlight && {'className': 'highlight'})}
  >
    {children}
  </span>

  if (leaf.bold) {
    markup = <strong>{markup}</strong>
  }

  if (leaf.code) {
    markup = <code>{markup}</code>
  }

  if (leaf.italic) {
    markup = <em>{markup}</em>
  }

  if (leaf.superscript) {
    markup = <sup>{markup}</sup>
  }

  if (leaf.subscript) {
    markup = <sub>{markup}</sub>
  }

  if (leaf.underline) {
    markup = <u>{markup}</u>
  }

  if (leaf.strikethrough) {
    markup = <s>{markup}</s>
  }

  if (leaf.deleted) {
    markup = <del>{markup}</del>
  }

  if (leaf.inserted) {
    markup = <ins>{markup}</ins>
  }

  return markup;
}

Leaf.propTypes = {
  attributes: PropTypes.object,
  children: PropTypes.any,
  leaf: PropTypes.object,
};


export {RenderingElement, ImageElement, Leaf};
