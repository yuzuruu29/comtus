import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCountUp } from "./fx";

function Probe({ target }: { target: number }) {
  const value = useCountUp(target);
  return <span data-testid="count">{value}</span>;
}

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("useCountUp", () => {
  it("snaps straight to the target under prefers-reduced-motion", () => {
    mockMatchMedia(true);
    render(<Probe target={42} />);
    expect(screen.getByTestId("count")).toHaveTextContent("42");
  });

  it("lands on the target and follows target changes when motion is allowed", async () => {
    mockMatchMedia(false);
    const { rerender } = render(<Probe target={10} />);
    // Under jsdom the tween resolves within act(); in a browser this is
    // the visible climb. Either way the settled value must be exact.
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("10"));
    rerender(<Probe target={99} />);
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("99"));
  });
});
