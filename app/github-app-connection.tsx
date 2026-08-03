"use client";

import { useEffect, useState } from "react";
import { nextAvailableRepositoryName, normalizeRepositoryName } from "../lib/story-project-repository";
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
  templateRepository: string;
  repositoryCreationPermission: string;
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

type OwnerChoice = {
  login: string;
  label: string;
  kind: "personal" | "organization";
  installationId: number;
};

type DeviceAuthorization = {
  userCode: string;
  verificationUri: string;
  expiresAt: string;
  intervalSeconds: number;
};

type PendingInitialization = {
  repository: RepositoryChoice;
  message: string;
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
    templateRepository: typeof value.templateRepository === "string" ? value.templateRepository : "",
    repositoryCreationPermission: typeof value.repositoryCreationPermission === "string" ? value.repositoryCreationPermission : "",
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

function ownerList(value: unknown): OwnerChoice[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const login = typeof record.login === "string" ? record.login : "";
    if (!login) return [];
    return [{
      login,
      label: typeof record.label === "string" && record.label ? record.label : login,
      kind: record.kind === "organization" ? "organization" as const : "personal" as const,
      installationId: Number(record.installationId) || 0,
    }];
  });
}

function repositorySlug(value: string) {
  return normalizeRepositoryName(value);
}

function localRepositorySuggestion(value: string, owner: string, repositories: RepositoryChoice[]) {
  const normalized = repositorySlug(value);
  if (!normalized) return "";
  return nextAvailableRepositoryName(normalized, repositories
    .filter((repository) => repository.owner.toLowerCase() === owner.toLowerCase())
    .map((repository) => repository.name));
}

