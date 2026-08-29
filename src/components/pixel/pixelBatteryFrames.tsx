import type { PixelAnimation, PixelFrame, PixelRun } from "./PixelSprite";

/**
 * 16-Bit Blue Battery Companion Palette
 * Tuned to Cantor8 Electric Sapphire Blue, metallic steel terminals,
 * glowing electric cyan display, and vibrant particle sparks.
 */
export const BATTERY_PALETTE = {
  // Outline & Deep Shadows
  OUTLINE: "#080E1E",
  BODY_SHADOW: "#021A3D",
  BODY_DARK: "#022354",

  // Electric Royal Sapphire Body
  BODY_MID: "#044AB3",
  BODY_LIGHT: "#1D68D8",
  BODY_HIGHLIGHT: "#4F93F7",
  BODY_GLINT: "#93C5FD",

  // Metal Positive Terminal Nub
  TERMINAL_DARK: "#334155",
  TERMINAL_MID: "#64748B",
  TERMINAL_LIGHT: "#94A3B8",
  TERMINAL_GLINT: "#E2E8F0",

  // Recessed Digital LED Screen
  SCREEN_BORDER: "#0A1E3F",
  SCREEN_BG: "#05132B",

  // Electric Cyan LED Display & Eyes
  CYAN_DIM: "#0E7490",
  CYAN_MID: "#06B6D4",
  CYAN_CORE: "#6FE3FF",
  CYAN_BRIGHT: "#A5F3FC",
  CYAN_WHITE: "#E0F7FE",

  // Cute Cheek Blush
  CHEEK_BLUSH: "#F472B6",

  // Electric Sparks & Flares
  SPARK_GOLD: "#FDE047",
  SPARK_AMBER: "#F59E0B",
  SPARK_CYAN: "#6FE3FF",
  SPARK_WHITE: "#FFFFFF",

  // Sleep Floating zZz
  ZZZ_SOFT: "#7DD3FC",
  ZZZ_MID: "#38BDF8",
  ZZZ_DEEP: "#0284C7",
} as const;

export const BATTERY_WIDTH = 36;
export const BATTERY_HEIGHT = 38;

/** Static Battery Casing & Terminal Base Runs (y-offset for bounce) */
function getCasingRuns(yOffset = 0): PixelRun[] {
  const y = (origY: number) => origY + yOffset;
  return [
    // Top Terminal Nub Outline & Base
    [15, y(2), 6, 1, BATTERY_PALETTE.OUTLINE],
    [14, y(3), 8, 3, BATTERY_PALETTE.OUTLINE],
    [15, y(3), 6, 2, BATTERY_PALETTE.TERMINAL_MID],
    [15, y(3), 3, 1, BATTERY_PALETTE.TERMINAL_GLINT],
    [15, y(4), 2, 1, BATTERY_PALETTE.TERMINAL_LIGHT],
    [19, y(4), 2, 1, BATTERY_PALETTE.TERMINAL_DARK],

    // Battery Main Casing Outer Silhouette
    [10, y(5), 16, 1, BATTERY_PALETTE.OUTLINE],
    [9, y(6), 18, 1, BATTERY_PALETTE.OUTLINE],
    [8, y(7), 20, 25, BATTERY_PALETTE.OUTLINE],
    [9, y(32), 18, 1, BATTERY_PALETTE.OUTLINE],
    [10, y(33), 16, 1, BATTERY_PALETTE.OUTLINE],

    // Battery Casing Body Fill (Sapphire Gradient)
    [10, y(6), 16, 1, BATTERY_PALETTE.BODY_HIGHLIGHT],
    [9, y(7), 18, 25, BATTERY_PALETTE.BODY_MID],

    // Left Casing Highlight
    [9, y(7), 2, 24, BATTERY_PALETTE.BODY_LIGHT],
    [9, y(7), 1, 24, BATTERY_PALETTE.BODY_HIGHLIGHT],
    [10, y(8), 1, 22, BATTERY_PALETTE.BODY_GLINT],

    // Right Casing Shadow
    [25, y(7), 2, 24, BATTERY_PALETTE.BODY_DARK],
    [26, y(8), 1, 23, BATTERY_PALETTE.BODY_SHADOW],
    [10, y(31), 16, 1, BATTERY_PALETTE.BODY_DARK],
    [11, y(32), 14, 1, BATTERY_PALETTE.BODY_SHADOW],

    // Digital Screen Bevel Frame
    [11, y(9), 14, 1, BATTERY_PALETTE.SCREEN_BORDER],
    [10, y(10), 16, 12, BATTERY_PALETTE.SCREEN_BORDER],
    [11, y(22), 14, 1, BATTERY_PALETTE.SCREEN_BORDER],

    // Recessed Screen Background
    [11, y(10), 14, 12, BATTERY_PALETTE.SCREEN_BG],
  ];
}

