// List.test.js - automated tests for List component for Notes Together
// Copyright © 2021–2024 Doug Reeder

import {
  render,
  screen, waitForElementToBeRemoved, within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event';
import mockStubs from './mockStubs.json';
import _ from "fake-indexeddb/auto.js";
import {deleteNote, getNote} from './storage';
import List from "./List";
import {SerializedNote} from "./Note.js";
import normalizeDate from "./util/normalizeDate.js";

let mockStubList = [];
let mockIsFirstLaunch = false;

vitest.mock('./storage', () => ({
  init: () => {return Promise.resolve({isFirstLaunch: mockIsFirstLaunch})},
  findStubs: (searchWords, callback) => {
    setTimeout(() => {
      callback(null, mockStubList, {isPartial: false, isFinal: false});
    }, 4);
  },
  getNote: vitest.fn(),
  deleteNote: vitest.fn().mockResolvedValue([undefined, 42]),
}));

describe("List", () => {
  it("should render advice when no stubs returned on first launch, and close the advice when button clicked", async () => {
    mockIsFirstLaunch = true;
    mockStubList = [];

    render(<List changeCount={() => {}} handleSelect={() => {}}></List>);

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

    render(<List changeCount={() => {}} handleSelect={() => {}}></List>);

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

    render(<List changeCount={() => {}} handleSelect={() => {}}></List>);

    await screen.findByRole('list');
    expect(screen.queryByRole('heading', {name: "Free your mind from mundane details!"})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: "Close"})).not.toBeInTheDocument();
  });


  it("should not render advice when few stubs returned on later launch", async () => {
    mockIsFirstLaunch = false;
    mockStubList = mockStubs.slice(0, 2).map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });

    render(<List changeCount={() => {}} handleSelect={() => {}}></List>);

    await screen.findByRole('list');
    expect(screen.queryByRole('heading', {name: "Free your mind from mundane details!"})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: "Close"})).not.toBeInTheDocument();
  });

  it("should render separators & note summaries", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });

    render(<List changeCount={() => {}} handleSelect={() => {}}></List>);

    const items = await screen.findAllByRole('listitem');
    expect(items.length).toEqual(5);
    expect(items[0].className).toEqual("summary");
    expect(items[0].textContent).toEqual("I would find her society much more believable if it was set far in the future on some other planet, and did not require the reader to swallow a total reversal of current trends.");
    expect(items[1].className).toEqual("summary");
    expect(items[1].textContent).toEqual("Uncommon Women (1983)The only problem I had with the movie was that it fails to develop its material.");

    expect(items[3].className).toEqual("summary");
    expect(items[3].textContent).toEqual("A shallow cash-grab.More troubling is the is the lecturing on the evils of capitalism and how it was responsible for all the ecological troubles of the world.");

    const separators = await screen.findAllByRole('separator');
    expect(separators.length).toEqual(3);
    expect(separators[0].className).toEqual("divider");
    expect(separators[0].textContent).toEqual("September 2021");
    expect(separators[1].className).toEqual("divider");
    expect(separators[1].textContent).toEqual("August 2021");
    expect(separators[2].className).toEqual("divider");
    expect(separators[2].textContent).toEqual("August 2020");
  });

  it("should switch to displaying Details on first down arrow", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect}></List>);
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

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect}></List>);
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
    ></List>);
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
    ></List>);
    await screen.findAllByRole('listitem');
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.keyboard('{ArrowUp}');
    expect(mockHandleSelect).toHaveBeenCalledWith('cba4c6fd-abf4-4f68-91ab-979fdf233606', null);
  });


  it("should show item buttons on double-click then hide on Escape key", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();
    navigator.share = vi.fn().mockImplementation(() => Promise.resolve());

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect}></List>);
    const items = await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.dblClick(items[0]);
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Delete"}));
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();
  });

  it("should show item buttons on double-click then hide on Cancel click", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();
    navigator.share = vi.fn().mockImplementation(() => Promise.resolve());

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect}></List>);
    const items = await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.dblClick(items[0]);
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    const cancelBtn = screen.getByRole('button', {name: "Cancel"});
    expect(cancelBtn).toBeVisible();

    await userEvent.click(cancelBtn);
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Delete"}));
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();
  });

  it("should show item buttons on double-click, switch to another, then hide when the list is double-clicked outside items", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();
    navigator.share = vi.fn().mockImplementation(() => Promise.resolve());

    render(<List changeCount={() => {}}
                 selectedNoteId='f5af3107-fc12-4291-88ff-e0d64b962e49'
                 handleSelect={mockHandleSelect}
    ></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    const item2 = screen.getByText("Uncommon Women (1983)", {exact: false});
    await userEvent.dblClick(item2);
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();

    const item3 = screen.getByText("machine:", {exact: false});
    await userEvent.dblClick(item3);
    expect(screen.getAllByRole('button', {name: "Delete"})).toHaveLength(2);   // old sliding away, new sliding in
    expect(screen.getAllByRole('button', {name: "Share text"})).toHaveLength(2);
    expect(screen.getAllByRole('button', {name: "Share file"})).toHaveLength(2);
    expect(screen.getAllByRole('button', {name: "Cancel"})).toHaveLength(2);

    await userEvent.dblClick(screen.getByRole('list'));   // outside any item
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Delete"}));
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();
  });


  it("should not show Delete & Cancel buttons on control-backspace when no note selected", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();

    render(<List changeCount={() => {}}
                 selectedNoteId={null}
                 handleSelect={mockHandleSelect}
    ></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.keyboard('{Control>}{Backspace}{/Control}');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show Delete & Cancel buttons on control-backspace then hide on Cancel click", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();

    render(<List changeCount={() => {}}
                 selectedNoteId='f5af3107-fc12-4291-88ff-e0d64b962e49'
                 handleSelect={mockHandleSelect}
                ></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.keyboard('{Control>}{Backspace}{/Control}');
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    const cancelBtn = screen.getByRole('button', {name: "Cancel"});
    expect(cancelBtn).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();
    expect(deleteNote).not.toHaveBeenCalled();

    await userEvent.click(cancelBtn);
    expect(deleteNote).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Delete"}));
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show Delete & Cancel buttons on meta-delete key then delete note on Delete click", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();
    const someNoteId = 'f5af3107-fc12-4291-88ff-e0d64b962e49';

    render(<List changeCount={() => {}}
                 selectedNoteId={someNoteId}
                 handleSelect={mockHandleSelect}
    ></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.keyboard('{Meta>}{Delete}{/Meta}');
    const deleteBtn = screen.getByRole('button', {name: "Delete"});
    expect(deleteBtn).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(deleteBtn);
    expect(deleteNote).toHaveBeenCalledWith(someNoteId);
    expect(mockHandleSelect).toHaveBeenCalledWith(null);
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show Delete & Cancel buttons on meta-backspace then delete on Enter key", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();
    const someNoteId = 'f5af3107-fc12-4291-88ff-e0d64b962e49';

    render(<List changeCount={() => {}}
                 selectedNoteId={someNoteId}
                 handleSelect={mockHandleSelect}
    ></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.keyboard('{Meta>}{Backspace}{/Meta}');
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();
    expect(deleteNote).not.toHaveBeenCalled();

    await userEvent.keyboard('{Enter}');
    expect(deleteNote).toHaveBeenCalledWith(someNoteId);
    expect(mockHandleSelect).toHaveBeenCalledWith(null);
    // mock deleteNote can't call postMessage
  });

  it("should show Delete & Cancel buttons on control-delete key then delete on Space key", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();
    const someNoteId = 'f5af3107-fc12-4291-88ff-e0d64b962e49';

    render(<List changeCount={() => {}}
                 selectedNoteId={someNoteId}
                 handleSelect={mockHandleSelect}
    ></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.keyboard('{Control>}{Delete}{/Control}');
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();
    expect(deleteNote).not.toHaveBeenCalled();

    await userEvent.keyboard(' ');
    expect(deleteNote).toHaveBeenCalledWith(someNoteId);
    expect(mockHandleSelect).toHaveBeenCalledWith(null);
    // mock deleteNote can't call postMessage
  });

  it("should show Delete & Cancel buttons on control-backspace key then hide on Escape key", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();

    render(<List changeCount={() => {}}
                 selectedNoteId='f5af3107-fc12-4291-88ff-e0d64b962e49'
                 handleSelect={mockHandleSelect}
    ></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.keyboard('{Control>}{Backspace}{/Control}');
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();   // not selected

    await userEvent.keyboard('{Escape}');
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Delete"}));
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();   // not cleared after delete
  });

  it("should show Delete & Cancel buttons on double-click & delete non-selected item on Delete click", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();

    render(<List changeCount={() => {}}
                 selectedNoteId='f5af3107-fc12-4291-88ff-e0d64b962e49'
                 handleSelect={mockHandleSelect}
    ></List>);
    const items = await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();   // not selected

    await userEvent.dblClick(items[1]);
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Delete"}));
    expect(deleteNote).toHaveBeenCalledWith("615df9ff-89ab-4d51-b64d-0e82b2dfc2b6");
    expect(mockHandleSelect).not.toHaveBeenCalled();   // deleted item was not selected
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show Delete & Cancel buttons on double-click & delete selected item on Delete click", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();

    render(<List changeCount={() => {}}
                 selectedNoteId='f5af3107-fc12-4291-88ff-e0d64b962e49'
                 handleSelect={mockHandleSelect}
    ></List>);
    const items = await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    await userEvent.dblClick(items[3]);
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Delete"}));
    expect(deleteNote).toHaveBeenCalledWith('f5af3107-fc12-4291-88ff-e0d64b962e49');
    expect(mockHandleSelect).toHaveBeenCalled();   // deleted item was selected
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
  });


  it("should show Share & Cancel buttons on double-click & share non-selected HTML note w/ file", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = "<h1>Cross-Origin Resource Sharing</h1><p>...is an HTTP-header based mechanism</p>";
    const mockNote = new SerializedNote(mockStubs[4].id, 'text/html;hint=SEMANTIC', mockStubs[4].title,
      content, normalizeDate(mockStubs[4].date), false, []);
    getNote.mockResolvedValue(mockNote);
    const mockHandleSelect = vitest.fn();
    navigator.canShare = vi.fn().mockImplementation(() => true);
    navigator.share = vi.fn().mockImplementation(() => Promise.resolve());
    const consoleErrorSpy = vitest.spyOn(console, 'error');

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect} ></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    const item = screen.getByText("CORS", {exact: false});
    await userEvent.dblClick(item);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Share file"}));
    expect(navigator.share).toHaveBeenCalledOnce();
    const file = new File([content], "CORS.html", {type: 'text/html', endings: 'native'});
    expect(navigator.share).toHaveBeenCalledWith({title: "CORS", text: `# Cross-Origin Resource Sharing

...is an HTTP-header based mechanism`, files: [file]});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show Share & Cancel buttons on double-click & share non-selected HTML note as Markdown text", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = "<h1>Cross-Origin Resource Sharing</h1><p>...is an HTTP-header based mechanism</p>";
    const mockNote = new SerializedNote(mockStubs[4].id, 'text/html;hint=SEMANTIC', mockStubs[4].title,
      content, normalizeDate(mockStubs[4].date), false, []);
    getNote.mockResolvedValue(mockNote);
    const mockHandleSelect = vitest.fn();
    navigator.canShare = vi.fn().mockImplementation(() => true);
    navigator.share = vi.fn().mockImplementation(() => Promise.resolve());
    const consoleErrorSpy = vitest.spyOn(console, 'error');

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect} ></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    const item = screen.getByText("CORS", {exact: false});
    await userEvent.dblClick(item);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Share text"}));
    expect(navigator.share).toHaveBeenCalledOnce();
    expect(navigator.share).toHaveBeenCalledWith({title: "CORS", text: `# Cross-Origin Resource Sharing

...is an HTTP-header based mechanism`});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share text"}));
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show Share & Cancel buttons on double-click & share selected Markdown item with file", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = `# Uncommon Women (1983)
    
* Intense plot development. 
* Starting with fights and ending with politics is a bit of a downer.`;
    const mockNote = new SerializedNote(mockStubs[1].id, 'text/markdown;hint=COMMONMARK', mockStubs[1].title,
      content, normalizeDate(mockStubs[1].date), false, []);
    getNote.mockResolvedValue(mockNote);
    const mockHandleSelect = vitest.fn();
    navigator.canShare = vi.fn().mockImplementation(() => true);
    navigator.share = vi.fn().mockImplementation(() => Promise.resolve());
    const consoleErrorSpy = vitest.spyOn(console, 'error');

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect}
                 selectedNoteId="615df9ff-89ab-4d51-b64d-0e82b2dfc2b6"></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    const item = screen.getByText("Uncommon Women (1983)", {exact: false});
    await userEvent.dblClick(item);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Share file"}));
    expect(navigator.share).toHaveBeenCalledOnce();
    const file = new File([content], "Uncommon Women (1983).html", {type: 'text/markdown', endings: 'native'});
    expect(navigator.share).toHaveBeenCalledWith({title: "Uncommon Women (1983)", text: content, files: [file]});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show Share & Cancel buttons on double-click & share selected Markdown item as text", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = `# Uncommon Women (1983)
    
* Intense plot development. 
* Starting with fights and ending with politics is a bit of a downer.`;
    const mockNote = new SerializedNote(mockStubs[1].id, 'text/markdown;hint=COMMONMARK', mockStubs[1].title,
      content, normalizeDate(mockStubs[1].date), false, []);
    getNote.mockResolvedValue(mockNote);
    const mockHandleSelect = vitest.fn();
    navigator.canShare = vi.fn().mockImplementation(() => true);
    navigator.share = vi.fn().mockImplementation(() => Promise.resolve());
    const consoleErrorSpy = vitest.spyOn(console, 'error');

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect}
                 selectedNoteId="615df9ff-89ab-4d51-b64d-0e82b2dfc2b6"></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    const item = screen.getByText("Uncommon Women (1983)", {exact: false});
    await userEvent.dblClick(item);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Share text"}));
    expect(navigator.share).toHaveBeenCalledOnce();
    expect(navigator.share).toHaveBeenCalledWith({title: "Uncommon Women (1983)", text: content});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show Share & Cancel buttons on double-click & share non-selected Litewrite item with file", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = `A shallow cash-grab.
More troubling is the is the lecturing on the evils of capitalism and how it was responsible for all the ecological troubles of the world.
The lecturing is reasonable for the characters and their background, and makes sense given the characters' situation.`;
    const mockNote = new SerializedNote(mockStubs[3].id, undefined, mockStubs[3].title,
      content, normalizeDate(mockStubs[3].date), false, []);
    getNote.mockResolvedValue(mockNote);
    const mockHandleSelect = vitest.fn();
    navigator.canShare = vi.fn().mockImplementation(() => true);
    navigator.share = vi.fn().mockImplementation(() => Promise.resolve());
    const consoleErrorSpy = vitest.spyOn(console, 'error');

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect} ></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    const item = screen.getByText("A shallow cash-grab.", {exact: false});
    await userEvent.dblClick(item);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Share file"}));
    expect(navigator.share).toHaveBeenCalledOnce();
    const file = new File([content], "A shallow cash-grab..html", {type: 'text/plain', endings: 'native'});
    expect(navigator.share).toHaveBeenCalledWith({title: "A shallow cash-grab.", text: content, files: [file]});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show Share & Cancel buttons on double-click & share non-selected Litewrite item as text", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = `A shallow cash-grab.
