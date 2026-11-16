import React from "react";
import { useCurrentFrame } from "remotion";
import { SITE, font, lamp } from "./theme";
import { LampDesk } from "./backdrop";
import { Compad, Icon, Rise, pop, prog } from "./kit";

const WAYS = [
  { icon: "laptop", title: "Free, on your computer", sub: "Local AI through Ollama" },
  { icon: "cloud", title: "Free web models", sub: "Connect OpenRouter in one click" },
  { icon: "key", title: "Your own key", sub: "Claude, DeepSeek, Groq and more" },
] as const;

export const TrustScene: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <LampDesk>
      <div style={{ position: "absolute", left: 0, right: 0, top: 196, display: "flex", justifyContent: "center", opacity: prog(f, 4, 14) }}>
        <Icon name="lock" size={84} color={lamp.brass} weight={1.6} draw={prog(f, 4, 26)} />
      </div>
      <Rise at={10} dy={36} dur={24} style={{ position: "absolute", left: 0, right: 0, top: 306, textAlign: "center" }}>
        <h2 style={{ margin: 0, fontFamily: font.read, fontWeight: 560, fontSize: 100, letterSpacing: "-0.03em", color: lamp.ink }}>
          Your notes stay <em style={{ color: lamp.brass, fontWeight: 480 }}>on your device.</em>
        </h2>
      </Rise>
      <Rise at={22} style={{ position: "absolute", left: 0, right: 0, top: 474, textAlign: "center" }}>
        <p style={{ margin: 0, fontFamily: font.ui, fontSize: 36, color: lamp.muted }}>Pick the AI that works for you.</p>
      </Rise>
      <div style={{ position: "absolute", left: 0, right: 0, top: 590, display: "flex", justifyContent: "center", gap: 36 }}>
        {WAYS.map((w, i) => {
          const t = pop(f, 34 + i * 8, 20);
          return (
            <div
              key={w.title}
              style={{
                width: 480,
                height: 236,
                padding: "34px 34px",
                borderRadius: 24,
                background: lamp.surface,
                border: `1px solid ${lamp.hairlineStrong}`,
                boxShadow: lamp.elev,
                opacity: Math.min(1, t),
                transform: `translateY(${(1 - t) * 50}px)`,
              }}
            >
              <Icon name={w.icon} size={54} color={lamp.brass} weight={1.6} />
              <div style={{ marginTop: 22, fontFamily: font.ui, fontWeight: 600, fontSize: 33, color: lamp.ink }}>{w.title}</div>
              <div style={{ marginTop: 8, fontFamily: font.ui, fontSize: 24, color: lamp.muted }}>{w.sub}</div>
            </div>
          );
        })}
      </div>
    </LampDesk>
  );
};

export const FinaleScene: React.FC = () => {
  const f = useCurrentFrame();
  const glow = prog(f, 0, 40);
  const mascot = pop(f, 4, 24);
  const underline = prog(f, 48, 26);
  const cta = pop(f, 62, 20);
  return (
    <LampDesk glow={glow}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 120, display: "flex", justifyContent: "center", opacity: Math.min(1, mascot), transform: `translateY(${(1 - mascot) * 80}px)` }}>
        <Compad mood="cheer" since={4} px={6} />
      </div>
      <Rise at={16} dy={40} dur={24} style={{ position: "absolute", left: 0, right: 0, top: 380, textAlign: "center" }}>
        <div style={{ fontFamily: font.read, fontWeight: 600, fontSize: 168, letterSpacing: "-0.04em", lineHeight: 1, color: lamp.ink }}>Comtus</div>
      </Rise>
      <Rise at={30} dy={26} style={{ position: "absolute", left: 0, right: 0, top: 590, textAlign: "center" }}>
        <div style={{ display: "inline-block", position: "relative", fontFamily: font.read, fontSize: 66, letterSpacing: "-0.02em", color: lamp.ink }}>
          Rough thought, <em style={{ color: lamp.brass }}>polished.</em>
          <svg width={300} height={30} viewBox="0 0 300 30" style={{ position: "absolute", right: -6, bottom: -26 }}>
            <path
              d="M6 18 C 70 8, 160 6, 294 14"
              fill="none"
              stroke={lamp.brass}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={300}
              strokeDashoffset={300 * (1 - underline)}
            />
          </svg>
        </div>
      </Rise>
      <div style={{ position: "absolute", left: 0, right: 0, top: 764, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            opacity: Math.min(1, cta),
            transform: `scale(${0.85 + 0.15 * cta})`,
            padding: "22px 46px",
            borderRadius: 40,
            background: lamp.brass,
            color: lamp.ground,
            fontFamily: font.ui,
            fontWeight: 600,
            fontSize: 38,
            boxShadow: `0 14px 40px -12px ${lamp.brass}88`,
          }}
        >
          Start free at {SITE}
        </div>
      </div>
      <Rise at={74} style={{ position: "absolute", left: 0, right: 0, top: 890, textAlign: "center" }}>
        <div style={{ fontFamily: font.mono, fontSize: 26, color: lamp.muted, letterSpacing: "0.02em" }}>Web, Windows and macOS</div>
      </Rise>
    </LampDesk>
  );
};