/** Standard Battery Charge Level Bars at bottom of casing */
function getChargeBars(level: 1 | 2 | 3 | 4, yOffset = 0): PixelRun[] {
  const y = (origY: number) => origY + yOffset;
  const runs: PixelRun[] = [
    // Charge Gauge Background Container
    [12, y(25), 12, 5, BATTERY_PALETTE.SCREEN_BG],
    [11, y(24), 14, 1, BATTERY_PALETTE.SCREEN_BORDER],
    [11, y(30), 14, 1, BATTERY_PALETTE.SCREEN_BORDER],
  ];

  // Bar 1 (Leftmost / Low)
  if (level >= 1) {
    runs.push([13, y(26), 2, 3, BATTERY_PALETTE.CYAN_CORE]);
    runs.push([13, y(26), 1, 1, BATTERY_PALETTE.CYAN_WHITE]);
  } else {
    runs.push([13, y(26), 2, 3, BATTERY_PALETTE.CYAN_DIM]);
  }

  // Bar 2
  if (level >= 2) {
    runs.push([16, y(26), 2, 3, BATTERY_PALETTE.CYAN_CORE]);
    runs.push([16, y(26), 1, 1, BATTERY_PALETTE.CYAN_WHITE]);
  } else {
    runs.push([16, y(26), 2, 3, BATTERY_PALETTE.CYAN_DIM]);
  }

  // Bar 3
  if (level >= 3) {
    runs.push([19, y(26), 2, 3, BATTERY_PALETTE.CYAN_CORE]);
    runs.push([19, y(26), 1, 1, BATTERY_PALETTE.CYAN_WHITE]);
  } else {
    runs.push([19, y(26), 2, 3, BATTERY_PALETTE.CYAN_DIM]);
  }

  // Bar 4 (Rightmost / Full)
  if (level >= 4) {
    runs.push([22, y(26), 2, 3, BATTERY_PALETTE.CYAN_CORE]);
    runs.push([22, y(26), 1, 1, BATTERY_PALETTE.CYAN_WHITE]);
  } else {
    runs.push([22, y(26), 2, 3, BATTERY_PALETTE.CYAN_DIM]);
  }

  return runs;
}

/** Happy Open Eyes Face `[ •  ‿  • ]` */
function getHappyFaceRuns(yOffset = 0): PixelRun[] {
  const y = (origY: number) => origY + yOffset;
  return [
    // Left Eye
    [13, y(13), 3, 4, BATTERY_PALETTE.CYAN_CORE],
    [13, y(13), 1, 2, BATTERY_PALETTE.CYAN_WHITE],
    [14, y(14), 1, 1, BATTERY_PALETTE.CYAN_WHITE],

    // Right Eye
    [20, y(13), 3, 4, BATTERY_PALETTE.CYAN_CORE],
    [20, y(13), 1, 2, BATTERY_PALETTE.CYAN_WHITE],
    [21, y(14), 1, 1, BATTERY_PALETTE.CYAN_WHITE],

    // Cheerful Smile
    [16, y(17), 4, 1, BATTERY_PALETTE.CYAN_CORE],
    [15, y(16), 1, 1, BATTERY_PALETTE.CYAN_CORE],
    [20, y(16), 1, 1, BATTERY_PALETTE.CYAN_CORE],

    // Subtle Blush Pixels
    [12, y(16), 2, 1, BATTERY_PALETTE.CHEEK_BLUSH],
    [22, y(16), 2, 1, BATTERY_PALETTE.CHEEK_BLUSH],
  ];
}

