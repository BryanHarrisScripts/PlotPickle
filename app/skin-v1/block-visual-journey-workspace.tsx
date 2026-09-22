"use client";

/* eslint-disable @next/next/no-img-element -- generated local/cloud visual assets are served through PlotPickle's existing media boundary. */

import { useEffect, useMemo, useRef, useState } from "react";
import type { FoundationsVisualArtifact } from "@/core/contracts/build-progress";
import { applyStoryCommand } from "@/core/project/apply-command";
import type { PPFProject } from "@/core/project/project";
import {
  FOUNDATION_PROJECT_SAVED_EVENT,
  loadFoundationProject,
  saveFoundationProject,
} from "@/core/storage/foundation-project-browser";
import {
  hydratedStoryMapContext,
  persistStoryMapContext,
} from "@/core/storage/profile-private-browser";
import { storyboardAnchorEvidence } from "../_components/storyboard/storyboard-editorial-model";
import type { PreproductionReviewAddress } from "./preproduction-review-surfaces";
import styles from "./block-visual-journey-workspace.module.css";

export type BlockVisualJourneyStage = "outline" | "storyboard" | "previs" | "timeline" | "production";

const WORKFLOW = "block-visual-journey-v1" as const;
const PREVIEW_HOLD_MS = 2500;

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

type Passage = ReturnType<typeof storyboardAnchorEvidence>["passages"][number];

function targetId(blockNumber: number) {
  return `block:block-${String(blockNumber).padStart(2, "0")}`;
}

function anchorRef(address: PreproductionReviewAddress) {
  return `storyboard-anchor:${targetId(address.blockNumber)}:mini-${address.miniBlockNumber}`;
}

function passageKey(passageId: string) {
  return `block-visual-passage:${passageId}`;
}

function sequenceKey(address: PreproductionReviewAddress, passageId: string) {
  return `block-visual-sequence:block-${String(address.blockNumber).padStart(2, "0")}:mini-${address.miniBlockNumber}:${passageId}`;
}

function freshId(address: PreproductionReviewAddress, frameNumber: number) {
  return globalThis.crypto?.randomUUID?.()
    ?? `block-visual-${address.blockNumber}-${address.miniBlockNumber}-${frameNumber}-${Date.now()}`;
}

function initialPrompt(project: PPFProject, address: PreproductionReviewAddress, passage: Passage) {
  const text = passage.text.trim().slice(0, 2400);
  return [
    `Create one cinematic storyboard image for ${project.title || "this story"}.`,
    `Block ${String(address.blockNumber).padStart(2, "0")}, Mini-Block ${address.miniBlockNumber}, Scene ${passage.sceneNumber || "unknown"}.`,
    `Source passage: ${text}`,
    "Visualize the dramatic action, emotion, staging, and story information the audience should see at this exact moment.",
    "Preserve established character and location continuity when approved references are available.",
    "Do not print screenplay dialogue, captions, titles, UI, typography, logos, or watermarks in the image.",
    "This is a visual-development candidate only; generation does not change story canon.",
  ].join(" ");
}

function continuationPrompt(
  project: PPFProject,
  address: PreproductionReviewAddress,
  passage: Passage,
  frameNumber: number,
) {
  const purpose = frameNumber === 2
    ? "Advance the visual action from the first accepted image. Show the meaningful action or change, not a near-duplicate pose."
    : frameNumber === 3
      ? "Show the reaction, consequence, or changed story state that completes this short visual progression."
      : frameNumber === 4
        ? "Add a distinct coverage image that clarifies spatial, emotional, or story progression."
        : "Add a final distinct coverage image only where it advances the selected narrative moment.";
  return [
    `Create storyboard sequence image ${frameNumber} for ${project.title || "this story"}.`,
    `Block ${String(address.blockNumber).padStart(2, "0")}, Mini-Block ${address.miniBlockNumber}, Scene ${passage.sceneNumber || "unknown"}.`,
    `Source passage: ${passage.text.trim().slice(0, 2400)}`,
    purpose,
    "Maintain continuity with the accepted first image: character identity, wardrobe, location, props, lighting, and screen direction where visible.",
    "Do not print dialogue, captions, titles, UI, typography, logos, or watermarks.",
    "This is draft sequence coverage and does not become canon merely because it was generated.",
  ].join(" ");
}

