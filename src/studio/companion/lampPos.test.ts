import { afterEach, describe, expect, it } from "vitest";
import {
  clampLampPos,
  LAMP_POS_KEY,
  loadLampPos,
  parseLampPos,
  saveLampPos,
} from "./lampPos";

afterEach(() => {
  localStorage.removeItem(LAMP_POS_KEY);
});

describe("clampLampPos", () => {
  it("keeps the lamp inside the viewport", () => {
    expect(clampLampPos(-40, -20, { w: 96, h: 112 }, { w: 400, h: 300 })).toEqual({
      left: 8,
      top: 8,
    });
    expect(clampLampPos(900, 900, { w: 96, h: 112 }, { w: 400, h: 300 })).toEqual({
      left: 400 - 96 - 8,
      top: 300 - 112 - 8,
    });
  });

  it("leaves a fitting position alone", () => {
    expect(clampLampPos(40, 60, { w: 96, h: 112 }, { w: 800, h: 600 })).toEqual({
      left: 40,
      top: 60,
    });
  });
});

describe("lamp pos storage", () => {
  it("round-trips a saved spot", () => {
    saveLampPos({ left: 120, top: 80 });
    expect(loadLampPos()).toEqual({ left: 120, top: 80 });
  });

  it("clears on null and ignores junk", () => {
    saveLampPos({ left: 10, top: 10 });
    saveLampPos(null);
    expect(loadLampPos()).toBeNull();
    expect(parseLampPos({ left: "nope" })).toBeNull();
    expect(parseLampPos(null)).toBeNull();
  });
});
