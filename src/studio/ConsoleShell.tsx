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
  modelLabel = "Claude 3.7 Sonnet",
}: ConsoleShellProps) {
  return (
    <div className="console-shell-root" data-testid="console-shell-root">
      <div className="console-chassis">
        {/* Top Status Strip */}
        <header className="console-status-bar" aria-label="Console Status Bar">
          <div className="console-status-left">
            <span className="console-live-led" aria-hidden="true" />
            <span className="font-bold tracking-wider text-[#6FE3FF]">COMTUS</span>
            <span className="text-white/40">·</span>
            <span className="console-notebook-title">{notebookName}</span>
          </div>
          <div className="console-status-right">
            <span className="text-[10px] text-[#94A3B8]">INFERENCE:</span>
            <span className="text-[#6FE3FF] font-semibold">{modelLabel}</span>
          </div>
        </header>

        {/* CRT Screen Viewport (3-Pane Workspace) */}
        <div className="console-screen-viewport">
          <div className="console-screen-scanlines" aria-hidden="true" />
          {children}
        </div>

        {/* Bottom Controller Strip */}
        <footer className="console-controller-bar" aria-label="Console Controller Bar">
          <div className="flex items-center gap-3">
            <span><kbd className="console-keybind-pill">Ctrl+K</kbd> COMMANDS</span>
            <span><kbd className="console-keybind-pill">Ctrl+S</kbd> SOURCES</span>
            <span><kbd className="console-keybind-pill">Ctrl+D</kbd> STUDIO</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="console-brand-tag">COMTUS · COGNITIVE WORKSPACE</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
