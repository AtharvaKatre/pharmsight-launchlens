import type { YearResult } from "../../api/types";
import { toCsv } from "../../lib/csv";

/** Complete patient funnel and revenue per scenario and year, at full API precision. */
export const RESULT_CSV_COLUMNS = [
  "scenario",
  "year",
  "prevalent_patients",
  "diagnosed_patients",
  "drug_treated_patients",
  "eligible_patients",
  "peak_brand_patients",
  "patients_on_drug",
  "compliant_patients",
  "gross_revenue",
  "net_revenue",
] as const;

export function resultsToCsv(scenarios: { name: string; years: YearResult[] }[]): string {
  const rows: (string | number)[][] = [[...RESULT_CSV_COLUMNS]];
  for (const scenario of scenarios) {
    for (const y of scenario.years) {
      rows.push([
        scenario.name,
        y.year,
        y.prevalent_patients,
        y.diagnosed_patients,
        y.drug_treated_patients,
        y.eligible_patients,
        y.peak_brand_patients,
        y.patients_on_drug,
        y.compliant_patients,
        y.gross_revenue,
        y.net_revenue,
      ]);
    }
  }
  return toCsv(rows);
}
