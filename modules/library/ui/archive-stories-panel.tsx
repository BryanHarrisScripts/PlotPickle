"use client";

import { useEffect, useState } from "react";
import {
  PROJECT_LIBRARY_CHANGED_EVENT,
  deleteArchivedLibraryProject,
  listHumanArchivedLibraryProjects,
  restoreArchivedLibraryProject,
  type ProjectLibrarySummary,
} from "../../../core/storage/project-library-browser";
import {
  deleteArchivedProfileProjectFromVault,
  flushProfilePrivateWrites,
  persistActiveProfileProject,
} from "../../../core/storage/profile-private-browser";
import styles from "./archive-stories-panel.module.css";

function displayDate(value: string | null) {
  if (!value) return "Archived locally";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Archived locally";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function ArchivedStoryCard({ item, onRestore, onDelete }: {
  readonly item: ProjectLibrarySummary;
  readonly onRestore: () => void;
  readonly onDelete: () => void;
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
        <button type="button" onClick={onDelete}>Delete Permanently</button>
      </div>
    </article>
  );
}

export default function ArchiveStoriesPanel() {
  const [stories, setStories] = useState<readonly ProjectLibrarySummary[]>([]);
  const [notice, setNotice] = useState("");
  const [pendingDelete, setPendingDelete] = useState<readonly ProjectLibrarySummary[]>([]);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const refresh = () => setStories(listHumanArchivedLibraryProjects());
    refresh();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
  }, []);

  async function restore(item: ProjectLibrarySummary) {
    try {
      restoreArchivedLibraryProject(item.id);
      await persistActiveProfileProject();
      await flushProfilePrivateWrites();
      setNotice(`${item.title} was restored to Library from Archive.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not restore this story.");
    }
  }

  async function remove() {
    if (!pendingDelete.length || deleting) return;
    const label = pendingDelete.length === 1 ? pendingDelete[0].title : `all ${pendingDelete.length} archived stories`;
    setDeleting(true);
    try {
      for (const item of pendingDelete) {
        await deleteArchivedProfileProjectFromVault(item.id);
        deleteArchivedLibraryProject(item.id);
      }
      setNotice(`${label} deleted permanently.`);
      setPendingDelete([]);
      setConfirmation("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not delete the archived stories.");
    } finally {
      setDeleting(false);
    }
  }

  function requestDelete(items: readonly ProjectLibrarySummary[]) {
    setConfirmation("");
    setPendingDelete(items);
  }

  return (
    <section className={styles.panel} data-library-archive="stories" aria-labelledby="archive-stories-title">
      <header>
        <div><p>Archive</p><h2 id="archive-stories-title">Stories</h2></div>
        <span>{stories.length} archived</span>
        {stories.length ? <button type="button" onClick={() => requestDelete(stories)}>Delete All Stories</button> : null}
      </header>
      <p className={styles.intro}>Archived stories remain the same local PlotPickle projects. Restore one when you want it back on the active Library shelf.</p>
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      {stories.length ? (
        <div className={styles.grid}>
          {stories.map((item) => <ArchivedStoryCard item={item} key={item.id} onRestore={() => void restore(item)} onDelete={() => requestDelete([item])} />)}
        </div>
      ) : (
        <div className={styles.empty}>
          <h3>No archived stories.</h3>
          <p>Stories you archive from Library will appear here. Archive is reversible and is not delete.</p>
        </div>
      )}
      {pendingDelete.length ? <div role="presentation" className={styles.confirmBackdrop}>
        <section role="dialog" aria-modal="true" aria-labelledby="archive-delete-title" className={styles.confirmDialog}>
          <h3 id="archive-delete-title">Permanently delete {pendingDelete.length === 1 ? pendingDelete[0].title : `${pendingDelete.length} archived stories`}?</h3>
          <p>This cannot be restored from Archive. Active Library stories are unaffected.</p>
          {pendingDelete.length > 1 ? <label>Type DELETE to confirm <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label> : null}
          <div><button type="button" disabled={deleting} onClick={() => setPendingDelete([])}>Cancel</button><button type="button" disabled={deleting || (pendingDelete.length > 1 && confirmation !== "DELETE")} onClick={() => void remove()}>{deleting ? "Deleting…" : "Delete Permanently"}</button></div>
        </section>
      </div> : null}
    </section>
  );
}
