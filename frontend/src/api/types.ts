// TypeScript mirrors of the backend's OpenAPI schemas (backend/app/schemas.py).
// Every decimal value is transported as a string so no precision is lost.

export type Decimal = string;

export type Role = "FORECASTER" | "BRAND_LEAD";

export interface User {
  id: number;
  email: string;
  role: Role;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

/** One forecast year of assumptions. Percentages are on a 0–100 scale. */
export interface YearInput {
  year: number;
  prevalent_patients: Decimal;
  diagnosed_pct: Decimal;
  drug_treated_pct: Decimal;
  eligible_pct: Decimal;
  peak_brand_share_pct: Decimal;
  uptake_pct: Decimal;
  compliance_pct: Decimal;
  annual_price: Decimal;
  gross_to_net_pct: Decimal;
}

export type InputField = Exclude<keyof YearInput, "year">;

export interface YearResult {
  year: number;
  prevalent_patients: Decimal;
  diagnosed_patients: Decimal;
  drug_treated_patients: Decimal;
  eligible_patients: Decimal;
  peak_brand_patients: Decimal;
  patients_on_drug: Decimal;
  compliant_patients: Decimal;
  gross_revenue: Decimal;
  net_revenue: Decimal;
}

export interface ScenarioSummary {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ScenarioDetail extends ScenarioSummary {
  years: YearInput[];
}

/** PUT /api/scenarios/{id}: full replacement. */
export interface ScenarioUpdate {
  name: string;
  description: string | null;
  years: YearInput[];
}

/** POST /api/scenarios: years default to the Base assumptions when omitted. */
export interface ScenarioCreate {
  name: string;
  description?: string | null;
  years?: YearInput[];
}

export interface ScenarioClone {
  name?: string | null;
}

export interface ScenarioForecast {
  scenario_id: number;
  years: YearResult[];
}

/** Non-sensitive identity attached to versions and comments. */
export interface UserPublic {
  id: number;
  email: string;
  role: Role;
}

export interface ScenarioSnapshot {
  scenario_id: number;
  name: string;
  description: string | null;
  years: YearInput[];
  forecast: YearResult[];
}

export interface VersionSummary {
  id: number;
  created_by: number;
  author: UserPublic;
  created_at: string;
  comment: string | null;
}

/** An immutable snapshot of every scenario (inputs + results) at save time. */
export interface VersionDetail extends VersionSummary {
  snapshot: { scenarios: ScenarioSnapshot[] };
}

export interface VersionCreate {
  comment?: string | null;
}

export interface VersionComment {
  id: number;
  version_id: number;
  user_id: number;
  author: UserPublic;
  content: string;
  created_at: string;
}

/** One entry of FastAPI's 422 `detail` array. */
export interface ValidationIssue {
  loc: (string | number)[];
  msg: string;
  type: string;
}
