from pathlib import Path
import subprocess

root = Path('.')

source_mjs = root / 'core/story-workflow/story-workflow-core.mjs'
target_mjs = root / 'core/story-workflow/runtime/story-workflow-core.mjs'
source_dts = root / 'core/story-workflow/story-workflow-core.d.ts'
target_dts = root / 'core/story-workflow/runtime/story-workflow-core.d.ts'

target_mjs.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(['git', 'mv', str(source_mjs), str(target_mjs)], check=True)
subprocess.run(['git', 'mv', str(source_dts), str(target_dts)], check=True)

# Core siblings use a short relative import back to the generic workflow core.
for path in [
    'core/story-workflow/story-council/core.mjs',
    'core/story-workflow/story-council/core.d.ts',
    'core/story-workflow/buzz/buzz-story-bridge-core.mjs',
    'core/story-workflow/buzz/buzz-story-bridge-core.d.ts',
]:
    file = root / path
    text = file.read_text()
    old = '../story-workflow-core.mjs'
    new = '../runtime/story-workflow-core.mjs'
    if old not in text:
        raise SystemExit(f'Missing expected Story Workflow core import in {path}')
    file.write_text(text.replace(old, new))

# Product/module/test consumers carry the repository path in their relative import.
for path in [
    'modules/story-workflow/council/story-council-runtime.ts',
    'modules/story-workflow/bridge/buzz-story-bridge.ts',
    'modules/story-workflow/workbench/workflow.ts',
    'modules/story-workflow/council/story-council.ts',
    'modules/story-workflow/runtime/foundations-story-workflow.ts',
    'modules/story-workflow/ui/foundations-story-workflow-panel.tsx',
    'modules/story-workflow/ui/foundations-buzz-story-live-test.tsx',
    'tests/issue-1416-story-workflow-engine.test.mjs',
]:
    file = root / path
    text = file.read_text()
    old = 'core/story-workflow/story-workflow-core.mjs'
    new = 'core/story-workflow/runtime/story-workflow-core.mjs'
    if old not in text:
        raise SystemExit(f'Missing expected Story Workflow core path in {path}')
    file.write_text(text.replace(old, new))

# Earlier architecture regressions are hardcoded path consumers and must follow the new canonical owner.
legacy_regex_updates = {
    'tests/issue-1497-story-bridge-module-move.test.mjs': [
        ('core\\/story-workflow\\/buzz-story-bridge-core', 'core\\/story-workflow\\/buzz\\/buzz-story-bridge-core'),
        ('core\\/story-workflow\\/story-workflow-core', 'core\\/story-workflow\\/runtime\\/story-workflow-core'),
    ],
    'tests/issue-1499-foundations-story-runtime-move.test.mjs': [
        ('core\\/story-workflow\\/story-workflow-core', 'core\\/story-workflow\\/runtime\\/story-workflow-core'),
    ],
    'tests/issue-1502-buzz-story-core-move.test.mjs': [
        ('from "../story-workflow-core.mjs"', 'from "../runtime/story-workflow-core.mjs"'),
    ],
}
for path, replacements in legacy_regex_updates.items():
    file = root / path
    text = file.read_text()
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f'Missing expected hardcoded path in {path}: {old}')
        text = text.replace(old, new)
    file.write_text(text)

config = root / 'config/repository-architecture-target.json'
text = config.read_text()
old = '{"id":"phase2-core-story-runtime","phase":2,"domain":"story","sourceRoot":"core/story-workflow","targetRoot":"core/story-workflow/runtime","directFilesOnly":true,"selector":{"prefixes":["story-workflow-core"]}}'
new = '{"id":"phase2-core-story-runtime","phase":2,"domain":"story","sourceRoot":"core/story-workflow","targetRoot":"core/story-workflow/runtime","directFilesOnly":true,"selector":{"prefixes":["story-workflow-core"]},"status":"completed","completedAt":"2026-08-27","completedSources":["core/story-workflow/story-workflow-core.d.ts","core/story-workflow/story-workflow-core.mjs"],"completedTargets":["core/story-workflow/runtime/story-workflow-core.d.ts","core/story-workflow/runtime/story-workflow-core.mjs"]}'
if old not in text:
    raise SystemExit('Expected phase2-core-story-runtime contract line was not found')
config.write_text(text.replace(old, new, 1))

