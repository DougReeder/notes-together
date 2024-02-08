// List.test.js - automated tests for List component for Notes Together
// Copyright © 2021–2024 Doug Reeder

import {
  render,
  screen, waitFor, waitForElementToBeRemoved, within,
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


  it("should ensure Details are displayed on second click", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();
    const user = userEvent.setup();

    render(<List changeCount={() => {}}
                 selectedNoteId="cba4c6fd-abf4-4f68-91ab-979fdf233606"
                 handleSelect={mockHandleSelect}
    ></List>);
    const items = await screen.findAllByRole('listitem');
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await user.click(items[2]);

    expect(mockHandleSelect).toHaveBeenCalledWith("cba4c6fd-abf4-4f68-91ab-979fdf233606", 'DETAIL');
  });


  it("should show item buttons on right-click then hide on Escape key", async () => {
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

    await userEvent.pointer([{keys: '[MouseRight]', target: items[0]}]);
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Delete"}));
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();
  });

  it("should show item buttons on right-click then hide on click outside list", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();
    navigator.share = vi.fn().mockImplementation(() => Promise.resolve());

    render(<><List changeCount={() => {}} handleSelect={mockHandleSelect}></List><input type="text"></input></>);
    const items = await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();

    await userEvent.pointer([{keys: '[MouseRight]', target: items[0]}]);
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();

    await userEvent.click(screen.getByRole('textbox'));
    await waitFor(() => expect(screen.queryAllByRole('button', {name: "Delete"})).toHaveLength(0));
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(navigator.share).not.toHaveBeenCalled();
  });

  it("should show item buttons on right-click, switch to another, then hide when the list is clicked outside items", async () => {
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

    const item2 = screen.getByText("Uncommon Women (1983)", {exact: false});
    await userEvent.pointer([{keys: '[MouseRight]', target: item2}]);
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();

    const item3 = screen.getByText("machine:", {exact: false});
    await userEvent.pointer([{keys: '[MouseRight]', target: item3}]);
    expect((await screen.findAllByRole('button', {name: "Share text"})).length).toBeGreaterThanOrEqual(1);
    // expect(screen.getAllByRole('button', {name: "Share text"})).toHaveLength(2);
    expect((await screen.findAllByRole('button', {name: "Share file"})).length).toBeGreaterThanOrEqual(1);
    // expect(screen.getAllByRole('button', {name: "Share file"})).toHaveLength(2);

    await userEvent.click(screen.getByRole('list'));   // outside any item
    await waitFor(() => expect(screen.queryAllByRole('button', {name: "Share text"})).toHaveLength(0));
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).toHaveBeenCalledOnce();
  });


  it("should not show Delete button on control-backspace when no note selected", async () => {
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

    await userEvent.keyboard('{Control>}{Backspace}{/Control}');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
  });

  it("should show Delete button on control-backspace then hide on click outside list", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const mockHandleSelect = vitest.fn();

    render(<><List changeCount={() => {}}
                 selectedNoteId='f5af3107-fc12-4291-88ff-e0d64b962e49'
                 handleSelect={mockHandleSelect}
                ></List><input type="text"></input></>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();

    await userEvent.keyboard('{Control>}{Backspace}{/Control}');
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();
    expect(deleteNote).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('textbox'));
    expect(deleteNote).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryAllByRole('button', {name: "Delete"})).toHaveLength(0));
  });

  it("should show Delete button on meta-delete key then delete note on Delete click", async () => {
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

    await userEvent.keyboard('{Meta>}{Delete}{/Meta}');
    const deleteBtn = screen.getByRole('button', {name: "Delete"});
    expect(deleteBtn).toBeVisible();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(deleteBtn);
    expect(deleteNote).toHaveBeenCalledWith(someNoteId);
    expect(mockHandleSelect).toHaveBeenCalledWith(null);
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
  });

  it("should show Delete button on meta-backspace then delete on Enter key", async () => {
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

    await userEvent.keyboard('{Meta>}{Backspace}{/Meta}');
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();
    expect(deleteNote).not.toHaveBeenCalled();

    await userEvent.keyboard('{Enter}');
    expect(deleteNote).toHaveBeenCalledWith(someNoteId);
    expect(mockHandleSelect).toHaveBeenCalledWith(null);
    // mock deleteNote can't call postMessage
  });

  it("should show Delete button on control-delete key then delete on Space key", async () => {
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

    await userEvent.keyboard('{Control>}{Delete}{/Control}');
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(mockHandleSelect).not.toHaveBeenCalled();
    expect(deleteNote).not.toHaveBeenCalled();

    await userEvent.keyboard(' ');
    expect(deleteNote).toHaveBeenCalledWith(someNoteId);
    expect(mockHandleSelect).toHaveBeenCalledWith(null);
    // mock deleteNote can't call postMessage
  });

  it("should show Delete button on control-backspace key then hide on Escape key", async () => {
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

    await userEvent.keyboard('{Control>}{Backspace}{/Control}');
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();   // not selected

    await userEvent.keyboard('{Escape}');
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Delete"}));
    expect(deleteNote).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();   // not cleared after delete
  });

  it("should show Delete button on right-click & delete non-selected item on Delete click", async () => {
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
    expect(deleteNote).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();   // not selected

    await userEvent.pointer([{keys: '[MouseRight]', target: items[1]}]);
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Delete"}));
    expect(deleteNote).toHaveBeenCalledWith("615df9ff-89ab-4d51-b64d-0e82b2dfc2b6");
    expect(mockHandleSelect).not.toHaveBeenCalled();   // deleted item was not selected
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
  });

  it("should show Delete button on right-click & delete selected item on Delete click", async () => {
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

    await userEvent.pointer([{keys: '[MouseRight]', target: items[3]}]);
    expect(screen.getByRole('button', {name: "Delete"})).toBeVisible();
    expect(deleteNote).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Delete"}));
    expect(deleteNote).toHaveBeenCalledWith('f5af3107-fc12-4291-88ff-e0d64b962e49');
    expect(mockHandleSelect).toHaveBeenCalled();   // deleted item was selected
    expect(screen.queryByRole('button', {name: "Delete"})).toBeFalsy();
  });


  it("should show Share buttons on right-click & share non-selected HTML note w/ file on Share file click", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = `<h1>Cross-Origin Resource Sharing</h1><p>...is an HTTP-header based mechanism</p>
<img src="https://example.com/" alt="Example picture" title="Cool stuff" />
<img src="data:image/png;base64,iVBORw0KGgoAAAANSUh" alt="Data picture" title="Nifty thing" />
<img src="data:image/jpeg;base64,OGIEOEOLEJEIIJFIE" title="calm lake" />
<img src="data:image/webp;base64,LKJFDOFDSOI" />`;
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

    const item = screen.getByText("CORS", {exact: false});
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Share file"}));
    expect(navigator.share).toHaveBeenCalledOnce();
    const file = new File([content], "CORS.html", {type: 'text/html', endings: 'native'});
    expect(navigator.share).toHaveBeenCalledWith({title: "CORS", text: `# Cross-Origin Resource Sharing

...is an HTTP-header based mechanism
![Example picture](https://example.com/ "Cool stuff")
Data picture
calm lake
«graphic»`, files: [file]});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
  });

  it("should show Share buttons on right-click & share non-selected HTML note w/ file on Space key", async () => {
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

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect}></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();

    const item = screen.getByText("CORS", {exact: false});
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.keyboard(' ');
    expect(navigator.share).toHaveBeenCalledOnce();
    const file = new File([content], "CORS.html", {type: 'text/html', endings: 'native'});
    expect(navigator.share).toHaveBeenCalledWith({title: "CORS", text: `# Cross-Origin Resource Sharing

...is an HTTP-header based mechanism`, files: [file]});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
  });

  it("should show Share buttons on right-click & share selected HTML note w/ file on Space key", async () => {
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

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect}
                 selectedNoteId="ca5a278b-1959-45da-9431-d3bd856c8733"></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();

    const item = screen.getByText("CORS", {exact: false});
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.keyboard(' ');
    expect(navigator.share).toHaveBeenCalledOnce();
    const file = new File([content], "CORS.html", {type: 'text/html', endings: 'native'});
    expect(navigator.share).toHaveBeenCalledWith({title: "CORS", text: `# Cross-Origin Resource Sharing

...is an HTTP-header based mechanism`, files: [file]});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
  });

  it("should show Share buttons on right-click & share non-selected HTML note as Markdown text", async () => {
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

    const item = screen.getByText("CORS", {exact: false});
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Share text"}));
    expect(navigator.share).toHaveBeenCalledOnce();
    expect(navigator.share).toHaveBeenCalledWith({title: "CORS", text: `# Cross-Origin Resource Sharing

...is an HTTP-header based mechanism`});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share text"}));
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
  });

  it("should show Share buttons on command-period & share selected HTML note w/ file on Space key", async () => {
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

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect}
                 selectedNoteId="ca5a278b-1959-45da-9431-d3bd856c8733"></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();

    await userEvent.keyboard('{Meta>}.{/Meta}');
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.keyboard(' ');
    expect(navigator.share).toHaveBeenCalledOnce();
    const file = new File([content], "CORS.html", {type: 'text/html', endings: 'native'});
    expect(navigator.share).toHaveBeenCalledWith({title: "CORS", text: `# Cross-Origin Resource Sharing

...is an HTTP-header based mechanism`, files: [file]});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected by this

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
  });

  it("should show Share buttons on command-comma & share selected HTML note as text on Space key", async () => {
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

    render(<List changeCount={() => {}} handleSelect={mockHandleSelect}
                 selectedNoteId="ca5a278b-1959-45da-9431-d3bd856c8733"></List>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('button', {name: "Share text"})).toBeFalsy();
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();

    await userEvent.keyboard('{Meta>},{/Meta}');
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.keyboard(' ');
    expect(navigator.share).toHaveBeenCalledOnce();
    expect(navigator.share).toHaveBeenCalledWith({title: "CORS", text: `# Cross-Origin Resource Sharing

...is an HTTP-header based mechanism`});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected by this

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share text"}));
    expect(screen.queryByRole('button', {name: "Share file"})).toBeFalsy();
  });

  it("should show Share buttons on right-click & share selected Markdown item w/ file", async () => {
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

    const item = screen.getByText("Uncommon Women (1983)", {exact: false});
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Share file"}));
    expect(navigator.share).toHaveBeenCalledOnce();
    const file = new File([content], "Uncommon Women (1983).html", {type: 'text/markdown', endings: 'native'});
    expect(navigator.share).toHaveBeenCalledWith({title: "Uncommon Women (1983)", text: content, files: [file]});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
  });

  it("should show Share buttons on right-click & share selected Markdown item as text", async () => {
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

    const item = screen.getByText("Uncommon Women (1983)", {exact: false});
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Share text"}));
    expect(navigator.share).toHaveBeenCalledOnce();
    expect(navigator.share).toHaveBeenCalledWith({title: "Uncommon Women (1983)", text: content});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
  });

  it("should show Share buttons on right-click & share non-selected Litewrite item w/ file", async () => {
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

    const item = screen.getByText("A shallow cash-grab.", {exact: false});
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Share file"}));
    expect(navigator.share).toHaveBeenCalledOnce();
    const file = new File([content], "A shallow cash-grab..html", {type: 'text/plain', endings: 'native'});
    expect(navigator.share).toHaveBeenCalledWith({title: "A shallow cash-grab.", text: content, files: [file]});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
  });

  it("should show Share buttons on right-click & share non-selected Litewrite item as text", async () => {
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

    const item = screen.getByText("A shallow cash-grab.", {exact: false});
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Share text"}));
    expect(navigator.share).toHaveBeenCalledOnce();
    expect(navigator.share).toHaveBeenCalledWith({title: "A shallow cash-grab.", text: content});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(window.postMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
  });

  it("should show Share buttons on right-click & share selected YAML item w/ file", async () => {
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

    const item = screen.getByText("machine:", {exact: false});
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
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
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
  });

  it("should show Share buttons on right-click & share selected YAML item as text", async () => {
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

    const item = screen.getByText("machine:", {exact: false});
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    expect(screen.getByRole('button', {name: "Share text"})).toBeVisible();
    expect(screen.getByRole('button', {name: "Share file"})).toBeVisible();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(mockHandleSelect).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Share text"}));
    expect(navigator.share).toHaveBeenCalledOnce();
    expect(navigator.share).toHaveBeenCalledWith({title: "machine:", text: content});
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(window.postMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    expect(mockHandleSelect).not.toHaveBeenCalled();   // shared item was not selected

    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
  });

  it("should show Share buttons on right-click & message user when note missing", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    getNote.mockResolvedValue(undefined);
    navigator.canShare = vi.fn().mockImplementation(() => true);
    navigator.share = vi.fn().mockImplementation(() => Promise.resolve());
    vitest.spyOn(console, 'info').mockImplementation(() => null);
    vitest.spyOn(console, 'error').mockImplementation(() => null);
    vitest.spyOn(window, 'postMessage');

    render(<List changeCount={() => {}} handleSelect={() => {}} ></List>);
    await screen.findAllByRole('listitem');
    const item = screen.getByText("CORS", {exact: false});
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    await userEvent.click(screen.getByRole('button', {name: "Share file"}));

    expect(navigator.share).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledOnce();
    expect(window.postMessage).toHaveBeenCalled();
    expect(window.postMessage).toHaveBeenCalledWith(expect.objectContaining({kind: 'TRANSIENT_MSG', severity: 'error',
      message: "Did you delete this note in another tab?"}), 'https://testorigin.org');
    expect(screen.queryByRole('dialog')).toBeFalsy();

    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share text"}));
  });

  it("should show Share buttons on right-click & not message user when Share aborted", async () => {
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
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    await userEvent.click(screen.getByRole('button', {name: "Share text"}));

    expect(navigator.share).toHaveBeenCalledOnce();
    expect(console.error).not.toHaveBeenCalled();
    expect(window.postMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeFalsy();

    expect(screen.queryByRole('button', {name: "Share text"})).toBeVisible();   // sliding closed at this point
    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share text"}));
  });

  it("should show Share buttons on right-click & show dialog on DataError", async () => {
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
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    await userEvent.click(screen.getByRole('button', {name: "Share text"}));

    expect(navigator.share).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching("CORS"), new DOMException("unit test", "DataError"));
    expect(window.postMessage).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog', {name: "Send text version of “CORS” via email?"});
    expect(within(dialog).getByText("unit test")).toBeVisible();
    expect(within(dialog).queryByRole('button', {name: "Send email"})).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('button', {name: "Cancel"}));

    // no way to test setting window.location to mailto: URL
    // await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Cancel"}));
    expect(screen.queryByRole('button', {name: "Cancel"})).not.toBeVisible();
    expect(within(dialog).queryByRole('button', {name: "Send email"})).not.toBeVisible();
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
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    await userEvent.click(screen.getByRole('button', {name: "Share file"}));

    expect(navigator.share).toHaveBeenCalledOnce();
    const file = new File([content], "CORS.html", {type: 'text/html', endings: 'native'});
    expect(navigator.share).toHaveBeenCalledWith({title: "CORS", text: `# Cross-Origin Resource Sharing

...is an HTTP-header based mechanism`, files: [file]});
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching("“CORS” as text/html file"), new DOMException("unit test", "NotAllowedError"));
    expect(window.postMessage).not.toHaveBeenCalled();

    let dialog = await screen.findByRole('dialog', {name: "Share text version of “CORS” without file?"});
    expect(within(dialog).getByText("You aren't allowed to Share that as a file.", {})).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', {name: "Share"}));

    expect(navigator.share).toHaveBeenCalledTimes(2);
    expect(navigator.share).toHaveBeenCalledWith({title: "CORS", text: `# Cross-Origin Resource Sharing

...is an HTTP-header based mechanism`});
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching("tried share “CORS”"), new DOMException("unit test", "NotAllowedError"));

    dialog = await screen.findByRole('dialog', {name: "Send text version of “CORS” via email?"});
    expect(within(dialog).getByText("You aren't allowed to Share that.", {})).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', {name: "Send email"}));

    // no way to test setting window.location to mailto: URL
    expect(console.info).toHaveBeenCalledWith("sending via:", expect.stringMatching('mailto:'))
    // await waitForElementToBeRemoved(within(dialog).queryByRole('button', {name: "Send email"}));
  });

  it("should show dialog on Share NotAllowedError for uncommon text file, ask to retry w/ plain text file", async () => {
    mockStubList = mockStubs.map(stub => {
      return {id: stub.id, title: stub.title, date: new Date(stub.date)}
    });
    const content = `machine:
  ruby:
    version: 2.1.3`;
    const mockNote = new SerializedNote(mockStubs[2].id, 'text/x-yaml', mockStubs[2].title,
      content, normalizeDate(mockStubs[2].date), false, []);
    getNote.mockResolvedValue(mockNote);
    navigator.canShare = vi.fn().mockImplementation(() => true);
    navigator.share = vi.fn().mockImplementation(
      () => Promise.reject(new DOMException("unit test", "NotAllowedError")));
    vitest.spyOn(console, 'info').mockImplementation(() => null);
    vitest.spyOn(console, 'error').mockImplementation(() => null);
    vitest.spyOn(window, 'postMessage');

    render(<List changeCount={() => {}} handleSelect={() => {}} ></List>);
    await screen.findAllByRole('listitem');
    const item = screen.getByText("machine:", {exact: false});
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    await userEvent.click(screen.getByRole('button', {name: "Share file"}));

    expect(navigator.share).toHaveBeenCalledOnce();
    let file = new File([content], "machine.yaml", {type: 'text/x-yaml', endings: 'native'});
    expect(navigator.share).toHaveBeenCalledWith({title: "machine:", text: content, files: [file]});
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching("Permission to share “machine:”"), new DOMException("unit test", "NotAllowedError"));
    expect(window.postMessage).not.toHaveBeenCalled();
    let dialog = await screen.findByRole('dialog', {name: "Share “machine:” as plain text file?"});
    expect(within(dialog).getByText("You aren't allowed to Share that as a x-yaml file.", {})).toBeVisible();

    await userEvent.click(within(dialog).getByRole('button', {name: "Share"}));

    expect(navigator.share).toHaveBeenCalledTimes(2);
    file = new File([content], "machine.yaml.txt", {type: 'text/plain', endings: 'native'});
    expect(navigator.share).toHaveBeenCalledWith({title: "machine:", text: content, files: [file]});
    expect(console.error).toHaveBeenCalledTimes(2);
    dialog = await screen.findByRole('dialog', {name: "Share text version of “machine:” without file?"});
    expect(within(dialog).getByText("You aren't allowed to Share that as a file.", {})).toBeVisible();

    await userEvent.click(within(dialog).getByRole('button', {name: "Share"}));

    expect(navigator.share).toHaveBeenCalledTimes(3);
    expect(navigator.share).toHaveBeenCalledWith({title: "machine:", text: content});
    expect(console.error).toHaveBeenCalledTimes(3);
    dialog = await screen.findByRole('dialog', {name: "Send text version of “machine:” via email?"});
    expect(within(dialog).getByText("You aren't allowed to Share that.", {})).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', {name: "Send email"}));

    // no way to test setting window.location to mailto: URL
    expect(console.info).toHaveBeenCalledWith("sending via:", expect.stringMatching('mailto:'))
    // await waitForElementToBeRemoved(within(dialog).queryByRole('button', {name: "Send email"}));
  });

  it("should show Share buttons on right-click & check if files can be shared", async () => {
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
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    await userEvent.click(screen.getByRole('button', {name: "Share file"}));

    expect(navigator.canShare).toHaveBeenCalledOnce();
    expect(navigator.share).toHaveBeenCalledOnce();
    expect(navigator.share).toHaveBeenCalledWith({title: "CORS", text: `# Cross-Origin Resource Sharing

...is an HTTP-header based mechanism`});
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching("files"));
    expect(window.postMessage).toHaveBeenCalledOnce();
    // expect(window.postMessage).toHaveBeenCalledWith({kind: 'TRANSIENT_MSG', severity: 'warning',
    //   message: "The browser only allowed a text version to be shared.", atTop: true}, 'https://testorigin.org');

    expect(screen.queryByRole('button', {name: "Share file"})).toBeVisible();   // sliding closed at this point
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Share file"}));
  });

  it("should show Share buttons on right-click, check if text can be shared, then ask to send email", async () => {
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
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);

    await userEvent.click(screen.getByRole('button', {name: "Share text"}));

    expect(navigator.canShare).toHaveBeenCalledOnce();
    expect(navigator.share).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching("not been granted"));
    let dialog = await screen.findByRole('dialog', {name: "Send text version of “CORS” via email?"});
    expect(within(dialog).getByText("Permission to Share has not been granted.", {})).toBeVisible();

    await userEvent.click(within(dialog).getByRole('button', {name: "Send email"}));

    // no way to test setting window.location to mailto: URL
    expect(console.info).toHaveBeenCalledWith("sending via:", expect.stringMatching('mailto:'))
    expect(navigator.share).not.toHaveBeenCalled();
    expect(window.postMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', {name: "Send text version of “CORS” via email?"})).toBeFalsy();
  });

  it("should email if Web Share API not supported", async () => {
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
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    await userEvent.click(screen.getByRole('button', {name: "Send text via email"}));

    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(window.postMessage).not.toHaveBeenCalled();

    // no way to test setting window.location to mailto: URL
    expect(console.info).toHaveBeenCalledWith("sending via:", expect.stringMatching('mailto:'))
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Send text via email"}));
  });

  it("should focus email button if Web Share API not supported", async () => {
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
    await userEvent.pointer([{keys: '[MouseRight]', target: item}]);
    await userEvent.keyboard(' ');

    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(window.postMessage).not.toHaveBeenCalled();

    // no way to test setting window.location to mailto: URL
    expect(console.info).toHaveBeenCalledWith("sending via:", expect.stringMatching('mailto:'))
    await waitForElementToBeRemoved(screen.queryByRole('button', {name: "Send text via email"}));
  });
});
