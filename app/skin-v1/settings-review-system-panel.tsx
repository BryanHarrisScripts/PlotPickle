import settingsTaxonomy from "../../config/settings-system-taxonomy.json";

export type ReviewSettingsSystemId = "data" | "deploy" | "repos" | "auth";

export const REVIEW_SETTINGS_SYSTEM_IDS = ["data", "deploy", "repos", "auth"] as const satisfies readonly ReviewSettingsSystemId[];

export function isReviewSettingsSystemId(value: string): value is ReviewSettingsSystemId {
  return (REVIEW_SETTINGS_SYSTEM_IDS as readonly string[]).includes(value);
}

const shell: React.CSSProperties = {
  minHeight: "100vh",
  padding: "var(--pp-skin-space-4) clamp(10px, 2vw, var(--pp-skin-space-6)) var(--pp-skin-space-7)",
  background: "var(--pp-skin-fill-panel)",
  color: "var(--pp-skin-ink)",
  fontFamily: "var(--pp-skin-font-ui)",
};

const panel: React.CSSProperties = {
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-line-strong)",
  background: "var(--pp-skin-surface-1)",
  padding: "var(--pp-skin-space-4)",
  boxShadow: "var(--pp-skin-shadow-control)",
};

const dataItems = [
  {
    id: "data-projects",
    label: "Project Files & Backups",
    description: "Your stories, project files, rolling backups and recovery. Canonical project storage is not disposable cache.",
  },
  {
    id: "data-retrieval",
    label: "Project Search",
    description: "PlotPickle builds a private search index so it can quickly find relevant scenes, characters, notes and story information inside your projects.",
  },
  {
    id: "data-cache",
    label: "Media & Preview Cache",
    description: "Temporary previews, thumbnails and replaceable local working data. Canonical project files and user-owned project assets are not disposable cache.",
  },
  {
    id: "data-database",
    label: "Advanced Data Diagnostics",
    description: "Database, data-format, search-engine and storage diagnostics for troubleshooting.",
    diagnostics: [
      "Database engine and local storage implementation",
      "Database/schema version and migration status or history",
      "Drizzle ORM and Drizzle Kit references when diagnostically necessary",
      "Embeddings, vector stores, Chroma and search-engine implementation details",
      "Storage paths, executor/index diagnostics and repair evidence",
    ],
  },
] as const;

export default function SettingsReviewSystemPanel({ systemId }: { readonly systemId: ReviewSettingsSystemId }) {
  const system = settingsTaxonomy.systems.find((entry) => entry.id === systemId);
  if (!system) return null;
  const items = systemId === "data" ? dataItems : system.items;
  const description = systemId === "data"
    ? "Project files, backups, private project search and temporary working data."
    : system.description;

  return (
    <div style={shell} data-settings-review-surface={systemId} data-settings-review-state="in-review">
      <section style={panel} aria-labelledby={`settings-review-${systemId}-title`}>
        <h2 id={`settings-review-${systemId}-title`} style={{ margin: "0 0 4px", fontSize: 24 }}>{system.label.toUpperCase()}</h2>
        <p style={{ margin: 0, color: "var(--pp-skin-ink-soft)", lineHeight: 1.55 }}>{description}</p>
      </section>

      <section style={{ ...panel, marginTop: 12 }} aria-label={`${system.label} settings items`}>
        {items.map((item, index) => (
          <article
            key={item.id}
            data-settings-review-item={item.id}
            style={{
              padding: "var(--pp-skin-space-4) 0",
              borderTop: index === 0 ? "none" : "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
            }}
          >
            <strong style={{ display: "block", color: "var(--pp-skin-ink)", fontSize: 15 }}>{item.label}</strong>
            <p style={{ margin: "6px 0 0", color: "var(--pp-skin-ink-soft)", lineHeight: 1.5 }}>{item.description}</p>
            {"diagnostics" in item ? (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>Open diagnostics details</summary>
                <ul style={{ margin: "10px 0 0", paddingLeft: 20, color: "var(--pp-skin-ink-muted)", fontSize: 12, lineHeight: 1.6 }}>
                  {item.diagnostics.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
                <p style={{ margin: "10px 0 0", color: "var(--pp-skin-ink-muted)", fontSize: 12, lineHeight: 1.5 }}>
                  Database migrations are automatic product maintenance. Ordinary Settings should describe only whether the data format is current or needs attention.
                </p>
              </details>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
