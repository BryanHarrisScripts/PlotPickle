import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadSkinV1SurfaceContracts } from "../lib/verification/skin-v1/surface-contracts.mjs";
import { analyzeRenderedSurfaceContract } from "../lib/verification/skin-v1/rendered-surface-profile.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2306 projects one 2% governed visual geometry tolerance from Surface Grammar", async () => {
  const grammar = JSON.parse(await read("config/skin-v1-surface-grammar.json"));
  assert.equal(grammar.rules.geometry.relativeToleranceRatio, 0.02);
  assert.equal(grammar.rules.geometry.relativeTolerancePercent, 2);

  const { contracts } = await loadSkinV1SurfaceContracts();
  assert.ok(contracts.length >= 30);
  for (const contract of contracts) {
    assert.equal(contract.expected.measurement.relativeToleranceRatio, 0.02, contract.surfaceId);
  }
});

test("#2306 accepts geometry at 2% and reports geometry beyond 2%", async () => {
  const { contracts } = await loadSkinV1SurfaceContracts();
  const base = structuredClone(contracts.find((contract) => contract.surfaceId === "dashboard"));
  assert.ok(base);
  base.expected.measurement.enforcementMode = "blocking";
  base.expected.menu.expectedVisibleLabels = [];
  base.expected.typography.canonicalFamily = "";
  base.expected.typography.semanticRoles = {};
  base.expected.layout.workspaceColumnCount = null;

  const profile = (gutterDelta) => ({
    surface: "DASHBOARD",
    geometry: {
      pageHorizontalOverflowPx: 0,
      root: { width: 1000, height: 1000 },
      gutters: { left: 100, right: 100 + gutterDelta },
      edgeViolations: [],
      overlaps: [],
      grids: [],
      menus: [],
    },
    items: [],
  });

  const atBoundary = analyzeRenderedSurfaceContract(base, profile(20));
  assert.equal(atBoundary.some((finding) => finding.category === "gutter-asymmetry"), false);

  const beyondBoundary = analyzeRenderedSurfaceContract(base, profile(21));
  assert.equal(beyondBoundary.some((finding) => finding.category === "gutter-asymmetry"), true);
});

test("#2306 removes nested viewport-height ownership from Local and Cloud Story Mode", async () => {
  const local = await read("app/skin-v1/local-ai-skin-host.tsx");
  const cloud = await read("app/skin-v1/cloud-story-mode-host.tsx");
  assert.doesNotMatch(local, /const shell:[\s\S]*?minHeight:\s*"100vh"/u);
  assert.doesNotMatch(cloud, /const shell:[\s\S]*?minHeight:\s*"100vh"/u);
});

test("#2306 probes true keyboard entry and understands shell/scroll ownership", async () => {
  const interaction = await read("lib/verification/browser-probes/interaction.mjs");
  const runtime = await read("lib/verification/browser-probes/runtime.mjs");

  assert.match(interaction, /data-webmcp-focus-sentinel/u);
  assert.match(interaction, /document\.body\.prepend\(sentinel\)/u);
  assert.match(interaction, /sentinel\.focus\(\)/u);

  assert.match(runtime, /isCanonicalShellReturn/u);
  assert.match(runtime, /\.pp-skin-v1-return/u);
  assert.match(runtime, /isInsideHorizontalScroller/u);
  assert.match(runtime, /pageScrollWidth/u);
  assert.match(runtime, /rootHorizontalOverflowPx/u);
});

test("#2306 Full QA PASS requires zero blockers and zero advisories", async () => {
  const runner = await read("lib/verification/webmcp-qa/runner.mjs");
  assert.match(
    runner,
    /result\.status === "FAIL" \|\| Number\(result\.blockers\) > 0 \|\| Number\(result\.advisories\) > 0/u,
  );
});
