"use client";

import { useEffect, useMemo, useState } from "react";
import type { FoundationsVisualArtifact } from "../../../core/contracts/build-progress";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import {
  assembleFoundationsBrief,
  buildFoundationPlanLessons,
} from "../../../core/contracts/foundation-plan";
import { applyStoryCommand } from "../../../core/project/apply-command";
import type { PPFProject } from "../../../core/project/project";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
  saveFoundationProject,
} from "../../../core/storage/foundation-project-browser";
import { deriveFoundationsProgression } from "../../dashboard/foundations-progression";
import {
  buildFoundationsWireframePlan,
  FOUNDATIONS_WIREFRAME_FRONTIER,
  FOUNDATIONS_WIREFRAME_WORKFLOW,
  type FoundationsWireframeFramePlan,
} from "../wireframe/foundations-wireframe";
import styles from "./foundations-build-workspace.module.css";

type ImageRouteStatus = {
  readonly choice?: { readonly image?: string };
  readonly image?: {
    readonly selected?: string;
    readonly options?: Readonly<Record<string, {
      readonly ready?: boolean;
      readonly locality?: string;
      readonly model?: string;
      readonly error?: string;
    }>>;
  };
};

type ImageGenerationResponse = {
  readonly ok?: boolean;
  readonly assetUrl?: string;
  readonly revisedPrompt?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly message?: string;
};

function newArtifactId(frameNumber: number) {
  return globalThis.crypto?.randomUUID?.() ?? `foundations-wireframe-${frameNumber}-${Date.now()}`;
}

function latestFrameArtifacts(artifacts: readonly FoundationsVisualArtifact[]) {
  const latest = new Map<number, FoundationsVisualArtifact>();
  for (const artifact of artifacts) {
    if (!artifact.frameNumber || latest.has(artifact.frameNumber)) continue;
    latest.set(artifact.frameNumber, artifact);
  }
  return latest;
}

