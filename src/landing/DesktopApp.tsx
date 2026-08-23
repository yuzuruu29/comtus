import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Apple, Download, ShieldCheck, WifiOff } from "lucide-react";
import SectionHead from "./SectionHead";
import { detectPlatform } from "../lib/desktop";

gsap.registerPlugin(ScrollTrigger);

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

/* Hosted installers — one click, ready for setup. */
const RELEASE_BASE = `https://github.com/yuzuruu29/comtus/releases/download/v${__APP_VERSION__}`;
const DESKTOP_BUILDS = {
  mac: `${RELEASE_BASE}/Comtus_${__APP_VERSION__}_aarch64.dmg`,
  macIntel: `${RELEASE_BASE}/Comtus_${__APP_VERSION__}_x64.dmg`,
  win: `${RELEASE_BASE}/Comtus_${__APP_VERSION__}_x64-setup.exe`,
};

/** Per-browser install pointers when the one-click PWA prompt isn't available. */
function manualHint(platform: string): string {
  if (platform === "mac") {
    return /Safari/i.test(navigator.userAgent) && !/Chrome|Edg/i.test(navigator.userAgent)
      ? "Safari → Share → Add to Dock"
      : "Chrome / Edge → ⋮ menu → Install Comtus…";
  }
  if (platform === "windows") {
    return /Firefox/i.test(navigator.userAgent)
      ? "Firefox can't install web apps — use the desktop installer above."
      : "Chrome / Edge → ⋮ menu → Install Comtus…";
  }
  return "Chrome / Edge → ⋮ menu → Install Comtus…";
}

function WindowsLogo({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm8.7-1.3L21 3v8.5h-9.3V4.2ZM3 12.5h7.5v7.1L3 18.5v-6Zm9.7 0H21V21l-9.3-1.3v-7.2Z" />
    </svg>
  );
}

/** 06 — THE DESK APP · centered download panel, macOS + Windows. */
export default function DesktopApp() {
  const rootRef = useRef<HTMLElement>(null);
  const platform = detectPlatform();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [pwaHint, setPwaHint] = useState<string | null>(null);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
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
          { opacity: 0, y: 34 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power3.out",
            delay: i * 0.09,
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          },
        );
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const installPwa = async () => {
    if (deferred) {
      await deferred.prompt();
      setDeferred(null);
    } else {
      setPwaHint(manualHint(platform));
    }
  };

  return (
    <section
      ref={rootRef}
      id="desktop"
      className="relative overflow-hidden border-y border-white/[0.06] bg-night py-[clamp(6rem,14vh,10rem)]"
    >
      {/* Lamplight well behind the panel */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(227,176,75,0.09),rgba(42,54,84,0.16)_50%,transparent_75%)] blur-[10px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />

      <div className="relative mx-auto w-full max-w-4xl px-6">
        <div className="reveal-desk">
          <SectionHead
            center
            index="06"
            label="The Desk App"
            title={
              <>
                The whole desk, <em className="font-[420] text-lamp">as an app.</em>
              </>
            }
            sub="Comtus runs as a real desktop app on macOS and Windows — its own window, no address bar, offline-ready. Notebooks, sources, and keys stay on this machine."
          />
        </div>

        <div className="reveal-desk mx-auto mt-14 max-w-2xl">
          <div className="relative rounded-[1.9rem] border border-white/[0.09] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]">
            <div
              aria-hidden
              className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
            />
            <div className="relative overflow-hidden rounded-[1.55rem] bg-study/60">
              <div className="desk-gloss" aria-hidden />

              <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2">
                {/* macOS */}
                <a
                  href={DESKTOP_BUILDS.mac}
                  download
                  className={`group relative flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-300 active:scale-[0.98] ${
                    platform === "mac"
                      ? "border-brass/45 bg-brass/[0.07] shadow-[0_0_30px_rgba(227,176,75,0.1)]"
                      : "border-white/[0.08] bg-night/60 hover:border-white/20 hover:bg-night/80"
                  }`}
                >
                  <Apple size={22} className="shrink-0 text-parchment/85" strokeWidth={1.6} />
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-medium text-parchment">
                      Download for macOS
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-wider text-faded">
                      Apple silicon · .dmg
                    </span>
                  </span>
                  {platform === "mac" ? (
                    <span className="ml-auto flex h-2 w-2 shrink-0 rounded-full bg-brass shadow-[0_0_8px_rgba(227,176,75,0.8)]" />
                  ) : (
                    <Download
                      size={14}
                      className="ml-auto shrink-0 text-faded transition-all duration-300 group-hover:translate-y-0.5 group-hover:text-parchment"
                    />
                  )}
                </a>

                {/* Windows */}
                <a
                  href={DESKTOP_BUILDS.win}
                  download
                  className={`group relative flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-300 active:scale-[0.98] ${
                    platform === "windows"
                      ? "border-brass/45 bg-brass/[0.07] shadow-[0_0_30px_rgba(227,176,75,0.1)]"
                      : "border-white/[0.08] bg-night/60 hover:border-white/20 hover:bg-night/80"
                  }`}
                >
                  <WindowsLogo size={21} className="shrink-0 text-parchment/85" />
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-medium text-parchment">
                      Download for Windows
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-wider text-faded">
                      Windows 10+ · x64 · .exe
                    </span>
                  </span>
                  {platform === "windows" ? (
                    <span className="ml-auto flex h-2 w-2 shrink-0 rounded-full bg-brass shadow-[0_0_8px_rgba(227,176,75,0.8)]" />
                  ) : (
                    <Download
                      size={14}
                      className="ml-auto shrink-0 text-faded transition-all duration-300 group-hover:translate-y-0.5 group-hover:text-parchment"
                    />
                  )}
                </a>
              </div>

              <p className="border-t border-white/[0.06] px-4 py-2.5 text-center text-[11px] leading-relaxed text-faded/75">
                First run on Windows may show a security prompt — choose “More info → Run
                anyway”. The app is built fresh from this site's own releases.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faded/70">
            <a href={DESKTOP_BUILDS.macIntel} download className="transition-colors hover:text-parchment">
              Intel Mac build · .dmg
            </a>
            <span aria-hidden className="text-white/15">·</span>
            <button onClick={() => void installPwa()} className="transition-colors hover:text-parchment">
              Or install as a browser app
            </button>
          </div>

          {pwaHint && (
            <div className="mt-3 rounded-xl border border-white/10 bg-night/70 px-4 py-3 text-center text-[12.5px] leading-relaxed text-faded">
              {pwaHint}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faded/70">
            <span className="flex items-center gap-1.5">
              <WifiOff size={11} className="text-brass/70" /> Offline-ready
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={11} className="text-brass/70" /> Keys stay local
            </span>
            <span className="flex items-center gap-1.5">
              <Download size={11} className="text-brass/70" /> Free
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
