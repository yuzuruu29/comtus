import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import NotebookList from "./NotebookList";
import Workspace from "./Workspace";
import DeskApp from "../desk/DeskApp";
import { MotionPrefs } from "./fx";
import { isDeskShell } from "../lib/desktop";
import { useSettings } from "../lib/settings";
import { studioNotebookIdFromPath } from "./studioPath";
import "./studio.css";

export default function StudioApp() {
  const { pathname } = useLocation();
  const notebookId = studioNotebookIdFromPath(pathname);
  const navigate = useNavigate();
  const openNotebook = useCallback(
    (id: string) => navigate(`/studio/${id}`, { flushSync: true }),
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
    return (
      <MotionPrefs>
        <DeskApp />
      </MotionPrefs>
    );
  }

  return (
    <MotionPrefs>
      {!notebookId ? (
        <NotebookList onOpen={openNotebook} needsKey={!hasKey} />
      ) : (
        <Workspace key={notebookId} notebookId={notebookId} />
      )}
    </MotionPrefs>
  );
}
