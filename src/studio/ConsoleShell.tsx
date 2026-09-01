import { useEffect, useState, type ReactNode } from "react";
import { detectPlatform } from "../lib/desktop";
import { modLabel } from "./shortcuts";
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
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => {
    setMod(modLabel(detectPlatform()));
  }, []);

  return (
    <div className="console-shell-root" data-testid="console-shell-root">
      <div className="console-chassis">
        {/* Top Status Strip */}
        <header className="console-status-bar" aria-label="Console Status Bar">
          <div className="console-status-left flex items-center gap-2">
            <span className="console-live-led" aria-hidden="true" />
            <span className="font-bold tracking-wider text-[#6FE3FF]">COMTUS</span>
            <span className="text-white/40">·</span>
            <span className="console-notebook-title">{notebookName}</span>
          </div>
          <div className="console-status-right hidden sm:flex items-center gap-2">
            <span className="text-[10px] text-[#94A3B8]">INFERENCE:</span>
            <span className="text-[#6FE3FF] font-semibold">{modelLabel}</span>
          </div>
        </header>

        {/* CRT Screen Viewport (3-Pane Workspace) */}
        <div className="console-screen-viewport">
          <div className="console-screen-scanlines" aria-hidden="true" />
          {children}
        </div>

        {/* Bottom Controller Strip — hidden on mobile touch devices where bottom nav tabs exist */}
        <footer className="console-controller-bar hidden md:flex items-center justify-between" aria-label="Console Controller Bar">
          <div className="flex items-center gap-3">
            <span><kbd className="console-keybind-pill">{mod}+K</kbd> COMMANDS</span>
            <span><kbd className="console-keybind-pill">{mod}+1</kbd> SOURCES</span>
            <span><kbd className="console-keybind-pill">{mod}+3</kbd> STUDIO</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="console-brand-tag">COMTUS · COGNITIVE WORKSPACE</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
