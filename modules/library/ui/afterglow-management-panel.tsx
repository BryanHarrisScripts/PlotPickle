"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { plotPickleCurriculum } from "../../../adapters/curriculum/current-catalog";
import { buildStoryDevelopmentFields } from "../../learn/model/story-development-fields";
import {
  PROJECT_LIBRARY_ACTIVE_PROFILE_KEY,
  PROJECT_LIBRARY_CHANGED_EVENT,
  listAfterglowExampleProjects,
  loadLibraryProjectSnapshot,
  type ProjectLibrarySummary,
} from "../../../core/storage/project-library-browser";
import { profilePrivateBrowserReadyFor } from "../../../core/storage/profile-private-browser";
import { describeAfterglowConsolidationConflict, reviewAfterglowConsolidationDecisions } from "../afterglow-consolidation.mjs";
import type {
  AfterglowConsolidationPlan,
  AfterglowConflictChoice,
  AfterglowConsolidationChange,
  AfterglowConsolidationConflict,
  AfterglowConsolidationReview,
} from "../afterglow-consolidation.mjs";
import styles from "./afterglow-management-panel.module.css";

type Preview = Readonly<{
  plan: AfterglowConsolidationPlan;
  sources: ReadonlyArray<{ id: string; revision: number; updatedAt: string }>;
  appliedCount: number;
  reconciledVisualCount: number;
  questionEvidence: AfterglowConsolidationPlan["questionEvidence"];
  sampleChanges: readonly AfterglowConsolidationChange[];
  conflictCount: number;
  reviewCount: number;
  conflicts: readonly AfterglowConsolidationConflict[];
  needsReview: readonly AfterglowConsolidationReview[];
  localAssetCount: number;
  sourceMediaCount: number;
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
function canonicalQuestionForPath(path: string, questions: ReadonlyMap<string, string>) {
  const match = /^\/storyDevelopment\/fields\/([^/]+)(?:\/(?:value|updatedAt))?$/.exec(path);
  if (!match) return null;
  const storedFieldId = match[1].replace(/~1/g, "/").replace(/~0/g, "~");
  return questions.get(storedFieldId) ?? null;
}
function inventoryFingerprint(sources: readonly ProjectLibrarySummary[]) {
  return JSON.stringify(sources.map(item => [item.id, item.updatedAt]));
}
function summarizeHumanValue(value: unknown, path = "") {
  if (Array.isArray(value) && path.endsWith("/acceptedVisualArtifactIds")) {
    return value.length + " accepted artwork IDs; lock and media proof required";
  }
  if (Array.isArray(value) && path.includes("graphicNovelTextApprovals")) {
    return value.length + " Graphic Novel panel approvals";
  }
  if (value && typeof value === "object" && !Array.isArray(value)
      && "anchorRef" in value && "position" in value) {
    const a = value as { position?: number; narration?: string; noText?: boolean };
    const label = a.noText ? "Human approved no text" : (a.narration || "Approved dialogue bubbles");
    return "Shot " + (a.position ?? "?") + " — " + label.slice(0, 140);
  }
  if (path.startsWith("/storyDevelopment/fields/") && value && typeof value === "object"
      && !Array.isArray(value) && "value" in value) {
    const state = value as { value?: string; acceptedSource?: string | null };
    return (typeof state.value === "string" ? state.value.slice(0, 145) : "No saved answer")
      + (state.acceptedSource ? " · source: " + state.acceptedSource : "");
  }
  if (path.endsWith("/updatedAt") && typeof value === "string") return displayDate(value);
  if (typeof value === "string") return value.length > 160 ? value.slice(0, 160) + "…" : value;
  let result = "";
  try { result = JSON.stringify(value); }
  catch { return "Complex value — review saved version"; }
  return result && result.length > 160 ? result.slice(0, 160) + "…" : result || "Empty";
}

/**
 * Phase 2B lets the Human review competing values without any mutation.
 * The account-owned durable commit, ambiguous deletion/ordering decisions,
 * verified media reads, pinned-baseline reset and designated-publisher release
 * remain independent pending acceptance gates.
 */
export default function AfterglowManagementPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [sources, setSources] = useState<readonly ProjectLibrarySummary[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, AfterglowConflictChoice>>({});
  const [conflictPage, setConflictPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const questionByField = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const field of buildStoryDevelopmentFields(plotPickleCurriculum)) {
      lookup.set(field.canonicalId, field.prompt);
      if (field.scope !== "project-wide") {
        for (const act of field.validActs) lookup.set(field.canonicalId + "::act-" + act, field.prompt);
      }
    }
    return lookup;
  }, []);
  const reviewed = useMemo(() => preview
    ? reviewAfterglowConsolidationDecisions(preview.plan, decisions)
    : null, [preview, decisions]);

  const refresh = useCallback(() => {
    const ready = profileReady();
    setAuthenticated(ready);
    setSources(ready ? listAfterglowExampleProjects() : []);
    setPreview(null);
    setDecisions({});
    setConflictPage(0);
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
    setDecisions({});
    setConflictPage(0);
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
        questions: Object.fromEntries(questionByField),
      });
      setPreview({
        plan: result,
        sources: result.sources,
        appliedCount: result.applied.length,
        reconciledVisualCount: result.reconciledVisuals.length,
        questionEvidence: result.questionEvidence,
        sampleChanges: result.applied.slice(0, 35),
        conflictCount: result.conflicts.length,
        reviewCount: result.needsReview.length,
        conflicts: result.conflicts,
        needsReview: result.needsReview.slice(0, 35),
        localAssetCount: result.localAssetsToVerify.length,
        sourceMediaCount: result.sourceMediaReferences.length,
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
              <strong> {preview.reconciledVisualCount}</strong> saved visual acceptances reconciled by artifact evidence;
              <strong> {preview.conflictCount}</strong> conflicting paths;
              <strong> {preview.reviewCount}</strong> other review items;
              <strong> {preview.sourceMediaCount}</strong> source-media URLs awaiting verification.</p>
            <p><strong>{preview.questionEvidence.length}</strong> authored fields traced to saved changes;
              <strong> {preview.questionEvidence.filter(item=>item.questionStatus === "canonical-question-matched").length}</strong> matched to original questions;
              <strong> {preview.questionEvidence.filter(item=>item.questionStatus !== "canonical-question-matched").length}</strong> question identities still unverified.</p>
            <details>
              <summary>Question-to-answer evidence (original field identity, not a semantic quality verdict)</summary>
              <ul>{preview.questionEvidence.map(item=><li key={item.fieldId}>
                <strong>{item.question ?? "Original question not found — review required"}</strong>
                {" · "}{item.sourceProjectIds.length} saved source{item.sourceProjectIds.length === 1 ? "" : "s"},
                {" "}{item.distinctAnswers} distinct recorded answer{item.distinctAnswers === 1 ? "" : "s"}.
                {" "}Textual relevance has not been independently assessed.
              </li>)}</ul>
            </details>
            <p>The original saves may contain images not yet present in this draft master.
              This count does not verify the files exist or can be read. The selected draft currently has
              {" "}<strong>{reviewed?.localAssetsToVerify.length ?? preview.localAssetCount}</strong> local asset URLs identified for later readback.</p>
            <p>{preview.mergeShapeConsistent
              ? "The compared changes have no detected structural conflicts. This is not approval: source media and a durable round-trip still need verification."
              : "The merged master cannot be saved yet. Conflicts or ambiguous changes require explicit decisions."}</p>
            {preview.conflictCount ? (
              <section aria-label="Resolve competing saved values" className={styles.decisionArea}>
                <h3>Review conflicting values</h3>
                <p>PlotPickle should automatically reconcile repeated testing and complementary approved changes
                  against each field's actual question. This diagnostic view shows unresolved exceptions;
                  only genuinely incompatible answers should need a targeted choice.
                  No selection here saves, deletes, publishes, or replaces a source version.</p>
                {preview.conflicts.slice(conflictPage * 10, (conflictPage + 1) * 10).map((item, index) => {
                  const id = "afterglow-conflict-" + (conflictPage * 10 + index);
                  const category = describeAfterglowConsolidationConflict(item.path);
                  const canonicalQuestion = canonicalQuestionForPath(item.path, questionByField);
                  const selectable = item.reason === "competing-values" && (item.options?.length ?? 0) > 0
                    && !["visual-approval-collection", "narration-approval-collection", "authorship-metadata"].includes(category.kind);
                  return (
                    <div className={styles.decisionRow} key={item.path}>
                      <div className={styles.conflictHeading}>
                        <strong>{category.label}</strong>
                        <span>{item.reason}</span>
                        {canonicalQuestion ? <p className={styles.question}><strong>Original question:</strong> {canonicalQuestion}</p> : null}
                        <code>{item.path}</code>
                      </div>
                      {selectable ? (
                        <select id={id} aria-label={"Choose " + category.label + " from saved alternatives"}
                          value={decisions[item.path] === undefined ? "" : String(decisions[item.path])}
                          onChange={event => setDecisions(previous => {
                            const next = { ...previous };
                            if (!event.target.value) delete next[item.path];
                            else next[item.path] = event.target.value === "baseline"
                              ? "baseline" : Number(event.target.value);
                            return next;
                          })}>
                          <option value="">Choose an approved value…</option>
                          <option value="baseline">Keep the provided baseline value</option>
                          {item.options?.map((value, optionIndex) => (
                            <option value={optionIndex} key={optionIndex}>
                              {"Saved " + (item.optionSources?.[optionIndex] ?? "version").slice(0, 22)
                                + ": " + summarizeHumanValue(value, item.path)}
                            </option>
                          ))}
                        </select>
                      ) : <p>{category.kind === "visual-approval-collection"
                        ? "Approved visual artifacts must be reconciled individually against saved image, lock, and acceptance evidence. Do not select an entire saved list."
                        : category.kind === "authorship-metadata"
                          ? "The timestamp belongs with the selected approved story value. It is not a separate creative choice."
                          : "This approval collection requires per-shot review. Choosing a whole list could drop valid approvals."}</p>}
                      {selectable ? (
                        <details>
                          <summary>Compare human-readable saved alternatives</summary>
                          {item.options?.map((value, optionIndex) => (
                            <div key={optionIndex}>
                              <p>Saved copy: {item.optionSources?.[optionIndex] ?? "Unknown source"}</p>
                              <p className={styles.approvalSummary}>{summarizeHumanValue(value, item.path)}</p>
                              {value && typeof value === "object" && !Array.isArray(value)
                                && "sourceKey" in value ? <p>Source fingerprint recorded — not yet verified against the selected locked image.</p> : null}
                              <details><summary>Advanced technical evidence</summary>
                                <pre className={styles.valueDetail}>{JSON.stringify(value, null, 2)}</pre>
                              </details>
                            </div>
                          ))}
                        </details>
                      ) : null}
                    </div>
                  );
                })}
                {preview.conflictCount > 10 ? (
                  <div className={styles.actions}>
                    <button type="button" disabled={conflictPage <= 0} onClick={() => setConflictPage(p => Math.max(0, p - 1))}>Previous conflicts</button>
                    <span className={styles.status}>Page {conflictPage + 1} of {Math.ceil(preview.conflictCount / 10)}</span>
                    <button type="button" disabled={(conflictPage + 1) * 10 >= preview.conflictCount} onClick={() => setConflictPage(p => p + 1)}>Next conflicts</button>
                  </div>
                ) : null}
                <p role="status"><strong>{reviewed?.resolved.length ?? 0}</strong> diagnostic selections;
                  <strong> {reviewed?.unresolvedConflicts.length ?? preview.conflictCount}</strong> remaining conflicting paths;
                  <strong> {preview.reviewCount}</strong> other items requiring deterministic reconciliation.
                  These are not necessarily additional Human approvals.</p>
                <p>{reviewed?.decisionShapeConsistent
                  ? "All reported structural choices are accounted for. Media verification, an approved durable master, and restart readback are still required."
                  : "The master is not ready to save; some changes still require review."}</p>
              </section>
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
