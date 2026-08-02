"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConnectionState, ConnectionStatusSnapshot, PublicConnectionStatus } from "@/lib/connection-status";
import { requestConnectionStatusRefresh } from "./use-connection-status";
import styles from "./setup-connections-dashboard.module.css";

const OPENAI_KEYS_URL = "https://platform.openai.com/api-keys";
const OPENAI_BILLING_URL = "https://platform.openai.com/settings/organization/billing/overview";
const OPENAI_QUICKSTART_URL = "https://developers.openai.com/api/docs/quickstart";
const BUZZ_INVITE_URL = "https://plotpickleplayhouse.communities.buzz.xyz/invite/v2.tdZwBnmvMuZ_E3lh_cEjbo4qeJHdTvFogatjMfVgB-k";
const BUZZ_COMMUNITIES_URL = "https://app.builderlab.xyz/buzz";
const GITHUB_SIGNUP_URL = "https://github.com/signup";
const GITHUB_NEW_REPOSITORY_URL = "https://github.com/new";
const GOOGLE_CREDENTIALS_URL = "https://console.cloud.google.com/apis/credentials";
const BUZZ_STATUS_API = "/api/local-buzz/status";

type SetupTone = "green" | "grey" | "yellow" | "red";

type BuzzStatus = {
  connection?: {
    configured?: boolean;
    relayUrl?: string;
    community?: string;
    identityLabel?: string;
    identityVerified?: boolean;
    verifiedAt?: string;
  };
  relay?: { reachable?: boolean; checkedAt?: string; detail?: string };
  cli?: { available?: boolean; version?: string };
};

type SetupLink = { label: string; href: string };

type SetupRow = {
  id: string;
  label: string;
  requirement: "Included" | "Optional";
  tone: SetupTone;
  status: string;
  detail: string;
  identity: string;
  checkedAt: string;
  settingsSection?: string;
  links?: SetupLink[];
};

const toneCopy: Record<SetupTone, { symbol: string; meaning: string }> = {
  green: { symbol: "✓", meaning: "Verified and working" },
  grey: { symbol: "○", meaning: "Optional and not configured" },
  yellow: { symbol: "!", meaning: "Setup or verification needed" },
  red: { symbol: "×", meaning: "A previously working connection has failed" },
};

