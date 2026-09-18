import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#2125 Slice 5 routes an approved Shot timing change through the existing #2035 seam", async () => {
  const module = await source("lib/preproduction/approved-shot-timing-transaction.ts");

  assert.match(module, /createPreproductionCreativeChangeSet/);
  assert.match(module, /verifyPreproductionCreativeChangeSet/);
  assert.match(module, /buildPreproductionDependencySnapshot/);
  assert.match(module, /projectProductionInstruction/);
  assert.match(module, /downstreamImpactIds/);
  assert.match(module, /area:\s*["']previs["']/);
  assert.match(module, /targetIds:\s*\[shot\.id\]/);
  assert.match(module, /shot\.reviewState\s*!==\s*["']approved["']/);
  assert.match(module, /currentStaleIds:\s*input\.currentStaleIds/);
});

test("#2125 Slice 5 keeps Human review and durable #2035 commit ahead of PPF admission", async () => {
  const module = await source("lib/preproduction/approved-shot-timing-transaction.ts");

  assert.match(module, /transaction\.state\s*!==\s*["']committed["']/);
  assert.match(module, /transaction\.review\.status\s*!==\s*["']accepted["']/);
  assert.match(module, /creativeChangeSetFingerprint\(transaction\.changeSet\)/);
  assert.match(module, /directChange\.beforeFingerprint\s*!==\s*timingFingerprint\(current\)/);
  assert.match(module, /type:\s*["']previs\.shot\.store["']/);
  assert.match(module, /applyStoryCommand\(project/);
  assert.doesNotMatch(module, /saveFoundationProject|localStorage|sessionStorage|createLocalCreativeTransactionProvider|createGitHubCreativeTransactionProvider/);
});

test("#2125 Slice 5 distinguishes bounded impact from revision-proven stale derivatives", async () => {
  const module = await source("lib/preproduction/approved-shot-timing-transaction.ts");
  const visual = await source("lib/preproduction/visual-story-projection.ts");
  const timeline = await source("lib/preproduction/scene-timeline-projection.ts");

  assert.match(module, /downstreamAffectedIds\s*=\s*stableIds\(downstreamImpactIds/);
  assert.match(module, /unaffectedProductionShotIds/);
  assert.match(module, /filter\(\(candidate\) => !affected\.has\(candidate\.id\)\)/);
  assert.match(module, /projectProductionInstruction\(next\)/);
  assert.match(module, /production-instruction:\$\{project\.id\}:revision-/);
  assert.match(module, /staleDerivativeIds\s*=\s*stableIds\(plan\.downstreamAffectedIds\.filter/);

  // The edited Shot keeps one stable identity across Visual Story and Scene Workspace.
  assert.match(visual, /productionShotId:\s*production\?\.id\s*\?\?\s*null/);
  assert.match(timeline, /productionShotId:\s*shot\.productionShotId/);
  assert.match(timeline, /id:\s*shot\.id/);
});

test("#2125 Slice 5 does not introduce a second transaction, dependency, staleness or canon authority", async () => {
  const module = await source("lib/preproduction/approved-shot-timing-transaction.ts");

  assert.doesNotMatch(module, /class\s+.*Transaction|new\s+Map|createCreativeChangeSet\s*\(/);
  assert.doesNotMatch(module, /references\s*=|reverseIndex\s*=|graph:\s*\{/);
  assert.doesNotMatch(module, /approvedShotsStore|timelineStore|stalenessStore|canonStore/);
});
