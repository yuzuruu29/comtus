import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { playSfx } from "../studio/companion/sfx";

export type LampMood = "idle" | "poke" | "cheer";

type LandingPlay = {
  lampLit: boolean;
  mood: LampMood;
  pokeCount: number;
  ignite: () => void;
  poke: () => void;
  lightAll: () => void;
};

const LandingPlayContext = createContext<LandingPlay | null>(null);

const POKE_LINES = [
  "100% Charged.",
  "Ready to drill.",
  "Full battery, clear focus.",
  "Ask when you are ready.",
  "Powering your study session.",
] as const;

export function pokeLine(tick: number): string {
  return POKE_LINES[tick % POKE_LINES.length];
}

export function LandingPlayProvider({ children }: { children: ReactNode }) {
  const [lampLit, setLampLit] = useState(false);
  const [mood, setMood] = useState<LampMood>("idle");
  const [pokeCount, setPokeCount] = useState(0);

  const ignite = useCallback(() => {
    setLampLit(true);
    document.documentElement.dataset.lamp = "lit";
    playSfx("lampClick", true);
  }, []);

  const poke = useCallback(() => {
    setLampLit(true);
    document.documentElement.dataset.lamp = "lit";
    setMood("poke");
    setPokeCount((n) => n + 1);
    playSfx("lampClick", true);
    window.setTimeout(() => setMood("idle"), 700);
  }, []);

  const lightAll = useCallback(() => {
    setLampLit(true);
    document.documentElement.dataset.lamp = "lit";
    setMood("cheer");
    playSfx("unlock", true);
    window.setTimeout(() => setMood("idle"), 1200);
  }, []);

  const value = useMemo(
    () => ({ lampLit, mood, pokeCount, ignite, poke, lightAll }),
    [lampLit, mood, pokeCount, ignite, poke, lightAll],
  );

  return <LandingPlayContext.Provider value={value}>{children}</LandingPlayContext.Provider>;
}

export function useLandingPlay(): LandingPlay {
  return (
    useContext(LandingPlayContext) ?? {
      lampLit: false,
      mood: "idle",
      pokeCount: 0,
      ignite: () => {},
      poke: () => {},
      lightAll: () => {},
    }
  );
}
