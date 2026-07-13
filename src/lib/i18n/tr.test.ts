import { describe, expect, it } from "vitest";
import { WEIGHT_LABEL_TR, CONFIDENCE_LABEL_TR, scoreBandTr } from "./tr";
import { DEFAULT_SCORING_CONFIG } from "@/lib/scoring/config";
import {
  CATEGORIES,
  SCORE_GROUPS,
  CATEGORY_NAME_TR,
  SCORE_GROUP_NAME_TR,
} from "@/lib/taxonomy/categories";

describe("Turkish label coverage", () => {
  it("has a weight label for every scoring weight key", () => {
    for (const key of Object.keys(DEFAULT_SCORING_CONFIG.weights)) {
      expect(WEIGHT_LABEL_TR[key as keyof typeof WEIGHT_LABEL_TR]).toBeTruthy();
    }
  });

  it("has a Turkish name for every category slug", () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_NAME_TR[c.slug], `missing tr name for ${c.slug}`).toBeTruthy();
    }
  });

  it("has a Turkish name for every score group", () => {
    for (const group of Object.keys(SCORE_GROUPS)) {
      expect(SCORE_GROUP_NAME_TR[group as keyof typeof SCORE_GROUP_NAME_TR]).toBeTruthy();
    }
  });

  it("has all four confidence labels", () => {
    expect(Object.keys(CONFIDENCE_LABEL_TR).sort()).toEqual([
      "experimental",
      "good",
      "high",
      "limited",
    ]);
  });

  it("maps score bands to Turkish", () => {
    expect(scoreBandTr(90)).toBe("çok iyi");
    expect(scoreBandTr(70)).toBe("iyi");
    expect(scoreBandTr(50)).toBe("orta");
    expect(scoreBandTr(10)).toBe("sınırlı");
  });
});
