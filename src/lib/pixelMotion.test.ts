import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  stepEase,
  stepEaseEvaluate,
  springStepped,
  prefersReducedMotion,
  resolveMotionState,
  getMotionConfig,
  spawnPixelSparks,
} from "./pixelMotion";

describe("pixelMotion", () => {
  describe("stepEase", () => {
    it("generates default CSS steps timing string with jump-end", () => {
      expect(stepEase(4)).toBe("steps(4, jump-end)");
      expect(stepEase(8)).toBe("steps(8, jump-end)");
    });

    it("supports custom jump terms", () => {
      expect(stepEase(6, "jump-start")).toBe("steps(6, jump-start)");
      expect(stepEase(10, "jump-none")).toBe("steps(10, jump-none)");
      expect(stepEase(12, "jump-both")).toBe("steps(12, jump-both)");
    });

    it("clamps minimum steps to 1", () => {
      expect(stepEase(0)).toBe("steps(1, jump-end)");
      expect(stepEase(-5)).toBe("steps(1, jump-end)");
    });
  });

  describe("stepEaseEvaluate", () => {
    it("evaluates discrete stepped values for jump-end", () => {
      expect(stepEaseEvaluate(0, 4, "jump-end")).toBe(0);
      expect(stepEaseEvaluate(0.24, 4, "jump-end")).toBe(0);
      expect(stepEaseEvaluate(0.25, 4, "jump-end")).toBe(0.25);
      expect(stepEaseEvaluate(0.5, 4, "jump-end")).toBe(0.5);
      expect(stepEaseEvaluate(0.75, 4, "jump-end")).toBe(0.75);
      expect(stepEaseEvaluate(1, 4, "jump-end")).toBe(1);
    });

    it("evaluates discrete stepped values for jump-start", () => {
      expect(stepEaseEvaluate(0.1, 4, "jump-start")).toBe(0.25);
      expect(stepEaseEvaluate(0.26, 4, "jump-start")).toBe(0.5);
      expect(stepEaseEvaluate(1, 4, "jump-start")).toBe(1);
    });
  });

  describe("springStepped", () => {
    it("produces deterministic stepped spring values", () => {
      const spring = springStepped({ steps: 5 });
      expect(spring.evaluate(0)).toBe(0);
      expect(spring.evaluate(1)).toBe(1);
      expect(spring.cssTiming).toBe("steps(5, jump-end)");

      const midVal = spring.evaluate(0.5);
      // Discrete step of 1/5 = 0.2 increments
      const remainder = (midVal * 10) % 2;
      expect(remainder).toBe(0);
    });

    it("generates expected keyframes sample array", () => {
      const spring = springStepped({ steps: 4 });
      const frames = spring.keyframes(6);
      expect(frames).toHaveLength(6);
      expect(frames[0]).toBe(0);
      expect(frames[5]).toBe(1);
      frames.forEach((val) => {
        expect(typeof val).toBe("number");
      });
    });
  });

  describe("prefersReducedMotion & resolveMotionState", () => {
    const originalMatchMedia = window.matchMedia;

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it("detects system prefers-reduced-motion correctly", () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion: reduce"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(prefersReducedMotion()).toBe(true);
      expect(resolveMotionState("full")).toBe("none");
      expect(resolveMotionState("minimal")).toBe("none");
      expect(resolveMotionState("system")).toBe("none");
    });

    it("resolves user motion modes when system motion is allowed", () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(prefersReducedMotion()).toBe(false);
      expect(resolveMotionState("full")).toBe("full");
      expect(resolveMotionState("minimal")).toBe("minimal");
      expect(resolveMotionState("none")).toBe("none");
      expect(resolveMotionState("system")).toBe("full");
      expect(resolveMotionState(undefined)).toBe("full");
    });
  });

  describe("getMotionConfig", () => {
    it("returns correct flags for each motion tier", () => {
      const fullConfig = getMotionConfig("full");
      expect(fullConfig.allowParticles).toBe(true);
      expect(fullConfig.durationMultiplier).toBe(1);

      const minConfig = getMotionConfig("minimal");
      expect(minConfig.allowParticles).toBe(false);
      expect(minConfig.durationMultiplier).toBe(0.5);

      const noneConfig = getMotionConfig("none");
      expect(noneConfig.allowParticles).toBe(false);
      expect(noneConfig.durationMultiplier).toBe(0);
    });
  });

  describe("spawnPixelSparks", () => {
    beforeEach(() => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    });

    it("creates particle elements and appends them to DOM", () => {
      const result = spawnPixelSparks(100, 200, "#E3B04B", { count: 4, size: 4 });
      expect(result.particles).toHaveLength(4);
      expect(result.particles[0].color).toBe("#E3B04B");
      expect(result.particles[0].size).toBe(4);

      const nodes = document.querySelectorAll(".pixel-spark-node");
      expect(nodes.length).toBe(4);

      result.cleanup();
      const remaining = document.querySelectorAll(".pixel-spark-node");
      expect(remaining.length).toBe(0);
    });

    it("returns no-op and zero particles when motion is none", () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion: reduce"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const result = spawnPixelSparks(50, 50, "#E3B04B", { count: 6 });
      expect(result.particles).toHaveLength(0);
      result.cleanup();
    });
  });
});
