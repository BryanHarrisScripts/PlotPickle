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

export default function GitHubCollaboration({ project, onChange }: { project: PlotPickleProject; onChange: (project: PlotPickleProject) => void }) {
  const [owner, setOwner] = useState(project.collaboration.owner);
  const [repo, setRepo] = useState(project.collaboration.repo);
  const [branch, setBranch] = useState(project.collaboration.branch || "main");
  const [projectPath, setProjectPath] = useState(project.collaboration.projectPath || `stories/${portableProjectFileName(project)}`);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState(`Back up ${project.metadata.title} from PlotPickle`);
  const [notice, setNotice] = useState("Checking local project storage…");
  const [available, setAvailable] = useState(false);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<GitHubStatus>({ connected: false });
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [incoming, setIncoming] = useState<{ project: PlotPickleProject; remoteSha: string } | null>(null);

  const sourceRepository = project.collaboration.sourceRepositoryUrl || project.collaboration.repositoryUrl;
  const comparison = useMemo(() => incoming ? compareCollaborativeProjects(project, incoming.project) : null, [incoming, project]);

  async function refresh() {
    try {
      const [local, github, projects] = await Promise.all([
        jsonRequest("/api/local-projects/status"),
        jsonRequest("/api/local-github/connection"),
        jsonRequest("/api/local-projects/library"),
      ]);
      setAvailable(Boolean(local.available));
      setStatus({
        connected: Boolean(github.connected),
        owner: typeof github.owner === "string" ? github.owner : undefined,
        repo: typeof github.repo === "string" ? github.repo : undefined,
        branch: typeof github.branch === "string" ? github.branch : undefined,
        projectPath: typeof github.projectPath === "string" ? github.projectPath : undefined,
        repositoryUrl: typeof github.repositoryUrl === "string" ? github.repositoryUrl : undefined,
        verifiedAt: typeof github.verifiedAt === "string" ? github.verifiedAt : undefined,
      });
      if (github.connected) {
        setOwner(String(github.owner ?? owner));
        setRepo(String(github.repo ?? repo));
        setBranch(String(github.branch ?? branch));
        setProjectPath(String(github.projectPath ?? projectPath));
      }
      setLibrary(Array.isArray(projects.projects) ? projects.projects as LibraryItem[] : []);
      setNotice(github.connected ? "Local storage and GitHub collaboration are ready." : "Local rolling backups are ready. GitHub remains optional.");
    } catch (error) {
      setAvailable(false);
      setNotice(error instanceof Error ? error.message : "Local project services are unavailable.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
    // The initial check intentionally uses the project defaults only once.
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
    const portable = createPortableProjectFile(project);
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
      setNotice("GitHub repository connected. The token is stored only by the private local server.");
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
      setNotice("GitHub version downloaded for comparison. Nothing has been applied.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The GitHub story could not be pulled.");
    } finally { setWorking(false); }
  }

  function applyIncoming() {
    if (!incoming) return;
    onChange(applyReviewedGitHubProject(project, incoming.project, incoming.remoteSha));
    setIncoming(null);
    setNotice("The reviewed version replaced the active project. A local rolling backup is recommended now.");
  }

  async function pushBackup() {
    setWorking(true);
    try {
      const result = await jsonRequest("/api/local-github/push", "POST", { project, message });
      const commitSha = String(result.commitSha ?? "");
      updateProjectConnection({ provider: "github", lastPushedCommit: commitSha, syncEnabled: true });
      setNotice(`GitHub backup committed${commitSha ? ` at ${commitSha.slice(0, 8)}` : ""}.`);
      await loadHistory();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The GitHub backup failed.");
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
          <p>Collaboration and recovery</p>
          <h2>Local-first projects with optional GitHub history</h2>
          <span>PlotPickle saves portable .ppf files and rolling backups on this computer. GitHub may be added for shared revision history, branches and collaboration, but local writing never requires a GitHub or cloud account.</span>
        </div>
        <div className={styles.sourceCard}>
          <strong>{project.metadata.title}</strong>
          {sourceRepository ? <a href={sourceRepository} target="_blank" rel="noreferrer">Open this story’s GitHub repository</a> : <span>No source repository is recorded for this project.</span>}
        </div>
      </section>

      <div className={styles.status} role="status">{notice}</div>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <header><div><p>Project Library</p><h3>Disk files and rolling backups</h3><span>Atomic saves keep the latest 20 safety copies per story.</span></div></header>
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
          <header><div><p>GitHub Connection</p><h3>{status.connected ? `${status.owner}/${status.repo}` : "Connect a story repository"}</h3><span>Use a repository you control. Collaborators use normal GitHub permissions, branches and pull requests.</span></div></header>
          <div className={styles.form}>
            <label><span>Owner</span><input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="GitHub username or organization" /></label>
            <label><span>Repository</span><input value={repo} onChange={(event) => setRepo(event.target.value)} placeholder="my-plotpickle-story" /></label>
            <label><span>Branch</span><input value={branch} onChange={(event) => setBranch(event.target.value)} /></label>
            <label><span>.ppf path</span><input value={projectPath} onChange={(event) => setProjectPath(event.target.value)} /></label>
            <label className={styles.wide}><span>GitHub token — stored outside the project</span><input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder={status.connected ? "Leave blank to keep the saved token" : "Fine-grained token with repository contents access"} /></label>
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
          <header><div><p>Pull and Review</p><h3>Compare before applying</h3><span>A pull never changes the active screenplay automatically.</span></div></header>
          <div className={styles.actions}><button type="button" className={styles.primary} disabled={working || !status.connected} onClick={() => void pullForReview()}>Pull GitHub version for review</button></div>
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
          ) : <p className={styles.help}>Pulling creates a review candidate in memory. It is applied only after the writer chooses Apply reviewed version.</p>}
        </section>

        <section className={styles.panel}>
          <header><div><p>Push and History</p><h3>Named GitHub backup</h3><span>Each push first saves a local .ppf copy, then creates a GitHub commit.</span></div></header>
          <div className={styles.form}><label className={styles.wide}><span>Commit message</span><input value={message} onChange={(event) => setMessage(event.target.value)} /></label></div>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={working || !status.connected} onClick={() => void pushBackup()}>Push named backup</button>
            <button type="button" disabled={!status.connected} onClick={() => void loadHistory()}>Refresh history</button>
          </div>
          <div className={styles.list}>
            {history.map((item) => <div className={styles.row} key={item.sha}><div><strong>{item.message.split("\n")[0]}</strong><span>{item.sha.slice(0, 10)} · {item.date}</span></div>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">Open</a> : null}</div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
