import { describe, expect, it } from "vitest";

import {
  formatCurrency,
  formatCurrencyCompact,
  formatInteger,
  formatPercent,
  formatRatio,
  formatSignedRatio,
} from "./format";

describe("format", () => {
  it("formats patient counts with grouping and no decimals", () => {
    expect(formatInteger("2000000")).toBe("2,000,000");
    expect(formatInteger("2187370.545368721802000000")).toBe("2,187,371");
  });

  it("formats currency in full and compact form", () => {
    expect(formatCurrency("288000000.00000000")).toBe("$288,000,000");
    expect(formatCurrencyCompact("28800000.00000000")).toBe("$28.8M");
    expect(formatCurrencyCompact(1_250_000_000)).toBe("$1.3B");
  });

  it("formats 0–100 percentages without forcing decimals", () => {
    expect(formatPercent("60")).toBe("60%");
    expect(formatPercent("12.5")).toBe("12.5%");
    expect(formatPercent("0")).toBe("0%");
  });

  it("formats ratios and signed deltas", () => {
    expect(formatRatio(0.6)).toBe("60%");
    expect(formatSignedRatio(0.123)).toBe("+12.3%");
    expect(formatSignedRatio(-0.05)).toBe("−5%");
    expect(formatSignedRatio(0)).toBe("±0%");
  });
});
