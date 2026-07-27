"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./github-collaboration.module.css";
import {
  createPortableProjectFile,
  parsePortableProjectFile,
  portableProjectFileName,
  serializePortableProjectFile,
} from "@/lib/project-package";
import { applyReviewedGitHubProject, compareCollaborativeProjects } from "@/lib/github-collaboration";
import type { PlotPickleProject } from "@/lib/project";

type LibraryItem = { fileName: string; title: string; updatedAt: string; bytes: number; integrityValid: boolean };
type HistoryItem = { sha: string; url: string; message: string; date: string };
type ProposalItem = { number: number; title: string; url: string; state: "open" | "draft" | "merged" | "declined"; author: string; branchName: string; updatedAt: string; mergedAt: string };
type ServerIdentity = { id: string; label: string; createdAt: string };
type ReadinessCheck = {
  id: "repository" | "branch" | "project-path" | "contents-write" | "pull-requests";
  label: string;
  ready: boolean;
  detail: string;
};
type GitHubStatus = {
  connected: boolean;
  ready: boolean;
  state: "disconnected" | "configured" | "checking" | "ready" | "error";
  owner?: string;
  repo?: string;
  branch?: string;
  projectPath?: string;
  login?: string;
  repositoryUrl?: string;
  verifiedAt?: string;
  checks: ReadinessCheck[];
  error?: string;
};

type JsonRequestError = Error & { response?: Record<string, unknown> };

const READINESS_CHECKS: Array<Pick<ReadinessCheck, "id" | "label">> = [
  { id: "repository", label: "Repository access" },
  { id: "branch", label: "Canonical branch" },
  { id: "project-path", label: "Canonical .ppf path" },
  { id: "contents-write", label: "Contents: Read and write" },
  { id: "pull-requests", label: "Pull requests: Read and write" },
];

async function jsonRequest(path: string, method: "GET" | "POST" | "DELETE" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error("Local project services are available in the downloaded PlotPickle server.");
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const error = new Error(typeof value.message === "string" ? value.message : "The local project operation failed.") as JsonRequestError;
    error.response = value;
    throw error;
  }
  return value;
}

function readinessChecks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ReadinessCheck => Boolean(
    item
    && typeof item === "object"
    && READINESS_CHECKS.some((check) => check.id === (item as ReadinessCheck).id)
    && typeof (item as ReadinessCheck).label === "string"
    && typeof (item as ReadinessCheck).ready === "boolean"
    && typeof (item as ReadinessCheck).detail === "string",
  ));
}

function statusFromResponse(value: Record<string, unknown>, fallback: GitHubStatus["state"] = "configured"): GitHubStatus {
  const connected = Boolean(value.connected);
  const ready = Boolean(value.ready);
  return {
    connected,
    ready,
    state: ready ? "ready" : connected ? fallback : "disconnected",
    owner: typeof value.owner === "string" ? value.owner : undefined,
    repo: typeof value.repo === "string" ? value.repo : undefined,
    branch: typeof value.branch === "string" ? value.branch : undefined,
    projectPath: typeof value.projectPath === "string" ? value.projectPath : undefined,
    login: typeof value.login === "string" ? value.login : undefined,
    repositoryUrl: typeof value.repositoryUrl === "string" ? value.repositoryUrl : undefined,
    verifiedAt: typeof value.verifiedAt === "string" ? value.verifiedAt : undefined,
    checks: readinessChecks(value.checks),
  };
}

function readinessLabel(status: GitHubStatus) {
  if (status.state === "ready") return "Ready";
  if (status.state === "checking") return "Checking";
  if (status.state === "error") return "Needs attention";
  if (status.state === "configured") return "Test required";
  return "Not connected";
}

