import settingsTaxonomy from "../../config/settings-system-taxonomy.json";
import styles from "./settings-review-system-panel.module.css";

export type ReviewSettingsSystemId = "data" | "deploy" | "repos" | "auth";

export const REVIEW_SETTINGS_SYSTEM_IDS = ["data", "deploy", "repos", "auth"] as const satisfies readonly ReviewSettingsSystemId[];

export function isReviewSettingsSystemId(value: string): value is ReviewSettingsSystemId {
  return (REVIEW_SETTINGS_SYSTEM_IDS as readonly string[]).includes(value);
}

function DataSettingsPanel() {
  return (
    <div className={styles.surface} data-settings-review-surface="data" data-settings-review-state="in-review">
      <section className={styles.hero} aria-labelledby="settings-review-data-title">
        <p className={styles.eyebrow}>DATA / PROJECT DATA &amp; RECOVERY</p>
        <h2 id="settings-review-data-title">Keep primary files, safety copies and recovery in one clear home.</h2>
        <p>Your story files are primary project storage, not backups. Search indexes, previews and other replaceable working data stay separate from the project material you created.</p>
      </section>

      <section className={styles.cardGrid} aria-label="Project Data and Recovery settings">
        <article className={styles.card} data-settings-review-item="data-projects">
          <div className={styles.cardHeader}>
            <h3>Project Files &amp; Backups</h3>
            <span className={styles.status}>Available now</span>
          </div>
          <p>Use the existing Storage &amp; Backups controls for local project storage, rolling backups and recovery.</p>
          <ul>
            <li>Persistent project files remain the official local copy.</li>
            <li>Rolling backups are safety copies, not primary storage.</li>
            <li>Recovery must keep existing Human work visible and protected.</li>
          </ul>
        </article>

        <article className={styles.card} data-settings-review-item="data-retrieval">
          <div className={styles.cardHeader}>
            <h3>Project Search</h3>
            <span className={styles.status}>Planned</span>
          </div>
          <p>PlotPickle can build a private search index so it can find relevant scenes, characters, notes and story information inside your projects.</p>
          <ul>
            <li>The search index is derived from project material and can be rebuilt.</li>
            <li>Search technology is not part of project canon.</li>
            <li>No search-engine controls appear until a supported Human action exists.</li>
          </ul>
        </article>

        <article className={styles.card} data-settings-review-item="data-cache">
          <div className={styles.cardHeader}>
            <h3>Media &amp; Preview Cache</h3>
            <span className={styles.status}>Planned</span>
          </div>
          <p>Temporary previews, thumbnails and replaceable local working data belong here when PlotPickle can safely identify and rebuild them.</p>
          <ul>
            <li>Canonical project files are never disposable cache.</li>
            <li>User-owned project assets are never disposable cache.</li>
            <li>No cache-removal control appears until PlotPickle can prove what is safe to remove.</li>
          </ul>
        </article>

        <article className={styles.card} data-settings-review-item="data-database">
          <div className={styles.cardHeader}>
            <h3>Advanced Data Diagnostics</h3>
            <span className={styles.status}>Reference</span>
          </div>
          <p>Technical storage, data-format and search-engine detail stays available for troubleshooting without becoming ordinary Settings language.</p>
          <details className={styles.diagnostics}>
            <summary>Open diagnostics details</summary>
            <ul className={styles.diagnosticsList}>
              <li>Database engine and local storage implementation</li>
              <li>Database/schema version and migration status or history</li>
              <li>Drizzle ORM and Drizzle Kit references when diagnostically necessary</li>
              <li>Embeddings, vector stores, Chroma and search-engine implementation details</li>
              <li>Storage paths, executor/index diagnostics and repair evidence</li>
            </ul>
            <p>Database migrations are automatic product maintenance. Ordinary Settings should describe only whether the data format is current or needs attention.</p>
          </details>
        </article>
      </section>

      <section className={styles.boundary} aria-label="Project data safety boundary">
        <strong>Project safety boundary</strong>
        <p>Original project files, Human-created story material and user-owned assets are never treated as disposable cache. Derived search data and previews must remain rebuildable and subordinate to the project.</p>
      </section>
    </div>
  );
}

export default function SettingsReviewSystemPanel({ systemId }: { readonly systemId: ReviewSettingsSystemId }) {
  if (systemId === "data") return <DataSettingsPanel />;

  const system = settingsTaxonomy.systems.find((entry) => entry.id === systemId);
  if (!system) return null;

  return (
    <div className={styles.surface} data-settings-review-surface={systemId} data-settings-review-state="in-review">
      <section className={styles.hero} aria-labelledby={`settings-review-${systemId}-title`}>
        <p className={styles.eyebrow}>SETTINGS</p>
        <h2 id={`settings-review-${systemId}-title`}>{system.label.toUpperCase()}</h2>
        <p>{system.description}</p>
      </section>

      <section className={styles.genericPanel} aria-label={`${system.label} settings items`}>
        {system.items.map((item) => (
          <article key={item.id} className={styles.genericItem} data-settings-review-item={item.id}>
            <strong>{item.label}</strong>
            <p>{item.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