/** Blinking Slit Eyes Face `[ -  - ]` */
function getBlinkFaceRuns(yOffset = 0): PixelRun[] {
  const y = (origY: number) => origY + yOffset;
  return [
    // Left Blink Line
    [13, y(15), 3, 1, BATTERY_PALETTE.CYAN_CORE],
    [14, y(15), 1, 1, BATTERY_PALETTE.CYAN_WHITE],

    // Right Blink Line
    [20, y(15), 3, 1, BATTERY_PALETTE.CYAN_CORE],
    [21, y(15), 1, 1, BATTERY_PALETTE.CYAN_WHITE],

    // Smile
    [16, y(17), 4, 1, BATTERY_PALETTE.CYAN_CORE],
  ];
}

/** Thinking / Processing Face with Charging Lightning Bolt Eyes `[ ⚡ ‿ ⚡ ]` */
function getThinkingFaceRuns(step: number, yOffset = 0): PixelRun[] {
  const y = (origY: number) => origY + yOffset;
  const runs: PixelRun[] = [
    // Smile / Processing Line
    [16, y(18), 4, 1, BATTERY_PALETTE.CYAN_CORE],
    [15, y(17), 1, 1, BATTERY_PALETTE.CYAN_MID],
    [20, y(17), 1, 1, BATTERY_PALETTE.CYAN_MID],
  ];

  if (step % 2 === 0) {
    // Lightning Bolt Left Eye
    runs.push(
      [14, y(12), 2, 2, BATTERY_PALETTE.CYAN_WHITE],
      [13, y(14), 3, 1, BATTERY_PALETTE.CYAN_CORE],
      [13, y(15), 2, 2, BATTERY_PALETTE.CYAN_BRIGHT],
      [14, y(16), 1, 1, BATTERY_PALETTE.CYAN_CORE]
    );
    // Lightning Bolt Right Eye
    runs.push(
      [21, y(12), 2, 2, BATTERY_PALETTE.CYAN_WHITE],
      [20, y(14), 3, 1, BATTERY_PALETTE.CYAN_CORE],
      [20, y(15), 2, 2, BATTERY_PALETTE.CYAN_BRIGHT],
      [21, y(16), 1, 1, BATTERY_PALETTE.CYAN_CORE]
    );
  } else {
    // Focused Concentrating Eyes
    runs.push(
      [13, y(13), 3, 3, BATTERY_PALETTE.CYAN_BRIGHT],
      [14, y(14), 1, 1, BATTERY_PALETTE.CYAN_WHITE],
      [20, y(13), 3, 3, BATTERY_PALETTE.CYAN_BRIGHT],
      [21, y(14), 1, 1, BATTERY_PALETTE.CYAN_WHITE]
    );
  }

  // Thinking Circuit Spark Particles above terminal
  if (step === 1 || step === 4) {
    runs.push([13, y(0), 1, 2, BATTERY_PALETTE.SPARK_GOLD]);
    runs.push([12, y(1), 3, 1, BATTERY_PALETTE.SPARK_GOLD]);
  } else if (step === 2 || step === 5) {
    runs.push([22, y(0), 2, 1, BATTERY_PALETTE.SPARK_CYAN]);
    runs.push([23, y(1), 1, 2, BATTERY_PALETTE.SPARK_CYAN]);
  } else {
    runs.push([17, y(0), 2, 2, BATTERY_PALETTE.SPARK_WHITE]);
  }

  return runs;
}

