import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ConsoleShell from "./ConsoleShell";

describe("ConsoleShell Component", () => {
  it("renders retro console chassis, status bar, and workspace content", () => {
    render(
      <ConsoleShell notebookName="Biochemistry 101" modelLabel="DeepSeek R1">
        <div data-testid="workspace-content">Workspace 3-Pane Body</div>
      </ConsoleShell>
    );

    // Root wrapper and chassis
    expect(screen.getByTestId("console-shell-root")).toBeDefined();

    // Status bar with custom notebook title and model
    expect(screen.getByText("COMTUS")).toBeDefined();
    expect(screen.getByText("Biochemistry 101")).toBeDefined();
    expect(screen.getByText("DeepSeek R1")).toBeDefined();

    // Children content rendered inside viewport
    expect(screen.getByTestId("workspace-content")).toBeDefined();

    // Controller footer bar is gone
    expect(screen.queryByText(/COMMANDS/)).toBeNull();
    expect(screen.queryByText("COMTUS · COGNITIVE WORKSPACE")).toBeNull();
  });
});
