import { describe, expect, it, vi, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import CantorShowcase from "./CantorShowcase";

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

vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    context: vi.fn((fn: () => void) => {
      try { fn(); } catch {}
      return { revert: vi.fn() };
    }),
    to: vi.fn(),
    fromTo: vi.fn(),
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: {
    create: vi.fn(),
  },
}));

describe("CantorShowcase Component", () => {
  it("renders the Cantor8 hero headline, status badge, and rolling arrow CTA", () => {
    render(
      <BrowserRouter>
        <CantorShowcase />
      </BrowserRouter>
    );

    expect(screen.getAllByText(/COMTUS COGNITIVE INFRASTRUCTURE/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
    expect(screen.getByText(/Unified Cognitive Infrastructure for Deep Study/i)).toBeDefined();
    expect(screen.getAllByText(/Open the Studio/i).length).toBeGreaterThan(0);
  });

  it("renders the product suite bento grid and curricula frameworks", () => {
    render(
      <BrowserRouter>
        <CantorShowcase />
      </BrowserRouter>
    );

    expect(screen.getByText(/Socratic Inquiry & Active Recall/i)).toBeDefined();
    expect(screen.getByText(/Smart Leitner Flashcard Queue/i)).toBeDefined();
    expect(screen.getByText(/Step-by-Step Proof Verification/i)).toBeDefined();
    expect(screen.getByText(/Multi-Model BYOK Workbench/i)).toBeDefined();
    expect(screen.getByText(/Academic Integrity by Design/i)).toBeDefined();
    expect(screen.getByText(/Native Desktop Companion/i)).toBeDefined();

    // Curricula
    expect(screen.getByText(/USMLE & Medical Boards/i)).toBeDefined();
    expect(screen.getByText(/NCLEX \/ PNLE Nursing/i)).toBeDefined();
  });
});
