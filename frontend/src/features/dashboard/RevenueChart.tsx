import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import type { YearResult } from "../../api/types";
import { Icon } from "../../components/Icon";
import { SeriesDot } from "../../components/ScenarioBadge";
import { formatCurrency, formatCurrencyCompact, toNumber } from "../../lib/format";
import type { NamedScenario } from "../../lib/scenarioKind";

interface RevenueChartProps {
  scenarios: NamedScenario[];
  forecasts: Map<number, YearResult[]>;
  colors: Map<number, string>;
  focusId: number | null;
  selectedYear: number;
  onSelectYear: (year: number) => void;
  onFocusScenario: (id: number) => void;
}

const GRID = "#e6e8ef";
const AXIS = "#c9cdd8";
const MUTED_INK = "#6b7280";

export function RevenueChart({ scenarios, forecasts, colors, focusId, selectedYear, onSelectYear, onFocusScenario }: RevenueChartProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const plotted = scenarios.filter((s) => forecasts.has(s.id));
  const years = plotted.length ? forecasts.get(plotted[0].id)!.map((y) => y.year) : [];

  const rows = years.map((year, i) => {
    const row: Record<string, number> = { year };
    for (const s of plotted) row[`s${s.id}`] = toNumber(forecasts.get(s.id)![i].net_revenue);
    return row;
  });

  // Draw the focused scenario last so it sits on top of identical or overlapping lines.
  const drawOrder = [...plotted.filter((s) => s.id !== focusId), ...plotted.filter((s) => s.id === focusId)];

  return (
    <section className="card chart-card" aria-labelledby="revenue-chart-title">
      <header className="card__header">
        <div>
          <h2 id="revenue-chart-title">Net revenue by scenario</h2>
          <p className="muted">USD, {years[0]}–{years[years.length - 1]}. Click the chart to select a year.</p>
        </div>
        <div className="segmented" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "chart"} onClick={() => setView("chart")}>
            <Icon name="chart" size={15} /> Chart
          </button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
            <Icon name="table" size={15} /> Table
          </button>
        </div>
      </header>

      <ul className="legend" aria-label="Scenarios">
        {plotted.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className="legend__item"
              aria-pressed={s.id === focusId}
              onClick={() => onFocusScenario(s.id)}
              title="Focus this scenario"
            >
              <SeriesDot color={colors.get(s.id)!} />
              {s.name}
            </button>
          </li>
        ))}
      </ul>

      {view === "chart" ? (
        <div className="chart-card__plot">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={rows}
              margin={{ top: 12, right: 16, bottom: 4, left: 4 }}
              onClick={(state) => {
                const year = Number(state?.activeLabel);
                if (Number.isFinite(year)) onSelectYear(year);
              }}
            >
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: AXIS }} tick={{ fill: MUTED_INK, fontSize: 12 }} />
              <YAxis
                tickFormatter={(v: number) => formatCurrencyCompact(v)}
                tickLine={false}
                axisLine={false}
                tick={{ fill: MUTED_INK, fontSize: 12 }}
                width={64}
              />
              <ReferenceLine x={selectedYear} stroke={AXIS} strokeWidth={1.5} />
              <Tooltip
                content={<ChartTooltip scenarios={plotted} colors={colors} />}
                cursor={{ stroke: AXIS, strokeWidth: 1 }}
              />
              {drawOrder.map((s) => {
                const focused = s.id === focusId;
                return (
                  <Line
                    key={s.id}
                    dataKey={`s${s.id}`}
                    name={s.name}
                    type="monotone"
                    stroke={colors.get(s.id)}
                    strokeWidth={focused ? 2.5 : 2}
                    strokeOpacity={focusId === null || focused ? 1 : 0.45}
                    dot={false}
                    activeDot={{ r: 4, stroke: "#ffffff", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">Net revenue by scenario and year (USD)</caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                {plotted.map((s) => (
                  <th scope="col" key={s.id} className="num">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.year} className={row.year === selectedYear ? "is-selected" : undefined}>
                  <th scope="row">{row.year}</th>
                  {plotted.map((s) => (
                    <td key={s.id} className="num">
                      {formatCurrency(row[`s${s.id}`])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  scenarios,
  colors,
}: TooltipProps<number, string> & { scenarios: NamedScenario[]; colors: Map<number, string> }) {
  if (!active || !payload?.length) return null;
  const values = scenarios
    .map((s) => ({ s, value: payload.find((p) => p.dataKey === `s${s.id}`)?.value }))
    .filter((v): v is { s: NamedScenario; value: number } => typeof v.value === "number")
    .sort((a, b) => b.value - a.value);

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__title">{label}</div>
      {values.map(({ s, value }) => (
        <div className="chart-tooltip__row" key={s.id}>
          <SeriesDot color={colors.get(s.id)!} />
          <span className="chart-tooltip__name">{s.name}</span>
          <span className="chart-tooltip__value">{formatCurrencyCompact(value)}</span>
        </div>
      ))}
    </div>
  );
}
