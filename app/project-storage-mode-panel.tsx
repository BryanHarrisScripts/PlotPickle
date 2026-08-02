"use client";

import { useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import {
  PROJECT_STORAGE_MODES,
  projectStorageModeSnapshot,
  projectStorageTransitionConfirmation,
  transitionProjectStorageMode,
  type ProjectStorageMode,
} from "@/lib/project-storage-mode";
import styles from "./project-storage-mode-panel.module.css";

const PROJECT_STORAGE_KEY = "plotpickle.project.v1";
const NOTICE_KEY = "plotpickle.project-storage-mode.notice";

const MODE_COPY: Record<ProjectStorageMode, { title: string; summary: string; includes: string }> = {
  "local-only": {
    title: "Local Only",
    summary: "Work privately with the PPF, local assets and rolling backups on this device.",
    includes: "No account or repository is required.",
  },
  "local-github": {
    title: "Local + GitHub",
    summary: "Keep the local working copy and add a story repository, history, proposals and collaboration.",
    includes: "GitHub supplements local storage; it never replaces it.",
  },
};

type Props = {
  onManage: (target: string) => void;
};

function storedProject() {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as PlotPickleProject;
    return parsed?.id && parsed?.collaboration ? parsed : null;
  } catch {
    return null;
  }
}

export default function ProjectStorageModePanel({ onManage }: Props) {
  const [project] = useState<PlotPickleProject | null>(() => storedProject());
  const [notice, setNotice] = useState(() => {
    if (typeof window === "undefined") return "";
    const value = window.sessionStorage.getItem(NOTICE_KEY) || "";
    window.sessionStorage.removeItem(NOTICE_KEY);
    return value;
  });
  const snapshot = project ? projectStorageModeSnapshot(project) : null;

  function selectMode(target: ProjectStorageMode) {
    if (!project || !snapshot) {
      setNotice("Open Storage & Backups to confirm the active local project before changing its mode.");
      onManage("Storage");
      return;
    }
    if (target === snapshot.mode) return;
    if (target === "local-github" && !snapshot.githubConfigured) {
      setNotice("Connect a GitHub account and choose the story repository before enabling Local + GitHub.");
      onManage("GitHub");
      return;
    }
    if (!window.confirm(projectStorageTransitionConfirmation(project, target))) return;

    const next = transitionProjectStorageMode(project, target);
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(next));
    window.sessionStorage.setItem(
      NOTICE_KEY,
      target === "local-github"
        ? "Local + GitHub is selected. The local working copy remains active."
        : "Local Only is selected. Saved GitHub configuration was preserved.",
    );
    window.location.reload();
  }

  return (
    <section className={styles.panel} aria-labelledby="project-storage-mode-title">
      <header className={styles.header}>
        <div>
          <p>Project mode</p>
          <h2 id="project-storage-mode-title">Choose where this story is managed</h2>
          <span>Every mode keeps the PPF, assets and rolling backups on this device.</span>
        </div>
        <strong>{snapshot?.mode === "local-github" ? "Local + GitHub" : "Local Only"}</strong>
      </header>

      <div className={styles.options} role="radiogroup" aria-label="Project storage mode">
        {PROJECT_STORAGE_MODES.map((mode) => {
          const copy = MODE_COPY[mode];
          const active = snapshot?.mode === mode;
          const unavailable = mode === "local-github" && Boolean(snapshot && !snapshot.githubConfigured);
          return (
            <button
              type="button"
              role="radio"
              aria-checked={active}
              className={active ? styles.active : ""}
              key={mode}
              onClick={() => selectMode(mode)}
            >
              <span>{active ? "Selected" : unavailable ? "Setup required" : "Available"}</span>
              <b>{copy.title}</b>
              <small>{copy.summary}</small>
              <em>{copy.includes}</em>
            </button>
          );
        })}
      </div>

      <dl className={styles.status}>
        <div><dt>Local working copy</dt><dd>Always active</dd></div>
        <div><dt>Rolling backups</dt><dd>Always retained</dd></div>
        <div><dt>GitHub story repository</dt><dd>{snapshot?.repository || "Not yet read"}</dd></div>
        <div><dt>Repository branch</dt><dd>{snapshot?.githubConfigured ? snapshot.branch : "Not configured"}</dd></div>
      </dl>

      <div className={styles.actions}>
        <button type="button" onClick={() => onManage("GitHub")}>Configure GitHub</button>
        <button type="button" onClick={() => onManage("Storage")}>Open Storage &amp; Backups</button>
      </div>
      <p className={styles.boundary}>Selecting a mode never pushes, pulls, publishes, merges, deletes a repository or changes story canon automatically.</p>
      {notice ? <p className={styles.notice} role="status" aria-live="polite">{notice}</p> : null}
    </section>
  );
}
