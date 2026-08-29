import type { ReactNode } from "react";
import type { PixelAnimation, PixelFrame, PixelRun } from "./PixelSprite";

/**
 * 16-Bit Cozy Pixel Lamp Palette
 * Hand-tuned antique brass, crystal glass chimney, incandescent glowing filament core,
 * soft dithered amber light cone, and retro particle accents.
 */
export const LAMP_PALETTE = {
  // Dark silhouette & deep brass shadows
  OUTLINE: "#1A1108",
  DARK_SHADOW: "#33200A",

  // Antique Brass Tone Mapping
  BRASS_SHADOW: "#6E4C0F",
  BRASS_DEEP: "#996A19",
  BRASS_MID: "#C99728",
  BRASS_RICH: "#E6B83B",
  BRASS_LIGHT: "#F5D76E",
  BRASS_HIGHLIGHT: "#FFF2B2",

  // Armature & Hardware Accents
  SCREW_DARK: "#2A231C",
  SCREW_LIGHT: "#8D7860",

  // Glass Chimney
  GLASS_TINT: "rgba(190, 225, 245, 0.35)",
  GLASS_EDGE: "#8BB5D6",
  GLASS_GLINT: "#EAF6FF",

  // Glowing Filament Core
  FILAMENT_OFF: "#4A3622",
  FILAMENT_DIM: "#7A5A30",
  FILAMENT_WARM: "#FF7A00",
  FILAMENT_GOLD: "#FFAA00",
  FILAMENT_AMBER: "#FFD034",
  FILAMENT_BRIGHT: "#FFF099",
  FILAMENT_HOT: "#FFFFFF",

  // Spark Flare Particles
  SPARK_GOLD: "#FFE066",
  SPARK_AMBER: "#FF9900",
  SPARK_WHITE: "#FFFFEE",
  SPARK_ORANGE: "#FF5722",

  // Floating Sleep zZz Particles
  ZZZ_SOFT: "#90CAF9",
  ZZZ_MID: "#64B5F6",
  ZZZ_DEEP: "#42A5F5",
} as const;

export const LAMP_WIDTH = 36;
export const LAMP_HEIGHT = 38;

/** Static Base & Neck Armature Pixel Runs */
const BASE_AND_ARM_RUNS: readonly PixelRun[] = [
  // Heavy felt/brass base foot
  [10, 35, 16, 2, LAMP_PALETTE.OUTLINE],
  [11, 34, 14, 1, LAMP_PALETTE.BRASS_SHADOW],
  [12, 33, 12, 1, LAMP_PALETTE.BRASS_DEEP],
  [13, 32, 10, 1, LAMP_PALETTE.BRASS_MID],
  [14, 32, 4, 1, LAMP_PALETTE.BRASS_LIGHT], // Top base highlight
  [21, 32, 1, 1, LAMP_PALETTE.BRASS_SHADOW],

  // Lower Stem Mount Joint
  [17, 30, 3, 2, LAMP_PALETTE.BRASS_DEEP],
  [18, 30, 1, 2, LAMP_PALETTE.BRASS_LIGHT],
  [16, 29, 5, 1, LAMP_PALETTE.SCREW_DARK],
  [18, 29, 1, 1, LAMP_PALETTE.SCREW_LIGHT],

  // Articulated Swan-Neck Armature
  [18, 27, 2, 2, LAMP_PALETTE.BRASS_MID],
  [19, 25, 2, 2, LAMP_PALETTE.BRASS_MID],
  [20, 23, 2, 2, LAMP_PALETTE.BRASS_RICH],
  [21, 21, 2, 2, LAMP_PALETTE.BRASS_LIGHT],
  [21, 19, 2, 2, LAMP_PALETTE.BRASS_LIGHT],

  // Mid-Arm Pivot Joint Screw
  [20, 18, 4, 2, LAMP_PALETTE.SCREW_DARK],
  [21, 18, 2, 1, LAMP_PALETTE.BRASS_HIGHLIGHT],

  // Upper Neck Arching Forward
  [19, 16, 3, 2, LAMP_PALETTE.BRASS_RICH],
  [17, 14, 3, 2, LAMP_PALETTE.BRASS_LIGHT],
  [14, 13, 4, 2, LAMP_PALETTE.BRASS_LIGHT],
  [11, 13, 3, 2, LAMP_PALETTE.BRASS_MID],
  [9, 14, 3, 2, LAMP_PALETTE.BRASS_DEEP],

  // Socket Cap
  [8, 15, 4, 2, LAMP_PALETTE.BRASS_SHADOW],
  [9, 15, 2, 1, LAMP_PALETTE.BRASS_LIGHT],
];

