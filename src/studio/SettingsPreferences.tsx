import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowClockwise, SpeakerHigh } from "@phosphor-icons/react";
import { Button, Segmented } from "../ui";
import { useSettings } from "../lib/settings";
import { DEFAULT_LEADING, DEFAULT_READING, LEADING_OPTIONS, READING_OPTIONS } from "../lib/fontPresets";
import {
  getActiveAmbient,
  getAmbientVolume,
  getSfxVolume,
  isMuted,
  playSfx,
  setAmbientVolume,
  setMuted,
  setSfxVolume,
  startAmbient,
  stopAmbient,
  subscribeAudioEngine,
  type AmbientSoundType,
} from "../lib/soundEngine";
import { detectPlatform } from "../lib/desktop";
import { modLabel } from "./shortcuts";
import { useMotionMode } from "./fx";
import DataTrustPanel from "./DataTrustPanel";
import { ICON } from "../ui/iconScale";
import "./settings-preferences.css";

const SECTIONS = [
  { id: "look", label: "Look" },
  { id: "reading", label: "Reading" },
  { id: "writing", label: "Writing" },
  { id: "motion", label: "Motion" },
  { id: "sound", label: "Sound" },
  { id: "companion", label: "Companion" },
  { id: "data", label: "Your data" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];
type Background = AmbientSoundType | "off";

const BACKGROUNDS: { value: Background; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "rain", label: "Rain" },
  { value: "fireplace", label: "Fireplace" },
  { value: "lofi", label: "Lo-fi" },
  { value: "all", label: "All three" },
];

