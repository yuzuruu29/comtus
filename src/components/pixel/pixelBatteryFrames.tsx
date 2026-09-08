import type { PixelAnimation, PixelFrame, PixelRun } from "./PixelSprite";

export const BATTERY_PALETTE = {
  OUTLINE: "#28372F",
  SPINE: "#3D5749",
  SPINE_LIGHT: "#607A60",
  COVER: "#A8B598",
  COVER_LIGHT: "#C1CDAF",
  COVER_SHADE: "#839678",
  PAGE: "#F5ECDC",
  PAGE_SHADE: "#CABDA2",
  PAGE_LINE: "#E0D3BB",
  RIBBON: "#C49A4A",
  RIBBON_LIGHT: "#E5C579",
  RIBBON_SHADE: "#967038",
  INK: "#27372E",
  BLUSH: "#CC9480",
  SPARK: "#D3AB5E",
  SHADOW: "#28372F25",
} as const;

export const BATTERY_WIDTH = 36;
export const BATTERY_HEIGHT = 38;

const p = BATTERY_PALETTE;
type Face = "happy" | "blink" | "think" | "poke" | "sleep" | "cheer";

function notebookRuns(offset: number): PixelRun[] {
  const y = (row: number) => row + offset;
  return [
    [9, 36, 20, 1, p.SHADOW],
    [11, y(32), 3, 3, p.OUTLINE],
    [24, y(32), 3, 3, p.OUTLINE],
    [10, y(34), 4, 1, p.INK],
    [24, y(34), 4, 1, p.INK],
    [3, y(22), 4, 1, p.OUTLINE],
    [2, y(21), 2, 2, p.OUTLINE],
    [30, y(21), 3, 1, p.OUTLINE],
    [32, y(20), 2, 2, p.OUTLINE],
    [8, y(7), 23, 26, p.OUTLINE],
    [9, y(8), 21, 24, p.PAGE_SHADE],
    [27, y(9), 3, 22, p.PAGE],
    [29, y(12), 1, 1, p.PAGE_SHADE],
    [29, y(16), 1, 1, p.PAGE_SHADE],
    [29, y(20), 1, 1, p.PAGE_SHADE],
    [29, y(24), 1, 1, p.PAGE_SHADE],
    [29, y(28), 1, 1, p.PAGE_SHADE],
    [10, y(30), 20, 2, p.PAGE],
    [11, y(31), 18, 1, p.PAGE_LINE],
    [7, y(6), 20, 1, p.OUTLINE],
    [6, y(7), 22, 23, p.OUTLINE],
    [7, y(30), 20, 1, p.OUTLINE],
    [7, y(7), 20, 22, p.COVER],
    [8, y(29), 18, 1, p.COVER_SHADE],
    [7, y(7), 4, 22, p.SPINE],
    [8, y(8), 1, 20, p.SPINE_LIGHT],
    [10, y(7), 1, 22, p.OUTLINE],
    [11, y(7), 15, 1, p.COVER_LIGHT],
    [26, y(8), 1, 21, p.COVER_SHADE],
    [12, y(9), 1, 1, p.COVER_LIGHT],
    [24, y(9), 1, 1, p.COVER_LIGHT],
    [12, y(27), 1, 1, p.COVER_LIGHT],
    [24, y(27), 1, 1, p.COVER_LIGHT],
    [16, y(11), 7, 1, p.RIBBON_SHADE],
    [18, y(12), 3, 1, p.COVER_LIGHT],
    [20, y(31), 4, 4, p.RIBBON_SHADE],
    [21, y(31), 2, 4, p.RIBBON],
    [21, y(31), 1, 3, p.RIBBON_LIGHT],
    [20, y(35), 1, 1, p.RIBBON_SHADE],
    [23, y(35), 1, 1, p.RIBBON_SHADE],
  ];
}

