import { apiRequest } from "./client";
import type { VersionComment, VersionCreate, VersionDetail, VersionSummary } from "./types";

export const versionsApi = {
  list: () => apiRequest<VersionSummary[]>("/versions"),
  get: (id: number) => apiRequest<VersionDetail>(`/versions/${id}`),
  create: (body: VersionCreate) => apiRequest<VersionDetail>("/versions", { method: "POST", body }),
  comments: (id: number) => apiRequest<VersionComment[]>(`/versions/${id}/comments`),
  addComment: (id: number, content: string) =>
    apiRequest<VersionComment>(`/versions/${id}/comments`, { method: "POST", body: { content } }),
};
