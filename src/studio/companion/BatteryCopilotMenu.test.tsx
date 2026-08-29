import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { DeskContext, type DeskActions, defaultDeskActions } from "../DeskContext";
import BatteryCopilotMenu, { copilotStatus } from "./BatteryCopilotMenu";

afterEach(cleanup);

describe("copilotStatus", () => {
  it("reports thinking while sources are being read", () => {
    expect(copilotStatus({ think: true, milestones: 3 })).toBe("Reading your sources…");
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
        <BatteryCopilotMenu onClose={() => {}} status="Reading your sources…" />
      </DeskContext.Provider>,
    );
    expect(screen.getByText("Reading your sources…")).toBeDefined();
    expect(screen.getByText("Focus chat")).toBeDefined();
    expect(screen.getByText("Add sources")).toBeDefined();
    expect(screen.getByText("Milestones")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
    expect(screen.getByText("All commands")).toBeDefined();
  });

  it("runs the matching desk action and closes", () => {
    const onClose = vi.fn();
    render(
      <DeskContext.Provider value={desk}>
        <BatteryCopilotMenu onClose={onClose} status="Ready when you are" />
      </DeskContext.Provider>,
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Focus chat" }));
    expect(desk.focusChat).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <DeskContext.Provider value={desk}>
        <BatteryCopilotMenu onClose={onClose} status="Ready when you are" />
      </DeskContext.Provider>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
