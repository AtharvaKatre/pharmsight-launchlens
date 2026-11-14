import { useEffect, useMemo, useState } from "react";
import { useBlocker } from "react-router-dom";

import { ApiError, errorMessage } from "../../api/client";
import { scenariosApi } from "../../api/scenarios";
import type { InputField, ScenarioDetail, YearInput } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Icon } from "../../components/Icon";
import { LoadingState } from "../../components/LoadingState";
import { ScenarioBadge } from "../../components/ScenarioBadge";
import { formatDateTime } from "../../lib/format";
import { useWorkspace } from "../../workspace/WorkspaceContext";
import { cellKey, cellLabel, INPUT_FIELDS } from "./fields";
import { InputGrid } from "./InputGrid";
import { ScenarioDialog, type ScenarioDialogValues } from "./ScenarioDialog";
import { mapServerIssues, NO_SERVER_ERRORS, toPayloadYear, validateYears, type ServerErrors } from "./validation";

interface ScenarioEditorProps {
  scenarioId: number;
  onDirtyChange?: (dirty: boolean) => void;
}

type Dialog = "rename" | "clone" | "delete" | null;

export function ScenarioEditor({ scenarioId, onDirtyChange }: ScenarioEditorProps) {
  const { canEdit } = useAuth();
  const { reload, setActiveScenarioId, colors } = useWorkspace();

  const [detail, setDetail] = useState<ScenarioDetail | null>(null);
  const [draft, setDraft] = useState<YearInput[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [serverErrors, setServerErrors] = useState<ServerErrors>(NO_SERVER_ERRORS);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setLoadError(null);
    scenariosApi
      .get(scenarioId)
      .then((loaded) => {
        if (cancelled) return;
        setDetail(loaded);
        setDraft(loaded.years);
        setServerErrors(NO_SERVER_ERRORS);
        setSaveError(null);
        setSavedAt(null);
      })
      .catch((err) => !cancelled && setLoadError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [scenarioId, reloadToken]);

  const clientErrors = useMemo(() => validateYears(draft), [draft]);
  const cellErrors = useMemo(() => ({ ...serverErrors.cells, ...clientErrors }), [serverErrors, clientErrors]);
  const changedCount = useMemo(() => countChanges(draft, detail?.years ?? []), [draft, detail]);
  const dirty = changedCount > 0;
  const errorCount = Object.keys(cellErrors).length;

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  // Guard against losing edits: in-app navigation and closing the tab.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (loadError) {
    return (
      <ErrorBanner title="Couldn't load this scenario" onRetry={() => setReloadToken((t) => t + 1)}>
        {loadError}
      </ErrorBanner>
    );
  }
  if (!detail) return <LoadingState label="Loading scenario inputs…" />;

  function handleChange(yearIndex: number, field: InputField, value: string) {
    setDraft((current) => current.map((y, i) => (i === yearIndex ? { ...y, [field]: value } : y)));
    setSavedAt(null);
    const key = cellKey(draft[yearIndex].year, field);
    if (serverErrors.cells[key]) {
      setServerErrors((current) => {
        const cells = { ...current.cells };
        delete cells[key];
        return { ...current, cells };
      });
    }
  }

  async function handleSave() {
    if (!detail || Object.keys(clientErrors).length > 0) return;
    setSaving(true);
    setSaveError(null);
    const years = draft.map(toPayloadYear);
    try {
      const updated = await scenariosApi.update(detail.id, { name: detail.name, description: detail.description, years });
      setDetail(updated);
      setDraft(updated.years);
      setServerErrors(NO_SERVER_ERRORS);
      setSavedAt(updated.updated_at);
      void reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const mapped = mapServerIssues(err.issues, years.map((y) => y.year));
        setServerErrors(mapped);
        setSaveError(mapped.general.length ? mapped.general.join(" ") : err.message);
      } else {
        setSaveError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (!detail) return;
    setDraft(detail.years);
    setServerErrors(NO_SERVER_ERRORS);
    setSaveError(null);
  }

  // Renaming sends the last *saved* inputs so unsaved grid edits are never saved implicitly.
  async function handleRename({ name, description }: ScenarioDialogValues) {
    if (!detail) return;
    const updated = await scenariosApi.update(detail.id, { name, description, years: detail.years });
    setDetail(updated);
    setDialog(null);
    void reload();
  }

  async function handleClone({ name }: ScenarioDialogValues) {
    if (!detail) return;
    const clone = await scenariosApi.clone(detail.id, { name });
    setDialog(null);
    await reload();
    setActiveScenarioId(clone.id);
  }

  async function handleDelete() {
    if (!detail) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await scenariosApi.remove(detail.id);
      onDirtyChange?.(false);
      await reload();
    } catch (err) {
      setDeleteError(errorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <section className="editor card" aria-labelledby="editor-title">
      <header className="editor__header">
        <div className="editor__heading">
          <div className="editor__title-row">
            <span className="series-dot series-dot--lg" style={{ background: colors.get(detail.id) }} aria-hidden="true" />
            <h2 id="editor-title">{detail.name}</h2>
            <ScenarioBadge name={detail.name} />
          </div>
          {detail.description && <p className="editor__description">{detail.description}</p>}
          <p className="editor__meta">Last updated {formatDateTime(detail.updated_at)}</p>
        </div>
        {canEdit && (
          <div className="editor__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDialog("rename")}>
              <Icon name="edit" size={16} /> Rename
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setDialog("clone")}
              disabled={dirty}
              title={dirty ? "Save or discard your changes before cloning" : undefined}
            >
              <Icon name="copy" size={16} /> Clone
            </button>
            <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={() => setDialog("delete")}>
              <Icon name="trash" size={16} /> Delete
            </button>
          </div>
        )}
      </header>

      {!canEdit && (
        <div className="banner banner--info">
          <Icon name="lock" size={16} />
          <span>You have view-only access. Forecasters can edit and save scenario inputs.</span>
        </div>
      )}
      {saveError && (
        <ErrorBanner title="Changes not saved" onDismiss={() => setSaveError(null)}>
          {saveError}
        </ErrorBanner>
      )}

      <InputGrid years={draft} saved={detail.years} errors={cellErrors} readOnly={!canEdit} onChange={handleChange} />

      {errorCount > 0 && <GridErrorList errors={cellErrors} />}

      {canEdit && (
        <footer className="editor__savebar" aria-live="polite">
          <span className="editor__status">
            {errorCount > 0 ? (
              <span className="text-danger">
                {errorCount} {errorCount === 1 ? "value needs" : "values need"} attention
              </span>
            ) : dirty ? (
              <span>
                <span className="status-dot status-dot--pending" /> {changedCount} unsaved {changedCount === 1 ? "change" : "changes"}
              </span>
            ) : savedAt ? (
              <span>
                <Icon name="check" size={14} /> All changes saved
              </span>
            ) : (
              <span className="muted">Edit any cell, then save. Percentages are entered as 0–100.</span>
            )}
          </span>
          <span className="editor__savebar-actions">
            <button type="button" className="btn btn--ghost" onClick={handleDiscard} disabled={!dirty || saving}>
              Discard
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSave} disabled={!dirty || saving || errorCount > 0}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </span>
        </footer>
      )}

      {dialog === "rename" && (
        <ScenarioDialog
          mode="rename"
          initialName={detail.name}
          initialDescription={detail.description}
          onSubmit={handleRename}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "clone" && (
        <ScenarioDialog
          mode="clone"
          initialName={`${detail.name} (copy)`}
          sourceName={detail.name}
          onSubmit={handleClone}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          title="Delete scenario?"
          confirmLabel="Delete scenario"
          tone="danger"
          busy={deleting}
          error={deleteError}
          onConfirm={handleDelete}
          onCancel={() => {
            setDialog(null);
            setDeleteError(null);
          }}
        >
          <p>
            <strong>{detail.name}</strong> and all ten years of its inputs will be permanently deleted.
          </p>
          <p className="muted">Previously saved forecast versions are not affected.</p>
        </ConfirmDialog>
      )}
      {blocker.state === "blocked" && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          confirmLabel="Discard and leave"
          tone="danger"
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        >
          <p>
            You have {changedCount} unsaved {changedCount === 1 ? "change" : "changes"} to <strong>{detail.name}</strong>.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}

const MAX_LISTED_ERRORS = 8;

function GridErrorList({ errors }: { errors: Record<string, string> }) {
  const fieldOrder = (key: string) => INPUT_FIELDS.findIndex((f) => key.endsWith(`:${f.key}`));
  const entries = Object.entries(errors).sort(([a], [b]) => fieldOrder(a) - fieldOrder(b) || a.localeCompare(b));
  const hidden = entries.length - MAX_LISTED_ERRORS;
  return (
    <div className="grid-errors">
      <strong>Fix these values before saving:</strong>
      <ul>
        {entries.slice(0, MAX_LISTED_ERRORS).map(([key, message]) => (
          <li key={key}>
            <span className="grid-errors__cell">{cellLabel(key)}</span> — {message}
          </li>
        ))}
        {hidden > 0 && <li className="muted">…and {hidden} more</li>}
      </ul>
    </div>
  );
}

function countChanges(draft: YearInput[], saved: YearInput[]): number {
  let count = 0;
  draft.forEach((year, i) => {
    for (const key of Object.keys(year) as (keyof YearInput)[]) {
      if (key !== "year" && year[key] !== saved[i]?.[key]) count++;
    }
  });
  return count;
}
