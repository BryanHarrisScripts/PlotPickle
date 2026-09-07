"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorldVisualArtifact } from "../../../core/contracts/build-progress";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import { applyStoryCommand } from "../../../core/project/apply-command";
import type { PPFProject } from "../../../core/project/project";
import { hasQaWorkspaceAccess, isQaAccessOverride } from "../../../core/progression/qa-access";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
  saveFoundationProject,
} from "../../../core/storage/foundation-project-browser";
import { deriveGuidedCreationProgression } from "../../dashboard/guided-progression";
import {
  buildWorldWireframePlan,
  WORLD_WIREFRAME_FRONTIER,
  WORLD_WIREFRAME_WORKFLOW,
  type WorldWireframeFramePlan,
} from "../wireframe/world-wireframe";
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
  return globalThis.crypto?.randomUUID?.() ?? `world-wireframe-${frameNumber}-${Date.now()}`;
}

function planKey(plan: Pick<WorldWireframeFramePlan, "parentArtifactId" | "worldDecisionKeys">) {
  return `${plan.parentArtifactId ?? "added"}:${plan.worldDecisionKeys[0] ?? "world"}`;
}

function artifactKey(artifact: Pick<WorldVisualArtifact, "parentArtifactId" | "worldDecisionKeys">) {
  return `${artifact.parentArtifactId ?? "added"}:${artifact.worldDecisionKeys[0] ?? "world"}`;
}

function latestWorldArtifacts(artifacts: readonly WorldVisualArtifact[]) {
  const latest = new Map<string, WorldVisualArtifact>();
  for (const artifact of artifacts.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))) {
    const key = artifactKey(artifact);
    if (!latest.has(key)) latest.set(key, artifact);
  }
  return latest;
}

