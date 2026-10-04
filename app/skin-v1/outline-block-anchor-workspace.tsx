"use client";

/* eslint-disable @next/next/no-img-element -- Outline reuses project-owned local/bundled image assets. */

import { useEffect, useMemo, useState } from "react";
import legacyVisualManifest from "@/data/afterglow-visual-manifest.json";
import type { FoundationsVisualArtifact } from "@/core/contracts/build-progress";
import { applyStoryCommand } from "@/core/project/apply-command";
import type { PPFProject } from "@/core/project/project";
import { saveFoundationProject } from "@/core/storage/foundation-project-browser";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import styles from "./outline-mini-block-workspace.module.css";

const LOCAL_SAVE_MARKER = "outline-block-local-save:v1";
const BLOCK_WORKFLOW = "outline-block-anchor-webp-v1";
const REFERENCE_WORKFLOW = "outline-block-reference-adoption-v1";

type LegacyCandidate = (typeof legacyVisualManifest)[number];
type Version =
  | { kind: "artifact"; id: string; assetUrl: string; label: string; artifact: FoundationsVisualArtifact }
  | { kind: "legacy"; id: string; assetUrl: string; label: string; candidate: LegacyCandidate };

function blockRef(blockNumber: number) {
  return String(blockNumber).padStart(2, "0");
}

function blockAnchorRef(blockNumber: number) {
  return `outline-block-anchor:block:block-${blockRef(blockNumber)}`;
}

function savedLocally(artifact: FoundationsVisualArtifact) {
  return artifact.assetUrl.startsWith("/api/local-ai/assets/")
    && (artifact.sourceDecisionKeys ?? []).includes(LOCAL_SAVE_MARKER);
}

