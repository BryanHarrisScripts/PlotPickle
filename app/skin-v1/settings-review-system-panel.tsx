"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PROJECT_LIBRARY_CHANGED_EVENT,
  initializeProjectLibrary,
  listHumanArchivedLibraryProjects,
  restoreArchivedLibraryProject,
  saveActiveLibraryProject,
  switchActiveLibraryProject,
  type LibraryPPFProject,
  type ProjectLibrarySummary,
} from "../../core/storage/project-library-browser";
import {
  createProfileRecoveryPoint,
  flushProfilePrivateWrites,
  listProfileRecoveryPoints,
  persistActiveProfileProject,
  type ProfileRecoveryPoint,
} from "../../core/storage/profile-private-browser";
import styles from "./settings-review-system-panel.module.css";

export type ReviewSettingsSystemId = "advanced";

export const REVIEW_SETTINGS_SYSTEM_IDS = ["advanced"] as const satisfies readonly ReviewSettingsSystemId[];

export function isReviewSettingsSystemId(value: string): value is ReviewSettingsSystemId {
  return (REVIEW_SETTINGS_SYSTEM_IDS as readonly string[]).includes(value);
}

type StorageStatus = {
  available: boolean;
  home: string;
  projectsPath: string;
  backupsPath: string;
  backupLimit: number;
};

type ProjectFile = {
  fileName: string;
  title: string;
  updatedAt: string;
  bytes: number;
  integrityValid: boolean;
};

type BackupFile = {
  fileName: string;
  bytes: number;
  createdAt?: string;
  projectId?: string;
  title?: string;
};

async function requestJson(path: string) {
  const response = await fetch(path, { headers: { Accept: "application/json" } });
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error("Local project services are available in the downloaded PlotPickle server.");
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof value.message === "string" ? value.message : "Local project data could not be read.");
  return value;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}


