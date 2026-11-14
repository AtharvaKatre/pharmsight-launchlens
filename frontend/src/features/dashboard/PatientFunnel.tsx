import type { YearResult } from "../../api/types";
import { formatCurrency, formatInteger, formatRatio, toNumber } from "../../lib/format";

const STAGES: { key: keyof YearResult; label: string }[] = [
  { key: "prevalent_patients", label: "Prevalent patients" },
  { key: "diagnosed_patients", label: "Diagnosed" },
  { key: "drug_treated_patients", label: "Drug-treated" },
  { key: "eligible_patients", label: "Eligible for drug class" },
  { key: "peak_brand_patients", label: "Peak brand patients" },
  { key: "patients_on_drug", label: "Patients on drug" },
  { key: "compliant_patients", label: "Compliant patients" },
];

interface PatientFunnelProps {
  result: YearResult;
  scenarioName: string;
}

export function PatientFunnel({ result, scenarioName }: PatientFunnelProps) {
  const top = toNumber(result.prevalent_patients);
  const gross = toNumber(result.gross_revenue);
  const net = toNumber(result.net_revenue);

  return (
    <section className="card funnel" aria-labelledby="funnel-title">
      <header className="card__header">
        <div>
          <h2 id="funnel-title">Patient funnel</h2>
          <p className="muted">
            {scenarioName} · {result.year}
          </p>
        </div>
      </header>

      <ol className="funnel__stages">
        {STAGES.map((stage, i) => {
          const value = toNumber(result[stage.key]);
          const previous = i > 0 ? toNumber(result[STAGES[i - 1].key]) : null;
          const width = top > 0 ? (value / top) * 100 : 0;
          return (
            <li key={stage.key} className="funnel__stage">
              <span className="funnel__label">{stage.label}</span>
              <span className="funnel__track" aria-hidden="true">
                <span className="funnel__bar" style={{ width: `max(${width}%, 3px)` }} />
              </span>
              <span className="funnel__value" title={result[stage.key].toString()}>
                {formatInteger(value)}
              </span>
              <span className="funnel__rate">
                {previous === null ? "" : previous > 0 ? `${formatRatio(value / previous)} of previous` : "—"}
              </span>
            </li>
          );
        })}
      </ol>

      <dl className="funnel__revenue">
        <div>
          <dt>Gross revenue</dt>
          <dd title={result.gross_revenue}>{formatCurrency(gross)}</dd>
        </div>
        <div>
          <dt>Gross-to-net</dt>
          <dd>{gross > 0 ? `−${formatRatio(1 - net / gross)}` : "—"}</dd>
        </div>
        <div className="funnel__net">
          <dt>Net revenue</dt>
          <dd title={result.net_revenue}>{formatCurrency(net)}</dd>
        </div>
      </dl>
    </section>
  );
}
