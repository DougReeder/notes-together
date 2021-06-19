import {createMemoryNote} from './Note';
import {
  render,
  screen,
  act,
  waitFor,
  waitForElementToBeRemoved
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {getNote, upsertNote} from "./idbNotes.js";
import Detail from "./Detail";

jest.mock('./idbNotes.js');

test('renders text of note', async () => {
  const noteId = 42;
  const noteText = "ballistic phonon transport"
  getNote.mockResolvedValue(Promise.resolve({id: noteId, text: noteText}));

  await act(async () => {
    const {findByText} = render(<Detail noteId={noteId}></Detail>);
    const textEl = await findByText(noteText);
    expect(textEl).toBeInTheDocument();
    expect(textEl).not.toHaveFocus();
  });
});

test("clears text & date when noteId set to null", async () => {
  const noteId = 69;
  const noteText = "Dogcatcher Emeritus";
  getNote.mockResolvedValue(Promise.resolve({id: noteId, text: noteText}));

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

test('sets focus if requested', async () => {
  const noteId = 23;
  const noteText = "ambivalent"
  getNote.mockResolvedValue(Promise.resolve({id: noteId, text: noteText}));
  const focusOnLoadCB = jest.fn();

  await act(async () => {
    const {findByText} = render(<Detail noteId={noteId} focusOnLoadCB={focusOnLoadCB}></Detail>);
    const textEl = await findByText(noteText);
    expect(textEl).toBeInTheDocument();

    expect(textEl).toHaveFocus();
    expect(focusOnLoadCB.mock.calls.length).toBe(1);
  });
});

xtest("saves on edit", async () => {
  const noteId = 43;
  const initialText = "Hello";
  const typedText = " world";
  await act(async () => {
    await upsertNote(createMemoryNote(noteId, initialText));
  });
  // getNote.mockResolvedValue(Promise.resolve({id: noteId, text: initialText}));

  await act(async () => {
    // getNote.mockImplementation(() => new Promise((resolve) => {
    //   setTimeout( () => {
    //     resolve({id: noteId, text: initialText});
    //   }, 100);
    // }));

    const {findByRole} = render(<Detail noteId={noteId}></Detail>);
  });
  const textEl = await screen.findByRole('article');
  expect(textEl).toBeInTheDocument();

  userEvent.type(textEl, typedText)

  const finalNote = await getNote(noteId);
  expect(finalNote.text).toEqual(initialText+typedText);
  // expect(upsertNote).toHaveBeenCalledTimes(typedText.length);
  // expect(upsertNote).toHaveBeenLastCalledWith(createMemoryNote(noteId, initialText+typedText));
});

// paste into ContentEditable not supported by DOM Testing Library
