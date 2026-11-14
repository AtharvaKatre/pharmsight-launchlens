import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { vi } from "vitest";

import type { Role } from "../api/types";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import { WorkspaceProvider } from "../workspace/WorkspaceContext";

interface RenderOptions {
  /** Route patterns that render `ui` (default: just "/"). */
  paths?: string[];
  initialEntry?: string;
}

export const TEST_USERS = {
  FORECASTER: { id: 1, email: "forecaster@example.com", role: "FORECASTER" as const, created_at: "" },
  BRAND_LEAD: { id: 2, email: "brandlead@example.com", role: "BRAND_LEAD" as const, created_at: "" },
};

/** Render a page as a signed-in user, inside a data router and the real WorkspaceProvider. */
export function renderAsUser(ui: ReactElement, role: Role = "FORECASTER", { paths = ["/"], initialEntry }: RenderOptions = {}) {
  const auth: AuthContextValue = {
    status: "authenticated",
    user: TEST_USERS[role],
    canEdit: role === "FORECASTER",
    sessionExpired: false,
    login: vi.fn(),
    logout: vi.fn(),
  };
  const router = createMemoryRouter(
    [
      ...paths.map((path) => ({ path, element: <WorkspaceProvider>{ui}</WorkspaceProvider> })),
      { path: "/elsewhere", element: <p>Elsewhere</p> },
    ],
    { initialEntries: [initialEntry ?? paths[0]] },
  );
  return {
    ...render(
      <AuthContext.Provider value={auth}>
        <RouterProvider router={router} />
      </AuthContext.Provider>,
    ),
    router,
  };
}
