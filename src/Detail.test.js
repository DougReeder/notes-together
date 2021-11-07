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
import Detail from "./Detail";

jest.mock('./storage.js');

describe("Details component", () => {
  it("always has back button", async () => {
    const setMustShowPanel = jest.fn();
    render(<Detail noteId={null} setMustShowPanel={setMustShowPanel}></Detail>);
    const backBtn = await screen.findByRole('button', {name: "back"});
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

    expect(await screen.getByTitle('Block type')).toBeVisible();
    const backBtn = await screen.findByRole('button', {name: "back"});
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
    const backBtn = await screen.findByRole('button', {name: "back"});
    expect(backBtn).toBeInTheDocument();
  });

  it('renders error if note not text type', async () => {
    const noteId = uuidv4();
    const initialText = "";
    const noteDate = new Date(1980, 11, 20);
    getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, initialText, noteDate, 'application/rtf')));

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

  it("edits & saves HTML if retrieved as SVG", async () => {
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

    userEvent.click(screen.getByRole('button', {name: "Save"}));
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

    userEvent.click(screen.getByRole('button', {name: "Save"}));
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

    // userEvent.click(screen.getByRole('button', {name: "Save"}));
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

    userEvent.click(screen.getByRole('button', {name: "Save"}));
    expect(upsertNote).toHaveBeenCalledTimes(1);
    expect(upsertNote).toHaveBeenLastCalledWith(createMemoryNote(noteId, initialText, noteDate, 'text/markdown;hint=COMMONMARK'), 'DETAIL');
  });
});
