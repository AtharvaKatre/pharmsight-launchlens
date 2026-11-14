import { useId, useState, type FormEvent } from "react";

import { errorMessage } from "../../api/client";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Modal } from "../../components/Modal";

const COMMENT_MAX = 2000;

interface SaveVersionDialogProps {
  scenarioCount: number;
  onSubmit: (comment: string) => Promise<void>;
  onClose: () => void;
}

export function SaveVersionDialog({ scenarioCount, onSubmit, onClose }: SaveVersionDialogProps) {
  const fieldId = useId();
  const [comment, setComment] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = comment.trim();
    if (!trimmed) return setFieldError("Describe what this version captures");
    setFieldError(null);
    setError(null);
    setBusy(true);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

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
          <button type="submit" form="save-version-form" className="btn btn--primary" disabled={busy}>
            {busy ? "Saving…" : "Save version"}
          </button>
        </>
      }
    >
      <form id="save-version-form" className="stack" onSubmit={handleSubmit}>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <p className="modal__text">
          Saves a read-only snapshot of all {scenarioCount} {scenarioCount === 1 ? "scenario" : "scenarios"}, with their
          inputs and calculated results as currently saved. Unsaved edits in the input grid are not included.
        </p>
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
