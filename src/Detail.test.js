import {createMemoryNote} from './Note';
import {render, act, screen, waitFor, findByText, fireEvent, getByText} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {getNote, upsertNote} from "./idbNotes.js";
import Detail from "./Detail";

jest.mock('./idbNotes.js');

test('renders hint, if noteId does not exist', async () => {
  const noteId = null;
  const {getByText} = render(<Detail noteId={noteId}></Detail>);
  const adviceEl = getByText("Select a note on the left to display it in full.");
  expect(adviceEl).toBeInTheDocument();
});

test('renders text of note', async () => {
  const noteId = 42;
  const noteText = "ballistic phonon transport"
  getNote.mockResolvedValue(Promise.resolve({id: noteId, text: noteText}));

  await act(async () => {
    const {findByText} = render(<Detail noteId={noteId}></Detail>);
    const textEl = await findByText(noteText);
    expect(textEl).toBeInTheDocument();
  });
});

test("saves on edit", async () => {
  const noteId = 43;
  const initialText = "Hello";
  const typedText = " world";
  getNote.mockResolvedValue(Promise.resolve({id: noteId, text: initialText}));

  await act(async () => {
    const {findByRole} = render(<Detail noteId={noteId}></Detail>);
    const textEl = await findByRole('article');
    expect(textEl).toBeInTheDocument();

    userEvent.type(textEl, typedText)
    expect(upsertNote).toHaveBeenCalledTimes(typedText.length);
    expect(upsertNote).toHaveBeenLastCalledWith(createMemoryNote(noteId, initialText+typedText));
  });
});

// paste into ContentEditable not supported by DOM Testing Library
