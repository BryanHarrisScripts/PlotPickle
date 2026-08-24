"use client";

import { useEffect, useState } from "react";
import {
  PROJECT_LIBRARY_CHANGED_EVENT,
  listArchivedLibraryProjects,
  restoreArchivedLibraryProject,
  type ProjectLibrarySummary,
} from "../../../core/storage/project-library-browser";
import styles from "./archive-stories-panel.module.css";

function displayDate(value: string | null) {
  if (!value) return "Archived locally";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Archived locally";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function ArchivedStoryCard({ item, onRestore }: {
  readonly item: ProjectLibrarySummary;
  readonly onRestore: () => void;
}) {
  return (
    <article className={styles.card} data-archived-story-id={item.id}>
      <div className={styles.visual} aria-hidden="true">
        <span>{item.title.slice(0, 1).toUpperCase()}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.meta}><span>{item.genre || item.sourceKind}</span><span>{item.format}</span></div>
        <h3>{item.title}</h3>
        <p>{item.frontier} · {item.progress}% complete</p>
        <small>Archived {displayDate(item.archivedAt)}</small>
        <button type="button" onClick={onRestore}>Restore to Library</button>
      </div>
    </article>
  );
}

export default function ArchiveStoriesPanel() {
  const [stories, setStories] = useState<readonly ProjectLibrarySummary[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const refresh = () => setStories(listArchivedLibraryProjects());
    refresh();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
  }, []);

  function restore(item: ProjectLibrarySummary) {
    try {
      restoreArchivedLibraryProject(item.id);
      setNotice(`${item.title} was restored to Library.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not restore this story.");
    }
  }

  return (
    <section className={styles.panel} data-library-archive="stories" aria-labelledby="archive-stories-title">
      <header>
        <div><p>Archive</p><h2 id="archive-stories-title">Stories</h2></div>
        <span>{stories.length} archived</span>
      </header>
      <p className={styles.intro}>Archived stories remain the same local PlotPickle projects. Restore one when you want it back on the active Library shelf.</p>
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      {stories.length ? (
        <div className={styles.grid}>
          {stories.map((item) => <ArchivedStoryCard item={item} key={item.id} onRestore={() => restore(item)} />)}
        </div>
      ) : (
        <div className={styles.empty}>
          <h3>No archived stories.</h3>
          <p>Stories you archive from Library will appear here. Archive is reversible and is not delete.</p>
        </div>
      )}
    </section>
  );
}
