"use client";

import { useEffect, useState } from "react";
import styles from "./github-collaboration.module.css";

export type GitHubAppConnectedRepository = {
  owner: string;
  repo: string;
  branch: string;
  projectPath: string;
  repositoryUrl: string;
  login: string;
  verifiedAt: string;
  ready: boolean;
  checks: unknown[];
};

type GitHubIdentity = {
  id: number;
  login: string;
  name: string;
  avatarUrl: string;
};

type GitHubAppStatus = {
  configured: boolean;
  authenticated: boolean;
  identity: GitHubIdentity | null;
  expiresAt: string;
  installUrl: string;
  permissions: string[];
};

type RepositoryChoice = {
  id: number;
  installationId: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  permissions: { pull: boolean; push: boolean; admin: boolean };
};

type DeviceAuthorization = {
  userCode: string;
  verificationUri: string;
  expiresAt: string;
  intervalSeconds: number;
};

type JsonError = Error & { response?: Record<string, unknown> };

async function request(path: string, method: "GET" | "POST" | "DELETE" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error("GitHub App setup is available in the downloaded PlotPickle server.");
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const error = new Error(typeof value.message === "string" ? value.message : "The GitHub App request failed.") as JsonError;
    error.response = value;
    throw error;
  }
  return value;
}

function statusFrom(value: Record<string, unknown>): GitHubAppStatus {
  const identity = value.identity && typeof value.identity === "object" ? value.identity as Record<string, unknown> : null;
  return {
    configured: Boolean(value.configured),
    authenticated: Boolean(value.authenticated),
    identity: identity ? {
      id: Number(identity.id) || 0,
      login: typeof identity.login === "string" ? identity.login : "",
      name: typeof identity.name === "string" ? identity.name : "",
      avatarUrl: typeof identity.avatarUrl === "string" ? identity.avatarUrl : "",
    } : null,
    expiresAt: typeof value.expiresAt === "string" ? value.expiresAt : "",
    installUrl: typeof value.installUrl === "string" ? value.installUrl : "",
    permissions: Array.isArray(value.permissions) ? value.permissions.filter((item): item is string => typeof item === "string") : [],
  };
}

function repositoryList(value: unknown): RepositoryChoice[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const permissions = record.permissions && typeof record.permissions === "object" ? record.permissions as Record<string, unknown> : {};
    const fullName = typeof record.fullName === "string" ? record.fullName : "";
    if (!fullName) return [];
    return [{
      id: Number(record.id) || 0,
      installationId: Number(record.installationId) || 0,
      owner: typeof record.owner === "string" ? record.owner : "",
      name: typeof record.name === "string" ? record.name : "",
      fullName,
      private: Boolean(record.private),
      defaultBranch: typeof record.defaultBranch === "string" ? record.defaultBranch : "main",
      htmlUrl: typeof record.htmlUrl === "string" ? record.htmlUrl : "",
      permissions: {
        pull: Boolean(permissions.pull),
        push: Boolean(permissions.push),
        admin: Boolean(permissions.admin),
      },
    }];
  });
}

