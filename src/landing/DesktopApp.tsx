import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Download, CheckCircle2, Monitor, Apple, AppWindow, ShieldCheck, WifiOff } from "lucide-react";
import SectionHead from "./SectionHead";
import { detectPlatform, isStandalone } from "../lib/desktop";

gsap.registerPlugin(ScrollTrigger);

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const RELEASES_URL = "https://github.com/yuzuruu29/comtus/releases/latest";

/** Per-browser install pointers when the one-click prompt isn't available. */
function manualHint(platform: string): string {
  if (platform === "mac") {
    return /Safari/i.test(navigator.userAgent) && !/Chrome|Edg/i.test(navigator.userAgent)
      ? "Safari → Share ⌘·Share → Add to Dock"
      : "Chrome / Edge → ⋮ menu → Install Comtus…";
  }
  if (platform === "windows") {
    return /Firefox/i.test(navigator.userAgent)
      ? "Firefox can't install web apps — grab the native .exe build instead."
      : "Chrome / Edge → ⋮ menu → Install Comtus…";
  }
  return "Chrome / Edge → ⋮ menu → Install Comtus…";
}

/** 06 — THE DESK APP · installable macOS/Windows build + glossy window preview. */
export default function DesktopApp() {
  const rootRef = useRef<HTMLElement>(null);
  const platform = detectPlatform();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    if (isStandalone()) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>(".reveal-desk");
      if (reduced) {
        gsap.set(targets, { opacity: 1, y: 0 });
        return;
      }
      targets.forEach((el, i) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 38 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power3.out",
            delay: (i % 3) * 0.08,
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          },
        );
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      setDeferred(null);
    } else {
      setShowHow(true);
    }
  };

  const platformLabel =
    platform === "mac" ? "macOS" : platform === "windows" ? "Windows" : "your desktop";

  return (
    <section
      ref={rootRef}
      id="desktop"
      className="relative border-y border-white/[0.06] bg-study/25 py-[clamp(5.5rem,12vh,9rem)]"
    >
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="reveal-desk">
          <SectionHead
            index="06"
            label="The Desk App"
            title={
              <>
                The whole desk, <em className="font-[420] text-lamp">as an app.</em>
              </>
            }
            sub="Comtus installs as a real desktop app on macOS and Windows — its own window, no address bar, offline-ready. Notebooks, sources, and keys stay on this machine, exactly as before."
          />
        </div>

        <div className="mt-14 grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          {/* Install panel */}
          <div className="reveal-desk lg:col-span-6">
            <div className="relative overflow-hidden rounded-[1.9rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-8">
              <div
                aria-hidden
                className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-faded">
                  <Monitor size={11} className="text-brass" /> Detected: {platformLabel}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-sage bg-sage/10 border border-sage/25 px-2 py-0.5 rounded-full">
                  Free · One click
                </span>
              </div>

              {installed ? (
                <div className="mt-6 flex items-center gap-3 rounded-xl border border-sage/30 bg-sage/[0.07] px-4 py-3.5 text-[13.5px] text-sage">
                  <CheckCircle2 size={16} className="shrink-0" />
                  Installed — Comtus now lives in your Applications folder / Start menu.
                </div>
              ) : (
                <button
                  onClick={() => void install()}
                  className="group mt-6 flex w-full items-center justify-center gap-2.5 rounded-full grad-lamp px-7 py-4 text-[14.5px] font-semibold text-night shadow-[0_12px_44px_rgba(227,176,75,0.25)] transition-all duration-300 hover:shadow-[0_16px_60px_rgba(227,176,75,0.38)] active:scale-[0.98]"
                >
                  <Download size={16} strokeWidth={2.4} className="transition-transform duration-300 group-hover:translate-y-0.5" />
                  Install Comtus for {platformLabel}
                </button>
              )}

              {showHow && !installed && (
                <div className="mt-3 rounded-xl border border-white/10 bg-night/70 px-4 py-3 text-[12.5px] leading-relaxed text-faded">
                  {manualHint(platform)}
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <a
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between rounded-xl border border-white/[0.08] bg-night/50 px-4 py-3 transition-all duration-300 hover:border-brass/35 hover:bg-brass/[0.04]"
                >
                  <span className="flex items-center gap-2.5 text-[13px] text-parchment/90">
                    <Apple size={15} className="text-parchment/70" />
                    macOS · .dmg
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-faded transition-colors group-hover:text-brasspale">
                    Download
                  </span>
                </a>
                <a
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between rounded-xl border border-white/[0.08] bg-night/50 px-4 py-3 transition-all duration-300 hover:border-brass/35 hover:bg-brass/[0.04]"
                >
                  <span className="flex items-center gap-2.5 text-[13px] text-parchment/90">
                    <AppWindow size={15} className="text-parchment/70" />
                    Windows · .exe
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-faded transition-colors group-hover:text-brasspale">
                    Download
                  </span>
                </a>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.06] pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-faded/70">
                <span className="flex items-center gap-1.5">
                  <WifiOff size={11} className="text-brass/70" /> Offline-ready
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={11} className="text-brass/70" /> Keys stay local
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={11} className="text-brass/70" /> Auto-updating
                </span>
              </div>
            </div>
          </div>

          {/* Glossy window preview */}
          <div className="reveal-desk lg:col-span-6">
            <div className="group relative overflow-hidden rounded-[1.9rem] border border-white/[0.09] bg-white/[0.035] p-2 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.65)]">
              <div className="relative overflow-hidden rounded-[1.5rem] bg-night">
                <div className="desk-gloss" aria-hidden />
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-0 h-56 w-[120%] -translate-x-1/2 rounded-full bg-[radial-gradient(50%_100%_at_50%_0%,rgba(227,176,75,0.14),rgba(42,54,84,0.18)_55%,transparent_80%)]"
                />
                {/* Title bar */}
                <div className="relative flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-rust/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-brass/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-sage/80" />
                  <span className="ml-3 font-mono text-[10px] tracking-[0.18em] text-faded">
                    COMTUS — THE MIDNIGHT DESK
                  </span>
                </div>
                {/* App home mock */}
                <div className="relative space-y-4 p-6">
                  <div>
                    <div className="label-mono !text-[9px]">Good evening · Friday</div>
                    <div className="mt-2 font-display text-[1.55rem] font-[420] leading-snug text-parchment">
                      Your notebooks, <em className="text-lamp">lamplit.</em>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      ["Biochemistry", "12 sources"],
                      ["PNLE Review", "31 sources"],
                      ["Patho Lectures", "8 sources"],
                    ].map(([name, meta]) => (
                      <div
                        key={name}
                        className="rounded-xl border border-white/[0.07] bg-study/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-brass/30 bg-brass/10">
                          <span className="h-1.5 w-1.5 rounded-full bg-brass" />
                        </div>
                        <div className="mt-2.5 truncate text-[11px] font-medium text-parchment/90">{name}</div>
                        <div className="mt-0.5 font-mono text-[8.5px] uppercase tracking-wider text-faded">{meta}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/15 px-3.5 py-2.5 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-faded">
                    + New notebook
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
