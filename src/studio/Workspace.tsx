import { useEffect, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ChevronLeft, Flame, Settings2, BookText, MessagesSquare, LibraryBig } from "lucide-react";
import { db } from "../lib/db";
import type { Notebook } from "../lib/types";
import { useCallSettings } from "../lib/settings";
import { MODELS } from "../lib/llm";
import { SPRING, SOFT, glassPane } from "./fx";
import SourcesPane from "./SourcesPane";
import ChatPane from "./ChatPane";
import StudioPane from "./StudioPane";
import SettingsModal from "./SettingsModal";

type MobilePane = "sources" | "chat" | "studio";

const SOURCES_W = 308;
const STUDIO_W = 344;
const RAIL_W = 64;

export default function Workspace({ notebookId }: { notebookId: string }) {
  const cs = useCallSettings();
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [sourcesVersion, setSourcesVersion] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<{ sources: boolean; studio: boolean }>(() => {
    try {
      return JSON.parse(localStorage.getItem("comtus-panes") ?? "") ?? { sources: false, studio: false };
    } catch {
      return { sources: false, studio: false };
    }
  });
  const [mobilePane, setMobilePane] = useState<MobilePane>("chat");
  // Citation clicks queue here; SourcesPane consumes it once mounted —
  // the pane may be collapsed (desktop) or on another tab (mobile) when
  // the click happens, so window events would miss it.
  const [pendingView, setPendingView] = useState<{
    sourceId: string;
    startChar?: number;
  } | null>(null);

  const openSource = (sourceId: string, startChar?: number) => {
    setPendingView({ sourceId, startChar });
    setCollapsed((c) => ({ ...c, sources: false }));
    setMobilePane("sources");
  };

  useEffect(() => {
    db.notebooks.get(notebookId).then((nb) => {
      if (nb) setNotebook(nb);
      else window.location.href = "/studio";
    });
  }, [notebookId]);

  useEffect(() => {
    localStorage.setItem("comtus-panes", JSON.stringify(collapsed));
  }, [collapsed]);

  const rename = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !notebook) return;
    await db.notebooks.update(notebookId, { name: trimmed });
    setNotebook({ ...notebook, name: trimmed });
  };

  // Anthropic shows its friendly label; compatible endpoints show the
  // model id's tail (they can be long: "deepseek/deepseek-r1-distill-70b").
  const modelLabel =
    cs.provider === "anthropic"
      ? (MODELS.find((m) => m.id === cs.model)?.label ?? cs.model)
      : (cs.model.split("/").pop() ?? cs.model).slice(0, 16);
  const effortLabel =
    cs.effort === "medium" ? "Steady" : cs.effort === "high" ? "Deep" : "Exhaustive";

  return (
    <div className="flex h-[100svh] flex-col overflow-hidden bg-night text-parchment">
      {/* Lamp glow pooling over the desk */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[38vh] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(227,176,75,0.06),transparent_72%)]" />

      {/* Top bar */}
      <header className="relative z-10 flex h-[calc(3.5rem+var(--sat))] shrink-0 items-center gap-2.5 border-b border-white/[0.06] bg-night/85 px-3 pt-[var(--sat)] backdrop-blur-sm sm:gap-3 sm:px-4">
        <Link
          to="/studio"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-faded transition-colors hover:bg-white/5 hover:text-parchment active:scale-95"
          aria-label="All notebooks"
        >
          <ChevronLeft size={18} />
        </Link>
        <Flame size={15} className="shrink-0 text-brass" />
        <input
          defaultValue={notebook?.name}
          key={notebook?.name}
          onBlur={(e) => rename(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="min-w-0 max-w-[42vw] flex-none truncate rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-[15px] font-[450] outline-none transition-colors hover:border-white/10 focus:border-brass/40 sm:max-w-xs sm:text-[16px]"
          aria-label="Notebook name"
        />
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faded transition-colors hover:border-white/20 hover:text-parchment sm:flex"
          >
            {modelLabel} · {effortLabel}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-faded transition-colors hover:bg-white/5 hover:text-parchment active:scale-95"
            aria-label="Settings"
          >
            <Settings2 size={17} />
          </button>
        </div>
      </header>

      {/* Panes — glass islands floating on the night */}
      <div className="relative z-10 hidden min-h-0 flex-1 gap-3 px-3 pb-3 pt-3 lg:flex">
        {/* Sources */}
        <motion.aside
          initial={false}
          animate={{ width: collapsed.sources ? RAIL_W : SOURCES_W }}
          transition={SPRING}
          className="relative shrink-0 overflow-visible"
        >
          <motion.div
            initial={{ opacity: 0, x: -28 }}
            animate={{ opacity: collapsed.sources ? 0 : 1, x: collapsed.sources ? -28 : 0 }}
            transition={SOFT}
            className={`absolute inset-y-0 left-0 w-[308px] ${collapsed.sources ? "pointer-events-none" : ""}`}
          >
            <div className={`${glassPane} flex h-full flex-col overflow-hidden`}>
              <SourcesPane
                notebookId={notebookId}
                version={sourcesVersion}
                onCollapse={() => setCollapsed((c) => ({ ...c, sources: true }))}
                onChanged={() => setSourcesVersion((v) => v + 1)}
                pendingView={pendingView}
                onPendingConsumed={() => setPendingView(null)}
              />
            </div>
          </motion.div>
          <div
            className={`absolute inset-0 flex flex-col items-center pt-4 transition-opacity duration-200 ${
              collapsed.sources ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <RailButton icon={BookText} label="Sources" side="left" onClick={() => setCollapsed((c) => ({ ...c, sources: false }))} />
          </div>
        </motion.aside>

        {/* Chat */}
        <main className="min-w-0 flex-1">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SOFT, delay: 0.08 }}
            className={`${glassPane} h-full overflow-hidden`}
          >
            <ChatPane notebook={notebook} sourcesVersion={sourcesVersion} onNavigateSources={openSource} />
          </motion.div>
        </main>

        {/* Studio */}
        <motion.aside
          initial={false}
          animate={{ width: collapsed.studio ? RAIL_W : STUDIO_W }}
          transition={SPRING}
          className="relative shrink-0 overflow-visible"
        >
          <motion.div
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: collapsed.studio ? 0 : 1, x: collapsed.studio ? 28 : 0 }}
            transition={{ ...SOFT, delay: 0.14 }}
            className={`absolute inset-y-0 right-0 w-[344px] ${collapsed.studio ? "pointer-events-none" : ""}`}
          >
            <div className={`${glassPane} flex h-full flex-col overflow-hidden`}>
              <StudioPane
                notebookId={notebookId}
                onCollapse={() => setCollapsed((c) => ({ ...c, studio: true }))}
              />
            </div>
          </motion.div>
          <div
            className={`absolute inset-0 flex flex-col items-center pt-4 transition-opacity duration-200 ${
              collapsed.studio ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <RailButton icon={LibraryBig} label="Studio" side="right" onClick={() => setCollapsed((c) => ({ ...c, studio: false }))} />
          </div>
        </motion.aside>
      </div>

      {/* Mobile: one pane + tab bar */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:hidden">
        <div className="min-h-0 flex-1">
          {mobilePane === "sources" && (
            <SourcesPane
              notebookId={notebookId}
              version={sourcesVersion}
              onChanged={() => setSourcesVersion((v) => v + 1)}
              pendingView={pendingView}
              onPendingConsumed={() => setPendingView(null)}
            />
          )}
          {mobilePane === "chat" && (
            <ChatPane notebook={notebook} sourcesVersion={sourcesVersion} onNavigateSources={openSource} />
          )}
          {mobilePane === "studio" && <StudioPane notebookId={notebookId} />}
        </div>
        <nav className="flex h-[calc(4.25rem+var(--sab))] shrink-0 items-center justify-around border-t border-white/[0.06] bg-night/95 px-3 pb-[var(--sab)] pt-1">
          {(
            [
              ["sources", BookText, "Sources"],
              ["chat", MessagesSquare, "Chat"],
              ["studio", LibraryBig, "Studio"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setMobilePane(id)}
              className={`relative flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.14em] transition-colors duration-200 active:scale-95 ${
                mobilePane === id ? "text-brasspale" : "text-faded"
              }`}
            >
              {mobilePane === id && (
                <motion.span
                  layoutId="mobile-tab-pill"
                  transition={SPRING}
                  className="absolute inset-0 rounded-xl border border-brass/20 bg-brass/[0.07]"
                />
              )}
              <Icon size={20} className="relative z-10" />
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </nav>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

/** Icon button for a collapsed pane's rail, with a hover tooltip that
 *  springs out toward the chat. */
function RailButton({
  icon: Icon,
  label,
  side,
  onClick,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-faded shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors duration-200 hover:border-brass/35 hover:text-brasspale"
        aria-label={`Show ${label}`}
      >
        <Icon size={16} />
      </button>
      <span
        className={`pointer-events-none absolute top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-study px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-parchment opacity-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all duration-200 group-hover:opacity-100 ${
          side === "left"
            ? "left-full ml-2.5 translate-x-[-6px] scale-95 group-hover:translate-x-0 group-hover:scale-100"
            : "right-full mr-2.5 translate-x-[6px] scale-95 group-hover:translate-x-0 group-hover:scale-100"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
