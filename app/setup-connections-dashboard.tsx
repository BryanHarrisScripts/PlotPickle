"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConnectionState, ConnectionStatusSnapshot, PublicConnectionStatus } from "@/lib/connection-status";
import styles from "./setup-connections-dashboard.module.css";

const OPENAI_KEYS_URL = "https://platform.openai.com/api-keys";
const OPENAI_BILLING_URL = "https://platform.openai.com/settings/organization/billing/overview";
const OPENAI_QUICKSTART_URL = "https://developers.openai.com/api/docs/quickstart";
const MINIMAX_KEYS_URL = "https://platform.minimax.io/user-center/basic-information/interface-key";
const MINIMAX_PRICING_URL = "https://platform.minimax.io/docs/pricing/overview";
const MINIMAX_H3_URL = "https://platform.minimax.io/docs/guides/video-generation";
const BUZZ_INVITE_URL = process.env.NEXT_PUBLIC_PLOTPICKLE_BUZZ_INVITE_URL?.trim() || "";
const BUZZ_COMMUNITIES_URL = "https://app.builderlab.xyz/buzz";
const GITHUB_SIGNUP_URL = "https://github.com/signup";
const GITHUB_NEW_REPOSITORY_URL = "https://github.com/new";
const GOOGLE_CREDENTIALS_URL = "https://console.cloud.google.com/apis/credentials";
const BUZZ_STATUS_API = "/api/local-buzz/status";
const CONNECTIONS_STATUS_API = "/api/local-connections";
const OLLAMA_SETUP_URL = "https://ollama.com/download";
const OLLAMA_DOCS_URL = "https://docs.ollama.com/windows";
const COMFYUI_SETUP_URL = "https://comfy.org/download";
const COMFYUI_DOCS_URL = "https://docs.comfy.org/installation/desktop/windows";

type SetupTone = "green" | "yellow" | "red";

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

type SetupConnection = Omit<PublicConnectionStatus, "id"> & { id: string };
type LocalCreativeServices = {
  checkedAt?: string;
  ollama?: SetupConnection;
  comfyui?: SetupConnection;
};
type CreativePath = {
  id: "local" | "cloud" | "manual";
  title: string;
  summary: string;
  rows: SetupRow[];
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
  yellow: { symbol: "!", meaning: "Setup or verification needed" },
  red: { symbol: "×", meaning: "A previously working connection has failed" },
};

