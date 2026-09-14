"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function SettingsReviewSystemPanel({ systemId }: { readonly systemId: ReviewSettingsSystemId }) {
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [projects, setProjects] = useState<ProjectFile[]>([]);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshStorage = useCallback(async () => {
    setLoading(true);
    setError("");
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
    const timer = window.setTimeout(() => { void refreshStorage(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshStorage]);

  if (systemId !== "advanced") return null;

  return (
    <div className={styles.surface} data-settings-review-surface="advanced" data-settings-review-state="in-review">
      <section className={styles.hero} aria-labelledby="settings-review-advanced-title">
        <p className={styles.eyebrow}>SETTINGS / ADVANCED</p>
        <h2 id="settings-review-advanced-title">Advanced</h2>
        <p>Reference PlotPickle source information and review the local project data and recovery storage already maintained by this computer.</p>
      </section>

      <section className={styles.cardGrid} aria-label="Advanced settings">
        <article className={styles.card} data-settings-review-item="advanced-source">
          <div className={styles.cardHeader}>
            <h3>PlotPickle Source</h3>
            <span className={styles.status}>Reference</span>
          </div>
          <p>The PlotPickle code repository remains available as the source, support and release reference.</p>
          <a className={styles.action} href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Open PlotPickle source repository</a>
        </article>

        <article className={styles.card} data-settings-review-item="advanced-data">
          <div className={styles.cardHeader}>
            <h3>Project Data and Recovery</h3>
            <span className={styles.status}>{loading ? "Checking" : storage?.available ? "Available" : "Unavailable"}</span>
          </div>
          <p>Review the same local project files and rolling restore points already owned by PlotPickle's local-project gateway. Nothing is restored or changed from this screen.</p>
          <div className={styles.refreshRow}><button type="button" className={styles.action} onClick={() => void refreshStorage()} disabled={loading}>{loading ? "Checking local storage…" : "Refresh local storage"}</button></div>
          {error ? <p className={styles.error} role="status">{error}</p> : null}
          {storage ? (
            <div className={styles.storageGrid}>
              <dl className={styles.pathList}>
                <div><dt>Local data home</dt><dd>{storage.home || "Not reported"}</dd></div>
                <div><dt>Project files</dt><dd>{storage.projectsPath || "Not reported"}</dd></div>
                <div><dt>Rolling backups</dt><dd>{storage.backupsPath || "Not reported"}</dd></div>
                <div><dt>Backup retention</dt><dd>{storage.backupLimit} restore points</dd></div>
              </dl>

              <div>
                <h4>Project files</h4>
                {projects.length ? <ul className={styles.dataList}>{projects.slice(0, 12).map((project) => <li key={project.fileName}><strong>{project.title || project.fileName}</strong><span>{project.fileName} · {formatBytes(project.bytes)} · {project.integrityValid ? "Integrity verified" : "Needs review"}</span></li>)}</ul> : <p className={styles.empty}>No local project files were reported.</p>}
              </div>

              <div>
                <h4>Recovery points</h4>
                {backups.length ? <ul className={styles.dataList}>{backups.slice(0, 12).map((backup) => <li key={backup.fileName}><strong>{backup.fileName}</strong><span>{formatBytes(backup.bytes)}</span></li>)}</ul> : <p className={styles.empty}>No rolling restore points were reported.</p>}
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <section className={styles.boundary} aria-label="Advanced settings boundaries">
        <strong>Read-only recovery review</strong>
        <p>Original project files, Human-created story material and user-owned assets remain canonical data. This surface reads existing local storage only; restore operations still require the active project context and explicit Human confirmation.</p>
      </section>
    </div>
  );
}