regression = root / 'tests/issue-1504-story-runtime-core-move.test.mjs'
regression.write_text(r'''import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  affectedStoryWorkItemIds,
  planStoryWorkItems,
  reduceStoryResults,
  requeueAffectedStoryWorkItems,
  storyWorkItemId,
} from "../core/story-workflow/runtime/story-workflow-core.mjs";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1504 moves the generic Story Workflow core pair to its ratified runtime owner", async () => {
  await assert.rejects(access(new URL("core/story-workflow/story-workflow-core.mjs", root)));
  await assert.rejects(access(new URL("core/story-workflow/story-workflow-core.d.ts", root)));
  await access(new URL("core/story-workflow/runtime/story-workflow-core.mjs", root));
  await access(new URL("core/story-workflow/runtime/story-workflow-core.d.ts", root));
});

test("#1504 preserves stable work identity, Human gates and targeted re-evaluation behavior", () => {
  const requirements = [{
    id: "foundations:motivation",
    frontier: "Foundations",
    targetRefs: ["ppf:foundations:motivation"],
    dependencyRefs: ["ppf:foundations:premise"],
    waitingHuman: false,
    satisfied: false,
    locked: false,
    priority: "high",
  }];
  const first = planStoryWorkItems({ projectId: "afterglow-working-copy", baseRevision: 9, requirements });
  const second = planStoryWorkItems({ projectId: "afterglow-working-copy", baseRevision: 9, requirements });
  assert.deepEqual(first, second);
  assert.equal(first[0].workItemId, storyWorkItemId({
    projectId: "afterglow-working-copy",
    baseRevision: 9,
    curriculumRequirementId: "foundations:motivation",
    targetRefs: ["ppf:foundations:motivation"],
  }));

  const reduced = reduceStoryResults([
    { workItemId: first[0].workItemId, kind: "proposal", targetRefs: first[0].targetRefs, explanation: "One bounded proposal.", proposal: "Keep Human review." },
  ]);
  assert.equal(reduced.results[0].humanGate, "proposal-review");

  assert.deepEqual(affectedStoryWorkItemIds(first, ["ppf:foundations:premise"]), [first[0].workItemId]);
  const requeued = requeueAffectedStoryWorkItems([{ ...first[0], status: "resolved", runId: "run-1", proposalIds: ["proposal-1"] }], ["ppf:foundations:premise"]);
  assert.equal(requeued[0].status, "queued");
  assert.equal(requeued[0].runId, "");
  assert.deepEqual(requeued[0].proposalIds, []);
});

test("#1504 retargets every known direct consumer without a root compatibility shim", async () => {
  const canonical = "core/story-workflow/runtime/story-workflow-core.mjs";
  for (const path of [
    "modules/story-workflow/council/story-council-runtime.ts",
    "modules/story-workflow/bridge/buzz-story-bridge.ts",
    "modules/story-workflow/workbench/workflow.ts",
    "modules/story-workflow/council/story-council.ts",
    "modules/story-workflow/runtime/foundations-story-workflow.ts",
    "modules/story-workflow/ui/foundations-story-workflow-panel.tsx",
    "modules/story-workflow/ui/foundations-buzz-story-live-test.tsx",
    "tests/issue-1416-story-workflow-engine.test.mjs",
  ]) {
    const content = await source(path);
    assert.ok(content.includes(canonical), `${path} is not retargeted to the runtime-owned Story Workflow core`);
    assert.ok(!content.includes("core/story-workflow/story-workflow-core.mjs"), `${path} still names the retired root core`);
  }
  for (const path of [
    "core/story-workflow/story-council/core.mjs",
    "core/story-workflow/story-council/core.d.ts",
    "core/story-workflow/buzz/buzz-story-bridge-core.mjs",
    "core/story-workflow/buzz/buzz-story-bridge-core.d.ts",
  ]) {
    const content = await source(path);
    assert.ok(content.includes('../runtime/story-workflow-core.mjs'), `${path} is not retargeted to the sibling runtime owner`);
    assert.ok(!content.includes('../story-workflow-core.mjs'), `${path} still points at the retired root core`);
  }
});

test("#1504 marks the final Phase 2 move batch complete while preserving the Phase 0 historical map", async () => {
  const architecture = JSON.parse(await source("config/repository-architecture-target.json"));
  const batch = architecture.moveBatches.find((item) => item.id === "phase2-core-story-runtime");
  assert.equal(batch?.status, "completed");
  assert.deepEqual(batch?.completedSources, [
    "core/story-workflow/story-workflow-core.d.ts",
    "core/story-workflow/story-workflow-core.mjs",
  ]);
  assert.deepEqual(batch?.completedTargets, [
    "core/story-workflow/runtime/story-workflow-core.d.ts",
    "core/story-workflow/runtime/story-workflow-core.mjs",
  ]);
  const history = await source("docs/architecture/REPOSITORY-ARCHITECTURE-TARGET.md");
  assert.ok(history.includes('legacy root `core/story-workflow/story-workflow-core.*` → `core/story-workflow/runtime/`'));
});
''')
