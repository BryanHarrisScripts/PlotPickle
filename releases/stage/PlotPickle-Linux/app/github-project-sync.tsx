"use client";

import { useMemo, useState } from "react";
import { applyReviewedGitHubProject, compareCollaborativeProjects } from "@/lib/github-collaboration";
import type { PlotPickleProject } from "@/lib/project";
import styles from "./github-collaboration.module.css";

type SyncDiff = {
  create: number;
  update: number;
  delete: number;
  unchanged: number;
  changed: number;
  changedPaths: string[];
};

type SyncPreview = {
  repository: string;
  branch: string;
  remoteCommit: string;
  projectRoot: string;
  remoteProjectAvailable: boolean;
  migrationRequired: boolean;
  legacyPortablePath: string;
  diff: SyncDiff;
};

type IncomingProject = {
  project: PlotPickleProject;
  remoteCommit: string;
  mode: "modular-folder" | "legacy-ppf";
  migrationRequired: boolean;
};

async function request(path: string, body?: object) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new Error("Canonical GitHub synchronization is available in the downloaded PlotPickle server.");
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof value.message === "string" ? value.message : "Canonical project synchronization failed.");
  return value;
}

function previewFrom(value: Record<string, unknown>): SyncPreview {
  const diff = value.diff && typeof value.diff === "object" ? value.diff as Record<string, unknown> : {};
  return {
    repository: String(value.repository || ""),
    branch: String(value.branch || "main"),
    remoteCommit: String(value.remoteCommit || ""),
    projectRoot: String(value.projectRoot || "project"),
    remoteProjectAvailable: Boolean(value.remoteProjectAvailable),
    migrationRequired: Boolean(value.migrationRequired),
    legacyPortablePath: String(value.legacyPortablePath || ""),
    diff: {
      create: Number(diff.create) || 0,
      update: Number(diff.update) || 0,
      delete: Number(diff.delete) || 0,
      unchanged: Number(diff.unchanged) || 0,
      changed: Number(diff.changed) || 0,
      changedPaths: Array.isArray(diff.changedPaths) ? diff.changedPaths.filter((item): item is string => typeof item === "string") : [],
    },
  };
}

