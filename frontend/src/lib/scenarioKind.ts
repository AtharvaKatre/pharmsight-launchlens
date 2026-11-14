/** Anything plotted or listed as a scenario: live scenarios and saved snapshots alike. */
export interface NamedScenario {
  id: number;
  name: string;
}

/**
 * The API has no scenario "type" field, so the three standard scenarios are recognised by name.
 * A renamed Base/Upside/Downside is treated as a custom scenario.
 */
export type ScenarioKind = "base" | "upside" | "downside" | "custom";

const STANDARD_KINDS: Record<string, ScenarioKind> = { base: "base", upside: "upside", downside: "downside" };

export function scenarioKind(name: string): ScenarioKind {
  return STANDARD_KINDS[name.trim().toLowerCase()] ?? "custom";
}

export const KIND_LABEL: Record<ScenarioKind, string> = {
  base: "Base case",
  upside: "Upside case",
  downside: "Downside case",
  custom: "Custom",
};

const KIND_ORDER: Record<ScenarioKind, number> = { base: 0, upside: 1, downside: 2, custom: 3 };

/** Standard scenarios first (Base, Upside, Downside), then custom scenarios in creation order. */
export function sortScenarios<T extends NamedScenario>(scenarios: T[]): T[] {
  return [...scenarios].sort(
    (a, b) => KIND_ORDER[scenarioKind(a.name)] - KIND_ORDER[scenarioKind(b.name)] || a.id - b.id,
  );
}

// Categorical palette, validated for colour-vision deficiency (adjacent ΔE ≥ 8) in fixed order.
// Each scenario keeps its colour regardless of which other scenarios are shown.
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const KIND_SLOT: Partial<Record<ScenarioKind, number>> = { base: 0, downside: 1, upside: 2 };
const OVERFLOW_COLOR = "#898781";

/**
 * Colour per scenario: Base, Downside and Upside always own slots 1–3; custom scenarios take
 * slots 4–8 in id order, then any standard slot whose scenario doesn't exist, then a neutral grey.
 */
export function scenarioColors(scenarios: NamedScenario[]): Map<number, string> {
  const colors = new Map<number, string>();
  const custom: NamedScenario[] = [];
  const usedSlots = new Set<number>();

  for (const scenario of [...scenarios].sort((a, b) => a.id - b.id)) {
    const slot = KIND_SLOT[scenarioKind(scenario.name)];
    if (slot !== undefined && !usedSlots.has(slot)) {
      usedSlots.add(slot);
      colors.set(scenario.id, SERIES[slot]);
    } else {
      custom.push(scenario);
    }
  }

  const freeSlots = [3, 4, 5, 6, 7, ...Object.values(KIND_SLOT).filter((slot) => !usedSlots.has(slot))];
  custom.forEach((scenario, i) => {
    const slot = freeSlots[i];
    colors.set(scenario.id, slot === undefined ? OVERFLOW_COLOR : SERIES[slot]);
  });
  return colors;
}
