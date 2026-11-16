import { Link } from "react-router-dom";

import type { ScenarioSummary, VersionSummary } from "../../api/types";
import { formatDateTime } from "../../lib/format";
import { editedSince, lastEditedAt } from "./changes";

interface CurrentForecastCardProps {
  scenarios: ScenarioSummary[];
  latest: VersionSummary | undefined;
  canSave: boolean;
  onSave: () => void;
}

/**
 * "Now" at the top of the version timeline: the live forecast that Save would freeze, so the save
 * action is clearly about the current scenarios and not about the version being viewed.
 */
export function CurrentForecastCard({ scenarios, latest, canSave, onSave }: CurrentForecastCardProps) {
  const lastEdited = lastEditedAt(scenarios);
  // Only claim what timestamps prove: an edit after the latest version.
  const editedSinceLatest = latest !== undefined && editedSince(scenarios, latest);

  return (
    <section className="current-forecast" aria-labelledby="current-forecast-title">
      <div className="current-forecast__row">
        <h3 id="current-forecast-title">Current forecast</h3>
        <span className="chip chip--live">Live</span>
      </div>
      <p className="current-forecast__meta">
        {scenarios.length} {scenarios.length === 1 ? "scenario" : "scenarios"}
        {lastEdited && <> · last edited {formatDateTime(lastEdited)}</>}
      </p>
      {editedSinceLatest && <p className="current-forecast__status">Edited since version #{latest.id}</p>}
      <div className="current-forecast__actions">
        <Link to="/dashboard" className="btn btn--ghost btn--sm">
          View on Dashboard
        </Link>
        {canSave && (
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={onSave}
            disabled={scenarios.length === 0}
            title={scenarios.length === 0 ? "Create a scenario first: a version needs at least one" : undefined}
          >
            Save as version
          </button>
        )}
      </div>
    </section>
  );
}
