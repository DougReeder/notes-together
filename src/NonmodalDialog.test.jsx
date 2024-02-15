// NonmodalDialog.test.jsx — for Notes Together
// Copyright © 2024 Doug Reeder

import {NonmodalDialog} from "./NonmodalDialog.jsx";
import {vitest} from "vitest";
import {render, screen} from "@testing-library/react";
import '@testing-library/jest-dom/vitest'
import userEvent from "@testing-library/user-event";

describe("NonmodalDialog", () => {
  let mockCancel = vitest.fn();
  let mockOk = vitest.fn();

  it("should open and close as `open` prop changes", () => {
    const {rerender} = render(<NonmodalDialog onCancel={mockCancel} title="" message=""
                                              open={false}></NonmodalDialog>);
    expect(screen.queryByRole('dialog')).toBeFalsy();

    rerender(<NonmodalDialog onCancel={mockCancel} title="When you're ready" message="So..."
                           open={true}></NonmodalDialog>);

    expect(screen.queryByRole('dialog', {name: "When you're ready"})).toBeVisible();
    expect(screen.getByText("So...")).toBeVisible();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeVisible();
    expect(screen.queryByRole('button', {name: "Ok"})).toBeFalsy();   // no onOk function

    rerender(<NonmodalDialog onCancel={mockCancel} title="When you're ready" message="So..."
                             open={false}></NonmodalDialog>);

    expect(screen.queryByRole('dialog')).not.toBeVisible();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("should call onCancel when Cancel button clicked", async () => {
    render(<NonmodalDialog onCancel={mockCancel} title="Hey, there" message=""
                           open={true}></NonmodalDialog>);
    expect(screen.queryByRole('dialog', {name: "Hey, there"})).toBeVisible();
    expect(screen.queryByRole('button', {name: "Cancel"})).toBeVisible();

    await userEvent.click(screen.getByRole('button', {name: "Cancel"}));

    expect(mockCancel).toHaveBeenCalledOnce();
    expect(mockOk).not.toHaveBeenCalled();
  });

  it("should call onOk when Ok button clicked", async () => {
    render(<NonmodalDialog open={true} title="I have a question" message=""
                           onOk={mockOk} onCancel={mockCancel} ></NonmodalDialog>);
    expect(screen.queryByRole('dialog', {name: "I have a question"})).toBeVisible();
    expect(screen.queryByRole('button', {name: "Ok"})).toBeVisible();
    expect(mockOk).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: "Ok"}));

    expect(mockOk).toHaveBeenCalledOnce();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("should initially focus Ok button", async () => {
    render(<NonmodalDialog open={true} title="Should I do this?" message=""
                           onOk={mockOk} onCancel={mockCancel} ></NonmodalDialog>);
    expect(screen.queryByRole('dialog', {name: "Should I do this?"})).toBeVisible();
    expect(screen.queryByRole('button', {name: "Ok"})).toBeVisible();

    await userEvent.keyboard(' ');

    expect(mockOk).toHaveBeenCalledOnce();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("should call onCancel on Escape key", async () => {
    render(<NonmodalDialog open={true} title="Do dangerous thing?" message=""
                           onCancel={mockCancel} ></NonmodalDialog>);
    expect(screen.queryByRole('dialog', {name: "Do dangerous thing?"})).toBeVisible();

    await userEvent.keyboard('{Escape}');

    expect(mockCancel).toHaveBeenCalledOnce();
    expect(mockOk).not.toHaveBeenCalled();
  });
});
