import styles from "./settings-review-system-panel.module.css";

export type ReviewSettingsSystemId = "advanced";

export const REVIEW_SETTINGS_SYSTEM_IDS = ["advanced"] as const satisfies readonly ReviewSettingsSystemId[];

export function isReviewSettingsSystemId(value: string): value is ReviewSettingsSystemId {
  return (REVIEW_SETTINGS_SYSTEM_IDS as readonly string[]).includes(value);
}

export default function SettingsReviewSystemPanel({ systemId }: { readonly systemId: ReviewSettingsSystemId }) {
  if (systemId !== "advanced") return null;

  return (
    <div className={styles.surface} data-settings-review-surface="advanced" data-settings-review-state="in-review">
      <section className={styles.hero} aria-labelledby="settings-review-advanced-title">
        <p className={styles.eyebrow}>SETTINGS / ADVANCED</p>
        <h2 id="settings-review-advanced-title">Advanced</h2>
        <p>Project data, recovery, tool protocols and technical diagnostics live here. Provider keys remain in Local Story Mode or Cloud Story Mode, where they are actually used.</p>
      </section>

      <section className={styles.cardGrid} aria-label="Advanced settings">
        <article className={styles.card} data-settings-review-item="advanced-data">
          <div className={styles.cardHeader}>
            <h3>Project Data &amp; Recovery</h3>
            <span className={styles.status}>Available / planned</span>
          </div>
          <p>Keep primary files, safety copies, recovery, private project search and replaceable working data in one Human-facing area.</p>
          <ul>
            <li><strong>Project Files &amp; Backups:</strong> persistent project files, rolling backups and recovery.</li>
            <li><strong>Project Search:</strong> private derived search data for scenes, characters, notes and story information.</li>
            <li><strong>Media &amp; Preview Cache:</strong> replaceable previews, thumbnails and temporary working data.</li>
          </ul>
        </article>

        <article className={styles.card} data-settings-review-item="advanced-mcp">
          <div className={styles.cardHeader}>
            <h3>Tools &amp; MCP</h3>
            <span className={styles.status}>Planned</span>
          </div>
          <p>Advanced is the home for reviewed Model Context Protocol definitions and tool-connectivity diagnostics that do not belong in normal story-compute setup.</p>
          <ul>
            <li>MCP server definitions and reviewed tool protocols.</li>
            <li>MCP client-host and callable-tool diagnostics.</li>
            <li>No connection control appears until PlotPickle has a supported Human action to configure or test it.</li>
          </ul>
        </article>

        <article className={styles.card} data-settings-review-item="advanced-source">
          <div className={styles.cardHeader}>
            <h3>PlotPickle Source</h3>
            <span className={styles.status}>Reference</span>
          </div>
          <p>The PlotPickle code repository remains useful as a support, source and release reference. Story-project GitHub authorization does not live here.</p>
          <a className={styles.action} href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Open PlotPickle source repository</a>
        </article>

        <article className={styles.card} data-settings-review-item="advanced-diagnostics">
          <div className={styles.cardHeader}>
            <h3>Technical Diagnostics</h3>
            <span className={styles.status}>Reference</span>
          </div>
          <p>Implementation detail remains available for troubleshooting without becoming ordinary Settings language.</p>
          <details className={styles.diagnostics}>
            <summary>Open diagnostics details</summary>
            <ul className={styles.diagnosticsList}>
              <li>Database engine, schema version, migrations and local storage implementation.</li>
              <li>Drizzle ORM / Drizzle Kit references when diagnostically necessary.</li>
              <li>Embeddings, vector stores, Chroma, storage paths and search/index diagnostics.</li>
              <li>Build/runtime compatibility, release-package and edge-hosting evidence when troubleshooting.</li>
              <li>Credential-storage protection status and repair evidence without duplicating provider API-key setup.</li>
            </ul>
          </details>
        </article>
      </section>

      <section className={styles.boundary} aria-label="Advanced settings boundaries">
        <strong>Boundaries</strong>
        <p>Original project files, Human-created story material and user-owned assets are never disposable cache. Provider API keys stay in Local Story Mode or Cloud Story Mode. DEPLOY does not expose an ordinary Settings control unless PlotPickle later ships a real Human deployment workflow.</p>
      </section>
    </div>
  );
}