/** Hand-Crafted Antique Brass Dome Shade Runs */
const SHADE_RUNS: readonly PixelRun[] = [
  // Shade Dome Top Finial
  [8, 12, 4, 1, LAMP_PALETTE.BRASS_HIGHLIGHT],
  [7, 13, 6, 1, LAMP_PALETTE.BRASS_LIGHT],

  // Shade Dome Upper Curve
  [5, 14, 10, 1, LAMP_PALETTE.BRASS_RICH],
  [4, 15, 12, 1, LAMP_PALETTE.BRASS_RICH],
  [3, 16, 14, 1, LAMP_PALETTE.BRASS_MID],
  [3, 17, 14, 1, LAMP_PALETTE.BRASS_MID],

  // Highlights on Left Dome Shoulder
  [5, 14, 3, 1, LAMP_PALETTE.BRASS_HIGHLIGHT],
  [4, 15, 3, 1, LAMP_PALETTE.BRASS_LIGHT],
  [4, 16, 2, 1, LAMP_PALETTE.BRASS_LIGHT],

  // Deep Shadow on Right Dome Slant
  [13, 15, 3, 1, LAMP_PALETTE.BRASS_SHADOW],
  [15, 16, 2, 1, LAMP_PALETTE.BRASS_SHADOW],
  [15, 17, 2, 1, LAMP_PALETTE.OUTLINE],

  // Shade Lower Rolled Brass Rim
  [2, 18, 16, 1, LAMP_PALETTE.BRASS_DEEP],
  [3, 18, 6, 1, LAMP_PALETTE.BRASS_HIGHLIGHT],
  [15, 18, 3, 1, LAMP_PALETTE.DARK_SHADOW],

  // Shade Under-Rim Lip (Dark Interior Opening)
  [4, 19, 12, 1, LAMP_PALETTE.DARK_SHADOW],
];

/** Glass Chimney Pixel Runs */
const GLASS_CHIMNEY_RUNS: readonly PixelRun[] = [
  // Upper Glass Edge
  [7, 20, 6, 1, LAMP_PALETTE.GLASS_EDGE],
  [7, 20, 2, 1, LAMP_PALETTE.GLASS_GLINT],

  // Glass Cylinder Walls
  [6, 21, 1, 4, LAMP_PALETTE.GLASS_EDGE],
  [13, 21, 1, 4, LAMP_PALETTE.GLASS_EDGE],

  // Glass Surface Highlights
  [7, 21, 1, 3, LAMP_PALETTE.GLASS_GLINT],
  [12, 22, 1, 2, LAMP_PALETTE.GLASS_TINT],

  // Lower Glass Rim
  [7, 25, 6, 1, LAMP_PALETTE.GLASS_EDGE],
];

/** Helper to render warm dithered light cone SVG */
function renderLightCone(intensity: "bright" | "warm" | "pulse" | "dim" | "none"): ReactNode {
  if (intensity === "none") return null;

  const isDim = intensity === "dim";
  const isPulse = intensity === "pulse";
  const isBright = intensity === "bright";

  const coreOpacity = isBright ? 0.6 : isPulse ? 0.52 : isDim ? 0.15 : 0.42;
  const midOpacity = isBright ? 0.35 : isPulse ? 0.28 : isDim ? 0.08 : 0.22;
  const ditherOpacity = isBright ? 0.18 : isPulse ? 0.14 : isDim ? 0.04 : 0.1;

  return (
    <g className="pixel-lamp-light-cone pointer-events-none">
      {/* Primary Light Polygon Cone */}
      <polygon
        points="4,19 16,19 28,37 0,37"
        fill="url(#lampConeGradient)"
        opacity={coreOpacity}
      />

      {/* Retro Dither Pixel Checkerboard Layer at Light Margins */}
      <g opacity={ditherOpacity} fill={LAMP_PALETTE.FILAMENT_GOLD}>
        {/* Row 22 Dither Step */}
        <rect x="3" y="22" width="1" height="1" />
        <rect x="17" y="22" width="1" height="1" />
        {/* Row 25 Dither Step */}
        <rect x="2" y="25" width="1" height="1" />
        <rect x="18" y="25" width="1" height="1" />
        {/* Row 28 Dither Step */}
        <rect x="1" y="28" width="1" height="1" />
        <rect x="20" y="28" width="1" height="1" />
        <rect x="22" y="28" width="1" height="1" />
        {/* Row 31 Dither Step */}
        <rect x="0" y="31" width="1" height="1" />
        <rect x="2" y="31" width="1" height="1" />
        <rect x="22" y="31" width="1" height="1" />
        <rect x="24" y="31" width="1" height="1" />
        {/* Row 34 Desk Floor Dither Splash */}
        <rect x="0" y="34" width="1" height="1" />
        <rect x="3" y="34" width="1" height="1" />
        <rect x="24" y="34" width="1" height="1" />
        <rect x="26" y="34" width="1" height="1" />
        {/* Row 36 Desk Pool Highlights */}
        <rect x="1" y="36" width="2" height="1" />
        <rect x="5" y="36" width="3" height="1" />
        <rect x="11" y="36" width="4" height="1" />
        <rect x="18" y="36" width="3" height="1" />
        <rect x="24" y="36" width="2" height="1" />
      </g>

      {/* Radial Filament Ambient Bloom */}
      <circle
        cx="10"
        cy="22"
        r={isBright ? 9 : 7}
        fill="url(#lampFilamentBloom)"
        opacity={midOpacity}
      />
    </g>
  );
}

