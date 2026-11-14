// Presentation-only formatting. Values arrive as exact decimal strings; rounding happens here
// for display and never feeds back into what is sent to the API.

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const currencyCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const percent = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const ratio = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

export const toNumber = (value: string | number): number => (typeof value === "number" ? value : Number(value));

export const formatInteger = (value: string | number) => integer.format(toNumber(value));
export const formatCurrency = (value: string | number) => currency.format(toNumber(value));
export const formatCurrencyCompact = (value: string | number) => currencyCompact.format(toNumber(value));
/** A value already on the 0–100 scale, e.g. "60" → "60%". */
export const formatPercent = (value: string | number) => `${percent.format(toNumber(value))}%`;
/** A 0–1 ratio, e.g. 0.123 → "12.3%". */
export const formatRatio = (value: number) => ratio.format(value);

export function formatSignedRatio(value: number): string {
  const text = formatRatio(Math.abs(value));
  if (Math.abs(value) < 0.0005) return "±0%";
  return value > 0 ? `+${text}` : `−${text}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}
