import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authApi } from "../../api/auth";
import { ApiError } from "../../api/client";
import { AuthProvider } from "../../auth/AuthContext";
import { RequireAuth } from "../../auth/RequireAuth";
import { LoginPage } from "./LoginPage";

vi.mock("../../api/auth", () => ({ authApi: { login: vi.fn(), me: vi.fn() } }));

const FORECASTER = { id: 1, email: "forecaster@example.com", role: "FORECASTER" as const, created_at: "" };

function renderApp(initialPath = "/login") {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <LoginPage /> },
      {
        path: "/dashboard",
        element: (
          <RequireAuth>
            <p>Dashboard content</p>
          </RequireAuth>
        ),
      },
    ],
    { initialEntries: [initialPath] },
  );
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return router;
}

async function signIn(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

beforeEach(() => {
  vi.mocked(authApi.login).mockReset();
  vi.mocked(authApi.me).mockReset();
});

describe("LoginPage", () => {
  it("signs in, stores the token and redirects to the dashboard", async () => {
    vi.mocked(authApi.login).mockResolvedValue({ access_token: "token-123", token_type: "bearer" });
    vi.mocked(authApi.me).mockResolvedValue(FORECASTER);
    const router = renderApp();

    await signIn("forecaster@example.com", "Forecaster123!");

    expect(await screen.findByText("Dashboard content")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
    expect(authApi.login).toHaveBeenCalledWith("forecaster@example.com", "Forecaster123!");
    expect(localStorage.getItem("launchlens.token")).toBe("token-123");
  });

  it("shows the API error for wrong credentials and stays on the login page", async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(401, "Incorrect email or password"));
    renderApp();

    await signIn("forecaster@example.com", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(localStorage.getItem("launchlens.token")).toBeNull();
  });

  it("redirects unauthenticated visitors from protected pages to login", async () => {
    const router = renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("restores a stored session and skips the login page", async () => {
    localStorage.setItem("launchlens.token", "stored-token");
    vi.mocked(authApi.me).mockResolvedValue(FORECASTER);
    const router = renderApp("/login");

    expect(await screen.findByText("Dashboard content")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
  });
});
