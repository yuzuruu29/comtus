import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { DeskContext, type DeskActions, defaultDeskActions } from "../DeskContext";
import BatteryCopilotMenu, { copilotStatus } from "./BatteryCopilotMenu";

afterEach(cleanup);

describe("copilotStatus", () => {
  it("reports thinking while sources are being read", () => {
    expect(copilotStatus({ think: true, milestones: 3 })).toBe("Working on your question…");
  });

  it("reports milestone count when idle", () => {
    expect(copilotStatus({ think: false, milestones: 2 })).toBe("2 milestones unlocked");
    expect(copilotStatus({ think: false, milestones: 1 })).toBe("1 milestone unlocked");
  });

  it("stays quiet when there is nothing to report", () => {
    expect(copilotStatus({ think: false, milestones: 0 })).toBe("Ready when you are");
  });
});

describe("BatteryCopilotMenu", () => {
  const controls = { width: 112, setWidth: vi.fn(), resetPlacement: vi.fn(), react: vi.fn() };
  const desk: DeskActions = {
    ...defaultDeskActions,
    focusChat: vi.fn(),
    importFiles: vi.fn(),
    openMilestones: vi.fn(),
    openSettings: vi.fn(),
    openPalette: vi.fn(),
  };

  it("renders the lean action set over a real status line", () => {
    render(
      <DeskContext.Provider value={desk}>
        <BatteryCopilotMenu controls={controls} onClose={() => {}} status="Working on your question…" />
      </DeskContext.Provider>,
    );
    expect(screen.getByText("Working on your question…")).toBeDefined();
    expect(screen.getByRole("dialog", { name: "Compad" })).toHaveAttribute("aria-modal", "false");
    expect(screen.getByText("Open full chat")).toBeDefined();
    expect(screen.getByText("Add sources")).toBeDefined();
    expect(screen.getByText("Milestones")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
    fireEvent.click(screen.getByText("Make yourself comfortable"));
    fireEvent.change(screen.getByRole("slider", { name: /Compad size/ }), { target: { value: "180" } });
    expect(controls.setWidth).toHaveBeenCalledWith(180);
    fireEvent.click(screen.getByRole("button", { name: "Reset position" }));
    expect(controls.resetPlacement).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Say hello" }));
    expect(controls.react).toHaveBeenCalled();
    expect(screen.getByText("Hello. One question at a time. I’m right here.")).toBeInTheDocument();
  });

  it("runs the matching desk action and closes", () => {
    const onClose = vi.fn();
    render(
      <DeskContext.Provider value={desk}>
        <BatteryCopilotMenu controls={controls} onClose={onClose} status="Ready when you are" />
      </DeskContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open full chat" }));
    expect(desk.focusChat).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <DeskContext.Provider value={desk}>
        <BatteryCopilotMenu controls={controls} onClose={onClose} status="Ready when you are" />
      </DeskContext.Provider>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
