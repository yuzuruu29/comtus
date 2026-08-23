import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { createNotebook } from "../lib/db";
import { detectPlatform, isDeskShell, isTauri } from "../lib/desktop";
import { useThemeEffect } from "../lib/theme";
import { useMediaQuery } from "../lib/useMediaQuery";
import { DeskContext, defaultDeskActions, type DeskActions } from "./DeskContext";
import CommandPalette from "./CommandPalette";
import UpdateToast from "./UpdateToast";
import { cycleLayout, loadLayout, saveLayout, togglePane, type LayoutMode } from "./layout";
import { matchesShortcut } from "./shortcuts";

function hasOpenModal(): boolean {
  return Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));
}

export default function DeskShell({
  children,
  layout,
  onLayout,
  onSettings,
  onImport,
  onNewNotebook,
  onHome,
}: {
  children: ReactNode;
  layout?: LayoutMode;
  onLayout?: (mode: LayoutMode) => void;
  onSettings?: () => void;
  onImport?: () => void;
  onNewNotebook?: () => void;
  onHome?: () => void;
}) {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const platform = detectPlatform();
  const compactViewport = useMediaQuery("(max-width: 1199px)");
  const compact = isDeskShell() && compactViewport;
  useThemeEffect();

  useEffect(() => {
    document.documentElement.dataset.shell = isDeskShell() ? "desktop" : "browser";
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
      goHome: () => {
        if (onHome) onHome();
        else navigate("/studio");
      },
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
      toggleSources: () => setLayout(togglePane(current, "sources", compact)),
      toggleStudio: () => setLayout(togglePane(current, "studio", compact)),
      focusChat: () => setLayout("focus"),
      importFiles: () => onImport?.(),
      openPalette: () => setPaletteOpen(true),
    };
  }, [compact, layout, navigate, onHome, onImport, onNewNotebook, onSettings, setLayout]);
  const actionsRef = useRef(actions);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (matchesShortcut(e, platform, { key: "k" })) {
        e.preventDefault();
        if (!paletteOpen && hasOpenModal()) return;
        setPaletteOpen((v) => !v);
        return;
      }
      if (hasOpenModal()) return;
      const currentActions = actionsRef.current;
      if (matchesShortcut(e, platform, { key: "," })) {
        e.preventDefault();
        currentActions.openSettings();
        return;
      }
      if (matchesShortcut(e, platform, { key: "h", shift: true })) {
        e.preventDefault();
        currentActions.goHome();
        return;
      }
      if (typing) return;
      if (matchesShortcut(e, platform, { key: "n" })) {
        e.preventDefault();
        currentActions.newNotebook();
      } else if (matchesShortcut(e, platform, { key: "1" })) {
        e.preventDefault();
        currentActions.toggleSources();
      } else if (matchesShortcut(e, platform, { key: "2" })) {
        e.preventDefault();
        currentActions.focusChat();
      } else if (matchesShortcut(e, platform, { key: "3" })) {
        e.preventDefault();
        currentActions.toggleStudio();
      } else if (matchesShortcut(e, platform, { key: "[" })) {
        e.preventDefault();
        currentActions.cycleLayout(-1);
      } else if (matchesShortcut(e, platform, { key: "]" })) {
        e.preventDefault();
        currentActions.cycleLayout(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, platform]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void import("@tauri-apps/api/event").then(({ listen }) => {
      const run = (action: (actions: DeskActions) => void) => () => {
        if (!hasOpenModal()) action(actionsRef.current);
      };
      const subs = [
        listen("home", run((current) => current.goHome())),
        listen("new-notebook", run((current) => current.newNotebook())),
        listen("import-sources", run((current) => current.importFiles())),
        listen("settings", run((current) => current.openSettings())),
        listen("layout-standard", run((current) => current.setLayout("standard"))),
        listen("layout-reading", run((current) => current.setLayout("reading"))),
        listen("layout-writing", run((current) => current.setLayout("writing"))),
        listen("layout-focus", run((current) => current.setLayout("focus"))),
      ];
      void Promise.all(subs).then((fns) => {
        const dispose = () => fns.forEach((fn) => fn());
        if (cancelled) dispose();
        else unlisten = dispose;
      });
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return (
    <DeskContext.Provider value={actions}>
      {children}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {isTauri() && <UpdateToast />}
    </DeskContext.Provider>
  );
}
