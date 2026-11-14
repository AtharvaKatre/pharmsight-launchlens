import { useEffect, useMemo, useState } from "react";

import { errorMessage } from "../../api/client";
import type { VersionDetail } from "../../api/types";
import { versionsApi } from "../../api/versions";
import { ROLE_LABEL } from "../../auth/AuthContext";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Icon } from "../../components/Icon";
import { LoadingState } from "../../components/LoadingState";
import { ScenarioBadge } from "../../components/ScenarioBadge";
import { downloadCsv } from "../../lib/download";
import { formatDateTime } from "../../lib/format";
import { scenarioColors, sortScenarios } from "../../lib/scenarioKind";
import { resultsToCsv } from "../dashboard/csvResults";
import { PatientFunnel } from "../dashboard/PatientFunnel";
import { RevenueChart } from "../dashboard/RevenueChart";
import { InputGrid } from "../scenarios/InputGrid";
import { CommentsPanel } from "./CommentsPanel";

const NO_ERRORS = {};
const noop = () => {};

/** Read-only view of one saved version. Everything shown comes from the stored snapshot. */
export function VersionDetailView({ versionId }: { versionId: number }) {
  const [version, setVersion] = useState<VersionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    versionsApi
      .get(versionId)
      .then((loaded) => !cancelled && setVersion(loaded))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [versionId]);

  const snapshot = useMemo(() => {
    const scenarios = sortScenarios((version?.snapshot.scenarios ?? []).map((s) => ({ ...s, id: s.scenario_id })));
    return {
      scenarios,
      colors: scenarioColors(scenarios),
      forecasts: new Map(scenarios.map((s) => [s.id, s.forecast])),
    };
  }, [version]);

  if (error) return <ErrorBanner title="Couldn't load this version">{error}</ErrorBanner>;
  if (!version) return <LoadingState label="Loading snapshot…" />;

  const focus = snapshot.scenarios.find((s) => s.id === focusId) ?? snapshot.scenarios[0];
  const years = focus?.forecast.map((y) => y.year) ?? [];
  const year = selectedYear !== null && years.includes(selectedYear) ? selectedYear : years[years.length - 1];
  const result = focus?.forecast.find((y) => y.year === year);

  function exportResults() {
    if (!version) return;
    const results = snapshot.scenarios.map((s) => ({ name: s.name, years: s.forecast }));
    downloadCsv(`pharmsight-version-${version.id}-results.csv`, resultsToCsv(results));
  }

  return (
    <div className="version-detail">
      <section className="card version-detail__header" aria-labelledby="version-title">
        <div className="version-detail__title-row">
          <h2 id="version-title">Version #{version.id}</h2>
          <span className="chip chip--muted">
            <Icon name="lock" size={14} /> Read-only snapshot
          </span>
          <button type="button" className="btn btn--ghost btn--sm version-detail__export" onClick={exportResults}>
            Export results CSV
          </button>
        </div>
        <blockquote className={version.comment ? "version-detail__comment" : "version-detail__comment muted"}>
          {version.comment ?? "No comment"}
        </blockquote>
        <p className="version-detail__meta">
          Saved by <strong>{version.author.email}</strong> ({ROLE_LABEL[version.author.role]}) on{" "}
          {formatDateTime(version.created_at)} · {snapshot.scenarios.length}{" "}
          {snapshot.scenarios.length === 1 ? "scenario" : "scenarios"}. Later edits to scenarios do not change this
          version.
        </p>
      </section>

      {focus && year !== undefined && result && (
        <>
          <div className="dashboard__panels">
            <RevenueChart
              scenarios={snapshot.scenarios}
              forecasts={snapshot.forecasts}
              colors={snapshot.colors}
              focusId={focus.id}
              selectedYear={year}
              onSelectYear={setSelectedYear}
              onFocusScenario={setFocusId}
            />
            <PatientFunnel result={result} scenarioName={focus.name} />
          </div>

          <section className="card version-detail__inputs" aria-labelledby="snapshot-inputs-title">
            <header className="card__header">
              <div>
                <h2 id="snapshot-inputs-title">Saved inputs</h2>
                <p className="muted">Exactly as they were when this version was saved.</p>
              </div>
              <div className="segmented" role="group" aria-label="Snapshot scenario">
                {snapshot.scenarios.map((s) => (
                  <button key={s.id} type="button" aria-pressed={s.id === focus.id} onClick={() => setFocusId(s.id)}>
                    {s.name}
                  </button>
                ))}
              </div>
            </header>
            <div className="version-detail__scenario">
              <ScenarioBadge name={focus.name} color={snapshot.colors.get(focus.id)} />
              {focus.description && <span className="muted">{focus.description}</span>}
            </div>
            <InputGrid years={focus.years} saved={focus.years} errors={NO_ERRORS} readOnly onChange={noop} />
          </section>
        </>
      )}

      <CommentsPanel versionId={version.id} />
    </div>
  );
}
