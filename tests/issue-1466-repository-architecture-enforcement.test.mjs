import assert from "node:assert/strict";
import test from "node:test";
import {
  compatibilityBridgeRatchetViolations,
  directRootAdditionViolations,
  importBoundaryViolations,
  isTemporaryReexportBridge,
  runArchitectureEnforcement,
} from "../scripts/developer-diagnostics/architecture/repository-architecture-enforcement.mjs";

const protectedRoots = ["build", "core", "modules", "lib"];
const importRules = [
  { fromRoot: "core", toRoots: ["app", "build", "modules"], reason: "core stays inward" },
  { fromRoot: "modules", toRoots: ["app"], reason: "modules do not depend on app" },
];

test("#1466 ratchets legacy governed roots without a big-bang restructure", () => {
  const report = runArchitectureEnforcement({ writeArtifact: false });
  assert.equal(report.status, "pass", report.violations.join("\n"));
  assert.equal(report.metrics.lib.directSourceFiles, 118);
  assert.equal(report.metrics.lib.directSourceLimit, 118);
  assert.equal(report.metrics.build.directSourceFiles, 84);
  assert.equal(report.metrics.build.directSourceLimit, 84);
  assert.equal(report.metrics.core.directSourceLimit, 16);
  assert.equal(report.metrics.modules.directSourceLimit, 16);
  assert.deepEqual(report.baselineEvidence.directSourceFilesBefore, { build: 84, core: 0, modules: 0, lib: 126 });
  assert.equal(report.baselineEvidence.retiredZeroConsumerCompatibilityBridges, 8);
});

test("#1466 blocks new direct source files from governed dumping-ground roots", () => {
  assert.deepEqual(
    directRootAdditionViolations([{ status: "A", path: "lib/new-helper.ts" }], protectedRoots),
    ["New direct source file is not allowed in governed root lib/: lib/new-helper.ts. Place it under its owning domain directory."],
  );
  assert.deepEqual(directRootAdditionViolations([{ status: "A", path: "lib/projects/new-helper.ts" }], protectedRoots), []);
});

test("#1466 catches forbidden inward-to-outward dependency direction", () => {
  const coreViolations = importBoundaryViolations("core/project/example.ts", 'import Widget from "@/app/widget";\n', importRules);
  assert.equal(coreViolations.length, 1);
  assert.match(coreViolations[0], /core -> app/);
  assert.deepEqual(importBoundaryViolations("modules/plan/example.ts", 'import { contract } from "@/core/contracts/example";\n', importRules), []);
});

test("#1466 distinguishes temporary re-export shims from files that merely discuss compatibility", () => {
  assert.equal(
    isTemporaryReexportBridge('// Temporary Phase 7 compatibility bridge. Remove in Phase 8 (#1309).\nexport * from "../modules/build/pageflow";\n'),
    true,
  );
  assert.equal(
    isTemporaryReexportBridge('// Compatibility bridge behavior is handled by a real implementation.\nexport function inspectBridge() { return true; }\n'),
    false,
  );
});

test("#1466 lets legacy compatibility debt shrink but rejects a newly introduced bridge path", () => {
  assert.deepEqual(
    compatibilityBridgeRatchetViolations(["lib/legacy.ts"], ["lib/legacy.ts", "lib/retired.ts"]),
    [],
  );
  assert.deepEqual(
    compatibilityBridgeRatchetViolations(["lib/legacy.ts", "lib/new-bridge.ts"], ["lib/legacy.ts"]),
    ["New temporary compatibility bridge is not allowed: lib/new-bridge.ts. Move the consumer to the canonical owner instead of adding transition debt."],
  );
});

test("#1466 keeps consumer-level evidence for explicitly owned bridge exceptions", () => {
  const report = runArchitectureEnforcement({ writeArtifact: false });
  assert.deepEqual(report.compatibilityBridges, [
    {
      path: "lib/pageflow.ts",
      canonicalTarget: "modules/build/pageflow.ts",
      ownerIssue: 1466,
      consumers: ["app/pageflow/page.tsx", "app/craftloop/page.tsx"],
    },
  ]);
});
