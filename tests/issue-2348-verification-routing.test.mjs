import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assessProductProof, resolveProofRoute, validateProofRouting } from "../lib/verification/development/proof-routing.mjs";

const contract = JSON.parse(await readFile(new URL("../config/development-verification-routing.json", import.meta.url), "utf8"));
const plan = (files, classes = []) => resolveProofRoute({ changedFiles: files, classes, contract, ownershipPlan: { status: "ready" } });

test("#2348 documented policy is valid and documentation remains lightweight", () => {
  assert.deepEqual(validateProofRouting(contract), []);
  const route = plan(["docs/architecture/change.md"]);
  assert.deepEqual(route.classes, ["documentation"]);
  assert.equal(route.productProofStatus, "NOT_REQUIRED");
});

test("#2348 device and visual changes combine their real-product obligations", () => {
  const route = plan(["app/_components/voice-input-control.tsx", "build/voice/local-dictation.ts"] , ["device-input"]);
  assert.ok(route.classes.includes("application-logic"));
  assert.ok(route.classes.includes("ui-visual"));
  assert.deepEqual(route.productProofs.sort(), ["device-input", "visual-observation"].sort());
  assert.equal(route.productProofStatus, "UNPROVEN");
  assert.equal(assessProductProof({ route, evidence: [], testedCommit: "a".repeat(40) }).status, "UNPROVEN");
});

test("#2348 a build cannot claim image or video product proof", () => {
  const route = plan(["build/ai/generate-image.ts", "app/video-export.tsx"]);
  assert.ok(route.productProofs.includes("generated-image"));
  assert.ok(route.productProofs.includes("playable-video"));
  const commit = "b".repeat(40);
  const buildEvidence = [{ proofId: "production-build", finding: "supports", testedCommit: commit, artifactRef: "build.log" }];
  assert.equal(assessProductProof({ route, evidence: buildEvidence, testedCommit: commit }).status, "UNPROVEN");
});

test("#2348 only observed exact-head evidence can satisfy required product proofs", () => {
  const route = plan(["app/video-export.tsx"]);
  const commit = "c".repeat(40);
  const evidence = route.productProofs.map((proofId) => ({ proofId, finding: "supports", testedCommit: commit,
    action: "Export and play a video", observed: "The exported file played", artifactRef: "artifacts/video.mp4" }));
  assert.equal(assessProductProof({ route, evidence, testedCommit: "d".repeat(40) }).status, "UNPROVEN");
  assert.equal(assessProductProof({ route, evidence, testedCommit: commit }).status, "UNPROVEN");
  assert.equal(assessProductProof({ route, evidence, testedCommit: commit, verifiedArtifactRefs: ["artifacts/video.mp4"] }).status, "PASS");
  assert.equal(assessProductProof({ route, evidence: [...evidence, { proofId: "playable-video", finding: "contradicts", testedCommit: commit,
    action: "Export video", observed: "File did not play", artifactRef: "artifacts/player-error.txt" }], testedCommit: commit,
    verifiedArtifactRefs: ["artifacts/video.mp4", "artifacts/player-error.txt"] }).status, "FAIL");
});
