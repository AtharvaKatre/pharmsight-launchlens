import { useEffect, useState, type FormEvent } from "react";

import { errorMessage } from "../../api/client";
import type { VersionComment } from "../../api/types";
import { versionsApi } from "../../api/versions";
import { ROLE_LABEL, useAuth } from "../../auth/AuthContext";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingState } from "../../components/LoadingState";
import { formatDateTime } from "../../lib/format";

const CONTENT_MAX = 5000;

export function CommentsPanel({ versionId }: { versionId: number }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<VersionComment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    versionsApi
      .comments(versionId)
      .then((list) => !cancelled && setComments(list))
      .catch((err) => !cancelled && setLoadError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [versionId, reloadToken]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return setPostError("Write a comment first.");
    setPosting(true);
    setPostError(null);
    try {
      const created = await versionsApi.addComment(versionId, content);
      setComments((current) => [...(current ?? []), created]);
      setDraft("");
    } catch (err) {
      setPostError(errorMessage(err));
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="card comments" aria-labelledby="comments-title">
      <header className="card__header">
        <h2 id="comments-title">
          Comments {comments && <span className="count">{comments.length}</span>}
        </h2>
      </header>

      {loadError && (
        <ErrorBanner
          title="Couldn't load comments"
          onRetry={() => {
            setLoadError(null);
            setReloadToken((t) => t + 1);
          }}
        >
          {loadError}
        </ErrorBanner>
      )}
      {comments === null && !loadError && <LoadingState label="Loading comments…" />}

      {comments?.length === 0 && (
        <p className="muted">No comments yet. Brand Leads and Forecasters can discuss this version here.</p>
      )}
      {comments && comments.length > 0 && (
        <ol className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment">
              <span className="avatar avatar--sm" aria-hidden="true">
                {c.author.email.slice(0, 2).toUpperCase()}
              </span>
              <div className="comment__body">
                <div className="comment__meta">
                  <strong>{c.author.email}</strong>
                  {c.author.id === user?.id && <span className="muted"> (you)</span>}
                  <span className="chip chip--muted chip--xs">{ROLE_LABEL[c.author.role]}</span>
                  <span className="muted comment__time">{formatDateTime(c.created_at)}</span>
                </div>
                <p className="comment__content">{c.content}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form className="comment-form" onSubmit={handleSubmit}>
        {postError && <ErrorBanner>{postError}</ErrorBanner>}
        <label className="field">
          <span className="field__label">Add a comment</span>
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={CONTENT_MAX}
            placeholder="Share feedback on the assumptions or results in this version"
            disabled={posting}
          />
        </label>
        <div className="comment-form__actions">
          <button type="submit" className="btn btn--primary" disabled={posting}>
            {posting ? "Posting…" : "Post comment"}
          </button>
        </div>
      </form>
    </section>
  );
}
