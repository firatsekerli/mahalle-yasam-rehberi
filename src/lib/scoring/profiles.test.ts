import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE_SLUG, LIFESTYLE_PROFILES, getProfile } from "./profiles";
import { DEFAULT_SCORING_CONFIG } from "./config";

describe("lifestyle profiles", () => {
  it("every profile's weights sum to 1.0 and use the config's weight keys", () => {
    const keys = Object.keys(DEFAULT_SCORING_CONFIG.weights).sort();
    for (const p of LIFESTYLE_PROFILES) {
      const sum = Object.values(p.weights).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1)).toBeLessThan(1e-6);
      expect(Object.keys(p.weights).sort()).toEqual(keys);
    }
  });

  it("getProfile falls back to the default for unknown/undefined slugs", () => {
    expect(getProfile(undefined).slug).toBe(DEFAULT_PROFILE_SLUG);
    expect(getProfile("does-not-exist").slug).toBe(DEFAULT_PROFILE_SLUG);
    expect(getProfile("family").slug).toBe("family");
  });
});
