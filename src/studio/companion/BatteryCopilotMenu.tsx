import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, CaretDown, X } from "@phosphor-icons/react";
import type { CompanionControls } from "../../components/pixel/PixelBatteryCompanion";
import { useDesk } from "../DeskContext";
import { useCompadChat } from "../CompadChatContext";

export function copilotStatus(opts: { think: boolean; milestones: number }): string {
  if (opts.think) return "Working on your question…";
  if (opts.milestones > 0) return `${opts.milestones} milestone${opts.milestones === 1 ? "" : "s"} unlocked`;
  return "Ready when you are";
}

export default function BatteryCopilotMenu({ onClose, status, controls }: {
  onClose: () => void;
  status: string;
  controls: CompanionControls;
}) {
  const desk = useDesk();
  const { setTarget } = useCompadChat();
  const [greeting, setGreeting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const opener = useRef(document.activeElement as HTMLElement | null);
  const sizeId = useId();

  const close = useCallback(() => {
    onClose();
    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
  }, [onClose]);

  useEffect(() => { rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && rootRef.current?.contains(document.activeElement)) { event.stopPropagation(); close(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div ref={rootRef} className="compad-panel" role="dialog" aria-modal="false" aria-label="Compad">
      <header className="compad-panel-header"><div><h2>Compad</h2><p>{status}</p></div><button type="button" onClick={close} aria-label="Close Compad"><X size={19} aria-hidden="true" /></button></header>
      <div ref={setTarget} className="compad-chat-target" />
      {greeting && <p className="compad-greeting" role="status">Hello. One question at a time. I’m right here.</p>}
      <div className="compad-panel-actions"><button type="button" onClick={() => { controls.react(); setGreeting(true); }}>Say hello</button><button type="button" onClick={() => { onClose(); desk.focusChat(); }}>Open full chat<ArrowUpRight size={16} aria-hidden="true" /></button></div>
      <details className="compad-options"><summary>Make yourself comfortable<CaretDown size={15} aria-hidden="true" /></summary><div className="compad-options-body">
        <label htmlFor={sizeId}>Compad size<output htmlFor={sizeId}>{Math.round(controls.width)} px</output></label>
        <input id={sizeId} type="range" min={60} max={280} step={1} value={controls.width} onChange={(event) => controls.setWidth(Number(event.target.value))} />
        <button type="button" onClick={controls.resetPlacement}>Reset position</button>
        <div className="compad-shortcuts"><button type="button" onClick={() => { onClose(); desk.importFiles(); }}>Add sources</button><button type="button" onClick={() => { onClose(); desk.openMilestones(); }}>Milestones</button><button type="button" onClick={() => { onClose(); desk.openSettings(); }}>Settings</button></div>
      </div></details>
    </div>
  );
}
