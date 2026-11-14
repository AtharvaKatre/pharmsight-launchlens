import { apiRequest } from "./client";
import type {
  ScenarioClone,
  ScenarioCreate,
  ScenarioDetail,
  ScenarioForecast,
  ScenarioSummary,
  ScenarioUpdate,
} from "./types";

export const scenariosApi = {
  list: () => apiRequest<ScenarioSummary[]>("/scenarios"),
  get: (id: number) => apiRequest<ScenarioDetail>(`/scenarios/${id}`),
  create: (body: ScenarioCreate) => apiRequest<ScenarioDetail>("/scenarios", { method: "POST", body }),
  update: (id: number, body: ScenarioUpdate) =>
    apiRequest<ScenarioDetail>(`/scenarios/${id}`, { method: "PUT", body }),
  remove: (id: number) => apiRequest<void>(`/scenarios/${id}`, { method: "DELETE" }),
  clone: (id: number, body: ScenarioClone = {}) =>
    apiRequest<ScenarioDetail>(`/scenarios/${id}/clone`, { method: "POST", body }),
  forecast: (id: number) => apiRequest<ScenarioForecast>(`/scenarios/${id}/forecast`),
};
