import { describe, expect, it } from "vitest";

import { BASE_YEARS } from "../../test/fixtures";
import { mapServerIssues, normalizeInput, toPayloadValue, toPayloadYear, validateValue, validateYears } from "./validation";

describe("validateValue", () => {
  it("accepts valid numbers, including formatting people type", () => {
    expect(validateValue("patients", "2,000,000")).toBeNull();
    expect(validateValue("currency", "$10,000.50")).toBeNull();
    expect(validateValue("percent", "12.5%")).toBeNull();
  });

  it("accepts the 0 and 100 percentage boundaries", () => {
    expect(validateValue("percent", "0")).toBeNull();
    expect(validateValue("percent", "100")).toBeNull();
  });

  it.each([
    ["percent", "", "Enter a value"],
    ["percent", "abc", "Enter a number"],
    ["percent", "1.2.3", "Enter a number"],
    ["percent", "100.01", "Must be between 0% and 100%"],
    ["percent", "-1", "Cannot be negative"],
    ["currency", "-10000", "Cannot be negative"],
    ["patients", "-5", "Cannot be negative"],
  ] as const)("rejects %s value %j", (unit, value, message) => {
    expect(validateValue(unit, value)).toBe(message);
  });

  it("allows values above 100 for counts and prices", () => {
    expect(validateValue("patients", "2500000")).toBeNull();
    expect(validateValue("currency", "125000")).toBeNull();
  });
});

describe("payload values", () => {
  it("strips formatting characters but never rounds", () => {
    expect(normalizeInput(" 2,187,370.545368721802 ")).toBe("2187370.545368721802");
    expect(toPayloadValue("12.3456789%")).toBe("12.3456789");
    expect(toPayloadValue("$10,000.")).toBe("10000");
  });

  it("leaves untouched API values exactly as received", () => {
    const last = BASE_YEARS[BASE_YEARS.length - 1];
    expect(toPayloadYear(last)).toEqual(last);
    expect(toPayloadYear(last).prevalent_patients).toBe("2187370.545368721802000000");
  });
});

describe("validateYears", () => {
  it("reports errors keyed by year and field", () => {
    const years = BASE_YEARS.map((y) => ({ ...y }));
    years[2].uptake_pct = "150";
    years[5].annual_price = "";
    expect(validateYears(years)).toEqual({
      "2029:uptake_pct": "Must be between 0% and 100%",
      "2032:annual_price": "Enter a value",
    });
  });

  it("returns no errors for the Base assumptions", () => {
    expect(validateYears(BASE_YEARS)).toEqual({});
  });
});

describe("mapServerIssues", () => {
  it("maps cell issues to year/field keys and keeps the rest as general errors", () => {
    const mapped = mapServerIssues(
      [
        { loc: ["body", "years", 3, "annual_price"], msg: "Input should be greater than or equal to 0", type: "greater_than_equal" },
        { loc: ["body"], msg: "Value error, missing forecast years: [2036]", type: "value_error" },
      ],
      [2027, 2028, 2029, 2030],
    );
    expect(mapped.cells).toEqual({ "2030:annual_price": "Input should be greater than or equal to 0" });
    expect(mapped.general).toEqual(["missing forecast years: [2036]"]);
  });
});
