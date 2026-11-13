import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Shelf from "./Shelf";
import Workspace from "./Workspace";
import DeskApp from "../desk/DeskApp";
import { isDeskShell, isStandalone, isTauri } from "../lib/desktop";
import { useBreakpoint } from "../lib/useBreakpoint";
import { useSettings } from "../lib/settings";
import { studioNotebookIdFromPath } from "./studioPath";
import "./studio.css";
import "./desk-motion.css";
import "./lamplight.css";

export default function StudioApp() {
  const { pathname } = useLocation();
  const notebookId = studioNotebookIdFromPath(pathname);
  const navigate = useNavigate();
  const openNotebook = useCallback(
    (id: string) => navigate(`/studio/${id}`, { flushSync: true }),
    [navigate],
  );
  const openWork = useCallback(
    (id: string, generationId: string) =>
      navigate(`/studio/${id}?work=${encodeURIComponent(generationId)}`, { flushSync: true }),
    [navigate],
  );
  const hasKey = useSettings((s) => s.hasKey());
  const bp = useBreakpoint();

  useEffect(() => {
    document.title = "Comtus — Studio";
    return () => {
      document.title = "Comtus — Rough thought, polished.";
    };
  }, []);

  // The desktop app is its own product surface: library rail + desk home,
  // not the web studio tree. The browser keeps the shelf + workspace. A
  // PWA installed on a phone is the one installed shell the desk surface
  // fits badly — its panes assume a window — so it gets the responsive
  // web workspace with mobile tabs instead.
  const phoneInstalledPwa = isStandalone() && !isTauri() && bp === "sm";
  if (isDeskShell() && !phoneInstalledPwa) {
    return <DeskApp />;
  }

  return !notebookId ? (
    <Shelf onOpen={openNotebook} onReview={openWork} needsKey={!hasKey} />
  ) : (
    <Workspace key={notebookId} notebookId={notebookId} />
  );
}
