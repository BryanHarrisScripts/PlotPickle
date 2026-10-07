"use client";

/* eslint-disable @next/next/no-img-element -- bundled Storyboard references are local PlotPickle assets. */

import { useEffect, useMemo, useRef, useState } from "react";
import type { PPFProject } from "@/core/project/project";
import type { FoundationsVisualArtifact } from "@/core/contracts/build-progress";
import { normalizeProjectSourceEvidence } from "@/core/contracts/imported-screenplay-evidence";
import { approvedWorldMapCharacterReferences } from "@/core/contracts/world-map";
import { applyStoryCommand } from "@/core/project/apply-command";
import { loadFoundationProject, saveFoundationProject } from "@/core/storage/foundation-project-browser";
import { getProfilePrivateSaveState, PROFILE_PRIVATE_SAVE_STATE_EVENT } from "@/core/storage/profile-private-browser";
import { saveFoundationProjectDurably } from "@/core/storage/project-library/revision-safe-browser";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import { hasQaWorkspaceAccess, isQaAccessOverride } from "@/core/progression/qa-access";
import { sequenceDirectorAnchorRef } from "@/core/contracts/sequence-director";
import { deriveVisualReadiness, type VisualReadinessTarget } from "@/modules/build/visual-readiness";
import { currentOutlineAssessment } from "@/modules/plan/outline-agent-assessment";
import { deriveOutlineReadiness } from "@/modules/plan/outline-readiness";
import type { PlotPickleProject } from "@/lib/projects/project";
import type { ProviderInstructionBundle } from "@/lib/preproduction/provider-instruction-compiler";
import { projectPreproductionSemantics } from "@/lib/preproduction/semantic-projection";
import { projectVisualStory } from "@/lib/preproduction/visual-story-projection";
import { approvedCharacterReferenceImages, getCharacterVisualIdentity, type CharacterWithVisualIdentity } from "@/lib/projects/visual/character-visual-identity";
import {
  storyboardFrameBriefs,
  storyboardFramePrompt,
  storyboardPositionsForScope,
  type StoryboardCharacterGrounding,
  type StoryboardFrameBrief,
  type StoryboardGenerationScope,
} from "./storyboard-editorial-model";
import StoryboardLockedShotHandoff from "../preproduction/storyboard-locked-shot-handoff";
import {
  storyboardAnchorEvidence,
  storyboardAnchorTargetRef,
  storyboardReferenceCandidates,
} from "./storyboard-editorial-model";
import styles from "./storyboard-readiness-workspace.module.css";

const STATE_LABELS = {
  defined: "DEFINED",
  observed: "OBSERVED",
  emerging: "EMERGING",
  missing: "MISSING",
  locked: "LOCKED",
} as const;

const RECOVERED_STORYBOARD_PROMPT_UNAVAILABLE = "Recovered local Storyboard resource. Original prompt metadata was unavailable in the loaded project.";
const STORYBOARD_LOCAL_SAVE_MARKER = "storyboard-local-save:v1";

function storyboardArtifactSavedLocally(artifact: FoundationsVisualArtifact) {
  return artifact.assetUrl.startsWith("/api/local-ai/assets/")
    && (artifact.sourceDecisionKeys ?? []).includes(STORYBOARD_LOCAL_SAVE_MARKER);
}

function exactStoryboardPrompt(prompt: string | undefined) {
  const value = prompt?.trim() ?? "";
  if (!value || value === RECOVERED_STORYBOARD_PROMPT_UNAVAILABLE || value.startsWith("Recovered local Storyboard resource.")) return "";
  return value;
}

function blockNumber(target: VisualReadinessTarget) {
  const match = target.id.match(/^block:block-(\d{2})$/);
  return match ? Number(match[1]) : 0;
}

function boundedBlockNumber(value: number | undefined) {
  return Number.isFinite(value) ? Math.min(24, Math.max(1, Math.trunc(value ?? 1))) : 1;
}

function boundedMiniBlockNumber(value: number | undefined) {
  return Number.isFinite(value) ? Math.min(4, Math.max(1, Math.trunc(value ?? 1))) : 1;
}

