import { describe, expect, it } from "vitest";

import { fileSlug, parseCsv, toCsv } from "./csv";

describe("parseCsv", () => {
  it("parses simple rows with LF or CRLF line endings", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("handles quoted fields with commas, quotes and newlines", () => {
    expect(parseCsv('name,value\n"Base, adjusted","2,000,000"\n"say ""hi""","x\ny"')).toEqual([
      ["name", "value"],
      ["Base, adjusted", "2,000,000"],
      ['say "hi"', "x\ny"],
    ]);
  });

  it("strips a UTF-8 BOM and skips blank lines", () => {
    expect(parseCsv("﻿a,b\n\n1,2\n   \n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("keeps empty cells", () => {
    expect(parseCsv("a,b,c\n1,,3")).toEqual([["a", "b", "c"], ["1", "", "3"]]);
  });
});

describe("toCsv", () => {
  it("quotes only when needed and uses CRLF", () => {
    expect(toCsv([["a", "b, c", 'd"e'], [1, 2.5, "x"]])).toBe('a,"b, c","d""e"\r\n1,2.5,x\r\n');
  });

  it("round-trips through parseCsv", () => {
    const rows = [["scenario", "note"], ["Base", 'Has "quotes", commas\nand lines']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("fileSlug", () => {
  it("makes a safe filename fragment", () => {
    expect(fileSlug("Upside (copy) #2")).toBe("upside-copy-2");
    expect(fileSlug("   ")).toBe("scenario");
  });
});
