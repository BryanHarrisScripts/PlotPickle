import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function json(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

test("OpenPencil is optional, user-managed and outside normal startup", async () => {
  const registry = await json("config/third-party-oss.json");
  const adapter = await json("config/openpencil-adapter.json");
  const pkg = await json("package.json");

  const entry = registry.systems.find((item) => item.id === "openpencil");
  assert.ok(entry, "OpenPencil must be present in the OSS registry");
  assert.equal(entry.license, "MIT");
  assert.equal(entry.usage, "connect-only");
  assert.equal(entry.category, "developer-design-tool");

  assert.equal(adapter.userManaged, true);
  assert.equal(adapter.autoInstall, false);
  assert.equal(adapter.launchOnPlotPickleStartup, false);
  assert.equal(adapter.requiredForPlotPickleStartup, false);
  assert.equal(adapter.localOnlyDefault, true);
  assert.equal(adapter.workspaceScope.required, true);
  assert.equal(adapter.workspaceScope.environment, "OPENPENCIL_MCP_ROOT");
  assert.equal(adapter.authority.developmentAuthority, "human-dsdd-github");
  assert.equal(adapter.authority.sourceMutationAllowed, false);
  assert.equal(adapter.authority.mergeAuthority, false);
  assert.equal(adapter.authority.webmcpReplacement, false);
  assert.equal(adapter.firstProof.issue, 2778);
  assert.equal(adapter.firstProof.surface, "Timeline");

  const dependencies = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };
  assert.equal(Object.keys(dependencies).some((name) => name.startsWith("@open-pencil/")), false);
});

test("OpenPencil architecture keeps design proposals subordinate to PlotPickle authority", async () => {
  const architecture = await readFile(new URL("../docs/architecture/OPENPENCIL-DESIGN-BRIDGE.md", import.meta.url), "utf8");
  assert.match(architecture, /Human intent[\s\S]*OpenPencil mockup[\s\S]*DSDD developer brief/);
  assert.match(architecture, /WebMCP/);
  assert.match(architecture, /OPENPENCIL_MCP_ROOT/);
  assert.match(architecture, /25 approved Storyboard images/);
  assert.match(architecture, /Generate Motion/);
});
