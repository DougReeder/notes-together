// App.test.jsx — tests for core of Notes Together
// Copyright © 2024 Doug Reeder

import App from "./App.jsx";
import _ from "fake-indexeddb/auto.js";
import {vitest} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
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

  it("should not show item buttons if no note selected", async () => {
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
});
