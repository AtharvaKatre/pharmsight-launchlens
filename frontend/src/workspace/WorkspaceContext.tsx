import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { errorMessage } from "../api/client";
import { scenariosApi } from "../api/scenarios";
import type { ScenarioSummary } from "../api/types";
import { scenarioColors, scenarioKind, sortScenarios } from "../lib/scenarioKind";

const ACTIVE_KEY = "pharmsight.activeScenario";

export interface WorkspaceContextValue {
  /** Sorted: Base, Upside, Downside, then custom scenarios. */
  scenarios: ScenarioSummary[];
  status: "loading" | "ready" | "error";
  error: string | null;
  reload: () => Promise<void>;
  activeScenarioId: number | null;
  setActiveScenarioId: (id: number) => void;
  colors: Map<number, string>;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readStoredActive(): number | null {
  try {
    const value = Number(localStorage.getItem(ACTIVE_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function resolveActive(scenarios: ScenarioSummary[], preferred: number | null): number | null {
  if (preferred !== null && scenarios.some((s) => s.id === preferred)) return preferred;
  return (scenarios.find((s) => scenarioKind(s.name) === "base") ?? scenarios[0])?.id ?? null;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [status, setStatus] = useState<WorkspaceContextValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [activeScenarioId, setActive] = useState<number | null>(readStoredActive);

  const setActiveScenarioId = useCallback((id: number) => {
    setActive(id);
    try {
      localStorage.setItem(ACTIVE_KEY, String(id));
    } catch {
      // Non-essential preference.
    }
  }, []);

  const reload = useCallback(async () => {
    try {
      const list = sortScenarios(await scenariosApi.list());
      setScenarios(list);
      setActive((current) => resolveActive(list, current));
      setError(null);
      setStatus("ready");
    } catch (err) {
      setError(errorMessage(err));
      setStatus((current) => (current === "ready" ? "ready" : "error"));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const colors = useMemo(() => scenarioColors(scenarios), [scenarios]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({ scenarios, status, error, reload, activeScenarioId, setActiveScenarioId, colors }),
    [scenarios, status, error, reload, activeScenarioId, setActiveScenarioId, colors],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return value;
}
