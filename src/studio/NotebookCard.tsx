import { DotsThreeVertical, DownloadSimple, PencilSimple, Trash } from "@phosphor-icons/react";
import { IconButton, Menu } from "../ui";
import StudyGlyph from "../components/icons/StudyGlyph";
import type { Notebook } from "../lib/types";
import { timeAgo } from "./ui";

export interface NotebookCardData extends Notebook {
  sourceCount: number;
}

/** One tile on the shelf: a leather-spined card (the left accent bar) whose
 *  whole body opens the notebook, with a "..." menu layered in the corner
 *  as a sibling — never nested inside the open button, which would be
 *  invalid, unreachable-by-keyboard markup. */
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
  return (
    <div className="card-wake anim-rise relative h-full rounded-[var(--radius-dialog)] border border-l-4 border-hairline border-l-leather bg-surface shadow-card">
      <button
        type="button"
        onClick={() => onOpen(notebook.id)}
        className="group flex h-full min-h-[168px] w-full flex-col justify-between gap-3 rounded-[var(--radius-dialog)] p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <StudyGlyph name={notebook.name} size="md" />
        <h3 className="line-clamp-2 font-display text-lg font-[520] leading-snug text-ink transition-colors group-hover:text-brass">
          {notebook.name}
        </h3>
        <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-muted">
          <span>
            {notebook.sourceCount} {notebook.sourceCount === 1 ? "source" : "sources"}
          </span>
          <span className="text-muted/50">·</span>
          <span>{timeAgo(notebook.updatedAt)}</span>
        </div>
      </button>

      <div className="absolute right-3 top-3">
        <Menu
          aria-label={`${notebook.name} options`}
          align="end"
          trigger={
            <IconButton aria-label="Notebook options" size="sm">
              <DotsThreeVertical size={16} weight="bold" />
            </IconButton>
          }
          items={[
            {
              key: "rename",
              label: "Rename",
              icon: <PencilSimple size={13} />,
              onSelect: () => onRename(notebook),
            },
            {
              key: "export",
              label: "Export",
              icon: <DownloadSimple size={13} />,
              onSelect: () => onExport(notebook),
            },
            {
              key: "delete",
              label: "Delete",
              icon: <Trash size={13} />,
              onSelect: () => onDelete(notebook.id),
            },
          ]}
        />
      </div>
    </div>
  );
}
