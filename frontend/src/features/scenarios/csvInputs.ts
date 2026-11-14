import type { InputField, YearInput } from "../../api/types";
import { parseCsv, toCsv } from "../../lib/csv";
import { INPUT_FIELDS } from "./fields";
import { toPayloadValue, validateValue } from "./validation";

/** One row per year: `year` followed by the nine API input fields. Used for both export and import. */
export const INPUT_CSV_COLUMNS = ["year", ...INPUT_FIELDS.map((f) => f.key)] as const;

export function inputsToCsv(years: YearInput[]): string {
  return toCsv([
    [...INPUT_CSV_COLUMNS],
    ...years.map((y) => [y.year, ...INPUT_FIELDS.map((f) => y[f.key])]),
  ]);
}

export type InputsCsvResult = { ok: true; years: YearInput[] } | { ok: false; errors: string[] };

/**
 * Validate an entire inputs CSV before anything is applied. Either every row is valid and all
 * expected years are present exactly once, or nothing is returned but the list of problems.
 */
export function parseInputsCsv(text: string, expectedYears: number[]): InputsCsvResult {
  const rows = parseCsv(text);
  if (rows.length === 0) return { ok: false, errors: ["The file is empty."] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const errors: string[] = [];

  const missing = INPUT_CSV_COLUMNS.filter((c) => !header.includes(c));
  const unknown = header.filter((h) => !(INPUT_CSV_COLUMNS as readonly string[]).includes(h));
  const duplicated = header.filter((h, i) => header.indexOf(h) !== i);
  if (missing.length) errors.push(`Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);
  if (unknown.length) errors.push(`Unknown column${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}.`);
  if (duplicated.length) errors.push(`Duplicate column${duplicated.length > 1 ? "s" : ""}: ${[...new Set(duplicated)].join(", ")}.`);
  if (errors.length) return { ok: false, errors };

  const column = (name: string) => header.indexOf(name);
  const byYear = new Map<number, YearInput>();

  rows.slice(1).forEach((cells, index) => {
    const line = index + 2; // 1-based, counting the header
    if (cells.length !== header.length) {
      errors.push(`Row ${line}: expected ${header.length} values but found ${cells.length}.`);
      return;
    }
    const yearText = cells[column("year")].trim();
    const year = Number(yearText);
    if (!/^\d{4}$/.test(yearText) || !expectedYears.includes(year)) {
      errors.push(`Row ${line}: year "${yearText}" is not a forecast year (${expectedYears[0]}–${expectedYears[expectedYears.length - 1]}).`);
      return;
    }
    if (byYear.has(year)) {
      errors.push(`Row ${line}: year ${year} appears more than once.`);
      return;
    }

    const values = { year } as YearInput;
    for (const field of INPUT_FIELDS) {
      const raw = cells[column(field.key)];
      const problem = validateValue(field.unit, raw);
      if (problem) errors.push(`Row ${line} (${year}), ${field.key}: ${problem}.`);
      else values[field.key as InputField] = toPayloadValue(raw);
    }
    byYear.set(year, values);
  });

  const absent = expectedYears.filter((y) => !byYear.has(y));
  if (absent.length) errors.push(`Missing year${absent.length > 1 ? "s" : ""}: ${absent.join(", ")}.`);

  if (errors.length) return { ok: false, errors };
  return { ok: true, years: expectedYears.map((y) => byYear.get(y)!) };
}
