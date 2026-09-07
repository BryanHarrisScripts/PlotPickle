"use client";

import { type ReactNode, useEffect, useState } from "react";
import { loadFoundationProject } from "@/core/storage/foundation-project-browser";
import {
  getProfilePrivateSaveState,
  PROFILE_PRIVATE_SAVE_STATE_EVENT,
} from "@/core/storage/profile-private-browser";
import { PROJECT_LIBRARY_CHANGED_EVENT } from "@/core/storage/project-library-browser";
import { PLOTPICKLE_OPEN_PROFILE_EVENT } from "./navigation/global-shortcuts";
import styles from "./story-map-shell.module.css";

export default function StoryMapShell({ children }: { readonly children: ReactNode }) {
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
    <div className={styles.shell} data-story-map-shell="v2">
      <header className={styles.utilityBar}>
        <a className={styles.brand} href="/?workspace=dashboard" aria-label="PlotPickle Story Map home">
          <strong>PlotPickle</strong>
          <small>Story Map</small>
        </a>
        <div className={styles.projectTruth} role="status" aria-live="polite">
          <span><small>Project</small><strong>{projectTitle}</strong></span>
          <span data-save-state={save.state}><small>Status</small><strong>{saveLabel}</strong></span>
        </div>
        <nav className={styles.utilities} aria-label="Story Map utilities">
          <a href="/library">Projects</a>
          <a href="/?workspace=learn">Learn</a>
          <a href="/?workspace=settings">Settings</a>
          <button type="button" onClick={() => window.dispatchEvent(new Event(PLOTPICKLE_OPEN_PROFILE_EVENT))}>Profile</button>
        </nav>
      </header>
      <div className={styles.workspace}>{children}</div>
    </div>
  );
}
