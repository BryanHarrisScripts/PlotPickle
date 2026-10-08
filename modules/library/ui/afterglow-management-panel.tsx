"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PROJECT_LIBRARY_ACTIVE_PROFILE_KEY,
  PROJECT_LIBRARY_CHANGED_EVENT,
  listAfterglowExampleProjects,
  loadLibraryProjectSnapshot,
  type ProjectLibrarySummary,
} from "../../../core/storage/project-library-browser";
import { profilePrivateBrowserReadyFor } from "../../../core/storage/profile-private-browser";
import type {
  AfterglowConsolidationChange,
  AfterglowConsolidationConflict,
  AfterglowConsolidationReview,
} from "../afterglow-consolidation.mjs";
import styles from "./afterglow-management-panel.module.css";

type Preview = Readonly<{
  sources: ReadonlyArray<{ id: string; revision: number; updatedAt: string }>;
  appliedCount: number;
  sampleChanges: readonly AfterglowConsolidationChange[];
  conflictCount: number;
  reviewCount: number;
  conflicts: readonly AfterglowConsolidationConflict[];
  needsReview: readonly AfterglowConsolidationReview[];
  localAssetCount: number;
  mergeShapeConsistent: boolean;
}>;

function profileReady() {
  const profileId = window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) || "";
  return profilePrivateBrowserReadyFor(profileId);
}
function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Date unavailable" :
    new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function inventoryFingerprint(sources: readonly ProjectLibrarySummary[]) {
  return JSON.stringify(sources.map(item => [item.id, item.updatedAt]));
}

/**
 * Phase 2A is deliberately read-only. The actual account-owned commit,
 * explicit Human conflict choices, verified media reads, pinned-baseline reset
 * and designated-publisher release are independent pending acceptance gates.
 */
