import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ConsoleShell from "./ConsoleShell";

describe("ConsoleShell Component", () => {
  it("names the workspace and leaves its content unobstructed", () => {
    render(
      <ConsoleShell notebookName="Biochemistry 101">
        <div data-testid="workspace-content">Workspace 3-Pane Body</div>
      </ConsoleShell>
    );

    expect(screen.getByRole("region", { name: "Biochemistry 101 workspace" })).toBeDefined();
    expect(screen.getByTestId("workspace-content")).toBeDefined();
    expect(screen.queryByRole("banner")).toBeNull();
  });
});
