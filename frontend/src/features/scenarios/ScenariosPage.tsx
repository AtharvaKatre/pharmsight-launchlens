import { useCallback, useState } from "react";

import { scenariosApi } from "../../api/scenarios";
import { useAuth } from "../../auth/AuthContext";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Icon } from "../../components/Icon";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { useWorkspace } from "../../workspace/WorkspaceContext";
import { ScenarioDialog, type ScenarioDialogValues } from "./ScenarioDialog";
import { ScenarioEditor } from "./ScenarioEditor";
import { ScenarioList } from "./ScenarioList";
import "./scenarios.css";

export function ScenariosPage() {
  const { canEdit } = useAuth();
  const { scenarios, status, error, reload, activeScenarioId, setActiveScenarioId, colors } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<number | null>(null);
  const handleDirtyChange = useCallback((dirty: boolean) => setEditorDirty(dirty), []);

  function select(id: number) {
    if (id === activeScenarioId) return;
    if (editorDirty) setPendingSelection(id);
    else setActiveScenarioId(id);
  }

  async function handleCreate({ name, description }: ScenarioDialogValues) {
    const created = await scenariosApi.create({ name, description });
    setCreating(false);
    await reload();
    setActiveScenarioId(created.id);
  }

  return (
    <>
      <PageHeader
        title="Scenarios"
        subtitle="Manage forecast scenarios and edit their annual assumptions for 2027–2036."
        actions={
          canEdit && (
            <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16} /> New scenario
            </button>
          )
        }
      />

      {status === "loading" && <LoadingState label="Loading scenarios…" />}
      {status === "error" && (
        <ErrorBanner title="Couldn't load scenarios" onRetry={() => void reload()}>
          {error}
        </ErrorBanner>
      )}

      {status === "ready" && scenarios.length === 0 && (
        <div className="card empty-state">
          <h2>No scenarios yet</h2>
          <p className="muted">{canEdit ? "Create a scenario to start forecasting." : "A Forecaster hasn't created any scenarios yet."}</p>
        </div>
      )}

      {status === "ready" && scenarios.length > 0 && (
        <div className="scenarios-layout">
          <aside className="card scenarios-layout__list">
            <ScenarioList scenarios={scenarios} activeId={activeScenarioId} colors={colors} onSelect={select} />
          </aside>
          <div className="scenarios-layout__editor">
            {activeScenarioId !== null && (
              <ScenarioEditor key={activeScenarioId} scenarioId={activeScenarioId} onDirtyChange={handleDirtyChange} />
            )}
          </div>
        </div>
      )}

      {creating && <ScenarioDialog mode="create" onSubmit={handleCreate} onClose={() => setCreating(false)} />}
      {pendingSelection !== null && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          confirmLabel="Discard and switch"
          tone="danger"
          onConfirm={() => {
            setEditorDirty(false);
            setActiveScenarioId(pendingSelection);
            setPendingSelection(null);
          }}
          onCancel={() => setPendingSelection(null)}
        >
          <p>Your edits to the current scenario haven't been saved and will be lost.</p>
        </ConfirmDialog>
      )}
    </>
  );
}
