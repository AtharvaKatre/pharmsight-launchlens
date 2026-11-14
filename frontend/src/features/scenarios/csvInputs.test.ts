import { describe, expect, it } from "vitest";

import { parseCsv, toCsv } from "../../lib/csv";
import { BASE_YEARS } from "../../test/fixtures";
import { INPUT_CSV_COLUMNS, inputsToCsv, parseInputsCsv } from "./csvInputs";

const YEARS = BASE_YEARS.map((y) => y.year);

/** The exported Base CSV as rows, for building test files. */
function baseRows(): string[][] {
  return parseCsv(inputsToCsv(BASE_YEARS));
}

function errorsOf(text: string): string[] {
  const result = parseInputsCsv(text, YEARS);
  if (result.ok) throw new Error("expected the file to be rejected");
  return result.errors;
}

describe("inputsToCsv", () => {
  it("writes a header plus one row per year with every input at full precision", () => {
    const rows = baseRows();
    expect(rows[0]).toEqual([...INPUT_CSV_COLUMNS]);
    expect(rows[0]).toEqual([
      "year",
      "prevalent_patients",
      "diagnosed_pct",
      "drug_treated_pct",
      "eligible_pct",
      "peak_brand_share_pct",
      "uptake_pct",
      "compliance_pct",
      "annual_price",
      "gross_to_net_pct",
    ]);
    expect(rows).toHaveLength(11);
    expect(rows[10][1]).toBe("2187370.545368721802000000");
  });
});

describe("parseInputsCsv", () => {
  it("round-trips an exported file exactly", () => {
    const result = parseInputsCsv(inputsToCsv(BASE_YEARS), YEARS);
    expect(result).toEqual({ ok: true, years: BASE_YEARS });
  });

  it("accepts columns in any order, any header case, rows in any order and formatted numbers", () => {
    const rows = baseRows();
    const order = [0, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const reordered = rows.map((r) => order.map((i) => r[i]));
    reordered[0] = reordered[0].map((h) => h.toUpperCase());
    const body = reordered.slice(1).reverse();
    body[9][order.indexOf(1)] = "2,000,000"; // 2027 population (rows were reversed)
    const result = parseInputsCsv(toCsv([reordered[0], ...body]), YEARS);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.years.map((y) => y.year)).toEqual(YEARS);
      expect(result.years[0].prevalent_patients).toBe("2000000");
      expect(result.years[0].uptake_pct).toBe("10");
    }
  });

  it("rejects an empty file", () => {
    expect(errorsOf("")).toEqual(["The file is empty."]);
  });

  it("reports missing and unknown columns", () => {
    const rows = baseRows().map((r) => r.filter((_, i) => i !== 6));
    rows[0].push("notes");
    rows.slice(1).forEach((r) => r.push("x"));
    expect(errorsOf(toCsv(rows))).toEqual(["Missing column: uptake_pct.", "Unknown column: notes."]);
  });

  it("reports missing and duplicate years", () => {
    const rows = baseRows();
    rows[4] = [...rows[3]]; // 2030 replaced by a second 2029
    rows.splice(10, 1); // drop 2036
    expect(errorsOf(toCsv(rows))).toEqual(["Row 5: year 2029 appears more than once.", "Missing years: 2030, 2036."]);
  });

  it("rejects years outside the forecast period", () => {
    const rows = baseRows();
    rows[1][0] = "2026";
    expect(errorsOf(toCsv(rows))).toContain('Row 2: year "2026" is not a forecast year (2027–2036).');
  });

  it("validates every cell and reports all problems at once", () => {
    const rows = baseRows();
    rows[2][6] = "120"; // uptake 2028
    rows[5][8] = "-1"; // price 2031
    rows[7][2] = ""; // diagnosed 2033
    rows[9][3] = "abc"; // drug-treated 2035
    expect(errorsOf(toCsv(rows))).toEqual([
      "Row 3 (2028), uptake_pct: Must be between 0% and 100%.",
      "Row 6 (2031), annual_price: Cannot be negative.",
      "Row 8 (2033), diagnosed_pct: Enter a value.",
      "Row 10 (2035), drug_treated_pct: Enter a number.",
    ]);
  });

  it("rejects rows with the wrong number of values", () => {
    const rows = baseRows();
    rows[3] = rows[3].slice(0, 5);
    expect(errorsOf(toCsv(rows))).toContain("Row 4: expected 10 values but found 5.");
  });
});
