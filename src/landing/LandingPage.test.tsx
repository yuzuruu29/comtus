import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Link, MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { startOpenRouterOAuth } from "../lib/openrouterAuth";
import LandingPage from "./LandingPage";
import { AboutPage, PrivacyPage } from "./StaticPages";

vi.mock("../lib/openrouterAuth", () => ({ startOpenRouterOAuth: vi.fn() }));

beforeEach(() => vi.mocked(startOpenRouterOAuth).mockReset());

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function PublicPageRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
    </Routes>
  );
}

function BackButton() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(-1)}>Go back</button>;
}

it("starts new public-page visits at the title without overriding back navigation", () => {
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(<MemoryRouter><BackButton /><PublicPageRoutes /></MemoryRouter>);
  expect(scrollTo).not.toHaveBeenCalled();

  const footer = screen.getByRole("navigation", { name: "Footer navigation" });
  fireEvent.click(within(footer).getByRole("link", { name: "About Comtus" }));
  // "instant": the landing glides between its own sections, and a new page must not glide.
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "instant" });
  expect(screen.getByRole("heading", { level: 1, name: "About Comtus" })).toHaveFocus();

  const index = screen.getByRole("navigation", { name: "Information pages" });
  fireEvent.click(within(index).getByRole("link", { name: "Privacy" }));
  expect(scrollTo).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toHaveFocus();

  const back = screen.getByRole("button", { name: "Go back" });
  back.focus();
  fireEvent.click(back);
  expect(screen.getByRole("heading", { level: 1, name: "About Comtus" })).toBeVisible();
  expect(scrollTo).toHaveBeenCalledTimes(2);
  expect(back).toHaveFocus();

  fireEvent.click(screen.getAllByRole("link", { name: "Comtus home" })[0]);
  expect(scrollTo).toHaveBeenCalledTimes(3);
  expect(screen.getByRole("heading", { level: 1, name: "From reading it to knowing it." })).toHaveFocus();
});

it("leaves hash navigation to its target instead of resetting public-page scroll or focus", () => {
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(
    <MemoryRouter initialEntries={["/about"]}>
      <Link to="/about#landing-main">Jump to content</Link>
      <PublicPageRoutes />
    </MemoryRouter>
  );
  const jump = screen.getByRole("link", { name: "Jump to content" });
  jump.focus();
  fireEvent.click(jump);
  expect(scrollTo).not.toHaveBeenCalled();
  expect(jump).toHaveFocus();
});

it("opens immediately and lets a visitor explore a cited answer and practise", () => {
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { level: 1, name: "From reading it to knowing it." })).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  for (const link of screen.getAllByRole("link", { name: "Open the desk" })) {
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

it("draws the headline's pen stroke without adding to its name or the reading order", () => {
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  const title = screen.getByRole("heading", { level: 1, name: "From reading it to knowing it." });
  const stroke = title.querySelector("svg");
  expect(stroke).toHaveAttribute("aria-hidden", "true");
  expect(stroke).toHaveAttribute("focusable", "false");
  expect(title.textContent).toBe("From reading it to knowing it.");
});

it("marks the section being read in the navigation", () => {
  const observers: { callback: IntersectionObserverCallback; targets: Element[] }[] = [];
  vi.stubGlobal("IntersectionObserver", class {
    targets: Element[] = [];
    constructor(callback: IntersectionObserverCallback) { observers.push({ callback, targets: this.targets }); }
    observe = (target: Element) => { this.targets.push(target); };
    disconnect = vi.fn();
    unobserve = vi.fn();
  });
  try {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    const observed = observers.find((entry) => entry.targets.length === 4);
    expect(observed?.targets.map((target) => target.id)).toEqual(["how-it-works", "model-access", "desktop", "faq"]);

    const enter = (id: string, isIntersecting: boolean) =>
      act(() => observed!.callback([{ target: document.getElementById(id)!, isIntersecting } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));
    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(navigation).queryByRole("link", { current: "location" })).toBeNull();

    enter("model-access", true);
    expect(within(navigation).getByRole("link", { current: "location" })).toHaveTextContent("Model access");

    // Where two sections meet, the one being scrolled into wins.
    enter("faq", true);
    expect(within(navigation).getByRole("link", { current: "location" })).toHaveTextContent("Questions");
    enter("faq", false);
    expect(within(navigation).getByRole("link", { current: "location" })).toHaveTextContent("Model access");
    enter("model-access", false);
    expect(within(navigation).queryByRole("link", { current: "location" })).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});

it("offers the desktop app with release downloads and the Ollama first step", () => {
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { level: 2, name: /The desk, installed/ })).toBeInTheDocument();

  const section = within(document.getElementById("desktop")!);
  expect(section.getByRole("link", { name: "Windows (64-bit installer)" })).toHaveAttribute(
    "href",
    "https://github.com/yuzuruu29/comtus-releases/releases/latest/download/Comtus_x64-setup.exe",
  );
  expect(section.getByRole("link", { name: "macOS (Apple silicon)" })).toHaveAttribute(
    "href",
    "https://github.com/yuzuruu29/comtus-releases/releases/latest/download/Comtus_aarch64.dmg",
  );

  expect(section.getAllByText("Install Comtus").length).toBeGreaterThan(0);
  expect(section.getByText("Bring home Ollama")).toBeInTheDocument();
  expect(section.getByRole("link", { name: "ollama.com/download" })).toHaveAttribute(
    "href",
    "https://ollama.com/download",
  );
  expect(section.getByText(/one-time PayPal top-up/)).toBeInTheDocument();
});

it("only animates the sample once the visitor has asked for something", () => {
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  const sample = screen.getByRole("region", { name: "Interactive sample notebook" });
  expect(sample).toHaveAttribute("data-touched", "false");

  // Choosing the question that is already showing changes nothing, so it must not replay.
  fireEvent.click(screen.getByRole("button", { name: "Why practise recall instead of rereading?" }));
  expect(sample).toHaveAttribute("data-touched", "false");

  fireEvent.click(screen.getByRole("button", { name: "How can I try this with my own notes?" }));
  expect(sample).toHaveAttribute("data-touched", "true");
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
  expect(await screen.findByRole("alert", {}, { timeout: 5000 })).toHaveTextContent("add your key at the desk under AI Models");
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
  expect(within(guide).getByRole("link", { name: "Find your way at the desk" })).toHaveAttribute("href", "/studio");
});