/** SVG Gradients definition for the warm light cone and filament bloom */
export const LAMP_SVG_DEFS = (
  <defs>
    <linearGradient id="lampConeGradient" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stopColor={LAMP_PALETTE.FILAMENT_AMBER} stopOpacity="0.75" />
      <stop offset="35%" stopColor={LAMP_PALETTE.FILAMENT_GOLD} stopOpacity="0.45" />
      <stop offset="85%" stopColor={LAMP_PALETTE.FILAMENT_WARM} stopOpacity="0.18" />
      <stop offset="100%" stopColor={LAMP_PALETTE.FILAMENT_WARM} stopOpacity="0" />
    </linearGradient>
    <radialGradient id="lampFilamentBloom" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor={LAMP_PALETTE.FILAMENT_HOT} stopOpacity="0.8" />
      <stop offset="40%" stopColor={LAMP_PALETTE.FILAMENT_AMBER} stopOpacity="0.4" />
      <stop offset="80%" stopColor={LAMP_PALETTE.FILAMENT_WARM} stopOpacity="0.15" />
      <stop offset="100%" stopColor={LAMP_PALETTE.FILAMENT_WARM} stopOpacity="0" />
    </radialGradient>
  </defs>
);

// ---------------------------------------------------------------------------
// ANIMATION: IDLE (Gentle 2px vertical breathing oscillation, steady warm cone)
// ---------------------------------------------------------------------------
const IDLE_FRAMES: PixelFrame[] = [
  // Frame 0: Resting Baseline
  {
    name: "idle-0",
    offsetY: 0,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      // Filament Core (Warm Steady Glow)
      [9, 21, 2, 3, LAMP_PALETTE.FILAMENT_GOLD],
      [9, 22, 2, 1, LAMP_PALETTE.FILAMENT_HOT],
      [8, 22, 4, 1, LAMP_PALETTE.FILAMENT_AMBER],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("warm")}
      </>
    ),
    durationMs: 180,
  },
  // Frame 1: Breath Lift +1px
  {
    name: "idle-1",
    offsetY: -1,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      // Filament Core (Slight Flare)
      [9, 21, 2, 3, LAMP_PALETTE.FILAMENT_GOLD],
      [9, 22, 2, 2, LAMP_PALETTE.FILAMENT_HOT],
      [8, 22, 4, 2, LAMP_PALETTE.FILAMENT_AMBER],
      [10, 20, 1, 1, LAMP_PALETTE.FILAMENT_BRIGHT],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("warm")}
      </>
    ),
    durationMs: 180,
  },
  // Frame 2: Breath Peak +2px Lift
  {
    name: "idle-2",
    offsetY: -2,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      // Filament Core (Peak Warmth)
      [8, 21, 4, 3, LAMP_PALETTE.FILAMENT_AMBER],
      [9, 21, 2, 3, LAMP_PALETTE.FILAMENT_BRIGHT],
      [9, 22, 2, 2, LAMP_PALETTE.FILAMENT_HOT],
      [7, 23, 1, 1, LAMP_PALETTE.FILAMENT_GOLD],
      [12, 23, 1, 1, LAMP_PALETTE.FILAMENT_GOLD],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("warm")}
      </>
    ),
    durationMs: 200,
  },
  // Frame 3: Settling Back +1px
  {
    name: "idle-3",
    offsetY: -1,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      // Filament Core
      [9, 21, 2, 3, LAMP_PALETTE.FILAMENT_GOLD],
      [9, 22, 2, 1, LAMP_PALETTE.FILAMENT_HOT],
      [8, 22, 4, 1, LAMP_PALETTE.FILAMENT_AMBER],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("warm")}
      </>
    ),
    durationMs: 180,
  },
];

