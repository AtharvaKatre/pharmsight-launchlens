import { Navigate, type RouteObject } from "react-router-dom";

import { RequireAuth } from "./auth/RequireAuth";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { LoginPage } from "./features/login/LoginPage";
import { ScenariosPage } from "./features/scenarios/ScenariosPage";
import { VersionsPage } from "./features/versions/VersionsPage";

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "scenarios", element: <ScenariosPage /> },
      { path: "versions", element: <VersionsPage /> },
      { path: "versions/:versionId", element: <VersionsPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
];