function formatCheckedAt(value: string) {
  if (!value) return "Not checked yet";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

function toneForConnection(connection: PublicConnectionStatus): SetupTone {
  if (connection.state === "connected") return "green";
  if (connection.state === "error" && connection.lastSuccessfulConnection) return "red";
  if (["configured", "checking", "error", "unavailable"].includes(connection.state)) return "yellow";
  return "grey";
}

function stateLabel(state: ConnectionState, optional = true) {
  if (state === "connected") return "Verified and working";
  if (state === "configured") return "Configured — test needed";
  if (state === "checking") return "Checking now";
  if (state === "error") return "Connection needs repair";
  if (state === "unavailable") return "Health check unavailable";
  if (state === "disabled") return optional ? "Optional — disabled" : "Disabled";
  return optional ? "Optional — not configured" : "Not configured";
}

function rowFromConnection(
  connection: PublicConnectionStatus,
  patch: Partial<SetupRow> & Pick<SetupRow, "id" | "label" | "requirement">,
): SetupRow {
  return {
    tone: toneForConnection(connection),
    status: stateLabel(connection.state),
    detail: connection.detail,
    identity: connection.identity,
    checkedAt: connection.lastSuccessfulConnection,
    settingsSection: connection.id === "plugins" ? "plugins" : connection.id,
    ...patch,
  };
}

function livePluginTone(connection: PublicConnectionStatus): SetupTone {
  if (connection.state !== "connected") return toneForConnection(connection);
  return connection.lastSuccessfulConnection ? "green" : "yellow";
}

export default function SetupConnectionsDashboard({
  connectionStatus,
  onOpenSettings,
}: {
  connectionStatus: ConnectionStatusSnapshot;
  onOpenSettings: (section: string) => void;
}) {
  const [buzz, setBuzz] = useState<BuzzStatus | null>(null);
  const [buzzError, setBuzzError] = useState("");
  const [buzzPreviouslyConnected, setBuzzPreviouslyConnected] = useState(false);
  const [testing, setTesting] = useState(false);

  const refreshBuzz = useCallback(async () => {
    try {
      const response = await fetch(BUZZ_STATUS_API, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error("Buzz health check is unavailable.");
      const body = await response.json() as BuzzStatus;
      const connected = Boolean(body.connection?.configured && body.connection.identityVerified && body.relay?.reachable && body.cli?.available);
      if (connected) setBuzzPreviouslyConnected(true);
      setBuzz(body);
      setBuzzError("");
    } catch (error) {
      setBuzzError(error instanceof Error ? error.message : "Buzz health check is unavailable.");
    }
  }, []);

  useEffect(() => {
    void refreshBuzz();
  }, [refreshBuzz]);

  async function testAllConnections() {
    setTesting(true);
    requestConnectionStatusRefresh();
    await refreshBuzz();
    window.setTimeout(() => setTesting(false), 700);
  }

  const included = useMemo<SetupRow[]>(() => {
    const storage = connectionStatus.items.storage;
    const backups = connectionStatus.items.backups;
    return [
      {
        id: "plotpickle",
        label: "PlotPickle application",
        requirement: "Included",
        tone: "green",
        status: "Running locally",
        detail: "The open-source application and complete local story workflow are available without an account or API key.",
        identity: "This installation",
        checkedAt: connectionStatus.checkedAt,
      },
      rowFromConnection(storage, {
        id: "storage",
        label: "Local PPF project storage",
        requirement: "Included",
        settingsSection: "storage",
      }),
      rowFromConnection(backups, {
        id: "backups",
        label: "Rolling local backups",
        requirement: "Included",
        settingsSection: "storage",
      }),
    ];
  }, [connectionStatus]);

  const optional = useMemo<SetupRow[]>(() => {
    const ai = connectionStatus.items.ai;
    const github = connectionStatus.items.github;
    const google = connectionStatus.items.google;
    const plugins = connectionStatus.items.plugins;
    const buzzConnected = Boolean(buzz?.connection?.configured && buzz.connection.identityVerified && buzz.relay?.reachable && buzz.cli?.available);
    const buzzPartiallyConfigured = Boolean(buzz?.connection?.configured || buzz?.cli?.available || buzz?.connection?.identityVerified);
    const buzzTone: SetupTone = buzzConnected
      ? "green"
      : buzzError && buzzPreviouslyConnected
        ? "red"
        : buzzError || buzzPartiallyConfigured
          ? "yellow"
          : "grey";
    const buzzIdentity = [buzz?.connection?.community, buzz?.connection?.identityLabel].filter(Boolean).join(" · ");
    const buzzStatus = buzzConnected
      ? "Verified and working"
      : buzzError
        ? "Health check unavailable"
        : buzzPartiallyConfigured
          ? "Setup or verification needed"
          : "Optional — not configured";

    return [
      rowFromConnection(ai, {
        id: "ai",
        label: "AI provider",
        requirement: "Optional",
        detail: `${ai.detail} ChatGPT Plus does not include OpenAI API usage; API keys and billing are separate.`,
        settingsSection: "ai",
        links: [
          { label: "Create OpenAI API key", href: OPENAI_KEYS_URL },
          { label: "OpenAI API billing", href: OPENAI_BILLING_URL },
          { label: "OpenAI API quickstart", href: OPENAI_QUICKSTART_URL },
        ],
      }),
      {
        id: "buzz",
        label: "Buzz community",
        requirement: "Optional",
        tone: buzzTone,
        status: buzzStatus,
        detail: buzzConnected
          ? "Buzz Desktop, the community relay and the authorized identity all passed their live checks."
          : buzz?.relay?.detail || "Use the PlotPickle community or create your own Buzz community, then connect Buzz Desktop and authorize PlotPickle.",
        identity: buzzIdentity,
        checkedAt: buzz?.relay?.checkedAt || buzz?.connection?.verifiedAt || "",
        settingsSection: "buzz",
        links: [
          { label: "Join PlotPickleServer", href: BUZZ_INVITE_URL },
          { label: "Set up Buzz account or community", href: BUZZ_COMMUNITIES_URL },
        ],
      },
      rowFromConnection(github, {
        id: "github",
        label: "GitHub account & story repository",
        requirement: "Optional",
        detail: `${github.detail} One repository per story is recommended so its assets, proposals, permissions and history remain separate.`,
        settingsSection: "github",
        links: [
          { label: "Create GitHub account", href: GITHUB_SIGNUP_URL },
          { label: "Create story repository", href: GITHUB_NEW_REPOSITORY_URL },
        ],
      }),
      rowFromConnection(google, {
        id: "google",
        label: "Google Calendar & Meet",
        requirement: "Optional",
        settingsSection: "google",
        links: [{ label: "Google OAuth credentials", href: GOOGLE_CREDENTIALS_URL }],
      }),
      {
        ...rowFromConnection(plugins, {
          id: "plugins",
          label: "Local or external media engines",
          requirement: "Optional",
          settingsSection: "plugins",
        }),
        tone: livePluginTone(plugins),
        status: plugins.state === "connected" && !plugins.lastSuccessfulConnection
          ? "Enabled — live verification unavailable"
          : stateLabel(plugins.state),
      },
    ];
  }, [buzz, buzzError, buzzPreviouslyConnected, connectionStatus]);

  function renderRow(row: SetupRow) {
    const meta = toneCopy[row.tone];
    return (
      <article className={styles.row} data-tone={row.tone} key={row.id}>
        <div className={styles.statusLight} aria-label={`${row.label}: ${meta.meaning}`} title={meta.meaning}>
          <i aria-hidden="true" />
          <span>{meta.symbol}</span>
        </div>
        <div className={styles.rowContent}>
          <div className={styles.rowHeading}>
            <div><span>{row.requirement}</span><h3>{row.label}</h3></div>
            <strong>{row.status}</strong>
          </div>
          <p>{row.detail}</p>
          <dl>
            <div><dt>Account / location</dt><dd>{row.identity || (row.requirement === "Included" ? "This device" : "None configured")}</dd></div>
            <div><dt>Last checked</dt><dd>{formatCheckedAt(row.checkedAt || connectionStatus.checkedAt)}</dd></div>
          </dl>
          <div className={styles.actions}>
            {row.settingsSection ? <button type="button" onClick={() => onOpenSettings(row.settingsSection!)}>Configure in PlotPickle</button> : null}
            {row.links?.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noreferrer">{link.label}</a>)}
          </div>
        </div>
      </article>
    );
  }

  return (
    <section id="dashboard-setup" className={styles.section} aria-labelledby="setup-connections-title">
      <header className={styles.header}>
        <div>
          <p>PlotPickle setup &amp; connections</p>
          <h2 id="setup-connections-title">What is included—and what you configure yourself</h2>
          <span>PlotPickle works locally without any optional account. Add only the services that match how you want to write, collaborate, meet or render.</span>
        </div>
        <button type="button" onClick={() => { void testAllConnections(); }} disabled={testing}>
          {testing ? "Testing connections…" : "Test all connections"}
        </button>
      </header>

      <div className={styles.legend} aria-label="Connection-light meanings">
        {(Object.keys(toneCopy) as SetupTone[]).map((tone) => (
          <span key={tone} data-tone={tone}><i aria-hidden="true" />{toneCopy[tone].meaning}</span>
        ))}
      </div>

      <div className={styles.group}>
        <div className={styles.groupHeading}><span>Comes with the open-source installation</span><strong>No account or API key required</strong></div>
        <div className={styles.rows}>{included.map(renderRow)}</div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupHeading}><span>Configured by the user when needed</span><strong>Optional accounts, keys or local services</strong></div>
        <div className={styles.rows}>{optional.map(renderRow)}</div>
      </div>

      <aside className={styles.securityNote}>
        <strong>Connection lights never expose credentials.</strong>
        <span>PlotPickle shows service identity, repository, health and check time only. API keys, Buzz private keys, OAuth tokens and GitHub credentials remain in the local encrypted credential store and are excluded from PPF files, exports and repositories.</span>
      </aside>
    </section>
  );
}