function displayDate(value: string | undefined | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function recoveryStats(project: LibraryPPFProject) {
  const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const storyboard = project.build.foundations.visualArtifacts.filter((artifact) => artifact.workflow === "storyboard-frame-webp-v2");
  return {
    storyboard: storyboard.length,
    locked: storyboard.filter((artifact) => artifact.reviewState === "accepted" || accepted.has(artifact.id)).length,
    characters: project.worldMap.characterVisuals.reduce((count, item) => count + item.references.length, 0),
    writing: project.writing.entries.length,
  };
}

export default function SettingsReviewSystemPanel({
  systemId,
  embedded = false,
  content: contentMode = "all",
}: {
  readonly systemId: ReviewSettingsSystemId;
  readonly embedded?: boolean;
  readonly content?: "all" | "source" | "recovery";
}) {
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [projects, setProjects] = useState<ProjectFile[]>([]);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [recoveryPoints, setRecoveryPoints] = useState<readonly ProfileRecoveryPoint[]>([]);
  const [archivedStories, setArchivedStories] = useState<readonly ProjectLibrarySummary[]>([]);
  const [selectedRecoveryPointId, setSelectedRecoveryPointId] = useState("");
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const [recoveryWorking, setRecoveryWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshStorage = useCallback(async () => {
    setLoading(true);
    setError("");
    setRecoveryPoints(listProfileRecoveryPoints());
    setArchivedStories(listHumanArchivedLibraryProjects());
    try {
      const [status, library, backupResponse] = await Promise.all([
        requestJson("/api/local-projects/status"),
        requestJson("/api/local-projects/library"),
        requestJson("/api/local-projects/backups"),
      ]);
      setStorage({
        available: Boolean(status.available),
        home: String(status.home ?? ""),
        projectsPath: String(status.projectsPath ?? ""),
        backupsPath: String(status.backupsPath ?? ""),
        backupLimit: Number(status.backupLimit) || 20,
      });
      setProjects(Array.isArray(library.projects) ? library.projects as ProjectFile[] : []);
      setBackups(Array.isArray(backupResponse.backups) ? backupResponse.backups as BackupFile[] : []);
    } catch (cause) {
      setStorage(null);
      setProjects([]);
      setBackups([]);
      setError(cause instanceof Error ? cause.message : "Local project data could not be read.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (contentMode === "source") return;
    const refresh = () => { void refreshStorage(); };
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    };
  }, [refreshStorage, contentMode]);

  async function createManualRecoveryPoint() {
    if (recoveryWorking) return;
    const project = initializeProjectLibrary().activeProject;
    if (!project) {
      setRecoveryNotice("Open a Library story before creating a recovery point.");
      return;
    }
    setRecoveryWorking(true);
    try {
      const point = await createProfileRecoveryPoint(project, "manual");
      await flushProfilePrivateWrites();
      setRecoveryPoints(listProfileRecoveryPoints());
      setSelectedRecoveryPointId(point.id);
      setRecoveryNotice(`Recovery point created for ${project.title} at ${displayDate(point.createdAt)}.`);
    } catch (cause) {
      setRecoveryNotice(cause instanceof Error ? cause.message : "PlotPickle could not create the recovery point.");
    } finally {
      setRecoveryWorking(false);
    }
  }

  async function restoreRecoveryPoint(point: ProfileRecoveryPoint) {
    if (recoveryWorking) return;
    const current = initializeProjectLibrary().activeProject;
    const confirmed = window.confirm(
      `Restore ${point.title} from ${displayDate(point.createdAt)}? PlotPickle will create a new recovery point for the current state before replacing the selected story.`,
    );
    if (!confirmed) return;
    setRecoveryWorking(true);
    try {
      if (current) await createProfileRecoveryPoint(current, "pre-restore");
      const archived = listHumanArchivedLibraryProjects().some((item) => item.id === point.projectId);
      if (archived) restoreArchivedLibraryProject(point.projectId);
      switchActiveLibraryProject(point.projectId);
      const restoredAt = new Date().toISOString();
      const restored = {
        ...point.project,
        sourceEvidence: {
          ...point.project.sourceEvidence,
          resumeProvenance: {
            kind: "recovery" as const,
            sourceAt: point.createdAt,
            restoredAt,
          },
        },
      };
      saveActiveLibraryProject(restored);
      await persistActiveProfileProject();
      await flushProfilePrivateWrites();
      setRecoveryPoints(listProfileRecoveryPoints());
      setArchivedStories(listHumanArchivedLibraryProjects());
      setRecoveryNotice(`${point.title} was restored from the recovery point dated ${displayDate(point.createdAt)}. The previous current state was preserved as a new recovery point.`);
    } catch (cause) {
      setRecoveryNotice(cause instanceof Error ? cause.message : "PlotPickle could not restore the selected recovery point.");
    } finally {
      setRecoveryWorking(false);
    }
  }

  async function restoreArchiveStory(item: ProjectLibrarySummary) {
    if (recoveryWorking) return;
    if (!window.confirm(`Restore ${item.title} from Archive to Library?`)) return;
    setRecoveryWorking(true);
    try {
      restoreArchivedLibraryProject(item.id);
      await persistActiveProfileProject();
      await flushProfilePrivateWrites();
      setArchivedStories(listHumanArchivedLibraryProjects());
      setRecoveryNotice(`${item.title} was restored to Library from Archive.`);
    } catch (cause) {
      setRecoveryNotice(cause instanceof Error ? cause.message : "PlotPickle could not restore the archived story.");
    } finally {
      setRecoveryWorking(false);
    }
  }

  if (systemId !== "advanced") return null;

  const selectedRecoveryPoint = recoveryPoints.find((point) => point.id === selectedRecoveryPointId) ?? null;
  const selectedStats = selectedRecoveryPoint ? recoveryStats(selectedRecoveryPoint.project) : null;

  const content = (
    <>
      <section className={styles.cardGrid} aria-label={contentMode === "source" ? "Source reference" : "Data recovery references"}>
        {contentMode !== "recovery" ? <article className={styles.card} data-settings-review-item="advanced-source">
          <div className={styles.cardHeader}>
            <h3>PlotPickle Source</h3>
            <span className={styles.status}>Reference</span>
          </div>
          <p>The PlotPickle code repository remains available as the source, support and release reference.</p>
          <a className={styles.action} href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Open PlotPickle source repository</a>
        </article> : null}

        {contentMode !== "source" ? <article className={styles.card} data-settings-review-item="advanced-data">
          <div className={styles.cardHeader}>
            <h3>Data Recovery</h3>
            <span className={styles.status}>{loading ? "Checking" : "Ready"}</span>
          </div>
          <p>Choose an intentional profile-local recovery point by date. Previewing does not change the active story. Restoring always preserves the current state as a new recovery point first.</p>
          <div className={styles.refreshRow}>
            <button type="button" className={styles.action} onClick={() => void refreshStorage()} disabled={loading || recoveryWorking}>{loading ? "Checking recovery data…" : "Refresh recovery data"}</button>
            <button type="button" className={styles.action} onClick={() => void createManualRecoveryPoint()} disabled={recoveryWorking}>Create recovery point now</button>
          </div>
          {recoveryNotice ? <p role="status">{recoveryNotice}</p> : null}
          {error ? <p className={styles.error} role="status">{error} Profile-local recovery points remain available even when the legacy disk-project service is unavailable.</p> : null}

          <div className={styles.storageGrid}>
            <div>
              <h4>Profile Library recovery points</h4>
              {recoveryPoints.length ? <ul className={styles.dataList}>{recoveryPoints.map((point) => (
                <li key={point.id}>
                  <strong>{point.title} · {displayDate(point.createdAt)}</strong>
                  <span>Revision {point.revision} · {point.reason === "pre-restore" ? "pre-restore safety point" : point.reason === "unload" ? "safe unload point" : "manual recovery point"}</span>
                  <button type="button" disabled={recoveryWorking} onClick={() => setSelectedRecoveryPointId(point.id)}>Preview</button>
                </li>
              ))}</ul> : <p className={styles.empty}>No profile-local recovery points yet. PlotPickle creates one on safe unload, before a recovery restore, or when you create one here.</p>}
            </div>

            {selectedRecoveryPoint && selectedStats ? <div>
              <h4>Recovery preview</h4>
              <p><strong>{selectedRecoveryPoint.title}</strong> from {displayDate(selectedRecoveryPoint.createdAt)}</p>
              <p>Revision {selectedRecoveryPoint.revision} · {selectedStats.storyboard} Storyboard images · {selectedStats.locked} locked · {selectedStats.characters} character images · {selectedStats.writing} writing sections.</p>
              <p>Previewing has not changed the active Library story.</p>
              <button type="button" className={styles.action} disabled={recoveryWorking} onClick={() => void restoreRecoveryPoint(selectedRecoveryPoint)}>Restore entire story</button>
            </div> : null}

            <div>
              <h4>Archive</h4>
              <p>Archive is reversible shelving, not a recovery point.</p>
              {archivedStories.length ? <ul className={styles.dataList}>{archivedStories.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span>Archived {displayDate(item.archivedAt)}</span>
                  <button type="button" disabled={recoveryWorking} onClick={() => void restoreArchiveStory(item)}>Restore to Library</button>
                </li>
              ))}</ul> : <p className={styles.empty}>No archived stories.</p>}
            </div>

            {storage ? <>
              <dl className={styles.pathList}>
                <div><dt>Legacy local data home</dt><dd>{storage.home || "Not reported"}</dd></div>
                <div><dt>Legacy project files</dt><dd>{storage.projectsPath || "Not reported"}</dd></div>
                <div><dt>Legacy rolling backups</dt><dd>{storage.backupsPath || "Not reported"}</dd></div>
                <div><dt>Legacy backup retention</dt><dd>{storage.backupLimit} restore points</dd></div>
              </dl>
              <div>
                <h4>Legacy disk recovery inventory</h4>
                <p>These older local-project files remain visible for migration/review but are not automatically merged into the profile Library.</p>
                {backups.length ? <ul className={styles.dataList}>{backups.slice(0, 12).map((backup) => <li key={backup.fileName}><strong>{backup.title || backup.fileName}</strong><span>{displayDate(backup.createdAt)} · {formatBytes(backup.bytes)}</span></li>)}</ul> : <p className={styles.empty}>No legacy rolling restore points were reported.</p>}
              </div>
            </> : null}
          </div>
        </article> : null}
      </section>

      {contentMode !== "source" ? <section className={styles.boundary} aria-label="Project data recovery boundaries">
        <strong>Intentional recovery only</strong>
        <p>Library resume never selects an older state. Data Recovery is the explicit place to preview and restore a dated project state. Archive remains reversible shelving. Every destructive recovery preserves the current state first and requires Human confirmation.</p>
      </section> : null}
    </>
  );

  if (embedded) {
    return <div className={styles.embedded} data-settings-reference-content={contentMode}>{content}</div>;
  }

  return (
    <div className={styles.surface} data-settings-review-surface="advanced" data-settings-review-state="in-review">
      <section className={styles.hero} aria-labelledby="settings-review-advanced-title">
        <p className={styles.eyebrow}>SETTINGS / ADVANCED</p>
        <h2 id="settings-review-advanced-title">Advanced</h2>
        <p>Reference PlotPickle source information and review the local project data and recovery storage already maintained by this computer.</p>
      </section>
      {content}
    </div>
  );
}
