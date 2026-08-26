import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import LampMascot from "./LampMascot";
import { LAMP_POS_KEY, loadLampPos } from "./lampPos";

afterEach(() => {
  cleanup();
  localStorage.removeItem(LAMP_POS_KEY);
});

describe("LampMascot", () => {
  it("exposes a study-lamp control and sleepy copy when idle too long", () => {
    const onPoke = vi.fn();
    render(<LampMascot mood="sleepy" speech={null} onPoke={onPoke} lineTick={0} />);
    expect(screen.getByRole("button", { name: "Study lamp" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("The lamp is still lit.");
    fireEvent.click(screen.getByRole("button", { name: "Study lamp" }));
    expect(onPoke).toHaveBeenCalledTimes(1);
  });

  it("shows a milestone line when celebrating", () => {
    render(
      <LampMascot mood="celebrate" speech="A desk of your own" onPoke={() => {}} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("A desk of your own");
  });

  it("speaks a poke line when the lamp is tapped", () => {
    render(<LampMascot mood="poke" speech={null} onPoke={() => {}} lineTick={0} />);
    expect(screen.getByRole("status")).toHaveTextContent("Here.");
  });

  it("keeps a tap as a poke and a drag as a move", () => {
    const onPoke = vi.fn();
    render(<LampMascot mood="idle" speech={null} onPoke={onPoke} />);
    const lamp = screen.getByRole("button", { name: "Study lamp" });

    fireEvent.pointerDown(lamp, { pointerId: 1, button: 0, clientX: 40, clientY: 40 });
    fireEvent.pointerUp(lamp, { pointerId: 1, button: 0, clientX: 40, clientY: 40 });
    fireEvent.click(lamp);
    expect(onPoke).toHaveBeenCalledTimes(1);
    expect(loadLampPos()).toBeNull();

    onPoke.mockClear();
    fireEvent.pointerDown(lamp, { pointerId: 2, button: 0, clientX: 40, clientY: 40 });
    fireEvent.pointerMove(lamp, { pointerId: 2, clientX: 180, clientY: 120 });
    fireEvent.pointerUp(lamp, { pointerId: 2, button: 0, clientX: 180, clientY: 120 });
    fireEvent.click(lamp);
    expect(onPoke).not.toHaveBeenCalled();
    const saved = loadLampPos();
    expect(saved).not.toBeNull();
    expect(lamp.closest(".lamp-mascot")).toHaveAttribute("data-placed", "true");
  });

  it("returns to the corner on double-click", () => {
    const onPoke = vi.fn();
    localStorage.setItem(LAMP_POS_KEY, JSON.stringify({ left: 80, top: 60 }));
    render(<LampMascot mood="idle" speech={null} onPoke={onPoke} />);
    const lamp = screen.getByRole("button", { name: "Study lamp" });
    expect(lamp.closest(".lamp-mascot")).toHaveAttribute("data-placed", "true");
    fireEvent.doubleClick(lamp);
    expect(loadLampPos()).toBeNull();
    expect(lamp.closest(".lamp-mascot")).not.toHaveAttribute("data-placed");
  });
});
