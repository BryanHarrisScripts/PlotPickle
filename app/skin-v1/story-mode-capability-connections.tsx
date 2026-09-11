"use client";

export type StoryModeCapability = "writing" | "images" | "video" | "agents";
export type StoryModeConnectionState = "ready" | "needs-test" | "setup" | "error";

export type StoryModeConnectionRow = Readonly<{
  id: string;
  label: string;
  role: string;
  detail: string;
  state: StoryModeConnectionState;
  model?: string;
  active?: boolean;
  setupLabel: string;
  onSetup: () => void;
  useLabel?: string;
  onUse?: () => void;
  useDisabled?: boolean;
}>;

type Props = Readonly<{
  mode: "local" | "cloud";
  capability: StoryModeCapability;
  connections: readonly StoryModeConnectionRow[];
  notice?: string;
  paidAcknowledged?: boolean;
  onPaidAcknowledged?: (value: boolean) => void;
  dataSharingAcknowledged?: boolean;
  onDataSharingAcknowledged?: (value: boolean) => void;
}>;

const CAPABILITY_LABELS: Record<StoryModeCapability, string> = {
  writing: "Writing",
  images: "Images",
  video: "Video",
  agents: "Agents",
};

const panel: React.CSSProperties = {
  marginBottom: "var(--pp-skin-space-4)",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
  background: "var(--pp-skin-surface-1)",
  color: "var(--pp-skin-ink)",
  boxShadow: "var(--pp-skin-inset-highlight)",
};

const header: React.CSSProperties = {
  padding: "var(--pp-skin-space-4)",
  borderBottom: "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
};

const boundary: React.CSSProperties = {
  margin: "var(--pp-skin-space-3) var(--pp-skin-space-4) 0",
  padding: "var(--pp-skin-space-3)",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-accent)",
  background: "var(--pp-skin-accent-deep)",
  color: "var(--pp-skin-ink)",
};

const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(170px, .75fr) minmax(260px, 1.75fr) minmax(150px, .75fr) auto",
  gap: "var(--pp-skin-space-3)",
  alignItems: "center",
  padding: "var(--pp-skin-space-3) var(--pp-skin-space-4)",
  borderTop: "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: "var(--pp-skin-space-2)",
  justifyContent: "flex-end",
  flexWrap: "wrap",
};

const button: React.CSSProperties = {
  minHeight: "var(--pp-skin-control-height)",
  padding: "var(--pp-skin-space-2) var(--pp-skin-space-3)",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-accent)",
  borderRadius: "var(--pp-skin-radius)",
  background: "var(--pp-skin-surface-0)",
  color: "var(--pp-skin-ink)",
  font: "inherit",
  cursor: "pointer",
};

function stateLabel(state: StoryModeConnectionState) {
  if (state === "ready") return "Ready";
  if (state === "needs-test") return "Needs test";
  if (state === "error") return "Error";
  return "Set up";
}

function stateColor(state: StoryModeConnectionState) {
  if (state === "ready") return "var(--pp-skin-accent-bright)";
  if (state === "error") return "var(--pp-skin-danger, var(--pp-skin-warning))";
  if (state === "needs-test") return "var(--pp-skin-warning)";
  return "var(--pp-skin-ink-muted)";
}

