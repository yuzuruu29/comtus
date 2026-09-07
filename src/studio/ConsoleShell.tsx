import type { ReactNode } from "react";
import "./console-shell.css";

export interface ConsoleShellProps {
  children: ReactNode;
  notebookName?: string;
  modelLabel?: string;
}

export default function ConsoleShell({
  children,
  notebookName = "Course Notebook",
  modelLabel = "No model selected",
}: ConsoleShellProps) {
  return (
    <div className="console-shell-root" data-testid="console-shell-root">
      <div className="console-chassis">
        {/* Top Status Strip */}
        <header className="console-status-bar" aria-label="Console Status Bar">
          <div className="console-status-left flex items-center gap-2">
            <span className="console-live-led" aria-hidden="true" />
            <span className="font-bold tracking-wider console-accent">COMTUS</span>
            <span className="text-muted/50">·</span>
            <span className="console-notebook-title">{notebookName}</span>
          </div>
          <div className="console-status-right hidden sm:flex items-center gap-2">
            <span className="text-[10px] text-muted">INFERENCE:</span>
            <span className="console-accent font-semibold">{modelLabel}</span>
          </div>
        </header>

        {/* Three-pane workspace */}
        <div className="console-screen-viewport">{children}</div>
      </div>
    </div>
  );
}
