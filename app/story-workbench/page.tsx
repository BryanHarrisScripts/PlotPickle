"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { authenticatedProfileFetch } from "@/core/auth/profile-request-browser";
import type { StoryDecisionRecord } from "@/core/story-workflow/story-decisions/core.mjs";
import { storyDecisionReconciliationPlan } from "@/core/story-workflow/workbench/core.mjs";
import { loadFoundationProject } from "@/core/storage/foundation-project-browser";
import { saveFoundationProjectAtRevision } from "@/core/storage/project-library/revision-safe-browser";
import {
  applyStoryWorkbenchReview,
  planTargetedStoryReevaluation,
  prepareStoryWorkbenchReview,
  storyWorkbenchTelemetry,
  storyWorkbenchTargets,
} from "@/modules/story-workflow/workbench/workflow";
import styles from "./story-workbench.module.css";

type DecisionResponse = { ok?: boolean; decision?: StoryDecisionRecord; message?: string };
type ListResponse = { ok?: boolean; decisions?: StoryDecisionRecord[]; attentionCount?: number; message?: string };

type Completion = {
  applied: boolean;
  previousRevision: number;
  revision: number;
  affectedWorkItemIds: string[];
  staleDecisionIds: string[];
  telemetry: ReturnType<typeof storyWorkbenchTelemetry>;
};

async function decisionRequest(decisionId: string) {
  const response = await authenticatedProfileFetch(`/api/story-decisions?decisionId=${encodeURIComponent(decisionId)}`, { cache: "no-store" });
  const body = await response.json() as DecisionResponse;
  if (!response.ok || !body.decision) throw new Error(body.message || "Story Workbench could not load that Decision.");
  return body.decision;
}

