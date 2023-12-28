// Note.test.js - automated tests for note constructors for RemoteStorage
// Copyright © 2023-2024 Doug Reeder

import {NodeNote} from "./Note.js";
import generateTestId from "./util/generateTestId.js";
import {validate as uuidValidate} from "uuid";

describe("NodeNote", () => {
  it("should set id to a new UUID if it's not valid", () => {
    const nodeNote = new NodeNote(undefined, undefined, undefined, undefined, undefined);

    expect(uuidValidate(nodeNote.id)).toBeTruthy()
  });

  it("should ensure subtype is a string", () => {
    const nodeNote = new NodeNote(undefined, undefined, undefined, undefined, undefined);

    expect(typeof nodeNote.subtype).toEqual('string');
  });

  it("should ensure nodes is an array", () => {
    const nodeNote = new NodeNote(undefined, undefined, undefined, undefined, undefined);

    expect(Array.isArray(nodeNote.nodes)).toBeTruthy();
    expect(nodeNote.nodes).toEqual([]);
  })

  it("should pass through a date of type Date", () => {
    const date = new Date('2021-02-01T09:00:00.000Z');
    const nodeNote = new NodeNote(generateTestId(), 'plain', [], date, false);

    expect(nodeNote.date).toBeInstanceOf(Date);
    expect(nodeNote.date).toEqual(date);
  });

  it("should parse a string date into a Date", () => {
    const date = '2021-03-01T06:00:00.000Z';
    const nodeNote = new NodeNote(generateTestId(), 'plain', [], date, false);

    expect(nodeNote.date).toBeInstanceOf(Date);
    expect(nodeNote.date.toISOString()).toEqual(date);
  });

  it("should parse a number date into a Date", () => {
    const date = 1624176186133;
    const nodeNote = new NodeNote(generateTestId(), 'plain', [], date, false);

    expect(nodeNote.date).toBeInstanceOf(Date);
    expect(nodeNote.date.valueOf()).toEqual(date);
  });

  it("should use current date when passed a non-date, non-string in date field", () => {
    const date = document.documentElement;
    const nodeNote = new NodeNote(generateTestId(), 'plain', [], date, false);

    expect(nodeNote.date).toBeInstanceOf(Date);
    const today = new Date();
    expect(nodeNote.date.getFullYear()).toEqual(today.getFullYear());
    expect(nodeNote.date.getMonth()).toEqual(today.getMonth());
    expect(nodeNote.date.getDate()).toEqual(today.getDate());
  });


  it("should ensure isLocked is a boolean", () => {
    const nodeNote = new NodeNote(undefined, undefined, undefined, undefined, undefined);

    expect(typeof nodeNote.isLocked).toEqual('boolean');
    expect(nodeNote.isLocked).toEqual(false);
  });
});