export default function GitHubProjectSync({
  project,
  onChange,
  ready,
  onNotice,
}: {
  project: PlotPickleProject;
  onChange: (project: PlotPickleProject) => void;
  ready: boolean;
  onNotice: (message: string) => void;
}) {
  const [working, setWorking] = useState(false);
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [incoming, setIncoming] = useState<IncomingProject | null>(null);
  const [allowMigration, setAllowMigration] = useState(false);
  const [includeReleaseSnapshot, setIncludeReleaseSnapshot] = useState(false);
  const [commitMessage, setCommitMessage] = useState(`Synchronize approved PlotPickle project files for ${project.metadata.title}`);
  const comparison = useMemo(() => incoming ? compareCollaborativeProjects(project, incoming.project) : null, [incoming, project]);

  function updateCollaboration(remoteCommit: string, pushed = false) {
    const now = new Date().toISOString();
    onChange({
      ...project,
      collaboration: {
        ...project.collaboration,
        provider: "github",
        syncEnabled: true,
        lastPulledCommit: remoteCommit,
        lastPushedCommit: pushed ? remoteCommit : project.collaboration.lastPushedCommit,
        updatedAt: now,
      },
      metadata: { ...project.metadata, updatedAt: now },
    });
  }

  async function compareFiles() {
    setWorking(true);
    try {
      const value = await request("/api/local-github-sync/preview", { project });
      const next = previewFrom(value);
      setPreview(next);
      setAllowMigration(false);
      onNotice(next.migrationRequired
        ? `Migration preview ready. ${next.legacyPortablePath || "The legacy .ppf"} remains preserved while ${next.projectRoot}/ becomes canonical.`
        : next.diff.changed
          ? `${next.diff.changed} canonical project file${next.diff.changed === 1 ? "" : "s"} differ from the approved GitHub version.`
          : "The local canonical project folder matches the approved GitHub version.");
    } catch (error) {
      setPreview(null);
      onNotice(error instanceof Error ? error.message : "Project files could not be compared.");
    } finally { setWorking(false); }
  }

  async function getApprovedFolder() {
    setWorking(true);
    try {
      const value = await request("/api/local-github-sync/pull", {});
      const incomingProject = value.project as PlotPickleProject;
      const mode = value.mode === "legacy-ppf" ? "legacy-ppf" : "modular-folder";
      setIncoming({
        project: incomingProject,
        remoteCommit: String(value.remoteCommit || ""),
        mode,
        migrationRequired: Boolean(value.migrationRequired),
      });
      onNotice(mode === "legacy-ppf"
        ? "The approved legacy .ppf was loaded for migration review. Nothing has been applied or rewritten."
        : "The approved modular project folder was validated and loaded for review. Nothing has been applied.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The approved project folder could not be loaded.");
    } finally { setWorking(false); }
  }

  function applyIncoming() {
    if (!incoming) return;
    const next = applyReviewedGitHubProject(project, incoming.project, incoming.remoteCommit);
    onChange({
      ...next,
      collaboration: {
        ...next.collaboration,
        lastPulledCommit: incoming.remoteCommit,
        updatedAt: new Date().toISOString(),
      },
    });
    setIncoming(null);
    setPreview(null);
    onNotice(incoming.mode === "legacy-ppf"
      ? "The reviewed legacy project is now the local base. Compare files to preview its safe migration to the canonical folder."
      : "The reviewed approved project folder is now the local collaboration base.");
  }

  async function publishApprovedFolder() {
    if (!preview) {
      onNotice("Compare project files before publishing so PlotPickle can guard the approved GitHub commit.");
      return;
    }
    if (preview.migrationRequired && !allowMigration) {
      onNotice("Review and approve the legacy migration before publishing the canonical project folder.");
      return;
    }
    setWorking(true);
    try {
      const value = await request("/api/local-github-sync/publish", {
        project,
        expectedRemoteCommit: preview.remoteCommit,
        allowLegacyMigration: allowMigration,
        includeReleaseSnapshot,
        message: commitMessage,
      });
      const remoteCommit = String(value.remoteCommit || preview.remoteCommit);
      updateCollaboration(remoteCommit, true);
      const diff = value.diff && typeof value.diff === "object" ? value.diff as Record<string, unknown> : {};
      const changed = Number(diff.changed) || 0;
      setPreview(null);
      onNotice(Boolean(value.unchanged)
        ? "The approved GitHub project folder already matches this local project."
        : `${changed} managed project file${changed === 1 ? "" : "s"} synchronized in one guarded GitHub commit${value.migrationCompleted ? "; legacy migration completed" : ""}.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The approved project folder could not be published.");
    } finally { setWorking(false); }
  }

  async function createReleaseSnapshot() {
    if (!preview) {
      onNotice("Compare project files first so the portable release snapshot is tied to the current approved commit.");
      return;
    }
    setWorking(true);
    try {
      const value = await request("/api/local-github-sync/release-snapshot", {
        project,
        expectedRemoteCommit: preview.remoteCommit,
      });
      const snapshot = value.snapshot && typeof value.snapshot === "object" ? value.snapshot as Record<string, unknown> : {};
      const remoteCommit = String(value.remoteCommit || "");
      if (remoteCommit) updateCollaboration(remoteCommit, true);
      setPreview(null);
      onNotice(`Portable .ppf release snapshot created at ${String(snapshot.path || "exports/releases/")}. The canonical project remains the modular folder.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The portable release snapshot could not be created.");
    } finally { setWorking(false); }
  }

  return (
    <section className={styles.panel}>
      <header>
        <div>
          <p>Canonical Git synchronization</p>
          <h3>Readable project files, guarded as one approved revision</h3>
          <span>PlotPickle mirrors the existing modular project engine under <code>project/</code>. JSON and Fountain files receive stable formatting and SHA-256 inventories, while unrelated repository files remain untouched.</span>
        </div>
      </header>

      <div className={styles.syncArchitecture}>
        <article><strong>Compare</strong><span>Inventory local and approved files without writing.</span></article>
        <article><strong>Review</strong><span>Validate and inspect the approved project before applying it.</span></article>
        <article><strong>Publish</strong><span>Project Lead action: one guarded tree and commit, never partial writes.</span></article>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={working || !ready} onClick={() => void compareFiles()}>{working ? "Working…" : "Compare project files"}</button>
        <button type="button" disabled={working || !ready} onClick={() => void getApprovedFolder()}>Get approved project folder</button>
      </div>

      {preview ? (
        <div className={styles.syncPreview}>
          <div className={styles.syncSummary}>
            <span><b>{preview.diff.create}</b> new</span>
            <span><b>{preview.diff.update}</b> changed</span>
            <span><b>{preview.diff.delete}</b> removed</span>
            <span><b>{preview.diff.unchanged}</b> unchanged</span>
          </div>
          <div className={styles.baseState}>
            <span>Approved commit guarded by this preview</span>
            <code>{preview.remoteCommit}</code>
            <span>Canonical project root</span>
            <code>{preview.projectRoot}/</code>
          </div>
          {preview.diff.changedPaths.length ? (
            <details className={styles.syncPaths}>
              <summary>Review {preview.diff.changedPaths.length} managed path{preview.diff.changedPaths.length === 1 ? "" : "s"}</summary>
              <ul>{preview.diff.changedPaths.slice(0, 80).map((path) => <li key={path}><code>{path}</code></li>)}</ul>
            </details>
          ) : <p className={styles.help}>No canonical project files differ.</p>}
          {preview.migrationRequired ? (
            <label className={styles.syncConsent}>
              <input type="checkbox" checked={allowMigration} onChange={(event) => setAllowMigration(event.target.checked)} />
              <span><b>Approve legacy migration</b><small>Keep the existing .ppf for recovery, make {preview.projectRoot}/ canonical and update plotpickle-project.json.</small></span>
            </label>
          ) : null}
          <label className={styles.syncConsent}>
            <input type="checkbox" checked={includeReleaseSnapshot} onChange={(event) => setIncludeReleaseSnapshot(event.target.checked)} />
            <span><b>Also create a portable .ppf release snapshot</b><small>The snapshot goes under exports/releases/ and never becomes the collaboration source of truth.</small></span>
          </label>
          <label className={styles.syncMessage}><span>Approved revision message</span><input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} /></label>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={working || !ready || (preview.migrationRequired && !allowMigration)} onClick={() => void publishApprovedFolder()}>Project Lead: publish approved version</button>
            <button type="button" disabled={working || !ready} onClick={() => void createReleaseSnapshot()}>Create release snapshot only</button>
          </div>
          <p className={styles.credentialNote}>Publishing uses GitHub’s Git Data API to create blobs, one tree and one non-forced commit. If the approved branch moved after this preview, PlotPickle stops before writing.</p>
        </div>
      ) : null}

      {comparison && incoming ? (
        <div className={styles.comparison}>
          <strong>{incoming.mode === "legacy-ppf" ? "Legacy migration review" : "Approved modular project review"}: {comparison.summary}</strong>
          <ul>
            <li>{comparison.changedStoryFields.length} changed story fields</li>
            <li>{comparison.changedBlockNumbers.length} changed Blocks</li>
            <li>{comparison.changedSceneIds.length} changed scenes</li>
            <li>{comparison.changedScreenplayElementIds.length} changed screenplay elements</li>
            <li>{comparison.changedCharacterIds.length} changed characters</li>
            <li>{comparison.changedThreadIds.length} changed Story Threads</li>
          </ul>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={applyIncoming}>Apply reviewed approved version</button>
            <button type="button" onClick={() => setIncoming(null)}>Discard review candidate</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
