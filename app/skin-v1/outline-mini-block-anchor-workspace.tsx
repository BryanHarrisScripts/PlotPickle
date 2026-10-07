"use client";

import { authenticatedComputeFetch as fetch } from "../../core/auth/profile-request-browser";

/* eslint-disable @next/next/no-img-element -- Outline reuses PlotPickle local/bundled Storyboard assets. */

import { useEffect, useMemo, useRef, useState } from "react";
import type { FoundationsVisualArtifact } from "@/core/contracts/build-progress";
import { isSupportedVisualAssetUrl } from "@/core/media/visual-asset-url";
import { applyStoryCommand } from "@/core/project/apply-command";
import type { PPFProject } from "@/core/project/project";
import { saveFoundationProject } from "@/core/storage/foundation-project-browser";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import {
  createStoryboardReferenceArtifact,
  storyboardAnchorEvidence,
  storyboardAnchorTargetRef,
  storyboardReferenceCandidates,
} from "@/app/_components/storyboard/storyboard-editorial-model";
import styles from "./outline-mini-block-workspace.module.css";

const LOCAL_SAVE_MARKER = "storyboard-local-save:v1";
const FRAME_WORKFLOW = "storyboard-frame-webp-v2";
const REFERENCE_WORKFLOW = "storyboard-reference-adoption-v1";

function storyboardTargetId(blockNumber: number) {
  return `block:block-${String(blockNumber).padStart(2, "0")}`;
}

function savedLocally(artifact: FoundationsVisualArtifact) {
  return isSupportedVisualAssetUrl(artifact.assetUrl)
    && (artifact.sourceDecisionKeys ?? []).includes(LOCAL_SAVE_MARKER);
}

type Candidate = ReturnType<typeof storyboardReferenceCandidates>[number];
type Version =
  | { kind: "artifact"; id: string; assetUrl: string; label: string; artifact: FoundationsVisualArtifact }
  | { kind: "reference"; id: string; assetUrl: string; label: string; candidate: Candidate };

