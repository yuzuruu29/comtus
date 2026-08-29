export {
  PixelSprite,
  usePrefersReducedMotion,
  type PixelAnimation,
  type PixelCoordinate,
  type PixelFrame,
  type PixelRun,
  type PixelSpriteProps,
} from "./PixelSprite";

export {
  PixelBatteryCompanion,
  PixelLampCompanion,
  COMTUS_BATTERY_POS_KEY,
  COMTUS_LAMP_POS_KEY,
  FOUR_MINUTES_MS,
  clampCoordinates,
  computeBottomRightRestingPos,
  loadSavedBatteryPos,
  loadSavedLampPos,
  nudgeOutOfRects,
  persistBatteryPos,
  persistLampPos,
  type BatteryAnimationMood,
  type BatteryAvoidRect,
  type BatteryPosition,
  type PixelBatteryCompanionProps,
  type LampAnimationMood,
  type LampAvoidRect,
  type LampPosition,
  type PixelLampCompanionProps,
} from "./PixelBatteryCompanion";

export {
  COZY_PIXEL_BATTERY_ANIMATIONS,
  BATTERY_HEIGHT,
  BATTERY_PALETTE,
  BATTERY_WIDTH,
  COZY_PIXEL_BATTERY_ANIMATIONS as COZY_PIXEL_LAMP_ANIMATIONS,
  BATTERY_HEIGHT as LAMP_HEIGHT,
  BATTERY_PALETTE as LAMP_PALETTE,
  BATTERY_WIDTH as LAMP_WIDTH,
} from "./pixelBatteryFrames";
