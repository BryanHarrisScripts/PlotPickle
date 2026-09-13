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

const reviewBadge: React.CSSProperties = {
  display: "inline-block",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-warning)",
  background: "var(--pp-skin-warning-surface)",
  color: "var(--pp-skin-warning-ink)",
  padding: "5px 9px",
  fontWeight: 700,
  letterSpacing: ".06em",
  whiteSpace: "nowrap",
};

export default function SettingsReviewSystemPanel({ systemId }: { readonly systemId: ReviewSettingsSystemId }) {
  const system = settingsTaxonomy.systems.find((entry) => entry.id === systemId);
  if (!system) return null;

  return (
    <div style={shell} data-settings-review-surface={systemId} data-settings-review-state="in-review">
      <section style={panel} aria-labelledby={`settings-review-${systemId}-title`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, color: "var(--pp-skin-warning)", fontSize: 12, letterSpacing: ".08em" }}>SETTINGS / HUMAN REVIEW</p>
            <h2 id={`settings-review-${systemId}-title`} style={{ margin: "6px 0 4px", fontSize: 24 }}>{system.label.toUpperCase()}</h2>
            <p style={{ margin: 0, color: "var(--pp-skin-ink-soft)", lineHeight: 1.55 }}>{system.description}</p>
          </div>
          <span style={reviewBadge}>IN REVIEW</span>
        </div>
      </section>

      <section style={{ ...panel, marginTop: 12 }} aria-label={`${system.label} review surface items`}>
        {system.items.map((item, index) => (
          <article
            key={item.id}
            data-settings-review-item={item.id}
            style={{
              padding: "var(--pp-skin-space-4) 0",
              borderTop: index === 0 ? "none" : "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 420px" }}>
                <strong style={{ display: "block", color: "var(--pp-skin-ink)", fontSize: 15 }}>{item.label}</strong>
                <p style={{ margin: "6px 0 0", color: "var(--pp-skin-ink-soft)", lineHeight: 1.5 }}>{item.description}</p>
              </div>
              <span style={{ ...reviewBadge, fontSize: 11 }}>IN REVIEW</span>
            </div>

            {"examples" in item && Array.isArray(item.examples) && item.examples.length > 0 ? (
              <p style={{ margin: "10px 0 0", color: "var(--pp-skin-ink-muted)", fontSize: 12, lineHeight: 1.5 }}>
                CURRENT SCOPE: {item.examples.join(" / ")}
              </p>
            ) : null}

            {"mechanics" in item && Array.isArray(item.mechanics) && item.mechanics.length > 0 ? (
              <p style={{ margin: "6px 0 0", color: "var(--pp-skin-ink-muted)", fontSize: 12, lineHeight: 1.5 }}>
                MECHANICS: {item.mechanics.join(" / ")}
              </p>
            ) : null}
          </article>
        ))}
      </section>

      <p style={{ margin: "12px 0 0", color: "var(--pp-skin-warning-ink)", fontSize: 12, lineHeight: 1.5 }}>
        REVIEW SURFACE ONLY. THESE ENTRIES SHOW THE CURRENT SETTINGS TAXONOMY; THEY DO NOT CLAIM THAT THE UNDERLYING CONFIGURATION OR RUNTIME IS FINISHED.
      </p>
    </div>
  );
}
