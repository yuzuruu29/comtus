import { useEffect, useRef } from "react";
import {
  ChatCircle,
  GearSix,
  Medal,
  Notebook,
  Sparkle,
} from "@phosphor-icons/react";
import { useDesk } from "../DeskContext";
import { modLabel } from "../shortcuts";
import { detectPlatform } from "../../lib/desktop";

/** Study-state line for the co-pilot menu — real awareness, not flavor text. */
export function copilotStatus(opts: { think: boolean; milestones: number }): string {
  if (opts.think) return "Reading your sources…";
  if (opts.milestones > 0) return `${opts.milestones} milestone${opts.milestones === 1 ? "" : "s"} unlocked`;
  return "Ready when you are";
}

const ITEMS = [
  { id: "chat", label: "Focus chat", icon: ChatCircle, action: "focusChat" },
  { id: "sources", label: "Add sources", icon: Notebook, action: "importFiles" },
  { id: "milestones", label: "Milestones", icon: Medal, action: "openMilestones" },
  { id: "settings", label: "Settings", icon: GearSix, action: "openSettings" },
] as const;

/** Lean co-pilot menu for the battery companion. Reuses existing Studio
 *  capabilities (DeskContext actions) instead of duplicating generators;
 *  everything else stays one hop away via the command palette. */
export default function BatteryCopilotMenu({
  onClose,
  status,
}: {
  onClose: () => void;
  status: string;
}) {
  const desk = useDesk();
  const platform = detectPlatform();
  const mod = modLabel(platform);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  const run = (action: "focusChat" | "importFiles" | "openMilestones" | "openSettings" | "openPalette") => {
    onClose();
    desk[action]();
  };

  return (
    <div
      ref={rootRef}
      role="menu"
      aria-label="Companion menu"
      className="w-56 overflow-hidden rounded-xl border border-hairline/80 bg-night/95 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl"
    >
      <div className="border-b border-hairline/60 px-3 py-2">
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-brasspale">
          Co-pilot
        </div>
        <div className="mt-0.5 text-[11.5px] text-parchment">{status}</div>
      </div>
      <div className="p-1">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            onClick={() => run(item.action)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-parchment transition-colors hover:bg-surface/80"
          >
            <item.icon size={14} className="shrink-0 text-muted" />
            <span className="flex-1">{item.label}</span>
          </button>
        ))}
        <button
          type="button"
          role="menuitem"
          onClick={() => run("openPalette" as const)}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-parchment transition-colors hover:bg-surface/80"
        >
          <Sparkle size={14} className="shrink-0 text-muted" />
          <span className="flex-1">All commands</span>
          <kbd className="rounded border border-hairline/60 px-1 font-mono text-[9px] text-muted">
            {mod}+K
          </kbd>
        </button>
      </div>
    </div>
  );
}
