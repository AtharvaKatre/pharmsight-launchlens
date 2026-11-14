import { NavLink, Outlet } from "react-router-dom";

import { ROLE_LABEL, useAuth } from "../auth/AuthContext";
import { WorkspaceProvider } from "../workspace/WorkspaceContext";
import { Icon, type IconName } from "./Icon";

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/scenarios", label: "Scenarios", icon: "scenarios" },
  { to: "/versions", label: "Version History", icon: "history" },
];

export function AppShell() {
  const { user, canEdit, logout } = useAuth();
  if (!user) return null;
  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <WorkspaceProvider>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand__mark">
              <svg viewBox="0 0 32 32" width="18" height="18" aria-hidden="true">
                <path d="M8 22l5-6 4 3 7-9" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>
              LaunchLens
              <small>Revenue Forecasting</small>
            </span>
          </div>
          <nav className="sidebar__nav" aria-label="Main">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className="sidebar__link">
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar__footer">
            <span className="muted">Forecast horizon</span>
            <strong>2027 – 2036</strong>
          </div>
        </aside>

        <div className="shell__main">
          <header className="topbar">
            <div className="topbar__title">Revenue Forecast Workspace</div>
            <div className="topbar__user">
              {!canEdit && (
                <span className="chip chip--muted" title="Brand Leads can view forecasts and comment, but not edit inputs.">
                  <Icon name="lock" size={14} /> View only
                </span>
              )}
              <span className="avatar" aria-hidden="true">
                {initials}
              </span>
              <span className="topbar__identity">
                <span className="topbar__email">{user.email}</span>
                <span className="topbar__role">{ROLE_LABEL[user.role]}</span>
              </span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={logout}>
                <Icon name="logout" size={16} /> Sign out
              </button>
            </div>
          </header>
          <main className="content">
            <Outlet />
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
