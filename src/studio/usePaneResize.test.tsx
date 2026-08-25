import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { CSSProperties } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePaneResize, type PaneSide } from "./usePaneResize";

function makeRaf() {
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  return {
    request: (callback: FrameRequestCallback) => {
      const id = nextId++;
      pending.set(id, callback);
      return id;
    },
    cancel: (id: number) => pending.delete(id),
    fire: () => {
      for (const callback of [...pending.values()]) {
        pending.clear();
        callback(performance.now());
      }
    },
  };
}

const CSS_VARIABLE = "--test-pane-width" as const;

function ResizeHarness({
  side = "left",
  onCollapse,
  onRender,
}: {
  side?: PaneSide;
  onCollapse: () => void;
  onRender?: () => void;
}) {
  onRender?.();
  const resize = usePaneResize({
    side,
    storageKey: `test-${side}-width`,
    cssVariable: CSS_VARIABLE,
    controlsId: `${side}-pane`,
    label: `Resize ${side} pane`,
    minWidth: side === "left" ? 180 : 200,
    maxWidth: 550,
    defaultWidth: side === "left" ? 270 : 290,
    collapseThreshold: side === "left" ? 140 : 150,
    onCollapse,
  });

  return (
    <aside
      ref={resize.paneRef}
      id={`${side}-pane`}
      data-testid="pane"
      data-dragging={resize.isDragging}
      style={{
        [CSS_VARIABLE]: `${resize.width}px`,
        width: `var(${CSS_VARIABLE})`,
      } as CSSProperties}
    >
      <div data-testid="separator" {...resize.separatorProps} />
      <output data-testid="width">{resize.width}</output>
    </aside>
  );
}

describe("usePaneResize", () => {
  let raf: ReturnType<typeof makeRaf>;

  beforeEach(() => {
    raf = makeRaf();
    vi.stubGlobal("requestAnimationFrame", raf.request);
    vi.stubGlobal("cancelAnimationFrame", raf.cancel);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  it("updates the CSS width during drag without rerendering, then commits on release", () => {
    let renders = 0;
    render(<ResizeHarness onCollapse={vi.fn()} onRender={() => renders++} />);
    const pane = screen.getByTestId("pane");
    const separator = screen.getByTestId("separator");

    fireEvent.pointerDown(separator, { button: 0, pointerId: 1, clientX: 270 });
    const rendersAfterStart = renders;
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 330 });
    act(() => raf.fire());

    expect(renders).toBe(rendersAfterStart);
    expect(pane.style.getPropertyValue(CSS_VARIABLE)).toBe("330px");
    expect(separator).toHaveAttribute("aria-valuenow", "330");

    fireEvent.pointerUp(window, { pointerId: 1, clientX: 330 });
    expect(screen.getByTestId("width")).toHaveTextContent("330");
    expect(localStorage.getItem("test-left-width")).toBe("330");
    expect(document.body.style.cursor).toBe("");
  });

  it("previews the collapse zone and collapses only when the pointer is released", () => {
    const onCollapse = vi.fn();
    render(<ResizeHarness onCollapse={onCollapse} />);
    const separator = screen.getByTestId("separator");

    fireEvent.pointerDown(separator, { button: 0, pointerId: 2, clientX: 270 });
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 120 });
    act(() => raf.fire());

    expect(onCollapse).not.toHaveBeenCalled();
    expect(separator).toHaveAttribute("data-collapse-ready", "true");
    expect(screen.getByTestId("pane").style.getPropertyValue(CSS_VARIABLE)).toBe("180px");

    fireEvent.pointerUp(window, { pointerId: 2, clientX: 120 });
    expect(onCollapse).toHaveBeenCalledOnce();
    expect(localStorage.getItem("test-left-width")).toBeNull();
  });

  it("restores the committed width when a drag is cancelled", () => {
    render(<ResizeHarness onCollapse={vi.fn()} />);
    const pane = screen.getByTestId("pane");
    const separator = screen.getByTestId("separator");

    fireEvent.pointerDown(separator, { button: 0, pointerId: 3, clientX: 270 });
    fireEvent.pointerMove(window, { pointerId: 3, clientX: 390 });
    act(() => raf.fire());
    expect(pane.style.getPropertyValue(CSS_VARIABLE)).toBe("390px");

    fireEvent.pointerCancel(window, { pointerId: 3 });
    expect(pane.style.getPropertyValue(CSS_VARIABLE)).toBe("270px");
    expect(screen.getByTestId("width")).toHaveTextContent("270");
    expect(document.body.style.userSelect).toBe("");
  });

  it("exposes separator semantics and supports physical arrow, Home, End, and reset controls", () => {
    render(<ResizeHarness side="right" onCollapse={vi.fn()} />);
    const separator = screen.getByRole("separator", { name: "Resize right pane" });

    expect(separator).toHaveAttribute("aria-controls", "right-pane");
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    expect(separator).toHaveAttribute("aria-valuemin", "200");
    expect(separator).toHaveAttribute("aria-valuemax", "550");
    expect(separator).toHaveAttribute("aria-valuenow", "290");

    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(separator).toHaveAttribute("aria-valuenow", "302");
    fireEvent.keyDown(separator, { key: "Home" });
    expect(separator).toHaveAttribute("aria-valuenow", "200");
    fireEvent.keyDown(separator, { key: "End" });
    expect(separator).toHaveAttribute("aria-valuenow", "550");
    fireEvent.doubleClick(separator);
    expect(separator).toHaveAttribute("aria-valuenow", "290");
    expect(localStorage.getItem("test-right-width")).toBe("290");
  });
});
