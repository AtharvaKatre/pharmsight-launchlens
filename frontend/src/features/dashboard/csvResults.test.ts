import { describe, expect, it } from "vitest";

import { parseCsv } from "../../lib/csv";
import { BASE_FORECAST } from "../../test/fixtures";
import { RESULT_CSV_COLUMNS, resultsToCsv } from "./csvResults";

describe("resultsToCsv", () => {
  it("exports the full funnel and revenue for every scenario and year at full precision", () => {
    const rows = parseCsv(
      resultsToCsv([
        { name: "Base", years: BASE_FORECAST },
        { name: "Upside, optimistic", years: BASE_FORECAST },
      ]),
    );

    expect(rows[0]).toEqual([...RESULT_CSV_COLUMNS]);
    expect(rows).toHaveLength(1 + 2 * 10);
    expect(rows[1]).toEqual([
      "Base",
      "2027",
      "2000000",
      "1200000.0",
      "600000.00",
      "240000.000",
      "48000.0000",
      "4800.00000",
      "3840.000000",
      "38400000.000000",
      "28800000.00000000",
    ]);
    expect(rows[11][0]).toBe("Upside, optimistic");
    expect(rows[20][1]).toBe("2036");
  });
});
