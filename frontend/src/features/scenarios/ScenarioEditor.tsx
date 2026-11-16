import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useBlocker } from "react-router-dom";

import { ApiError, errorMessage } from "../../api/client";
import { scenariosApi } from "../../api/scenarios";
import type { InputField, ScenarioDetail, YearInput } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Icon } from "../../components/Icon";
import { LoadingState } from "../../components/LoadingState";
import { Modal } from "../../components/Modal";
import { ScenarioBadge } from "../../components/ScenarioBadge";
import { fileSlug } from "../../lib/csv";
import { downloadCsv, readFileAsText } from "../../lib/download";
import { formatDateTime } from "../../lib/format";
import { useWorkspace } from "../../workspace/WorkspaceContext";
import { INPUT_CSV_COLUMNS, inputsToCsv, parseInputsCsv } from "./csvInputs";
import { cellKey, cellLabel, INPUT_FIELDS } from "./fields";
import { InputGrid } from "./InputGrid";
import { ScenarioDialog, type ScenarioDialogValues } from "./ScenarioDialog";
import { mapServerIssues, NO_SERVER_ERRORS, sameValue, toPayloadYear, validateYears, type ServerErrors } from "./validation";

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
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<{ file: string; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setImportNotice(null);
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
    setImportNotice(null);
  }

  function handleExport() {
    if (!detail) return;
    downloadCsv(`${fileSlug(detail.name)}-inputs.csv`, inputsToCsv(detail.years));
  }

  // The whole file is validated first; only a fully valid file replaces the draft. Nothing is saved
  // until the user reviews the highlighted cells and clicks Save (which the API restricts to Forecasters).
  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !detail || !canEdit) return;

    let text: string;
    try {
      text = await readFileAsText(file);
    } catch (err) {
      setImportErrors({ file: file.name, errors: [errorMessage(err)] });
      return;
    }
    const parsed = parseInputsCsv(text, detail.years.map((y) => y.year));
    if (!parsed.ok) {
      setImportErrors({ file: file.name, errors: parsed.errors });
      return;
    }
    // Spreadsheet apps rewrite numbers (Excel saves "2020000.00" as "2020000"). Where the imported
    // value is the same number as the saved one, keep the saved text so nothing is rewritten.
    const imported = parsed.years.map((year, i) => {
      const saved = detail.years[i];
      const merged = { ...year };
      for (const field of INPUT_FIELDS) {
        if (saved && sameValue(year[field.key], saved[field.key])) merged[field.key] = saved[field.key];
      }
      return merged;
    });
    const changes = countChanges(imported, detail.years);
    setDraft(imported);
    setServerErrors(NO_SERVER_ERRORS);
    setSaveError(null);
    setSavedAt(null);
    setImportNotice(
      changes === 0
        ? `${file.name} matches the saved inputs — nothing to change.`
        : `Imported ${file.name}: ${changes} ${changes === 1 ? "value differs" : "values differ"} from the saved inputs. Review the highlighted cells, then save.`,
    );
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
        <div className="editor__actions">
          {canEdit && (
            <>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileInputRef.current?.click()}>
                <Icon name="upload" size={16} /> Import CSV
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                tabIndex={-1}
                aria-label="Import inputs CSV file"
                onChange={handleImportFile}
              />
            </>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleExport}
            title={dirty ? "Exports the saved inputs (unsaved edits are not included)" : undefined}
          >
            <Icon name="download" size={16} /> Export CSV
          </button>
          {canEdit && (
            <>
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
            </>
          )}
        </div>
      </header>

      {importNotice && (
        <div className="banner banner--info" role="status">
          <Icon name="upload" size={16} />
          <span className="banner__body">{importNotice}</span>
          <button type="button" className="icon-btn" onClick={() => setImportNotice(null)} aria-label="Dismiss">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

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
      {importErrors && (
        <Modal
          title="CSV not imported"
          onClose={() => setImportErrors(null)}
          footer={
            <button type="button" className="btn btn--primary" onClick={() => setImportErrors(null)}>
              OK
            </button>
          }
        >
          <p className="modal__text">
            <strong>{importErrors.file}</strong> has {importErrors.errors.length}{" "}
            {importErrors.errors.length === 1 ? "problem" : "problems"}. No changes were applied.
          </p>
          <ul className="import-errors">
            {importErrors.errors.slice(0, 12).map((e) => (
              <li key={e}>{e}</li>
            ))}
            {importErrors.errors.length > 12 && <li className="muted">…and {importErrors.errors.length - 12} more</li>}
          </ul>
          <p className="muted">
            Expected columns: <code>{INPUT_CSV_COLUMNS.join(", ")}</code>, one row per calendar year from 2027 (launch year 1) to
            2036 (year 10). Tip: use Export CSV to get a correctly formatted file.
          </p>
        </Modal>
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
  // Numeric comparison: "2020000" and "2020000.00" are the same value, not a change.
  draft.forEach((year, i) => {
    for (const field of INPUT_FIELDS) {
      if (!sameValue(year[field.key], saved[i]?.[field.key])) count++;
    }
  });
  return count;
}
