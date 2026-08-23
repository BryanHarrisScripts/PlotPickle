import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runArchitectureHealthAudit } from "../scripts/architecture-health-audit.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("architecture health audit preserves current PlotPickle ownership boundaries", async () => {
  const report = await runArchitectureHealthAudit({ writeArtifact: false });

  assert.notEqual(report.status, "violated", JSON.stringify(report.materialFindings, null, 2));
  assert.equal(report.materialFindings.length, 0);
  assert.ok(report.invariants.every((item) => item.pass));

  assert.equal(report.mcp.canonicalServerCount, 1);
  assert.deepEqual(report.mcp.canonicalServers, ["plotpickle-dev"]);
  assert.notEqual(report.mcp.mirrorMatchesCanonical, false);

  assert.equal(report.agents.duplicateSkillIds.length, 0);
  assert.equal(report.agents.missingSkillEntries.length, 0);
  assert.equal(report.agents.mcpReadyCount, report.agents.skillCount);

  assert.equal(report.runtime.duplicateRuntimeIds.length, 0);
  assert.equal(report.runtime.futureNodeEnabled, false);
  assert.equal(report.modules.crossModulePrivateImportViolations.length, 0);
});

test("repository breadth is measured separately from runtime architecture", async () => {
  const report = await runArchitectureHealthAudit({ writeArtifact: false });
  const directories = new Map(report.directories.map((item) => [item.directory, item]));

  for (const directory of ["app", "core", "modules", "lib", "build", "adapters", "config", "scripts", "tests", ".agents", "docs", "public"]) {
    assert.ok(directories.has(directory), `${directory} must be classified by the audit`);
  }

  assert.ok(report.repository.fileCount > 0);
  assert.ok(report.repository.bytes > 0);
  assert.ok(report.packageSurface.scriptCount > 0);
  assert.ok(report.packageSurface.issueReferencedScriptCount > 0, "historical issue-linked verification surface should be measured rather than silently deleted");
  assert.match(report.status, /^healthy/);
});

test("the canonical modular foundation documents the current ownership and anti-bloat rule", async () => {
  const architecture = await read("docs/architecture/MODULAR-FOUNDATION.md");
  assert.match(architecture, /Global coherence without global mutable state/);
  assert.match(architecture, /Current ownership map/);
  assert.match(architecture, /PluginHost \/ Core Services/);
  assert.match(architecture, /Agent Skills/);
  assert.match(architecture, /MCP/);
  assert.match(architecture, /measure first/i);
  assert.match(architecture, /leave it alone/i);
});
