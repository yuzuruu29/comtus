import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Question } from "@phosphor-icons/react";
import { useSettings } from "../lib/settings";
import { OLLAMA_BASE_URL, RECOMMENDED_MODEL, pickOllamaModel, probeOllama } from "../lib/ollama";
import ExternalLink from "../studio/ExternalLink";
import { Modal, btnGhost, btnLamp } from "../studio/ui";
import { ICON } from "../ui/iconScale";

type Phase = "probing" | "ready" | "missing" | "nomodels" | "done";

/** The desk's first-run guide: find Ollama, offer a local model, and leave
    the hosted top-up as an aside. Local is the default path; nothing here
    sends study material anywhere. */
export default function FirstRunSetup({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const s = useSettings();
  const [phase, setPhase] = useState<Phase>("probing");
  const [models, setModels] = useState<string[]>([]);
  const [origin, setOrigin] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number>(0);

  const runProbe = useCallback(() => {
    setPhase("probing");
    setCopied(false);
    void probeOllama().then((status) => {
      setModels(status.models);
      setOrigin(status.origin);
      setAttempts((n) => n + 1);
      if (!status.reachable) setPhase("missing");
      else if (status.models.length === 0) setPhase("nomodels");
      else setPhase("ready");
    });
  }, []);

  useEffect(() => {
    if (open) runProbe();
  }, [open, runProbe]);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const choose = (model: string) => {
    s.update({
      provider: "openai-compatible",
      compatBaseUrl: origin ? `${origin}/v1` : OLLAMA_BASE_URL,
      compatModel: model,
      compatKey: "",
      deskSetupDone: true,
    });
    setPhase("done");
  };

  const skip = () => {
    s.update({ deskSetupDone: true });
    onClose();
  };

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(`ollama pull ${RECOMMENDED_MODEL}`);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the command stays visible to type by hand */
    }
  };

  return (
    <Modal open={open} onClose={skip} title="Set up your local model">
      <div className="desk-setup">
        {phase === "probing" && (
          <p className="desk-setup-note" role="status">
            Looking for Ollama on this machine…
          </p>
        )}

        {phase === "ready" && (
          <>
            <p className="desk-setup-note">
              Ollama is running here, and {models.length === 1 ? "one model is" : `${models.length} models are`} installed. Nothing
              you study leaves the machine while a local model answers.
            </p>
            <div className="desk-setup-actions-row">
              <button type="button" className={btnLamp} onClick={() => choose(pickOllamaModel(models))}>
                Use {pickOllamaModel(models)}
              </button>
            </div>
          </>
        )}

        {phase === "missing" && (
          <>
            <p className="desk-setup-note">
              Ollama is not running yet. It is a small, free download that keeps the model on your
              machine.
            </p>
            <ol className="desk-setup-steps">
              <li>
                <span>Install Ollama</span>
                <p>
                  Get it from{" "}
                  <ExternalLink href="https://ollama.com/download">ollama.com/download</ExternalLink> and
                  install it. It runs quietly in the background once started.
                </p>
              </li>
              <li>
                <span>Check again</span>
                <p>When Ollama is running, come back here.</p>
              </li>
            </ol>
            {attempts >= 2 && (
              <p className="desk-setup-hint" role="note">
                Still not visible? Quit Ollama, allow the Comtus window with{" "}
                <code>OLLAMA_ORIGINS=&quot;*&quot;</code> in your environment, then start Ollama again.
              </p>
            )}
            <div className="desk-setup-actions-row">
              <button type="button" className={btnGhost} onClick={skip}>
                Skip for now
              </button>
              <button type="button" className={btnLamp} onClick={runProbe}>
                Check again
              </button>
            </div>
          </>
        )}

        {phase === "nomodels" && (
          <>
            <p className="desk-setup-note">
              Ollama is running, but no model is downloaded yet. One command brings home the suggested
              one.
            </p>
            <div className="desk-setup-command">
              <code>ollama pull {RECOMMENDED_MODEL}</code>
              <button type="button" onClick={() => void copyCommand()} aria-label="Copy the pull command">
                {copied ? <Check size={ICON.md} /> : <Copy size={ICON.md} />}
              </button>
            </div>
            <p className="desk-setup-note">About 2 GB, one time. Questions then answer entirely offline.</p>
            <div className="desk-setup-actions-row">
              <button type="button" className={btnGhost} onClick={skip}>
                Skip for now
              </button>
              <button type="button" className={btnLamp} onClick={runProbe}>
                Check again
              </button>
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <p className="desk-setup-note">
              The lamp is lit. Your model answers from this machine now — sources, notebooks, and history
              stay on it too.
            </p>
            <div className="desk-setup-actions-row">
              <button type="button" className={btnLamp} onClick={onClose}>
                Open the desk
              </button>
            </div>
          </>
        )}

        {phase !== "done" && (
          <p className="desk-setup-aside">
            <Question size={ICON.sm} aria-hidden="true" />
            <span>
              Prefer Claude Opus 5.5 or Sonnet 5.5? Hosted access is a one-time PayPal top-up under
              Settings, then Smarter Models.
            </span>
          </p>
        )}
      </div>
    </Modal>
  );
}