export default function OutlineMiniBlockAnchorWorkspace({ project, blockNumber, miniBlockNumber, onProjectChange }: {
  readonly project: LibraryPPFProject;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly onProjectChange: (project: LibraryPPFProject) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const pendingSelectedId = useRef("");
  const [busy, setBusy] = useState(false);
  const [generationApproved, setGenerationApproved] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const targetId = storyboardTargetId(blockNumber);
  const anchorRef = storyboardAnchorTargetRef(targetId, miniBlockNumber);
  const acceptedIds = useMemo(() => new Set(project.build.foundations.acceptedVisualArtifactIds), [project]);
  const evidence = useMemo(() => storyboardAnchorEvidence(project, targetId, miniBlockNumber), [miniBlockNumber, project, targetId]);
  const candidates = useMemo(() => storyboardReferenceCandidates(project, targetId)
    .filter((candidate) => candidate.miniBlockNumber === miniBlockNumber), [miniBlockNumber, project, targetId]);
  const artifacts = useMemo(() => project.build.foundations.visualArtifacts
    .filter((artifact) => {
      if (artifact.reviewState === "rejected" || !(artifact.sourceDecisionKeys ?? []).includes(anchorRef)) return false;
      if (artifact.workflow === FRAME_WORKFLOW) return artifact.frameNumber === 1;
      return artifact.workflow === REFERENCE_WORKFLOW;
    })
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt)), [anchorRef, project]);
  const versions = useMemo<readonly Version[]>(() => [
    ...candidates
      .filter((candidate) => !candidate.acceptedArtifactId || !artifacts.some((artifact) => artifact.id === candidate.acceptedArtifactId))
      .map((candidate) => ({ kind: "reference" as const, id: `reference:${candidate.id}`, assetUrl: candidate.assetUrl, label: candidate.caption, candidate })),
    ...artifacts.map((artifact) => ({ kind: "artifact" as const, id: artifact.id, assetUrl: artifact.assetUrl, label: artifact.narrativeIntention || `Mini-Block ${blockNumber}.${miniBlockNumber} visual anchor`, artifact })),
  ], [artifacts, blockNumber, candidates, miniBlockNumber]);

  useEffect(() => {
    const pending = pendingSelectedId.current;
    if (pending && versions.some((version) => version.id === pending)) {
      pendingSelectedId.current = "";
      if (selectedId !== pending) setSelectedId(pending);
      return;
    }
    if (versions.some((version) => version.id === selectedId)) return;
    const accepted = versions.find((version) => version.kind === "artifact" && acceptedIds.has(version.artifact.id));
    const latest = [...versions].reverse().find((version) => version.kind === "artifact");
    setSelectedId((accepted ?? latest ?? versions[0])?.id ?? "");
  }, [acceptedIds, selectedId, versions]);

  const selectedIndex = Math.max(0, versions.findIndex((version) => version.id === selectedId));
  const selected = versions[selectedIndex] ?? null;
  const selectedArtifact = selected?.kind === "artifact" ? selected.artifact : null;
  const isLocked = Boolean(selectedArtifact && acceptedIds.has(selectedArtifact.id));
  const isSaved = Boolean(selectedArtifact && savedLocally(selectedArtifact));

  function commit(next: PPFProject, status: string) {
    const saved = saveFoundationProject(next) as LibraryPPFProject;
    onProjectChange(saved);
    setMessage(status);
  }

  async function createVersion() {
    if (!generationApproved || busy) return;
    setBusy(true);
    setMessage(`Creating a new visual anchor for Mini-Block ${blockNumber}.${miniBlockNumber}…`);
    try {
      const screenplay = evidence.passages.slice(0, 6).map((passage) => passage.text).join(" ").replace(/\s+/gu, " ").trim();
      const prompt = [
        `Create one cinematic storyboard visual anchor for ${project.title || "this story"}, Block ${String(blockNumber).padStart(2, "0")}, Mini-Block ${miniBlockNumber}.`,
        screenplay ? `Screenplay evidence: ${screenplay.slice(0, 2200)}.` : "No screenplay passage is mapped here; do not invent a plot event.",
        "Represent the Mini-Block as one clear landscape composition suitable as its shared Outline and Storyboard anchor.",
        "Preserve established identity, geography, props, wardrobe, time of day and continuity where supported. No collage, captions, logos or watermarks. Output one WebP image.",
      ].join(" ");
      const response = await fetch("/api/local-ai/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, assetId: `outline-anchor-${project.id}-${blockNumber}-${miniBlockNumber}-${Date.now()}`, aspect: "landscape", quality: "low", outputFormat: "webp", requestCount: 1, billingAcknowledged: generationApproved }),
      });
      const result = await response.json() as { ok?: boolean; assetUrl?: string; provider?: string; model?: string; message?: string };
      if (!response.ok || !result.ok || !result.assetUrl?.endsWith(".webp")) throw new Error(result.message || "The image route did not return a WebP anchor.");
      const now = new Date().toISOString();
      const artifact: FoundationsVisualArtifact = {
        id: globalThis.crypto.randomUUID(),
        assetUrl: result.assetUrl,
        prompt,
        createdAt: now,
        provider: result.provider || "configured image route",
        model: result.model || "",
        frameNumber: 1,
        narrativeIntention: `Shared Outline / Storyboard visual anchor · Mini-Block ${blockNumber}.${miniBlockNumber}`,
        sourceDecisionKeys: [`storyboard-target:${targetId}`, anchorRef, "storyboard-position:1", "outline-anchor-generation:v1", `ppf-revision:${project.revision}`],
        workflow: FRAME_WORKFLOW,
        reviewState: "draft",
        parentArtifactId: selectedArtifact?.id ?? null,
      };
      const next = applyStoryCommand(project, { type: "foundations.visual.store", artifact, occurredAt: now });
      pendingSelectedId.current = artifact.id;
      commit(next, `Created a new shared visual anchor version for Mini-Block ${blockNumber}.${miniBlockNumber}. Save and Lock remain separate decisions.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Visual anchor generation failed.");
    } finally {
      setBusy(false);
    }
  }

  function saveVersion() {
    if (!selectedArtifact || isSaved || busy) return;
    if (!isSupportedVisualAssetUrl(selectedArtifact.assetUrl)) {
      setMessage("This visual is not a supported PlotPickle project image and cannot be saved.");
      return;
    }
    const now = new Date().toISOString();
    const artifact: FoundationsVisualArtifact = { ...selectedArtifact, sourceDecisionKeys: [...new Set([...(selectedArtifact.sourceDecisionKeys ?? []), LOCAL_SAVE_MARKER])] };
    const next = applyStoryCommand(project, { type: "foundations.visual.store", artifact, occurredAt: now });
    commit(next, `Saved this Mini-Block ${blockNumber}.${miniBlockNumber} anchor with the project. Packaged source media remains immutable.`);
  }

  function toggleLockVersion() {
    if (!selected || busy) return;
    const now = new Date().toISOString();
    let next: PPFProject = project;

    if (isLocked && selectedArtifact) {
      next = applyStoryCommand(next, { type: "foundations.visual.unaccept", artifactId: selectedArtifact.id, occurredAt: now });
      pendingSelectedId.current = selectedArtifact.id;
      commit(next, `Unlocked Mini-Block ${blockNumber}.${miniBlockNumber}. The visual remains available as a version but is no longer the shared visual authority.`);
      return;
    }

    const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
    for (const artifact of project.build.foundations.visualArtifacts.filter((candidate) => accepted.has(candidate.id) && (candidate.sourceDecisionKeys ?? []).includes(anchorRef))) {
      next = applyStoryCommand(next, { type: "foundations.visual.unaccept", artifactId: artifact.id, occurredAt: now });
    }
    let artifactId = selectedArtifact?.id ?? "";
    if (selected.kind === "reference") {
      const artifact = createStoryboardReferenceArtifact({ project, targetId, candidate: selected.candidate, occurredAt: now });
      next = applyStoryCommand(next, { type: "foundations.visual.store", artifact, occurredAt: now });
      artifactId = artifact.id;
    }
    if (!artifactId) return;
    next = applyStoryCommand(next, { type: "foundations.visual.accept", artifactId, occurredAt: now });
    pendingSelectedId.current = artifactId;
    commit(next, `Locked Mini-Block ${blockNumber}.${miniBlockNumber} to this shared visual anchor. Storyboard reads the same foundations visual authority.`);
  }

  function deleteVersion() {
    if (!selectedArtifact || busy) return;
    const now = new Date().toISOString();
    const next = applyStoryCommand(project, { type: "foundations.visual.delete", artifactId: selectedArtifact.id, occurredAt: now });
    commit(next, `Deleted this Mini-Block ${blockNumber}.${miniBlockNumber} anchor version.`);
    setPendingDeleteId(null);
    setSelectedId("");
  }

  return <section className={styles.anchorWorkspace} aria-labelledby="outline-mini-anchor-title" data-outline-mini-block-anchor={anchorRef}>
    <header className={styles.header}><div><p>VISUAL ANCHOR · SHARED WITH STORYBOARD</p><h2 id="outline-mini-anchor-title">Mini-Block {blockNumber}.{miniBlockNumber}</h2><span>One representative visual at this story address. The full 25-position Storyboard sequence remains in Storyboard.</span></div><strong>{anchorRef}</strong></header>
    <div className={styles.anchorBody}>
      <div className={styles.preview} data-locked={isLocked ? "true" : "false"}>
        <span className={styles.versionCount}>{versions.length ? `${selectedIndex + 1}/${versions.length}` : "0/0"}</span>
        {versions.length > 1 ? <button aria-label="Previous anchor version" className={`${styles.chevron} ${styles.previous}`} disabled={selectedIndex <= 0} type="button" onClick={() => setSelectedId(versions[selectedIndex - 1].id)}>‹</button> : null}
        {selected ? <img alt={selected.label} decoding="async" loading="lazy" src={selected.assetUrl} /> : <span className={styles.empty}>No visual anchor yet</span>}
        {isSaved ? <span className={`${styles.badge} ${styles.savedBadge}`}>Saved locally</span> : null}
        {isLocked ? <span className={styles.lockedOverlay}>LOCKED</span> : null}
        {isLocked ? <span className={`${styles.badge} ${styles.lockedBadge}`}>Locked</span> : null}
        {versions.length > 1 ? <button aria-label="Next anchor version" className={`${styles.chevron} ${styles.next}`} disabled={selectedIndex >= versions.length - 1} type="button" onClick={() => setSelectedId(versions[selectedIndex + 1].id)}>›</button> : null}
      </div>
      <div className={styles.controls}>
        <p>{selected?.label || `Mini-Block ${blockNumber}.${miniBlockNumber} has no anchor candidate yet.`}</p>
        <label><input type="checkbox" checked={generationApproved} disabled={busy} onChange={(event) => setGenerationApproved(event.target.checked)} /> I approve one image generation request through my configured provider.</label>
        <div className={styles.actions}><button disabled={!generationApproved || busy} type="button" onClick={() => void createVersion()}>{busy ? "Creating…" : selected ? "Create new version" : "Generate anchor"}</button><button disabled={!selectedArtifact || isSaved || busy} type="button" onClick={saveVersion}>Save</button><button aria-pressed={isLocked} disabled={!selected || busy} type="button" onClick={toggleLockVersion}>{isLocked ? "Unlock" : "Lock"}</button><button disabled={!selectedArtifact || busy} type="button" onClick={() => setPendingDeleteId(selectedArtifact?.id ?? null)}>Delete</button></div>
        {pendingDeleteId && selectedArtifact?.id === pendingDeleteId ? <div className={styles.deleteConfirm} role="alert"><span>Delete this version forever? This cannot be undone.</span><button type="button" onClick={deleteVersion}>Yes</button><button type="button" onClick={() => setPendingDeleteId(null)}>No</button></div> : null}
        <p className={styles.status} role="status">{message}</p>
      </div>
    </div>
  </section>;
}