// ---------------------------------------------------------------------------
// ANIMATION: THINK (Golden amber spark dance inside glass chimney with glow pulse)
// ---------------------------------------------------------------------------
const THINK_FRAMES: PixelFrame[] = [
  // Frame 0: Thought Spark Ignites Left
  {
    name: "think-0",
    offsetY: 0,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      [9, 21, 2, 3, LAMP_PALETTE.FILAMENT_GOLD],
      [9, 22, 2, 2, LAMP_PALETTE.FILAMENT_HOT],
      // Golden Spark Dance Pixel (Left)
      [7, 21, 1, 1, LAMP_PALETTE.SPARK_GOLD],
      [8, 20, 1, 1, LAMP_PALETTE.SPARK_WHITE],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("pulse")}
      </>
    ),
    durationMs: 140,
  },
  // Frame 1: Spark Twirls to Chimney Center
  {
    name: "think-1",
    offsetY: -1,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      [8, 21, 4, 3, LAMP_PALETTE.FILAMENT_AMBER],
      [9, 21, 2, 3, LAMP_PALETTE.FILAMENT_HOT],
      // Amber Spark Twirl
      [10, 20, 1, 1, LAMP_PALETTE.SPARK_WHITE],
      [11, 21, 1, 1, LAMP_PALETTE.SPARK_GOLD],
      [8, 23, 1, 1, LAMP_PALETTE.SPARK_AMBER],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("bright")}
      </>
    ),
    durationMs: 140,
  },
  // Frame 2: Spark Jumps to Chimney Right
  {
    name: "think-2",
    offsetY: -1,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      [9, 21, 2, 3, LAMP_PALETTE.FILAMENT_GOLD],
      [9, 22, 2, 2, LAMP_PALETTE.FILAMENT_HOT],
      // Spark Dance Right
      [12, 22, 1, 1, LAMP_PALETTE.SPARK_GOLD],
      [11, 23, 1, 1, LAMP_PALETTE.SPARK_WHITE],
      [8, 21, 1, 1, LAMP_PALETTE.SPARK_AMBER],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("pulse")}
      </>
    ),
    durationMs: 140,
  },
  // Frame 3: Dual Sparks Oscillate
  {
    name: "think-3",
    offsetY: 0,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      [8, 21, 4, 3, LAMP_PALETTE.FILAMENT_AMBER],
      [9, 22, 2, 2, LAMP_PALETTE.FILAMENT_HOT],
      // Dual Spark Flare
      [7, 23, 1, 1, LAMP_PALETTE.SPARK_GOLD],
      [12, 21, 1, 1, LAMP_PALETTE.SPARK_GOLD],
      [10, 24, 1, 1, LAMP_PALETTE.SPARK_WHITE],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("bright")}
      </>
    ),
    durationMs: 140,
  },
  // Frame 4: Spark Crests Inside Chimney Top
  {
    name: "think-4",
    offsetY: -1,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      [9, 21, 2, 3, LAMP_PALETTE.FILAMENT_GOLD],
      [9, 22, 2, 1, LAMP_PALETTE.FILAMENT_HOT],
      // High Spark
      [9, 20, 2, 1, LAMP_PALETTE.SPARK_WHITE],
      [11, 22, 1, 1, LAMP_PALETTE.SPARK_AMBER],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("pulse")}
      </>
    ),
    durationMs: 140,
  },
  // Frame 5: Spark Resorbs into Core
  {
    name: "think-5",
    offsetY: 0,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      [9, 21, 2, 3, LAMP_PALETTE.FILAMENT_AMBER],
      [9, 22, 2, 2, LAMP_PALETTE.FILAMENT_HOT],
      [8, 22, 4, 1, LAMP_PALETTE.FILAMENT_GOLD],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("warm")}
      </>
    ),
    durationMs: 140,
  },
];

