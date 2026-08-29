import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import ComtusShowcase, { COMTUS_CARDS_LEFT, COMTUS_CARDS_RIGHT } from "./ComtusShowcase";

afterEach(() => {
  cleanup();
});

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Mock GSAP and ScrollTrigger in JSDOM
vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    context: vi.fn((fn: () => void) => {
      try { fn(); } catch {}
      return { revert: vi.fn(), add: vi.fn() };
    }),
    to: vi.fn(),
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: {
    update: vi.fn(),
  },
}));

describe("ComtusShowcase Component", () => {
  it("renders hero headline, floating stickers, and subheader pill", () => {
    render(
      <BrowserRouter>
        <ComtusShowcase />
      </BrowserRouter>
    );

    expect(screen.getByText("YOUR AI STUDY COMPANION")).toBeDefined();
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
    expect(screen.getByText("COMTUS")).toBeDefined();
    expect(screen.getByText("Rough thought, polished.")).toBeDefined();

    // Floating Stickers
    expect(screen.getByTitle("16-Bit Blue Battery")).toBeDefined();
    expect(screen.getByTitle("Antique Study Tome")).toBeDefined();
    expect(screen.getByTitle("Steaming Study Tea")).toBeDefined();
    expect(screen.getByTitle("Feather Quill")).toBeDefined();
    expect(screen.getByTitle("Wax Seal of Mastery")).toBeDefined();
    expect(screen.getByTitle("Spark of Diligence")).toBeDefined();
  });

  it("renders the interactive 16-bit study console and toggles modes with D-Pad and action buttons", () => {
    render(
      <BrowserRouter>
        <ComtusShowcase />
      </BrowserRouter>
    );

    expect(screen.getByLabelText("16-Bit Study Console")).toBeDefined();
    expect(screen.getByText(/COMTUS-16 · SOCRATIC/i)).toBeDefined();
    expect(screen.getByText(/What triggers Long-Term Potentiation\?/i)).toBeDefined();

    // Click answer choice A in Socratic mode
    const choiceA = screen.getByText(/A\) Magnesium block expulsion/i);
    fireEvent.click(choiceA);
    expect(screen.getByText(/✓ Correct! Strong depolarization repels Mg2+/i)).toBeDefined();

    // Press D-Pad Right to advance to flashcards mode
    const dpadRight = screen.getByLabelText("D-Pad Right");
    fireEvent.click(dpadRight);
    expect(screen.getByText(/COMTUS-16 · FLASHCARDS/i)).toBeDefined();
    expect(screen.getByText("Hebbian Plasticity")).toBeDefined();

    // Press Action Button A to flip flashcard
    const btnA = screen.getByTitle("Button A (Select / Action)");
    fireEvent.click(btnA);
    expect(screen.getByText(/Neurons that fire together wire together/i)).toBeDefined();

    // Press D-Pad Right to advance to proof mode
    fireEvent.click(dpadRight);
    expect(screen.getByText(/COMTUS-16 · PROOF/i)).toBeDefined();
    expect(screen.getByText(/PROOF: Euler's Identity/i)).toBeDefined();

    // Press D-Pad Right to advance to BYOK mode
    fireEvent.click(dpadRight);
    expect(screen.getByText(/COMTUS-16 · BYOK/i)).toBeDefined();
    expect(screen.getByText("Claude 3.7 Sonnet")).toBeDefined();

    // Press Action Button A to switch model
    fireEvent.click(btnA);
    expect(screen.getAllByText("DeepSeek R1").length).toBeGreaterThan(0);
  });

  it("renders all 14 study blueprint cards in dual columns with metrics and CTA", () => {
    render(
      <BrowserRouter>
        <ComtusShowcase />
      </BrowserRouter>
    );

    for (const card of COMTUS_CARDS_LEFT) {
      expect(screen.getByText(card.title)).toBeDefined();
    }
    for (const card of COMTUS_CARDS_RIGHT) {
      expect(screen.getByText(card.title)).toBeDefined();
    }

    // Sticky CTA Button
    const ctaBtn = screen.getByRole("link", { name: /OPEN THE STUDIO/i });
    expect(ctaBtn).toBeDefined();
    expect(ctaBtn.getAttribute("href")).toBe("/studio");
  });
});