/** A miniature desk in one palette: the ground, a page, a brass rule and two lines of ink. */
function DeskSwatch({ night = false }: { night?: boolean }) {
  return (
    <span className={`prefs-swatch ${night ? "theme-lamplight" : "theme-daylight"}`} aria-hidden="true">
      <span className="prefs-swatch-page">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

function CardLabel({ preview, name, note }: { preview: ReactNode; name: ReactNode; note: string }) {
  return (
    <>
      {preview}
      <span className="prefs-card-name">{name}</span>
      <span className="prefs-card-note">{note}</span>
    </>
  );
}

function PrefSwitch({
  checked,
  onChange,
  label,
  note,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  note: string;
}) {
  const id = useId();
  return (
    <div className="prefs-row">
      <div>
        <span id={`${id}-label`} className="prefs-row-label">
          {label}
        </span>
        <p id={`${id}-note`} className="prefs-row-note">
          {note}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-note`}
        className="prefs-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="prefs-switch-thumb" />
      </button>
    </div>
  );
}

function Section({
  id,
  index,
  title,
  note,
  children,
}: {
  id: SectionId;
  index: number;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section data-pref={id} aria-labelledby={`prefs-${id}`} className="prefs-section">
      <header className="prefs-section-head">
        <span className="prefs-section-number" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <h3 id={`prefs-${id}`}>{title}</h3>
          {note && <p>{note}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

/** A page arriving under the motion budget in force right now, drawn with the
 *  desk's own keyframes (desk-motion.css), so what it shows is what you get. */
function MotionDemo() {
  return (
    <span className="prefs-demo" aria-hidden="true">
      <span className="prefs-demo-rule" />
      <span className="prefs-demo-title" />
      {[0, 1, 2, 3].map((n) => (
        <span key={n} className="prefs-demo-line" style={{ "--n": n } as CSSProperties} />
      ))}
      <span className="prefs-demo-cite" />
    </span>
  );
}

/** Studio preferences: how the desk looks, reads, sends, moves and sounds.
 *  Each choice is a preview of itself, so nothing here has to be tried blind. */
export default function SettingsPreferences({ footer, onDone }: { footer: ReactNode; onDone: () => void }) {
  const theme = useSettings((s) => s.theme) ?? "light";
  const motionMode = useSettings((s) => s.motionMode) ?? "full";
  const companionOn = useSettings((s) => s.companion !== false);
  const chimesOn = useSettings((s) => s.companionSfx !== false);
  const pixelOn = useSettings((s) => s.pixelDesk === true);
  const reading = useSettings((s) => s.reading ?? DEFAULT_READING);
  const leading = useSettings((s) => s.leading ?? DEFAULT_LEADING);
  const sendKey = useSettings((s) => s.sendKey ?? "enter");
  const update = useSettings((s) => s.update);
  const osReducesMotion = useReducedMotion();
  const effectiveMotion = useMotionMode();
  const mod = modLabel(detectPlatform());

  const [muted, setMutedState] = useState(() => isMuted());
  const [background, setBackground] = useState<Background>(() => getActiveAmbient() ?? "off");
  const [backgroundVol, setBackgroundVol] = useState(() => getAmbientVolume());
  const [effectsVol, setEffectsVol] = useState(() => getSfxVolume());
  const [demoRun, setDemoRun] = useState(0);

  useEffect(
    () =>
      subscribeAudioEngine((state) => {
        setMutedState(state.muted);
        setBackground(state.activeAmbient ?? "off");
        setBackgroundVol(state.ambientVolume);
        setEffectsVol(state.sfxVolume);
      }),
    [],
  );

  // The index follows the reader: the last section to cross the upper third
  // of the sheet, or the last section once the sheet is scrolled to its end.
  // The scroller is the Dialog's body, this panel's parent.
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<SectionId>("look");
  useEffect(() => {
    const root = rootRef.current;
    const scroller = root?.parentElement;
    if (!root || !scroller) return;
    const sections = [...root.querySelectorAll<HTMLElement>("[data-pref]")];
    let frame = 0;
    const update = () => {
      frame = 0;
      const edge = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.38;
      const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
      const current = atEnd ? sections.at(-1) : sections.filter((s) => s.getBoundingClientRect().top <= edge).at(-1);
      if (current) setActive(current.dataset.pref as SectionId);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // On a phone the index is a strip wider than the sheet: keep the current tab in it.
  const indexRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const strip = indexRef.current;
    const tab = strip?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!strip || !tab || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: tab.offsetLeft - 24 });
  }, [active]);

  const jumpTo = (id: SectionId) => {
    setActive(id);
    rootRef.current?.querySelector(`[data-pref="${id}"]`)?.scrollIntoView({
      block: "start",
      behavior: effectiveMotion === "full" ? "smooth" : "auto",
    });
  };

  return (
    <div ref={rootRef} className="settings-preferences prefs">
      <nav ref={indexRef} className="prefs-index" aria-label="Settings sections">
        {SECTIONS.map((section, index) => (
          <button
            key={section.id}
            type="button"
            // The Dialog would otherwise focus the first input, a volume slider halfway down.
            data-autofocus={index === 0 ? true : undefined}
            aria-current={active === section.id ? "true" : undefined}
            onClick={() => jumpTo(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <div className="prefs-sections">
        <Section id="look" index={0} title="Look" note="How the desk is lit and lettered.">
          <div className="prefs-field">
            <div className="field-label">Light</div>
            <Segmented
              aria-label="Light"
              className="prefs-cards prefs-cards-3"
              value={theme}
              onChange={(value) => update({ theme: value })}
              options={[
                {
                  value: "light",
                  label: <CardLabel preview={<DeskSwatch />} name="Daylight" note="Paper and ink" />,
                },
                {
                  value: "dark",
                  label: <CardLabel preview={<DeskSwatch night />} name="Lamplight" note="A lamp at night" />,
                },
                {
                  value: "system",
                  label: (
                    <CardLabel
                      preview={
                        <span className="prefs-swatch-split" aria-hidden="true">
                          <DeskSwatch />
                          <DeskSwatch night />
                        </span>
                      }
                      name="Follow device"
                      note="Day by day, lamp by night"
                    />
                  ),
                },
              ]}
            />
          </div>
          <div className="prefs-field">
            <div className="field-label">Titles</div>
            <Segmented
              aria-label="Titles"
              className="prefs-cards prefs-cards-2"
              value={pixelOn ? "pixel" : "classic"}
              onChange={(value) => update({ pixelDesk: value === "pixel" })}
              options={[
                {
                  value: "classic",
                  label: (
                    <CardLabel
                      preview={<span className="prefs-lettering" aria-hidden="true">Comtus</span>}
                      name="Classic paper"
                      note="Set in Literata, like a book"
                    />
                  ),
                },
                {
                  value: "pixel",
                  label: (
                    <CardLabel
                      preview={<span className="prefs-lettering prefs-lettering-pixel" aria-hidden="true">Comtus</span>}
                      name="Pixel accents"
                      note="Pixel lettering, same colours"
                    />
                  ),
                },
              ]}
            />
          </div>
        </Section>

        <Section id="reading" index={1} title="Reading" note="Sources and answers follow these. The rest of the desk keeps its size.">
          <div className="prefs-field prefs-field-stack">
            <div>
              <div className="field-label">Size</div>
              <Segmented
                aria-label="Reading size"
                value={reading}
                onChange={(value) => update({ reading: value })}
                options={READING_OPTIONS.map((option) => ({
                  value: option.id,
                  label: <span style={{ fontFamily: "var(--font-read)", fontSize: option.size }}>{option.label}</span>,
                }))}
              />
            </div>
            <div>
              <div className="field-label">Line spacing</div>
              <Segmented
                aria-label="Line spacing"
                value={leading}
                onChange={(value) => update({ leading: value })}
                options={LEADING_OPTIONS.map((option) => ({
                  value: option.id,
                  icon: (
                    <span className="prefs-leading-glyph" data-leading={option.id} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  ),
                  label: option.label,
                }))}
              />
            </div>
          </div>
          <p className="prefs-sample">
            Water crosses a membrane toward the side with more dissolved solute. In a hypotonic solution a cell
            takes water in and swells; in a hypertonic one it gives water up and shrinks.
            <span className="prefs-sample-cite">Campbell, p. 132</span>
          </p>
        </Section>

        <Section id="writing" index={2} title="Writing" note="How a question leaves the composer.">
          <div className="prefs-field">
            <div className="field-label">Send with</div>
            <Segmented
              aria-label="Send with"
              className="prefs-cards prefs-cards-2 prefs-cards-explained"
              value={sendKey}
              onChange={(value) => update({ sendKey: value })}
              options={[
                {
                  value: "enter",
                  label: (
                    <CardLabel
                      preview={
                        <span className="prefs-keys" aria-hidden="true">
                          <kbd>Enter</kbd>
                        </span>
                      }
                      name="Enter sends"
                      note="Shift+Enter starts a new line."
                    />
                  ),
                },
                {
                  value: "mod-enter",
                  label: (
                    <CardLabel
                      preview={
                        <span className="prefs-keys" aria-hidden="true">
                          <kbd>{mod}</kbd>+<kbd>Enter</kbd>
                        </span>
                      }
                      name={`${mod}+Enter sends`}
                      note="Enter starts a new line, for questions written in paragraphs."
                    />
                  ),
                },
              ]}
            />
          </div>
        </Section>

        <Section id="motion" index={3} title="Motion" note="How much the desk moves while you study.">
          <div className="prefs-motion">
            <Segmented
              aria-label="Motion"
              className="prefs-cards prefs-cards-stack"
              value={motionMode}
              onChange={(value) => {
                update({ motionMode: value });
                setDemoRun((run) => run + 1);
              }}
              options={[
                { value: "full", label: <CardLabel preview={null} name="Full" note="Pages settle, titles set into their lines, the lamp breathes." /> },
                { value: "minimal", label: <CardLabel preview={null} name="Minimal" note="Things fade in place. Nothing travels." /> },
                { value: "none", label: <CardLabel preview={null} name="None" note="Every change lands at once." /> },
              ]}
            />
            <figure className="prefs-demo-frame">
              <MotionDemo key={demoRun} />
              <figcaption>
                <span>How pages arrive</span>
                <button type="button" className="prefs-replay" onClick={() => setDemoRun((run) => run + 1)}>
                  <ArrowClockwise size={ICON.sm} aria-hidden="true" />
                  Replay
                </button>
              </figcaption>
            </figure>
          </div>
          {osReducesMotion && (
            <p className="prefs-notice" role="note">
              Your device asks for reduced motion, so the desk stays still whatever you choose here. You can change
              that in your system's accessibility settings.
            </p>
          )}
        </Section>

        <Section id="sound" index={4} title="Sound" note="Everything the desk plays, under one switch.">
          <PrefSwitch
            checked={!muted}
            onChange={(on) => {
              setMuted(!on);
              if (on) playSfx("lampChime");
            }}
            label="Play sounds"
            note="Background sound, page sounds and study chimes. Off silences all of them."
          />
          <div className="prefs-field">
            <div className="field-label">Background</div>
            <Segmented
              aria-label="Background sound"
              value={background}
              onChange={(value) => (value === "off" ? stopAmbient() : startAmbient(value))}
              options={BACKGROUNDS}
            />
          </div>
          <div className="prefs-field prefs-field-pair">
            <label className="prefs-slider">
              <span>
                Background volume <b>{Math.round(backgroundVol * 100)}%</b>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={backgroundVol}
                aria-valuetext={`${Math.round(backgroundVol * 100)}%`}
                onChange={(event) => setAmbientVolume(parseFloat(event.target.value))}
              />
            </label>
            <label className="prefs-slider">
              <span>
                Effects volume <b>{Math.round(effectsVol * 100)}%</b>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={effectsVol}
                aria-valuetext={`${Math.round(effectsVol * 100)}%`}
                onChange={(event) => setSfxVolume(parseFloat(event.target.value))}
              />
            </label>
          </div>
          <PrefSwitch
            checked={chimesOn}
            onChange={(on) => update({ companionSfx: on })}
            label="Study chimes"
            note="A soft chime when a quiz answer lands, a card flips or a milestone opens."
          />
          <Button
            variant="secondary"
            size="sm"
            icon={<SpeakerHigh size={ICON.md} aria-hidden="true" />}
            onClick={() => {
              if (muted) setMuted(false);
              playSfx("lampChime");
            }}
          >
            {muted ? "Turn sound on and play a sample" : "Play a sample"}
          </Button>
        </Section>

        <Section id="companion" index={5} title="Companion">
          <PrefSwitch
            checked={companionOn}
            onChange={(on) => update({ companion: on })}
            label="Compad on your desk"
            note="Drag it anywhere, resize it from its corner, or tap it to chat about your notebook."
          />
        </Section>

        <section data-pref="data" aria-label="Your data" className="prefs-section">
          <DataTrustPanel open />
          {footer}
        </section>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
