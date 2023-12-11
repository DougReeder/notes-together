// List.test.js - automated tests for List component for Notes Together
// Copyright © 2021,2023 Doug Reeder

import {
  render,
  screen, waitForElementToBeRemoved,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event';
import mockStubs from './mockStubs.json';
import _ from "fake-indexeddb/auto.js";
import {deleteNote} from './storage';
import List from "./List";

let mockStubList = [];
let mockIsFirstLaunch = false;

vitest.mock('./storage', () => ({
  init: () => {return Promise.resolve({isFirstLaunch: mockIsFirstLaunch})},
  findStubs: (searchWords, callback) => {
    setTimeout(() => {
      callback(null, mockStubList, {isPartial: false, isFinal: false});
    }, 4);
  },
  deleteNote: vitest.fn().mockResolvedValue([undefined, 42]),
}));

describe("List", () => {
  it("should render advice when no stubs returned on first launch, and close the advice when button clicked", async () => {
    mockIsFirstLaunch = true;
    mockStubList = [];

    render(<List changeCount={() => {}} handleSelect={() => {}} setTransientErr={() => {}}></List>);

    await screen.findByRole('list');
    expect(await screen.findByRole('heading', {name: "Free your mind from mundane details!"})).toBeVisible();
    const closeBtn = screen.getByRole('button', {name: "Close"});
    expect(closeBtn).toBeVisible();

    await userEvent.click(closeBtn);
    expect(screen.queryByRole('heading', {name: "Free your mind from mundane details!"})).not.toBeInTheDocument();
  });


  it("should render advice when few stubs returned on first launch, and close the advice when button clicked", async () => {
    mockIsFirstLaunch = true;
    mockStubList = mockStubs.slice(0, 2).map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });

    render(<List changeCount={() => {}} handleSelect={() => {}} setTransientErr={() => {}}></List>);

    await screen.findAllByRole('listitem');
    expect(await screen.findByRole('heading', {name: "Free your mind from mundane details!"})).toBeVisible();
    const closeBtn = screen.getByRole('button', {name: "Close"});
    expect(closeBtn).toBeVisible();

    await userEvent.click(closeBtn);
    expect(screen.queryByRole('heading', {name: "Free your mind from mundane details!"})).not.toBeInTheDocument();
  });

  it("should not render advice when no stubs returned on later launch", async () => {
    mockIsFirstLaunch = false;
    mockStubList = [];

    render(<List changeCount={() => {}} handleSelect={() => {}} setTransientErr={() => {}}></List>);

    await screen.findByRole('list');
    expect(screen.queryByRole('heading', {name: "Free your mind from mundane details!"})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: "Close"})).not.toBeInTheDocument();
  });


  it("should not render advice when few stubs returned on later launch", async () => {
    mockIsFirstLaunch = false;
    mockStubList = mockStubs.slice(0, 2).map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });

    render(<List changeCount={() => {}} handleSelect={() => {}} setTransientErr={() => {}}></List>);

    await screen.findByRole('list');
    expect(screen.queryByRole('heading', {name: "Free your mind from mundane details!"})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: "Close"})).not.toBeInTheDocument();
  });

  it("should render note summaries & advice", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });

    render(<List changeCount={() => {}} handleSelect={() => {}} setTransientErr={() => {}}></List>);

    const items = await screen.findAllByRole('listitem');
    expect(items.length).toEqual(8);
    expect(items[0].className).toEqual("divider");
    expect(items[0].textContent).toEqual("September 2021");
    expect(items[1].className).toEqual("summary");
    expect(items[1].textContent).toEqual("I would find her society much more believable if it was set far in the future on some other planet, and did not require the reader to swallow a total reversal of current trends.");
    expect(items[2].className).toEqual("summary");
    expect(items[2].textContent).toEqual("Uncommon Women (1983)The only problem I had with the movie was that it fails to develop its material.");

    expect(items[4].className).toEqual("divider");
    expect(items[4].textContent).toEqual("August 2021");
    expect(items[5].className).toEqual("summary");
    expect(items[5].textContent).toEqual("A shallow cash-grab.  More troubling is the is the lecturing on the evils of capitalism and how it was responsible for all the ecological troubles of the world. The lecturing is reasonable for the characters and their background, and makes sense given the characters' situation.");
    expect(items[6].className).toEqual("divider");
    expect(items[6].textContent).toEqual("August 2020");
  });

  it("should switch to displaying Details on first down arrow", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();

    render(<List changeCount={() => {}}
                 handleSelect={mockHandleSelect}
                 setTransientErr={() => {}}></List>);
    await screen.findAllByRole('listitem');
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.keyboard('{ArrowDown}');
    expect(mockHandleSelect).toHaveBeenCalledWith('0b6b89c8-8aca-43de-8c7b-72095380682b', 'DETAIL');
  });

  it("should switch to displaying Details on first up arrow", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();

    render(<List changeCount={() => {}}
                 handleSelect={mockHandleSelect}
                 setTransientErr={() => {}}></List>);
    await screen.findAllByRole('listitem');
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.keyboard('{ArrowUp}');
    expect(mockHandleSelect).toHaveBeenCalledWith('ca5a278b-1959-45da-9431-d3bd856c8733', 'DETAIL');
  });

  it("should not force display of Details on second down arrow", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();

    render(<List changeCount={() => {}}
                 selectedNoteId='0b6b89c8-8aca-43de-8c7b-72095380682b'
                 handleSelect={mockHandleSelect}
                 setTransientErr={() => {}}></List>);
    await screen.findAllByRole('listitem');
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.keyboard('{ArrowDown}');
    expect(mockHandleSelect).toHaveBeenCalledWith('615df9ff-89ab-4d51-b64d-0e82b2dfc2b6', null);
  });

  it("should not force display of Details on second up arrow", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();

    render(<List changeCount={() => {}}
                 selectedNoteId='f5af3107-fc12-4291-88ff-e0d64b962e49'
                 handleSelect={mockHandleSelect}
                 setTransientErr={() => {}}></List>);
    await screen.findAllByRole('listitem');
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.keyboard('{ArrowUp}');
    expect(mockHandleSelect).toHaveBeenCalledWith('cba4c6fd-abf4-4f68-91ab-979fdf233606', null);
  });

  it("should not show item buttons on Backspace when no note selected", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();

    render(<List changeCount={() => {}}
                 selectedNoteId={null}
                 handleSelect={mockHandleSelect}
                 setTransientErr={() => {}}></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.keyboard('{Backspace}');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show item buttons on Backspace then hide on Cancel click", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();

    render(<List changeCount={() => {}}
                 selectedNoteId='f5af3107-fc12-4291-88ff-e0d64b962e49'
                 handleSelect={mockHandleSelect}
                 setTransientErr={() => {}}></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.keyboard('{Backspace}');
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    const cancelBtn = screen.getByRole('button', {name: "Cancel"});
    expect(cancelBtn).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();
    expect(deleteNote).not.toHaveBeenCalled();

    await userEvent.click(cancelBtn);
    expect(deleteNote).not.toHaveBeenCalled();
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Delete"}));
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show item buttons on Delete key then delete note on Delete click", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();
    const someNoteId = 'f5af3107-fc12-4291-88ff-e0d64b962e49';

    render(<List changeCount={() => {}}
                 selectedNoteId={someNoteId}
                 handleSelect={mockHandleSelect}
                 setTransientErr={() => {}}></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.keyboard('{Delete}');
    const deleteBtn = screen.getByRole('button', {name: "Delete"});
    expect(deleteBtn).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(deleteBtn);
    expect(deleteNote).toHaveBeenCalledWith(someNoteId);
    // await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Delete"}));
    // expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show item buttons on Backspace then delete on Enter", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();
    const someNoteId = 'f5af3107-fc12-4291-88ff-e0d64b962e49';

    render(<List changeCount={() => {}}
                 selectedNoteId={someNoteId}
                 handleSelect={mockHandleSelect}
                 setTransientErr={() => {}}></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.keyboard('{Backspace}');
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();
    expect(deleteNote).not.toHaveBeenCalled();

    await userEvent.keyboard('{Enter}');
    expect(deleteNote).toHaveBeenCalledWith(someNoteId);
    // mock deleteNote can't call postMessage
  });

  it("should show item buttons on Delete key then delete on Space key", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();
    const someNoteId = 'f5af3107-fc12-4291-88ff-e0d64b962e49';

    render(<List changeCount={() => {}}
                 selectedNoteId={someNoteId}
                 handleSelect={mockHandleSelect}
                 setTransientErr={() => {}}></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.keyboard('{Delete}');
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();
    expect(deleteNote).not.toHaveBeenCalled();

    await userEvent.keyboard(' ');
    expect(deleteNote).toHaveBeenCalledWith(someNoteId);
    // mock deleteNote can't call postMessage
  });

  it("should show item buttons on Backspace key then close on Escape key", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();

    render(<List changeCount={() => {}}
                 selectedNoteId='f5af3107-fc12-4291-88ff-e0d64b962e49'
                 handleSelect={mockHandleSelect}
                 setTransientErr={() => {}}></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.keyboard('{Backspace}');
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(deleteNote).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Delete"}));
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
    expect(deleteNote).not.toHaveBeenCalled();
  });

  it("should show item buttons on double-click", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();

    render(<List changeCount={() => {}}
                 selectedNoteId='f5af3107-fc12-4291-88ff-e0d64b962e49'
                 handleSelect={mockHandleSelect}
                 setTransientErr={() => {}}></List>);
    const items = await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.dblClick(items[1]);
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
  });
});