export default function GitHubAppConnection({
  projectPath,
  disabled,
  onConnected,
  onMessage,
}: {
  projectPath: string;
  disabled: boolean;
  onConnected: (connection: GitHubAppConnectedRepository) => void;
  onMessage: (message: string) => void;
}) {
  const [status, setStatus] = useState<GitHubAppStatus>({
    configured: false,
    authenticated: false,
    identity: null,
    expiresAt: "",
    installUrl: "",
    permissions: [],
  });
  const [repositories, setRepositories] = useState<RepositoryChoice[]>([]);
  const [selected, setSelected] = useState("");
  const [device, setDevice] = useState<DeviceAuthorization | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadRepositories() {
    const result = await request("/api/local-github-app/repositories");
    const next = repositoryList(result.repositories);
    setRepositories(next);
    setSelected((current) => current && next.some((item) => item.fullName === current) ? current : next.find((item) => item.permissions.push)?.fullName || next[0]?.fullName || "");
    return next;
  }

  async function loadStatus() {
    try {
      const result = await request("/api/local-github-app/status");
      const next = statusFrom(result);
      setStatus(next);
      if (next.authenticated) await loadRepositories();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "GitHub App status could not be loaded.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadStatus(); }, 0);
    return () => window.clearTimeout(timer);
    // Initial GitHub App status is intentionally loaded once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!device) return;
    let cancelled = false;
    let timer = 0;
    const poll = async () => {
      try {
        const result = await request("/api/local-github-app/poll", "POST");
        if (cancelled) return;
        if (result.state === "authenticated") {
          const next = statusFrom(result);
          setStatus(next);
          setDevice(null);
          await loadRepositories();
          onMessage(`Connected GitHub account ${next.identity?.login || "successfully"}. Choose the story repository below.`);
          return;
        }
        const retry = Math.max(1, Number(result.retryAfterSeconds) || device.intervalSeconds);
        timer = window.setTimeout(() => { void poll(); }, retry * 1000);
      } catch (error) {
        if (cancelled) return;
        setDevice(null);
        onMessage(error instanceof Error ? error.message : "GitHub sign-in could not be completed.");
      }
    };
    timer = window.setTimeout(() => { void poll(); }, device.intervalSeconds * 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Device polling restarts only when a new code is issued.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.userCode]);

  async function start() {
    setBusy(true);
    try {
      const result = await request("/api/local-github-app/start", "POST");
      const authorization: DeviceAuthorization = {
        userCode: String(result.userCode ?? ""),
        verificationUri: String(result.verificationUri ?? "https://github.com/login/device"),
        expiresAt: String(result.expiresAt ?? ""),
        intervalSeconds: Math.max(5, Number(result.intervalSeconds) || 5),
      };
      setDevice(authorization);
      window.open(authorization.verificationUri, "_blank", "noopener,noreferrer");
      onMessage("GitHub opened in your browser. Enter the displayed code, then return to PlotPickle.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "GitHub sign-in could not start.");
    } finally {
      setBusy(false);
    }
  }

  async function connectRepository() {
    if (!selected) {
      onMessage("Choose a story repository first.");
      return;
    }
    setBusy(true);
    onMessage("Checking the selected story repository and required GitHub permissions…");
    try {
      const selectedResult = await request("/api/local-github-app/select", "POST", { fullName: selected, projectPath });
      const checked = await request("/api/local-github/connection/check", "POST");
      const repository = selectedResult.repository && typeof selectedResult.repository === "object" ? selectedResult.repository as Record<string, unknown> : {};
      onConnected({
        owner: String(checked.owner ?? repository.owner ?? ""),
        repo: String(checked.repo ?? repository.name ?? ""),
        branch: String(checked.branch ?? repository.defaultBranch ?? "main"),
        projectPath: String(checked.projectPath ?? projectPath),
        repositoryUrl: String(checked.repositoryUrl ?? repository.htmlUrl ?? ""),
        login: String(checked.login ?? status.identity?.login ?? ""),
        verifiedAt: String(checked.verifiedAt ?? ""),
        ready: Boolean(checked.ready),
        checks: Array.isArray(checked.checks) ? checked.checks : [],
      });
      onMessage("GitHub is ready. PlotPickle selected the repository and detected its approved branch automatically.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "The selected GitHub repository could not be connected.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.appConnection}>
      <div className={styles.appConnectionIntro}>
        <div>
          <strong>Recommended: connect your GitHub account</strong>
          <p>Sign in through GitHub, choose a story project and let PlotPickle fill in the repository and approved branch. No token copying is required.</p>
        </div>
        <span className={status.authenticated ? styles.accountReady : styles.accountWaiting}>{status.authenticated ? "Account connected" : status.configured ? "Account not connected" : "App setup required"}</span>
      </div>

      {!status.configured ? (
        <div className={styles.appUnavailable}>
          <strong>The PlotPickle GitHub App is not configured in this build.</strong>
          <p>Set <code>PLOTPICKLE_GITHUB_APP_CLIENT_ID</code> on the local server after registering the app. Fine-grained-token setup remains available under Advanced Setup below.</p>
        </div>
      ) : !status.authenticated ? (
        <div className={styles.appStart}>
          {device ? (
            <div className={styles.deviceCard}>
              <span>Enter this code at GitHub</span>
              <code>{device.userCode}</code>
              <div className={styles.actions}>
                <a href={device.verificationUri} target="_blank" rel="noreferrer">Open GitHub verification</a>
                <button type="button" disabled={disabled || busy} onClick={() => void start()}>Start with a new code</button>
              </div>
            </div>
          ) : (
            <div className={styles.actions}>
              <button type="button" className={styles.primary} disabled={disabled || busy} onClick={() => void start()}>{busy ? "Opening GitHub…" : "Connect GitHub Account"}</button>
              {status.installUrl ? <a href={status.installUrl} target="_blank" rel="noreferrer">Install or update repository access</a> : null}
            </div>
          )}
          <p className={styles.credentialNote}>GitHub shows the repositories and permissions being granted. PlotPickle stores the resulting short-lived access and refresh credentials in its encrypted local credentials folder.</p>
        </div>
      ) : (
        <div className={styles.repositoryPicker}>
          <div className={styles.accountCard}>
            {status.identity?.avatarUrl ? <img src={status.identity.avatarUrl} alt="" /> : null}
            <div><span>Signed in as</span><strong>{status.identity?.name || status.identity?.login}</strong><small>@{status.identity?.login}</small></div>
            {status.installUrl ? <a href={status.installUrl} target="_blank" rel="noreferrer">Manage repository access</a> : null}
          </div>
          <label>
            <span>Story project</span>
            <select value={selected} onChange={(event) => setSelected(event.target.value)} disabled={disabled || busy || !repositories.length}>
              {repositories.length ? repositories.map((repository) => (
                <option key={`${repository.installationId}:${repository.id}`} value={repository.fullName} disabled={!repository.permissions.push}>
                  {repository.fullName} · {repository.private ? "Private" : "Public"}{repository.permissions.push ? "" : " · Read only"}
                </option>
              )) : <option value="">No accessible repositories found</option>}
            </select>
            <small>Only repositories installed for the PlotPickle GitHub App are listed.</small>
          </label>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={disabled || busy || !selected} onClick={() => void connectRepository()}>{busy ? "Checking…" : "Use selected story project"}</button>
            <button type="button" disabled={disabled || busy} onClick={() => void loadRepositories()}>Refresh projects</button>
          </div>
        </div>
      )}
    </div>
  );
}