// ---------------------------------------------------------------------------
// ANIMATION: POKE (Joyful hop arc + brass spark particle flare)
// ---------------------------------------------------------------------------
const POKE_FRAMES: PixelFrame[] = [
  // Frame 0: Squash preparation
  {
    name: "poke-squash",
    offsetY: 1,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      [8, 21, 4, 3, LAMP_PALETTE.FILAMENT_AMBER],
      [9, 22, 2, 2, LAMP_PALETTE.FILAMENT_HOT],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("bright")}
      </>
    ),
    durationMs: 80,
  },
  // Frame 1: Upward Launch (-5px)
  {
    name: "poke-launch",
    offsetY: -5,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      [8, 21, 4, 3, LAMP_PALETTE.FILAMENT_HOT],
      [7, 22, 6, 2, LAMP_PALETTE.FILAMENT_BRIGHT],
      // Emerging Sparks around brass rim
      [2, 17, 1, 1, LAMP_PALETTE.SPARK_GOLD],
      [17, 17, 1, 1, LAMP_PALETTE.SPARK_GOLD],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("bright")}
      </>
    ),
    durationMs: 100,
  },
  // Frame 2: Hop Apex Peak (-10px) with Full Spark Flare
  {
    name: "poke-apex",
    offsetY: -10,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      [7, 21, 6, 3, LAMP_PALETTE.FILAMENT_HOT],
      [8, 20, 4, 5, LAMP_PALETTE.FILAMENT_BRIGHT],
      // Brass Spark Particle Flare
      [0, 14, 2, 1, LAMP_PALETTE.SPARK_WHITE],
      [1, 12, 1, 1, LAMP_PALETTE.SPARK_GOLD],
      [18, 13, 2, 1, LAMP_PALETTE.SPARK_WHITE],
      [20, 11, 1, 1, LAMP_PALETTE.SPARK_GOLD],
      [6, 8, 2, 1, LAMP_PALETTE.SPARK_GOLD],
      [12, 8, 2, 1, LAMP_PALETTE.SPARK_AMBER],
      [3, 22, 1, 1, LAMP_PALETTE.SPARK_ORANGE],
      [16, 22, 1, 1, LAMP_PALETTE.SPARK_ORANGE],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("bright")}
      </>
    ),
    durationMs: 140,
  },
  // Frame 3: Float Hover (-7px) Sparks Radiating
  {
    name: "poke-float",
    offsetY: -7,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      [8, 21, 4, 3, LAMP_PALETTE.FILAMENT_HOT],
      [9, 21, 2, 3, LAMP_PALETTE.FILAMENT_AMBER],
      // Drifting Sparks
      [-1, 11, 1, 1, LAMP_PALETTE.SPARK_GOLD],
      [22, 9, 1, 1, LAMP_PALETTE.SPARK_GOLD],
      [5, 5, 1, 1, LAMP_PALETTE.SPARK_WHITE],
      [14, 5, 1, 1, LAMP_PALETTE.SPARK_WHITE],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("bright")}
      </>
    ),
    durationMs: 120,
  },
  // Frame 4: Descent (-3px)
  {
    name: "poke-descend",
    offsetY: -3,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      [9, 21, 2, 3, LAMP_PALETTE.FILAMENT_GOLD],
      [9, 22, 2, 2, LAMP_PALETTE.FILAMENT_HOT],
      // Dissipating Sparks
      [-1, 8, 1, 1, LAMP_PALETTE.SPARK_AMBER],
      [23, 7, 1, 1, LAMP_PALETTE.SPARK_AMBER],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("warm")}
      </>
    ),
    durationMs: 100,
  },
  // Frame 5: Landing Rebound (0px)
  {
    name: "poke-landing",
    offsetY: 0,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      [9, 21, 2, 3, LAMP_PALETTE.FILAMENT_GOLD],
      [9, 22, 2, 1, LAMP_PALETTE.FILAMENT_HOT],
      [8, 22, 4, 1, LAMP_PALETTE.FILAMENT_AMBER],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("warm")}
      </>
    ),
    durationMs: 100,
  },
];

