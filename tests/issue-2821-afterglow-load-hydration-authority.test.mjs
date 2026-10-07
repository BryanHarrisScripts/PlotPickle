import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyProject } from "../core/project/project.ts";
import { normalizeLibraryProject } from "../core/storage/library-project.ts";
import { restoreLocalStoryboardResources } from "../modules/library/local-resource-recovery.ts";

const ASSET_URL = "/api/local-ai/assets/storyboard-afterglow-origin-1-1-1-1760000000000-1760000001000.webp";
const CONTENT_HASH = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ANCHOR = "storyboard-anchor:block:block-01:mini-1";
const POSITION = "storyboard-position:1";
const SAVE = "storyboard-local-save:v1";

function artifact({
  id,
  prompt,
  saved = false,
  locked = false,
  recovered = false,
}) {
  return {
    id,
    assetUrl: ASSET_URL,
    prompt,
    createdAt: "2026-10-07T10:00:00.000Z",
    provider: "local recovery",
    model: "",
    frameNumber: 1,
    narrativeIntention: prompt,
    sourceDecisionKeys: [
      "storyboard-target:block:block-01",
      ANCHOR,
      POSITION,
      ...(recovered ? [
        "recovery-origin-project:afterglow-origin",
        `recovery-content-hash:${CONTENT_HASH}`,
      ] : []),
      ...(saved ? [SAVE] : []),
    ],
    workflow: "storyboard-frame-webp-v2",
    reviewState: locked ? "accepted" : "draft",
    parentArtifactId: null,
  };
}

function project({
  id,
  updatedAt,
  artifactValue = null,
  accepted = false,
}) {
  const base = createEmptyProject({ id, now: updatedAt, title: "Afterglow" });
  return normalizeLibraryProject({
    ...base,
    revision: 12,
    updatedAt,
    build: {
      ...base.build,
      foundations: {
        visualArtifacts: artifactValue ? [artifactValue] : [],
        acceptedVisualArtifactIds: artifactValue && accepted ? [artifactValue.id] : [],
      },
    },
  });
}

const resource = {
  kind: "storyboard-frame",
  fileName: "storyboard-afterglow-origin-1-1-1-1760000000000-1760000001000.webp",
  assetUrl: ASSET_URL,
  contentHash: CONTENT_HASH,
  modifiedAt: "2026-10-07T10:05:00.000Z",
  originProjectId: "afterglow-origin",
  blockNumber: 1,
  miniBlockNumber: 1,
  position: 1,
};

test("#2821 current saved+locked Afterglow artifact cannot be downgraded by an older origin snapshot", () => {
  const currentArtifact = artifact({
    id: "current-frame",
    prompt: "Current Human Storyboard prompt",
    saved: true,
    locked: true,
    recovered: true,
  });
  const staleOriginArtifact = artifact({
    id: "old-origin-frame",
    prompt: "Recovered local Storyboard resource. Original prompt metadata was unavailable in the loaded project.",
    saved: false,
    locked: true,
  });
  const current = project({
    id: "afterglow-current",
    updatedAt: "2026-10-07T11:00:00.000Z",
    artifactValue: currentArtifact,
    accepted: true,
  });
  const staleOrigin = project({
    id: "afterglow-origin",
    updatedAt: "2026-09-20T11:00:00.000Z",
    artifactValue: staleOriginArtifact,
    accepted: true,
  });

  const result = restoreLocalStoryboardResources(current, [resource], [staleOrigin]);
  const restored = result.project.build.foundations.visualArtifacts.find((item) => item.id === currentArtifact.id);

  assert.ok(restored);
  assert.equal(result.project.build.foundations.visualArtifacts.length, 1);
  assert.equal(restored.prompt, "Current Human Storyboard prompt");
  assert.equal(restored.sourceDecisionKeys.includes(SAVE), true);
  assert.equal(restored.reviewState, "accepted");
  assert.equal(result.project.build.foundations.acceptedVisualArtifactIds.includes(restored.id), true);
});

test("#2821 current Unlock remains authoritative over an older locked snapshot", () => {
  const currentArtifact = artifact({
    id: "current-unlocked-frame",
    prompt: "Current unlocked Storyboard prompt",
    saved: true,
    locked: false,
    recovered: true,
  });
  const staleLockedArtifact = artifact({
    id: "old-locked-frame",
    prompt: "Old locked prompt",
    saved: true,
    locked: true,
  });
  const current = project({
    id: "afterglow-current",
    updatedAt: "2026-10-07T11:10:00.000Z",
    artifactValue: currentArtifact,
    accepted: false,
  });
  const staleOrigin = project({
    id: "afterglow-origin",
    updatedAt: "2026-09-20T11:00:00.000Z",
    artifactValue: staleLockedArtifact,
    accepted: true,
  });

  const result = restoreLocalStoryboardResources(current, [resource], [staleOrigin]);
  const restored = result.project.build.foundations.visualArtifacts.find((item) => item.id === currentArtifact.id);

  assert.ok(restored);
  assert.equal(restored.reviewState, "draft");
  assert.equal(result.project.build.foundations.acceptedVisualArtifactIds.includes(restored.id), false);
  assert.equal(restored.sourceDecisionKeys.includes(SAVE), true);
});

test("#2821 when current artifact is missing, newest matching durable snapshot beats stale direct origin", () => {
  const staleOriginArtifact = artifact({
    id: "old-origin-frame",
    prompt: "Old origin prompt",
    saved: false,
    locked: true,
  });
  const newerWorkingArtifact = artifact({
    id: "newer-working-frame",
    prompt: "Newest saved Human prompt",
    saved: true,
    locked: false,
    recovered: true,
  });
  const emptyCurrent = project({
    id: "afterglow-current",
    updatedAt: "2026-10-07T11:20:00.000Z",
  });
  const staleOrigin = project({
    id: "afterglow-origin",
    updatedAt: "2026-09-20T11:00:00.000Z",
    artifactValue: staleOriginArtifact,
    accepted: true,
  });
  const newerWorking = project({
    id: "afterglow-working-copy",
    updatedAt: "2026-10-06T11:00:00.000Z",
    artifactValue: newerWorkingArtifact,
    accepted: false,
  });

  const result = restoreLocalStoryboardResources(emptyCurrent, [resource], [staleOrigin, newerWorking]);
  const restored = result.project.build.foundations.visualArtifacts.find((item) => item.assetUrl === ASSET_URL);

  assert.ok(restored);
  assert.equal(restored.prompt, "Newest saved Human prompt");
  assert.equal(restored.sourceDecisionKeys.includes(SAVE), true);
  assert.equal(restored.reviewState, "draft");
  assert.equal(result.project.build.foundations.acceptedVisualArtifactIds.includes(restored.id), false);
  assert.equal(result.restoredSavedCount, 1);
  assert.equal(result.restoredLockedCount, 0);
});
