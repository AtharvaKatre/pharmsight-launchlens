import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { errorMessage } from "../../api/client";
import { scenariosApi } from "../../api/scenarios";
import type { YearResult } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Icon } from "../../components/Icon";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { ScenarioBadge } from "../../components/ScenarioBadge";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatInteger,
  formatSignedRatio,
  toNumber,
} from "../../lib/format";
import { downloadCsv } from "../../lib/download";
import { scenarioKind } from "../../lib/scenarioKind";
import { resultsToCsv } from "./csvResults";
import { useWorkspace } from "../../workspace/WorkspaceContext";
import { SaveVersionDialog } from "../versions/SaveVersionDialog";
import { KpiCard } from "./KpiCard";
import { PatientFunnel } from "./PatientFunnel";
import { RevenueChart } from "./RevenueChart";
import "./dashboard.css";

export function DashboardPage() {
  const { scenarios, status, error, reload, activeScenarioId, setActiveScenarioId, colors } = useWorkspace();
  const [forecasts, setForecasts] = useState<Map<number, YearResult[]>>(new Map());
  const [forecastState, setForecastState] = useState<"loading" | "ready" | "error">("loading");
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [savingVersion, setSavingVersion] = useState(false);
  const { canEdit } = useAuth();
  const navigate = useNavigate();

  // Refetch whenever a scenario is added, removed or updated.
  const scenarioKey = scenarios.map((s) => `${s.id}@${s.updated_at}`).join(",");
  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    Promise.all(scenarios.map((s) => scenariosApi.forecast(s.id)))
      .then((results) => {
        if (cancelled) return;
        setForecasts(new Map(results.map((r) => [r.scenario_id, r.years])));
        setForecastState("ready");
        setForecastError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setForecastError(errorMessage(err));
        setForecastState((current) => (current === "ready" ? "ready" : "error"));
      });
    return () => {
      cancelled = true;
    };
    // `scenarios` is intentionally represented by scenarioKey.
  }, [scenarioKey, status, retryToken]);

  const focus = scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0];
  const focusYears = focus ? forecasts.get(focus.id) : undefined;
  const years = focusYears?.map((y) => y.year) ?? [];
  const year = selectedYear !== null && years.includes(selectedYear) ? selectedYear : years[years.length - 1];
  const result = focusYears?.find((y) => y.year === year);

  const base = scenarios.find((s) => scenarioKind(s.name) === "base");
  const baseResult = base ? forecasts.get(base.id)?.find((y) => y.year === year) : undefined;

  const totals = useMemo(() => {
    if (!focusYears?.length) return null;
    const net = focusYears.map((y) => toNumber(y.net_revenue));
    const peakIndex = net.indexOf(Math.max(...net));
    return { cumulative: net.reduce((a, b) => a + b, 0), peak: net[peakIndex], peakYear: focusYears[peakIndex].year };
  }, [focusYears]);

  if (status === "loading") return <LoadingState label="Loading workspace…" />;
  if (status === "error") {
    return (
      <ErrorBanner title="Couldn't load scenarios" onRetry={() => void reload()}>
        {error}
      </ErrorBanner>
    );
  }
  if (scenarios.length === 0 || !focus) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="card empty-state">
          <h2>No scenarios to show</h2>
          <p className="muted">
            Create a scenario on the <Link to="/scenarios">Scenarios</Link> page to see forecast results.
          </p>
        </div>
      </>
    );
  }

  function exportResults() {
    const rows = scenarios.flatMap((s) => {
      const years = forecasts.get(s.id);
      return years ? [{ name: s.name, years }] : [];
    });
    downloadCsv(`launchlens-forecast-results-${new Date().toISOString().slice(0, 10)}.csv`, resultsToCsv(rows));
  }

  const net = result ? toNumber(result.net_revenue) : 0;
  const baseNet = baseResult ? toNumber(baseResult.net_revenue) : 0;
  const vsBase =
    focus.id === base?.id ? "Base case scenario" : baseResult && baseNet > 0 ? `${formatSignedRatio((net - baseNet) / baseNet)} vs Base` : null;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Forecast results across scenarios, calculated from the current saved inputs."
        actions={
          <>
            <button type="button" className="btn btn--ghost" onClick={exportResults} disabled={forecastState !== "ready"}>
              Export results CSV
            </button>
            {canEdit && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setSavingVersion(true)}
                disabled={forecastState !== "ready"}
                title="Freeze this forecast (all scenarios) as a read-only version"
              >
                <Icon name="check" size={16} /> Save as version
              </button>
            )}
          </>
        }
      />
      {savingVersion && (
        <SaveVersionDialog
          forecasts={forecasts}
          onSaved={(created) => navigate(`/versions/${created.id}`)}
          onClose={() => setSavingVersion(false)}
        />
      )}

      <div className="filter-row" role="group" aria-label="Dashboard filters">
        <label className="filter">
          <span className="filter__label">Scenario</span>
          <select value={focus.id} onChange={(e) => setActiveScenarioId(Number(e.target.value))}>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <ScenarioBadge name={focus.name} color={colors.get(focus.id)} />
        <div className="filter filter--years">
          <span className="filter__label" id="year-filter-label">
            Year
          </span>
          <div className="segmented segmented--years" role="group" aria-labelledby="year-filter-label">
            {years.map((y) => (
              <button key={y} type="button" aria-pressed={y === year} onClick={() => setSelectedYear(y)}>
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      {forecastError && (
        <ErrorBanner title="Couldn't load forecast results" onRetry={() => setRetryToken((t) => t + 1)}>
          {forecastError}
        </ErrorBanner>
      )}
      {forecastState === "loading" && <LoadingState label="Calculating forecasts…" />}

      {forecastState === "ready" && result && totals && (
        <div className="dashboard">
          <div className="kpi-grid">
            <KpiCard label={`Net revenue · ${year}`} value={formatCurrencyCompact(net)} exactValue={formatCurrency(net)} detail={vsBase} />
            <KpiCard
              label={`Patients on drug · ${year}`}
              value={formatInteger(result.patients_on_drug)}
              detail={`${formatInteger(result.compliant_patients)} compliant`}
            />
            <KpiCard
              label={`Cumulative net revenue · ${years[0]}–${years[years.length - 1]}`}
              value={formatCurrencyCompact(totals.cumulative)}
              exactValue={formatCurrency(totals.cumulative)}
              detail={`${years.length}-year total`}
            />
            <KpiCard
              label="Peak annual net revenue"
              value={formatCurrencyCompact(totals.peak)}
              exactValue={formatCurrency(totals.peak)}
              detail={`Reached in ${totals.peakYear}`}
            />
          </div>

          <div className="dashboard__panels">
            <RevenueChart
              scenarios={scenarios}
              forecasts={forecasts}
              colors={colors}
              focusId={focus.id}
              selectedYear={year}
              onSelectYear={setSelectedYear}
              onFocusScenario={setActiveScenarioId}
            />
            <PatientFunnel result={result} scenarioName={focus.name} />
          </div>
        </div>
      )}
    </>
  );
}
