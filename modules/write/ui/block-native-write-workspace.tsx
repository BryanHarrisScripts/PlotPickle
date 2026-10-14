"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { blockWritingEntry, updateBlockWritingEntry } from "@/core/contracts/block-writing";
import { moveWriteStoryPosition } from "../model/write-position-navigation.mjs";
import { reviewBlockHandoff } from "../model/block-handoff-review.mjs";
import { currentOutlineAssessment } from "@/modules/plan/outline-agent-assessment";
import { normalizeProjectSourceEvidence } from "@/core/contracts/imported-screenplay-evidence";
import {
  PROJECT_LIBRARY_CHANGED_EVENT,
  loadActiveLibraryProject,
  saveActiveLibraryProject,
  sessionActiveProjectId,
  type LibraryPPFProject,
} from "@/core/storage/project-library-browser";
import {
  markCreativeRevisionDependentsStale,
  planCreativeRevisionPropagation,
} from "@/lib/preproduction/creative-revision-propagation";
import { persistActiveProfileProject, flushProfilePrivateWrites } from "@/core/storage/profile-private-browser";
import { createAgenticStoryToScreenProjectionRequest } from "@/lib/preproduction/agentic-story-to-screen-projection";
import type { ResponsibilityRun } from "@/lib/agents/responsibility/responsibility-runs";
import {
  storyLearningContext,
  storyLearningHref,
  storyLearningReturnHref,
} from "@/modules/learn/model/story-learning-context";
import styles from "./block-native-write-workspace.module.css";

function bounded(value: string | null, maximum: number) {
  const number = Number(value || 1);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(1, Math.trunc(number))) : 1;
}

function currentAddress() {
  if (typeof window === "undefined") return { blockNumber: 1, miniBlockNumber: 1 };
  const query = new URLSearchParams(window.location.search);
  return {
    blockNumber: bounded(query.get("block"), 24),
    miniBlockNumber: bounded(query.get("mini"), 4),
  };
}

function pageFlowHref(blockNumber: number, miniBlockNumber: number) {
  const query = new URLSearchParams({
    block: String(blockNumber),
    mini: String(miniBlockNumber),
  });
  return `/pageflow?${query.toString()}`;
}

function responsibilityRunCreatePayload(run: ResponsibilityRun) {
  return {
    action: "create",
    runId: run.runId,
    kind: run.kind,
    goal: run.goal,
    profileId: run.profileId,
    skillUris: run.skillUris,
    allowedScopes: run.allowedScopes,
    allowedConnectorIds: run.allowedConnectorIds,
    context: run.context,
    verificationMode: run.verificationMode,
    limits: run.limits,
    parentRunId: run.parentRunId,
  };
}

