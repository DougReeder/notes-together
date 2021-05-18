import { render, screen } from '@testing-library/react';
import App from './App';

test('renders search field', async () => {
  const { container } = render(<App />);
  const searchEl = container.querySelector('input[type=search]')
  expect(searchEl).toBeInTheDocument();
});

test('renders count', async () => {
  const { container } = render(<App />);
  const countEl = container.querySelector('div.count')
  expect(countEl).toBeInTheDocument();
  expect(countEl.innerHTML).toMatch(/\d+/);
});
