import {render, waitFor} from '@testing-library/react';
import App from './App';
import userEvent from "@testing-library/user-event";


test('adds a note with search words when add button pressed', async () => {
  const searchWords = "a perfectly arranged marriage";
  const {container, getByRole, findByRole, findByText} = render(<App/>);
  const searchEl = getByRole('search');
  userEvent.type(searchEl, searchWords)
  const app = getByRole('application');
  const countEl = app.querySelector('div.count')
  expect(countEl).toBeInTheDocument();

  await waitFor( () => expect(parseInt(countEl.innerHTML, 10)).toBeGreaterThan(0)
  );
  const oldCount = parseInt(countEl.innerHTML, 10);

  const addBtn = getByRole('button');
  addBtn.click();

  await findByText(searchWords);
  const articleEl = getByRole('article');
  expect(articleEl.innerHTML).toMatch(new RegExp(searchWords));

  // await waitFor( () => expect(parseInt(countEl.innerHTML, 10)).toEqual(oldCount+1)
  // );
});