function projectId() {
  return globalThis.crypto?.randomUUID?.() || `plotpickle-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function repositoryFrom(value: unknown): RepositoryChoice | null {
  return repositoryList(value ? [value] : [])[0] || null;
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
    templateRepository: "",
    repositoryCreationPermission: "",
  });
  const [repositories, setRepositories] = useState<RepositoryChoice[]>([]);
  const [owners, setOwners] = useState<OwnerChoice[]>([]);
  const [selected, setSelected] = useState("");
  const [device, setDevice] = useState<DeviceAuthorization | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"existing" | "create">("existing");
  const [newOwner, setNewOwner] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newName, setNewName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [nameSuggestionPending, setNameSuggestionPending] = useState(false);
  const [newPrivate, setNewPrivate] = useState(true);
  const [pendingInitialization, setPendingInitialization] = useState<PendingInitialization | null>(null);

  async function loadChoices() {
    const [repositoryResult, ownerResult] = await Promise.all([
      request("/api/local-github-app/repositories"),
      request("/api/local-github-app/owners"),
    ]);
    const nextRepositories = repositoryList(repositoryResult.repositories);
    const nextOwners = ownerList(ownerResult.owners);
    setRepositories(nextRepositories);
    setOwners(nextOwners);
    setSelected((current) => current && nextRepositories.some((item) => item.fullName === current)
      ? current
      : nextRepositories.find((item) => item.permissions.push)?.fullName || nextRepositories[0]?.fullName || "");
    setNewOwner((current) => current && nextOwners.some((item) => item.login === current)
      ? current
      : nextOwners.find((item) => item.kind === "personal")?.login || nextOwners[0]?.login || "");
    return { repositories: nextRepositories, owners: nextOwners };
  }

  async function loadStatus() {
    try {
      const result = await request("/api/local-github-app/status");
      const next = statusFrom(result);
      setStatus(next);
      if (next.authenticated) await loadChoices();
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
    if (nameEdited || !status.authenticated || !newOwner || !newTitle.trim()) return;
    const fallback = localRepositorySuggestion(newTitle, newOwner, repositories);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setNewName(fallback);
      setNameSuggestionPending(true);
      void request("/api/local-github-app/name-suggestion", "POST", { owner: newOwner, name: newTitle })
        .then((result) => {
          if (!cancelled && typeof result.name === "string") setNewName(result.name);
        })
        .catch(() => {
          // The local repository list remains a safe fallback when GitHub cannot refresh a suggestion.
        })
        .finally(() => { if (!cancelled) setNameSuggestionPending(false); });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [nameEdited, newOwner, newTitle, repositories, status.authenticated]);

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
          await loadChoices();
          onMessage(`Connected GitHub account ${next.identity?.login || "successfully"}. Choose or create a story project below.`);
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

  async function finalizeConnection(result: Record<string, unknown>) {
    const checked = await request("/api/local-github/connection/check", "POST");
    const repository = repositoryFrom(result.repository);
    onConnected({
      owner: String(checked.owner ?? repository?.owner ?? ""),
      repo: String(checked.repo ?? repository?.name ?? ""),
      branch: String(checked.branch ?? repository?.defaultBranch ?? "main"),
      projectPath: String(checked.projectPath ?? projectPath),
      repositoryUrl: String(checked.repositoryUrl ?? repository?.htmlUrl ?? ""),
      login: String(checked.login ?? status.identity?.login ?? ""),
      verifiedAt: String(checked.verifiedAt ?? ""),
      ready: Boolean(checked.ready),
      checks: Array.isArray(checked.checks) ? checked.checks : [],
    });
  }

  async function connectRepository(initializeMissingManifest = false) {
    if (!selected) {
      onMessage("Choose a story repository first.");
      return;
    }
    setBusy(true);
    setPendingInitialization(null);
    onMessage(initializeMissingManifest
      ? "Adding the missing PlotPickle setup files without replacing existing repository files…"
      : "Checking the story repository, PlotPickle manifest and required permissions…");
    try {
      const result = await request("/api/local-github-app/select", "POST", {
        fullName: selected,
        projectPath,
        initializeMissingManifest,
        title: newTitle,
        projectId: projectId(),
      });
      if (result.requiresInitialization) {
        const repository = repositoryFrom(result.repository);
        if (!repository) throw new Error("The selected repository could not be prepared for initialization.");
        setPendingInitialization({ repository, message: String(result.message ?? "This repository needs a PlotPickle manifest.") });
        onMessage(String(result.message ?? "Review the repository, then initialize it for PlotPickle."));
        return;
      }
      await finalizeConnection(result);
      onMessage(initializeMissingManifest
        ? "The repository was initialized without replacing its existing files. GitHub collaboration is ready."
        : "PlotPickle found the story project manifest, selected its approved branch and confirmed readiness.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "The selected GitHub repository could not be connected.");
    } finally {
      setBusy(false);
    }
  }

  async function createRepository() {
    const title = newTitle.trim();
    const name = repositorySlug(newName || title);
    if (!title) {
      onMessage("Enter the story title before creating its GitHub project.");
      return;
    }
    if (!name) {
      onMessage("Enter a valid repository name.");
      return;
    }
    if (!newOwner) {
      onMessage("Choose the account or organization that will own the story project.");
      return;
    }
    setBusy(true);
    onMessage("Creating the private story project, manifest and collaboration files…");
    try {
      const result = await request("/api/local-github-app/create", "POST", {
        owner: newOwner,
        title,
        name,
        private: newPrivate,
        projectPath,
        projectId: projectId(),
      });
      await loadChoices();
      await finalizeConnection(result);
      const repository = repositoryFrom(result.repository);
      const createdName = repository?.name || String(result.resolvedName || name);
      setNewName(createdName);
      const creationMode = result.creationMode === "template" ? "the configured PlotPickle template" : "the built-in PlotPickle bootstrap";
      const collisionNote = result.collisionAdjusted ? ` ${name} already existed, so PlotPickle used ${createdName}.` : "";
      onMessage(`Created ${newOwner}/${createdName} using ${creationMode}.${collisionNote} The story project is private by default and ready for collaboration.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "The GitHub story project could not be created.");
    } finally {
      setBusy(false);
    }
  }

  function updateTitle(value: string) {
    setNewTitle(value);
    if (!nameEdited) setNewName(localRepositorySuggestion(value, newOwner, repositories));
  }

  return (
    <div className={styles.appConnection}>
      <div className={styles.appConnectionIntro}>
        <div>
          <strong>Recommended: connect your GitHub account</strong>
          <p>Sign in through GitHub, then choose an existing story project or create a private one with the required PlotPickle files.</p>
        </div>
        <span className={status.authenticated ? styles.accountReady : styles.accountWaiting}>{status.authenticated ? "Account connected" : status.configured ? "Account not connected" : "App setup required"}</span>
      </div>

      {!status.configured ? (
        <div key="github-app-unavailable" className={styles.appUnavailable}>
          <strong>The PlotPickle GitHub App is not configured in this build.</strong>
          <p>Set <code>PLOTPICKLE_GITHUB_APP_CLIENT_ID</code> on the local server after registering the app. Fine-grained-token setup remains available under Advanced Setup below.</p>
        </div>
      ) : !status.authenticated ? (
        <div key="github-app-sign-in" className={styles.appStart}>
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
        <div key="github-app-repositories" className={styles.repositoryPicker}>
          <div className={styles.accountCard}>
            {status.identity?.avatarUrl ? <img src={status.identity.avatarUrl} alt="" /> : null}
            <div><span>Signed in as</span><strong>{status.identity?.name || status.identity?.login}</strong><small>@{status.identity?.login}</small></div>
            {status.installUrl ? <a href={status.installUrl} target="_blank" rel="noreferrer">Manage repository access</a> : null}
          </div>

          <div className={styles.setupTabs} role="tablist" aria-label="Story project setup">
            <button type="button" role="tab" aria-selected={mode === "existing"} className={mode === "existing" ? styles.activeTab : ""} onClick={() => setMode("existing")}>Use existing project</button>
            <button type="button" role="tab" aria-selected={mode === "create"} className={mode === "create" ? styles.activeTab : ""} onClick={() => setMode("create")}>Create new story project</button>
          </div>

          {mode === "existing" ? (
            <div className={styles.setupPane}>
              <label>
                <span>Story project</span>
                <select value={selected} onChange={(event) => { setSelected(event.target.value); setPendingInitialization(null); }} disabled={disabled || busy || !repositories.length}>
                  {repositories.length ? repositories.map((repository) => (
                    <option key={`${repository.installationId}:${repository.id}`} value={repository.fullName} disabled={!repository.permissions.push}>
                      {repository.fullName} · {repository.private ? "Private" : "Public"}{repository.permissions.push ? "" : " · Read only"}
                    </option>
                  )) : <option value="">No accessible repositories found</option>}
                </select>
                <small>PlotPickle checks for <code>plotpickle-project.json</code> and automatically uses the repository’s approved default branch.</small>
              </label>
              <div className={styles.actions}>
                <button type="button" className={styles.primary} disabled={disabled || busy || !selected} onClick={() => void connectRepository(false)}>{busy ? "Checking…" : "Use selected story project"}</button>
                <button type="button" disabled={disabled || busy} onClick={() => void loadChoices()}>Refresh projects</button>
              </div>
              {pendingInitialization ? (
                <div className={styles.initializationCard}>
                  <strong>PlotPickle setup is missing</strong>
                  <p>{pendingInitialization.message}</p>
                  <p>Initialization adds the manifest, collaboration template and missing starter folders. Existing files are preserved, and incompatible manifests are never overwritten.</p>
                  <div className={styles.actions}>
                    <button type="button" className={styles.primary} disabled={disabled || busy} onClick={() => void connectRepository(true)}>Initialize this repository</button>
                    {pendingInitialization.repository.htmlUrl ? <a href={pendingInitialization.repository.htmlUrl} target="_blank" rel="noreferrer">Review repository first</a> : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.setupPane}>
              <div className={styles.creationNotice}>
                <strong>Private by default</strong>
                <p>PlotPickle creates a user-owned repository. Repository creation requires the GitHub App’s Administration permission; connecting an existing repository does not.</p>
              </div>
              <div className={styles.creationForm}>
                <label><span>Project owner</span><select value={newOwner} onChange={(event) => { setNameEdited(false); setNewOwner(event.target.value); }} disabled={disabled || busy}>{owners.map((owner) => <option key={owner.login} value={owner.login}>{owner.label} · {owner.kind === "organization" ? "Organization" : "Personal account"}</option>)}</select></label>
                <label><span>Story title</span><input value={newTitle} onChange={(event) => updateTitle(event.target.value)} placeholder="Untitled Story" /></label>
                <label><span>Repository name</span><input value={newName} spellCheck={false} onChange={(event) => { setNameEdited(true); setNewName(repositorySlug(event.target.value)); }} placeholder="untitled-story" /><small>{newOwner || status.identity?.login}/{newName || "repository-name"}{nameSuggestionPending ? " · checking availability…" : repositorySlug(newTitle) && newName.toLowerCase() !== repositorySlug(newTitle).toLowerCase() ? ` · ${repositorySlug(newTitle)} exists; next available name proposed` : " · available name shown before creation"}</small></label>
                <label className={styles.privacyChoice}><input type="checkbox" checked={newPrivate} onChange={(event) => setNewPrivate(event.target.checked)} /><span>Keep this story project private</span></label>
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.primary} disabled={disabled || busy || !newOwner || !newTitle.trim() || !newName} onClick={() => void createRepository()}>{busy ? "Creating…" : "Create story project"}</button>
              </div>
              <p className={styles.credentialNote}>{status.templateRepository ? `Template source: ${status.templateRepository}.` : "No external template is configured, so PlotPickle will use its built-in bootstrap files."} {status.repositoryCreationPermission}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