function faceRuns(face: Face, offset: number, step: number): PixelRun[] {
  const y = (row: number) => row + offset;
  const cheeks: PixelRun[] = [[13, y(21), 2, 1, p.BLUSH], [23, y(21), 2, 1, p.BLUSH]];
  switch (face) {
    case "blink":
      return [...cheeks,
        [14, y(18), 3, 1, p.INK], [21, y(18), 3, 1, p.INK],
        [17, y(22), 4, 1, p.INK],
      ];
    case "think": {
      const glance = step % 2;
      return [...cheeks,
        [14, y(15), 3, 1, p.INK], [21, y(14), 3, 1, p.INK],
        [14 + glance, y(17), 2, 3, p.INK], [21 + glance, y(17), 2, 3, p.INK],
        [14 + glance, y(17), 1, 1, p.PAGE], [21 + glance, y(17), 1, 1, p.PAGE],
        [18, y(22), 3, 1, p.INK],
        [24, y(8), 3, 1, p.PAGE], [25, y(9), 2, 1, p.PAGE_LINE], [26, y(10), 1, 1, p.PAGE_SHADE],
      ];
    }
    case "poke":
      return [...cheeks,
        [14, y(16), 1, 1, p.INK], [15, y(17), 1, 1, p.INK], [16, y(18), 1, 1, p.INK],
        [15, y(19), 1, 1, p.INK], [14, y(20), 1, 1, p.INK],
        [23, y(16), 1, 1, p.INK], [22, y(17), 1, 1, p.INK], [21, y(18), 1, 1, p.INK],
        [22, y(19), 1, 1, p.INK], [23, y(20), 1, 1, p.INK],
        [18, y(22), 3, 2, p.INK], [19, y(22), 1, 1, p.PAGE],
      ];
    case "sleep":
      return [
        [14, y(19), 3, 1, p.INK], [13, y(18), 1, 1, p.INK], [17, y(18), 1, 1, p.INK],
        [21, y(19), 3, 1, p.INK], [20, y(18), 1, 1, p.INK], [24, y(18), 1, 1, p.INK],
        [18, y(23), 2, 1, p.INK],
      ];
    case "cheer":
      return [...cheeks,
        [14, y(18), 1, 2, p.INK], [15, y(17), 2, 1, p.INK], [17, y(18), 1, 2, p.INK],
        [21, y(18), 1, 2, p.INK], [22, y(17), 2, 1, p.INK], [24, y(18), 1, 2, p.INK],
        [18, y(22), 4, 2, p.INK], [19, y(23), 2, 1, p.BLUSH],
      ];
    default:
      return [...cheeks,
        [14, y(17), 2, 3, p.INK], [22, y(17), 2, 3, p.INK],
        [14, y(17), 1, 1, p.PAGE], [22, y(17), 1, 1, p.PAGE],
        [16, y(21), 1, 1, p.INK], [17, y(22), 4, 1, p.INK], [21, y(21), 1, 1, p.INK],
      ];
  }
}

function sparkle(x: number, y: number): PixelRun[] {
  return [[x + 1, y, 1, 3, p.SPARK], [x, y + 1, 3, 1, p.SPARK], [x + 1, y + 1, 1, 1, p.RIBBON_LIGHT]];
}

function accentRuns(face: Face, step: number): PixelRun[] {
  if (face === "think") {
    return [[30, 5 + step % 3, 1, 1, p.INK], [32, 3 + step % 2, 2, 2, p.PAGE_SHADE]];
  }
  if (face === "sleep") {
    const y = 7 - step;
    return [
      [30, y, 3, 1, p.RIBBON], [31, y + 1, 1, 1, p.RIBBON], [30, y + 2, 3, 1, p.RIBBON],
      [31, y + 5, 3, 1, p.PAGE_SHADE], [32, y + 6, 1, 1, p.PAGE_SHADE], [31, y + 7, 3, 1, p.PAGE_SHADE],
    ];
  }
  if (face === "poke") return [...sparkle(1, 12), ...sparkle(31, 9)];
  if (face === "cheer") return [...sparkle(2, 5 + step % 2), ...sparkle(31, 3 + step % 2), [4, 17, 1, 2, p.RIBBON]];
  return [];
}

function frame(face: Face, offset: number, step: number, durationMs: number): PixelFrame {
  return {
    name: `notebook-${face}-${step}`,
    durationMs,
    runs: [...notebookRuns(offset), ...faceRuns(face, offset, step), ...accentRuns(face, step)],
  };
}

const IDLE_FRAMES = [
  frame("happy", 0, 0, 700), frame("happy", 1, 1, 700),
  frame("happy", 0, 2, 600), frame("blink", 0, 3, 180),
];
const THINK_FRAMES = [
  frame("think", 0, 0, 200), frame("think", -1, 1, 200), frame("think", 0, 2, 200),
  frame("think", 1, 3, 200), frame("think", 0, 4, 200), frame("think", -1, 5, 200),
];
const POKE_FRAMES = [
  frame("poke", 2, 0, 120), frame("poke", -3, 1, 240),
  frame("poke", -1, 2, 160), frame("happy", 0, 3, 180),
];
const SLEEP_FRAMES = [
  frame("sleep", 1, 0, 650), frame("sleep", 1, 1, 650),
  frame("sleep", 0, 2, 650), frame("sleep", 0, 3, 650),
];
const CHEER_FRAMES = [
  frame("cheer", 2, 0, 140), frame("cheer", -3, 1, 220), frame("cheer", -1, 2, 180),
  frame("cheer", 2, 3, 140), frame("cheer", -2, 4, 220), frame("cheer", 0, 5, 180),
];

export const COZY_PIXEL_BATTERY_ANIMATIONS: Record<string, PixelAnimation> = {
  idle: { frames: IDLE_FRAMES, loop: true },
  think: { frames: THINK_FRAMES, loop: true },
  poke: { frames: POKE_FRAMES, loop: false },
  sleep: { frames: SLEEP_FRAMES, loop: true },
  celebrate: { frames: CHEER_FRAMES, loop: true },
  cheer: { frames: CHEER_FRAMES, loop: true },
};
