// List.test.js - automated tests for List component for Notes Together
// Copyright © 2021 Doug Reeder

import {
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import mockStubs from './mockStubs.json';
import List from "./List";
import React from "react";

jest.mock('./storage', () => ({
  findStubs: (searchWords, callback) => {
    setTimeout(() => {
      for (const stub of mockStubs) {
        stub.date = new Date(stub.date);
      }
      callback(null, mockStubs, {isPartial: false, isFinal: false});
    }, 4);
  }
}));

describe("List", () => {
  it("should render note summaries", async () => {
    const {container} = render(<List changeCount={() => {}} handleSelect={() => {}} setTransientErr={() => {}}></List>);

    const items = await screen.findAllByRole('listitem');
    expect(items.length).toEqual(8);
    expect(items[0].className).toEqual("divider");
    expect(items[0].textContent).toEqual("September 2021");
    expect(items[1].className).toEqual("summary");
    expect(items[1].textContent).toEqual("I would find her society much more believable if it was set far in the future on some other planet, and did not require the reader to swallow a total reversal of current trends.");
    expect(items[2].className).toEqual("summary");
    expect(items[2].textContent).toEqual("Uncommon Women (1983)The only problem I had with the movie was that it fails to develop its material.  ");

    expect(items[4].className).toEqual("divider");
    expect(items[4].textContent).toEqual("August 2021");
    expect(items[5].className).toEqual("summary");
    expect(items[5].textContent).toEqual("A shallow cash-grab.  More troubling is the is the lecturing on the evils of capitalism and how it was responsible for all the ecological troubles of the world. The lecturing is reasonable for the characters and their background, and makes sense given the characters' situation.");
    expect(items[6].className).toEqual("divider");
    expect(items[6].textContent).toEqual("August 2020");
  });
});
