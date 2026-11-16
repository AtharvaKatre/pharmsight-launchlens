import { useEffect, useId, useState, type FormEvent } from "react";

import { errorMessage } from "../../api/client";
import { scenariosApi } from "../../api/scenarios";
import type { VersionDetail, VersionSummary, YearResult } from "../../api/types";
import { versionsApi } from "../../api/versions";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Modal } from "../../components/Modal";
import { SeriesDot } from "../../components/ScenarioBadge";
import { formatCurrencyCompact, formatDateTime, toNumber } from "../../lib/format";
import { useWorkspace } from "../../workspace/WorkspaceContext";
import { editedSince } from "./changes";
import "./versions.css";

const COMMENT_MAX = 2000;

interface SaveVersionDialogProps {
  /** Live results if the caller already has them (the Dashboard); otherwise they're fetched for the preview. */
  forecasts?: Map<number, YearResult[]>;
  /** The newest saved version (null: none yet) if the caller knows it; otherwise it's fetched. */
  latest?: VersionSummary | null;
  onSaved: (version: VersionDetail) => void;
  onClose: () => void;
}

/** Saves the *current* forecast (every scenario, as saved) as a new read-only version. */
export function SaveVersionDialog({ forecasts: given, latest: givenLatest, onSaved, onClose }: SaveVersionDialogProps) {
  const { scenarios, colors } = useWorkspace();
  const [fetchedLatest, setFetchedLatest] = useState<VersionSummary | null | undefined>(undefined);
  const latest = givenLatest !== undefined ? givenLatest : fetchedLatest;
  const fieldId = useId();
  const [comment, setComment] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fetched, setFetched] = useState<Map<number, YearResult[]> | null>(null);
  const forecasts = given ?? fetched;

  // The preview is informational: if results can't be loaded, the list still shows the scenario names.
  useEffect(() => {
    if (given) return;
    let cancelled = false;
    Promise.all(scenarios.map((s) => scenariosApi.forecast(s.id)))
      .then((results) => !cancelled && setFetched(new Map(results.map((r) => [r.scenario_id, r.years]))))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [given, scenarios]);

  // Only for the "no edits since" note; saving never depends on it.
  useEffect(() => {
    if (givenLatest !== undefined) return;
    let cancelled = false;
    versionsApi
      .list()
      .then((list) => !cancelled && setFetchedLatest(list[0] ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [givenLatest]);

  const empty = scenarios.length === 0;
  const unchanged = latest && !empty && !editedSince(scenarios, latest);

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (empty) return;
    const trimmed = comment.trim();
    if (!trimmed) return setFieldError("Describe what this version captures");
    setFieldError(null);
    setError(null);
    setBusy(true);
    try {
      onSaved(await versionsApi.create({ comment: trimmed }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const sample = forecasts ? [...forecasts.values()][0] : undefined;
  const totalLabel = sample?.length ? `Net revenue ${sample[0].year}–${sample[sample.length - 1].year}` : "Net revenue, all years";

  return (
    <Modal
      title="Save forecast version"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="save-version-form" className="btn btn--primary" disabled={busy || empty}>
            {busy ? "Saving…" : "Save version"}
          </button>
        </>
      }
    >
      <form id="save-version-form" className="stack" onSubmit={handleSubmit}>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <p className="modal__text">
          Freezes the current forecast: all {scenarios.length} {scenarios.length === 1 ? "scenario" : "scenarios"}, with
          their saved inputs and calculated results. The version is read-only; you can keep editing scenarios afterwards.
        </p>
        {empty && <ErrorBanner>There are no scenarios to save. Create a scenario first.</ErrorBanner>}
        {unchanged && (
          <p className="save-note" role="note">
            No scenario has been edited since version #{latest.id} ({formatDateTime(latest.created_at)}). You can still
            save, for example to record a review with a new comment.
          </p>
        )}
        <table className="save-preview" aria-label="Scenarios in this version">
          <thead>
            <tr>
              <th scope="col">Scenario</th>
              <th scope="col" className="num">
                {totalLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => {
              const years = forecasts?.get(s.id);
              return (
                <tr key={s.id}>
                  <th scope="row">
                    {colors.get(s.id) && <SeriesDot color={colors.get(s.id)!} />} {s.name}
                  </th>
                  <td className="num">
                    {years ? formatCurrencyCompact(years.reduce((sum, y) => sum + toNumber(y.net_revenue), 0)) : "…"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="field">
          <label className="field__label" htmlFor={`${fieldId}-comment`}>
            Comment
          </label>
          <textarea
            id={`${fieldId}-comment`}
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={COMMENT_MAX}
            placeholder="e.g. Q3 refresh after updated uptake assumptions"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? `${fieldId}-comment-error` : undefined}
            disabled={busy}
          />
          {fieldError && (
            <span id={`${fieldId}-comment-error`} className="field__error">
              {fieldError}
            </span>
          )}
        </div>
      </form>
    </Modal>
  );
}