export default function WorldBuildWorkspace({
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
    () => project ? deriveGuidedCreationProgression(curriculum, project) : null,
    [curriculum, project],
  );
  const wireframePlan = useMemo(
    () => project ? buildWorldWireframePlan(project, curriculum) : [],
    [curriculum, project],
  );

  if (!project || !progression) {
    return <main className={styles.screen}>Opening World BUILD…</main>;
  }

  const world = progression.world;
  const canonicalUnlocked = world.build !== "locked";
  const workspaceAccessible = hasQaWorkspaceAccess(canonicalUnlocked);
  const qaOnlyAccess = isQaAccessOverride(canonicalUnlocked);
  const acceptedFoundationIds = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const retainedFoundationFrames = project.build.foundations.visualArtifacts
    .filter((artifact) => acceptedFoundationIds.has(artifact.id) && artifact.reviewState !== "rejected")
    .slice()
    .sort((left, right) => (left.frameNumber ?? 1) - (right.frameNumber ?? 1));
  const artifacts = project.build.world.visualArtifacts;
  const acceptedIds = project.build.world.acceptedVisualArtifactIds;
  const latestByPlan = latestWorldArtifacts(artifacts);
  const currentWorldArtifacts = [...latestByPlan.values()]
    .filter((artifact) => artifact.reviewState !== "rejected")
    .sort((left, right) => left.frameNumber - right.frameNumber || left.createdAt.localeCompare(right.createdAt));
  const selectedRoute = routeStatus?.choice?.image || routeStatus?.image?.selected || "current Settings route";
  const selectedOption = routeStatus?.image?.options?.[selectedRoute];
  const cloudRoute = selectedOption?.locality === "cloud";
  const manualRoute = selectedOption?.locality === "manual" || selectedRoute === "manual";
  const routeReady = selectedOption?.ready !== false;
  const historyCount = artifacts.filter((artifact) => (
    artifact.reviewState === "rejected" || latestByPlan.get(artifactKey(artifact)) !== artifact
  )).length;

  const saveCommand = (command: Parameters<typeof applyStoryCommand>[1]) => {
    const next = applyStoryCommand(loadFoundationProject(), command);
    saveFoundationProject(next);
    setProject(next);
    return next;
  };

  const generateChanges = async (plans: readonly WorldWireframeFramePlan[]) => {
    if (!canonicalUnlocked || generating || !plans.length) return;
    if (manualRoute) {
      setMessage("Manual image mode is selected. Choose a configured local or cloud image route in Settings before generating World changes.");
      return;
    }
    if (!routeReady) {
      setMessage(selectedOption?.error || "The selected image route is not ready yet.");
      return;
    }
    if (cloudRoute && !billingAcknowledged) {
      setMessage(`Confirm the paid requests before sending these ${plans.length} World wireframe changes to your selected cloud provider.`);
      return;
    }

    setGenerating(true);
    let completed = 0;
    try {
      for (const plan of plans) {
        setMessage(`Creating World change ${completed + 1} of ${plans.length}…`);
        const previousWorldVersion = latestByPlan.get(planKey(plan)) ?? null;
        const response = await fetch("/api/local-ai/generate/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: plan.prompt,
            assetId: `world-${project.id}-wireframe-${plan.frameNumber}-${Date.now()}`,
            aspect: "landscape",
            quality: "low",
            requestCount: 1,
            billingAcknowledged: cloudRoute ? billingAcknowledged : false,
          }),
        });
        const result = await response.json() as ImageGenerationResponse;
        if (!response.ok || !result.ok || !result.assetUrl) {
          throw new Error(result.message || `World frame ${plan.frameNumber} returned no usable visual.`);
        }
        const now = new Date().toISOString();
        const artifact: WorldVisualArtifact = {
          id: newArtifactId(plan.frameNumber),
          assetUrl: result.assetUrl,
          prompt: result.revisedPrompt?.trim() || plan.prompt,
          createdAt: now,
          provider: result.provider || selectedRoute,
          model: result.model || selectedOption?.model || "",
          frameNumber: plan.frameNumber,
          narrativeIntention: plan.narrativeIntention,
          curriculumFrontier: WORLD_WIREFRAME_FRONTIER,
          sourceDecisionKeys: plan.sourceDecisionKeys,
          worldDecisionKeys: plan.worldDecisionKeys,
          retainedFoundationArtifactIds: plan.retainedFoundationArtifactIds,
          workflow: WORLD_WIREFRAME_WORKFLOW,
          changeKind: plan.changeKind,
          reviewState: "draft",
          parentArtifactId: previousWorldVersion?.id ?? plan.parentArtifactId,
        };
        saveCommand({ type: "world.visual.store", artifact, occurredAt: now });
        completed += 1;
      }
      setMessage(`${completed} World-driven wireframe change${completed === 1 ? "" : "s"} created. Review them individually; Foundations history remains untouched.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The selected image route could not continue.";
      setMessage(`${completed ? `${completed} World change${completed === 1 ? "" : "s"} saved before the interruption. ` : ""}${detail}`);
    } finally {
      setGenerating(false);
    }
  };

  const acceptArtifact = (artifact: WorldVisualArtifact) => {
    if (qaOnlyAccess) return;
    saveCommand({ type: "world.visual.accept", artifactId: artifact.id, occurredAt: new Date().toISOString() });
    setMessage(`World change for frame ${artifact.frameNumber} accepted. Character is next only when the canonical progression confirms World completion.`);
  };

  const unacceptArtifact = (artifact: WorldVisualArtifact) => {
    if (qaOnlyAccess) return;
    saveCommand({ type: "world.visual.unaccept", artifactId: artifact.id, occurredAt: new Date().toISOString() });
    setMessage(`Acceptance removed from World frame ${artifact.frameNumber}.`);
  };

  const rejectArtifact = (artifact: WorldVisualArtifact) => {
    if (qaOnlyAccess) return;
    saveCommand({ type: "world.visual.discard", artifactId: artifact.id, occurredAt: new Date().toISOString() });
    setMessage(`World frame ${artifact.frameNumber} rejected. Its history and parent lineage remain reviewable.`);
  };

  return (
    <main className={styles.screen} aria-label="World BUILD">
      <section className={styles.workspace}>
        <aside className={`${styles.rail} ${!canonicalUnlocked ? styles.locked : ""}`.trim()} aria-label="World BUILD progress">
          <p className={styles.kicker}>BUILD · World</p>
          <h1>{canonicalUnlocked ? "Let the world change only what it earns." : qaOnlyAccess ? "QA access is open. Finish World PLAN before BUILD." : "Finish World PLAN before BUILD."}</h1>
          <p>
            {canonicalUnlocked
              ? "World BUILD branches from accepted Foundations visuals and uses accepted World decisions only. Unaffected Foundations frames stay intact."
              : qaOnlyAccess
                ? `${world.answeredPlanFields} of ${world.totalPlanFields} World PLAN decisions are saved. The workshop is inspectable, but provider calls and PPF acceptance stay protected.`
                : `${world.answeredPlanFields} of ${world.totalPlanFields} World PLAN decisions are saved.`}
          </p>
          <dl className={styles.statusList}>
            <div><dt>FOUNDATIONS</dt><dd>✓ Preserved</dd></div>
            <div><dt>WORLD LEARN</dt><dd>{world.learn === "complete" ? "✓ Complete" : "In progress"}</dd></div>
            <div><dt>WORLD PLAN</dt><dd>{world.plan === "complete" ? "✓ Complete" : "In progress"}</dd></div>
            <div><dt>WORLD BUILD</dt><dd>{world.build === "complete" ? "✓ Accepted" : canonicalUnlocked ? "→ Available" : "🔒 Locked"}</dd></div>
            <div><dt>FRONTIER</dt><dd>Foundations + World</dd></div>
          </dl>
          <div className={styles.actions}>
            <button onClick={onOpenDashboard} type="button">Dashboard</button>
            <button onClick={onOpenPlan} type="button">Open World PLAN</button>
          </div>
        </aside>

        <section className={styles.canvas} aria-label="World Visual Narrative Wireframe workshop">
          <div className={styles.canvasHeader}>
            <div>
              <p className={styles.kicker}>Visual Narrative Wireframe · Foundations + World</p>
              <h2>Review what changed because of World</h2>
              <p>{wireframePlan.length} World-driven change{wireframePlan.length === 1 ? "" : "s"} justified by saved World decisions. Accepted Foundations frames are retained rather than overwritten.</p>
            </div>
            <span className={styles.routeBadge}>{selectedRoute}</span>
          </div>

          <div className={styles.wireframeGrid} aria-label="Retained accepted Foundations frames">
            {retainedFoundationFrames.map((artifact) => (
              <article className={styles.frameCard} key={`foundation-${artifact.id}`} data-review-state="accepted">
                <header><strong>Frame {String(artifact.frameNumber ?? 1).padStart(2, "0")}</strong><span>Retained Foundations</span></header>
                <img alt={`Retained Foundations frame ${artifact.frameNumber ?? 1} for ${project.title}`} src={artifact.assetUrl} />
                <div className={styles.frameCopy}>
                  <p>{artifact.narrativeIntention || "Accepted Foundations visual"}</p>
                  <small>Foundations · unchanged by World BUILD</small>
                </div>
              </article>
            ))}
          </div>

          {!workspaceAccessible ? (
            <div className={styles.emptyState}>
              <strong>World BUILD is waiting for PLAN.</strong>
              <p>No World image request can run before World LEARN and PLAN are complete.</p>
            </div>
          ) : currentWorldArtifacts.length ? (
            <div className={styles.wireframeGrid} aria-label="World wireframe changes">
              {currentWorldArtifacts.map((artifact) => {
                const accepted = acceptedIds.includes(artifact.id);
                const matchingPlan = wireframePlan.find((plan) => planKey(plan) === artifactKey(artifact));
                return (
                  <article className={styles.frameCard} key={artifact.id} data-review-state={artifact.reviewState}>
                    <header><strong>Frame {String(artifact.frameNumber).padStart(2, "0")}</strong><span>{accepted ? "Accepted" : "Draft"} · {artifact.changeKind}</span></header>
                    <img alt={`World wireframe ${artifact.changeKind} frame ${artifact.frameNumber} for ${project.title}`} src={artifact.assetUrl} />
                    <div className={styles.frameCopy}>
                      <p>{artifact.narrativeIntention}</p>
                      <small>{artifact.curriculumFrontier} · {artifact.model || artifact.provider || "configured image route"}</small>
                      <small>{artifact.worldDecisionKeys.length} World decision{artifact.worldDecisionKeys.length === 1 ? "" : "s"} caused this change · {artifact.parentArtifactId ? "lineage preserved" : "new World anchor"}</small>
                    </div>
                    <footer className={styles.frameActions}>
                      {!accepted
                        ? <button disabled={qaOnlyAccess} onClick={() => acceptArtifact(artifact)} type="button">Accept change</button>
                        : <button disabled={qaOnlyAccess} onClick={() => unacceptArtifact(artifact)} type="button">Unaccept</button>}
                      {matchingPlan ? <button disabled={qaOnlyAccess || generating} onClick={() => void generateChanges([matchingPlan])} type="button">Regenerate change</button> : null}
                      <button className={styles.reject} disabled={qaOnlyAccess} onClick={() => rejectArtifact(artifact)} type="button">Reject</button>
                    </footer>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>{qaOnlyAccess ? "QA access is open; no World revisions have been generated yet." : "No World revisions generated yet."}</strong>
              <p>{qaOnlyAccess ? "Inspect the World change plan and BUILD surface now. Generation stays protected until World PLAN is canonically complete." : "PlotPickle will revise a related accepted Foundations frame when World evidence materially matches it; otherwise it adds a new World anchor. It never deletes the accepted Foundations frame."}</p>
            </div>
          )}

          {workspaceAccessible ? (
            <div className={styles.generatorControls}>
              {qaOnlyAccess ? <p className={styles.message} role="status">QA access opens this workshop for testing. Provider calls and PPF visual acceptance remain disabled until canonical World BUILD access is earned.</p> : null}
              {cloudRoute ? (
                <label className={styles.consent}>
                  <input checked={billingAcknowledged} disabled={qaOnlyAccess} onChange={(event) => setBillingAcknowledged(event.target.checked)} type="checkbox" />
                  I understand this can make up to {wireframePlan.length} paid image requests and sends only accepted Foundations + World context to my selected cloud account.
                </label>
              ) : null}
              {!routeReady && selectedOption?.error ? <p className={styles.error}>{selectedOption.error}</p> : null}
              <div className={styles.primaryActions}>
                <button disabled={qaOnlyAccess || generating || manualRoute || !routeReady || !wireframePlan.length} onClick={() => void generateChanges(wireframePlan)} type="button">
                  {qaOnlyAccess ? "Generate requires World PLAN" : generating ? "Generating World changes…" : currentWorldArtifacts.length ? `Regenerate World pass (${wireframePlan.length})` : `Generate World pass (${wireframePlan.length})`}
                </button>
              </div>
              {message ? <p className={styles.message} role="status">{message}</p> : null}
            </div>
          ) : null}

          {historyCount ? (
            <details className={styles.history}>
              <summary>World wireframe history ({historyCount} earlier or rejected version{historyCount === 1 ? "" : "s"})</summary>
              <ul>
                {artifacts.filter((artifact) => artifact.reviewState === "rejected" || latestByPlan.get(artifactKey(artifact)) !== artifact).map((artifact) => (
                  <li key={artifact.id}>Frame {artifact.frameNumber} · {artifact.changeKind} · {artifact.reviewState} · parent {artifact.parentArtifactId || "new World anchor"}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      </section>
    </main>
  );
}