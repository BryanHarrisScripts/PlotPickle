import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  WEBMCP_ACCEPTANCE_JOURNEYS,
  evaluateAcceptanceAssertions,
  normalizeWebMcpAcceptanceRequest,
} from "../core/sidecars/webmcp-acceptance-sidecar.mjs";

const request = {
  requestId: "dsdd:intent-2671:mind-map-world-map-shared-header",
  operation: "rendered-acceptance",
  target: "mind-map-world-map-shared-header",
  commitSha: "a".repeat(40),
};

test("#2671 accepts only bounded named rendered journeys", () => {
  assert.ok(WEBMCP_ACCEPTANCE_JOURNEYS["mind-map-world-map-shared-header"].postMergeCritical);
  assert.equal(normalizeWebMcpAcceptanceRequest(request).mode, "exact-head");
  assert.throws(() => normalizeWebMcpAcceptanceRequest({ ...request, target: "arbitrary-browser-command" }), /Unknown browser acceptance journey/);
  assert.throws(() => normalizeWebMcpAcceptanceRequest({ ...request, operation: "shell" }), /only accepts rendered-acceptance/);
});

test("#2671 rendered mismatch remains red even when other assertions pass", () => {
  const result = evaluateAcceptanceAssertions(request, [
    { id: "unit-source-green", status: "PASS", expected: "green", observed: "green" },
    { id: "rendered-header", status: "FAIL", expected: "shared", observed: "drifted" },
  ]);
  assert.equal(result.status, "FAIL");
  assert.equal(result.state, "failed");
  assert.equal(result.blockerCount, 1);
  assert.equal(result.rendered, true);
  assert.equal(result.deterministic, true);
});

test("#2671 post-merge replay uses the same critical named contract", () => {
  const result = evaluateAcceptanceAssertions({ ...request, mode: "post-merge" }, [
    { id: "critical-replay", status: "PASS", expected: "PASS", observed: "PASS" },
  ], ["artifact://post-merge"]);
  assert.equal(result.mode, "post-merge");
  assert.equal(result.status, "PASS");
  assert.deepEqual(result.evidenceRefs, ["artifact://post-merge"]);
});

test("#2671 Mind Map and World Map continue sourcing the canonical Learn topic spine", async () => {
  const mind = await readFile(new URL("../app/skin-v1/discovery-surface.tsx", import.meta.url), "utf8");
  const world = await readFile(new URL("../app/skin-v1/story-bible-surface.tsx", import.meta.url), "utf8");
  assert.match(mind, /LEARN_TOPIC_SPINE/);
  assert.match(world, /LEARN_TOPIC_SPINE/);
  assert.match(mind, /data-discovery-project=/);
  assert.match(world, /data-story-bible-project-id=/);
});
