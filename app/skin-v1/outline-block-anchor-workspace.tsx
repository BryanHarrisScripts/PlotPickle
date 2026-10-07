"use client";

import { authenticatedComputeFetch as fetch } from "../../core/auth/profile-request-browser";

/* eslint-disable @next/next/no-img-element -- Outline reuses PlotPickle local/bundled project assets. */

import { useEffect, useMemo, useRef, useState } from "react";
import type { FoundationsVisualArtifact } from "@/core/contracts/build-progress";
import { applyStoryCommand } from "@/core/project/apply-command";
import type { PPFProject } from "@/core/project/project";
import { saveFoundationProject } from "@/core/storage/foundation-project-browser";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import legacyManifest from "@/data/afterglow-visual-manifest.json";
import styles from "./outline-mini-block-workspace.module.css";

const BLOCK_WORKFLOW = "outline-block-anchor-webp-v1";
const LOCAL_SAVE_MARKER = "outline-block-anchor-local-save:v1";

type LegacyBlockVisual = {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly proposedBlockNumbers: readonly number[];
  readonly images: { readonly full: string };
};

type Version =
  | { readonly kind: "artifact"; readonly id: string; readonly assetUrl: string; readonly label: string; readonly artifact: FoundationsVisualArtifact }
  | { readonly kind: "legacy"; readonly id: string; readonly assetUrl: string; readonly label: string; readonly legacy: LegacyBlockVisual };

function blockAnchorRef(blockNumber: number) {
  return `outline-block-anchor:block-${String(blockNumber).padStart(2, "0")}`;
}

function savedLocally(artifact: FoundationsVisualArtifact) {
  return artifact.assetUrl.startsWith("/api/local-ai/assets/")
    && (artifact.sourceDecisionKeys ?? []).includes(LOCAL_SAVE_MARKER);
}

