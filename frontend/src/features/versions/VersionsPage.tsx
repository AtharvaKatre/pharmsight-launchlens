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
import { CurrentForecastCard } from "./CurrentForecastCard";
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

  async function handleSaved(created: VersionSummary) {
    setSaving(false);
    await load();
    navigate(`/versions/${created.id}`);
  }

  return (
    <>
      <PageHeader
        title="Version History"
        subtitle="Read-only snapshots of the whole forecast. Viewing a version never changes your current scenarios."
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
              ? "Save a version to freeze the current forecast: every scenario's inputs and results, with a comment."
              : "A Forecaster hasn't saved a forecast version yet."}
          </p>
          {canEdit && (
            <button type="button" className="btn btn--primary" onClick={() => setSaving(true)}>
              <Icon name="check" size={16} /> Save current forecast as version
            </button>
          )}
        </div>
      )}

      {versions && versions.length > 0 && (
        <div className="versions-layout">
          <aside className="card versions-layout__list">
            <CurrentForecastCard scenarios={scenarios} latest={versions[0]} canSave={canEdit} onSave={() => setSaving(true)} />
            <VersionList versions={versions} selectedId={selectedId} onSelect={(id) => navigate(`/versions/${id}`)} />
          </aside>
          <div className="versions-layout__detail">
            {selectedId !== null && <VersionDetailView key={selectedId} versionId={selectedId} />}
          </div>
        </div>
      )}

      {saving && <SaveVersionDialog onSaved={(created) => void handleSaved(created)} onClose={() => setSaving(false)} />}
    </>
  );
}
