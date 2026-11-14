import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string;
  /** Full-precision value shown on hover when the headline is abbreviated. */
  exactValue?: string;
  detail?: ReactNode;
}

export function KpiCard({ label, value, exactValue, detail }: KpiCardProps) {
  return (
    <div className="kpi card">
      <span className="kpi__label">{label}</span>
      <span className="kpi__value" title={exactValue}>
        {value}
      </span>
      {detail && <span className="kpi__detail">{detail}</span>}
    </div>
  );
}