export default function StoryboardReadinessWorkspace({
  project,
  legacyProject,
  onProjectChange,
  onAddressChange,
  initialBlockNumber,
  initialMiniBlockNumber,
  embeddedNavigation = false,
}: {
  readonly project: LibraryPPFProject;
  readonly legacyProject: PlotPickleProject | null;
  readonly providerInstructions?: ProviderInstructionBundle | null;
  readonly onProjectChange: (project: PPFProject) => void;
  readonly onOpenBuild: (blockNumber: number, miniBlockNumber: number) => void;
  readonly onAddressChange?: (address: { blockNumber: number; miniBlockNumber: number }) => void;
  readonly initialBlockNumber?: number;
  readonly initialMiniBlockNumber?: number;
  readonly initialSceneId?: string;
  readonly initialShotId?: string;
  readonly initialVisualView?: "story" | "timeline";
  readonly embeddedNavigation?: boolean;
  readonly onOpenPrevis: (blockNumber: number, miniBlockNumber: number) => void;
}) {
  const readiness = deriveVisualReadiness({ project });
  const blocks = readiness.targets
    .filter((target) => target.kind === "block")
    .sort((left, right) => blockNumber(left) - blockNumber(right));
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(() => boundedBlockNumber(initialBlockNumber));
  const [selectedMiniBlockNumber, setSelectedMiniBlockNumber] = useState(() => boundedMiniBlockNumber(initialMiniBlockNumber));
  useEffect(() => {
    setSelectedBlockNumber(boundedBlockNumber(initialBlockNumber));
    setSelectedMiniBlockNumber(boundedMiniBlockNumber(initialMiniBlockNumber));
  }, [initialBlockNumber, initialMiniBlockNumber]);
  const [selectedImageByPosition, setSelectedImageByPosition] = useState<Readonly<Record<string, string>>>({});
  const [promptPosition, setPromptPosition] = useState<number | null>(null);
  const [framePrompt, setFramePrompt] = useState("");
  const [generationScope, setGenerationScope] = useState<StoryboardGenerationScope>("group5");
  const [frameConsent, setFrameConsent] = useState(false);
  const [frameBusy, setFrameBusy] = useState(false);
  const frameMutation = useRef(false);
  const [frameSaving, setFrameSaving] = useState(false);
  const [privateSaveState, setPrivateSaveState] = useState(getProfilePrivateSaveState);
  useEffect(() => {
    const refresh = () => setPrivateSaveState(getProfilePrivateSaveState());
    refresh();
    window.addEventListener(PROFILE_PRIVATE_SAVE_STATE_EVENT, refresh);
    return () => window.removeEventListener(PROFILE_PRIVATE_SAVE_STATE_EVENT, refresh);
  }, []);
  const [frameNotice, setFrameNotice] = useState("");
  const [pendingDeleteArtifactId, setPendingDeleteArtifactId] = useState<string | null>(null);
  const selectedTarget = blocks.find((target) => blockNumber(target) === selectedBlockNumber) ?? blocks[0] ?? null;
  const selectedNumber = selectedTarget ? blockNumber(selectedTarget) : 1;
  const activeAddressRef = useRef({ block: selectedNumber, mini: selectedMiniBlockNumber });
  activeAddressRef.current = { block: selectedNumber, mini: selectedMiniBlockNumber };
  const selectedStructureBlock = project.structure.blocks.find((block) => block.number === selectedNumber) ?? null;
  const selectedSequenceNumber = selectedStructureBlock?.sequenceNumber ?? Math.ceil(selectedNumber / 2);
  const selectedSequenceBlocks = project.structure.blocks
    .filter((block) => block.sequenceNumber === selectedSequenceNumber)
    .map((block) => block.number)
    .sort((left, right) => left - right);
  const selectedAct = Math.ceil(selectedNumber / 6);
  const actBlocks = blocks.filter((target) => Math.ceil(blockNumber(target) / 6) === selectedAct);
  const outline = deriveOutlineReadiness(project).find((item) => item.blockNumber === selectedNumber);
  const outlineAssessment = currentOutlineAssessment(project, selectedNumber);
  const storyboardAccessible = selectedTarget ? hasQaWorkspaceAccess(selectedTarget.storyboardAllowed) : false;
  const qaOnlyAccess = selectedTarget ? isQaAccessOverride(selectedTarget.storyboardAllowed) : false;
  const selectedReferences = useMemo(
    () => selectedTarget ? storyboardReferenceCandidates(project, selectedTarget.id) : [],
    [project, selectedTarget],
  );
  const semantics = useMemo(() => projectPreproductionSemantics(project, legacyProject), [project, legacyProject]);
  const selectedMiniId = project.structure.blocks.find((block) => block.number === selectedNumber)?.miniBlocks.find((mini) => mini.ordinal === selectedMiniBlockNumber)?.id;
  const sceneIds = semantics.miniBlockSceneRelations.find((relation) => relation.miniBlockId === selectedMiniId)?.sceneIds ?? [];
  const selectedScenes = semantics.scenes.filter((scene) => sceneIds.includes(scene.id));
  const blockMiniIds = new Set(project.structure.blocks.find((block) => block.number === selectedNumber)?.miniBlocks.map((mini) => mini.id) ?? []);
  const blockSceneIds = new Set(semantics.miniBlockSceneRelations.filter((relation) => blockMiniIds.has(relation.miniBlockId)).flatMap((relation) => relation.sceneIds));
  const blockScenes = semantics.scenes.filter((scene) => blockSceneIds.has(scene.id));
  const visualStory = projectVisualStory({ project, legacyProject, blockNumber: selectedNumber, miniBlockNumber: selectedMiniBlockNumber });
  const blockBeats = visualStory.anchors.flatMap((anchor) => anchor.beats.map((beat) => ({ ...beat, anchorRef: anchor.anchorRef })));
  const selectedVisualAnchor = visualStory.anchors.find((anchor) => anchor.anchorRef === sequenceDirectorAnchorRef(selectedNumber, selectedMiniBlockNumber));
  const visualArtifacts = [...project.build.foundations.visualArtifacts, ...project.build.world.visualArtifacts];
  const frameArtifacts = project.build.foundations.visualArtifacts.filter((artifact) =>
    artifact.workflow === "storyboard-frame-webp-v2"
    && (artifact.sourceDecisionKeys ?? []).includes(`storyboard-anchor:block:block-${String(selectedNumber).padStart(2, "0")}:mini-${selectedMiniBlockNumber}`),
  );

  async function saveFrameVersion(artifact: FoundationsVisualArtifact) {
    if (frameMutation.current || frameBusy) return;
    if (qaOnlyAccess) { setFrameNotice("This QA preview cannot save story decisions."); return; }
    frameMutation.current = true;
    setFrameSaving(true);
    setFrameNotice("Saving Storyboard Image…");
    try {
      const current = loadFoundationProject();
      if (current.id !== project.id) throw new Error("The active story changed before this Storyboard Image could be saved.");
      const currentArtifact = current.build.foundations.visualArtifacts.find((candidate) => candidate.id === artifact.id);
      if (!currentArtifact || currentArtifact.reviewState === "rejected") throw new Error("This Storyboard Image is no longer available to save.");
      if (!currentArtifact.assetUrl.startsWith("/api/local-ai/assets/")) throw new Error("Only PlotPickle local Storyboard images can be explicitly saved.");
      const savedArtifact: FoundationsVisualArtifact = {
        ...currentArtifact,
        sourceDecisionKeys: [...new Set([...(currentArtifact.sourceDecisionKeys ?? []), STORYBOARD_LOCAL_SAVE_MARKER])],
      };
      // Saving an existing local image does not require generation readiness.
      // Even an existing marker must receive a durable acknowledgement on retry.
      const next = storyboardArtifactSavedLocally(currentArtifact) ? current : applyStoryCommand(current, {
        type: "foundations.visual.store", artifact: savedArtifact, occurredAt: new Date().toISOString(),
      });
      const saved = await saveFoundationProjectDurably(next, current.revision);
      onProjectChange(saved);
      setSelectedImageByPosition((values) => ({ ...values,
        [`${selectedNumber}.${selectedMiniBlockNumber}.${savedArtifact.frameNumber ?? 0}`]: savedArtifact.id,
      }));
      setFrameNotice(`Shot ${String(savedArtifact.frameNumber ?? 0).padStart(2, "0")} of 25 saved locally with this story.`);
    } catch (error) {
      setFrameNotice(`Save failed: ${error instanceof Error ? error.message : "The story could not be persisted."} Retry Save to retain this image.`);
    } finally {
      frameMutation.current = false;
      setFrameSaving(false);
    }
  }

  async function reviewFrame(artifact: FoundationsVisualArtifact, decision: "accept" | "unaccept" | "delete") {
    if (frameMutation.current || frameBusy) return;
    if (qaOnlyAccess) { setFrameNotice("This QA preview cannot change story approval."); return; }
    frameMutation.current = true;
    setFrameSaving(true);
    setFrameNotice("Saving Storyboard decision…");
    try {
      const current = loadFoundationProject();
      if (current.id !== project.id) throw new Error("The active story changed before this decision could be saved.");
      const currentArtifact = current.build.foundations.visualArtifacts.find((candidate) => candidate.id === artifact.id);
      if (!currentArtifact) throw new Error("This Storyboard Image is no longer available.");
      const now = new Date().toISOString();
      let next: PPFProject = current;
      if (decision === "accept") {
        const scope = `storyboard-anchor:block:block-${String(selectedNumber).padStart(2, "0")}:mini-${selectedMiniBlockNumber}`;
        for (const previous of current.build.foundations.visualArtifacts.filter((candidate) =>
          candidate.id !== artifact.id && candidate.frameNumber === currentArtifact.frameNumber
          && (candidate.sourceDecisionKeys ?? []).includes(scope)
          && current.build.foundations.acceptedVisualArtifactIds.includes(candidate.id))) {
          next = applyStoryCommand(next, { type: "foundations.visual.unaccept", artifactId: previous.id, occurredAt: now });
        }
      }
      next = applyStoryCommand(next, {
        type: decision === "accept" ? "foundations.visual.accept" : decision === "unaccept" ? "foundations.visual.unaccept" : "foundations.visual.delete",
        artifactId: artifact.id, occurredAt: now,
      });
      const saved = await saveFoundationProjectDurably(next, current.revision);
      onProjectChange(saved);
      if (decision === "delete") {
        setSelectedImageByPosition((values) => ({ ...values, [`${selectedNumber}.${selectedMiniBlockNumber}.${artifact.frameNumber}`]: "" }));
        setPendingDeleteArtifactId(null);
      }
      setFrameNotice(`Shot ${String(artifact.frameNumber).padStart(2, "0")} of 25 ${decision === "accept" ? "kept and locked" : decision === "unaccept" ? "unlocked" : "deleted"}.`);
    } catch (error) {
      setFrameNotice(`Decision not confirmed: ${error instanceof Error ? error.message : "The story could not be persisted."} Retry to save this decision.`);
    } finally {
      frameMutation.current = false;
      setFrameSaving(false);
    }
  }

  const normalizedSourceEvidence = normalizeProjectSourceEvidence(project.sourceEvidence);
  const characterTruthEvidence = normalizedSourceEvidence.characterTruth;
  const legacyStoryboardCharacters: readonly StoryboardCharacterGrounding[] = (legacyProject?.characters ?? []).map((character) => {
    const visualCharacter = character as CharacterWithVisualIdentity;
    const identity = getCharacterVisualIdentity(visualCharacter);
    const legacyIdentityLocked = identity.status === "locked" && Boolean(identity.approvedPrompt.trim());
    const legacyApprovedRefs = legacyIdentityLocked
      ? approvedCharacterReferenceImages(visualCharacter).filter((reference) => reference.startsWith("/api/local-ai/assets/"))
      : [];
    const worldMapApprovedRefs = approvedWorldMapCharacterReferences(project.worldMap, character.id);
    const approvedVisualRefs = [...new Set([...worldMapApprovedRefs, ...legacyApprovedRefs])];
    const truthClaims = (characterTruthEvidence?.claims ?? [])
      .filter((claim) => claim.characterIds.includes(character.id)
        && claim.reviewState !== "rejected"
        && claim.handling === "writer-reference"
        && claim.kind !== "sensitive-source")
      .map((claim) => claim.summary)
      .slice(0, 4);
    const identityLock = legacyIdentityLocked ? {
      characterId: character.id,
      status: identity.status,
      version: identity.version,
      approvedPrompt: identity.approvedPrompt,
    } : worldMapApprovedRefs.length ? {
      characterId: character.id,
      status: "locked",
      version: 1,
      approvedPrompt: `World Map approved multi-view visual reference package for ${character.name}.`,
    } : null;
    return {
      id: character.id,
      name: character.name,
      aliases: character.id === "isobel" ? ["Summer"] : [],
      pronouns: character.pronouns,
      role: character.role,
      description: character.description,
      truthClaims,
      approvedVisualRefs,
      identityLock,
    };
  });
  const legacyCharacterIds = new Set(legacyStoryboardCharacters.map((character) => character.id));
  const libraryStoryboardCharacters: readonly StoryboardCharacterGrounding[] = (characterTruthEvidence?.principalCharacterIds ?? [])
    .filter((characterId) => !legacyCharacterIds.has(characterId))
    .map((characterId) => {
      const claims = (characterTruthEvidence?.claims ?? [])
        .filter((claim) => claim.characterIds.includes(characterId)
          && claim.reviewState !== "rejected"
          && claim.handling === "writer-reference"
          && claim.kind !== "sensitive-source");
      const identityClaim = claims.find((claim) => claim.kind === "identity");
      const name = identityClaim?.summary?.trim()
        || characterId.replace(/^character:/u, "").replace(/[-_]+/gu, " ").replace(/\b\w/gu, (letter) => letter.toUpperCase())
        || "Unknown Character";
      const approvedVisualRefs = approvedWorldMapCharacterReferences(project.worldMap, characterId);
      return {
        id: characterId,
        name,
        aliases: [],
        pronouns: "",
        role: "",
        description: claims.find((claim) => claim.kind === "personality")?.summary ?? "",
        truthClaims: claims.map((claim) => claim.summary).slice(0, 4),
        approvedVisualRefs,
        identityLock: approvedVisualRefs.length ? {
          characterId,
          status: "locked",
          version: 1,
          approvedPrompt: `World Map approved multi-view visual reference package for ${name}.`,
        } : null,
      };
    });
  const storyboardCharacters: readonly StoryboardCharacterGrounding[] = [
    ...legacyStoryboardCharacters,
    ...libraryStoryboardCharacters,
  ];
  const activeAnchorEvidence = selectedTarget
    ? storyboardAnchorEvidence(project, selectedTarget.id, selectedMiniBlockNumber)
    : null;
  const storyboardBriefs = storyboardFrameBriefs({
    positions: Array.from({ length: 25 }, (_, index) => index + 1),
    passages: activeAnchorEvidence?.passages ?? [],
    characters: storyboardCharacters,
  });

  function briefForPosition(position: number): StoryboardFrameBrief {
    return storyboardBriefs.find((brief) => brief.position === position) ?? storyboardFrameBriefs({
      positions: [position],
      passages: activeAnchorEvidence?.passages ?? [],
      characters: storyboardCharacters,
    })[0];
  }

  function generationPlanForPosition(position: number) {
    const brief = briefForPosition(position);
    const shot = selectedVisualAnchor?.shots.find((candidate) => candidate.order === position);
    const previousShot = selectedVisualAnchor?.shots.find((candidate) => candidate.order === position - 1);
    const nextShot = selectedVisualAnchor?.shots.find((candidate) => candidate.order === position + 1);
    const describeShot = (candidate: typeof shot) => candidate
      ? [candidate.narrativePurpose, candidate.visualIntent, candidate.shotSize, candidate.angle, candidate.movement].filter(Boolean).join("; ")
      : "";
    const prompt = storyboardFramePrompt({
      title: project.title,
      blockNumber: selectedNumber,
      miniBlockNumber: selectedMiniBlockNumber,
      position,
      scene: selectedScenes.map((scene) => [scene.title, scene.purpose].filter(Boolean).join(" — ")).join("; "),
      beat: selectedVisualAnchor?.beats.map((beat) => beat.visualAction || beat.purpose || beat.label).filter(Boolean).join("; ") ?? "",
      shot: describeShot(shot),
      previousShot: describeShot(previousShot),
      nextShot: describeShot(nextShot),
      source: brief.evidenceSummary,
      storyFunction: brief.storyFunction,
      visibleChange: brief.visibleChange,
      characterTruth: brief.characterTruth,
      identityMode: brief.identityMode,
      continuityIn: brief.continuityIn,
      continuityOut: brief.continuityOut,
    });
    return { brief, prompt };
  }

  function prepareFramePrompt(position: number) {
    setFramePrompt(generationPlanForPosition(position).prompt);
    setPromptPosition(position);
    setFrameConsent(false);
    setFrameNotice("");
  }

  async function generateFrame() {
    if (frameBusy || promptPosition === null || !frameConsent || !framePrompt.trim()) return;
    const blockNumberValue = selectedNumber;
    const mini = selectedMiniBlockNumber;
    const projectId = project.id;
    const positions = storyboardPositionsForScope(promptPosition, generationScope);
    const selectedPrompt = framePrompt.trim();
    let current = loadFoundationProject();
    if (current.id !== projectId) {
      setFrameNotice("The active story changed before generation began.");
      return;
    }

    let succeeded = 0;
    const failures: string[] = [];
    const selectedArtifacts: Record<string, string> = {};
    setFrameBusy(true);
    setFrameNotice("Preparing " + positions.length + " progression-aware Storyboard Image request" + (positions.length === 1 ? "" : "s") + "…");

    try {
      for (let index = 0; index < positions.length; index += 1) {
        const position = positions[index];
        if (activeAddressRef.current.block !== blockNumberValue || activeAddressRef.current.mini !== mini) {
          failures.push("Generation stopped because the active Storyboard address changed.");
          break;
        }

        const plan = generationPlanForPosition(position);
        const prompt = position === promptPosition ? selectedPrompt : plan.prompt;
        setFrameNotice("Creating Storyboard Image " + (index + 1) + " of " + positions.length + " · Shot " + String(position).padStart(2, "0") + " of 25…");
        try {
          const response = await fetch("/api/local-ai/generate/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt,
              assetId: "storyboard-" + projectId + "-" + blockNumberValue + "-" + mini + "-" + position + "-" + Date.now(),
              aspect: "landscape",
              quality: "low",
              outputFormat: "webp",
              approvedCharacterReferences: plan.brief.approvedVisualRefs,
              identityLocks: plan.brief.identityLocks,
              continuityMetadata: [plan.brief.continuityIn, plan.brief.continuityOut],
              requestCount: 1,
              billingAcknowledged: true,
            }),
          });
          const result = await response.json() as { ok?: boolean; assetUrl?: string; provider?: string; model?: string; message?: string };
          if (!response.ok || !result.ok || !result.assetUrl?.endsWith(".webp")) {
            throw new Error(result.message || "The image route did not return a WebP Storyboard Image.");
          }
          if (activeAddressRef.current.block !== blockNumberValue || activeAddressRef.current.mini !== mini) {
            throw new Error("The active story address changed while generating. The late image was not attached.");
          }

          const now = new Date().toISOString();
          const artifact: FoundationsVisualArtifact = {
            id: globalThis.crypto.randomUUID(),
            assetUrl: result.assetUrl,
            prompt,
            createdAt: now,
            provider: result.provider || "configured image route",
            model: result.model || "",
            frameNumber: position,
            narrativeIntention: "Storyboard Image candidate · Shot " + String(position).padStart(2, "0") + " of 25",
            sourceDecisionKeys: [
              "storyboard-target:block:block-" + String(blockNumberValue).padStart(2, "0"),
              "storyboard-anchor:block:block-" + String(blockNumberValue).padStart(2, "0") + ":mini-" + mini,
              "storyboard-position:" + position,
              ...plan.brief.characters.map((character) => "storyboard-character:" + character.id),
              "storyboard-identity-mode:" + plan.brief.identityMode,
              "ppf-revision:" + current.revision,
            ],
            workflow: "storyboard-frame-webp-v2",
            reviewState: "draft",
            parentArtifactId: null,
          };
          current = applyStoryCommand(current, { type: "foundations.visual.store", artifact, occurredAt: now });
          saveFoundationProject(current);
          selectedArtifacts[String(blockNumberValue) + "." + mini + "." + position] = artifact.id;
          succeeded += 1;
        } catch (error) {
          failures.push("Shot " + String(position).padStart(2, "0") + " of 25: " + (error instanceof Error ? error.message : "Storyboard Image generation failed."));
        }
      }

      if (succeeded > 0) {
        onProjectChange(current);
        setSelectedImageByPosition((values) => ({ ...values, ...selectedArtifacts }));
      }
      const successText = succeeded + " of " + positions.length + " Storyboard Image candidate" + (positions.length === 1 ? "" : "s") + " generated as local drafts for recovery. Use Save to mark the versions you want saved locally for review.";
      const failureText = failures.length ? " " + failures.join(" ") : " None were kept or made canon.";
      setFrameNotice(successText + failureText);
    } finally {
      setFrameBusy(false);
    }
  }

  function preserveStoryboardAddress(block: number, mini: number) {
    const url = new URL(window.location.href);
    url.searchParams.set("block", String(block));
    url.searchParams.set("mini", String(mini));
    window.history.replaceState(window.history.state, "", url);
  }

  function selectStoryboardAddress(block: number, mini: number) {
    setSelectedBlockNumber(block);
    setSelectedMiniBlockNumber(mini);
    preserveStoryboardAddress(block, mini);
    onAddressChange?.({ blockNumber: block, miniBlockNumber: mini });
  }

  const generationCount = promptPosition === null ? 1 : storyboardPositionsForScope(promptPosition, generationScope).length;
  const generationButtonLabel = frameBusy
    ? "Creating " + generationCount + " Storyboard Image" + (generationCount === 1 ? "…" : "s…")
    : generationCount === 1
      ? "Generate selected Storyboard Image"
      : generationCount === 5
        ? "Generate Storyboard Images for 5 Shots"
        : "Generate Storyboard Images for all 25 Shots";

  return (
    <main className={styles.workspace} aria-labelledby="storyboard-readiness-title">
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Act → Sequence → Block → Mini-Block → 25 planned Shots</span>
          <h1 id="storyboard-readiness-title">Storyboard · {project.title || "Untitled Story"}</h1>
          <p>
            Storyboard keeps Scene and Beat as variable-density story evidence, then expands the selected Mini-Block into exactly 25 planned Shots. Each planned Shot can have image candidates, and one locked Storyboard Image becomes its approved visual representation.
          </p>
        </div>
        <dl className={styles.summary}>
          <div><dt>Sequence</dt><dd>{String(selectedSequenceNumber).padStart(2, "0")} · Blocks {selectedSequenceBlocks.map((number) => String(number).padStart(2, "0")).join("–")}</dd></div>
          <div><dt>Mini-Block</dt><dd>{selectedNumber}.{selectedMiniBlockNumber} · 25 planned Shots · ≈75 sec</dd></div>
          <div><dt>Visual anchors</dt><dd>96</dd></div>
          <div><dt>Act {selectedAct} mapped Blocks</dt><dd>{actBlocks.filter((target) => target.storyboardAllowed).length} / 6</dd></div>
        </dl>
      </header>

      {!embeddedNavigation ? <nav aria-label="Storyboard Acts" className={styles.actRail} role="tablist">
        {[1, 2, 3, 4].map((act) => (
          <button aria-controls="storyboard-act-panel" aria-selected={selectedAct === act} className={styles.actTab} key={act} onClick={() => {
            const firstBlock = (act - 1) * 6 + 1;
            selectStoryboardAddress(firstBlock, 1);
          }} role="tab" type="button">Act {act}</button>
        ))}
      </nav> : null}

      {!embeddedNavigation ? <section id="storyboard-act-panel" aria-label={`Act ${selectedAct} Storyboard`} role="tabpanel">
        <nav aria-label="Storyboard Block tabs" className={styles.tabRail}>
          {actBlocks.map((target) => {
            const number = blockNumber(target);
            return <button aria-current={number === selectedNumber ? "true" : undefined} aria-label={`Act ${selectedAct} Block ${number - (selectedAct - 1) * 6}, ${STATE_LABELS[target.state]}`} className={styles.blockTab} data-state={target.state} key={target.id} onClick={() => {
              selectStoryboardAddress(number, 1);
            }} type="button"><i aria-hidden="true" className={styles.stateLight} /><span>Block {number - (selectedAct - 1) * 6}</span></button>;
          })}
        </nav>
      </section> : null}

      {selectedTarget ? (
        <section
          aria-label={`Block ${String(selectedNumber).padStart(2, "0")} Storyboard workspace`}
          className={styles.blockWorkspace}
          data-state={selectedTarget.state}
          id="storyboard-block-panel"
          role="tabpanel"
        >
          <header className={styles.blockHeader}>
            <div>
              <p className={styles.blockKicker}>Block {String(selectedNumber).padStart(2, "0")}</p>
              <h2>{selectedTarget.label.replace(/^Block \d+: /, "")}</h2>
              <p>{selectedTarget.storyboardAllowed
                ? "Screenplay placement allows visual exploration. Select a Mini-Block in the Storyboard map above; its Scene/Beat evidence and 25 planned Shots stay on this page."
                : qaOnlyAccess
                  ? `QA access is open for this Block. Canonical prerequisites remain unresolved: ${selectedTarget.missingPrerequisites.join(" · ") || "BUILD evidence is incomplete."}`
                  : selectedTarget.missingPrerequisites.join(" · ") || "This Block remains visible but is not ready for visual authoring."}</p>
            </div>
            <span aria-label={`Status: ${STATE_LABELS[selectedTarget.state]}`} className={styles.blockState} data-state={selectedTarget.state}>
              <i aria-hidden="true" className={styles.stateLight} />
              <strong>{STATE_LABELS[selectedTarget.state]}</strong>
            </span>
          </header>
          <details className={styles.outlineHandoff} aria-label={`Block ${selectedNumber} Outline to Storyboard handoff`} data-outline-handoff={outline?.status ?? "review"}>
            <summary>Outline handoff · {outline?.status === "needs-support" ? "Needs support" : outline?.status === "review" ? "Review" : "Evidence ready"}</summary>
            <p>{outlineAssessment ? `${outlineAssessment.structural.state.replaceAll("-", " / ")}: ${outlineAssessment.structural.reason}` : "Story Architect has not assessed this Block against the screenplay. Observed passage placement is not a structural finding."}</p>
            {outline?.issues.length ? <ul>{outline.issues.slice(0, 4).map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
            <a href={`/?workspace=dashboard&block=${selectedNumber}&mini=${selectedMiniBlockNumber}`}>Back to Dashboard · open Outline at this Block</a>
          </details>

          <div className={styles.miniBlockGrid} aria-label={`Block ${selectedNumber} Mini-Block visual anchors`}>
            {[1, 2, 3, 4].map((miniNumber) => {
              const reference = selectedReferences.find((candidate) => candidate.miniBlockNumber === miniNumber);
              const anchorEvidence = storyboardAnchorEvidence(project, selectedTarget.id, miniNumber);
              return (
                <article
                  className={styles.miniBlock}
                  data-authorable={storyboardAccessible ? "true" : "false"}
                  data-selected={selectedMiniBlockNumber === miniNumber ? "true" : undefined}
                  data-story-decision-target={storyboardAnchorTargetRef(selectedTarget.id, miniNumber)}
                  key={miniNumber}
                  onClick={() => selectStoryboardAddress(selectedNumber, miniNumber)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectStoryboardAddress(selectedNumber, miniNumber);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.miniPreview}>
                    {reference
                      ? <img alt={reference.caption} decoding="async" loading="lazy" src={reference.assetUrl} />
                      : <span aria-hidden="true" className={styles.emptyFrame}>+</span>}
                  </div>
                  <header>
                    <div>
                      <span>Mini-Block anchor</span>
                      <strong>{selectedNumber}.{miniNumber}</strong>
                    </div>
                    <i aria-label={`Status: ${STATE_LABELS[selectedTarget.state]}`} className={styles.stateLight} data-state={selectedTarget.state} />
                  </header>
                  <p>{reference?.caption || (selectedTarget.storyboardAllowed
                    ? "Visual anchor is ready, but no candidate has been attached yet."
                    : qaOnlyAccess
                      ? "QA access is open. A real visual candidate is still required before this anchor can be reviewed."
                      : "Visual anchor reserved. BUILD evidence must mature before authoring begins.")}</p>
                  {outlineAssessment?.miniBlocks[miniNumber - 1] ? <p className={styles.outlineCue}>Outline cue · {outlineAssessment.miniBlocks[miniNumber - 1].storyboardCue || outlineAssessment.miniBlocks[miniNumber - 1].reason}</p> : null}
                  <small className={styles.anchorEvidence}>
                    {anchorEvidence.passages.length} screenplay passage{anchorEvidence.passages.length === 1 ? "" : "s"} · {reference
                      ? reference.acceptedArtifactId
                        ? "kept visual"
                        : reference.sourceKind === "historical-storyboard"
                          ? "historical reference candidate"
                          : "replacement concept candidate"
                      : "no visual candidate"}
                  </small>
                </article>
              );
            })}
          </div>

          <section className={styles.visualBreakdown} data-storyboard-scene-beat-detail="inline" aria-label={`Block ${selectedNumber} Mini-Block ${selectedMiniBlockNumber} Scene and Beat visuals`}>
            <header>
              <div>
                <span className={styles.eyebrow}>Scene / Beat evidence → 25 planned Shots → Storyboard Images</span>
                <h3>Mini-Block {selectedNumber}.{selectedMiniBlockNumber} · Scenes &amp; Beats</h3>
                <p>{selectedScenes.length} mapped Scene{selectedScenes.length === 1 ? "" : "s"} at this anchor. The Storyboard navigation remains visible above while you work.</p>
                <p data-storyboard-mathematics="25-shots">Mini-Block {selectedNumber}.{selectedMiniBlockNumber} · 75-second planning target · 25 planned Shots · ~3 seconds per Shot · ~1,800 final video frames at 24 fps</p>
              </div>
              <small>25 planned Shots · approximately 3 seconds per Shot</small>
            </header>
            <div className={styles.sceneList}>
              {blockScenes.length ? blockScenes.map((scene) => <article key={scene.id} data-storyboard-scene-id={scene.id}><strong>{scene.title}</strong><small>Scene spans {scene.relatedMiniBlockIds.length} Mini-Block{scene.relatedMiniBlockIds.length === 1 ? "" : "s"}</small><p>{scene.purpose || "Scene mapped from screenplay; visual Beat planning remains open."}</p></article>) : <p>No Scene is mapped to this Block yet. The 25 planned Shots remain available without inventing a Scene.</p>}
            </div>
            <div className={styles.beatList}><strong>Authored Beats</strong>{blockBeats.length ? blockBeats.map((beat) => <p key={`${beat.anchorRef}-${beat.id}`}>{beat.anchorRef} · {String(beat.order).padStart(2, "0")} · {beat.label || beat.visualAction || beat.purpose}</p>) : <p>No authored Beat is mapped to this Block yet. Scene passages are evidence, not automatically named Beats.</p>}</div>
            <div className={styles.visualSequence}>
              <strong>25 Planned Shots</strong>
              <p>Scene and Beat remain variable-density story evidence. They may map across one or several planned Shots, but they never change the fixed Shot 01–25 count. Each planned Shot may hold multiple image candidates, while one locked Storyboard Image is the approved visual representation for that Shot.</p>
              <div className={styles.positionList} aria-label="25 planned Storyboard Shots">
                {Array.from({ length: 25 }, (_, index) => {
                  const position = index + 1;
                  const shot = selectedVisualAnchor?.shots.find((candidate) => candidate.order === position) ?? null;
                  const selectionKey = `${selectedNumber}.${selectedMiniBlockNumber}.${position}`;
                  const positionArtifacts = frameArtifacts.filter((artifact) => artifact.frameNumber === position && artifact.reviewState !== "rejected");
                  const generatedPositionImages = positionArtifacts.map((artifact) => ({
                    id: artifact.id,
                    assetUrl: artifact.assetUrl,
                    label: artifact.narrativeIntention || "Generated Storyboard Image candidate",
                    prompt: exactStoryboardPrompt(artifact.prompt),
                  }));
                  const linkedPositionImages = (shot?.frames ?? []).flatMap((frame) => {
                    const artifact = visualArtifacts.find((candidate) => candidate.id === frame.id);
                    if (artifact?.reviewState === "rejected") return [];
                    return [{
                      id: frame.id,
                      assetUrl: frame.assetUrl,
                      label: `${frame.accepted ? "Kept" : "Candidate"} · ${frame.narrativePurpose || frame.id}`,
                      prompt: artifact?.workflow === "storyboard-frame-webp-v2" ? exactStoryboardPrompt(artifact.prompt) : "",
                    }];
                  });
                  const positionImages = [...generatedPositionImages, ...linkedPositionImages]
                    .filter((image, imageIndex, all) => all.findIndex((candidate) => candidate.assetUrl === image.assetUrl) === imageIndex);
                  const latestGeneratedArtifact = [...positionArtifacts].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
                  const acceptedPositionArtifact = [...positionArtifacts]
                    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
                    .find((artifact) => artifact.reviewState === "accepted"
                      || project.build.foundations.acceptedVisualArtifactIds.includes(artifact.id)) ?? null;
                  const requestedImageId = selectedImageByPosition[selectionKey] ?? "";
                  const fallbackImageId = acceptedPositionArtifact?.id ?? latestGeneratedArtifact?.id ?? shot?.frames[0]?.id ?? positionImages[0]?.id ?? "";
                  const selectedImageId = positionImages.some((image) => image.id === requestedImageId) ? requestedImageId : fallbackImageId;
                  const selectedImage = positionImages.find((image) => image.id === selectedImageId) ?? null;
                  const selectedImageIndex = positionImages.findIndex((image) => image.id === selectedImageId);
                  const selectedArtifact = positionArtifacts.find((artifact) => artifact.id === selectedImageId) ?? null;
                  const accepted = Boolean(selectedArtifact && project.build.foundations.acceptedVisualArtifactIds.includes(selectedArtifact.id));
                  const savedLocally = Boolean(selectedArtifact && storyboardArtifactSavedLocally(selectedArtifact) && privateSaveState.state === "saved");
                  const reviewState = accepted ? "locked" : savedLocally ? "saved" : selectedArtifact ? "review" : selectedImage ? "reference" : "empty";
                  const reviewLabel = accepted
                    ? savedLocally ? "Locked · Saved locally" : "Locked · Save confirmation pending"
                    : savedLocally ? "Saved locally"
                      : selectedArtifact ? "Ready to save"
                        : selectedImage ? "Reference Storyboard Image" : "No Storyboard Image";
                  const frameVersionLabel = positionImages.length > 0 && selectedImageIndex >= 0
                    ? `${selectedImageIndex + 1}/${positionImages.length}`
                    : "0/0";
                  const shotLabel = shot
                    ? [`Shot ${String(shot.order).padStart(2, "0")}`, shot.shotSize || shot.angle, shot.narrativePurpose || shot.visualIntent].filter(Boolean).join(" · ")
                    : "Planned Shot · camera intent open";
                  return (
                    <div className={styles.positionRow} data-storyboard-position={position} key={position}>
                      <div className={styles.positionIdentity}>
                        <strong>Shot {String(position).padStart(2, "0")} of 25</strong>
                        <span>{shotLabel}</span>
                      </div>
                      <div className={styles.positionImage}>
                        <span
                          aria-label={`${frameVersionLabel} Storyboard Image versions for Shot ${String(position).padStart(2, "0")}`}
                          className={styles.frameVersionCount}
                        >{frameVersionLabel}</span>
                        {positionImages.length > 1 ? <button
                          aria-label={`Previous Storyboard Image for Shot ${String(position).padStart(2, "0")}`}
                          className={`${styles.frameChevron} ${styles.frameChevronPrevious}`}
                          disabled={selectedImageIndex <= 0}
                          type="button"
                          onClick={() => {
                            if (selectedImageIndex <= 0) return;
                            setSelectedImageByPosition((current) => ({ ...current, [selectionKey]: positionImages[selectedImageIndex - 1].id }));
                          }}
                        >‹</button> : null}
                        {selectedImage
                          ? <img alt={selectedImage.label} decoding="async" loading="lazy" src={selectedImage.assetUrl} />
                          : <span>No Storyboard Image selected</span>}
                        {savedLocally ? <span className={`${styles.frameStateBadge} ${styles.frameSavedBadge}`}>Saved locally</span> : null}
                        {accepted ? <span className={`${styles.frameStateBadge} ${styles.frameLockedBadge}`}>Locked</span> : null}
                        {positionImages.length > 1 ? <button
                          aria-label={`Next Storyboard Image for Shot ${String(position).padStart(2, "0")}`}
                          className={`${styles.frameChevron} ${styles.frameChevronNext}`}
                          disabled={selectedImageIndex < 0 || selectedImageIndex >= positionImages.length - 1}
                          type="button"
                          onClick={() => {
                            if (selectedImageIndex < 0 || selectedImageIndex >= positionImages.length - 1) return;
                            setSelectedImageByPosition((current) => ({ ...current, [selectionKey]: positionImages[selectedImageIndex + 1].id }));
                          }}
                        >›</button> : null}
                      </div>
                      <div className={styles.frameReview} aria-label={`Review Storyboard Image for Shot ${position}`} data-review-state={reviewState}>
                        <span>{reviewLabel}</span>
                        <button
                          disabled={!selectedArtifact || qaOnlyAccess || frameBusy || frameSaving}
                          type="button"
                          onClick={() => selectedArtifact && void saveFrameVersion(selectedArtifact)}
                        >{frameSaving ? "Saving…" : "Save"}</button>
                        <button
                          aria-pressed={accepted}
                          disabled={!selectedArtifact || qaOnlyAccess || frameBusy || frameSaving}
                          type="button"
                          onClick={() => selectedArtifact && void reviewFrame(selectedArtifact, accepted ? "unaccept" : "accept")}
                        >{accepted ? "Unlock" : "Lock"}</button>
                        <button
                          disabled={!selectedImage || frameBusy}
                          type="button"
                          onClick={() => { prepareFramePrompt(position); setGenerationScope("single"); }}
                        >Redo</button>
                        <button
                          disabled={!selectedArtifact || qaOnlyAccess || frameBusy || frameSaving}
                          type="button"
                          onClick={() => selectedArtifact && setPendingDeleteArtifactId(selectedArtifact.id)}
                        >Delete</button>
                        {selectedArtifact && pendingDeleteArtifactId === selectedArtifact.id ? (
                          <>
                            <span role="alert">Delete this version forever? This cannot be undone.</span>
                            <button type="button" disabled={frameSaving} onClick={() => void reviewFrame(selectedArtifact, "delete")}>Yes</button>
                            <button type="button" onClick={() => setPendingDeleteArtifactId(null)}>No</button>
                          </>
                        ) : null}
                      </div>
                      {selectedImage ? <div className={styles.framePromptProvenance}>
                        <strong>Storyboard Image Prompt</strong>
                        <p>{selectedImage.prompt || "Original Storyboard Image prompt unavailable for this image."}</p>
                      </div> : null}
                      {!selectedImage ? <button className={styles.framePromptButton} type="button" onClick={() => prepareFramePrompt(position)}>Create Storyboard Image prompt</button> : null}
                    </div>
                  );
                })}
              </div>
              {frameNotice ? <p className={styles.frameNotice} role="status">{frameNotice}</p> : null}
              {promptPosition !== null ? (
                <section className={styles.framePromptPanel} aria-label={`Storyboard Image prompt for Shot ${promptPosition}`}>
                  <h4>Shot {String(promptPosition).padStart(2, "0")} of 25 · Storyboard Image candidate</h4>
                  <p>Prepared from mapped story evidence. Edit the visual direction before generating; no story content changes until you keep a candidate.</p>
                  <textarea aria-label="Editable Storyboard Image prompt" rows={6} value={framePrompt} onChange={(event) => setFramePrompt(event.target.value)} />
                  <fieldset className={styles.generationScope}>
                    <legend>Generation scope</legend>
                    <label><input type="radio" name="storyboard-generation-scope" checked={generationScope === "single"} onChange={() => setGenerationScope("single")} /> Selected Shot</label>
                    <label><input type="radio" name="storyboard-generation-scope" checked={generationScope === "group5"} onChange={() => setGenerationScope("group5")} /> Current group of 5 Shots</label>
                    <label><input type="radio" name="storyboard-generation-scope" checked={generationScope === "all25"} onChange={() => setGenerationScope("all25")} /> All 25 Shots</label>
                  </fieldset>
                  <p className={styles.generationHint}>Each planned Shot receives its own story-progressing Storyboard Image brief. The selected prompt above is editable; batch neighbors are rebuilt from their own evidence slices.</p>
                  <label><input type="checkbox" checked={frameConsent} onChange={(event) => setFrameConsent(event.target.checked)} /> I approve this image generation request through my configured provider; cloud routes may charge my account.</label>
                  <button type="button" disabled={!frameConsent || !framePrompt.trim() || frameBusy} onClick={() => void generateFrame()}>{generationButtonLabel}</button>
                  <p role="status">{frameNotice}</p>
                </section>
              ) : null}
            </div>

            <StoryboardLockedShotHandoff
              blockNumber={selectedNumber}
              legacyProject={legacyProject}
              miniBlockNumber={selectedMiniBlockNumber}
              onProjectChange={onProjectChange}
              project={project}
              targetId={selectedTarget.id}
            />
          </section>
        </section>
      ) : null}

      <footer className={styles.footer}>
        Four Acts contain twelve Sequences, twenty-four Blocks and ninety-six Mini-Blocks. Scene and Beat remain variable-density story evidence. Storyboard owns exactly 25 planned Shots per Mini-Block and the Storyboard Image candidates for each Shot; approximately 3 seconds per Shot is a planning target, not a hard runtime guarantee.
      </footer>
    </main>
  );
}
