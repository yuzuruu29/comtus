import { DeviceMobile, DotsThree, DownloadSimple, Notebook as NotebookIcon, PencilSimple, Trash } from "@phosphor-icons/react";
import { IconButton, Menu } from "../ui";
import type { Notebook } from "../lib/types";
import { timeAgo } from "./ui";
import { examCountdown } from "../lib/exam";
import { ICON } from "../ui/iconScale";

export interface NotebookCardData extends Notebook {
  sourceCount: number;
}

export default function NotebookCard({
  notebook,
  number,
  onOpen,
  onRename,
  onExport,
  onSend,
  onDelete,
}: {
  notebook: NotebookCardData;
  number?: number;
  onOpen: (id: string) => void;
  onRename: (notebook: Notebook) => void;
  onExport: (notebook: Notebook) => void;
  /** Sends the notebook to another device. */
  onSend?: (notebook: Notebook) => void;
  onDelete: (id: string) => void;
}) {
  const countdown = examCountdown(notebook);
  return (
    <div className="notebook-card card-paper-curl card-book-press">
      <button
        type="button"
        onClick={() => onOpen(notebook.id)}
        aria-label={`Open ${notebook.name}`}
        className="notebook-card-open"
      >
        <span className="notebook-card-index" aria-hidden="true"><NotebookIcon size={ICON.lg} weight="light" /> {number ? String(number).padStart(2, "0") : "Notebook"}</span>
        <span className="notebook-card-title">
          {notebook.name}
        </span>
        <span className="notebook-card-open-hint">Open notebook</span>
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
              <DotsThree size={ICON.xxl} weight="bold" aria-hidden="true" />
            </IconButton>
          }
          items={[
            {
              key: "rename",
              label: "Rename",
              icon: <PencilSimple size={ICON.lg} aria-hidden="true" />,
              onSelect: () => onRename(notebook),
            },
            {
              key: "export",
              label: "Export",
              icon: <DownloadSimple size={ICON.lg} aria-hidden="true" />,
              onSelect: () => onExport(notebook),
            },
            ...(onSend
              ? [
                  {
                    key: "send",
                    label: "Send to another device",
                    icon: <DeviceMobile size={ICON.lg} aria-hidden="true" />,
                    onSelect: () => onSend(notebook),
                  },
                ]
              : []),
            {
              key: "delete",
              label: "Delete",
              icon: <Trash size={ICON.lg} aria-hidden="true" />,
              onSelect: () => onDelete(notebook.id),
            },
          ]}
        />
      </div>
    </div>
  );
}
