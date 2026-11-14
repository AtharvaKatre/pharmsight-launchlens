import { describe, expect, it } from "vitest";

import { summary } from "../test/fixtures";
import { scenarioColors, scenarioKind, sortScenarios } from "./scenarioKind";

describe("scenarioKind", () => {
  it("recognises the standard scenarios by name, ignoring case and spacing", () => {
    expect(scenarioKind("Base")).toBe("base");
    expect(scenarioKind("  upside ")).toBe("upside");
    expect(scenarioKind("DOWNSIDE")).toBe("downside");
  });

  it("treats anything else as custom", () => {
    expect(scenarioKind("Base (copy)")).toBe("custom");
    expect(scenarioKind("High price")).toBe("custom");
  });
});

describe("sortScenarios", () => {
  it("orders Base, Upside, Downside, then custom scenarios by id", () => {
    const sorted = sortScenarios([
      summary(9, "Custom B"),
      summary(3, "Downside"),
      summary(4, "Custom A"),
      summary(2, "Upside"),
      summary(1, "Base"),
    ]);
    expect(sorted.map((s) => s.name)).toEqual(["Base", "Upside", "Downside", "Custom A", "Custom B"]);
  });
});

describe("scenarioColors", () => {
  it("gives standard scenarios fixed colours regardless of ids", () => {
    const colors = scenarioColors([summary(7, "Downside"), summary(5, "Upside"), summary(9, "Base")]);
    expect(colors.get(9)).toBe("#2a78d6");
    expect(colors.get(7)).toBe("#eb6834");
    expect(colors.get(5)).toBe("#1baf7a");
  });

  it("assigns colours by scenario identity, not by display order", () => {
    const scenarios = [summary(1, "Base"), summary(4, "Alpha"), summary(5, "Beta"), summary(2, "Upside")];
    const forward = scenarioColors(scenarios);
    const reversed = scenarioColors([...scenarios].reverse());
    expect([...reversed.entries()].sort()).toEqual([...forward.entries()].sort());
    expect(forward.get(4)).toBe("#eda100"); // first custom scenario takes slot 4
    expect(forward.get(5)).toBe("#e87ba4");
  });

  it("gives every scenario a distinct colour up to the palette size", () => {
    const scenarios = Array.from({ length: 8 }, (_, i) => summary(i + 1, i === 0 ? "Base" : `Custom ${i}`));
    expect(new Set(scenarioColors(scenarios).values()).size).toBe(8);
  });
});
