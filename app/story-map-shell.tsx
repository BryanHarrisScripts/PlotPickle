"use client";

import { type ReactNode, useEffect, useState } from "react";
import { loadFoundationProject } from "@/core/storage/foundation-project-browser";
import {
  getProfilePrivateSaveState,
  PROFILE_PRIVATE_SAVE_STATE_EVENT,
} from "@/core/storage/profile-private-browser";
import { PROJECT_LIBRARY_CHANGED_EVENT } from "@/core/storage/project-library-browser";
import type { RootWorkspace } from "./plotpickle-workspace-shell";
import { PLOTPICKLE_OPEN_PROFILE_EVENT } from "./navigation/global-shortcuts";
import styles from "./story-map-shell.module.css";

export default function StoryMapShell({
  children,
  onNavigate,
}: {
  readonly children: ReactNode;
  readonly onNavigate: (workspace: RootWorkspace) => void;
}) {
  const [projectTitle, setProjectTitle] = useState("Opening project…");
  const [save, setSave] = useState(getProfilePrivateSaveState());

  useEffect(() => {
    const syncProject = () => {
      try { setProjectTitle(loadFoundationProject().title || "Untitled Story"); }
      catch { setProjectTitle("No active project"); }
      setSave(getProfilePrivateSaveState());
    };
    const syncSave = () => setSave(getProfilePrivateSaveState());
    syncProject();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, syncProject);
    window.addEventListener(PROFILE_PRIVATE_SAVE_STATE_EVENT, syncSave);
    return () => {
      window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, syncProject);
      window.removeEventListener(PROFILE_PRIVATE_SAVE_STATE_EVENT, syncSave);
    };
  }, []);

  const saveLabel = save.state === "saved" ? "Saved" : save.state === "saving" ? "Saving…" : "Save blocked";

  return (
    <div className={styles.shell} data-story-map-shell="v2" data-active-workspace="dashboard">
      <header className={styles.utilityBar}>
        <button className={styles.brand} type="button" onClick={() => onNavigate("dashboard")} aria-label="PlotPickle Story Map home">
          <strong>PlotPickle</strong>
          <small>Story Map</small>
        </button>
        <div className={styles.projectTruth} role="status" aria-live="polite">
          <span><small>Project</small><strong>{projectTitle}</strong></span>
          <span data-save-state={save.state}><small>Status</small><strong>{saveLabel}</strong></span>
        </div>
        <nav className={styles.utilities} aria-label="Story Map utilities">
          <button data-story-map-utility="projects" type="button" onClick={() => onNavigate("library")}>Projects</button>
          <button data-story-map-utility="learn" type="button" onClick={() => onNavigate("learn")}>Learn</button>
          <button data-story-map-utility="community" type="button" onClick={() => onNavigate("community")}>Community</button>
          <button data-story-map-utility="settings" type="button" onClick={() => onNavigate("settings")}>Settings</button>
          <button data-story-map-utility="profile" type="button" onClick={() => window.dispatchEvent(new Event(PLOTPICKLE_OPEN_PROFILE_EVENT))}>Profile</button>
        </nav>
      </header>
      <div className={styles.workspace}>{children}</div>
    </div>
  );
}
