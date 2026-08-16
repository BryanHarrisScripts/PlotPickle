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

function visualPrompt(project: PPFProject, curriculum: readonly CurriculumLesson[]) {
  const lessons = buildFoundationPlanLessons(curriculum);
  const brief = project.foundations.brief.content.trim() || assembleFoundationsBrief({
    projectTitle: project.title,
    lessons,
    state: project.foundations,
  });
  return [
    `Create one broad exploratory graphic-novel concept image for “${project.title}”.`,
    "This is a Foundations BUILD sketch, not final story canon. Visualize the story's established tone, mood, central dramatic promise, pressure, world texture, and emotional experience without inventing new plot facts.",
    "Use only the writer-approved decisions below. Prefer a cinematic landscape composition that communicates the whole project's visual direction rather than a literal finished page. No text, captions, speech bubbles, logos, watermarks, or typography.",
    "WRITER-APPROVED FOUNDATIONS BRIEF:",
    brief,
  ].join("\n\n").slice(0, 30_000);
}

function newArtifactId() {
  return globalThis.crypto?.randomUUID?.() ?? `foundations-visual-${Date.now()}`;
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

  if (!project || !progression) {
    return <main className={styles.screen}>Opening Foundations BUILD…</main>;
  }

  const unlocked = progression.build !== "locked";
  const artifacts = project.build.foundations.visualArtifacts;
  const currentArtifact = artifacts[0] ?? null;
  const acceptedIds = project.build.foundations.acceptedVisualArtifactIds;
  const currentAccepted = Boolean(currentArtifact && acceptedIds.includes(currentArtifact.id));
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

  const saveCommand = (command: Parameters<typeof applyStoryCommand>[1]) => {
    const next = applyStoryCommand(loadFoundationProject(), command);
    saveFoundationProject(next);
    setProject(next);
    return next;
  };

  const generateVisual = async () => {
    if (!unlocked || generating) return;
    if (manualRoute) {
      setMessage("Manual image mode is selected. Choose ComfyUI, Ollama + ComfyUI, or a configured cloud image provider in Settings before generating.");
      return;
    }
    if (cloudRoute && !billingAcknowledged) {
      setMessage("Confirm the paid image request before sending the Foundations Brief to the selected cloud provider.");
      return;
    }

    setGenerating(true);
    setMessage("Creating one Foundations concept from your approved PLAN decisions…");
    try {
      const prompt = visualPrompt(project, curriculum);
      const response = await fetch("/api/local-ai/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          assetId: `foundations-${project.id}`,
          aspect: "landscape",
          quality: "medium",
          requestCount: 1,
          billingAcknowledged: cloudRoute ? billingAcknowledged : false,
        }),
      });
      const result = await response.json() as ImageGenerationResponse;
      if (!response.ok || !result.ok || !result.assetUrl) {
        throw new Error(result.message || "The selected image provider returned no usable visual.");
      }
      const now = new Date().toISOString();
      const artifact: FoundationsVisualArtifact = {
        id: newArtifactId(),
        assetUrl: result.assetUrl,
        prompt: result.revisedPrompt?.trim() || prompt,
        createdAt: now,
        provider: result.provider || selectedRoute,
        model: result.model || selectedOption?.model || "",
      };
      saveCommand({ type: "foundations.visual.store", artifact, occurredAt: now });
      setMessage("Concept created. Review it before accepting it; generation alone does not complete BUILD.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Foundations BUILD could not create a visual.");
    } finally {
      setGenerating(false);
    }
  };

  const acceptCurrent = () => {
    if (!currentArtifact) return;
    saveCommand({
      type: "foundations.visual.accept",
      artifactId: currentArtifact.id,
      occurredAt: new Date().toISOString(),
    });
    setMessage("Accepted. Foundations BUILD is complete and WORLD is now unlocked on the Dashboard.");
  };

  const unacceptCurrent = () => {
    if (!currentArtifact) return;
    saveCommand({
      type: "foundations.visual.unaccept",
      artifactId: currentArtifact.id,
      occurredAt: new Date().toISOString(),
    });
    setMessage("Acceptance removed. WORLD is locked again until a Foundations visual is accepted.");
  };

  const rejectCurrent = () => {
    if (!currentArtifact) return;
    saveCommand({
      type: "foundations.visual.discard",
      artifactId: currentArtifact.id,
      occurredAt: new Date().toISOString(),
    });
    setMessage("Concept rejected and removed from the project. Generate another when ready.");
  };

  return (
    <main className={styles.screen} aria-label="Foundations BUILD">
      <section className={styles.workspace}>
        <aside className={`${styles.rail} ${!unlocked ? styles.locked : ""}`.trim()} aria-label="Foundations BUILD progress">
          <p className={styles.kicker}>BUILD · Foundations</p>
          <h1>{unlocked ? "See the story you planned." : "Finish PLAN before BUILD."}</h1>
          <p>
            {unlocked
              ? "BUILD turns your approved Foundations decisions into an exploratory visual. You—not the generator—decide when a concept is good enough to accept."
              : `You have ${progression.answeredPlanFields} of ${progression.totalPlanFields} Foundations PLAN answers saved. Complete the remaining decisions first.`}
          </p>
          <dl className={styles.statusList}>
            <div><dt>LEARN</dt><dd>{progression.learn === "complete" ? "✓ Complete" : "In progress"}</dd></div>
            <div><dt>PLAN</dt><dd>{progression.plan === "complete" ? "✓ Complete" : "In progress"}</dd></div>
            <div><dt>BUILD</dt><dd>{progression.build === "complete" ? "✓ Complete" : unlocked ? "→ Available" : "🔒 Locked"}</dd></div>
            <div><dt>WORLD</dt><dd>{progression.worldUnlocked ? "→ Unlocked" : "🔒 Locked"}</dd></div>
          </dl>
          <div className={styles.actions}>
            <button onClick={onOpenDashboard} type="button">Dashboard</button>
            <button onClick={onOpenPlan} type="button">Open PLAN</button>
          </div>
        </aside>

        <section className={styles.canvas} aria-label="Foundations visual workshop">
          <div className={styles.canvasHeader}>
            <div>
              <p className={styles.kicker}>Concept workshop</p>
              <h2>{currentArtifact ? "Review the latest concept" : "Create the first Foundations sketch"}</h2>
            </div>
            <span className={styles.routeBadge}>{selectedRoute}</span>
          </div>

          {!unlocked ? (
            <div className={styles.emptyState}>
              <strong>BUILD is waiting for PLAN.</strong>
              <p>Nothing is generated early, so visual output cannot silently redefine an unfinished story foundation.</p>
            </div>
          ) : currentArtifact ? (
            <figure className={styles.artifact}>
              <img alt={`Foundations concept for ${project.title}`} src={currentArtifact.assetUrl} />
              <figcaption>
                {currentAccepted ? "✓ Accepted Foundations visual" : "Generated concept · not yet accepted"}
                {currentArtifact.model ? ` · ${currentArtifact.model}` : ""}
              </figcaption>
            </figure>
          ) : (
            <div className={styles.emptyState}>
              <strong>No concept has been accepted—or even generated—yet.</strong>
              <p>Create one image from the current Foundations Brief, then decide whether it belongs to the project.</p>
            </div>
          )}

          {unlocked ? (
            <div className={styles.generatorControls}>
              {cloudRoute ? (
                <label className={styles.consent}>
                  <input
                    checked={billingAcknowledged}
                    onChange={(event) => setBillingAcknowledged(event.target.checked)}
                    type="checkbox"
                  />
                  I understand this single image request can charge my selected cloud provider account and sends the Foundations Brief to that provider.
                </label>
              ) : null}
              {!routeReady && selectedOption?.error ? <p className={styles.error}>{selectedOption.error}</p> : null}
              <div className={styles.primaryActions}>
                <button disabled={generating || manualRoute} onClick={generateVisual} type="button">
                  {generating ? "Generating…" : currentArtifact ? "Regenerate" : "Generate concept"}
                </button>
                {currentArtifact && !currentAccepted ? <button onClick={acceptCurrent} type="button">Accept visual</button> : null}
                {currentArtifact && currentAccepted ? <button onClick={unacceptCurrent} type="button">Unaccept</button> : null}
                {currentArtifact ? <button className={styles.reject} onClick={rejectCurrent} type="button">Reject</button> : null}
              </div>
              {message ? <p className={styles.message} role="status">{message}</p> : null}
            </div>
          ) : null}

          {artifacts.length > 1 ? (
            <details className={styles.history}>
              <summary>Previous concepts ({artifacts.length - 1})</summary>
              <ul>
                {artifacts.slice(1).map((artifact) => (
                  <li key={artifact.id}>
                    <a href={artifact.assetUrl} target="_blank" rel="noreferrer">Open concept from {new Date(artifact.createdAt).toLocaleString()}</a>
                    {acceptedIds.includes(artifact.id) ? " · ✓ accepted" : ""}
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
