"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicConnectionStatus } from "@/lib/connection-status";
import type { PlotPickleProject } from "@/lib/project";
import {
  approvedCharacterReferenceImages,
  buildCharacterIdentityPrompt,
  getCharacterVisualIdentity,
  saveVisualIdentityDraft,
  type CharacterVisualIdentity,
  type CharacterVisualReference,
  type CharacterWithVisualIdentity,
} from "@/lib/character-visual-identity";

type CastQueueState = "pending" | "working" | "completed" | "failed" | "skipped";

type CastQueueItem = {
  id: string;
  characterId: string;
  label: string;
  state: CastQueueState;
  error: string;
};

type ImageResponse = { assetUrl?: string; revisedPrompt?: string; message?: string };

function buildItems(project: PlotPickleProject): CastQueueItem[] {
  return project.characters
    .filter((character) => character.name.trim())
    .map((character) => ({
      id: `cast-${character.id}`,
      characterId: character.id,
      label: character.name,
      state: "pending" as const,
      error: "",
    }));
}

function proposedIdentity(
  character: CharacterWithVisualIdentity,
  identity: CharacterVisualIdentity,
  reference: CharacterVisualReference,
  prompt: string,
) {
  const proposed = {
    ...identity,
    draftPrompt: prompt,
    references: [...identity.references.filter((item) => item.angle !== "master"), reference],
  } satisfies CharacterVisualIdentity;
  return saveVisualIdentityDraft(character, proposed, "Regenerated as part of the entire recurring cast");
}

export function useCastIdentityQueue({
  project,
  aiStatus,
  onProjectChange,
}: {
  project: PlotPickleProject;
  aiStatus: PublicConnectionStatus;
  onProjectChange: (project: PlotPickleProject) => void;
}) {
  const [items, setItems] = useState<CastQueueItem[]>(() => buildItems(project));
  const [working, setWorking] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [message, setMessage] = useState("");
  const stopRequested = useRef(false);
  const latestProject = useRef(project);
  latestProject.current = project;

  useEffect(() => {
    setItems(buildItems(latestProject.current));
    setAcknowledged(false);
  }, [project.id, project.characters.length]);

  const identities = useMemo(
    () => project.characters.map((character) => getCharacterVisualIdentity(character as CharacterWithVisualIdentity)),
    [project.characters],
  );
  const counts = useMemo(() => ({
    total: project.characters.filter((character) => character.name.trim()).length,
    locked: identities.filter((identity) => identity.status === "locked").length,
    pendingReview: identities.filter((identity) => Boolean(identity.pendingRevision)).length,
    completed: items.filter((item) => item.state === "completed").length,
    failed: items.filter((item) => item.state === "failed").length,
    skipped: items.filter((item) => item.state === "skipped").length,
    remaining: items.filter((item) => item.state === "pending" || item.state === "failed").length,
  }), [identities, items, project.characters]);
  const aiReady = aiStatus.state === "connected";

  function updateItem(id: string, patch: Partial<CastQueueItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function refresh() {
    if (working) return;
    const plan = buildItems(project);
    setItems(plan);
    setAcknowledged(false);
    setMessage(`Cast plan refreshed for ${plan.length} named characters. No provider calls were made.`);
  }

  function stop() {
    stopRequested.current = true;
    setMessage("Stopping after the active character request finishes. No new request will start.");
  }

  function skip(id: string) {
    if (working) return;
    updateItem(id, { state: "skipped", error: "" });
  }

  async function start() {
    if (working || !aiReady || !acknowledged || !items.length) return;
    const remaining = items.filter((item) => item.state === "pending" || item.state === "failed");
    if (!remaining.length) {
      setMessage("The entire cast regeneration plan is complete.");
      return;
    }
    const confirmed = window.confirm(
      `Regenerate visual identities for ${remaining.length} characters? This can make up to ${remaining.length} paid image API calls. Existing approved identities remain active until replacements are reviewed and approved.`,
    );
    if (!confirmed) {
      setMessage("Entire-cast regeneration was cancelled. No provider calls were made.");
      return;
    }

    stopRequested.current = false;
    setWorking(true);
    setMessage(`Regenerating ${remaining.length} character identities one at a time…`);
    let workingProject = project;

    for (const queueItem of remaining) {
      if (stopRequested.current) break;
      updateItem(queueItem.id, { state: "working", error: "" });
      const character = workingProject.characters.find((item) => item.id === queueItem.characterId) as CharacterWithVisualIdentity | undefined;
      if (!character) {
        updateItem(queueItem.id, { state: "failed", error: "Character record is no longer available." });
        continue;
      }
      try {
        const identity = getCharacterVisualIdentity(character);
        const identityPrompt = buildCharacterIdentityPrompt(
          { ...character, visualIdentity: identity },
          workingProject.world.visualLanguage,
          workingProject.world.period,
        );
        const prompt = [
          identityPrompt,
          "Master three-quarter portrait reference.",
          identity.negativePrompt && `Identity exclusions: ${identity.negativePrompt}`,
          "Single character only, neutral background, production-reference lighting, no text, no border.",
        ].filter(Boolean).join(" ");
        const response = await fetch("/api/local-ai/generate/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            characterId: character.id,
            assetId: `character-${character.id}-cast-v${identity.version + 1}`,
            aspect: "portrait",
            referenceImages: approvedCharacterReferenceImages(character),
            identityLock: {
              characterId: character.id,
              version: identity.version,
              status: identity.status,
              approvedPrompt: identity.approvedPrompt,
            },
          }),
        });
        const result = await response.json() as ImageResponse;
        if (!response.ok || !result.assetUrl) throw new Error(result.message || "The image provider returned no image.");
        const createdAt = new Date().toISOString();
        const reference: CharacterVisualReference = {
          id: `character-${character.id}-cast-${Date.now()}`,
          angle: "master",
          src: result.assetUrl,
          prompt: result.revisedPrompt || prompt,
          approved: false,
          createdAt,
        };
        const nextIdentity = proposedIdentity(character, identity, reference, result.revisedPrompt || identityPrompt);
        workingProject = {
          ...workingProject,
          characters: workingProject.characters.map((item) => item.id === character.id
            ? {
                ...item,
                visualIdentity: nextIdentity,
                image: identity.status === "locked" ? item.image : result.assetUrl,
              }
            : item),
          metadata: { ...workingProject.metadata, updatedAt: createdAt },
        };
        onProjectChange(workingProject);
        updateItem(queueItem.id, { state: "completed", error: "" });
      } catch (error) {
        updateItem(queueItem.id, {
          state: "failed",
          error: error instanceof Error ? error.message : "Character identity generation failed.",
        });
      }
    }

    setWorking(false);
    if (stopRequested.current) {
      setMessage("Entire-cast regeneration stopped. Completed replacements remain reviewable and existing approved identities remain active.");
    } else {
      setMessage("Entire-cast regeneration finished. Review and approve each replacement before it becomes the locked identity.");
    }
  }

  return {
    items,
    counts,
    aiReady,
    working,
    acknowledged,
    message,
    setAcknowledged,
    refresh,
    start,
    stop,
    skip,
  };
}
