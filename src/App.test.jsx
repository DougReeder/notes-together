// App.test.jsx — tests for core of Notes Together
// Copyright © 2024 Doug Reeder

import App from "./App.jsx";
import "fake-indexeddb/auto";
import {vitest} from "vitest";
import {render, screen, waitFor, within} from "@testing-library/react";
import '@testing-library/jest-dom/vitest'
import userEvent from "@testing-library/user-event";
import {BrowserRouter} from "react-router-dom";
import {init} from "./storage.js";

if (!('requestIdleCallback' in window)) {
  // https://github.com/behnammodi/polyfill/blob/master/window.polyfill.js
  if (!window.requestIdleCallback) {
    window.requestIdleCallback = function (callback, options) {
      options = options || {};
      const relaxation = 1;
      const timeout = options.timeout || relaxation;
      const start = performance.now();
      return setTimeout(function () {
        callback({
          get didTimeout() {
            return options.timeout ? false : (performance.now() - start) - relaxation > timeout;
          },
          timeRemaining: function () {
            return Math.max(0, relaxation + (performance.now() - start));
          },
        });
      }, relaxation);
    };
  }

  if (!window.cancelIdleCallback) {
    window.cancelIdleCallback = function (id) {
      clearTimeout(id);
    };
  }
}


// The test cases interfere with each other in a hard-to-diagnose way.
// Skip all but ones needed for current development.
describe("App", () => {
  beforeEach(() => {
    init();
  });

  it.skip("should render", async () => {
    render(<BrowserRouter><App></App></BrowserRouter>);

    expect(screen.getByRole('application', {})).toBeVisible();
    expect(screen.getByRole('search', {})).toBeVisible();
    expect(screen.getByRole('generic', {name: "Count of matching notes"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Open application menu"})).toBeVisible();
    expect(screen.getByRole('list', {name: "note titles"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Create new note"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Out to list panel"})).toBeVisible();   // proxy for blank Detail panel
  });

  it.skip("should show help when menu item selected", async () => {
    const user = userEvent.setup();
    render(<BrowserRouter><App></App></BrowserRouter>);
    expect(screen.getByRole('application', {})).toBeVisible();
    expect(screen.getByRole('search', {})).toBeVisible();
    await user.click(screen.getByRole('button', {name: "Open application menu"}));
    expect(await screen.findByRole('menuitem', {name: "Help"})).toBeVisible();
    expect(screen.queryByRole('banner', {name: "Help"})).toBeFalsy();

    await user.click(screen.getByRole('menuitem', {name: "Help"}));

    expect(await screen.findByRole('banner', {name: "Help"})).toBeVisible();
  });

  it.skip("should not show item buttons if no note selected", async () => {
    const user = userEvent.setup();
    vitest.spyOn(window, 'postMessage');
    render(<BrowserRouter><App></App></BrowserRouter>);
    await user.click(screen.getByRole('button', {name: "Open application menu"}));

    await user.click(await screen.findByRole('menuitem', {name: "Delete or Share selected note..."}));

    await waitFor(() => expect(window.postMessage).toHaveBeenCalledTimes(2));
    expect(window.postMessage).toHaveBeenCalledWith(expect.objectContaining( {kind: 'TRANSIENT_MSG',
      message: "First, select a note!", severity: 'info'}), '/');
  });

  // it("should show item buttons if note selected", async () => {
  //   const user = userEvent.setup();
  //   // vitest.spyOn(window, 'postMessage');
  //   render(<BrowserRouter><App></App></BrowserRouter>);
  //   const list = screen.getByRole('list', {name: "note titles"});
  //   // await user.click(await within(list).findByRole('listitem', {name: /Welcome to Notes Together!/}));
  //   const items = await within(list).findAllByRole('listitem', {});
  //   expect(items[0]).toBeVisible();
  //   await user.click(items[0]);
  //
  //   await user.click(screen.getByRole('button', {name: "Open application menu"}));
  //   await user.click(await screen.findByRole('menuitem', {name: "Delete or Share selected note"}));
  //
  //   expect(await within(list).findByRole('button', {name: "Share text"}));
  //
  // }, 1_000_000);


  it.skip("should create separate notes when import-multiple-per-file menu item selected", async () => {
    const user = userEvent.setup();
    const onClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
    render(<BrowserRouter><App></App></BrowserRouter>);
    await user.click(screen.getByRole('button', {name: "Open application menu"}));

    expect(await screen.findByRole('menuitem', {name: "Import multiple notes per file..."})).toBeVisible();
    await user.click(screen.getByRole('menuitem', {name: "Import multiple notes per file..."}));

    expect(onClickSpy).toHaveBeenCalled();
    const importFileInput = screen.getByLabelText("Import file", {});
    expect(importFileInput.multiple).toEqual(true);
    expect(importFileInput.files).toHaveLength(0);

    const textFile = new File(["quail"], "quux.txt", {type: 'text/plain'});
    const htmlFile = new File(["<h3>Orogeny</h3>"], "stuff.html", {type: 'text/html'});
    await user.upload(importFileInput, [textFile, htmlFile]);

    expect(importFileInput.files).toHaveLength(2);
    expect(screen.queryByRole('dialog', {name: /^Review Import/})).toBeVisible();

    await user.click(screen.getByRole('button', {name: "Import"}));

    await waitFor(() => expect(screen.queryByRole('dialog', {name: /^Imported 2 Notes/})).toBeVisible());
    const importedDialog = screen.queryByRole('dialog', {name: /^Imported 2 Notes/});

    await user.click(within(importedDialog).getByRole('button', {name: "Close"}));

    await waitFor(() => expect(screen.getByRole('list', {name: "note titles"})).toBeVisible());
    const list = screen.getByRole('list', {name: "note titles"});
    const htmlTitle = await within(list).findByText("Orogeny", {});
    expect(htmlTitle).toBeVisible();

    expect(within(list).queryByText(/quux.txt/, {})).toBeFalsy();   // doesn't match search words
  });

  it("should one note when import-multiple-into-one menu item selected", async () => {
    const user = userEvent.setup();
    const onClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
    render(<BrowserRouter><App></App></BrowserRouter>);
    await user.click(screen.getByRole('button', {name: "Open application menu"}));

    expect(await screen.findByRole('menuitem', {name: "Import multiple files into one note..."})).toBeVisible();
    await user.click(screen.getByRole('menuitem', {name: "Import multiple files into one note..."}));

    expect(onClickSpy).toHaveBeenCalled();
    const importFileInput = screen.getByLabelText("Import file", {});
    expect(importFileInput.multiple).toEqual(true);
    expect(importFileInput.files).toHaveLength(0);

    const textFile = new File(["foo"], "fubar.txt", {type: 'text/plain'});
    const htmlFile = new File(["<h2>Concepts</h2>"], "header.html", {type: 'text/html'});
    await user.upload(importFileInput, [textFile, htmlFile]);

    expect(importFileInput.files).toHaveLength(2);
    expect(screen.queryByRole('heading', {name: /^Review Import/})).toBeFalsy();

    const list = screen.getByRole('list', {name: "note titles"});
    const newTitle = await within(list).findByText("Concepts", {});
    expect(newTitle).toBeVisible();

    await user.click(newTitle);

    expect(screen.getByRole('button', {name: "Open Editor menu"})).toBeVisible();   // proxy for HTML Detail panel
    const editor = screen.getByRole('textbox', {name: ""});
    expect(within(editor).getByRole('heading', {name: "Concepts", level: 2})).toBeVisible();
    expect(within(editor).getAllByRole('separator', {})).toHaveLength(2);
    expect(within(editor).getByText(/foo/, {})).toBeVisible();
    expect(within(editor).getByText(/fubar\.txt/, {})).toBeVisible();
  });
});
