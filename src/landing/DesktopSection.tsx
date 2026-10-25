import { useMemo } from "react";
import { detectPlatform } from "../lib/desktop";
import "./landing.css";

/* Installer names are pinned by the release workflow, which uploads
   version-stripped copies alongside the versioned Tauri artifacts so these
   links survive every release. */
const RELEASES = "https://github.com/yuzuruu29/comtus-releases/releases/latest/download";

const DOWNLOADS = [
  { id: "windows", label: "Windows", note: "64-bit installer", href: `${RELEASES}/Comtus_x64-setup.exe` },
  { id: "mac-arm", label: "macOS", note: "Apple silicon", href: `${RELEASES}/Comtus_aarch64.dmg` },
  { id: "mac-intel", label: "macOS", note: "Intel", href: `${RELEASES}/Comtus_x64.dmg` },
] as const;

/** The detected platform's row, with the rest kept as honest alternates.
    Unknown platforms (and tests) see all three as equals. */
function useDownloads() {
  return useMemo(() => {
    const platform = detectPlatform();
    const primaryId = platform === "windows" ? "windows" : platform === "mac" ? "mac-arm" : null;
    return DOWNLOADS.map((d) => ({ ...d, primary: d.id === primaryId }));
  }, []);
}

/** The website's desktop-app section: what to install, and the Ollama first
    run that turns it into a local, free study desk. */
export default function DesktopSection() {
  const downloads = useDownloads();
  const primary = downloads.find((d) => d.primary);

  return (
    <section id="desktop" className="landing-section landing-desktop" aria-labelledby="landing-desktop-title">
      <div className="landing-container">
        <div className="landing-section-heading landing-desktop-heading" data-landing-reveal>
          <h2 id="landing-desktop-title">
            The desk, installed.<br />
            <em>Local and free.</em>
          </h2>
          <p>
            Comtus Desktop is the same notebook as an installed app, with its model running on your
            own machine through Ollama.
          </p>
        </div>

        <div className="landing-desktop-body">
          <div className="landing-desktop-card" data-landing-reveal>
            <h3>{primary ? `Install for ${primary.label}` : "Install Comtus"}</h3>
            <p>Windows and macOS. Free, and no account.</p>
            {primary ? (
              <>
                <a className="btn btn-primary btn-md" href={primary.href}>
                  Download for {primary.label}
                </a>
                <div className="landing-desktop-alternates">
                  {downloads
                    .filter((d) => !d.primary)
                    .map((d) => (
                      <a key={d.id} href={d.href}>
                        {d.label} ({d.note})
                      </a>
                    ))}
                </div>
              </>
            ) : (
              <div className="landing-desktop-alternates">
                {downloads.map((d) => (
                  <a key={d.id} href={d.href}>
                    {d.label} ({d.note})
                  </a>
                ))}
              </div>
            )}
            <p className="landing-desktop-footnote">Updates arrive quietly inside the app.</p>
          </div>

          <ol className="landing-desktop-steps" data-landing-reveal>
            <li>
              <span>Install Comtus</span>
              <p>Run the installer. The desk opens straight away; notebooks live in local storage.</p>
            </li>
            <li>
              <span>Bring home Ollama</span>
              <p>
                Install the free runtime from{" "}
                <a href="https://ollama.com/download">ollama.com/download</a>. On first launch, the
                app&rsquo;s setup guide opens and walks you through it.
              </p>
            </li>
            <li>
              <span>Pull a model</span>
              <p>
                The guide suggests one sized for a study laptop, about 2 GB, and checks that it
                answers. Everything then works offline.
              </p>
            </li>
          </ol>
        </div>

        <p className="landing-desktop-smarter" data-landing-reveal>
          Local models are free. When a chapter calls for more, hosted access to{" "}
          <strong>Claude Opus 5.5 and Sonnet 5.5</strong> is a one-time PayPal top-up inside the app,
          under Settings, then Smarter Models. The local model stays yours either way.
        </p>
      </div>
    </section>
  );
}
