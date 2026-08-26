import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

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

const POKE_LINES = ["Here.", "Still burning.", "Ask when you are ready."] as const;

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
  }, []);

  const poke = useCallback(() => {
    setLampLit(true);
    document.documentElement.dataset.lamp = "lit";
    setMood("poke");
    setPokeCount((n) => n + 1);
    window.setTimeout(() => setMood("idle"), 700);
  }, []);

  const lightAll = useCallback(() => {
    setLampLit(true);
    document.documentElement.dataset.lamp = "lit";
    setMood("cheer");
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
