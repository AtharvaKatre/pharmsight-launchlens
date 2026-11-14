import { KIND_LABEL, scenarioKind } from "../lib/scenarioKind";

/** Neutral chip naming the scenario type; the coloured dot carries the scenario's chart colour. */
export function ScenarioBadge({ name, color }: { name: string; color?: string }) {
  const kind = scenarioKind(name);
  return (
    <span className={`kind-badge kind-badge--${kind}`}>
      {color && <span className="kind-badge__dot" style={{ background: color }} aria-hidden="true" />}
      {KIND_LABEL[kind]}
    </span>
  );
}

export function SeriesDot({ color }: { color: string }) {
  return <span className="series-dot" style={{ background: color }} aria-hidden="true" />;
}
