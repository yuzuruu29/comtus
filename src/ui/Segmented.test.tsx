import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Segmented } from "./Segmented";

afterEach(() => {
  cleanup();
});

const OPTIONS = [
  { value: "cards" as const, label: "Cards" },
  { value: "list" as const, label: "List" },
  { value: "table" as const, label: "Table" },
];

describe("Segmented", () => {
  it("exposes a radiogroup of radio options", () => {
    render(<Segmented value="cards" onChange={() => {}} options={OPTIONS} aria-label="View" />);
    expect(screen.getByRole("radiogroup", { name: "View" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios[1]).toHaveAttribute("aria-checked", "false");
  });

  it("moves selection with arrow keys and wraps at the ends", () => {
    const onChange = vi.fn();
    render(<Segmented value="cards" onChange={onChange} options={OPTIONS} aria-label="View" />);
    const cards = screen.getByRole("radio", { name: "Cards" });
    cards.focus();

    fireEvent.keyDown(cards, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("list");

    fireEvent.keyDown(cards, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("table");
  });
});
