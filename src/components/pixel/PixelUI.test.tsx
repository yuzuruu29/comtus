import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  PixelButton,
  PixelCard,
  PixelBadge,
  PixelTooltip,
  PixelProgress,
} from "./PixelUI";

afterEach(() => {
  cleanup();
});

describe("PixelUI Primitives", () => {
  describe("PixelButton", () => {
    it("renders with default primary variant and text", () => {
      render(<PixelButton>Ink Press</PixelButton>);
      const btn = screen.getByRole("button", { name: /ink press/i });
      expect(btn).toBeDefined();
      expect(btn.className).toContain("bg-px-surface");
    });

    it("renders all variants cleanly", () => {
      const { rerender } = render(<PixelButton variant="secondary">Secondary</PixelButton>);
      expect(screen.getByRole("button").className).toContain("bg-px-raised");

      rerender(<PixelButton variant="ghost">Ghost</PixelButton>);
      expect(screen.getByRole("button").className).toContain("bg-transparent");

      rerender(<PixelButton variant="brass">Brass</PixelButton>);
      expect(screen.getByRole("button").className).toContain("bg-px-brass");
    });

    it("handles click events and disabled state", () => {
      const handleClick = vi.fn();
      const { rerender } = render(<PixelButton onClick={handleClick}>Clickable</PixelButton>);
      
      fireEvent.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalledTimes(1);

      rerender(<PixelButton onClick={handleClick} disabled>Disabled</PixelButton>);
      const disabledBtn = screen.getByRole("button");
      expect(disabledBtn.hasAttribute("disabled")).toBe(true);
      expect(disabledBtn.className).toContain("opacity-45");
    });

    it("renders optional icons in left and right slots", () => {
      render(
        <PixelButton
          leftIcon={<span data-testid="left-icon">←</span>}
          rightIcon={<span data-testid="right-icon">→</span>}
        >
          Nav
        </PixelButton>
      );
      expect(screen.getByTestId("left-icon")).toBeDefined();
      expect(screen.getByTestId("right-icon")).toBeDefined();
    });

    it("does not spawn spark particles on click", () => {
      render(<PixelButton>Quiet</PixelButton>);
      const btn = screen.getByRole("button");
      fireEvent.click(btn);
      // No spark layer is ever mounted — the desk does not shower sparks.
      expect(document.querySelector(".pixel-spark")).toBeNull();
      expect(document.querySelector(".spark-layer")).toBeNull();
    });
  });

  describe("PixelCard", () => {
    it("renders default card variant with children", () => {
      render(
        <PixelCard header="Card Title" footer="Footer Note">
          <p>Tome Contents</p>
        </PixelCard>
      );
      expect(screen.getByText("Card Title")).toBeDefined();
      expect(screen.getByText("Tome Contents")).toBeDefined();
      expect(screen.getByText("Footer Note")).toBeDefined();
    });

    it("supports book, parchment, and shelf variants", () => {
      const { container, rerender } = render(<PixelCard variant="book">Book Body</PixelCard>);
      expect(container.firstChild).toBeDefined();
      const firstEl = container.firstChild as HTMLElement;
      expect(firstEl.className).toContain("border-l-4");

      rerender(<PixelCard variant="parchment">Parchment Body</PixelCard>);
      expect((container.firstChild as HTMLElement).className).toContain("bg-[#f2ede3]");

      rerender(<PixelCard variant="shelf">Shelf Body</PixelCard>);
      expect((container.firstChild as HTMLElement).className).toContain("bg-[#1a2136]");
    });

    it("supports corner modes and dither toggle", () => {
      const { container } = render(
        <PixelCard corners="square" dithered={false}>
          Square Card
        </PixelCard>
      );
      expect(container.textContent).toContain("Square Card");
    });
  });

  describe("PixelBadge", () => {
    it("renders default brass status tag", () => {
      render(<PixelBadge>GPT-5.6 Luna</PixelBadge>);
      const badge = screen.getByText("GPT-5.6 Luna");
      expect(badge).toBeDefined();
      expect(badge.parentElement?.className).toContain("text-[#e3b04b]");
    });

    it("renders all colorway variants", () => {
      const variants = ["brass", "moon", "sage", "rust", "neutral"] as const;
      variants.forEach((v) => {
        const { unmount } = render(<PixelBadge variant={v}>{v}</PixelBadge>);
        expect(screen.getByText(v)).toBeDefined();
        unmount();
      });
    });

    it("renders custom icon slot when provided", () => {
      render(
        <PixelBadge icon={<span data-testid="badge-icon">✦</span>}>
          Featured
        </PixelBadge>
      );
      expect(screen.getByTestId("badge-icon")).toBeDefined();
    });
  });

  describe("PixelTooltip", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("reveals parchment speech bubble on hover and hides on leave", () => {
      render(
        <PixelTooltip text="Study Note Tooltip">
          <button>Hover Me</button>
        </PixelTooltip>
      );

      const trigger = screen.getByText("Hover Me");
      expect(screen.queryByRole("tooltip")).toBeNull();

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(150);
      });

      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toBeDefined();
      expect(tooltip.textContent).toContain("Study Note Tooltip");

      fireEvent.mouseLeave(trigger);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("supports keyboard focus and dismisses on Escape key", () => {
      render(
        <PixelTooltip text="A11y Helper">
          <button>Focus Me</button>
        </PixelTooltip>
      );

      const trigger = screen.getByText("Focus Me");
      fireEvent.focus(trigger);
      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(screen.getByRole("tooltip")).toBeDefined();

      fireEvent.keyDown(trigger, { key: "Escape" });
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  describe("PixelProgress", () => {
    it("renders segmented progress meter with proper ARIA attributes", () => {
      render(<PixelProgress value={45} max={100} segments={10} label="Mastery" showLabel />);
      const meter = screen.getByRole("progressbar");
      expect(meter.getAttribute("aria-valuenow")).toBe("45");
      expect(meter.getAttribute("aria-valuemin")).toBe("0");
      expect(meter.getAttribute("aria-valuemax")).toBe("100");
      expect(screen.getByText("Mastery")).toBeDefined();
      expect(screen.getByText("45%")).toBeDefined();
    });

    it("clamps value within [0, max] boundaries", () => {
      const { rerender } = render(<PixelProgress value={150} max={100} />);
      let meter = screen.getByRole("progressbar");
      expect(meter.getAttribute("aria-valuenow")).toBe("100");

      rerender(<PixelProgress value={-20} max={100} />);
      meter = screen.getByRole("progressbar");
      expect(meter.getAttribute("aria-valuenow")).toBe("0");
    });

    it("supports colorway variants", () => {
      const { container, rerender } = render(<PixelProgress value={50} variant="sage" />);
      expect(container.firstChild).toBeDefined();

      rerender(<PixelProgress value={50} variant="rust" />);
      expect(container.firstChild).toBeDefined();

      rerender(<PixelProgress value={50} variant="moon" />);
      expect(container.firstChild).toBeDefined();
    });
  });
});
