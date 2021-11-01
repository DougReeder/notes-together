import {v4 as uuidv4} from "uuid";
import {createMemoryNote} from './Note';
import {
  render,
  screen,
  act,
  waitFor,
  waitForElementToBeRemoved
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {upsertNote, getNote} from './storage';
import Detail from "./Detail";

jest.mock('./storage.js');

describe("Details component", () => {
  it("always has back button", async () => {
    const setMustShowPanel = jest.fn();
    await act(async () => {
      render(<Detail noteId={null} setMustShowPanel={setMustShowPanel}></Detail>);
    });
    const backBtn = await screen.findByRole('button', {name: "back"});
    expect(backBtn).toBeInTheDocument();

    userEvent.click(backBtn);
    expect(setMustShowPanel).toHaveBeenCalledWith('LIST', expect.anything());
  });

  it('renders HTML content of note', async () => {
    const noteId = uuidv4();
    const noteText = "<h2>A Relic</h2><li>YESTERDAY I found in a cupboard";
    const noteDate = new Date(2021, 9, 31);
    getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, noteText, noteDate)));

    await act(async () => {
      render(<Detail noteId={noteId}></Detail>);
    });
    const textbox = await screen.findByRole('textbox');
    expect(textbox).toBeVisible();
    expect(textbox.textContent).toEqual("A RelicYESTERDAY I found in a cupboard");
    expect(textbox).not.toHaveFocus();
    expect(screen.getByRole('heading', {name: "A Relic"})).toBeVisible();
    const item = screen.getByRole('listitem');
    expect(item).toBeVisible();
    expect(item.textContent).toEqual("YESTERDAY I found in a cupboard");

    const backBtn = await screen.findByRole('button', {name: "back"});
    expect(backBtn).toBeInTheDocument();
  });

it("clears text & date when noteId set to null", async () => {
  const noteId = uuidv4();
  const noteText = "Dogcatcher Emeritus";
  const noteDate = new Date(2021, 3, 15);
  getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, noteText, noteDate)));

  await act(async () => {
    const {findByText, rerender, queryByText} = render(<Detail noteId={noteId}></Detail>);
    const textEl = await findByText(noteText);
    expect(textEl).toBeInTheDocument();
    expect(textEl).not.toHaveFocus();

    rerender(<Detail noteId={null}></Detail>);
    await waitForElementToBeRemoved(() => queryByText(noteText));
    expect(textEl).not.toHaveFocus();
  });
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

  await act(async () => {
    render(<Detail noteId={noteId}></Detail>);
  });

  const textEl = await screen.findByText(/no note with id=/);
  expect(textEl).toBeInTheDocument();
  expect(textEl).not.toHaveFocus();
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

xit("saves on edit", async () => {
  const noteId = uuidv4();
  const initialText = "Hello";
  const noteDate = new Date(1976, 6, 4);
  getNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, initialText, noteDate)));
  await act(async () => {
    render(<Detail noteId={noteId}></Detail>);
  });

  const textbox = await screen.findByRole('textbox');
  userEvent.click(textbox);
  expect(textbox).toHaveFocus();

  upsertNote.mockResolvedValue(Promise.resolve(createMemoryNote(noteId, "Hello world", noteDate)));

  userEvent.type(textbox, " world");
  // expect(upsertNote).toHaveBeenCalledTimes(6);

  // const finalNote = await getNote(noteId);
  // expect(finalNote.content).toEqual(initialText+typedText);
  // expect(upsertNote).toHaveBeenCalledTimes(typedText.length);
  // expect(upsertNote).toHaveBeenLastCalledWith(createMemoryNote(noteId, initialText+typedText));
});
});