export default function FoundationsBuildWorkspace({
  curriculum,
  onOpenDashboard,
  onOpenPlan,
}: {
  readonly curriculum: readonly CurriculumLesson[];
  readonly onOpenDashboard: () => void;
  readonly onOpenPlan: () => void;
}) {
  const [project, setProject] = useState<PPFProject | null>(null);
  const [routeStatus, setRouteStatus] = useState<ImageRouteStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [billingAcknowledged, setBillingAcknowledged] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const sync = () => setProject(loadFoundationProject());
    sync();
    window.addEventListener(FOUNDATION_PROJECT_SAVED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(FOUNDATION_PROJECT_SAVED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai-routing/status", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<ImageRouteStatus> : null)
      .then((status) => {
        if (!cancelled && status) setRouteStatus(status);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const progression = useMemo(
    () => project ? deriveFoundationsProgression(curriculum, project) : null,
    [curriculum, project],
  );
  const wireframePlan = useMemo(
    () => project ? buildFoundationsWireframePlan(project, curriculum) : [],
    [curriculum, project],
  );

  if (!project || !progression) {
    return <main className={styles.screen}>Opening Foundations BUILD…</main>;
  }

  const unlocked = progression.build !== "locked";
  const artifacts = project.build.foundations.visualArtifacts;
  const acceptedIds = project.build.foundations.acceptedVisualArtifactIds;
  const latestByFrame = latestFrameArtifacts(artifacts);
  const wireframeFrames = [...latestByFrame.values()]
    .filter((artifact) => artifact.reviewState !== "rejected")
    .sort((left, right) => (left.frameNumber ?? 0) - (right.frameNumber ?? 0));
  const legacyConcept = artifacts.find((artifact) => !artifact.frameNumber && artifact.reviewState !== "rejected") ?? null;
  const selectedRoute = routeStatus?.choice?.image || routeStatus?.image?.selected || "current Settings route";
  const selectedOption = routeStatus?.image?.options?.[selectedRoute];
  const cloudRoute = selectedOption?.locality === "cloud";
  const manualRoute = selectedOption?.locality === "manual" || selectedRoute === "manual";
  const routeReady = selectedOption?.ready !== false;
  const brief = project.foundations.brief.content.trim() || assembleFoundationsBrief({
    projectTitle: project.title,
    lessons: buildFoundationPlanLessons(curriculum),
    state: project.foundations,
  });
  const rejectedCount = artifacts.filter((artifact) => artifact.reviewState === "rejected").length;
  const supersededCount = artifacts.filter((artifact) => artifact.frameNumber && latestByFrame.get(artifact.frameNumber) !== artifact).length;

  const saveCommand = (command: Parameters<typeof applyStoryCommand>[1]) => {
    const next = applyStoryCommand(loadFoundationProject(), command);
    saveFoundationProject(next);
    setProject(next);
    return next;
  };

  const generateFrames = async (plans: readonly FoundationsWireframeFramePlan[]) => {
    if (!unlocked || generating || !plans.length) return;
    if (manualRoute) {
      setMessage("Manual image mode is selected. Choose ComfyUI, Ollama + ComfyUI, or a configured cloud image provider in Settings before generating.");
      return;
    }
    if (!routeReady) {
      setMessage(selectedOption?.error || "The selected image route is not ready yet.");
      return;
    }
    if (cloudRoute && !billingAcknowledged) {
      setMessage(`Confirm the paid image requests before sending this ${plans.length}-frame Foundations wireframe to the selected cloud provider.`);
      return;
    }

    setGenerating(true);
    let completed = 0;
    try {
      for (const frame of plans) {
        setMessage(`Creating rough wireframe frame ${completed + 1} of ${plans.length}…`);
        const parent = latestByFrame.get(frame.frameNumber) ?? null;
        const response = await fetch("/api/local-ai/generate/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: frame.prompt,
            assetId: `foundations-${project.id}-wireframe-${frame.frameNumber}-${Date.now()}`,
            aspect: "landscape",
            quality: "low",
            requestCount: 1,
            billingAcknowledged: cloudRoute ? billingAcknowledged : false,
          }),
        });
        const result = await response.json() as ImageGenerationResponse;
        if (!response.ok || !result.ok || !result.assetUrl) {
          throw new Error(result.message || `Frame ${frame.frameNumber} returned no usable visual.`);
        }
        const now = new Date().toISOString();
        const artifact: FoundationsVisualArtifact = {
          id: newArtifactId(frame.frameNumber),
          assetUrl: result.assetUrl,
          prompt: result.revisedPrompt?.trim() || frame.prompt,
          createdAt: now,
          provider: result.provider || selectedRoute,
          model: result.model || selectedOption?.model || "",
          frameNumber: frame.frameNumber,
          narrativeIntention: frame.narrativeIntention,
          curriculumFrontier: FOUNDATIONS_WIREFRAME_FRONTIER,
          sourceDecisionKeys: frame.sourceDecisionKeys,
          workflow: FOUNDATIONS_WIREFRAME_WORKFLOW,
          reviewState: "draft",
          parentArtifactId: parent?.id ?? null,
        };
        saveCommand({ type: "foundations.visual.store", artifact, occurredAt: now });
        completed += 1;
      }
      setMessage(`${completed} rough wireframe frame${completed === 1 ? "" : "s"} created. Review frames individually; generation alone does not complete BUILD.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The selected image provider could not continue.";
      setMessage(`${completed ? `${completed} frame${completed === 1 ? "" : "s"} saved before the interruption. ` : ""}${detail}`);
    } finally {
      setGenerating(false);
    }
  };

  const acceptArtifact = (artifact: FoundationsVisualArtifact) => {
    saveCommand({
      type: "foundations.visual.accept",
      artifactId: artifact.id,
      occurredAt: new Date().toISOString(),
    });
    setMessage(`Frame ${artifact.frameNumber ?? 1} accepted. The visual remains reviewable and can be revised later.`);
  };

  const unacceptArtifact = (artifact: FoundationsVisualArtifact) => {
    saveCommand({
      type: "foundations.visual.unaccept",
      artifactId: artifact.id,
      occurredAt: new Date().toISOString(),
    });
    setMessage(`Acceptance removed from frame ${artifact.frameNumber ?? 1}.`);
  };

  const rejectArtifact = (artifact: FoundationsVisualArtifact) => {
    saveCommand({
      type: "foundations.visual.discard",
      artifactId: artifact.id,
      occurredAt: new Date().toISOString(),
    });
    setMessage(`Frame ${artifact.frameNumber ?? 1} rejected. Its provenance stays in history instead of being deleted.`);
  };

  return (
    <main className={styles.screen} aria-label="Foundations BUILD">
      <section className={styles.workspace}>
        <aside className={`${styles.rail} ${!unlocked ? styles.locked : ""}`.trim()} aria-label="Foundations BUILD progress">
          <p className={styles.kicker}>BUILD · Foundations</p>
          <h1>{unlocked ? "Sketch the story you have earned so far." : "Finish PLAN before BUILD."}</h1>
          <p>
            {unlocked
              ? "BUILD turns approved Foundations decisions into a rough Visual Narrative Wireframe. It cannot borrow future World, Character, Theme, or Structure answers."
              : `You have ${progression.answeredPlanFields} of ${progression.totalPlanFields} Foundations PLAN answers saved. Complete the remaining decisions first.`}
          </p>
          <dl className={styles.statusList}>
            <div><dt>LEARN</dt><dd>{progression.learn === "complete" ? "✓ Complete" : "In progress"}</dd></div>
            <div><dt>PLAN</dt><dd>{progression.plan === "complete" ? "✓ Complete" : "In progress"}</dd></div>
            <div><dt>BUILD</dt><dd>{progression.build === "complete" ? "✓ Accepted" : unlocked ? "→ Available" : "🔒 Locked"}</dd></div>
            <div><dt>FRONTIER</dt><dd>Foundations only</dd></div>
            <div><dt>WORLD</dt><dd>{progression.worldUnlocked ? "→ Unlocked" : "🔒 Locked"}</dd></div>
          </dl>
          <div className={styles.actions}>
            <button onClick={onOpenDashboard} type="button">Dashboard</button>
            <button onClick={onOpenPlan} type="button">Open PLAN</button>
          </div>
        </aside>

        <section className={styles.canvas} aria-label="Foundations Visual Narrative Wireframe workshop">
          <div className={styles.canvasHeader}>
            <div>
              <p className={styles.kicker}>Visual Narrative Wireframe · Foundations only</p>
              <h2>{wireframeFrames.length ? "Review the living sketchbook" : "Create the first rough narrative sequence"}</h2>
              <p>{wireframePlan.length} meaningful frame{wireframePlan.length === 1 ? "" : "s"} planned from accepted Foundations decisions; PlotPickle never pads the sequence to a fixed count.</p>
            </div>
            <span className={styles.routeBadge}>{selectedRoute}</span>
          </div>

          {!unlocked ? (
            <div className={styles.emptyState}>
              <strong>BUILD is waiting for PLAN.</strong>
              <p>Nothing is generated early, so visual output cannot silently redefine an unfinished story foundation.</p>
            </div>
          ) : wireframeFrames.length ? (
            <div className={styles.wireframeGrid} aria-label="Foundations wireframe frames">
              {wireframeFrames.map((artifact) => {
                const accepted = acceptedIds.includes(artifact.id);
                const framePlan = wireframePlan.find((frame) => frame.frameNumber === artifact.frameNumber);
                return <article className={styles.frameCard} key={artifact.id} data-review-state={artifact.reviewState || "draft"}>
                  <header><strong>Frame {String(artifact.frameNumber ?? 1).padStart(2, "0")}</strong><span>{accepted ? "Accepted" : "Draft"}</span></header>
                  <img alt={`Foundations wireframe frame ${artifact.frameNumber ?? 1} for ${project.title}`} src={artifact.assetUrl} />
                  <div className={styles.frameCopy}>
                    <p>{artifact.narrativeIntention || "Legacy Foundations concept"}</p>
                    <small>{artifact.curriculumFrontier || "Foundations"} · {artifact.model || artifact.provider || "configured image route"}</small>
                    <small>{artifact.sourceDecisionKeys?.length ?? 0} source decision{artifact.sourceDecisionKeys?.length === 1 ? "" : "s"} · {artifact.parentArtifactId ? "revised from earlier frame" : "first version"}</small>
                  </div>
                  <footer className={styles.frameActions}>
                    {!accepted ? <button onClick={() => acceptArtifact(artifact)} type="button">Accept</button> : <button onClick={() => unacceptArtifact(artifact)} type="button">Unaccept</button>}
                    {framePlan ? <button disabled={generating} onClick={() => void generateFrames([framePlan])} type="button">Regenerate frame</button> : null}
                    <button className={styles.reject} onClick={() => rejectArtifact(artifact)} type="button">Reject</button>
                  </footer>
                </article>;
              })}
            </div>
          ) : legacyConcept ? (
            <figure className={styles.artifact}>
              <img alt={`Legacy Foundations concept for ${project.title}`} src={legacyConcept.assetUrl} />
              <figcaption>Legacy single Foundations concept · preserved for compatibility. Generate the wireframe to begin the progressive frame sequence.</figcaption>
            </figure>
          ) : (
            <div className={styles.emptyState}>
              <strong>No wireframe has been generated yet.</strong>
              <p>The frame plan comes only from saved Foundations decisions. Fewer meaningful frames are better than invented beats.</p>
            </div>
          )}

          {unlocked ? (
            <div className={styles.generatorControls}>
              {cloudRoute ? (
                <label className={styles.consent}>
                  <input checked={billingAcknowledged} onChange={(event) => setBillingAcknowledged(event.target.checked)} type="checkbox" />
                  I understand this wireframe can make up to {wireframePlan.length} separate paid image requests through my selected cloud account and sends the approved Foundations context with each request.
                </label>
              ) : null}
              {!routeReady && selectedOption?.error ? <p className={styles.error}>{selectedOption.error}</p> : null}
              <div className={styles.primaryActions}>
                <button disabled={generating || manualRoute || !routeReady || !wireframePlan.length} onClick={() => void generateFrames(wireframePlan)} type="button">
                  {generating ? "Generating rough frames…" : wireframeFrames.length ? `Regenerate wireframe (${wireframePlan.length})` : `Generate wireframe (${wireframePlan.length})`}
                </button>
              </div>
              {message ? <p className={styles.message} role="status">{message}</p> : null}
            </div>
          ) : null}

          {rejectedCount || supersededCount ? (
            <details className={styles.history}>
              <summary>Wireframe history ({rejectedCount} rejected · {supersededCount} superseded)</summary>
              <ul>
                {artifacts.filter((artifact) => artifact.reviewState === "rejected" || (artifact.frameNumber && latestByFrame.get(artifact.frameNumber) !== artifact)).map((artifact) => (
                  <li key={artifact.id}>
                    <a href={artifact.assetUrl} target="_blank" rel="noreferrer">Frame {artifact.frameNumber ?? 1} · {new Date(artifact.createdAt).toLocaleString()}</a>
                    {artifact.reviewState === "rejected" ? " · rejected" : " · superseded"}
                    {artifact.parentArtifactId ? ` · parent ${artifact.parentArtifactId.slice(0, 8)}…` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        <aside className={styles.rail} aria-label="Approved Foundations context">
          <p className={styles.kicker}>Source of truth</p>
          <h2>Foundations Brief</h2>
          <p>BUILD can visualize these decisions, but it cannot rewrite them. Return to PLAN if the story itself needs to change.</p>
          <pre className={styles.brief} aria-label="Saved Foundations brief">{brief}</pre>
        </aside>
      </section>
    </main>
  );
}
