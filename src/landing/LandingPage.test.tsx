import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { startOpenRouterOAuth } from "../lib/openrouterAuth";
import LandingPage from "./LandingPage";

vi.mock("../lib/openrouterAuth", () => ({ startOpenRouterOAuth: vi.fn() }));

beforeEach(() => vi.mocked(startOpenRouterOAuth).mockReset());

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("opens immediately and lets a visitor explore a cited answer and practise", () => {
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { level: 1, name: "Rough thought, polished." })).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  for (const link of screen.getAllByRole("link", { name: "Open Studio" })) {
    expect(link).toHaveAttribute("href", "/studio");
  }

  const navigation = screen.getByRole("navigation", { name: "Main navigation" });
  for (const link of within(navigation).getAllByRole("link")) {
    expect(document.querySelector(link.getAttribute("href")!)).not.toBeNull();
  }
  expect(screen.getByRole("link", { name: "View source, Study notes page 12" })).toHaveAttribute("href", "#sample-source");
  expect(document.getElementById("sample-source")).toHaveTextContent("Retrieval practice means bringing information to mind without looking at the source.");

  fireEvent.click(screen.getByRole("button", { name: "How can I try this with my own notes?" }));
  expect(screen.getByText(/Read a short section, put it aside/)).toBeVisible();
  fireEvent.click(screen.getByRole("radio", { name: "Practise" }));
  fireEvent.click(screen.getByRole("button", { name: "Read the same paragraph again" }));
  expect(screen.getByRole("status")).toHaveTextContent("Try again.");
  fireEvent.click(screen.getByRole("button", { name: "Close your notes and explain the idea" }));
  expect(screen.getByRole("status")).toHaveTextContent("Exactly.");
});

it("keeps setup optional and makes mobile navigation keyboard accessible", async () => {
  render(<MemoryRouter><LandingPage /></MemoryRouter>);

  fireEvent.click(screen.getByRole("button", { name: "Set up with a guide" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

  const toggle = screen.getByRole("button", { name: "Open navigation" });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  const firstLink = screen.getByRole("link", { name: "How it works" });
  expect(firstLink).toHaveFocus();
  fireEvent.keyDown(firstLink, { key: "Escape" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle).toHaveFocus();
});

it("reports a failed model connection", async () => {
  vi.mocked(startOpenRouterOAuth).mockRejectedValueOnce(new Error("Connection unavailable"));
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Connect OpenRouter" }));
  expect(startOpenRouterOAuth).toHaveBeenCalledOnce();
  expect(await screen.findByRole("alert", {}, { timeout: 5000 })).toHaveTextContent("add your key in Studio under AI Models");
});

it("turns the field guide recall card and links to a real study notebook", () => {
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  const guide = screen.getByRole("region", { name: "There’s more than one way into a chapter." });
  const card = within(guide).getByRole("article", { name: "Sample recall card" });
  const turn = within(card).getByRole("button", { name: "Turn the card" });
  expect(within(card).getByRole("heading", { name: "Close the page. What stayed?" })).toBeVisible();
  expect(within(card).queryByRole("heading", { name: "Familiar isn’t remembered." })).not.toBeInTheDocument();
  fireEvent.click(turn);
  expect(turn).toHaveAttribute("aria-pressed", "true");
  expect(within(card).getByRole("heading", { name: "Familiar isn’t remembered." })).toBeVisible();
  expect(within(card).getByText("Recognition uses a clue in front of you. Recall brings the idea to mind without that clue.")).toBeVisible();
  fireEvent.click(turn);
  expect(turn).toHaveAttribute("aria-pressed", "false");
  expect(within(card).getByRole("heading", { name: "Close the page. What stayed?" })).toBeVisible();
  expect(within(guide).getByRole("link", { name: "Find your way in Studio" })).toHaveAttribute("href", "/studio");
});