More troubling is the is the lecturing on the evils of capitalism and how it was responsible for all the ecological troubles of the world.
The lecturing is reasonable for the characters and their background, and makes sense given the characters' situation.`;
    const mockNote = new SerializedNote(mockStubs[3].id, undefined, mockStubs[3].title,
      content, normalizeDate(mockStubs[3].date), false, []);
    getNote.mockResolvedValue(mockNote);
    const mockHandleSelect = vitest.fn();
    vitest.spyOn(window, 'postMessage');
    navigator.canShare = vi.fn().mockImplementation(() => true);
    navigator.share = vi.fn().mockImplementation(() => Promise.resolve());
    const consoleErrorSpy = vitest.spyOn(console, 'error');

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect} ></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    const item = screen.getByText("A shallow cash-grab.", {exact: false});
    await userEvent.dblClick(item);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Share text"}));
    expect(navigator.share).toHaveBeenCalledOnce();
    expect(navigator.share).toHaveBeenCalledWith({title: "A shallow cash-grab.", text: content});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(window.postMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show Share & Cancel buttons on double-click & share selected YAML item w/ file", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = `machine:
  ruby:
    version: 2.1.3
  environment:
    CODECLIMATE_REPO_TOKEN: 6bd8d374b120a5449b9a4b7dfda40cc0609dbade48a1b6655f04a9bc8de3a3ee
    ADAPTER: active_record
    ADAPTER: mongoid
dependencies:
  pre:
    - gem install bundler
test:
  override:
    - bundle exec rake:spec_all
`;
    const mockNote = new SerializedNote(mockStubs[2].id, 'text/x-yaml', mockStubs[2].title,
      content, normalizeDate(mockStubs[2].date), false, []);
    getNote.mockResolvedValue(mockNote);
    const mockHandleSelect = vitest.fn();
    vitest.spyOn(window, 'postMessage');
    navigator.canShare = vi.fn().mockImplementation(() => true);
    navigator.share = vi.fn().mockImplementation(() => Promise.resolve());
    const consoleErrorSpy = vitest.spyOn(console, 'error');

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect}
                 selectedNoteId="cba4c6fd-abf4-4f68-91ab-979fdf233606"></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    const item = screen.getByText("machine:", {exact: false});
    await userEvent.dblClick(item);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Share file"}));
    expect(navigator.share).toHaveBeenCalledOnce();
    const file = new File([content], "machine:.yaml", {type: 'application/x-yaml', endings: 'native'});
    expect(navigator.share).toHaveBeenCalledWith({title: "machine:", text: content, files: [file]});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(window.postMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show Share & Cancel buttons on double-click & share selected YAML item as text", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = `machine:
  ruby:
    version: 2.1.3
  environment:
    CODECLIMATE_REPO_TOKEN: 6bd8d374b120a5449b9a4b7dfda40cc0609dbade48a1b6655f04a9bc8de3a3ee
    ADAPTER: active_record
    ADAPTER: mongoid
dependencies:
  pre:
    - gem install bundler
test:
  override:
    - bundle exec rake:spec_all
`;
    const mockNote = new SerializedNote(mockStubs[2].id, 'text/x-yaml', mockStubs[2].title,
      content, normalizeDate(mockStubs[2].date), false, []);
    getNote.mockResolvedValue(mockNote);
    const mockHandleSelect = vitest.fn();
    vitest.spyOn(window, 'postMessage');
    navigator.canShare = vi.fn().mockImplementation(() => true);
    navigator.share = vi.fn().mockImplementation(() => Promise.resolve());
    const consoleErrorSpy = vitest.spyOn(console, 'error');

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect}
                 selectedNoteId="cba4c6fd-abf4-4f68-91ab-979fdf233606"></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();

    const item = screen.getByText("machine:", {exact: false});
    await userEvent.dblClick(item);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Cancel"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Share text"}));
    expect(navigator.share).toHaveBeenCalledOnce();
    expect(navigator.share).toHaveBeenCalledWith({title: "machine:", text: content});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(window.postMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show Share & Cancel buttons on double-click & not message user when Share aborted", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = "<h1>Cross-Origin Resource Sharing</h1><p>...is an HTTP-header based mechanism</p>";
    const mockNote = new SerializedNote(mockStubs[4].id, 'text/html;hint=SEMANTIC', mockStubs[4].title,
      content, normalizeDate(mockStubs[4].date), false, []);
    getNote.mockResolvedValue(mockNote);
    navigator.canShare = vi.fn().mockImplementation(() => true);
    navigator.share = vi.fn().mockImplementation(
      () => Promise.reject(new DOMException("unit test", "AbortError")));
    vitest.spyOn(console, 'info').mockImplementation(() => null);
    vitest.spyOn(console, 'error').mockImplementation(() => null);
    vitest.spyOn(window, 'postMessage');

    render(<List changeCount={() => {}} handleSelect={() => {}} ></List>);
    await screen.findAllByRole('listitem');
    const item = screen.getByText("CORS", {exact: false});
    await userEvent.dblClick(item);
    await userEvent.click(screen.getByRole('button', {name: "Share text"}));

    expect(navigator.share).toHaveBeenCalledOnce();
    expect(console.error).not.toHaveBeenCalled();
    expect(window.postMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeFalsy();

    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeVisible();
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share text"}));
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show Share & Cancel buttons on double-click & show dialog on DataError", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = "<h1>Cross-Origin Resource Sharing</h1><p>...is an HTTP-header based mechanism</p>";
    const mockNote = new SerializedNote(mockStubs[4].id, 'text/html;hint=SEMANTIC', mockStubs[4].title,
      content, normalizeDate(mockStubs[4].date), false, []);
    getNote.mockResolvedValue(mockNote);
    navigator.canShare = vi.fn().mockImplementation(() => true);
    navigator.share = vi.fn().mockImplementation(
      () => Promise.reject(new DOMException("unit test", "DataError")));
    vitest.spyOn(console, 'error').mockImplementation(() => null);
    vitest.spyOn(window, 'postMessage');

    render(<List changeCount={() => {}} handleSelect={() => {}} ></List>);
    await screen.findAllByRole('listitem');
    const item = screen.getByText("CORS", {exact: false});
    await userEvent.dblClick(item);
    await userEvent.click(screen.getByRole('button', {name: "Share text"}));

    expect(navigator.share).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching("CORS"), new DOMException("unit test", "DataError"));
    expect(window.postMessage).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', {name: "Send email"})).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('button', {name: "Cancel"}));

    // no way to test setting window.location to mailto: URL
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
    expect(within(dialog).queryByRole('button', {name: "Send email"})).toBeFalsy();
  });

  it("should show dialog on Share NotAllowedError, retry w/o file, then send via email", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = "<h1>Cross-Origin Resource Sharing</h1><p>...is an HTTP-header based mechanism</p>";
    const mockNote = new SerializedNote(mockStubs[4].id, 'text/html;hint=SEMANTIC', mockStubs[4].title,
      content, normalizeDate(mockStubs[4].date), false, []);
    getNote.mockResolvedValue(mockNote);
    navigator.canShare = vi.fn().mockImplementation(() => true);
    navigator.share = vi.fn().mockImplementation(
      () => Promise.reject(new DOMException("unit test", "NotAllowedError")));
    vitest.spyOn(console, 'info').mockImplementation(() => null);
    vitest.spyOn(console, 'error').mockImplementation(() => null);
    vitest.spyOn(window, 'postMessage');

    render(<List changeCount={() => {}} handleSelect={() => {}} ></List>);
    await screen.findAllByRole('listitem');
    const item = screen.getByText("CORS", {exact: false});
    await userEvent.dblClick(item);
    await userEvent.click(screen.getByRole('button', {name: "Share file"}));

    expect(navigator.share).toHaveBeenCalledOnce();
    const file = new File([content], "CORS.html", {type: 'text/html', endings: 'native'});
    expect(navigator.share).toHaveBeenCalledWith({title: "CORS", text: `# Cross-Origin Resource Sharing

...is an HTTP-header based mechanism`, files: [file]});
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching("“CORS” as text/html file"), new DOMException("unit test", "NotAllowedError"));
    expect(window.postMessage).not.toHaveBeenCalled();

    let dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', {name: "Share"}));

    expect(navigator.share).toHaveBeenCalledTimes(2);
    expect(navigator.share).toHaveBeenCalledWith({title: "CORS", text: `# Cross-Origin Resource Sharing

...is an HTTP-header based mechanism`});
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching("retried share “CORS”"), new DOMException("unit test", "NotAllowedError"));

    dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', {name: "Send email"}));

    // no way to test setting window.location to mailto: URL
    expect(console.info).toHaveBeenCalledWith("sharing via:", expect.stringMatching('mailto:'))
    // await waitForElementToBeRemoved(within(dialog).queryByRole('button', {name: "Send email"}));
    // expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
    // expect(screen.queryByRole('button', {name: "Share"})).toBeFalsy();
  });

  it("should show Share & Cancel buttons on double-click & check if files can be shared", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = "<h1>Cross-Origin Resource Sharing</h1><p>...is an HTTP-header based mechanism</p>";
    const mockNote = new SerializedNote(mockStubs[4].id, 'text/html;hint=SEMANTIC', mockStubs[4].title,
      content, normalizeDate(mockStubs[4].date), false, []);
    getNote.mockResolvedValue(mockNote);

    navigator.canShare = vi.fn().mockImplementation(() => false);
    navigator.share = vi.fn().mockImplementation(() => Promise.resolve());
    vitest.spyOn(console, 'warn').mockImplementation(() => null);
    vitest.spyOn(console, 'error').mockImplementation(() => null);
    vitest.spyOn(window, 'postMessage');

    render(<List changeCount={() => {}} handleSelect={() => {}} ></List>);
    await screen.findAllByRole('listitem');
    const item = screen.getByText("CORS", {exact: false});
    await userEvent.dblClick(item);
    await userEvent.click(screen.getByRole('button', {name: "Share file"}));

    expect(navigator.canShare).toHaveBeenCalledOnce();
    expect(navigator.share).toHaveBeenCalledOnce();
    expect(navigator.share).toHaveBeenCalledWith({title: "CORS", text: `# Cross-Origin Resource Sharing

...is an HTTP-header based mechanism`});
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching("files"));
    expect(window.postMessage).toHaveBeenCalledOnce();
    expect(window.postMessage).toHaveBeenCalledWith({kind: 'TRANSIENT_MSG', severity: 'warning',
      message: "The browser only allowed a text version to be shared.", atTop: true}, undefined);

    // expect(screen.queryByRole('button', {name: "Share files"})).toBeVisible();   // sliding closed at this point
    // expect(screen.queryByRole('button', {name: "Cancel"})).toBeVisible();
    // await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share files"}));
    // expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });

  it("should show dialog if Web Share API not supported then cancel", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = "<h1>Cross-Origin Resource Sharing</h1><p>...is an HTTP-header based mechanism</p>";
    const mockNote = new SerializedNote(mockStubs[4].id, 'text/html;hint=SEMANTIC', mockStubs[4].title,
      content, normalizeDate(mockStubs[4].date), false, []);
    getNote.mockResolvedValue(mockNote);
    delete navigator.canShare;
    delete navigator.share;

    vitest.spyOn(console, 'info').mockImplementation(() => null);
    vitest.spyOn(console, 'warn').mockImplementation(() => null);
    vitest.spyOn(console, 'error').mockImplementation(() => null);
    vitest.spyOn(window, 'postMessage');

    render(<List changeCount={() => {}} handleSelect={() => {}} ></List>);
    await screen.findAllByRole('listitem');
    const item = screen.getByText("CORS", {exact: false});
    await userEvent.dblClick(item);
    await userEvent.click(screen.getByRole('button', {name: "Share text"}));

    const dialog = await screen.findByRole('dialog');
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(window.postMessage).not.toHaveBeenCalled();
    expect(within(dialog).queryByRole('button', {name: "Send email"})).toBeTruthy();

    await userEvent.click(screen.getAllByRole('button', {name: "Cancel"})[1]);

    // no way to test setting window.location to mailto: URL
    expect(console.info).not.toHaveBeenCalled();
    // await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share"}));
    // expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
    // expect(screen.queryByRole('button', {name: "Send email"})).toBeFalsy();
  });

  it("should show dialog if Web Share API not supported then email", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = "<h1>Cross-Origin Resource Sharing</h1><p>...is an HTTP-header based mechanism</p>";
    const mockNote = new SerializedNote(mockStubs[4].id, 'text/html;hint=SEMANTIC', mockStubs[4].title,
      content, normalizeDate(mockStubs[4].date), false, []);
    getNote.mockResolvedValue(mockNote);
    delete navigator.canShare;
    delete navigator.share;

    vitest.spyOn(console, 'info').mockImplementation(() => null);
    vitest.spyOn(console, 'warn').mockImplementation(() => null);
    vitest.spyOn(console, 'error').mockImplementation(() => null);
    vitest.spyOn(window, 'postMessage');

    render(<List changeCount={() => {}} handleSelect={() => {}} ></List>);
    await screen.findAllByRole('listitem');
    const item = screen.getByText("CORS", {exact: false});
    await userEvent.dblClick(item);
    await userEvent.click(screen.getByRole('button', {name: "Share text"}));

    const dialog = await screen.findByRole('dialog');
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(window.postMessage).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', {name: "Cancel"})).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', {name: "Send email"}));

    // no way to test setting window.location to mailto: URL
    expect(console.info).toHaveBeenCalledWith("sharing via:", expect.stringMatching('mailto:'))
    // await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Send email"}));
    // await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share"}));
    // expect(screen.queryByRole('button', {name: "Cancel"})).toBeFalsy();
  });
});
