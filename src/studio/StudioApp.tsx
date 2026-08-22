import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import NotebookList from "./NotebookList";
import Workspace from "./Workspace";
import { MotionPrefs } from "./fx";
import { useSettings } from "../lib/settings";
import "./studio.css";

export default function StudioApp() {
  const { notebookId } = useParams();
  const navigate = useNavigate();
  const hasKey = useSettings((s) => s.hasKey());

  useEffect(() => {
    document.title = "Comtus — Studio";
    return () => {
      document.title = "Comtus — Rough thought, polished.";
    };
  }, []);

  return (
    <MotionPrefs>
      {!notebookId ? (
        <NotebookList
          onOpen={(id) => navigate(`/studio/${id}`, { flushSync: true })}
          needsKey={!hasKey}
        />
      ) : (
        <Workspace notebookId={notebookId} />
      )}
    </MotionPrefs>
  );
}
