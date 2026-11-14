import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { errorMessage } from "../../api/client";
import type { VersionSummary } from "../../api/types";
import { versionsApi } from "../../api/versions";
import { useAuth } from "../../auth/AuthContext";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Icon } from "../../components/Icon";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { useWorkspace } from "../../workspace/WorkspaceContext";
import { SaveVersionDialog } from "./SaveVersionDialog";
import { VersionDetailView } from "./VersionDetailView";
import { VersionList } from "./VersionList";
import "../dashboard/dashboard.css";
import "../scenarios/scenarios.css";
import "./versions.css";

export function VersionsPage() {
  const { canEdit } = useAuth();
  const { scenarios } = useWorkspace();
  const { versionId } = useParams();
  const navigate = useNavigate();
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedId = versionId !== undefined ? Number(versionId) : null;

  const load = useCallback(async () => {
    try {
      setVersions(await versionsApi.list());
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Open the most recent version when none is selected.
  useEffect(() => {
    if (selectedId === null && versions?.length) navigate(`/versions/${versions[0].id}`, { replace: true });
  }, [selectedId, versions, navigate]);

  async function handleSave(comment: string) {
    const created = await versionsApi.create({ comment });
    setSaving(false);
    await load();
    navigate(`/versions/${created.id}`);
  }

  return (
    <>
      <PageHeader
        title="Version History"
        subtitle="Saved, read-only snapshots of every scenario's inputs and calculated results."
        actions={
          canEdit && (
            <button type="button" className="btn btn--primary" onClick={() => setSaving(true)}>
              <Icon name="check" size={16} /> Save version
            </button>
          )
        }
      />

      {error && (
        <ErrorBanner title="Couldn't load versions" onRetry={() => void load()}>
          {error}
        </ErrorBanner>
      )}
      {versions === null && !error && <LoadingState label="Loading versions…" />}

      {versions?.length === 0 && (
        <div className="card empty-state">
          <span className="empty-state__icon">
            <Icon name="history" size={22} />
          </span>
          <h2>No versions saved yet</h2>
          <p className="muted">
            {canEdit
              ? "Save a version to record the current scenarios, their inputs and results, with a comment."
              : "A Forecaster hasn't saved a forecast version yet."}
          </p>
        </div>
      )}

      {versions && versions.length > 0 && (
        <div className="versions-layout">
          <aside className="card versions-layout__list">
            <VersionList versions={versions} selectedId={selectedId} onSelect={(id) => navigate(`/versions/${id}`)} />
          </aside>
          <div className="versions-layout__detail">
            {selectedId !== null && <VersionDetailView key={selectedId} versionId={selectedId} />}
          </div>
        </div>
      )}

      {saving && (
        <SaveVersionDialog scenarioCount={scenarios.length} onSubmit={handleSave} onClose={() => setSaving(false)} />
      )}
    </>
  );
}