function downloadText(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/vnd.plotpickle.project+json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function proposalStatusLabel(state: ProposalItem["state"]) {
  if (state === "merged") return "Approved and merged";
  if (state === "declined") return "Declined / closed";
  if (state === "draft") return "Draft proposal";
  return "Awaiting owner review";
}

export default function GitHubCollaboration({
  project,
  onChange,
  onConnectionChange,
}: {
  project: PlotPickleProject;
  onChange: (project: PlotPickleProject) => void;
  onConnectionChange?: () => void;
}) {
  const [owner, setOwner] = useState(project.collaboration.owner);
  const [repo, setRepo] = useState(project.collaboration.repo);
  const [branch, setBranch] = useState(project.collaboration.branch || "main");
  const [projectPath, setProjectPath] = useState(project.collaboration.projectPath || `stories/${portableProjectFileName(project)}`);
  const [token, setToken] = useState("");
  const [proposalTitle, setProposalTitle] = useState(`PlotPickle proposal: ${project.metadata.title}`);
  const [proposalNote, setProposalNote] = useState("");
  const [notice, setNotice] = useState("Checking local project storage…");
  const [available, setAvailable] = useState(false);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<GitHubStatus>({
    connected: false,
    ready: false,
    state: "disconnected",
    checks: [],
  });
  const [identity, setIdentity] = useState<ServerIdentity | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [incoming, setIncoming] = useState<{ project: PlotPickleProject; remoteSha: string } | null>(null);

  const sourceRepository = project.collaboration.sourceRepositoryUrl || project.collaboration.repositoryUrl;
  const comparison = useMemo(() => incoming ? compareCollaborativeProjects(project, incoming.project) : null, [incoming, project]);
  const openProposals = proposals.filter((item) => item.state === "open" || item.state === "draft").length;
  const displayedChecks = READINESS_CHECKS.map((definition) => {
    const check = status.checks.find((item) => item.id === definition.id);
    return check ?? {
      ...definition,
      ready: false,
      detail: status.state === "checking"
        ? "Checking…"
        : status.state === "error"
          ? "Not reached after the failed check above."
          : "Waiting for a successful connection test.",
    };
  });

  async function loadProposals() {
    if (!status.ready) return;
    try {
      const result = await jsonRequest("/api/local-github/proposals");
      setProposals(Array.isArray(result.proposals) ? result.proposals as ProposalItem[] : []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Collaboration proposals could not be loaded.");
    }
  }

  async function refresh() {
    try {
      const [local, github, projects, server] = await Promise.all([
        jsonRequest("/api/local-projects/status"),
        jsonRequest("/api/local-github/connection"),
        jsonRequest("/api/local-projects/library"),
        jsonRequest("/api/local-github/identity"),
      ]);
      setAvailable(Boolean(local.available));
      const savedStatus = statusFromResponse(github);
      const nextStatus = savedStatus.connected
        ? { ...savedStatus, ready: false, state: "checking" as const, error: "" }
        : savedStatus;
      setStatus(nextStatus);
      setIdentity({ id: String(server.id ?? ""), label: String(server.label ?? "Local PlotPickle server"), createdAt: String(server.createdAt ?? "") });
      if (github.connected) {
        setOwner(String(github.owner ?? owner));
        setRepo(String(github.repo ?? repo));
        setBranch(String(github.branch ?? branch));
        setProjectPath(String(github.projectPath ?? projectPath));
      }
      setLibrary(Array.isArray(projects.projects) ? projects.projects as LibraryItem[] : []);
      if (!nextStatus.connected) {
        setNotice("Local rolling backups are ready. Follow the three connection steps below whenever you want GitHub collaboration.");
        return;
      }
      try {
        const checked = await jsonRequest("/api/local-github/connection/check", "POST");
        const readyStatus = statusFromResponse(checked);
        setStatus(readyStatus);
        setOwner(String(checked.owner ?? owner));
        setRepo(String(checked.repo ?? repo));
        setBranch(String(checked.branch ?? branch));
        setProjectPath(String(checked.projectPath ?? projectPath));
        setNotice("GitHub is ready. Pull the approved story, make local changes, then submit a pull request for owner approval.");
        onConnectionChange?.();
        const result = await jsonRequest("/api/local-github/proposals");
        setProposals(Array.isArray(result.proposals) ? result.proposals as ProposalItem[] : []);
      } catch (error) {
        const requestError = error as JsonRequestError;
        setStatus({
          ...savedStatus,
          ready: false,
          state: "error",
          checks: readinessChecks(requestError.response?.checks),
          error: requestError.message,
        });
        setProposals([]);
        setNotice(requestError.message);
        onConnectionChange?.();
      }
    } catch (error) {
      setAvailable(false);
      setStatus((current) => ({ ...current, ready: false, state: "error", error: error instanceof Error ? error.message : "Local project services are unavailable." }));
      setNotice(error instanceof Error ? error.message : "Local project services are unavailable.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
    // The initial check intentionally uses project defaults only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateProjectConnection(patch: Partial<PlotPickleProject["collaboration"]>) {
    onChange({
      ...project,
      collaboration: { ...project.collaboration, ...patch, updatedAt: new Date().toISOString() },
      metadata: { ...project.metadata, updatedAt: new Date().toISOString() },
    });
  }

  async function saveLocalBackup() {
    setWorking(true);
    try {
      const result = await jsonRequest("/api/local-projects/save", "POST", { project });
      setNotice(`Saved ${String(result.fileName)}${result.backup ? " and created a rolling backup" : ""}.`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The local backup failed.");
    } finally { setWorking(false); }
  }

  function exportPpf() {
    const portable = createPortableProjectFile(project, "1.0.0-rc.2");
    downloadText(portableProjectFileName(project), serializePortableProjectFile(portable));
    setNotice("Portable .ppf project exported. It contains the canonical story, not GitHub credentials.");
  }

  async function loadLibraryItem(fileName: string) {
    setWorking(true);
    try {
      const result = await jsonRequest(`/api/local-projects/load?file=${encodeURIComponent(fileName)}`);
      const parsed = parsePortableProjectFile(result.portable);
      setIncoming({ project: parsed.project, remoteSha: `local:${fileName}` });
      setNotice("Local library version loaded for review. The active story has not changed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The local project could not be reviewed.");
    } finally { setWorking(false); }
  }

  async function connectGitHub() {
    setWorking(true);
    setStatus((current) => ({ ...current, ready: false, state: "checking", checks: [], error: "" }));
    setNotice("Checking the repository, branch, .ppf path and required GitHub permissions…");
    try {
      const result = await jsonRequest("/api/local-github/connection", "POST", { owner, repo, branch, projectPath, token });
      setToken("");
      const readyStatus = statusFromResponse(result);
      setStatus(readyStatus);
      updateProjectConnection({
        provider: "github",
        owner,
        repo,
        branch,
        projectPath,
        repositoryUrl: String(result.repositoryUrl ?? `https://github.com/${owner}/${repo}`),
        syncEnabled: true,
        connectedAt: new Date().toISOString(),
      });
      setNotice("GitHub is ready. Canonical changes still require a pull request and repository-owner merge.");
      onConnectionChange?.();
      const proposalResult = await jsonRequest("/api/local-github/proposals");
      setProposals(Array.isArray(proposalResult.proposals) ? proposalResult.proposals as ProposalItem[] : []);
    } catch (error) {
      const requestError = error as JsonRequestError;
      setStatus((current) => ({
        ...current,
        ready: false,
        state: "error",
        checks: readinessChecks(requestError.response?.checks),
        error: requestError.message,
      }));
      setNotice(requestError.message || "GitHub could not be connected.");
      onConnectionChange?.();
    } finally { setWorking(false); }
  }

  async function pullForReview() {
    setWorking(true);
    try {
      const result = await jsonRequest("/api/local-github/pull", "POST");
      const incomingProject = result.project as PlotPickleProject;
      const remoteSha = String(result.remoteSha ?? "");
      setIncoming({ project: incomingProject, remoteSha });
      setNotice("The approved GitHub version was downloaded for comparison. Nothing has been applied.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The approved GitHub story could not be pulled.");
    } finally { setWorking(false); }
  }

  function applyIncoming() {
    if (!incoming) return;
    onChange(applyReviewedGitHubProject(project, incoming.project, incoming.remoteSha));
    setIncoming(null);
    setNotice("The reviewed approved version replaced the active project. Local changes may now be made from this known GitHub base.");
  }

  async function submitProposal() {
    setWorking(true);
    try {
      await jsonRequest("/api/local-projects/save", "POST", { project });
      const result = await jsonRequest("/api/local-github/submit-proposal", "POST", {
        project,
        title: proposalTitle,
        note: proposalNote,
        baseRevision: project.collaboration.lastPulledCommit,
      });
      const commitSha = String(result.commitSha ?? "");
      const pullRequestNumber = Number(result.pullRequestNumber) || 0;
      const pullRequestUrl = String(result.pullRequestUrl ?? "");
      updateProjectConnection({ provider: "github", lastPushedCommit: commitSha, syncEnabled: true });
      setProposalNote("");
      setNotice(`Proposal #${pullRequestNumber} created. The canonical ${branch} branch is unchanged until the repository owner merges it.`);
      await loadProposals();
      if (pullRequestUrl) window.open(pullRequestUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The collaboration proposal failed.");
    } finally { setWorking(false); }
  }

  async function loadHistory() {
    try {
      const result = await jsonRequest("/api/local-github/history");
      setHistory(Array.isArray(result.history) ? result.history as HistoryItem[] : []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "GitHub history could not be loaded.");
    }
  }

  async function disconnectGitHub() {
    if (!window.confirm("Remove the saved GitHub credential from this computer? Local projects, assets and backups will be kept. The token will remain active at GitHub until you revoke it there.")) return;
    setWorking(true);
    try {
      await jsonRequest("/api/local-github/connection", "DELETE");
      setStatus({ connected: false, ready: false, state: "disconnected", checks: [] });
      setProposals([]);
      updateProjectConnection({ provider: "none", syncEnabled: false });
      setNotice("GitHub credentials were removed from this computer. Local projects and backups were kept.");
      onConnectionChange?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The GitHub connection could not be removed.");
    } finally { setWorking(false); }
  }

  const readinessClass = status.state === "ready"
    ? styles.readinessReady
    : status.state === "checking" || status.state === "configured"
      ? styles.readinessChecking
      : status.state === "error"
        ? styles.readinessError
        : styles.readinessDisconnected;

  return (
    <div className={styles.workspace}>
      <section className={styles.hero}>
        <div>
          <p>Collaboration engine</p>
          <h2>Many local PlotPickle servers. One owner-controlled GitHub story.</h2>
          <span>Each computer writes locally and submits its complete change on a unique proposal branch. GitHub records the change as a pull request. Only a repository owner or maintainer can approve it by merging; closing the pull request declines it.</span>
        </div>
        <div className={styles.sourceCard}>
          <strong>{project.metadata.title}</strong>
          <span>{identity?.label || "Local server identity loading…"}</span>
          {identity?.id ? <code>{identity.id}</code> : null}
          {sourceRepository ? <a href={sourceRepository} target="_blank" rel="noreferrer">Open this story’s GitHub repository</a> : <span>No source repository is recorded for this project.</span>}
        </div>
      </section>

      <section className={styles.panel}>
        <header><div><p>Contributor onboarding</p><h3>Define the human agreement before connecting the technical queue</h3><span>Choose the collaboration model, creative roles, canon authority, privacy, credit and rights expectations; create a welcome card and bounded contribution brief; then use GitHub only when repository collaboration is desired.</span></div></header>
        <div className={styles.actions}><a href="/working-together">Open contributor onboarding</a><a href="/read-learn">Read the Working Together handbook</a></div>
      </section>

      <div className={styles.architecture} aria-label="Collaboration architecture">
        <article><b>1</b><strong>Pull approved story</strong><span>Every server starts from the repository’s canonical branch and .ppf revision.</span></article>
        <i>→</i>
        <article><b>2</b><strong>Edit locally</strong><span>Autosave, AI, screenplay, reports, visuals, and production remain private on that computer.</span></article>
        <i>→</i>
        <article><b>3</b><strong>Submit proposal</strong><span>PlotPickle creates a unique branch, commit, and pull request—never a direct canonical write.</span></article>
        <i>→</i>
        <article><b>4</b><strong>Owner decides</strong><span>The repository owner reviews, discusses, merges, or closes the proposal in GitHub.</span></article>
      </div>

      <div className={styles.status} role="status">{notice}</div>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <header><div><p>Project Library</p><h3>Disk files and rolling backups</h3><span>Atomic saves keep the latest 20 safety copies per story on this server.</span></div></header>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={working || !available} onClick={() => void saveLocalBackup()}>Save rolling backup</button>
            <button type="button" onClick={exportPpf}>Export .ppf</button>
          </div>
          <div className={styles.list}>
            {library.length ? library.map((item) => (
              <div className={styles.row} key={item.fileName}>
                <div><strong>{item.title}</strong><span>{item.fileName} · {item.integrityValid ? "Integrity verified" : "Recovery required"}</span></div>
                <button type="button" disabled={working || !item.integrityValid} onClick={() => void loadLibraryItem(item.fileName)}>Review</button>
              </div>
            )) : <p className={styles.help}>No disk projects are listed yet. Save the active story to create the first .ppf file.</p>}
          </div>
        </section>

        <section className={styles.panel}>
          <header className={styles.connectionHeader}>
            <div><p>GitHub Connection</p><h3>{status.connected ? `${status.owner}/${status.repo}` : "Connect a story repository"}</h3><span>The green Ready light appears only after PlotPickle confirms the repository, branch, .ppf destination and both write permissions.</span></div>
            <div className={`${styles.readiness} ${readinessClass}`} role="status" aria-live="polite"><i aria-hidden="true" /><span>{readinessLabel(status)}</span></div>
          </header>
          <div className={styles.connectionGuide}>
            <strong>Connect in three steps</strong>
            <ol>
              <li><span>1</span><p><b>Create a fine-grained GitHub token.</b> Limit it to the one story repository and choose an expiration.</p></li>
              <li><span>2</span><p><b>Set Contents and Pull requests to Read and write.</b> No Administration or workflow permission is required.</p></li>
              <li><span>3</span><p><b>Paste the token once and select Connect GitHub.</b> PlotPickle tests everything before showing Ready.</p></li>
            </ol>
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">Create a fine-grained token in GitHub</a>
          </div>
          <div className={styles.form}>
            <label><span>Owner</span><input value={owner} spellCheck={false} onChange={(event) => setOwner(event.target.value)} placeholder="GitHub username or organization" /></label>
            <label><span>Repository</span><input value={repo} spellCheck={false} onChange={(event) => setRepo(event.target.value)} placeholder="my-plotpickle-story" /></label>
            <label><span>Canonical branch</span><input value={branch} spellCheck={false} onChange={(event) => setBranch(event.target.value)} /></label>
            <label><span>Canonical .ppf path</span><input value={projectPath} spellCheck={false} onChange={(event) => setProjectPath(event.target.value)} /><small>An existing .ppf is integrity-checked. A valid new path is created by the first proposal.</small></label>
            <label className={styles.wide}><span>Fine-grained GitHub token — stored outside the project</span><input type="password" autoComplete="off" spellCheck={false} value={token} onChange={(event) => setToken(event.target.value)} placeholder={status.connected ? "Leave blank to keep the saved token" : "Paste the token from GitHub"} /></label>
          </div>
          <div className={styles.checkList} aria-label="GitHub readiness checks">
            {displayedChecks.map((check) => {
              const failed = status.state === "error" && status.checks.some((item) => item.id === check.id && !item.ready);
              const pending = !check.ready && !failed;
              return (
                <div key={check.id} className={check.ready ? styles.checkReady : failed ? styles.checkError : styles.checkPending}>
                  <i aria-hidden="true" />
                  <span><b>{check.label}</b><small>{check.detail}</small></span>
                  <em>{check.ready ? "Ready" : failed ? "Needs attention" : pending ? "Pending" : "Pending"}</em>
                </div>
              );
            })}
          </div>
          {status.error ? <p className={styles.connectionError}>{status.error}</p> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={working} onClick={() => void connectGitHub()}>{status.state === "checking" ? "Checking…" : status.connected ? "Test and update" : "Connect GitHub"}</button>
            {status.repositoryUrl ? <a href={status.repositoryUrl} target="_blank" rel="noreferrer">Open repository</a> : null}
            {status.connected ? <button type="button" className={styles.dangerAction} disabled={working} onClick={() => void disconnectGitHub()}>Remove GitHub credential</button> : null}
          </div>
          <p className={styles.credentialNote}>The saved token is never placed in a .ppf project, export, report, log or GitHub commit. On Windows, new or updated credential files are encrypted for the current Windows user.</p>
        </section>
      </div>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <header><div><p>Canonical pull</p><h3>Compare the owner-approved version</h3><span>A pull reads only the configured canonical branch. It never reads another server’s unmerged proposal and never changes the active project automatically.</span></div></header>
          <div className={styles.actions}><button type="button" className={styles.primary} disabled={working || !status.ready} onClick={() => void pullForReview()}>Pull approved version for review</button></div>
          {comparison ? (
            <div className={styles.comparison}>
              <strong>{comparison.summary}</strong>
              <ul>
                <li>{comparison.changedStoryFields.length} changed story fields</li>
                <li>{comparison.changedBlockNumbers.length} changed Blocks</li>
                <li>{comparison.changedSceneIds.length} changed scenes</li>
                <li>{comparison.changedScreenplayElementIds.length} changed screenplay elements</li>
                <li>{comparison.changedCharacterIds.length} changed characters</li>
                <li>{comparison.changedThreadIds.length} changed Story Threads</li>
              </ul>
              <div className={styles.actions}>
                <button type="button" className={styles.primary} onClick={applyIncoming}>Apply reviewed version</button>
                <button type="button" onClick={() => setIncoming(null)}>Discard incoming version</button>
              </div>
            </div>
          ) : <p className={styles.help}>Pulling creates a review candidate in memory. Apply it to register the exact canonical .ppf revision as this server’s collaboration base.</p>}
        </section>

        <section className={styles.panel}>
          <header><div><p>Submit local work</p><h3>Create a branch and pull request</h3><span>This server must be based on the latest canonical .ppf. If another proposal was merged first, PlotPickle requires a new pull before submission.</span></div></header>
          <div className={styles.form}>
            <label className={styles.wide}><span>Proposal title</span><input value={proposalTitle} onChange={(event) => setProposalTitle(event.target.value)} /></label>
            <label className={styles.wide}><span>Contributor note</span><textarea rows={4} value={proposalNote} onChange={(event) => setProposalNote(event.target.value)} placeholder="Explain what changed, why, and anything the owner should inspect closely." /></label>
          </div>
          <div className={styles.baseState}><span>Known canonical .ppf revision</span><code>{project.collaboration.lastPulledCommit || "Pull required before first proposal to an existing project"}</code></div>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={working || !status.ready} onClick={() => void submitProposal()}>Submit changes for owner approval</button>
            <button type="button" disabled={!status.ready} onClick={() => void loadProposals()}>Refresh proposals</button>
          </div>
        </section>
      </div>

      <section className={styles.panel}>
        <header><div><p>Repository review queue</p><h3>{openProposals} proposal{openProposals === 1 ? "" : "s"} awaiting a decision</h3><span>All connected PlotPickle servers submit into this shared GitHub pull-request queue. GitHub permissions and branch protection remain authoritative.</span></div><button type="button" disabled={!status.ready} onClick={() => void loadProposals()}>Refresh</button></header>
        <div className={styles.proposalList}>
          {proposals.length ? proposals.map((item) => (
            <article key={item.number}>
              <div><span className={styles[item.state]}>{proposalStatusLabel(item.state)}</span><strong>#{item.number} · {item.title}</strong><small>{item.author} · {item.branchName} · {item.updatedAt}</small></div>
              {item.url ? <a href={item.url} target="_blank" rel="noreferrer">Review in GitHub</a> : null}
            </article>
          )) : <p className={styles.help}>No PlotPickle proposal pull requests are listed yet.</p>}
        </div>
      </section>

      <section className={styles.panel}>
        <header><div><p>Approved history</p><h3>Canonical .ppf commits</h3><span>History is read from the configured canonical branch and project path—not from unmerged proposals.</span></div></header>
        <div className={styles.actions}><button type="button" disabled={!status.ready} onClick={() => void loadHistory()}>Refresh approved history</button></div>
        <div className={styles.list}>
          {history.map((item) => <div className={styles.row} key={item.sha}><div><strong>{item.message.split("\n")[0]}</strong><span>{item.sha.slice(0, 10)} · {item.date}</span></div>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">Open</a> : null}</div>)}
        </div>
      </section>
    </div>
  );
}
