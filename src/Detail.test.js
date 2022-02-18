import {v4 as uuidv4} from "uuid";
import {createMemoryNote} from './Note';
import {
  render,
  screen,
  act,
  waitFor,
  waitForElementToBeRemoved, queryByRole
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {upsertNote, getNote} from './storage';
import Detail, {saveFn} from "./Detail";

jest.mock('./storage.js');

global.queueMicrotask = function (f) {
  setTimeout(f, 0);
}

describe("Details component", () => {
  it("always has back button", async () => {
    const setMustShowPanel = jest.fn();
    render(<Detail noteId={null} setMustShowPanel={setMustShowPanel}></Detail>);
    const backBtn = await screen.findByRole('button', {name: "Out to list panel"});
    expect(backBtn).toBeInTheDocument();

    userEvent.click(backBtn);
    expect(setMustShowPanel).toHaveBeenCalledWith('LIST', expect.anything());
  });

  it('renders HTML content of note', async () => {
    const noteId = uuidv4();
    const noteText = "<h2>A Relic</h2><li>YESTERDAY I found in a cupboard";
    const noteDate = new Date(2021, 9, 31);
    getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, noteText, noteDate, 'text/html;hint=SEMANTIC')));

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
    getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, noteText, noteDate, 'text/markdown;hint=COMMONMARK')));

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
    const noteId = uuidv4();
    const initialText = "";
    const noteDate = new Date(1980, 11, 20);
    getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, initialText, noteDate, 'application/example')));

    render(<Detail noteId={noteId}></Detail>);

    const textEl = await screen.findByText(/Can't display this type of note/);
    expect(textEl).toBeInTheDocument();
    expect(textEl).not.toHaveFocus();
    expect(await screen.queryByTitle('Block type')).not.toBeInTheDocument();
  });

  it("clears text & date when noteId set to null", async () => {
    const noteId = uuidv4();
    const noteText = "Dogcatcher Emeritus";
    const noteDate = new Date(2021, 3, 15);
    getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, noteText, noteDate)));

    const {findByText, rerender, queryByText} = render(<Detail noteId={noteId}></Detail>);
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
//   const focusOnLoadCB = jest.fn();
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

  xit("edits & saves HTML if retrieved as SVG", async () => {
    const noteId = uuidv4();
    const initialText = `<svg version="1.1" width="300" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="red" />
        </svg>`;
    const noteDate = new Date(1976, 6, 4);
    getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, initialText, noteDate, 'image/svg+xml')));
    render(<Detail noteId={noteId}></Detail>);

    expect(await screen.findByRole('textbox')).toBeVisible();
    expect(screen.getByRole('button', {name: "(n/a)"})).toBeVisible();

    // upsertNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, "Hello", noteDate)));

    await saveFn(noteDate);
    expect(upsertNote).toHaveBeenCalledTimes(1);
    expect(upsertNote).toHaveBeenLastCalledWith(createMemoryNote(noteId, expect.anything(), noteDate, 'text/html;hint=SEMANTIC'), 'DETAIL');
  });

  it("edits & saves HTML if retrieved as MathML", async () => {
    const noteId = uuidv4();
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
    getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, initialText, noteDate, 'application/mathml+xml')));
    render(<Detail noteId={noteId}></Detail>);

    expect(await screen.findByRole('textbox')).toBeVisible();
    expect(screen.getByRole('button', {name: "(n/a)"})).toBeVisible();

    await saveFn(noteDate);
    expect(upsertNote).toHaveBeenCalledTimes(1);
    expect(upsertNote).toHaveBeenLastCalledWith(createMemoryNote(noteId, expect.anything(), noteDate, 'text/html;hint=SEMANTIC'), 'DETAIL');
  });

  it("edits & saves plain text if retrieved as plain text", async () => {
    const noteId = uuidv4();
    const initialText = "Goodbye, Lenin";
    const noteDate = new Date(1980, 11, 20);
    getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, initialText, noteDate, 'text/plain')));
    render(<Detail noteId={noteId}></Detail>);

    const textbox = await screen.findByRole('textbox');
    expect(screen.queryByRole('button', {name: "(n/a)"})).toBeFalsy();
    const span = await screen.findByText(/Goodbye, Lenin/);
    userEvent.click(span);
    expect(textbox).toHaveFocus();

    await saveFn(noteDate);
    expect(upsertNote).toHaveBeenCalledTimes(1);
    expect(upsertNote).toHaveBeenLastCalledWith(createMemoryNote(noteId, initialText, noteDate, 'text/plain'), 'DETAIL');
  });

  it("edits as plain text if retrieved without type", async () => {
    const noteId = uuidv4();
    const initialText = "Aloha";
    const noteDate = new Date(1980, 11, 20);
    getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, initialText, noteDate)));
    render(<Detail noteId={noteId}></Detail>);

    const textbox = await screen.findByRole('textbox');
    expect(screen.queryByRole('button', {name: "(n/a)"})).toBeFalsy();
    const span = await screen.findByText(/Aloha/);
    userEvent.click(span);
    expect(textbox).toHaveFocus();

    // await saveFn(noteDate);
    // expect(upsertNote).toHaveBeenCalledTimes(1);
    // expect(upsertNote).toHaveBeenLastCalledWith(createMemoryNote(noteId, initialText, noteDate, 'text/plain'), 'DETAIL');
  });

  it("saves Markdown if retrieved as Markdown", async () => {
    const noteId = uuidv4();
    const initialText = "# Vaporware\nThis is hot stuff.";
    const noteDate = new Date(1980, 11, 20);
    getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, initialText, noteDate, 'text/markdown;hint=COMMONMARK')));
    render(<Detail noteId={noteId}></Detail>);

    const textbox = await screen.findByRole('textbox');
    expect(screen.queryByRole('button', {name: "(n/a)"})).toBeFalsy();
    const span = await screen.findByText(/# Vaporware/);
    userEvent.click(span);
    expect(textbox).toHaveFocus();
    expect(await screen.findByText(/This is hot stuff./)).toBeVisible();

    await saveFn(noteDate);
    expect(upsertNote).toHaveBeenCalledTimes(1);
    expect(upsertNote).toHaveBeenLastCalledWith(createMemoryNote(noteId, initialText, noteDate, 'text/markdown;hint=COMMONMARK'), 'DETAIL');
  });

  it("shows formatting menu in rich text mode, but not plain text mode", async () => {
    const noteId = uuidv4();
    const initialText = "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium";
    const noteDate = new Date(1980, 11, 20);
    getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, initialText, noteDate, 'text/plain')));
    render(<Detail noteId={noteId}></Detail>);

    // waits for content type button to be visible
    await waitFor(() => expect(screen.getByRole('button', {name: "Change content type"})).toBeVisible());
    const detailsMenuBtn = screen.getByRole('button', {name: "Open editor menu"});
    expect(detailsMenuBtn).toBeVisible();
    // format controls are not present
    expect(screen.queryByRole('button', {name: "(n/a)"})).toBeFalsy();

    userEvent.click(detailsMenuBtn);
    // expect(screen.getByRole('menu', {name: "Details menu"})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: /Undo/})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: /Redo/})).toBeVisible();
    expect(screen.getByRole('menuitem', {name: /Paste Files/})).toBeVisible();
    const changeNoteType = screen.getByRole('menuitem', {name: /Change note type/});
    expect(changeNoteType).toBeVisible();

    userEvent.click(changeNoteType);
    expect(screen.getByRole('dialog', {name: "Change type of note?"})).toBeVisible();
    // expect(screen.getByRole('checkbox', {name: "Note already contains Markdown notation"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Plain Text"})).toBeDisabled();
    expect(screen.getByRole('button', {name: /Mark.?down/})).toBeEnabled();
    const richTextBtn = screen.getByRole('button', {name: "Rich Text"});
    expect(richTextBtn).toBeEnabled();

    userEvent.click(richTextBtn);
    // now, format controls are present, and content type button is not present
    await waitFor(() => expect(screen.queryByRole('button', {name: "(n/a)"})).toBeVisible());
    expect(screen.queryByRole('button', {name: "Change content type"})).toBeFalsy();

    userEvent.click(detailsMenuBtn);
    userEvent.click(screen.getByRole('menuitem', {name: /Undo/}));
    await waitFor(() => expect(screen.getByRole('button', {name: "Change content type"})).toBeVisible());
    expect(screen.queryByRole('button', {name: "(n/a)"})).toBeFalsy();

    userEvent.click(detailsMenuBtn);
    userEvent.click(screen.getByRole('menuitem', {name: /Redo/}));
    await waitFor(() => expect(screen.queryByRole('button', {name: "(n/a)"})).toBeVisible());
    expect(screen.queryByRole('button', {name: "Change content type"})).toBeFalsy();
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
  //   userEvent.click(screen.getByRole('list'));
  //   expect(textbox).toHaveFocus();
  //   userEvent.type(screen.getByRole('list'), "foo\n");
  //   expect(textbox.textContent).toEqual("firstsecondfoo");
  //   expect(screen.queryAllByRole('listitem').length).toEqual(3);
  // });
});
