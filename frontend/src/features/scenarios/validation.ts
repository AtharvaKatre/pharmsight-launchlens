import type { ValidationIssue, YearInput } from "../../api/types";
import { cellKey, INPUT_FIELDS, type FieldUnit } from "./fields";

const NUMBER_PATTERN = /^-?(\d+(\.\d*)?|\.\d+)$/;

/** Remove formatting people commonly type or paste: thousands separators, spaces, $ and %. */
export function normalizeInput(raw: string): string {
  return raw.replace(/[,\s$%]/g, "");
}

/** Client-side check mirroring the backend rules. Returns an error message or null. */
export function validateValue(unit: FieldUnit, raw: string): string | null {
  const value = normalizeInput(raw);
  if (value === "") return "Enter a value";
  if (!NUMBER_PATTERN.test(value)) return "Enter a number";
  if (value.startsWith("-")) return "Cannot be negative";
  if (unit === "percent" && Number(value) > 100) return "Must be between 0% and 100%";
  return null;
}

/** The exact value sent to the API: formatting characters removed, digits untouched (never rounded). */
export function toPayloadValue(raw: string): string {
  const value = normalizeInput(raw);
  return value.endsWith(".") ? value.slice(0, -1) : value;
}

/**
 * Canonical form of a decimal string for comparison: formatting removed, leading zeros and
 * trailing fractional zeros dropped ("2020000.00" -> "2020000", "060.50" -> "60.5"). Exact: it
 * never goes through floating point. Text that isn't a number is returned normalized but as is.
 */
export function canonicalDecimal(raw: string): string {
  const value = normalizeInput(raw);
  if (!NUMBER_PATTERN.test(value)) return value;
  const negative = value.startsWith("-");
  const [intPart, fracPart = ""] = (negative ? value.slice(1) : value).split(".");
  const int = intPart.replace(/^0+/, "") || "0";
  const frac = fracPart.replace(/0+$/, "");
  const result = frac ? `${int}.${frac}` : int;
  return negative && result !== "0" ? `-${result}` : result;
}

/** True when two cell values are the same number, however they're written. */
export function sameValue(a: string | undefined, b: string | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return canonicalDecimal(a) === canonicalDecimal(b);
}

export function toPayloadYear(year: YearInput): YearInput {
  const result = { ...year };
  for (const field of INPUT_FIELDS) result[field.key] = toPayloadValue(year[field.key]);
  return result;
}

export function validateYears(years: YearInput[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const year of years) {
    for (const field of INPUT_FIELDS) {
      const message = validateValue(field.unit, year[field.key]);
      if (message) errors[cellKey(year.year, field.key)] = message;
    }
  }
  return errors;
}

export interface ServerErrors {
  cells: Record<string, string>;
  general: string[];
}

export const NO_SERVER_ERRORS: ServerErrors = { cells: {}, general: [] };

/**
 * Map FastAPI 422 issues onto grid cells. Cell issues have loc ["body", "years", index, field];
 * anything else (e.g. "missing forecast years") is reported as a general error.
 */
export function mapServerIssues(issues: ValidationIssue[], sentYears: number[]): ServerErrors {
  const result: ServerErrors = { cells: {}, general: [] };
  for (const issue of issues) {
    const [, section, index, field] = issue.loc;
    const message = issue.msg.replace(/^Value error, /, "");
    if (section === "years" && typeof index === "number" && typeof field === "string" && sentYears[index] !== undefined) {
      result.cells[`${sentYears[index]}:${field}`] = message;
    } else {
      result.general.push(message);
    }
  }
  return result;
}