export default function StoryModeCapabilityConnections({
  mode,
  capability,
  connections,
  notice = "",
  paidAcknowledged = false,
  onPaidAcknowledged,
  dataSharingAcknowledged = false,
  onDataSharingAcknowledged,
}: Props) {
  const capabilityLabel = CAPABILITY_LABELS[capability];
  const cloud = mode === "cloud";

  return (
    <section
      style={panel}
      data-story-mode-capability-panel={mode}
      data-story-mode-capability={capability}
      aria-labelledby={`${mode}-${capability}-connections-title`}
    >
      <header style={header}>
        <p style={{ margin: 0, color: "var(--pp-skin-accent-bright)", fontSize: "var(--pp-skin-font-small)", letterSpacing: ".06em" }}>
          {cloud ? "CLOUD STORY MODE" : "LOCAL STORY MODE"} / CAPABILITY
        </p>
        <h2 id={`${mode}-${capability}-connections-title`} style={{ margin: "5px 0 4px", fontSize: "var(--pp-skin-font-title)" }}>{capabilityLabel}</h2>
        <p style={{ margin: 0, color: "var(--pp-skin-ink-soft)", lineHeight: "var(--pp-skin-leading-body)" }}>
          Choose a connection for {capabilityLabel.toLowerCase()}. Detailed credentials, runtime setup and model controls stay on the Connection page.
        </p>
      </header>

      {cloud ? (
        <div style={boundary} data-cloud-capability-consent="billing">
          <label style={{ display: "flex", gap: "var(--pp-skin-space-2)", alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={paidAcknowledged}
              onChange={(event) => onPaidAcknowledged?.(event.target.checked)}
            />
            <span><strong>I understand remote provider API requests may incur charges.</strong> Connecting or viewing status does not itself run a paid generation.</span>
          </label>
          {capability === "video" ? (
            <label style={{ display: "flex", gap: "var(--pp-skin-space-2)", alignItems: "flex-start", marginTop: "var(--pp-skin-space-2)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={dataSharingAcknowledged}
                onChange={(event) => onDataSharingAcknowledged?.(event.target.checked)}
              />
              <span>I understand a cloud video prompt and selected reference media may leave this computer when I explicitly use a cloud video route.</span>
            </label>
          ) : null}
        </div>
      ) : (
        <div style={boundary} data-local-capability-boundary="true">
          <strong>Runs on this computer · no cloud provider charges.</strong>
        </div>
      )}

      <div data-story-mode-connection-list={mode} style={{ marginTop: "var(--pp-skin-space-3)" }}>
        {connections.map((connection) => (
          <article key={connection.id} style={row} data-story-mode-connection={connection.id} data-connection-state={connection.state}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--pp-skin-space-2)" }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    border: "var(--pp-skin-border-thin) solid var(--pp-skin-line-strong)",
                    background: stateColor(connection.state),
                    flex: "0 0 auto",
                  }}
                />
                <strong>{connection.label}</strong>
              </div>
              <p style={{ margin: "4px 0 0", color: "var(--pp-skin-ink-soft)" }}>{connection.role}</p>
            </div>

            <div>
              <p style={{ margin: 0, lineHeight: "var(--pp-skin-leading-body)", color: "var(--pp-skin-ink-soft)" }}>{connection.detail}</p>
              {connection.model ? <p style={{ margin: "5px 0 0" }}><strong>Current:</strong> {connection.model}</p> : null}
            </div>

            <div>
              <strong style={{ color: stateColor(connection.state) }}>{stateLabel(connection.state)}</strong>
              {connection.active ? <p style={{ margin: "4px 0 0", color: "var(--pp-skin-accent-bright)" }}>Active</p> : null}
            </div>

            <div style={actionRow}>
              <button type="button" style={button} onClick={connection.onSetup}>{connection.setupLabel}</button>
              {connection.onUse && connection.useLabel ? (
                <button
                  type="button"
                  style={{ ...button, borderColor: "var(--pp-skin-accent-bright)", background: connection.active ? "var(--pp-skin-accent-deep)" : "var(--pp-skin-surface-0)" }}
                  onClick={connection.onUse}
                  disabled={connection.useDisabled || connection.active}
                >
                  {connection.active ? "Active" : connection.useLabel}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {notice ? <p role="status" aria-live="polite" style={{ margin: 0, padding: "var(--pp-skin-space-3) var(--pp-skin-space-4)", borderTop: "var(--pp-skin-border-thin) solid var(--pp-skin-line)", color: "var(--pp-skin-accent-bright)" }}>{notice}</p> : null}
    </section>
  );
}
