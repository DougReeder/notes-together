import {v4 as uuidv4} from "uuid";
import {NodeNote, SerializedNote} from './Note';
import {
  fireEvent,
  render,
  screen,
  waitFor, within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import {getNote, upsertNote} from './storage';
import Detail from "./Detail";
import generateTestId from "./util/generateTestId.js";

vi.mock('./storage.js', async () => {
  const storage = await vi.importActual('./storage.js')

  return { ...storage, getNote: vi.fn(), upsertNote: vi.fn() }
})
window.postMessage = vitest.fn();

global.queueMicrotask = function (f) {
  setTimeout(f, 0);
}

describe("Details component", () => {
  it("always has back button", async () => {
    const setMustShowPanel = vitest.fn();
    render(<Detail noteId={null} setMustShowPanel={setMustShowPanel}></Detail>);
    const backBtn = await screen.findByRole('button', {name: "Out to list panel"});
    expect(backBtn).toBeInTheDocument();

    await userEvent.click(backBtn);
    expect(setMustShowPanel).toHaveBeenCalledWith('LIST', expect.anything());
  });

  it('renders HTML content of note', async () => {
    const noteId = uuidv4();
    const noteText = "<h2>A Relic</h2><li>YESTERDAY I found in a cupboard";
    const noteDate = new Date(2021, 9, 31);
    getNote.mockResolvedValue(Promise.resolve(new SerializedNote(noteId, 'text/html;hint=SEMANTIC', '', noteText, noteDate)));

    render(<Detail noteId={noteId}></Detail>);
    const textbox = await screen.findByRole('textbox');
    expect(textbox).toBeVisible();
    expect(textbox.textContent).toEqual("A RelicYESTERDAY I found in a cupboard");
    expect(textbox).not.toHaveFocus();
    expect(screen.getByRole('heading', {name: "A Relic"})).toBeVisible();
    const item = screen.getByRole('listitem');
    expect(item).toBeVisible();
    expect(item.textContent).toEqual("YESTERDAY I found in a cupboard");

    expect(await screen.getByTitle('Open block type menu')).toBeVisible();
    const backBtn = await screen.findByRole('button', {name: "Out to list panel"});
    expect(backBtn).toBeInTheDocument();
  });

  it('renders Markdown content of note as text', async () => {
    const noteId = uuidv4();
    const noteText = "ballistic phonon transport\n# Modern Physics";
    const noteDate = new Date(2021, 9, 31);
    getNote.mockResolvedValue(Promise.resolve(new SerializedNote(noteId, 'text/markdown;hint=COMMONMARK', '', noteText, noteDate)));

    render(<Detail noteId={noteId}></Detail>);
    const textbox = await screen.findByRole('textbox');
    expect(textbox).toBeVisible();
    expect(textbox.textContent).toEqual("ballistic phonon transport# Modern Physics");
    expect(textbox).not.toHaveFocus();
    expect(screen.getByText('ballistic phonon transport')).toBeVisible();
    expect(screen.getByText('# Modern Physics')).toBeVisible();

    // expect(await screen.queryByTitle('Block type')).not.toBeInTheDocument();
    const backBtn = await screen.findByRole('button', {name: "Out to list panel"});
    expect(backBtn).toBeInTheDocument();
  });

  it('renders error if note not text type', async () => {
    console.error = vitest.fn();
    const noteId = uuidv4();
    const initialText = "";
    const noteDate = new Date(1980, 11, 20);
    getNote.mockResolvedValue(Promise.resolve(new SerializedNote(noteId, 'application/example', '', initialText, noteDate)));

    render(<Detail noteId={noteId}></Detail>);

    const textEl = await screen.findByText(/Can't handle “application\/example” note/);
    expect(textEl).toBeInTheDocument();
    expect(textEl).not.toHaveFocus();
    expect(await screen.queryByTitle('Block type')).not.toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching("while replacing note"), expect.any(Error));
  });

  it("clears text & date when noteId set to null", async () => {
    const noteId = uuidv4();
    const noteText = "Dogcatcher Emeritus";
    const noteDate = new Date(2021, 3, 15);
    getNote.mockResolvedValue(Promise.resolve(new SerializedNote(noteId, undefined, '', noteText, noteDate)));

    const {findByText, rerender} = render(<Detail noteId={noteId}></Detail>);
    const textEl = await findByText(noteText);
    expect(textEl).toBeInTheDocument();
    expect(textEl).not.toHaveFocus();

    rerender(<Detail noteId={null}></Detail>);
    // await waitForElementToBeRemoved(() => queryByText(noteText));
    expect(textEl).not.toHaveFocus();
    expect(textEl).not.toBeInTheDocument();
    expect(await screen.queryByTitle('Block type')).not.toBeInTheDocument();
  });

// it('sets focus if requested', async () => {
//   const noteId = uuidv4();
//   const noteText = "ambivalent"
//   const noteDate = new Date(2020, 6, 5);
//   getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, noteText, noteDate)));
//   const focusOnLoadCB = vitest.fn();
//
//   await act(async () => {
//     render(<Detail noteId={noteId} focusOnLoadCB={focusOnLoadCB}></Detail>);
//   });
//   const textbox = await screen.findByRole('textbox');
//   expect(textbox).toBeVisible();
//   expect(textbox.textContent).toEqual(noteText);
//   expect(textbox).toHaveFocus();
//   expect(focusOnLoadCB.mock.calls.length).toBe(1);
// });

it('renders error if note missing', async () => {
  const noteId = uuidv4();
  getNote.mockResolvedValue(Promise.resolve(undefined));

  render(<Detail noteId={noteId}></Detail>);

  const textEl = await screen.findByText(/no note with id=/);
  expect(textEl).toBeInTheDocument();
  expect(textEl).not.toHaveFocus();
  expect(await screen.queryByTitle('Block type')).not.toBeInTheDocument();
});

// jsdom doesn't set origin correctly: https://github.com/jsdom/jsdom/issues/2745
// test('renders updated text on window message', async () => {
//   const noteId = 19;
//   const noteText = "The plot was okay."
//   getNote.mockResolvedValue(Promise.resolve({id: noteId, content: noteText}));
//
//   await act(async () => {
//     const {findByText} = render(<Detail noteId={noteId}></Detail>);
//     const textEl = await findByText(noteText);
//     expect(textEl).toBeInTheDocument();
//     expect(textEl).not.toHaveFocus();
//   });
//
//   const updatedText = "The plot was okay; characterization was superb!";
//   const notesChanged = {};
//   notesChanged[noteId] = createMemoryNote(noteId, updatedText);
//   window.postMessage({kind: 'NOTE_CHANGE', notesChanged, notesDeleted: {}}, window?.location?.origin);
//   const againTextEl = await screen.findByText(updatedText);
//   expect(againTextEl).not.toHaveFocus();
// });

  it("edits & saves HTML on date change if retrieved as HTML", async () => {
    const user = userEvent.setup();

    const noteId = generateTestId();
    const initialText = `  <p>  Proin sagittis quam sit amet eros dictum  </p>  `;
    const oldDate = new Date(1979, 7, 22);
    getNote.mockResolvedValue(Promise.resolve(new SerializedNote(noteId, 'text/html;hint=SEMANTIC', '', initialText, oldDate)));
    render(<Detail noteId={noteId}></Detail>);

    expect(await screen.findByRole('textbox')).toBeVisible();
    expect(screen.getByRole('button', {name: "(n/a)"})).toBeVisible();   // block type

    await user.click(await screen.findByRole('button', {name: "1979"}));

    let dialog = await screen.findByRole('dialog');
    let input = within(dialog).getByDisplayValue('1979-08-22');
    const newDateStr = "2005-10-30";

    fireEvent.change(input, { target: { value: newDateStr } });
    await user.click(await within(dialog).findByRole('button', {name: "Set"}));

    expect(upsertNote).toHaveBeenCalledTimes(1);
    const nodes = [{type: 'paragraph', noteSubtype: "html;hint=SEMANTIC", children: [{text: " Proin sagittis quam sit amet eros dictum "}]}];
    const partialNote = new NodeNote(noteId, 'html;hint=SEMANTIC', nodes,
      new Date(2005, 10-1, 30,
        oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds(), oldDate.getMilliseconds()), false);
    expect(upsertNote).toHaveBeenLastCalledWith(partialNote, 'DETAIL');

    await user.click(await screen.findByRole('button', {name: "2005"}));
    dialog = await screen.findByRole('dialog');
    input = within(dialog).getByDisplayValue(newDateStr);

    fireEvent.change(input, { target: { value: "2005-12-01" } });
    await user.click(await within(dialog).findByRole('button', {name: "Set"}));

    expect(upsertNote).toHaveBeenCalledTimes(2);
    const updatedNote = new NodeNote(noteId, 'html;hint=SEMANTIC', nodes,
      new Date(2005, 12-1, 1,
        oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds(), oldDate.getMilliseconds()), false);
    expect(upsertNote).toHaveBeenLastCalledWith(updatedNote, 'DETAIL');
  });

  it.skip("edits & saves HTML if retrieved as SVG", async () => {
    const noteId = uuidv4();
    const initialText = `<svg version="1.1" width="300" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="red" />
        </svg>`;
    const noteDate = new Date(1976, 6, 4);
    getNote.mockResolvedValue(Promise.resolve(new SerializedNote(noteId, 'image/svg+xml', '', initialText, noteDate)));
    render(<Detail noteId={noteId}></Detail>);

    expect(await screen.findByRole('textbox')).toBeVisible();
    expect(screen.getByRole('button', {name: "(n/a)"})).toBeVisible();

    await userEvent.click(screen.getByRole('button', {name: "Open Editor menu"}));
    await userEvent.click(screen.getByRole('menuitem', {name: "Lock note"}));
    expect(upsertNote).toHaveBeenCalledTimes(1);
    const partialNote = {id: noteId, mimeType: "text/html;hint=SEMANTIC", title: expect.any(String), content: expect.any(String), date: noteDate, isLocked: true, wordArr: []};
    expect(upsertNote).toHaveBeenLastCalledWith(partialNote, 'DETAIL');
  });

  it("edits & saves HTML if retrieved as MathML", async () => {
    const noteId = generateTestId();
    const initialText = `  <math>
    <mtable columnalign="right center left">
      <mtr>
        <mtd>
          <msup>
            <mrow>
              <mo>( </mo>
              <mi>a </mi>
              <mo>+ </mo>
              <mi>b </mi>
              <mo>) </mo>
            </mrow>
            <mn>2 </mn>
          </msup>
        </mtd>
        <mtd>
          <mo>= </mo>
        </mtd>
        <mtd>
          <msup>
            <mi>c </mi>
            <mn>2</mn>
          </msup>
          <mo>+ </mo>
          <mn>4 </mn>
          <mo>⋅ </mo>
          <mo>(</mo>
          <mfrac>
            <mn>1 </mn>
            <mn>2 </mn>
          </mfrac>
          <mi>a </mi>
          <mi>b </mi>
          <mo>)</mo>
        </mtd>
      </mtr>`;
    const noteDate = new Date(2012, 2, 27);
    getNote.mockResolvedValue(Promise.resolve(new SerializedNote(noteId, 'application/mathml+xml', '', initialText, noteDate)));
    render(<Detail noteId={noteId}></Detail>);

    expect(await screen.findByRole('textbox')).toBeVisible();
    expect(screen.queryByRole('button', {name: "Open text style menu"})).toBeVisible();

    await userEvent.click(screen.getByRole('button', {name: "Open Editor menu"}));
    await userEvent.click(screen.getByRole('menuitem', {name: "Lock note"}));
    expect(upsertNote).toHaveBeenCalledTimes(1);
    const nodes = [
      {text: "      (  a  +  b  )   2     =     c  2  +  4  ⋅  (  1  2   a  b  )  ", noteSubtype: "html;hint=SEMANTIC"}
    ]
    const partialNote = new NodeNote(noteId, 'html;hint=SEMANTIC', nodes, noteDate, true);
    expect(upsertNote).toHaveBeenLastCalledWith(partialNote, 'DETAIL');
  });

  it("edits & saves plain text if retrieved as plain text", async () => {
    const noteId = uuidv4();
    const initialText = "Goodbye, Lenin";
    const noteDate = new Date(1980, 11, 20);
    getNote.mockResolvedValue(Promise.resolve(new SerializedNote(noteId, 'text/plain', '', initialText, noteDate)));
    render(<Detail noteId={noteId}></Detail>);

    const textbox = await screen.findByRole('textbox');
    expect(screen.queryByRole('button', {name: "(n/a)"})).toBeFalsy();
    const span = await screen.findByText(/Goodbye, Lenin/);
    await userEvent.click(span);
    expect(textbox).toHaveFocus();

    await userEvent.click(screen.getByRole('button', {name: "Open Editor menu"}));
    await userEvent.click(screen.getByRole('menuitem', {name: "Lock note"}));

    expect(upsertNote).toHaveBeenCalledTimes(1);
    const nodes = [{type: 'paragraph', noteSubtype: 'plain', children: [{text: "Goodbye, Lenin"}]}];
    const partialNote = new NodeNote(noteId, 'plain', nodes, noteDate, true);
    expect(upsertNote).toHaveBeenLastCalledWith(partialNote, 'DETAIL');
  });

  it("edits as plain text if retrieved without type", async () => {
    const noteId = uuidv4();
    const initialText = "Aloha";
    const noteDate = new Date(1980, 11, 20);
    getNote.mockResolvedValue(Promise.resolve(new SerializedNote(noteId, undefined, '', initialText, noteDate)));
    render(<Detail noteId={noteId}></Detail>);

    const textbox = await screen.findByRole('textbox');
    expect(screen.queryByRole('button', {name: "(n/a)"})).toBeFalsy();
    const span = await screen.findByText(/Aloha/);
    await userEvent.click(span);
    expect(textbox).toHaveFocus();

    await userEvent.click(screen.getByRole('button', {name: "Open Editor menu"}));
    await userEvent.click(screen.getByRole('menuitem', {name: "Lock note"}));
    expect(upsertNote).toHaveBeenCalledTimes(1);
    const nodes = [{type: 'paragraph', noteSubtype: '', children: [{text: "Aloha"}]}];
    const partialNote = new NodeNote(noteId, '', nodes, noteDate, true);
    expect(upsertNote).toHaveBeenLastCalledWith(partialNote, 'DETAIL');
  });

  it("saves Markdown if retrieved as Markdown", async () => {
    const noteId = uuidv4();
    const initialText = "# Vaporware\nThis is hot stuff.";
    const noteDate = new Date(1980, 11, 20);
    getNote.mockResolvedValue(Promise.resolve(new SerializedNote(noteId, 'text/markdown;hint=COMMONMARK', '', initialText, noteDate)));
    render(<Detail noteId={noteId}></Detail>);

    const textbox = await screen.findByRole('textbox');
    expect(screen.queryByRole('button', {name: "(n/a)"})).toBeFalsy();
    const span = await screen.findByText(/# Vaporware/);
    await userEvent.click(span);
    expect(textbox).toHaveFocus();
    expect(await screen.findByText(/This is hot stuff./)).toBeVisible();

    await userEvent.click(screen.getByRole('button', {name: "Open Editor menu"}));
    await userEvent.click(screen.getByRole('menuitem', {name: "Lock note"}));
    expect(upsertNote).toHaveBeenCalledTimes(1);
    const nodes = [
      {type: 'paragraph', noteSubtype: 'markdown;hint=COMMONMARK', children: [{text: "# Vaporware"}]},
      {type: 'paragraph', children: [{text: "This is hot stuff."}]},
    ];
    const partialNote = new NodeNote(noteId, 'markdown;hint=COMMONMARK', nodes, noteDate, true);
    expect(upsertNote).toHaveBeenLastCalledWith(partialNote, 'DETAIL');
  });

  it("shows formatting menu in rich text mode, but not plain text mode", async () => {
    const noteId = uuidv4();
    const initialText = "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium";
    const noteDate = new Date(1980, 11, 20);
    getNote.mockResolvedValue(Promise.resolve(new SerializedNote(noteId, 'text/plain', '', initialText, noteDate)));
    render(<Detail noteId={noteId}></Detail>);

    // waits for content type button to be visible
    await waitFor(() => expect(screen.getByRole('button', {name: "plain text"})).toBeVisible());
    const detailsMenuBtn = screen.getByRole('button', {name: "Open Editor menu"});
    expect(detailsMenuBtn).toBeVisible();
    // format controls are not present
    expect(screen.queryByRole('button', {name: "(n/a)"})).toBeFalsy();

    await userEvent.click(detailsMenuBtn);
    // expect(screen.getByRole('menu', {name: "Details menu"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: /Undo/})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: /Redo/})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Paste files..."})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Paste files & recognize print..."})).toBeVisible();
    const changeNoteType = screen.getByRole('menuitem', {name: /Change note type/});
    expect(changeNoteType).toBeVisible();

    await userEvent.click(changeNoteType);
    expect(screen.getByRole('dialog', {name: "Change type of note?"})).toBeVisible();
    // expect(screen.getByRole('checkbox', {name: "Note already contains Markdown notation"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Plain Text"})).toBeDisabled();
    expect(screen.getByRole('button', {name: /Mark.?down/})).toBeEnabled();
    const richTextBtn = screen.getByRole('button', {name: "Rich Text"});
    expect(richTextBtn).toBeEnabled();

    await userEvent.click(richTextBtn);
    // now, format controls are present, and content type button is not present
    await waitFor(() => expect(screen.queryByRole('button', {name: "Open text style menu"})).toBeVisible());
    expect(screen.queryByRole('button', {name: "Change content type"})).toBeFalsy();

    await userEvent.click(detailsMenuBtn);
    await userEvent.click(screen.getByRole('menuitem', {name: /Undo/}));
    await waitFor(() => expect(screen.getByRole('button', {name: "plain text"})).toBeVisible());
    expect(screen.queryByRole('button', {name: "(n/a)"})).toBeFalsy();

    await userEvent.click(detailsMenuBtn);
    await userEvent.click(screen.getByRole('menuitem', {name: /Redo/}));
    await waitFor(() => expect(screen.queryByRole('button', {name: "Open text style menu"})).toBeVisible());
    expect(screen.queryByRole('button', {name: "Change content type"})).toBeFalsy();
  });

  it("text recognition menu item is clickable", async () => {
    const noteId = uuidv4();
    const initialText = "Nullam ac lacinia lorem.\nCras sit amet felis sollicitudin, tincidunt elit eget, suscipit turpis.";
    const noteDate = new Date(1980, 12, 13);
    getNote.mockResolvedValue(Promise.resolve(new SerializedNote(noteId, 'text/html;hint=SEMANTIC', '', initialText, noteDate)));
    render(<Detail noteId={noteId}></Detail>);

    await waitFor(() => expect(screen.getByRole('button', {name: "Open Editor menu"})).toBeVisible());
    const detailsMenuBtn = screen.getByRole('button', {name: "Open Editor menu"});

    await userEvent.click(detailsMenuBtn);
    let menu = await screen.findByRole('menu', {name: "Editor menu"});

    const pasteAndRecognize = within(menu).getByRole('menuitem', {name: "Paste files & recognize print..."});
    expect(pasteAndRecognize).toBeVisible();

    await userEvent.click(pasteAndRecognize);
  });

  it("shows 'no selection' menu when no selection", async () => {
    const noteId = uuidv4();
    const noteText = "<p>outside</p><table><tr><td><p>just paragraph</p><ul><li>also list</li></ul></td></tr></table>";
    const noteDate = new Date(2022, 8, 4);
    getNote.mockResolvedValue(Promise.resolve(new SerializedNote(noteId, 'text/html;hint=SEMANTIC', '', noteText, noteDate)));

    render(<Detail noteId={noteId}></Detail>);
    await screen.findByRole('textbox');
    await userEvent.click(screen.getByRole('button', {name: "(n/a)"}));
    expect(screen.getByRole('menuitem', {name: "Title"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Heading"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Subheading"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Paragraph"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "• Bulleted List"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Numbered List"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "✔️ Task List"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "✔️ Sequence"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Table"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Block Quote"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Monospaced"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Rule"})).toBeVisible();
    expect(screen.getAllByRole('menuitem')).toHaveLength(12);
  });

  it("shows text style menu for rich text notes", async () => {
    const noteId = uuidv4();
    const noteText = "<p>some text</p>";
    const noteDate = new Date(2022, 8, 5);
    getNote.mockResolvedValue(Promise.resolve(new SerializedNote(noteId, 'text/html;hint=SEMANTIC', '', noteText, noteDate)));

    render(<Detail noteId={noteId}></Detail>);
    await screen.findByRole('textbox');
    await userEvent.click(screen.getByRole('button', {name: "Open text style menu"}));
    expect(screen.getByRole('menuitem', {name: "Italic"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Bold"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Monospaced"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: /Superscript/i})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: /Subscript/i})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Underlined"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Strikethrough"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Deleted"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: "Inserted"})).toBeVisible();
    expect(screen.getAllByRole('menuitem')).toHaveLength(9);
  });

    // it('allows typing enter in blank item to end list', async () => {
  //   const noteId = uuidv4();
  //   const noteText = "<ol><li>first</li><li>second</li></ol>";
  //   const noteDate = new Date(2021, 7, 2);
  //   getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, noteText, noteDate, 'text/html;hint=SEMANTIC')));
  //
  //   render(<Detail noteId={noteId}></Detail>);
  //   const textbox = await screen.findByRole('textbox');
  //   expect(textbox).toBeVisible();
  //   expect(textbox.textContent).toEqual("firstsecond");
  //   expect(textbox).not.toHaveFocus();
  //   expect(screen.queryAllByRole('listitem').length).toEqual(2);
  //
  //   await userEvent.click(screen.getByRole('list'));
  //   expect(textbox).toHaveFocus();
  //   await userEvent.type(screen.getByRole('list'), "foo\n");
  //   expect(textbox.textContent).toEqual("firstsecondfoo");
  //   expect(screen.queryAllByRole('listitem').length).toEqual(3);
  // });

  it("locks a note when menu item selected", async () => {
    const noteId = uuidv4();
    const noteText = "<p>Some paragraph</p>";
    const noteDate = new Date(2022, 8, 3);
    getNote.mockResolvedValue(Promise.resolve(new SerializedNote(noteId, 'text/html;hint=SEMANTIC', '', noteText, noteDate)));

    render(<Detail noteId={noteId}></Detail>);
    const textbox = await screen.findByRole('textbox');
    expect(textbox).toBeVisible();
    expect(textbox.textContent).toEqual("Some paragraph");
    expect(textbox).not.toHaveFocus();

    await userEvent.click(textbox);
    expect(textbox).toHaveFocus();

    await userEvent.click(screen.getByRole('button', {name: "Open Editor menu"}));
    await userEvent.click(screen.getByRole('menuitem', {name: "Lock note"}));
    await userEvent.click(textbox);
    expect(textbox).not.toHaveFocus();

    await userEvent.click(screen.getByRole('button', {name: "Unlock note"}));
    await userEvent.click(textbox);
    expect(textbox).toHaveFocus();
  });
});
