import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildGateResult,
  normalizeStagedFiles,
} from "../scripts/developer-diagnostics/gates/pre-commit.mjs";

test("#1451 pre-commit evidence is staged-file focused and keeps heavier gates separate", () => {
  const result = buildGateResult({
    status: "fail",
    stagedFiles: ["app/page.tsx"],
    completedSteps: ["staged-diff-integrity"],
    failure: {
      rule: "changed-test-selection",
      reason: "No safe focused test mapping exists.",
      rerun: "node scripts/developer-diagnostics/test-changed.mjs --plan --files app/page.tsx",
      evidenceRef: "git:plotpickle/pre-commit-result.json",
    },
  });

  assert.equal(result.gateId, "plotpickle-pre-commit");
  assert.equal(result.scope, "staged-files");
  assert.deepEqual(result.authoritativeFor, ["staged-diff-integrity", "changed-test-selection"]);
  assert.ok(result.notAuthoritativeFor.includes("ben"));
  assert.ok(result.notAuthoritativeFor.includes("github-exact-head-ci"));
  assert.equal(result.failure.rule, "changed-test-selection");
  assert.match(result.nextAction, /rerun-the-same-hook/);
});

test("#1451 staged-file normalization is deterministic", () => {
  assert.deepEqual(
    normalizeStagedFiles("modules\\story\\one.ts\0app/page.tsx\0app/page.tsx\0"),
    ["app/page.tsx", "modules/story/one.ts"],
  );
});

test("#1451 hooks are explicit opt-in repository-local tooling", async () => {
  const [hook, installer, gate, readme] = await Promise.all([
    readFile(new URL("../.githooks/pre-commit", import.meta.url), "utf8"),
    readFile(new URL("../Utilities/Enable-Developer-Hooks.cmd", import.meta.url), "utf8"),
    readFile(new URL("../scripts/developer-diagnostics/gates/pre-commit.mjs", import.meta.url), "utf8"),
    readFile(new URL("../Utilities/DeveloperWorkbench/README.md", import.meta.url), "utf8"),
  ]);

  assert.match(hook, /developer-diagnostics\/gates\/pre-commit\.mjs/);
  assert.match(installer, /git config --local core\.hooksPath \.githooks/);
  assert.doesNotMatch(installer, /git config --global/);
  assert.match(gate, /git:plotpickle\/pre-commit-result\.json/);
  assert.match(gate, /git diff/);
  assert.match(gate, /test-changed\.mjs/);
  assert.doesNotMatch(gate, /run-ben-code-quality|build-verified|repomix/i);
  assert.match(readme, /Enable-Developer-Hooks\.cmd/);
  assert.match(readme, /does not run BEN, the production build, Repomix or model inference/);
});
