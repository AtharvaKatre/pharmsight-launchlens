import type { ScenarioSummary } from "../../api/types";
import { ScenarioBadge, SeriesDot } from "../../components/ScenarioBadge";
import { formatDateTime } from "../../lib/format";
import { scenarioKind } from "../../lib/scenarioKind";

interface ScenarioListProps {
  scenarios: ScenarioSummary[];
  activeId: number | null;
  colors: Map<number, string>;
  onSelect: (id: number) => void;
}

export function ScenarioList({ scenarios, activeId, colors, onSelect }: ScenarioListProps) {
  const standard = scenarios.filter((s) => scenarioKind(s.name) !== "custom");
  const custom = scenarios.filter((s) => scenarioKind(s.name) === "custom");

  return (
    <nav className="scenario-list" aria-label="Scenarios">
      <ListSection title="Standard scenarios" items={standard} {...{ activeId, colors, onSelect }} />
      <ListSection
        title="Custom scenarios"
        items={custom}
        empty="No custom scenarios yet."
        {...{ activeId, colors, onSelect }}
      />
    </nav>
  );
}

function ListSection({
  title,
  items,
  empty,
  activeId,
  colors,
  onSelect,
}: { title: string; items: ScenarioSummary[]; empty?: string } & Omit<ScenarioListProps, "scenarios">) {
  if (!items.length && !empty) return null;
  return (
    <section className="scenario-list__section">
      <h3 className="eyebrow">
        {title} <span className="count">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="muted scenario-list__empty">{empty}</p>
      ) : (
        <ul>
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="scenario-list__item"
                aria-current={s.id === activeId ? "true" : undefined}
                onClick={() => onSelect(s.id)}
              >
                <span className="scenario-list__row">
                  <SeriesDot color={colors.get(s.id) ?? "#898781"} />
                  <span className="scenario-list__name">{s.name}</span>
                  <ScenarioBadge name={s.name} />
                </span>
                {s.description && <span className="scenario-list__description">{s.description}</span>}
                <span className="scenario-list__meta">Updated {formatDateTime(s.updated_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