// ---------------------------------------------------------------------------
// ANIMATION: SLEEP (Dimmed filament with gentle zZz floating pixels)
// ---------------------------------------------------------------------------
const SLEEP_FRAMES: PixelFrame[] = [
  // Frame 0: Deep Slumber Baseline
  {
    name: "sleep-0",
    offsetY: 0,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      // Dimmed Slumber Filament
      [9, 22, 2, 1, LAMP_PALETTE.FILAMENT_DIM],
      [9, 23, 2, 1, LAMP_PALETTE.FILAMENT_OFF],
      // First Small 'z' Emerging from Shade
      [18, 11, 3, 1, LAMP_PALETTE.ZZZ_SOFT],
      [19, 12, 1, 1, LAMP_PALETTE.ZZZ_SOFT],
      [18, 13, 3, 1, LAMP_PALETTE.ZZZ_SOFT],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("dim")}
      </>
    ),
    durationMs: 320,
  },
  // Frame 1: 'z' Floats Higher, Mid 'z' Forms
  {
    name: "sleep-1",
    offsetY: 0,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      // Dimmed Filament
      [9, 22, 2, 1, LAMP_PALETTE.FILAMENT_DIM],
      [9, 23, 2, 1, LAMP_PALETTE.FILAMENT_OFF],
      // Drifting 'z'
      [20, 8, 3, 1, LAMP_PALETTE.ZZZ_MID],
      [21, 9, 1, 1, LAMP_PALETTE.ZZZ_MID],
      [20, 10, 3, 1, LAMP_PALETTE.ZZZ_MID],
      // Fresh Tiny 'z' Below
      [16, 12, 2, 1, LAMP_PALETTE.ZZZ_SOFT],
      [17, 13, 1, 1, LAMP_PALETTE.ZZZ_SOFT],
      [16, 14, 2, 1, LAMP_PALETTE.ZZZ_SOFT],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("dim")}
      </>
    ),
    durationMs: 320,
  },
  // Frame 2: Large 'Z' Floats Skyward
  {
    name: "sleep-2",
    offsetY: 1,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      // Dimmed Filament
      [9, 22, 2, 1, LAMP_PALETTE.FILAMENT_OFF],
      [9, 23, 2, 1, LAMP_PALETTE.FILAMENT_DIM],
      // Big Floating 'Z'
      [22, 4, 4, 1, LAMP_PALETTE.ZZZ_DEEP],
      [24, 5, 1, 1, LAMP_PALETTE.ZZZ_DEEP],
      [23, 6, 1, 1, LAMP_PALETTE.ZZZ_DEEP],
      [22, 7, 4, 1, LAMP_PALETTE.ZZZ_DEEP],
      // Mid 'z'
      [18, 9, 3, 1, LAMP_PALETTE.ZZZ_MID],
      [19, 10, 1, 1, LAMP_PALETTE.ZZZ_MID],
      [18, 11, 3, 1, LAMP_PALETTE.ZZZ_MID],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("dim")}
      </>
    ),
    durationMs: 340,
  },
  // Frame 3: Big 'Z' Dissolves into Room, Small 'z' Drifts
  {
    name: "sleep-3",
    offsetY: 0,
    runs: [
      ...BASE_AND_ARM_RUNS,
      ...SHADE_RUNS,
      ...GLASS_CHIMNEY_RUNS,
      // Dimmed Filament
      [9, 22, 2, 1, LAMP_PALETTE.FILAMENT_DIM],
      [9, 23, 2, 1, LAMP_PALETTE.FILAMENT_OFF],
      // High Dissolving 'Z'
      [24, 1, 3, 1, LAMP_PALETTE.ZZZ_SOFT],
      [25, 2, 1, 1, LAMP_PALETTE.ZZZ_SOFT],
      [24, 3, 3, 1, LAMP_PALETTE.ZZZ_SOFT],
      // Middle 'z'
      [20, 6, 3, 1, LAMP_PALETTE.ZZZ_MID],
      [21, 7, 1, 1, LAMP_PALETTE.ZZZ_MID],
      [20, 8, 3, 1, LAMP_PALETTE.ZZZ_MID],
    ],
    elements: (
      <>
        {LAMP_SVG_DEFS}
        {renderLightCone("dim")}
      </>
    ),
    durationMs: 320,
  },
];

/** Complete 16-Bit Cozy Pixel Lamp Animation Registry */
export const COZY_PIXEL_LAMP_ANIMATIONS: Record<string, PixelAnimation> = {
  idle: {
    frames: IDLE_FRAMES,
    fps: 5,
    loop: true,
  },
  think: {
    frames: THINK_FRAMES,
    fps: 7,
    loop: true,
  },
  poke: {
    frames: POKE_FRAMES,
    fps: 10,
    loop: false,
    nextAnimation: "idle",
  },
  sleep: {
    frames: SLEEP_FRAMES,
    fps: 3,
    loop: true,
  },
};