async function listDecisions(projectId: string) {
  const response = await authenticatedProfileFetch(`/api/story-decisions?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
  const body = await response.json() as ListResponse;
  if (!response.ok) throw new Error(body.message || "Story Decisions could not be refreshed after apply.");
  return body;
}

async function markDecisionStale(decisionId: string, currentRevision: number) {
  const response = await authenticatedProfileFetch("/api/story-decisions", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "respond",
      decisionId,
      response: { responseClass: "defer", currentRevision: String(currentRevision) },
    }),
  });
  if (response.status !== 409 && !response.ok) {
    const body = await response.json() as { message?: string };
    throw new Error(body.message || `Could not refresh affected Story Decision ${decisionId}.`);
  }
}

async function withdrawDecision(decisionId: string, currentRevision: number) {
  const response = await authenticatedProfileFetch("/api/story-decisions", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "withdraw", decisionId, currentRevision: String(currentRevision) }),
  });
  if (!response.ok) {
    const body = await response.json() as { message?: string };
    throw new Error(body.message || `Could not close satisfied Story Decision ${decisionId}.`);
  }
}

export default function StoryWorkbenchPage() {
  const [decision, setDecision] = useState<StoryDecisionRecord | null>(null);
  const [selectedTargetRef, setSelectedTargetRef] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [notice, setNotice] = useState("Loading Story Workbench…");
  const [busy, setBusy] = useState(false);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [projectTick, setProjectTick] = useState(0);

  useEffect(() => {
    const decisionId = new URLSearchParams(window.location.search).get("decisionId") || "";
    if (!decisionId) { setNotice("Open Story Workbench from an answered Story Decision."); return; }
    void decisionRequest(decisionId).then((loaded) => {
      const project = loadFoundationProject();
      const targets = storyWorkbenchTargets(project, loaded);
      const prepared = prepareStoryWorkbenchReview({ project, decision: loaded, selectedTargetRef: targets.length === 1 ? targets[0].targetRef : undefined });
      setDecision(loaded);
      setSelectedTargetRef(targets.length === 1 ? targets[0].targetRef : "");
      setDraftValue(prepared.proposedValue);
      setNotice("");
    }).catch((error) => setNotice(error instanceof Error ? error.message : "Story Workbench could not load."));
  }, []);

  const project = useMemo(() => {
    void projectTick;
    return loadFoundationProject();
  }, [projectTick]);
  const prepared = useMemo(() => {
    if (!decision) return null;
    return prepareStoryWorkbenchReview({ project, decision, selectedTargetRef, editedValue: draftValue });
  }, [decision, draftValue, project, selectedTargetRef]);

  async function completeReview() {
    if (!decision || busy) return;
    setBusy(true); setNotice(""); setCompletion(null);
    try {
      const liveProject = loadFoundationProject();
      const livePrepared = prepareStoryWorkbenchReview({
        project: liveProject,
        decision,
        selectedTargetRef,
        editedValue: draftValue,
      });
      if (!livePrepared.review.canComplete) throw new Error("Story Workbench found a blocking validation issue. Review the findings before continuing.");
      const result = applyStoryWorkbenchReview({ project: liveProject, prepared: livePrepared });
      if (!result.applied) {
        setCompletion({
          applied: false,
          previousRevision: result.previousRevision,
          revision: result.revision,
          affectedWorkItemIds: [],
          staleDecisionIds: [],
          telemetry: storyWorkbenchTelemetry({ project: result.project, openRequiredDecisions: 0, reevaluationItems: [] }),
        });
        setNotice("Human choice recorded. The current story was kept unchanged; no PPF revision was created.");
        return;
      }

      const saved = saveFoundationProjectAtRevision(result.project, result.previousRevision);
      const reevaluationItems = planTargetedStoryReevaluation(saved, result.changedRefs);
      const beforeReconcile = await listDecisions(saved.id);
      const reconciliation = storyDecisionReconciliationPlan(beforeReconcile.decisions || [], {
        projectId: saved.id,
        currentRevision: saved.revision,
        sourceDecisionIds: [decision.decisionId],
        affectedRefs: result.changedRefs,
      });
      await Promise.all(reconciliation.staleDecisionIds.map((decisionId) => markDecisionStale(decisionId, saved.revision)));
      await Promise.all(reconciliation.withdrawDecisionIds.map((decisionId) => withdrawDecision(decisionId, saved.revision)));
      const refreshed = await listDecisions(saved.id);
      const openRequiredDecisions = (refreshed.decisions || []).filter((item) => ["new", "reviewing", "deferred"].includes(item.status)).length;
      const telemetry = storyWorkbenchTelemetry({
        project: saved,
        openRequiredDecisions,
        reevaluationItems,
        unresolvedHighMediumFindings: (refreshed.decisions || []).filter((item) => ["new", "reviewing", "deferred"].includes(item.status) && item.severity !== "low").length,
        specialistDisagreements: (refreshed.decisions || []).filter((item) => item.decisionClass === "unresolved-conflict" && ["new", "reviewing", "deferred"].includes(item.status)).length,
      });
      setCompletion({
        applied: true,
        previousRevision: result.previousRevision,
        revision: saved.revision,
        affectedWorkItemIds: reevaluationItems.map((item) => item.workItemId),
        staleDecisionIds: reconciliation.staleDecisionIds,
        telemetry,
      });
      setProjectTick((value) => value + 1);
      setNotice(`Applied revision ${result.previousRevision} → ${saved.revision}. Only dependency-backed story work was re-evaluated; unrelated completed work stayed current.`);
    } catch (error) {
      setProjectTick((value) => value + 1);
      setNotice(error instanceof Error ? error.message : "Story Workbench could not complete the change.");
    } finally {
      setBusy(false);
    }
  }

  if (!decision || !prepared) {
    return <main className={styles.page}><div className={styles.empty}><h1>Story Workbench</h1><p>{notice}</p><Link href="/story-decisions">Back to Story Decisions</Link></div></main>;
  }

  const responseClass = String((decision.response as Record<string, unknown> | null)?.responseClass || "").replaceAll("-", " ");
  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><p>Story / Workbench</p><h1>Review the exact change before canon moves.</h1><span>{decision.question}</span></div>
      <div className={styles.links}><Link href="/story-decisions">Story Decisions</Link><Link href="/?workspace=plan">Open PLAN</Link></div>
    </header>

    <section className={styles.summary}>
      <div><small>Human response</small><strong>{responseClass || "Not ready"}</strong></div>
      <div><small>Reviewed revision</small><strong>{prepared.package.baseRevision}</strong></div>
      <div><small>Current revision</small><strong>{project.revision}</strong></div>
      <div><small>Canon write</small><strong>{prepared.package.requiresCanonApply ? "Pending Human apply" : "None"}</strong></div>
    </section>

    {prepared.availableTargets.length > 1 ? <label className={styles.selector}><span>Choose the one canonical field this Decision should change</span><select value={selectedTargetRef} onChange={(event) => setSelectedTargetRef(event.target.value)}><option value="">Choose a target…</option>{prepared.availableTargets.map((target) => <option key={target.targetRef} value={target.targetRef}>{target.label}</option>)}</select></label> : null}

    <div className={styles.columns}>
      <section><h2>Current story</h2><p className={styles.value}>{prepared.currentValue || "No accepted value yet."}</p></section>
      <section><h2>Proposed story</h2>{prepared.package.requiresCanonApply ? <textarea rows={8} value={draftValue} onChange={(event) => setDraftValue(event.target.value)} /> : <p className={styles.value}>Keep the current story. No PPF field will change.</p>}</section>
    </div>

    <section className={styles.axes}><h2>Validation</h2><div>{prepared.review.axes.map((axis) => <article key={axis.id} data-status={axis.status}><header><strong>{axis.id.replaceAll("-", " ")}</strong><b>{axis.status}</b></header><p>{axis.summary}</p></article>)}</div></section>

    <div className={styles.columns}>
      <section><h2>What may be re-evaluated</h2>{prepared.impact.explainableRefs.length ? <ul>{prepared.impact.explainableRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul> : <p>Nothing. This response does not change canon.</p>}</section>
      <section><h2>What Workbench will not do</h2><ul><li>No full-story restart by default.</li><li>No automatic storyboard/script regeneration.</li><li>No GitHub PR or developer-agent approval.</li><li>No second PPF or hidden Workbench canon store.</li></ul></section>
    </div>

    <section className={styles.apply}><div><strong>{prepared.review.blockingFindingCount ? `${prepared.review.blockingFindingCount} blocking finding${prepared.review.blockingFindingCount === 1 ? "" : "s"}` : "Ready for Human completion"}</strong><p>{prepared.package.requiresCanonApply ? "Apply performs one revision-checked Story Command, then refreshes only evidenced dependencies." : "Your reject/keep-current response completes without a canonical write."}</p></div><button type="button" disabled={busy || !prepared.review.canComplete || (prepared.package.requiresCanonApply && !prepared.review.canApply)} onClick={() => void completeReview()}>{busy ? "Rechecking exact revision…" : prepared.package.requiresCanonApply ? "Apply change" : "Complete no-change review"}</button></section>

    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    {completion ? <section className={styles.telemetry}><h2>Convergence after this Human choice</h2><div><span><b>{completion.telemetry.openRequiredDecisions}</b> open required Decisions</span><span><b>{completion.telemetry.missingCurrentFrontierRequirements}</b> missing current-frontier requirements</span><span><b>{completion.telemetry.affectedWorkItemsRerun}</b> affected work items re-evaluated</span><span><b>{completion.telemetry.newMaterialFindings}</b> new material findings</span></div>{completion.affectedWorkItemIds.length ? <details><summary>Affected Story Work Items</summary><ul>{completion.affectedWorkItemIds.map((id) => <li key={id}>{id}</li>)}</ul></details> : null}{completion.staleDecisionIds.length ? <details><summary>Decisions refreshed because their story evidence changed</summary><ul>{completion.staleDecisionIds.map((id) => <li key={id}>{id}</li>)}</ul></details> : null}</section> : null}
  </main>;
}
