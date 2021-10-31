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

test('renders content of note', async () => {
  const noteId = uuidv4();
  const noteText = "ballistic phonon transport"
  getNote.mockResolvedValue(Promise.resolve({id: noteId, content: noteText}));

  await act(async () => {
    const {findByText} = render(<Detail noteId={noteId}></Detail>);
    // const textEl = await findByText(noteText);
    // expect(textEl).toBeInTheDocument();
    // expect(textEl).not.toHaveFocus();
  });

  const back = await screen.findByRole('button');
  expect(back).toBeInTheDocument();
});

// test("clears text & date when noteId set to null", async () => {
//   const noteId = uuidv4();
//   const noteText = "Dogcatcher Emeritus";
//   getNote.mockResolvedValue(Promise.resolve({id: noteId, content: noteText}));
//
//   await act(async () => {
//     const {findByText, rerender, queryByText} = render(<Detail noteId={noteId}></Detail>);
//     const textEl = await findByText(noteText);
//     expect(textEl).toBeInTheDocument();
//     expect(textEl).not.toHaveFocus();
//
//     rerender(<Detail noteId={null}></Detail>);
//     await waitForElementToBeRemoved(() => queryByText(noteText));
//     expect(textEl).not.toHaveFocus();
//   });
// });

// test('sets focus if requested', async () => {
//   const noteId = uuidv4();
//   const noteText = "ambivalent"
//   getNote.mockResolvedValue(Promise.resolve({id: noteId, content: noteText}));
//   const focusOnLoadCB = jest.fn();
//
//   await act(async () => {
//     const {findByText} = render(<Detail noteId={noteId} focusOnLoadCB={focusOnLoadCB}></Detail>);
//     const textEl = await findByText(noteText);
//     expect(textEl).toBeInTheDocument();
//
//     expect(textEl).toHaveFocus();
//     expect(focusOnLoadCB.mock.calls.length).toBe(1);
//   });
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

xtest("saves on edit", async () => {
  const noteId = uuidv4();
  const initialText = "Hello";
  const typedText = " world";
  await act(async () => {
    await upsertNote(createMemoryNote(noteId, initialText));
  });
  // getNote.mockResolvedValue(Promise.resolve({id: noteId, content: initialText}));

  await act(async () => {
    // getNote.mockImplementation(() => new Promise((resolve) => {
    //   setTimeout( () => {
    //     resolve({id: noteId, content: initialText});
    //   }, 100);
    // }));

    const {findByRole} = render(<Detail noteId={noteId}></Detail>);
  });
  const textEl = await screen.findByRole('article');
  expect(textEl).toBeInTheDocument();

  userEvent.type(textEl, typedText)

  const finalNote = await getNote(noteId);
  expect(finalNote.content).toEqual(initialText+typedText);
  // expect(upsertNote).toHaveBeenCalledTimes(typedText.length);
  // expect(upsertNote).toHaveBeenLastCalledWith(createMemoryNote(noteId, initialText+typedText));
});