async function responsibilityRunRequest(payload: Record<string, unknown>) {
  const response = await fetch("/api/responsibility-runs", {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const value = await response.json() as { ok?: boolean; message?: string };
  if (!response.ok) throw new Error(value.message || `Responsibility Runs returned ${response.status}.`);
}

export default function BlockNativeWriteWorkspace({ onBackDashboard }: { readonly onBackDashboard?: () => void } = {}) {
  const [project, setProject] = useState<LibraryPPFProject | null>(null);
  const [address, setAddress] = useState(() => currentAddress());
  const [draftText, setDraftText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [status, setStatus] = useState("");
  const [visualizing, setVisualizing] = useState(false);
  const [savingWorkingText, setSavingWorkingText] = useState(false);
  const saveInFlightRef = useRef(false);
  const unconfirmedLocalWriteRef = useRef<{ key: string; text: string } | null>(null);
  const lastHydratedEditorKeyRef = useRef("");

  useEffect(() => {
    const syncProject = () => setProject(loadActiveLibraryProject());
    const syncHistoryAddress = () => setAddress(currentAddress());
    syncProject();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, syncProject);
    window.addEventListener("popstate", syncProject);
    window.addEventListener("popstate", syncHistoryAddress);
    return () => {
      window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, syncProject);
      window.removeEventListener("popstate", syncProject);
      window.removeEventListener("popstate", syncHistoryAddress);
    };
  }, []);

  const entry = useMemo(
    () => project ? blockWritingEntry(project.writing, address) : null,
    [address, project],
  );

  const revisionImpact = useMemo(() => {
    if (!project || draftText === savedText) return null;
    try {
      return planCreativeRevisionPropagation({
        project,
        target: {
          kind: "writing",
          blockNumber: address.blockNumber,
          miniBlockNumber: address.miniBlockNumber,
        },
        beforeValue: savedText,
        afterValue: draftText,
        changeSetId: `write-impact-${project.revision}-${address.blockNumber}-${address.miniBlockNumber}`,
        summary: `Revise working screenplay text at Block ${String(address.blockNumber).padStart(2, "0")} · Mini-Block ${address.miniBlockNumber}.`,
        occurredAt: project.updatedAt,
      });
    } catch {
      return null;
    }
  }, [address.blockNumber, address.miniBlockNumber, draftText, project, savedText]);

  useEffect(() => {
    const key = `${project?.id ?? ""}:${address.blockNumber}:${address.miniBlockNumber}`;
    const next = entry?.text ?? "";
    const changedAddress = lastHydratedEditorKeyRef.current !== key;
    lastHydratedEditorKeyRef.current = key;
    // A local cache mutation is not durable Save authority. Do not turn its
    // optimistic text into "Saved" while encrypted profile writes are unknown.
    if (unconfirmedLocalWriteRef.current?.key === key
      && unconfirmedLocalWriteRef.current.text === next) return;
    // An independent Library refresh cannot silently replace dirty editor work.
    if (!changedAddress && draftText !== savedText) return;
    setDraftText(next);
    setSavedText(next);
    setStatus("");
  }, [entry?.id, entry?.text, address.blockNumber, address.miniBlockNumber, project?.id]);

  if (!project) return <p role="status">Opening Write…</p>;

  const block = project.structure.blocks[address.blockNumber - 1];
  const mini = block?.miniBlocks[address.miniBlockNumber - 1];
  const source = normalizeProjectSourceEvidence(project.sourceEvidence).screenplay;
  const sourcePassages = source?.passages.filter((passage) => (
    passage.blockNumber === address.blockNumber
    && passage.miniBlockNumber === address.miniBlockNumber
  )) ?? [];
  const sourceText = sourcePassages.map((passage) => passage.text).join("\n\n");
  const learning = storyLearningContext(address);
  const handoff = reviewBlockHandoff(project, address.blockNumber, {
    currentAssessment: Boolean(currentOutlineAssessment(project, address.blockNumber)),
  });
  const dirty = draftText !== savedText;

  function selectAddress(blockNumber: number, miniBlockNumber: number) {
    if (saveInFlightRef.current) {
      setStatus("The encrypted screenplay Save is still pending. Keep this story position until its result is confirmed.");
      return;
    }
    if (blockNumber === address.blockNumber && miniBlockNumber === address.miniBlockNumber) return;
    const next = moveWriteStoryPosition({
      locationHref: window.location.href,
      history: window.history,
      blockNumber,
      miniBlockNumber,
      dirty,
      confirmDiscard: () => window.confirm("Leave this story position without saving the working screenplay text?"),
    });
    if (next) setAddress(next);
  }

  function leaveWrite() {
    if (saveInFlightRef.current) {
      setStatus("Wait for the encrypted screenplay Save result before leaving Write.");
      return;
    }
    if (dirty && !window.confirm("Leave Write without saving the working screenplay text?")) return;
    onBackDashboard?.();
  }

  function navigateFromWrite(href: string) {
    if (saveInFlightRef.current) {
      setStatus("Wait for the encrypted screenplay Save result before leaving Write.");
      return;
    }
    if (dirty && !window.confirm("Leave Write without saving the working screenplay text?")) return;
    window.location.assign(href);
  }

  async function save() {
    if (saveInFlightRef.current || !dirty) return;
    saveInFlightRef.current = true;
    setSavingWorkingText(true);
    setStatus("Saving working screenplay text to the encrypted Human profile…");
    const saveProjectId = project.id;
    const saveAddressKey = `${saveProjectId}:${address.blockNumber}:${address.miniBlockNumber}`;
    unconfirmedLocalWriteRef.current = { key: saveAddressKey, text: draftText };
    try {
    const savedAt = new Date().toISOString();
    const revision = project.revision + 1;
    const revised: LibraryPPFProject = {
      ...project,
      revision,
      updatedAt: savedAt,
      writing: updateBlockWritingEntry(project.writing, address, draftText, savedAt),
    };
    const next = revisionImpact
      ? markCreativeRevisionDependentsStale(revised, revisionImpact, revision)
      : revised;
    const saved = saveActiveLibraryProject(next);
    setProject(saved);
    await persistActiveProfileProject("", saveProjectId);
    await flushProfilePrivateWrites();
    if (sessionActiveProjectId() !== saveProjectId) {
      throw new Error("The active Library story changed before encrypted Save confirmation.");
    }
    unconfirmedLocalWriteRef.current = null;
    setSavedText(draftText);
    const affectedVisuals = revisionImpact?.staleAcceptedVisualArtifactIds.length ?? 0;
    const affectedShots = revisionImpact?.staleProductionShotIds.length ?? 0;
    setStatus(
      `Encrypted Save confirmed for Block ${String(address.blockNumber).padStart(2, "0")} · Mini-Block ${address.miniBlockNumber}. `
      + `${affectedVisuals} accepted visual${affectedVisuals === 1 ? "" : "s"} and ${affectedShots} Previs Shot${affectedShots === 1 ? "" : "s"} are dependency-affected and require review; unrelated accepted work remains intact. No regeneration was triggered.`,
    );
    } catch (error) {
      setStatus(`Save not confirmed. Your working text remains in this editor. Retry Save after resolving encrypted profile access. ${error instanceof Error ? error.message : "Storage verification failed."}`);
    } finally {
      saveInFlightRef.current = false;
      setSavingWorkingText(false);
    }
  }

  function useSourceAsStartingPoint() {
    if (!sourceText.trim()) return;
    setDraftText(sourceText);
    setStatus("Copied source evidence into the unsaved working editor. Review it before saving; the source evidence itself remains unchanged.");
  }

  async function visualizeBlock() {
    if (!handoff.allPlansAccepted) {
      setStatus(`Block ${String(address.blockNumber).padStart(2, "0")} has ${handoff.acceptedCount}/4 accepted Outline Mini-Block plans. Review and explicitly accept them in Outline first; no run was created.`);
      return;
    }
    if (dirty || saveInFlightRef.current) {
      setStatus("Save or discard the current screenplay edit before starting a visual production pass so the Responsibility Run can bind to one exact project revision.");
      return;
    }
    setVisualizing(true);
    try {
      const request = createAgenticStoryToScreenProjectionRequest({
        project,
        scope: { kind: "block", blockNumber: address.blockNumber },
        createdAt: new Date().toISOString(),
      });
      await responsibilityRunRequest(responsibilityRunCreatePayload(request.parentRun));
      for (const stage of request.stages) {
        await responsibilityRunRequest(responsibilityRunCreatePayload(stage.run));
        await responsibilityRunRequest({
          action: "attach-child",
          runId: request.parentRun.runId,
          childRunId: stage.run.runId,
        });
      }
      setStatus(
        `Prepared ${request.stages.length} proposal-only Story-to-Screen stages for Block ${String(address.blockNumber).padStart(2, "0")} at project revision ${request.canonicalRevision}. `
        + "These are queued proposal-only Responsibility Run records, not executed agent stages. No Outline agent result, Storyboard image, provider call, cloud spend, canon promotion, or story rewrite occurred from this action.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Story-to-Screen projection could not be prepared.");
    } finally {
      setVisualizing(false);
    }
  }

  return (
    <main className={styles.workspace} data-block-native-write="24x96" onKeyDown={(event) => {
      if (event.key === "Escape" && onBackDashboard) {
        event.preventDefault();
        event.stopPropagation();
        leaveWrite();
      }
    }}>
      <header className={styles.header}>
        <div>
          <p>WRITE · BLOCK-NATIVE SCREENPLAY</p>
          <h1>{project.title}</h1>
          <span>Act {block?.actNumber ?? 1} · Sequence {String(block?.sequenceNumber ?? 1).padStart(2, "0")} · Block {String(address.blockNumber).padStart(2, "0")}</span>
        </div>
        <div className={styles.headerActions}>
          {onBackDashboard ? <button type="button" onClick={leaveWrite}>Back to Dashboard</button> : null}
          <button type="button" disabled={visualizing || !handoff.allPlansAccepted} onClick={() => void visualizeBlock()}>{visualizing ? "Preparing proposal stages…" : "Visualize this Block"}</button>
          <button type="button" onClick={() => navigateFromWrite(storyLearningReturnHref(address))}>Outline this position</button>
          <button type="button" onClick={() => navigateFromWrite(pageFlowHref(address.blockNumber, address.miniBlockNumber))}>PageFlow diagnostic</button>
          <button type="button" onClick={() => navigateFromWrite(storyLearningHref(learning.references[0], address))}>Learn this position</button>
        </div>
      </header>

      <section className={styles.positionBar} aria-label="Writing story position">
        <label>
          <span>Block</span>
          <select value={address.blockNumber} onChange={(event) => selectAddress(Number(event.target.value), 1)}>
            {project.structure.blocks.map((candidate) => (
              <option key={candidate.id} value={candidate.number}>
                {String(candidate.number).padStart(2, "0")} · {candidate.title}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.miniButtons} aria-label="Mini-Block">
          {block?.miniBlocks.map((candidate) => (
            <button
              aria-current={candidate.ordinal === address.miniBlockNumber ? "true" : undefined}
              key={candidate.id}
              onClick={() => selectAddress(address.blockNumber, candidate.ordinal)}
              type="button"
            >
              {candidate.ordinal} · {["Promise", "Progress", "Pressure", "Payoff"][candidate.ordinal - 1]}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.storyHeading}>
        <div>
          <p>BLOCK {String(address.blockNumber).padStart(2, "0")} · MINI-BLOCK {address.miniBlockNumber} · {learning.miniRole.toUpperCase()}</p>
          <h2>{block?.title ?? `Block ${String(address.blockNumber).padStart(2, "0")}`}</h2>
          <span>{mini?.title ?? learning.miniRole}</span>
        </div>
        <p>{learning.positionNote}</p>
      </section>

      <section className={styles.handoffPanel} aria-label="Selected Block Outline and Write handoff" data-block-handoff-project-id={handoff.projectId}>
        <div className={styles.sectionHeading}>
          <p>SELECTED LIBRARY PPF · READ-ONLY HANDOFF</p>
          <h2>Block {String(address.blockNumber).padStart(2, "0")} · Outline → Write</h2>
        </div>
        <p>Project: {handoff.title || "Untitled / unverified"} · Revision {handoff.revision}. Accepted Outline plans: {handoff.acceptedCount}/4. Imported passages mapped: {handoff.mappedSourcePassages}. Mini-Blocks with saved writing: {handoff.savedWritingCount}/4.</p>
        {handoff.titleNeedsReview ? <p role="status">Project title needs review in Library: no name is inferred from imported screenplay text or this handoff.</p> : null}
        {handoff.sourceIsPartial ? <p role="status">The imported screenplay is truncated. Mapped passage counts describe retained evidence only.</p> : null}
        <p>Story Architect: {handoff.currentAssessment ? "current advisory assessment, not Human acceptance" : "no current assessment verified"}. The accepted Plan states below, not agent proposals, govern readiness.</p>
        <ol>
          {handoff.miniBlocks.map((item) => <li key={item.address}>
            <strong>Mini-Block {item.address}</strong> · {item.planAccepted ? "Plan accepted by Human" : `Plan ${item.planState} — Human acceptance required`} · {item.importedPassages} imported passage(s) · {item.savedWriting ? "saved writing present" : "no saved writing"}
          </li>)}
        </ol>
        <p>{handoff.allPlansAccepted
          ? "Ready to prepare candidate stages for this Block. Preparation is not execution."
          : "Return to Outline to review and accept the missing plans. No downstream Run can be prepared here yet."}</p>
        <small>Visualize this Block prepares proposal-only records; it does not execute agents, generate images, certify Storyboard readiness, rewrite the screenplay, or spend credits. Downstream execution and Human acceptance are separate boundaries.</small>
      </section>

      <div className={styles.columns}>
        <section className={styles.sourcePanel}>
          <div className={styles.sectionHeading}>
            <p>IMMUTABLE SOURCE EVIDENCE</p>
            <h2>What was actually imported here</h2>
          </div>
          {sourcePassages.length ? (
            <ol>
              {sourcePassages.map((passage) => (
                <li key={passage.id}>
                  <small>Scene {passage.sceneNumber} · {passage.type}</small>
                  <p>{passage.text}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>No imported screenplay passage is mapped to this Mini-Block. PlotPickle will not fabricate one.</p>
          )}
          <button disabled={!sourceText.trim()} onClick={useSourceAsStartingPoint} type="button">
            Use source as an unsaved starting point
          </button>
          <small>Source evidence is never edited by this action. It only copies text into the working editor for Human review.</small>
        </section>

        <section className={styles.editorPanel}>
          <div className={styles.sectionHeading}>
            <p>WORKING SCREENPLAY TEXT</p>
            <h2>Write this story movement</h2>
          </div>
          <textarea
            aria-label={`Working screenplay text for Block ${address.blockNumber} Mini-Block ${address.miniBlockNumber}`}
            onChange={(event) => setDraftText(event.target.value)}
            placeholder="Write only what belongs on the page. Backstory and curriculum can inform the choice without becoming exposition."
            value={draftText}
          />
          <div className={styles.editorActions}>
            <span>{savingWorkingText ? "Encrypted Save pending" : dirty ? "Unsaved changes" : savedText.trim() ? "Saved working text" : "No working text yet"}</span>
            <button disabled={!dirty || savingWorkingText} onClick={() => void save()} type="button">{savingWorkingText ? "Saving to profile…" : "Save working text"}</button>
          </div>
          {status ? <p aria-live="polite" className={styles.status}>{status}</p> : null}
        </section>
      </div>

      {revisionImpact ? (
        <section className={styles.impactPanel} aria-label="Dependency impact preview">
          <div className={styles.sectionHeading}>
            <p>CHANGE CONSEQUENCE · #2035 CHANGE SET</p>
            <h2>What this unsaved revision would invalidate</h2>
          </div>
          <div className={styles.impactSummary}>
            <span>{revisionImpact.staleAcceptedVisualArtifactIds.length} accepted visuals need review</span>
            <span>{revisionImpact.staleProductionShotIds.length} Previs Shots need review</span>
            <span>{revisionImpact.unaffectedAcceptedVisualArtifactIds.length} accepted visuals remain current</span>
            <span>{revisionImpact.unaffectedProductionShotIds.length} Previs Shots remain current</span>
          </div>
          {revisionImpact.affectedRefs.length ? (
            <details>
              <summary>Inspect {revisionImpact.affectedRefs.length} dependency-affected refs</summary>
              <ol>
                {revisionImpact.affectedRefs.slice(0, 24).map((affected) => (
                  <li key={affected.id}>
                    <strong>{affected.kind}</strong>
                    <span>{affected.id}</span>
                    <small>{affected.explanation}</small>
                  </li>
                ))}
              </ol>
            </details>
          ) : <p>No downstream creative dependency is attached to this story address yet.</p>}
          <small>Invalidation is review evidence only. It does not delete accepted work, approve replacement work, call a provider, or spend generation credits.</small>
        </section>
      ) : null}

      <section className={styles.learningPanel} aria-label="Contextual learning for this story position">
        <div className={styles.sectionHeading}>
          <p>LEARN AT THIS STORY POSITION</p>
          <h2>Use the curriculum as a reference, not a prescription.</h2>
        </div>
        <div className={styles.learningGrid}>
          {learning.references.map((reference) => (
            <article key={reference.lessonId}>
              <strong>{reference.concept}</strong>
              <p>{reference.reason}</p>
              <button onClick={() => navigateFromWrite(storyLearningHref(reference, address))} type="button">
                {reference.actionLabel}
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