function sequenceArtifacts(
  project: PPFProject,
  address: PreproductionReviewAddress,
  passageId: string,
) {
  const anchor = anchorRef(address);
  const source = passageKey(passageId);
  const byFrame = new Map<number, FoundationsVisualArtifact>();
  for (const artifact of project.build.foundations.visualArtifacts) {
    if (artifact.workflow !== WORKFLOW || artifact.reviewState === "rejected") continue;
    const keys = artifact.sourceDecisionKeys ?? [];
    if (!keys.includes(anchor) || !keys.includes(source)) continue;
    const frame = artifact.frameNumber ?? 1;
    const current = byFrame.get(frame);
    if (!current || current.createdAt <= artifact.createdAt) byFrame.set(frame, artifact);
  }
  return [...byFrame.values()].sort((left, right) => (left.frameNumber ?? 1) - (right.frameNumber ?? 1));
}

export default function BlockVisualJourneyWorkspace({
  address,
  stage,
  onAddressChange,
}: {
  readonly address: PreproductionReviewAddress;
  readonly stage: BlockVisualJourneyStage;
  readonly onAddressChange: (address: PreproductionReviewAddress) => void;
}) {
  const [project, setProject] = useState<PPFProject | null>(null);
  const [routeStatus, setRouteStatus] = useState<ImageRouteStatus | null>(null);
  const [selectedPassageId, setSelectedPassageId] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [billingAcknowledged, setBillingAcknowledged] = useState(false);
  const [message, setMessage] = useState("");
  const [playing, setPlaying] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const promptPassageRef = useRef("");

  useEffect(() => {
    const sync = () => {
      try {
        setProject(loadFoundationProject());
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The canonical project could not be opened.");
      }
    };
    sync();
    window.addEventListener(FOUNDATION_PROJECT_SAVED_EVENT, sync);
    return () => window.removeEventListener(FOUNDATION_PROJECT_SAVED_EVENT, sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai-routing/status", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<ImageRouteStatus> : null)
      .then((status) => { if (!cancelled && status) setRouteStatus(status); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const evidence = useMemo(
    () => project ? storyboardAnchorEvidence(project, targetId(address.blockNumber), address.miniBlockNumber) : null,
    [address.blockNumber, address.miniBlockNumber, project],
  );
  const passages = evidence?.passages ?? [];
  const selectedPassage = passages.find((passage) => passage.id === selectedPassageId) ?? passages[0] ?? null;
  const artifacts = useMemo(
    () => project && selectedPassage
      ? sequenceArtifacts(project, address, selectedPassage.id)
      : [],
    [address, project, selectedPassage],
  );
  const firstImage = artifacts.find((artifact) => (artifact.frameNumber ?? 1) === 1) ?? null;
  const acceptedIds = useMemo(
    () => new Set(project?.build.foundations.acceptedVisualArtifactIds ?? []),
    [project],
  );
  const firstImageAccepted = Boolean(firstImage && acceptedIds.has(firstImage.id) && firstImage.reviewState === "accepted");
  const selectedRoute = routeStatus?.choice?.image || routeStatus?.image?.selected || "current Settings route";
  const selectedOption = routeStatus?.image?.options?.[selectedRoute];
  const cloudRoute = selectedOption?.locality === "cloud";
  const manualRoute = selectedOption?.locality === "manual" || selectedRoute === "manual";
  const routeReady = selectedOption?.ready !== false;
  const currentPreview = artifacts[previewIndex] ?? artifacts[0] ?? null;

  useEffect(() => {
    if (!project || !passages.length) {
      setSelectedPassageId("");
      promptPassageRef.current = "";
      setDraftPrompt("");
      return;
    }
    if (passages.some((passage) => passage.id === selectedPassageId)) return;
    const remembered = hydratedStoryMapContext(project.id);
    const preferred = remembered?.blockNumber === address.blockNumber
      && remembered?.miniBlockNumber === address.miniBlockNumber
      && remembered.passageId
      && passages.some((passage) => passage.id === remembered.passageId)
      ? remembered.passageId
      : passages[0].id;
    setSelectedPassageId(preferred);
  }, [address.blockNumber, address.miniBlockNumber, passages, project, selectedPassageId]);

  useEffect(() => {
    if (!project || !selectedPassage || promptPassageRef.current === selectedPassage.id) return;
    promptPassageRef.current = selectedPassage.id;
    setDraftPrompt(initialPrompt(project, address, selectedPassage));
    setMessage("");
    setPlaying(false);
    setPreviewIndex(0);
  }, [address, project, selectedPassage]);

  useEffect(() => {
    if (!project || !selectedPassage) return;
    void persistStoryMapContext(project.id, {
      blockNumber: address.blockNumber,
      miniBlockNumber: address.miniBlockNumber,
      stage,
      passageId: selectedPassage.id,
    }).catch(() => undefined);
  }, [address.blockNumber, address.miniBlockNumber, project, selectedPassage, stage]);

  useEffect(() => {
    if (!playing) return;
    if (artifacts.length < 3) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setPreviewIndex((current) => {
        if (current >= artifacts.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, PREVIEW_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [artifacts.length, playing, previewIndex]);

  useEffect(() => {
    if (previewIndex < artifacts.length) return;
    setPreviewIndex(Math.max(0, artifacts.length - 1));
  }, [artifacts.length, previewIndex]);

  function choosePassage(passage: Passage) {
    setSelectedPassageId(passage.id);
    promptPassageRef.current = passage.id;
    if (project) setDraftPrompt(initialPrompt(project, address, passage));
    setMessage("");
    setPlaying(false);
    setPreviewIndex(0);
  }

  async function generateOne(submittedPrompt: string, frameNumber: number, parentArtifactId: string | null) {
    if (!project || !selectedPassage) throw new Error("Select written source before generating an image.");
    const requestProjectId = project.id;
    const requestAddress = { ...address };
    const requestPassageId = selectedPassage.id;
    const response = await fetch("/api/local-ai/generate/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: submittedPrompt,
        assetId: `block-visual-${requestProjectId}-${requestAddress.blockNumber}-${requestAddress.miniBlockNumber}-${frameNumber}-${Date.now()}`,
        aspect: "landscape",
        quality: "low",
        requestCount: 1,
        billingAcknowledged: cloudRoute ? billingAcknowledged : false,
      }),
    });
    const result = await response.json() as ImageGenerationResponse;
    if (!response.ok || !result.ok || !result.assetUrl) {
      throw new Error(result.message || "The image route returned no usable visual.");
    }

    const current = loadFoundationProject();
    if (current.id !== requestProjectId) {
      throw new Error("The active project changed while this image was generating. PlotPickle did not attach the late result to the new project.");
    }
    if (address.blockNumber !== requestAddress.blockNumber
      || address.miniBlockNumber !== requestAddress.miniBlockNumber
      || selectedPassage.id !== requestPassageId) {
      throw new Error("The selected story position changed while this image was generating. PlotPickle did not attach the late result to the new selection.");
    }

    const now = new Date().toISOString();
    const artifact: FoundationsVisualArtifact = {
      id: freshId(requestAddress, frameNumber),
      assetUrl: result.assetUrl,
      prompt: submittedPrompt,
      createdAt: now,
      provider: result.provider || selectedRoute,
      model: result.model || selectedOption?.model || "",
      frameNumber,
      narrativeIntention: frameNumber === 1
        ? `First image for ${requestPassageId}`
        : `Sequence image ${frameNumber} for ${requestPassageId}`,
      sourceDecisionKeys: [
        `storyboard-target:${targetId(requestAddress.blockNumber)}`,
        anchorRef(requestAddress),
        passageKey(requestPassageId),
        sequenceKey(requestAddress, requestPassageId),
        `block-visual-frame:${frameNumber}`,
        `source-revision:${project.revision}`,
        "image-aspect:landscape",
        "image-quality:low",
      ],
      workflow: WORKFLOW,
      reviewState: "draft",
      parentArtifactId,
    };
    const next = applyStoryCommand(current, {
      type: "foundations.visual.store",
      artifact,
      occurredAt: now,
    });
    saveFoundationProject(next);
    setProject(next);
    return artifact;
  }

  function generationReady() {
    if (!selectedPassage) {
      setMessage("Select a real screenplay passage before creating a visual.");
      return false;
    }
    if (manualRoute) {
      setMessage("Manual image mode is selected. Choose a configured image provider in Settings before generating.");
      return false;
    }
    if (!routeReady) {
      setMessage(selectedOption?.error || "The selected image route is not ready yet.");
      return false;
    }
    if (cloudRoute && !billingAcknowledged) {
      setMessage("Confirm the paid image request before sending work to the selected cloud provider.");
      return false;
    }
    return true;
  }

  async function createFirstImage() {
    if (!project || !selectedPassage || generating || !generationReady()) return;
    const submittedPrompt = draftPrompt.trim();
    if (!submittedPrompt) {
      setMessage("Enter the image prompt first.");
      return;
    }
    setGenerating(true);
    setMessage("Creating the first image from the selected passage…");
    try {
      await generateOne(submittedPrompt, 1, null);
      setMessage("First image created. Review it, then choose Use image before building the sequence.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The first image could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  function useFirstImage() {
    if (!project || !firstImage || firstImageAccepted) return;
    const now = new Date().toISOString();
    const anchor = anchorRef(address);
    let next = loadFoundationProject();
    const accepted = new Set(next.build.foundations.acceptedVisualArtifactIds);
    for (const artifact of next.build.foundations.visualArtifacts) {
      if (artifact.id === firstImage.id || !accepted.has(artifact.id)) continue;
      if ((artifact.sourceDecisionKeys ?? []).includes(anchor)) {
        next = applyStoryCommand(next, {
          type: "foundations.visual.unaccept",
          artifactId: artifact.id,
          occurredAt: now,
        });
      }
    }
    next = applyStoryCommand(next, {
      type: "foundations.visual.accept",
      artifactId: firstImage.id,
      occurredAt: now,
    });
    saveFoundationProject(next);
    setProject(next);
    setMessage("First image accepted as the working visual for this story address. Build sequence can now add narrative progression.");
  }

  async function buildSequence() {
    if (!project || !selectedPassage || !firstImage || !firstImageAccepted || generating || !generationReady()) return;
    const neededFrames = [2, 3].filter((frame) => !artifacts.some((artifact) => artifact.frameNumber === frame));
    if (!neededFrames.length) {
      setMessage("The three-image sequence is already ready to preview.");
      return;
    }
    setGenerating(true);
    let parentId = artifacts.at(-1)?.id ?? firstImage.id;
    let completed = 0;
    try {
      for (const frameNumber of neededFrames) {
        const prompt = continuationPrompt(project, address, selectedPassage, frameNumber);
        const artifact = await generateOne(prompt, frameNumber, parentId);
        parentId = artifact.id;
        completed += 1;
        setMessage(`${completed} of ${neededFrames.length} sequence image${neededFrames.length === 1 ? "" : "s"} created…`);
      }
      setMessage("Three-image sequence ready. Play preview keeps the images in this workspace.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Sequence generation stopped.";
      setMessage(`${completed} sequence image${completed === 1 ? "" : "s"} completed before the stop. ${detail} Retry creates only the missing frame.`);
    } finally {
      setGenerating(false);
    }
  }

  function playPreview() {
    if (artifacts.length < 3) {
      setMessage("Build at least three real sequence images before playing the preview.");
      return;
    }
    if (playing) {
      setPlaying(false);
      setMessage("Preview paused.");
      return;
    }
    setPreviewIndex(0);
    setPlaying(true);
    setMessage("Playing still-image animatic in place. Proposed holds are preview data, not approved timing.");
  }

  if (!project) {
    return <section className={styles.workspace} data-block-visual-journey="loading"><p role="status">{message || "Opening Block visual workspace…"}</p></section>;
  }

  return (
    <section
      className={styles.workspace}
      data-block-visual-journey={stage}
      data-block-number={address.blockNumber}
      data-mini-block-number={address.miniBlockNumber}
      aria-labelledby="block-visual-journey-title"
    >
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>BLOCK VISUAL WORKSPACE · {stage.toUpperCase()}</p>
          <h2 id="block-visual-journey-title">{project.title || "Untitled Story"} · Block {String(address.blockNumber).padStart(2, "0")}</h2>
          <p>Written source, generated assets, prompts, and the rough preview stay attached to the same story address as you move through the five stages.</p>
        </div>
        <div className={styles.identity}>
          <strong>MINI {address.miniBlockNumber}</strong>
          <span>{selectedPassage ? selectedPassage.id : "No passage selected"}</span>
          <small>{artifacts.length} sequence image{artifacts.length === 1 ? "" : "s"} · PPF revision {project.revision}</small>
        </div>
      </header>

      <div className={styles.columns}>
        <section className={styles.source} aria-label="Written source passages">
          <header>
            <strong>1 · SELECT WRITTEN PASSAGE</strong>
            <span>{passages.length} passage{passages.length === 1 ? "" : "s"}</span>
          </header>
          {passages.length ? (
            <ol>
              {passages.map((passage) => (
                <li key={passage.id}>
                  <button
                    aria-pressed={passage.id === selectedPassage?.id}
                    onClick={() => choosePassage(passage)}
                    type="button"
                  >
                    <small>Scene {passage.sceneNumber || "—"} · {passage.type}</small>
                    <span>{passage.text}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p>No observed screenplay text is attached to this Mini-Block. PlotPickle does not invent a passage to enable image generation.</p>
          )}
        </section>

        <section className={styles.preview} aria-label="Block visual preview">
          <header>
            <strong>2 · VISUAL OUTCOME</strong>
            <span>{firstImageAccepted ? "FIRST IMAGE ACCEPTED" : firstImage ? "REVIEW FIRST IMAGE" : "NO IMAGE YET"}</span>
          </header>
          {currentPreview ? (
            <figure>
              <img
                alt={currentPreview.narrativeIntention || `Storyboard image ${previewIndex + 1}`}
                src={currentPreview.assetUrl}
              />
              <figcaption>
                <strong>IMAGE {previewIndex + 1} / {artifacts.length}</strong>
                <span>{currentPreview.provider}{currentPreview.model ? ` · ${currentPreview.model}` : ""}</span>
                <small>{playing ? `Playing · proposed ${PREVIEW_HOLD_MS / 1000}s hold` : currentPreview.reviewState === "accepted" ? "Accepted working visual" : "Draft sequence coverage"}</small>
              </figcaption>
            </figure>
          ) : (
            <div className={styles.empty}>Select written source and create the first real image.</div>
          )}

          <div className={styles.strip} aria-label="Sequence images">
            {artifacts.map((artifact, index) => (
              <button
                aria-current={index === previewIndex ? "true" : undefined}
                key={artifact.id}
                onClick={() => { setPreviewIndex(index); setPlaying(false); }}
                type="button"
              >
                <img alt="" src={artifact.assetUrl} />
                <span>{index + 1}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.prompt} aria-label="Image prompt and action">
        <header>
          <div>
            <strong>3 · NEXT ACTION</strong>
            <span>{selectedRoute}</span>
          </div>
          <small>Prompt stored exactly as submitted with the returned asset.</small>
        </header>
        <textarea
          aria-label="Editable first-image prompt"
          disabled={generating || Boolean(firstImage)}
          onChange={(event) => setDraftPrompt(event.target.value)}
          rows={5}
          value={draftPrompt}
        />
        {cloudRoute ? (
          <label className={styles.billing}>
            <input
              checked={billingAcknowledged}
              disabled={generating}
              onChange={(event) => setBillingAcknowledged(event.target.checked)}
              type="checkbox"
            />
            I understand this selected cloud image route may charge my connected provider account.
          </label>
        ) : null}
        <div className={styles.actions}>
          {!firstImage ? (
            <button disabled={generating || !selectedPassage} onClick={() => void createFirstImage()} type="button">
              {generating ? "CREATING IMAGE…" : "CREATE FIRST IMAGE"}
            </button>
          ) : !firstImageAccepted ? (
            <button disabled={generating} onClick={useFirstImage} type="button">USE IMAGE</button>
          ) : artifacts.length < 3 ? (
            <button disabled={generating} onClick={() => void buildSequence()} type="button">
              {generating ? "BUILDING SEQUENCE…" : "BUILD 3-IMAGE SEQUENCE"}
            </button>
          ) : (
            <button onClick={playPreview} type="button">{playing ? "PAUSE PREVIEW" : "PLAY PREVIEW"}</button>
          )}
          <span>{firstImage ? "First image → " : ""}{firstImageAccepted ? "accepted → " : ""}{artifacts.length >= 3 ? "sequence ready → " : ""}{artifacts.length >= 3 ? "play in place" : "next step appears here"}</span>
        </div>
        <p className={styles.message} role="status">{message}</p>
      </section>

      <footer className={styles.footer}>
        <span>Block {String(address.blockNumber).padStart(2, "0")} · Mini {address.miniBlockNumber}</span>
        <span>Outline → Storyboard → Previs → Timeline → Production</span>
        <button
          onClick={() => onAddressChange({ blockNumber: address.blockNumber, miniBlockNumber: address.miniBlockNumber })}
          type="button"
        >
          KEEP THIS STORY ADDRESS
        </button>
      </footer>
    </section>
  );
}
