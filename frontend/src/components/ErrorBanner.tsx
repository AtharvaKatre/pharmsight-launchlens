import type { ReactNode } from "react";

import { Icon } from "./Icon";

interface ErrorBannerProps {
  title?: string;
  children: ReactNode;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({ title, children, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div className="banner banner--error" role="alert">
      <Icon name="alert" />
      <div className="banner__body">
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
      {onRetry && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          Try again
        </button>
      )}
      {onDismiss && (
        <button type="button" className="icon-btn" onClick={onDismiss} aria-label="Dismiss">
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
