import { expect, it } from "vitest";
import { lampReach } from "./LampSwitch";

it("starts the light at the lamp and reaches the farthest corner of the page", () => {
  // A lamp near the top right: the farthest corner is the bottom left.
  const { x, y, r } = lampReach({ left: 1380, top: 10, width: 40, height: 40 }, 1440, 900);
  expect([x, y]).toEqual([1400, 30]);
  expect(r).toBe(Math.ceil(Math.hypot(1400, 870)));
  // Centred, every corner is equally far.
  expect(lampReach({ left: 700, top: 430, width: 40, height: 40 }, 1440, 900).r).toBe(Math.ceil(Math.hypot(720, 450)));
});