/** Poked / Surprised Happy Face `[ >  ‿  < ]` */
function getPokedFaceRuns(yOffset = 0): PixelRun[] {
  const y = (origY: number) => origY + yOffset;
  return [
    // Left Chevron Eye '>'
    [13, y(13), 1, 1, BATTERY_PALETTE.CYAN_CORE],
    [14, y(14), 1, 1, BATTERY_PALETTE.CYAN_WHITE],
    [15, y(15), 1, 1, BATTERY_PALETTE.CYAN_CORE],
    [14, y(16), 1, 1, BATTERY_PALETTE.CYAN_WHITE],
    [13, y(17), 1, 1, BATTERY_PALETTE.CYAN_CORE],

    // Right Chevron Eye '<'
    [22, y(13), 1, 1, BATTERY_PALETTE.CYAN_CORE],
    [21, y(14), 1, 1, BATTERY_PALETTE.CYAN_WHITE],
    [20, y(15), 1, 1, BATTERY_PALETTE.CYAN_CORE],
    [21, y(16), 1, 1, BATTERY_PALETTE.CYAN_WHITE],
    [22, y(17), 1, 1, BATTERY_PALETTE.CYAN_CORE],

    // Open Happy Mouth ':D'
    [16, y(17), 4, 3, BATTERY_PALETTE.CYAN_CORE],
    [17, y(18), 2, 1, BATTERY_PALETTE.CYAN_WHITE],

    // Cheeks
    [11, y(17), 2, 1, BATTERY_PALETTE.CHEEK_BLUSH],
    [23, y(17), 2, 1, BATTERY_PALETTE.CHEEK_BLUSH],

    // Excited Electric Jolt Sparks
    [5, y(10), 2, 2, BATTERY_PALETTE.SPARK_GOLD],
    [29, y(9), 2, 2, BATTERY_PALETTE.SPARK_CYAN],
    [17, y(-2), 2, 3, BATTERY_PALETTE.SPARK_WHITE],
  ];
}

/** Sleepy Low-Power Face `[ -  ‿  - ]` with floating zZz */
function getSleepFaceRuns(frameIdx: number, yOffset = 0): PixelRun[] {
  const y = (origY: number) => origY + yOffset;
  const runs: PixelRun[] = [
    // Left Closed Eye Curve
    [13, y(15), 3, 1, BATTERY_PALETTE.CYAN_DIM],
    [12, y(14), 1, 1, BATTERY_PALETTE.CYAN_DIM],
    [16, y(14), 1, 1, BATTERY_PALETTE.CYAN_DIM],

    // Right Closed Eye Curve
    [20, y(15), 3, 1, BATTERY_PALETTE.CYAN_DIM],
    [19, y(14), 1, 1, BATTERY_PALETTE.CYAN_DIM],
    [23, y(14), 1, 1, BATTERY_PALETTE.CYAN_DIM],

    // Peaceful Smile
    [17, y(17), 2, 1, BATTERY_PALETTE.CYAN_DIM],
  ];

  // Floating 'zZz' particles
  const zOffset = frameIdx * 2;
  runs.push(
    // Lower 'z'
    [27, y(10 - zOffset), 3, 1, BATTERY_PALETTE.ZZZ_SOFT],
    [28, y(11 - zOffset), 1, 1, BATTERY_PALETTE.ZZZ_SOFT],
    [27, y(12 - zOffset), 3, 1, BATTERY_PALETTE.ZZZ_SOFT],

    // Mid 'Z'
    [29, y(5 - zOffset), 4, 1, BATTERY_PALETTE.ZZZ_MID],
    [31, y(6 - zOffset), 1, 1, BATTERY_PALETTE.ZZZ_MID],
    [30, y(7 - zOffset), 1, 1, BATTERY_PALETTE.ZZZ_MID],
    [29, y(8 - zOffset), 4, 1, BATTERY_PALETTE.ZZZ_MID],

    // Top 'Z'
    [31, y(0 - zOffset), 5, 1, BATTERY_PALETTE.ZZZ_DEEP],
    [33, y(1 - zOffset), 2, 1, BATTERY_PALETTE.ZZZ_DEEP],
    [32, y(2 - zOffset), 2, 1, BATTERY_PALETTE.ZZZ_DEEP],
    [31, y(3 - zOffset), 5, 1, BATTERY_PALETTE.ZZZ_DEEP]
  );

  return runs;
}

