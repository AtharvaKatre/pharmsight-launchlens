import type { ScenarioSummary, VersionSummary } from "../../api/types";

/** Most recent edit across all scenarios (ISO timestamp), or null when there are none. */
export function lastEditedAt(scenarios: ScenarioSummary[]): string | null {
  return scenarios.reduce<string | null>((max, s) => (max === null || s.updated_at > max ? s.updated_at : max), null);
}

/**
 * True when a scenario was created, edited or renamed after `version` was saved. A deletion leaves
 * no timestamp, so this can say "edited" with certainty but never "identical".
 */
export function editedSince(scenarios: ScenarioSummary[], version: VersionSummary): boolean {
  const last = lastEditedAt(scenarios);
  return last !== null && new Date(last).getTime() > new Date(version.created_at).getTime();
}
