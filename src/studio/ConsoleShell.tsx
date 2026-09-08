import type { ReactNode } from "react";
import "./console-shell.css";

export interface ConsoleShellProps {
  children: ReactNode;
  notebookName?: string;
}

export default function ConsoleShell({
  children,
  notebookName = "Notebook",
}: ConsoleShellProps) {
  return (
    <div className="console-shell-root" data-testid="console-shell-root" role="region" aria-label={`${notebookName} workspace`}>
      {children}
    </div>
  );
}
