import type { ScenarioDetail, ScenarioForecast, ScenarioSummary, YearInput, YearResult } from "../api/types";
import generated from "./baseFixtures.json";

/** Base assumptions and forecast exactly as the backend serialises them. */
export const BASE_YEARS = generated.baseYears as YearInput[];
export const BASE_FORECAST = generated.baseForecast as YearResult[];

const TIMESTAMP = "2026-11-14T12:00:00Z";

export function summary(id: number, name: string, description: string | null = null): ScenarioSummary {
  return { id, name, description, created_by: 1, created_at: TIMESTAMP, updated_at: TIMESTAMP };
}

export function detail(scenario: ScenarioSummary, years: YearInput[] = BASE_YEARS): ScenarioDetail {
  return { ...scenario, years: years.map((y) => ({ ...y })) };
}

/** Forecast with net revenue scaled, so scenarios are distinguishable in assertions. */
export function forecast(scenarioId: number, netScale = 1): ScenarioForecast {
  return {
    scenario_id: scenarioId,
    years: BASE_FORECAST.map((y) => ({ ...y, net_revenue: String(Number(y.net_revenue) * netScale) })),
  };
}

export const STANDARD_SCENARIOS = [
  summary(1, "Base", "Base case assumptions"),
  summary(2, "Upside", "Faster uptake"),
  summary(3, "Downside", "Payer pushback"),
];
