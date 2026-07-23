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
type GitHubStatus = {
  connected: boolean;
  owner?: string;
  repo?: string;
  branch?: string;
  projectPath?: string;
  repositoryUrl?: string;
  verifiedAt?: string;
};

async function jsonRequest(path: string, method: "GET" | "POST" | "DELETE" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error("Local project services are available in the downloaded PlotPickle server.");
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof value.message === "string" ? value.message : "The local project operation failed.");
  return value;
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

export default function GitHubCollaboration({ project, onChange }: { project: PlotPickleProject; onChange: (project: PlotPickleProject) => void }) {
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
  const [status, setStatus] = useState<GitHubStatus>({ connected: false });
  const [identity, setIdentity] = useState<ServerIdentity | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [incoming, setIncoming] = useState<{ project: PlotPickleProject; remoteSha: string } | null>(null);

  const sourceRepository = project.collaboration.sourceRepositoryUrl || project.collaboration.repositoryUrl;
  const comparison = useMemo(() => incoming ? compareCollaborativeProjects(project, incoming.project) : null, [incoming, project]);
  const openProposals = proposals.filter((item) => item.state === "open" || item.state === "draft").length;

  async function loadProposals() {
    if (!status.connected) return;
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
      const nextStatus: GitHubStatus = {
        connected: Boolean(github.connected),
        owner: typeof github.owner === "string" ? github.owner : undefined,
        repo: typeof github.repo === "string" ? github.repo : undefined,
        branch: typeof github.branch === "string" ? github.branch : undefined,
        projectPath: typeof github.projectPath === "string" ? github.projectPath : undefined,
        repositoryUrl: typeof github.repositoryUrl === "string" ? github.repositoryUrl : undefined,
        verifiedAt: typeof github.verifiedAt === "string" ? github.verifiedAt : undefined,
      };
      setStatus(nextStatus);
      setIdentity({ id: String(server.id ?? ""), label: String(server.label ?? "Local PlotPickle server"), createdAt: String(server.createdAt ?? "") });
      if (github.connected) {
        setOwner(String(github.owner ?? owner));
        setRepo(String(github.repo ?? repo));
        setBranch(String(github.branch ?? branch));
        setProjectPath(String(github.projectPath ?? projectPath));
      }
      setLibrary(Array.isArray(projects.projects) ? projects.projects as LibraryItem[] : []);
      setNotice(github.connected
        ? "This server is connected. Pull the approved story, make local changes, then submit a pull request for owner approval."
        : "Local rolling backups are ready. GitHub collaboration remains optional.");
      if (nextStatus.connected) {
        const result = await jsonRequest("/api/local-github/proposals");
        setProposals(Array.isArray(result.proposals) ? result.proposals as ProposalItem[] : []);
      }
    } catch (error) {
      setAvailable(false);
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
    try {
      const result = await jsonRequest("/api/local-github/connection", "POST", { owner, repo, branch, projectPath, token });
      setToken("");
      setStatus({ connected: true, owner, repo, branch, projectPath, repositoryUrl: String(result.repositoryUrl ?? ""), verifiedAt: String(result.verifiedAt ?? "") });
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
      setNotice("GitHub repository connected. Canonical changes require a pull request and repository-owner merge.");
      const proposalResult = await jsonRequest("/api/local-github/proposals");
      setProposals(Array.isArray(proposalResult.proposals) ? proposalResult.proposals as ProposalItem[] : []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "GitHub could not be connected.");
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
    setWorking(true);
    try {
      await jsonRequest("/api/local-github/connection", "DELETE");
      setStatus({ connected: false });
      setProposals([]);
      updateProjectConnection({ provider: "none", syncEnabled: false });
      setNotice("GitHub credentials were removed from this computer. Local projects and backups were kept.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The GitHub connection could not be removed.");
    } finally { setWorking(false); }
  }

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
          {sourceRepository ? <a href={sourceRepository} target="_blank" rel="noreferrer">Open this story's GitHub repository</a> : <span>No source repository is recorded for this project.</span>}
        </div>
      </section>

      <div className={styles.architecture} aria-label="Collaboration architecture">
        <article><b>1</b><strong>Pull approved story</strong><span>Every server starts from the repository's canonical branch and .ppf revision.</span></article>
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
          <header><div><p>GitHub Connection</p><h3>{status.connected ? `${status.owner}/${status.repo}` : "Connect a story repository"}</h3><span>The configured branch is the owner-approved source of truth. Proposal branches are created automatically per server and submission.</span></div></header>
          <div className={styles.form}>
            <label><span>Owner</span><input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="GitHub username or organization" /></label>
            <label><span>Repository</span><input value={repo} onChange={(event) => setRepo(event.target.value)} placeholder="my-plotpickle-story" /></label>
            <label><span>Canonical branch</span><input value={branch} onChange={(event) => setBranch(event.target.value)} /></label>
            <label><span>Canonical .ppf path</span><input value={projectPath} onChange={(event) => setProjectPath(event.target.value)} /></label>
            <label className={styles.wide}><span>GitHub token — stored outside the project</span><input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder={status.connected ? "Leave blank to keep the saved token" : "Token with contents and pull-request access"} /></label>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={working} onClick={() => void connectGitHub()}>{status.connected ? "Test and update" : "Connect GitHub"}</button>
            {status.repositoryUrl ? <a href={status.repositoryUrl} target="_blank" rel="noreferrer">Open repository</a> : null}
            {status.connected ? <button type="button" disabled={working} onClick={() => void disconnectGitHub()}>Remove connection</button> : null}
          </div>
        </section>
      </div>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <header><div><p>Canonical pull</p><h3>Compare the owner-approved version</h3><span>A pull reads only the configured canonical branch. It never reads another server's unmerged proposal and never changes the active project automatically.</span></div></header>
          <div className={styles.actions}><button type="button" className={styles.primary} disabled={working || !status.connected} onClick={() => void pullForReview()}>Pull approved version for review</button></div>
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
          ) : <p className={styles.help}>Pulling creates a review candidate in memory. Apply it to register the exact canonical .ppf revision as this server's collaboration base.</p>}
        </section>

        <section className={styles.panel}>
          <header><div><p>Submit local work</p><h3>Create a branch and pull request</h3><span>This server must be based on the latest canonical .ppf. If another proposal was merged first, PlotPickle requires a new pull before submission.</span></div></header>
          <div className={styles.form}>
            <label className={styles.wide}><span>Proposal title</span><input value={proposalTitle} onChange={(event) => setProposalTitle(event.target.value)} /></label>
            <label className={styles.wide}><span>Contributor note</span><textarea rows={4} value={proposalNote} onChange={(event) => setProposalNote(event.target.value)} placeholder="Explain what changed, why, and anything the owner should inspect closely." /></label>
          </div>
          <div className={styles.baseState}><span>Known canonical .ppf revision</span><code>{project.collaboration.lastPulledCommit || "Pull required before first proposal to an existing project"}</code></div>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={working || !status.connected} onClick={() => void submitProposal()}>Submit changes for owner approval</button>
            <button type="button" disabled={!status.connected} onClick={() => void loadProposals()}>Refresh proposals</button>
          </div>
        </section>
      </div>

      <section className={styles.panel}>
        <header><div><p>Repository review queue</p><h3>{openProposals} proposal{openProposals === 1 ? "" : "s"} awaiting a decision</h3><span>All connected PlotPickle servers submit into this shared GitHub pull-request queue. GitHub permissions and branch protection remain authoritative.</span></div><button type="button" disabled={!status.connected} onClick={() => void loadProposals()}>Refresh</button></header>
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
        <div className={styles.actions}><button type="button" disabled={!status.connected} onClick={() => void loadHistory()}>Refresh approved history</button></div>
        <div className={styles.list}>
          {history.map((item) => <div className={styles.row} key={item.sha}><div><strong>{item.message.split("\n")[0]}</strong><span>{item.sha.slice(0, 10)} · {item.date}</span></div>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">Open</a> : null}</div>)}
        </div>
      </section>
    </div>
  );
}
