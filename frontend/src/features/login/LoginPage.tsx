import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { errorMessage } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingState } from "../../components/LoadingState";

export function LoginPage() {
  const { status, login, sessionExpired } = useAuth();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "loading") return <LoadingState label="Restoring your session…" fullPage />;
  if (status === "authenticated") return <Navigate to={redirectTo} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <section className="login__brand" aria-hidden="true">
        <div className="brand brand--inverse">
          <span className="brand__mark">
            <svg viewBox="0 0 32 32" width="22" height="22">
              <path d="M8 22l5-6 4 3 7-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          LaunchLens
        </div>
        <div className="login__pitch">
          <h2>Revenue forecasting for specialty brands</h2>
          <p>Model the patient funnel from prevalence to net revenue, compare scenarios side by side and keep every saved forecast on record.</p>
          <ul>
            <li>Ten-year patient-based forecasts</li>
            <li>Base, Upside and Downside scenarios</li>
            <li>Role-based access for forecasters and brand leads</li>
          </ul>
        </div>
        <p className="login__footnote">Forecast horizon 2027–2036</p>
      </section>

      <section className="login__panel">
        <form className="login__form" onSubmit={handleSubmit} noValidate={false}>
          <h1>Sign in</h1>
          <p className="muted">Use your LaunchLens account to continue.</p>

          {sessionExpired && !error && (
            <div className="banner banner--info" role="status">
              Your session has expired. Please sign in again.
            </div>
          )}
          {error && <ErrorBanner>{error}</ErrorBanner>}

          <label className="field">
            <span className="field__label">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </label>
          <label className="field">
            <span className="field__label">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </label>

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === "true") && (
            <details className="login__demo">
              <summary>Demo accounts</summary>
              <dl>
                <dt>Forecaster</dt>
                <dd>forecaster@example.com · Forecaster123!</dd>
                <dt>Brand Lead</dt>
                <dd>brandlead@example.com · BrandLead123!</dd>
              </dl>
            </details>
          )}
        </form>
      </section>
    </div>
  );
}
