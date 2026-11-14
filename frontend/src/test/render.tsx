import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { vi } from "vitest";

import type { Role } from "../api/types";
import { AuthContext, type AuthContextValue } from "../auth/AuthContext";
import { WorkspaceProvider } from "../workspace/WorkspaceContext";

/** Render a page as a signed-in user, inside a data router and the real WorkspaceProvider. */
export function renderAsUser(ui: ReactElement, role: Role = "FORECASTER") {
  const auth: AuthContextValue = {
    status: "authenticated",
    user: { id: role === "FORECASTER" ? 1 : 2, email: `${role.toLowerCase()}@example.com`, role, created_at: "" },
    canEdit: role === "FORECASTER",
    sessionExpired: false,
    login: vi.fn(),
    logout: vi.fn(),
  };
  const router = createMemoryRouter(
    [
      { path: "/", element: <WorkspaceProvider>{ui}</WorkspaceProvider> },
      { path: "/elsewhere", element: <p>Elsewhere</p> },
    ],
    { initialEntries: ["/"] },
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