function formatCheckedAt(value: string) {
  if (!value) return "Not checked yet";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

function toneForConnection(connection: SetupConnection): SetupTone {
  if (connection.state === "connected") return "green";
  if (connection.state === "error" && connection.lastSuccessfulConnection) return "red";
  if (["configured", "checking", "error", "unavailable"].includes(connection.state)) return "yellow";
  return "yellow";
}

function stateLabel(state: ConnectionState, optional = true) {
  if (state === "connected") return "Verified and working";
  if (state === "configured") return "Configured — test needed";
  if (state === "checking") return "Checking now";
  if (state === "error") return "Connection needs repair";
  if (state === "unavailable") return "Health check unavailable";
  if (state === "disabled") return optional ? "Optional — disabled" : "Disabled";
  return optional ? "Setup available" : "Not configured";
}

function rowFromConnection(
  connection: SetupConnection,
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
  const [localServices, setLocalServices] = useState<LocalCreativeServices | null>(null);

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

  const refreshLocalServices = useCallback(async () => {
    try {
      const response = await fetch(CONNECTIONS_STATUS_API, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error("Local creative-service checks are unavailable.");
      setLocalServices(await response.json() as LocalCreativeServices);
    } catch {
      setLocalServices(null);
    }
  }, []);

  useEffect(() => {
    const refreshDashboard = () => { void Promise.all([refreshBuzz(), refreshLocalServices()]); };
    const timer = window.setTimeout(refreshDashboard, 0);
    window.addEventListener("plotpickle:setup-status-refresh", refreshDashboard);
    window.addEventListener("plotpickle:connection-status-refresh", refreshDashboard);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("plotpickle:setup-status-refresh", refreshDashboard);
      window.removeEventListener("plotpickle:connection-status-refresh", refreshDashboard);
    };
  }, [refreshBuzz, refreshLocalServices]);


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

  const creativePaths = useMemo<CreativePath[]>(() => {
    const fallback = (id: "ollama" | "comfyui", label: string, endpoint: string): SetupConnection => ({
      id,
      label,
      state: "disconnected",
      identity: `Not running on ${endpoint}`,
      detail: `${label} is optional and was not detected.`,
      lastSuccessfulConnection: "",
      error: "",
      repairGuidance: `Install or start ${label}, then test connections again.`,
      dataShared: [],
      scopes: [],
      permissions: [],
      optional: true,
    });
    const ollama = localServices?.ollama ?? fallback("ollama", "Ollama", "127.0.0.1:11434");
    const comfyui = localServices?.comfyui ?? fallback("comfyui", "ComfyUI", "127.0.0.1:8188");
    const savedAi = connectionStatus.items.ai;
    const providerConnection = (provider: "openai" | "minimax", label: string): SetupConnection =>
      savedAi.identity.toLowerCase().includes(provider) ? savedAi : {
        ...savedAi,
        state: "disconnected",
        identity: `No ${label} provider selected`,
        detail: `${label} remains optional until its own Settings section is configured and tested.`,
        lastSuccessfulConnection: "",
      };
    const openai = providerConnection("openai", "OpenAI");
    const minimax = providerConnection("minimax", "MiniMax");

    return [
      {
        id: "local",
        title: "1 · Local AI",
        summary: "Keep writing context and image generation on this computer. Ollama and ComfyUI are installed and tested separately.",
        rows: [
          rowFromConnection(ollama, {
            id: "ollama",
            label: "Local writing & planning · Ollama",
            requirement: "Optional",
            detail: `${ollama.detail} PlotPickle offers a separate Y/N installation choice on Windows; language models are selected and downloaded separately.`,
            settingsSection: "ollama",
            links: [
              { label: "Download Ollama", href: OLLAMA_SETUP_URL },
              { label: "Ollama Windows guide", href: OLLAMA_DOCS_URL },
            ],
          }),
          rowFromConnection(comfyui, {
            id: "comfyui",
            label: "Local image generation · ComfyUI",
            requirement: "Optional",
            detail: `${comfyui.detail} PlotPickle offers a separate Y/N installation choice on Windows; checkpoints and reviewed workflows are configured separately.`,
            settingsSection: "comfyui",
            links: [
              { label: "Download ComfyUI", href: COMFYUI_SETUP_URL },
              { label: "ComfyUI Windows guide", href: COMFYUI_DOCS_URL },
            ],
          }),
        ],
      },
      {
        id: "cloud",
        title: "2 · Cloud AI",
        summary: "Use OpenAI, MiniMax or another reviewed provider with the writer's own account, API key and provider billing. PlotPickle supplies no credits and never falls back to cloud automatically.",
        rows: [
          rowFromConnection(openai, {
            id: "openai",
            label: "Cloud writing & images · OpenAI",
            requirement: "Optional",
            detail: `${openai.detail} ChatGPT Plus does not include OpenAI API usage; the API account and billing are separate.`,
            settingsSection: "openai",
          }),
          rowFromConnection(minimax, {
            id: "minimax",
            label: "Cloud text, images & H3 video · MiniMax",
            requirement: "Optional",
            detail: `${minimax.detail} MiniMax uses the writer's own account and requires explicit consent before paid image or video tests.`,
            settingsSection: "minimax",
          }),
        ],
      },
      {
        id: "manual",
        title: "3 · No AI",
        summary: "Write, plan and build the Graphic Novel manually. No account, API key, local model or checkpoint is required.",
        rows: [
          {
            id: "manual-import",
            label: "Manual image import",
            requirement: "Included",
            tone: "green",
            status: "Ready without AI",
            detail: "Import, compare, replace and approve images manually. PlotPickle remains fully usable when every optional AI choice is declined.",
            identity: "This PlotPickle installation",
            checkedAt: connectionStatus.checkedAt,
          },
        ],
      },
    ];
  }, [connectionStatus, localServices]);

  const optional = useMemo<SetupRow[]>(() => {
    const github = connectionStatus.items.github;
    const google = connectionStatus.items.google;
    const buzzConnected = Boolean(buzz?.connection?.configured && buzz.connection.identityVerified && buzz.relay?.reachable && buzz.cli?.available);
    const buzzPartiallyConfigured = Boolean(buzz?.connection?.configured || buzz?.cli?.available || buzz?.connection?.identityVerified);
    const buzzTone: SetupTone = buzzConnected
      ? "green"
      : buzzError && buzzPreviouslyConnected
        ? "red"
        : buzzError || buzzPartiallyConfigured
          ? "yellow"
          : "yellow";
    const buzzIdentity = [buzz?.connection?.community, buzz?.connection?.identityLabel].filter(Boolean).join(" · ");
    const buzzStatus = buzzConnected
      ? "Verified and working"
      : buzzError
        ? "Health check unavailable"
        : buzzPartiallyConfigured
          ? "Setup or verification needed"
          : "Setup available";

    return [
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
          ...(BUZZ_INVITE_URL ? [{ label: "Join PlotPickleServer", href: BUZZ_INVITE_URL }] : []),
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
    ];
  }, [buzz, buzzError, buzzPreviouslyConnected, connectionStatus]);

  const dashboardRows = [...included, ...creativePaths.flatMap((path) => path.rows), ...optional];
  const verifiedCount = dashboardRows.filter((row) => row.tone === "green").length;
  const attentionCount = dashboardRows.filter((row) => row.tone === "yellow" || row.tone === "red").length;

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
            {row.settingsSection ? <button type="button" onClick={() => onOpenSettings(row.settingsSection!)}>Open settings</button> : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <section id="dashboard-setup" className={styles.section} aria-labelledby="setup-connections-title">
      <header className={styles.header}>
        <div>
          <p>Connection dashboard</p>
          <h2 id="setup-connections-title">What is included—and what you configure yourself</h2>
          <span>PlotPickle works locally without any optional account. This is a read-only car-dashboard view: green is ready, yellow needs setup or testing, and red means a previously working component has failed. Open the exact Settings section to make changes.</span>
        </div>
      </header>

      <div className={styles.dashboardSummary} role="status" aria-live="polite">
        <strong>{verifiedCount} verified</strong>
        <span>{attentionCount ? `${attentionCount} connection${attentionCount === 1 ? "" : "s"} need attention` : "All configured connections are healthy"}</span>
        <small>{dashboardRows.length} visible setup checks</small>
      </div>

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
        <div className={styles.groupHeading}><span>Choose one of three creative-compute paths</span><strong>Local AI · Cloud AI · No AI</strong></div>
        <div className={styles.pathGrid}>
          {creativePaths.map((path) => (
            <section className={styles.path} data-path={path.id} key={path.id}>
              <header><h3>{path.title}</h3><p>{path.summary}</p></header>
              <div className={styles.rows}>{path.rows.map(renderRow)}</div>
            </section>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupHeading}><span>Collaboration and scheduling services</span><strong>Configured separately when needed</strong></div>
        <div className={styles.rows}>{optional.map(renderRow)}</div>
      </div>

      <aside className={styles.securityNote}>
        <strong>Connection lights never expose credentials.</strong>
        <span>PlotPickle shows service identity, repository, health and check time only. API keys, Buzz private keys, OAuth tokens and GitHub credentials remain in the local encrypted credential store and are excluded from PPF files, exports and repositories.</span>
      </aside>
    </section>
  );
}
