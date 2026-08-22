import { Minus, Square, X } from "@phosphor-icons/react";
import { detectPlatform, isTauri } from "../lib/desktop";

async function windowApi() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export default function CaptionButtons() {
  if (!isTauri() || detectPlatform() === "mac") return null;

  const go = async (action: "minimize" | "toggleMaximize" | "close") => {
    const w = await windowApi();
    if (action === "minimize") await w.minimize();
    else if (action === "toggleMaximize") await w.toggleMaximize();
    else await w.close();
  };

  return (
    <div className="ml-auto flex h-full shrink-0 items-stretch">
      <button
        type="button"
        onClick={() => void go("minimize")}
        className="flex w-[46px] items-center justify-center text-muted hover:bg-ink/[0.06] hover:text-ink"
        aria-label="Minimize"
      >
        <Minus size={14} weight="light" />
      </button>
      <button
        type="button"
        onClick={() => void go("toggleMaximize")}
        className="flex w-[46px] items-center justify-center text-muted hover:bg-ink/[0.06] hover:text-ink"
        aria-label="Maximize"
      >
        <Square size={12} weight="light" />
      </button>
      <button
        type="button"
        onClick={() => void go("close")}
        className="flex w-[46px] items-center justify-center text-muted hover:bg-rust/80 hover:text-ink"
        aria-label="Close"
      >
        <X size={14} weight="light" />
      </button>
    </div>
  );
}
