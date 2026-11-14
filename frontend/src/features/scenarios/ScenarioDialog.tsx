import { useId, useState, type FormEvent } from "react";

import { ApiError, errorMessage } from "../../api/client";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Modal } from "../../components/Modal";

export type ScenarioDialogMode = "create" | "rename" | "clone";

export interface ScenarioDialogValues {
  name: string;
  description: string | null;
}

interface ScenarioDialogProps {
  mode: ScenarioDialogMode;
  initialName?: string;
  initialDescription?: string | null;
  sourceName?: string;
  onSubmit: (values: ScenarioDialogValues) => Promise<void>;
  onClose: () => void;
}

const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;

const COPY: Record<ScenarioDialogMode, { title: string; submit: string }> = {
  create: { title: "New scenario", submit: "Create scenario" },
  rename: { title: "Edit scenario details", submit: "Save details" },
  clone: { title: "Clone scenario", submit: "Create copy" },
};

export function ScenarioDialog({
  mode,
  initialName = "",
  initialDescription = null,
  sourceName,
  onSubmit,
  onClose,
}: ScenarioDialogProps) {
  const fieldId = useId();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const showDescription = mode !== "clone"; // the clone endpoint copies the source description

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setNameError("Enter a scenario name");
    if (trimmed.length > NAME_MAX) return setNameError(`Use ${NAME_MAX} characters or fewer`);
    setNameError(null);
    setError(null);
    setBusy(true);
    try {
      await onSubmit({ name: trimmed, description: description.trim() || null });
    } catch (err) {
      const nameIssue = err instanceof ApiError ? err.issues.find((i) => i.loc.includes("name")) : undefined;
      if (nameIssue) setNameError(nameIssue.msg);
      else setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={COPY[mode].title}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="scenario-dialog-form" className="btn btn--primary" disabled={busy}>
            {busy ? "Saving…" : COPY[mode].submit}
          </button>
        </>
      }
    >
      <form id="scenario-dialog-form" className="stack" onSubmit={handleSubmit}>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        {mode === "create" && (
          <p className="modal__text">The new scenario starts from the Base case assumptions for all ten years.</p>
        )}
        {mode === "clone" && sourceName && (
          <p className="modal__text">
            Creates an independent copy of <strong>{sourceName}</strong>, including all ten years of inputs.
          </p>
        )}
        <div className="field">
          <label className="field__label" htmlFor={`${fieldId}-name`}>
            Name
          </label>
          <input
            id={`${fieldId}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX + 50}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${fieldId}-name-error` : undefined}
            disabled={busy}
          />
          {nameError && (
            <span id={`${fieldId}-name-error`} className="field__error">
              {nameError}
            </span>
          )}
        </div>
        {showDescription && (
          <label className="field">
            <span className="field__label">
              Description <span className="muted">(optional)</span>
            </span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={DESCRIPTION_MAX}
              disabled={busy}
            />
          </label>
        )}
      </form>
    </Modal>
  );
}
