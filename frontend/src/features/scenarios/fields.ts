import type { InputField } from "../../api/types";
import { formatInteger, formatPercent } from "../../lib/format";

export type FieldUnit = "patients" | "percent" | "currency";

export interface FieldMeta {
  key: InputField;
  label: string;
  unit: FieldUnit;
  group: string;
  help: string;
}

/** The nine annual inputs, in patient-funnel order. Keys match the API's YearInput fields. */
export const INPUT_FIELDS: FieldMeta[] = [
  { key: "prevalent_patients", label: "Prevalent patients", unit: "patients", group: "Patient population", help: "Patients living with the condition" },
  { key: "diagnosed_pct", label: "Diagnosed", unit: "percent", group: "Patient population", help: "Share of prevalent patients who are diagnosed" },
  { key: "drug_treated_pct", label: "Drug-treated", unit: "percent", group: "Patient population", help: "Share of diagnosed patients on drug therapy" },
  { key: "eligible_pct", label: "Eligible for drug class", unit: "percent", group: "Patient population", help: "Share of drug-treated patients eligible for the class" },
  { key: "peak_brand_share_pct", label: "Peak brand share", unit: "percent", group: "Brand performance", help: "Brand share of eligible patients at peak" },
  { key: "uptake_pct", label: "Uptake", unit: "percent", group: "Brand performance", help: "Progress towards peak share in this year" },
  { key: "compliance_pct", label: "Compliance", unit: "percent", group: "Brand performance", help: "Share of patients on drug who stay compliant" },
  { key: "annual_price", label: "Annual gross price", unit: "currency", group: "Pricing", help: "Gross price per patient per year (USD)" },
  { key: "gross_to_net_pct", label: "Gross-to-net discount", unit: "percent", group: "Pricing", help: "Rebates and discounts deducted from gross revenue" },
];

/** Shown under the row label where the formatted value alone doesn't say it (percent cells show "%"). */
export const UNIT_LABEL: Record<FieldUnit, string> = {
  patients: "patients",
  percent: "",
  currency: "USD / patient / yr",
};

export function cellLabel(key: string): string {
  const [year, field] = key.split(":");
  return `${INPUT_FIELDS.find((f) => f.key === field)?.label ?? field}, ${year}`;
}

const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Readable display of a valid raw value. Display only — the raw string is what gets saved. */
export function formatFieldValue(unit: FieldUnit, value: string): string {
  switch (unit) {
    case "patients":
      return formatInteger(value);
    case "percent":
      return formatPercent(value);
    case "currency":
      return priceFormat.format(Number(value));
  }
}

export const cellKey = (year: number, field: InputField) => `${year}:${field}`;
