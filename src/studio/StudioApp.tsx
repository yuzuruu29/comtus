import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Shelf from "./Shelf";
import Workspace from "./Workspace";
import DeskApp from "../desk/DeskApp";
import { isDeskShell } from "../lib/desktop";
import { useSettings } from "../lib/settings";
import { studioNotebookIdFromPath } from "./studioPath";
import "./studio.css";
import "./desk-motion.css";

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

  useEffect(() => {
    document.title = "Comtus — Studio";
    return () => {
      document.title = "Comtus — Rough thought, polished.";
    };
  }, []);

  // The desktop app is its own product surface: library rail + desk home,
  // not the web studio tree. The browser keeps the shelf + workspace.
  if (isDeskShell()) {
    return <DeskApp />;
  }

  return !notebookId ? (
    <Shelf onOpen={openNotebook} onReview={openWork} needsKey={!hasKey} />
  ) : (
    <Workspace key={notebookId} notebookId={notebookId} />
  );
}
