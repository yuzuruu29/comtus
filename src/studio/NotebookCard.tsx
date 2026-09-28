import { DotsThree, DownloadSimple, Notebook as NotebookIcon, PencilSimple, Trash } from "@phosphor-icons/react";
import { IconButton, Menu } from "../ui";
import type { Notebook } from "../lib/types";
import { timeAgo } from "./ui";
import { examCountdown } from "../lib/exam";

export interface NotebookCardData extends Notebook {
  sourceCount: number;
}

export default function NotebookCard({
  notebook,
  onOpen,
  onRename,
  onExport,
  onDelete,
}: {
  notebook: NotebookCardData;
  onOpen: (id: string) => void;
  onRename: (notebook: Notebook) => void;
  onExport: (notebook: Notebook) => void;
  onDelete: (id: string) => void;
}) {
  const countdown = examCountdown(notebook);
  return (
    <div className="notebook-card">
      <button
        type="button"
        onClick={() => onOpen(notebook.id)}
        aria-label={`Open ${notebook.name}`}
        className="notebook-card-open"
      >
        <NotebookIcon className="notebook-card-glyph" size={30} weight="light" aria-hidden="true" />
        <span className="notebook-card-title">
          {notebook.name}
        </span>
        <span className="notebook-card-meta">
          <span>
            {notebook.sourceCount} {notebook.sourceCount === 1 ? "source" : "sources"}
          </span>
          {countdown && <span className="notebook-card-exam">{countdown}</span>}
          <time dateTime={new Date(notebook.updatedAt).toISOString()}>
            Updated {timeAgo(notebook.updatedAt)}
          </time>
        </span>
      </button>

      <div className="notebook-card-menu">
        <Menu
          aria-label={`${notebook.name} options`}
          align="end"
          trigger={
            <IconButton aria-label={`Notebook options for ${notebook.name}`}>
              <DotsThree size={22} weight="bold" aria-hidden="true" />
            </IconButton>
          }
          items={[
            {
              key: "rename",
              label: "Rename",
              icon: <PencilSimple size={18} aria-hidden="true" />,
              onSelect: () => onRename(notebook),
            },
            {
              key: "export",
              label: "Export",
              icon: <DownloadSimple size={18} aria-hidden="true" />,
              onSelect: () => onExport(notebook),
            },
            {
              key: "delete",
              label: "Delete",
              icon: <Trash size={18} aria-hidden="true" />,
              onSelect: () => onDelete(notebook.id),
            },
          ]}
        />
      </div>
    </div>
  );
}