/** Celebration Ecstatic Face `[ ^  ‿  ^ ]` with starburst flares */
function getCheerFaceRuns(step: number, yOffset = 0): PixelRun[] {
  const y = (origY: number) => origY + yOffset;
  const runs: PixelRun[] = [
    // Left Joyful Arch Eye '^'
    [13, y(14), 1, 2, BATTERY_PALETTE.CYAN_CORE],
    [14, y(13), 2, 1, BATTERY_PALETTE.CYAN_WHITE],
    [16, y(14), 1, 2, BATTERY_PALETTE.CYAN_CORE],

    // Right Joyful Arch Eye '^'
    [20, y(14), 1, 2, BATTERY_PALETTE.CYAN_CORE],
    [21, y(13), 2, 1, BATTERY_PALETTE.CYAN_WHITE],
    [23, y(14), 1, 2, BATTERY_PALETTE.CYAN_CORE],

    // Big Open Laughing Mouth
    [16, y(17), 4, 3, BATTERY_PALETTE.CYAN_CORE],
    [17, y(18), 2, 1, BATTERY_PALETTE.CYAN_WHITE],

    // Bright Blush
    [11, y(16), 2, 1, BATTERY_PALETTE.CHEEK_BLUSH],
    [23, y(16), 2, 1, BATTERY_PALETTE.CHEEK_BLUSH],
  ];

  // Surrounding Starburst Particles
  if (step % 2 === 0) {
    runs.push(
      [5, y(4), 3, 1, BATTERY_PALETTE.SPARK_GOLD],
      [6, y(3), 1, 3, BATTERY_PALETTE.SPARK_GOLD],
      [28, y(5), 3, 1, BATTERY_PALETTE.SPARK_CYAN],
      [29, y(4), 1, 3, BATTERY_PALETTE.SPARK_CYAN]
    );
  } else {
    runs.push(
      [4, y(16), 2, 2, BATTERY_PALETTE.SPARK_CYAN],
      [30, y(18), 2, 2, BATTERY_PALETTE.SPARK_GOLD],
      [17, y(-3), 2, 2, BATTERY_PALETTE.SPARK_WHITE]
    );
  }

  return runs;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION TIMELINE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Idle: Gentle 4-frame breathing with happy eyes and periodic blink */
const IDLE_FRAMES: PixelFrame[] = [
  {
    durationMs: 700,
    runs: [...getCasingRuns(0), ...getHappyFaceRuns(0), ...getChargeBars(4, 0)],
  },
  {
    durationMs: 700,
    runs: [...getCasingRuns(1), ...getHappyFaceRuns(1), ...getChargeBars(4, 1)],
  },
  {
    durationMs: 600,
    runs: [...getCasingRuns(0), ...getHappyFaceRuns(0), ...getChargeBars(4, 0)],
  },
  {
    durationMs: 180, // Quick blink
    runs: [...getCasingRuns(0), ...getBlinkFaceRuns(0), ...getChargeBars(4, 0)],
  },
];

/** Think: Active calculation with lightning pupils and charging gauge sweep */
const THINK_FRAMES: PixelFrame[] = [
  {
    durationMs: 200,
    runs: [...getCasingRuns(0), ...getThinkingFaceRuns(0, 0), ...getChargeBars(1, 0)],
  },
  {
    durationMs: 200,
    runs: [...getCasingRuns(-1), ...getThinkingFaceRuns(1, -1), ...getChargeBars(2, -1)],
  },
  {
    durationMs: 200,
    runs: [...getCasingRuns(0), ...getThinkingFaceRuns(2, 0), ...getChargeBars(3, 0)],
  },
  {
    durationMs: 200,
    runs: [...getCasingRuns(1), ...getThinkingFaceRuns(3, 1), ...getChargeBars(4, 1)],
  },
  {
    durationMs: 200,
    runs: [...getCasingRuns(0), ...getThinkingFaceRuns(4, 0), ...getChargeBars(3, 0)],
  },
  {
    durationMs: 200,
    runs: [...getCasingRuns(-1), ...getThinkingFaceRuns(5, -1), ...getChargeBars(4, -1)],
  },
];

/** Poke: Delighted upward jump and electric shockwave */
const POKE_FRAMES: PixelFrame[] = [
  {
    durationMs: 120,
    runs: [...getCasingRuns(2), ...getPokedFaceRuns(2), ...getChargeBars(4, 2)],
  },
  {
    durationMs: 240, // Apex jump
    runs: [...getCasingRuns(-3), ...getPokedFaceRuns(-3), ...getChargeBars(4, -3)],
  },
  {
    durationMs: 160,
    runs: [...getCasingRuns(-1), ...getPokedFaceRuns(-1), ...getChargeBars(4, -1)],
  },
  {
    durationMs: 180,
    runs: [...getCasingRuns(0), ...getHappyFaceRuns(0), ...getChargeBars(4, 0)],
  },
];

/** Sleep: Dimmed low-power standby with slow pulsing charge bar and zZz */
const SLEEP_FRAMES: PixelFrame[] = [
  {
    durationMs: 650,
    runs: [...getCasingRuns(1), ...getSleepFaceRuns(0, 1), ...getChargeBars(1, 1)],
  },
  {
    durationMs: 650,
    runs: [...getCasingRuns(1), ...getSleepFaceRuns(1, 1), ...getChargeBars(2, 1)],
  },
  {
    durationMs: 650,
    runs: [...getCasingRuns(0), ...getSleepFaceRuns(2, 0), ...getChargeBars(1, 0)],
  },
  {
    durationMs: 650,
    runs: [...getCasingRuns(0), ...getSleepFaceRuns(3, 0), ...getChargeBars(1, 0)],
  },
];

/** Cheer: Celebration jump with maximum charge surge and starburst particles */
const CHEER_FRAMES: PixelFrame[] = [
  {
    durationMs: 140,
    runs: [...getCasingRuns(2), ...getCheerFaceRuns(0, 2), ...getChargeBars(4, 2)],
  },
  {
    durationMs: 220,
    runs: [...getCasingRuns(-3), ...getCheerFaceRuns(1, -3), ...getChargeBars(4, -3)],
  },
  {
    durationMs: 180,
    runs: [...getCasingRuns(-1), ...getCheerFaceRuns(2, -1), ...getChargeBars(4, -1)],
  },
  {
    durationMs: 140,
    runs: [...getCasingRuns(2), ...getCheerFaceRuns(3, 2), ...getChargeBars(4, 2)],
  },
  {
    durationMs: 220,
    runs: [...getCasingRuns(-2), ...getCheerFaceRuns(4, -2), ...getChargeBars(4, -2)],
  },
  {
    durationMs: 180,
    runs: [...getCasingRuns(0), ...getCheerFaceRuns(5, 0), ...getChargeBars(4, 0)],
  },
];

export const COZY_PIXEL_BATTERY_ANIMATIONS: Record<string, PixelAnimation> = {
  idle: {
    frames: IDLE_FRAMES,
    loop: true,
  },
  think: {
    frames: THINK_FRAMES,
    loop: true,
  },
  poke: {
    frames: POKE_FRAMES,
    loop: false,
  },
  sleep: {
    frames: SLEEP_FRAMES,
    loop: true,
  },
  celebrate: {
    frames: CHEER_FRAMES,
    loop: true,
  },
  cheer: {
    frames: CHEER_FRAMES,
    loop: true,
  },
};
