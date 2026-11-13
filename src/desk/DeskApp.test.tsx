import "fake-indexeddb/auto";
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettings } from "../lib/settings";
import DeskApp from "./DeskApp";

vi.mock("../studio/DeskShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("../studio/SettingsModal", () => ({
  default: () => null,
}));
vi.mock("../studio/FocusTimer", () => ({
  default: () => null,
}));
vi.mock("../studio/DeviceTransfer", () => ({
  SendToDeviceDialog: () => null,
}));
vi.mock("../studio/Titlebar", () => ({
  default: () => null,
}));
vi.mock("../studio/companion/MilestonesButton", () => ({
  default: () => null,
}));
vi.mock("./LibraryRail", () => ({
  default: () => null,
}));
vi.mock("./DeskHome", () => ({
  default: () => <div data-testid="desk-home" />,
}));
vi.mock("./NotebookDesk", () => ({
  default: () => null,
}));
vi.mock("./FirstRunSetup", () => ({
  default: () => null,
}));

function resetStockSettings() {
  useSettings.setState({
    provider: "openai-compatible",
    compatKey: "",
    compatBaseUrl: "https://openrouter.ai/api/v1",
    compatModel: "openrouter/free",
    storedKeys: [],
    isPro: false,
    planTier: "free",
    theme: "light",
    deskSetupDone: true,
  });
}

describe("DeskApp", () => {
  beforeEach(() => {
    resetStockSettings();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders LampSwitch in the header and omits the placeholder N avatar and BYOK badge on stock setup", () => {
    render(
      <MemoryRouter initialEntries={["/studio"]}>
        <DeskApp />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Lamplight" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "N" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "BYOK" })).not.toBeInTheDocument();
  });

  it("shows the BYOK badge once a user-configured provider key is set", () => {
    useSettings.setState({ compatKey: "sk-or-custom-key" });
    render(
      <MemoryRouter initialEntries={["/studio"]}>
        <DeskApp />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "BYOK" })).toBeInTheDocument();
  });
});