export default function OutlineBlockAnchorWorkspace({
  project,
  blockNumber,
  onProjectChange,
}: {
  readonly project: LibraryPPFProject;
  readonly blockNumber: number;
  readonly onProjectChange: (project: LibraryPPFProject) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [generationApproved, setGenerationApproved] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const anchorRef = blockAnchorRef(blockNumber);
  const acceptedIds = useMemo(() => new Set(project.build.foundations.acceptedVisualArtifactIds), [project]);
  const legacyCandidates = useMemo(() => {
    if (!/afterglow/i.test(project.title)) return [];
    return legacyVisualManifest.filter((candidate) =>
      candidate.kind === "block-cover"
      && candidate.mappingStatus !== "retired"
      && candidate.proposedBlockNumbers.includes(blockNumber));
  }, [blockNumber, project.title]);
  const artifacts = useMemo(() => project.build.foundations.visualArtifacts
    .filter((artifact) =>
      artifact.reviewState !== "rejected"
      && (artifact.sourceDecisionKeys ?? []).includes(anchorRef))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt)), [anchorRef, project]);
  const versions = useMemo<readonly Version[]>(() => [
    ...legacyCandidates
      .filter((candidate) => !artifacts.some((artifact) =>
        (artifact.sourceDecisionKeys ?? []).includes(`legacy-afterglow-visual:${candidate.id}`)))
      .map((candidate) => ({
        kind: "legacy" as const,
        id: `legacy:${candidate.id}`,
        assetUrl: candidate.images.full,
        label: candidate.title,
        candidate,
      })),
    ...artifacts.map((artifact) => ({
      kind: "artifact" as const,
      id: artifact.id,
      assetUrl: artifact.assetUrl,
      label: artifact.narrativeIntention || `Block ${blockRef(blockNumber)} visual anchor`,
      artifact,
    })),
  ], [artifacts, blockNumber, legacyCandidates]);

  useEffect(() => {
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
  const block = project.structure.blocks.find((candidate) => candidate.number === blockNumber) ?? null;

  function commit(next: PPFProject, status: string) {
    const saved = saveFoundationProject(next) as LibraryPPFProject;
    onProjectChange(saved);
    setMessage(status);
  }

  async function createVersion() {
    if (!generationApproved || busy) return;
    setBusy(true);
    setMessage(`Creating a new Block Visual Anchor for Block ${blockRef(blockNumber)}…`);
    try {
      const passages = (project.sourceEvidence.screenplay?.passages ?? [])
        .filter((passage) => passage.blockNumber === blockNumber)
        .slice(0, 10)
        .map((passage) => passage.text)
        .join(" ")
        .replace(/\s+/gu, " ")
        .trim();
      const prompt = [
        `Create one cinematic Block Visual Anchor for ${project.title || "this story"}, Block ${blockRef(blockNumber)}.`,
        block?.title ? `Block title: ${block.title}.` : "",
        block?.note ? `Block intent: ${block.note.slice(0, 1200)}.` : "",
        passages ? `Screenplay evidence: ${passages.slice(0, 2600)}.` : "No screenplay passage is mapped here; do not invent a plot event.",
        "Represent the entire Block as one clear landscape composition. This image is the Block-level anchor, not a Mini-Block image and not one of the 25 Storyboard shots.",
        "Preserve established identity, geography, props, wardrobe, time of day and continuity where supported. No collage, captions, logos or watermarks. Output one WebP image.",
      ].filter(Boolean).join(" ");
      const response = await fetch("/api/local-ai/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          assetId: `outline-block-anchor-${project.id}-${blockNumber}-${Date.now()}`,
          aspect: "landscape",
          quality: "low",
          outputFormat: "webp",
          requestCount: 1,
          billingAcknowledged: generationApproved,
        }),
      });
      const result = await response.json() as { ok?: boolean; assetUrl?: string; provider?: string; model?: string; message?: string };
      if (!response.ok || !result.ok || !result.assetUrl?.endsWith(".webp")) {
        throw new Error(result.message || "The image route did not return a WebP Block Visual Anchor.");
      }
      const now = new Date().toISOString();
      const artifact: FoundationsVisualArtifact = {
        id: globalThis.crypto.randomUUID(),
        assetUrl: result.assetUrl,
        prompt,
        createdAt: now,
        provider: result.provider || "configured image route",
        model: result.model || "",
        frameNumber: 1,
        narrativeIntention: `Block Visual Anchor · Block ${blockRef(blockNumber)}`,
        sourceDecisionKeys: [
          anchorRef,
          "outline-block-anchor-generation:v1",
          `outline-block-number:${blockNumber}`,
          `ppf-revision:${project.revision}`,
        ],
        workflow: BLOCK_WORKFLOW,
        reviewState: "draft",
        parentArtifactId: selectedArtifact?.id ?? null,
      };
      const next = applyStoryCommand(project, { type: "foundations.visual.store", artifact, occurredAt: now });
      commit(next, `Created a new Block Visual Anchor version for Block ${blockRef(blockNumber)}. Save and Lock remain separate decisions.`);
      setSelectedId(artifact.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Block Visual Anchor generation failed.");
    } finally {
      setBusy(false);
    }
  }

  function saveVersion() {
    if (!selectedArtifact || isSaved || busy) return;
    if (!selectedArtifact.assetUrl.startsWith("/api/local-ai/assets/")) {
      setMessage("Bundled Block references are already local project assets. Generate a local version to use explicit Save state.");
      return;
    }
    const now = new Date().toISOString();
    const artifact: FoundationsVisualArtifact = {
      ...selectedArtifact,
      sourceDecisionKeys: [...new Set([...(selectedArtifact.sourceDecisionKeys ?? []), LOCAL_SAVE_MARKER])],
    };
    const next = applyStoryCommand(project, { type: "foundations.visual.store", artifact, occurredAt: now });
    commit(next, `Saved this Block ${blockRef(blockNumber)} anchor version locally with the project.`);
  }

  function lockVersion() {
    if (!selected || isLocked || busy) return;
    const now = new Date().toISOString();
    let next: PPFProject = project;
    const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
    for (const artifact of project.build.foundations.visualArtifacts.filter((candidate) =>
      accepted.has(candidate.id) && (candidate.sourceDecisionKeys ?? []).includes(anchorRef))) {
      next = applyStoryCommand(next, { type: "foundations.visual.unaccept", artifactId: artifact.id, occurredAt: now });
    }

    let artifactId = selectedArtifact?.id ?? "";
    if (selected.kind === "legacy") {
      const candidate = selected.candidate;
      const artifact: FoundationsVisualArtifact = {
        id: globalThis.crypto.randomUUID(),
        assetUrl: candidate.images.full,
        prompt: candidate.source.prompt || "Bundled legacy Afterglow Block-cover reference.",
        createdAt: now,
        provider: "bundled Afterglow legacy visual",
        model: "",
        frameNumber: 1,
        narrativeIntention: `Block Visual Anchor · Block ${blockRef(blockNumber)} · ${candidate.title}`,
        sourceDecisionKeys: [
          anchorRef,
          `legacy-afterglow-visual:${candidate.id}`,
          `legacy-afterglow-source-sha:${candidate.source.originalSha}`,
          `outline-block-number:${blockNumber}`,
          `ppf-revision:${project.revision}`,
        ],
        workflow: REFERENCE_WORKFLOW,
        reviewState: "draft",
        parentArtifactId: null,
      };
      next = applyStoryCommand(next, { type: "foundations.visual.store", artifact, occurredAt: now });
      artifactId = artifact.id;
    }
    if (!artifactId) return;
    next = applyStoryCommand(next, { type: "foundations.visual.accept", artifactId, occurredAt: now });
    commit(next, `Locked Block ${blockRef(blockNumber)} to this Block Visual Anchor. Mini-Block anchors remain independent.`);
    setSelectedId(artifactId);
  }

  function deleteVersion() {
    if (!selectedArtifact || busy) return;
    const now = new Date().toISOString();
    const next = applyStoryCommand(project, { type: "foundations.visual.delete", artifactId: selectedArtifact.id, occurredAt: now });
    commit(next, `Deleted this Block ${blockRef(blockNumber)} anchor version.`);
    setPendingDeleteId(null);
    setSelectedId("");
  }

  return (
    <section className={styles.anchorWorkspace} aria-labelledby="outline-block-anchor-title" data-outline-block-anchor={anchorRef}>
      <header className={styles.header}>
        <div>
          <p>BLOCK VISUAL ANCHOR</p>
          <h2 id="outline-block-anchor-title">Block {blockRef(blockNumber)}</h2>
          <span>One representative image for the selected Block. Mini-Block visuals below are independent, and the 25-shot sequence remains in Storyboard.</span>
        </div>
        <strong>{anchorRef}</strong>
      </header>
      <div className={styles.anchorBody}>
        <div className={styles.preview}>
          <span className={styles.versionCount}>{versions.length ? `${selectedIndex + 1}/${versions.length}` : "0/0"}</span>
          {versions.length > 1 ? (
            <button aria-label="Previous Block anchor version" className={`${styles.chevron} ${styles.previous}`} disabled={selectedIndex <= 0} type="button" onClick={() => setSelectedId(versions[selectedIndex - 1].id)}>‹</button>
          ) : null}
          {selected ? <img alt={selected.label} decoding="async" loading="lazy" src={selected.assetUrl} /> : <span className={styles.empty}>No Block Visual Anchor yet</span>}
          {isSaved ? <span className={`${styles.badge} ${styles.savedBadge}`}>Saved locally</span> : null}
          {isLocked ? <span className={`${styles.badge} ${styles.lockedBadge}`}>Locked</span> : null}
          {versions.length > 1 ? (
            <button aria-label="Next Block anchor version" className={`${styles.chevron} ${styles.next}`} disabled={selectedIndex >= versions.length - 1} type="button" onClick={() => setSelectedId(versions[selectedIndex + 1].id)}>›</button>
          ) : null}
        </div>
        <div className={styles.controls}>
          <p>{selected?.label || `Block ${blockRef(blockNumber)} has no Block Visual Anchor yet.`}</p>
          <label>
            <input type="checkbox" checked={generationApproved} disabled={busy} onChange={(event) => setGenerationApproved(event.target.checked)} />
            I approve one image generation request through my configured provider.
          </label>
          <div className={styles.actions}>
            <button disabled={!generationApproved || busy} type="button" onClick={() => void createVersion()}>{busy ? "Creating…" : selected ? "Create new version" : "Generate Block Anchor"}</button>
            <button disabled={!selectedArtifact || isSaved || busy} type="button" onClick={saveVersion}>Save</button>
            <button disabled={!selected || isLocked || busy} type="button" onClick={lockVersion}>Lock</button>
            <button disabled={!selectedArtifact || busy} type="button" onClick={() => setPendingDeleteId(selectedArtifact?.id ?? null)}>Delete</button>
          </div>
          {pendingDeleteId && selectedArtifact?.id === pendingDeleteId ? (
            <div className={styles.deleteConfirm} role="alert">
              <span>Delete this Block anchor version forever? This cannot be undone.</span>
              <button type="button" onClick={deleteVersion}>Yes</button>
              <button type="button" onClick={() => setPendingDeleteId(null)}>No</button>
            </div>
          ) : null}
          <p className={styles.status} role="status">{message}</p>
        </div>
      </div>
    </section>
  );
}
