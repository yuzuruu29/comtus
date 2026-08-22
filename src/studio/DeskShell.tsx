import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { createNotebook } from "../lib/db";
import { detectPlatform, isTauri } from "../lib/desktop";
import { useThemeEffect } from "../lib/theme";
import { DeskContext, defaultDeskActions, type DeskActions } from "./DeskContext";
import CommandPalette from "./CommandPalette";
import UpdateToast from "./UpdateToast";
import { cycleLayout, loadLayout, saveLayout, type LayoutMode } from "./layout";
import { matchesShortcut } from "./shortcuts";

export default function DeskShell({
  children,
  layout,
  onLayout,
  onSettings,
  onImport,
  onNewNotebook,
}: {
  children: ReactNode;
  layout?: LayoutMode;
  onLayout?: (mode: LayoutMode) => void;
  onSettings?: () => void;
  onImport?: () => void;
  onNewNotebook?: () => void;
}) {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const platform = detectPlatform();
  useThemeEffect();

  useEffect(() => {
    document.documentElement.dataset.shell = isTauri() ? "desktop" : "browser";
    document.body.classList.remove("has-custom-cursor");
    return () => {
      delete document.documentElement.dataset.shell;
    };
  }, []);

  const setLayout = useCallback(
    (mode: LayoutMode) => {
      saveLayout(mode);
      onLayout?.(mode);
    },
    [onLayout],
  );

  const actions = useMemo<DeskActions>(() => {
    const current = layout ?? loadLayout();
    return {
      ...defaultDeskActions,
      openSettings: () => onSettings?.(),
      newNotebook: () => {
        if (onNewNotebook) onNewNotebook();
        else {
          void createNotebook("Untitled").then((nb) => navigate(`/studio/${nb.id}`, { flushSync: true }));
        }
      },
      openNotebook: (id) => navigate(`/studio/${id}`, { flushSync: true }),
      setLayout,
      cycleLayout: (dir) => setLayout(cycleLayout(current, dir)),
      toggleSources: () => setLayout(current === "writing" || current === "focus" ? "reading" : "writing"),
      toggleStudio: () => setLayout(current === "reading" || current === "focus" ? "writing" : "reading"),
      focusChat: () => setLayout("focus"),
      importFiles: () => onImport?.(),
      openPalette: () => setPaletteOpen(true),
    };
  }, [layout, navigate, onImport, onNewNotebook, onSettings, setLayout]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (matchesShortcut(e, platform, { key: "k" })) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (matchesShortcut(e, platform, { key: "," })) {
        e.preventDefault();
        onSettings?.();
        return;
      }
      if (typing) return;
      if (matchesShortcut(e, platform, { key: "n" })) {
        e.preventDefault();
        actions.newNotebook();
      } else if (matchesShortcut(e, platform, { key: "1" })) {
        e.preventDefault();
        actions.toggleSources();
      } else if (matchesShortcut(e, platform, { key: "2" })) {
        e.preventDefault();
        actions.focusChat();
      } else if (matchesShortcut(e, platform, { key: "3" })) {
        e.preventDefault();
        actions.toggleStudio();
      } else if (matchesShortcut(e, platform, { key: "[" })) {
        e.preventDefault();
        actions.cycleLayout(-1);
      } else if (matchesShortcut(e, platform, { key: "]" })) {
        e.preventDefault();
        actions.cycleLayout(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, onSettings, platform]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/event").then(({ listen }) => {
      const subs = [
        listen("new-notebook", () => actions.newNotebook()),
        listen("settings", () => actions.openSettings()),
        listen("layout-standard", () => actions.setLayout("standard")),
        listen("layout-reading", () => actions.setLayout("reading")),
        listen("layout-writing", () => actions.setLayout("writing")),
        listen("layout-focus", () => actions.setLayout("focus")),
      ];
      void Promise.all(subs).then((fns) => {
        unlisten = () => fns.forEach((fn) => fn());
      });
    });
    return () => unlisten?.();
  }, [actions]);

  return (
    <DeskContext.Provider value={actions}>
      {children}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {isTauri() && <UpdateToast />}
    </DeskContext.Provider>
  );
}
