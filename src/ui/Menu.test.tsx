import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { Menu } from "./Menu";
import { IconButton } from "./IconButton";

afterEach(cleanup);

it("moves focus through enabled actions and returns it on Escape", () => {
  render(<Menu aria-label="Notebook actions" trigger={<IconButton aria-label="Notebook actions">More</IconButton>} items={[
    { key: "locked", label: "Unavailable", disabled: true, onSelect: vi.fn() },
    { key: "rename", label: "Rename", onSelect: vi.fn() },
    { key: "export", label: "Export", onSelect: vi.fn() },
  ]} />);
  const trigger = screen.getByRole("button", { name: "Notebook actions" });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
  expect(screen.getByRole("menuitem", { name: "Export" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
  expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: "End" });
  expect(screen.getByRole("menuitem", { name: "Export" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});

it("opens at the last action with ArrowUp and activates the selected action", () => {
  const select = vi.fn();
  render(<Menu aria-label="Actions" trigger={<button>Actions</button>} items={[
    { key: "first", label: "First", onSelect: vi.fn() },
    { key: "last", label: "Last", onSelect: select },
  ]} />);
  const trigger = screen.getByRole("button", { name: "Actions" });
  fireEvent.keyDown(trigger, { key: "ArrowUp" });
  expect(screen.getByRole("menuitem", { name: "Last" })).toHaveFocus();
  fireEvent.click(document.activeElement!);
  expect(select).toHaveBeenCalledOnce();
  expect(trigger).toHaveFocus();
});