export default function AfterglowManagementPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [sources, setSources] = useState<readonly ProjectLibrarySummary[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(() => {
    const ready = profileReady();
    setAuthenticated(ready);
    setSources(ready ? listAfterglowExampleProjects() : []);
    setPreview(null);
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
  }, [refresh]);

  async function reviewConsolidation() {
    if (busy) return;
    setBusy(true);
    setPreview(null);
    setNotice("");
    try {
      if (!profileReady()) throw new Error("Unlock your PlotPickle profile before reviewing Afterglow.");
      const start = listAfterglowExampleProjects();
      if (!start.length) {
        setNotice("No saved Afterglow working versions exist in this profile yet. You can open the provided example from Library.");
        return;
      }
      const complete = start.map(summary => {
        const project = loadLibraryProjectSnapshot(summary.id);
        if (!project || project.id !== summary.id) {
          throw new Error("A saved Afterglow version could not be read. Your existing work was not changed.");
        }
        return { project };
      });
      const [{ createAfterglowPackagedCurrentReference }, { planAfterglowConsolidation }] = await Promise.all([
        import("../reference/afterglow-packaged-current"),
        import("../afterglow-consolidation.mjs"),
      ]);
      // A save or account switch during an asynchronous review invalidates
      // the results. Never publish a preview for a different hydrated profile.
      if (!profileReady() ||
        inventoryFingerprint(start) !== inventoryFingerprint(listAfterglowExampleProjects())) {
        throw new Error("Afterglow changed during review. Refresh and review the complete current list.");
      }
      const result = planAfterglowConsolidation({
        baseline: createAfterglowPackagedCurrentReference(),
        sources: complete,
      });
      setPreview({
        sources: result.sources,
        appliedCount: result.applied.length,
        sampleChanges: result.applied.slice(0, 35),
        conflictCount: result.conflicts.length,
        reviewCount: result.needsReview.length,
        conflicts: result.conflicts.slice(0, 35),
        needsReview: result.needsReview.slice(0, 35),
        localAssetCount: result.localAssetsToVerify.length,
        mergeShapeConsistent: result.mergeShapeConsistent,
      });
      setNotice("Read-only review complete. No project, approval, image, or provided example was changed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Afterglow could not be reviewed. Your saved work is unchanged.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.workspace} data-afterglow-management="phase2-preview">
      <section className={styles.panel} aria-labelledby="afterglow-personal-heading">
        <div className={styles.heading}>
          <div><p className={styles.eyebrow}>Every authenticated PlotPickle user</p>
            <h2 id="afterglow-personal-heading">My Afterglow</h2></div>
          <span className={styles.status}>Read-only review</span>
        </div>
        <p>Inspect every saved working version in this account before combining approved story decisions.
          A later verified step will save one current master and retain previous versions for recovery.</p>
        {!authenticated ? (
          <p role="status">Your encrypted profile is not ready. Sign in and unlock your profile before reviewing your saved Afterglow.</p>
        ) : (
          <>
            <div className={styles.metric}><strong>{sources.length}</strong><span>saved working version{sources.length === 1 ? "" : "s"} found in this profile</span></div>
            {sources.length ? (
              <ol className={styles.sourceList}>
                {sources.map(source => (
                  <li key={source.id}><strong>{displayDate(source.updatedAt)}</strong>
                    <span>Saved working copy · {source.id.slice(0, 8)}</span></li>
                ))}
              </ol>
            ) : <p>No saved Afterglow working versions were found. The provided example remains available in Library.</p>}
            <div className={styles.actions}>
              <button type="button" disabled={busy} onClick={refresh}>Refresh saved versions</button>
              <button type="button" disabled={busy || !sources.length} onClick={() => void reviewConsolidation()}>
                {busy ? "Reviewing…" : "Review consolidation"}
              </button>
            </div>
          </>
        )}
        {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
        {preview ? (
          <section className={styles.result} aria-labelledby="afterglow-preview-heading">
            <h3 id="afterglow-preview-heading">Consolidation review — not saved</h3>
            <p><strong>{preview.sources.length}</strong> saved versions compared;
              <strong> {preview.appliedCount}</strong> proposed field/entity changes;
              <strong> {preview.conflictCount}</strong> conflicting paths;
              <strong> {preview.reviewCount}</strong> other review items;
              <strong> {preview.localAssetCount}</strong> local media references requiring verification.</p>
            <p>{preview.mergeShapeConsistent
              ? "The compared changes have no detected structural conflicts. This is not approval: source media and a durable round-trip still need verification."
              : "The merged master cannot be saved yet. Conflicts or ambiguous changes require explicit decisions."}</p>
            {preview.conflicts.length ? (
              <details><summary>Conflicting paths (first 35)</summary>
                <ul>{preview.conflicts.map((item, index) => <li key={item.path + index}>{item.path} — {item.reason}</li>)}</ul>
              </details>
            ) : null}
            {preview.needsReview.length ? (
              <details><summary>Unresolved review items (first 35)</summary>
                <ul>{preview.needsReview.map((item, index) =>
                  <li key={item.path + index}>{item.path} — {item.reason}</li>)}</ul>
              </details>
            ) : null}
            {preview.sampleChanges.length ? (
              <details><summary>Proposed changes (first 35)</summary>
                <ul>{preview.sampleChanges.map((item, index) => <li key={item.path + index}>{item.path}</li>)}</ul>
              </details>
            ) : null}
            <p className={styles.caution}>Review only: no Save Master action is available until conflict resolution,
              media verification, Human confirmation, and persisted readback are implemented and tested.</p>
          </section>
        ) : null}
      </section>

      <section className={styles.panel} aria-labelledby="afterglow-baseline-heading">
        <h2 id="afterglow-baseline-heading">Return to Provided Baseline</h2>
        <p>This future account-owned action will make a fresh working copy from the verified installed example,
          keeping your current master and history recoverable. The reset action is not yet enabled:
          PlotPickle must first prove the exact installed baseline and backup/readback path.</p>
      </section>
      <section className={styles.panel} aria-labelledby="afterglow-publish-heading">
        <h2 id="afterglow-publish-heading">Publish Official Example</h2>
        <p>Restricted to the designated publisher with separately verified PlotPickle publisher authority and
          canonical GitHub repository permissions. No public publishing action is available on this screen.
          Your private consolidation cannot update the example distributed to other users.</p>
      </section>
    </div>
  );
}