export default function OutlineBlockAnchorWorkspace({ project, blockNumber, onProjectChange }: {
  readonly project: LibraryPPFProject;
  readonly blockNumber: number;
  readonly onProjectChange: (project: LibraryPPFProject) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const pendingSelectedId = useRef("");
  const [busy, setBusy] = useState(false);
  const [generationApproved, setGenerationApproved] = useState(false);
  const [message, setMessage] = useState("");
  const anchorRef = blockAnchorRef(blockNumber);
  const acceptedIds = useMemo(() => new Set(project.build.foundations.acceptedVisualArtifactIds), [project]);
  const block = project.structure.blocks.find((candidate) => candidate.number === blockNumber);
  const legacy = useMemo(() => (/afterglow/iu.test(project.title || "")
    ? (legacyManifest as readonly LegacyBlockVisual[]).filter((visual) => visual.kind === "block-cover" && visual.proposedBlockNumbers.includes(blockNumber))
    : []), [blockNumber, project.title]);
  const artifacts = useMemo(() => project.build.foundations.visualArtifacts
    .filter((artifact) => artifact.reviewState !== "rejected"
      && artifact.workflow === BLOCK_WORKFLOW
      && (artifact.sourceDecisionKeys ?? []).includes(anchorRef))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt)), [anchorRef, project]);
  const versions = useMemo<readonly Version[]>(() => [
    ...legacy.map((visual) => ({ kind: "legacy" as const, id: `legacy:${visual.id}`, assetUrl: visual.images.full, label: visual.title, legacy: visual })),
    ...artifacts.map((artifact) => ({ kind: "artifact" as const, id: artifact.id, assetUrl: artifact.assetUrl, label: artifact.narrativeIntention || `Block ${blockNumber} visual anchor`, artifact })),
  ], [artifacts, blockNumber, legacy]);

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
    setMessage(`Creating a new Block ${blockNumber} visual anchor…`);
    try {
      const prompt = [
        `Create one cinematic visual anchor for ${project.title || "this story"}, Block ${String(blockNumber).padStart(2, "0")}.`,
        block?.title ? `Block title: ${block.title}.` : "",
        block?.note ? `Story intent: ${block.note}.` : "",
        "Represent the whole Block as one readable landscape composition. Do not depict a 25-shot sequence.",
        "Preserve established identity, geography, props, wardrobe, time of day and continuity where supported. No collage, captions, logos or watermarks. Output one WebP image.",
      ].filter(Boolean).join(" ");
      const response = await fetch("/api/local-ai/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, assetId: `outline-block-anchor-${project.id}-${blockNumber}-${Date.now()}`, aspect: "landscape", quality: "low", outputFormat: "webp", requestCount: 1, billingAcknowledged: generationApproved }),
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
        narrativeIntention: `Outline Block visual anchor · Block ${blockNumber}`,
        sourceDecisionKeys: [anchorRef, "outline-block-anchor-generation:v1", `ppf-revision:${project.revision}`],
        workflow: BLOCK_WORKFLOW,
        reviewState: "draft",
        parentArtifactId: selectedArtifact?.id ?? null,
      };
      const next = applyStoryCommand(project, { type: "foundations.visual.store", artifact, occurredAt: now });
      pendingSelectedId.current = artifact.id;
      commit(next, `Created a Block ${blockNumber} visual anchor version. Save and Lock remain separate decisions.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Block visual anchor generation failed.");
    } finally {
      setBusy(false);
    }
  }

  function saveVersion() {
    if (!selectedArtifact || isSaved || busy) return;
    if (!selectedArtifact.assetUrl.startsWith("/api/local-ai/assets/")) {
      setMessage("Bundled project references are already local. Generate a new version to use explicit Save state.");
      return;
    }
    const now = new Date().toISOString();
    const artifact: FoundationsVisualArtifact = { ...selectedArtifact, sourceDecisionKeys: [...new Set([...(selectedArtifact.sourceDecisionKeys ?? []), LOCAL_SAVE_MARKER])] };
    const next = applyStoryCommand(project, { type: "foundations.visual.store", artifact, occurredAt: now });
    commit(next, `Saved the Block ${blockNumber} visual anchor locally with the project.`);
  }

  function lockVersion() {
    if (!selected || isLocked || busy) return;
    const now = new Date().toISOString();
    let next: PPFProject = project;
    const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
    for (const artifact of project.build.foundations.visualArtifacts.filter((candidate) => accepted.has(candidate.id) && (candidate.sourceDecisionKeys ?? []).includes(anchorRef))) {
      next = applyStoryCommand(next, { type: "foundations.visual.unaccept", artifactId: artifact.id, occurredAt: now });
    }
    let artifactId = selectedArtifact?.id ?? "";
    if (selected.kind === "legacy") {
      const artifact: FoundationsVisualArtifact = {
        id: globalThis.crypto.randomUUID(),
        assetUrl: selected.assetUrl,
        prompt: "",
        createdAt: now,
        provider: "bundled-project-reference",
        model: "",
        frameNumber: 1,
        narrativeIntention: `Outline Block visual anchor · ${selected.label}`,
        sourceDecisionKeys: [anchorRef, `afterglow-legacy:${selected.legacy.id}`, `ppf-revision:${project.revision}`],
        workflow: BLOCK_WORKFLOW,
        reviewState: "draft",
        parentArtifactId: null,
      };
      next = applyStoryCommand(next, { type: "foundations.visual.store", artifact, occurredAt: now });
      artifactId = artifact.id;
    }
    if (!artifactId) return;
    next = applyStoryCommand(next, { type: "foundations.visual.accept", artifactId, occurredAt: now });
    pendingSelectedId.current = artifactId;
    commit(next, `Locked Block ${blockNumber} to this visual anchor. Mini-Block anchors remain independent.`);
  }

  return <section className={styles.anchorWorkspace} aria-labelledby="outline-block-anchor-title" data-outline-block-anchor={anchorRef}>
    <header className={styles.header}><div><p>BLOCK VISUAL ANCHOR</p><h2 id="outline-block-anchor-title">Block {String(blockNumber).padStart(2, "0")}</h2><span>One image represents the selected Block. Mini-Block anchors and Storyboard's 25 shots remain separate layers.</span></div><strong>{anchorRef}</strong></header>
    <div className={styles.anchorBody}>
      <div className={styles.preview}>
        <span className={styles.versionCount}>{versions.length ? `${selectedIndex + 1}/${versions.length}` : "0/0"}</span>
        {versions.length > 1 ? <button aria-label="Previous Block anchor version" className={`${styles.chevron} ${styles.previous}`} disabled={selectedIndex <= 0} type="button" onClick={() => setSelectedId(versions[selectedIndex - 1].id)}>‹</button> : null}
        {selected ? <img alt={selected.label} decoding="async" loading="lazy" src={selected.assetUrl} /> : <span className={styles.empty}>No Block visual anchor yet</span>}
        {isSaved ? <span className={`${styles.badge} ${styles.savedBadge}`}>Saved locally</span> : null}
        {isLocked ? <span className={`${styles.badge} ${styles.lockedBadge}`}>Locked</span> : null}
        {versions.length > 1 ? <button aria-label="Next Block anchor version" className={`${styles.chevron} ${styles.next}`} disabled={selectedIndex >= versions.length - 1} type="button" onClick={() => setSelectedId(versions[selectedIndex + 1].id)}>›</button> : null}
      </div>
      <div className={styles.controls}>
        <p>{selected?.label || `Block ${blockNumber} has no visual anchor yet.`}</p>
        <label><input type="checkbox" checked={generationApproved} disabled={busy} onChange={(event) => setGenerationApproved(event.target.checked)} /> I approve one image generation request through my configured provider.</label>
        <div className={styles.actions}><button disabled={!generationApproved || busy} type="button" onClick={() => void createVersion()}>{busy ? "Creating…" : selected ? "Create new version" : "Generate Block anchor"}</button><button disabled={!selectedArtifact || isSaved || busy} type="button" onClick={saveVersion}>Save</button><button disabled={!selected || isLocked || busy} type="button" onClick={lockVersion}>Lock</button></div>
        <p className={styles.status} role="status">{message}</p>
      </div>
    </div>
  </section>;
}
