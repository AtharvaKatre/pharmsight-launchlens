import type { VersionSummary } from "../../api/types";
import { ROLE_LABEL } from "../../auth/AuthContext";
import { formatDateTime } from "../../lib/format";

interface VersionListProps {
  versions: VersionSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function VersionList({ versions, selectedId, onSelect }: VersionListProps) {
  return (
    <nav aria-label="Saved versions">
      <h3 className="eyebrow version-list__title">
        Saved versions <span className="count">{versions.length}</span>
      </h3>
      <ul className="version-list">
        {versions.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              className="version-list__item"
              aria-current={v.id === selectedId ? "true" : undefined}
              onClick={() => onSelect(v.id)}
            >
              <span className="version-list__row">
                <span className="version-list__id">#{v.id}</span>
                <span className="version-list__date">{formatDateTime(v.created_at)}</span>
              </span>
              <span className={v.comment ? "version-list__comment" : "version-list__comment muted"}>
                {v.comment ?? "No comment"}
              </span>
              <span className="version-list__author">
                {v.author.email} · {ROLE_LABEL[v.author.role]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
