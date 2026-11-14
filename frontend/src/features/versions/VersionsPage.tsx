import { Icon } from "../../components/Icon";
import { PageHeader } from "../../components/PageHeader";

/** Navigation placeholder: saved versions and comments are delivered in the next phase. */
export function VersionsPage() {
  return (
    <>
      <PageHeader title="Version History" subtitle="Saved, immutable snapshots of the forecast workspace." />
      <div className="card empty-state">
        <span className="empty-state__icon">
          <Icon name="history" size={22} />
        </span>
        <h2>Version history is coming soon</h2>
        <p className="muted">
          Saving forecast versions, browsing past snapshots and commenting will be available in the next release.
        </p>
      </div>
    </>
  );
}
