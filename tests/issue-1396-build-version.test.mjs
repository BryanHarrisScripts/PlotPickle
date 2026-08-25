import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compareSemanticVersions } from "../lib/runtime/application-version-core.mjs";

const root = new URL("..", import.meta.url);
const source = (filePath) => readFile(new URL(filePath, root), "utf8");

test("#1396 starts the rc.4.0.x approved-build sequence from one canonical package version", async () => {
  const [packageManifest, lockManifest, adapter, documentation] = await Promise.all([
    source("package.json").then(JSON.parse),
    source("package-lock.json").then(JSON.parse),
    source("lib/runtime/application-version.ts"),
    source("docs/specification/VERSIONING.md"),
  ]);

  assert.equal(packageManifest.version, "1.0.0-rc.4.0.1");
  assert.equal(lockManifest.version, packageManifest.version);
  assert.equal(lockManifest.packages[""].version, packageManifest.version);
  assert.match(adapter, /import packageManifest from "\.\.\/\.\.\/package\.json"/);
  assert.match(adapter, /PLOTPICKLE_VERSION = packageManifest\.version/);
  assert.match(documentation, /next approved build is `1\.0\.0-rc\.4\.0\.2`/i);
});

test("#1396 semantic ordering is newer than rc.3 and satisfies rc.4 plugin minima", async () => {
  assert.ok(compareSemanticVersions("1.0.0-rc.4.0.1", "1.0.0-rc.3") > 0);
  assert.ok(compareSemanticVersions("1.0.0-rc.4.0.1", "1.0.0-rc.4") > 0);
  assert.ok(compareSemanticVersions("1.0.0-rc.4.0.2", "1.0.0-rc.4.0.1") > 0);

  const [packageManifest, pluginPlatform, playhouse] = await Promise.all([
    source("package.json").then(JSON.parse),
    source("lib/plugin-platform.ts"),
    source("plugins/plotpickle-playhouse/index.ts"),
  ]);
  const minima = [...`${pluginPlatform}\n${playhouse}`.matchAll(/minimumPlotPickleVersion:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(minima.length >= 5);
  assert.ok(minima.every((minimum) => compareSemanticVersions(packageManifest.version, minimum) >= 0));
});

test("#1396 current-version consumers use the shared adapter and release artifacts agree", async () => {
  const packageManifest = JSON.parse(await source("package.json"));
  const consumers = await Promise.all([
    "lib/product-feedback.ts",
    "lib/projects/persistence/project-package.ts",
    "lib/projects/persistence/project-folder.ts",
    "lib/projects/persistence/story-project-repository.ts",
    "lib/projects/screenplay/screenplay-to-ppf.ts",
    "app/github-collaboration-base.tsx",
    "app/plotpickle-workspace-shell.tsx",
  ].map(source));
  assert.ok(consumers.every((value) => value.includes("PLOTPICKLE_VERSION")));

  const [template, bugReport, publicReadme] = await Promise.all([
    source("templates/github-story-project/plotpickle-project.json").then(JSON.parse),
    source(".github/ISSUE_TEMPLATE/bug-report.yml"),
    source("public/docs/readme/WRITING-AND-PRODUCTION.md"),
  ]);
  assert.equal(template.createdWith, `PlotPickle ${packageManifest.version}`);
  assert.match(bugReport, new RegExp(packageManifest.version.replaceAll(".", "\\.")));
  assert.match(publicReadme, new RegExp(packageManifest.version.replaceAll(".", "\\.")));
});

test("#1396 Node panel separates the changing version from the durable Node identity", async () => {
  const [shell, gateway, identityContract] = await Promise.all([
    source("app/plotpickle-workspace-shell.tsx"),
    source("build/node-topology-gateway.ts"),
    source("docs/architecture/IDENTITY-AUTHORITY.md"),
  ]);
  assert.match(shell, /<dt>Full Node ID<\/dt><dd[^>]*>\{node\?\.node\.id/);
  assert.match(shell, /<dt>Version<\/dt><dd>\{PLOTPICKLE_VERSION\}<\/dd>/);
  assert.match(gateway, /existing\.configured \? existing : await createStudioIdentity\("Local"\)/);
  assert.match(gateway, /nodeId: identity\.studioId/);
  assert.match(identityContract, /Existing `pp_studio_XXXXXXXX` IDs remain valid/);
});

test("#1396 leaves only intentional rc.3 compatibility and historical trust references", async () => {
  const intentional = new Set([
    "config/agent-skill-trust.json",
    "plugins/plotpickle-playhouse/index.ts",
    "sdk/COMPATIBILITY.md",
  ]);
  const candidates = [
    ...intentional,
    "app/github-collaboration-base.tsx",
    "lib/product-feedback.ts",
    "lib/projects/persistence/project-folder.ts",
    "lib/projects/persistence/project-package.ts",
    "lib/projects/persistence/story-project-repository.ts",
    "lib/projects/screenplay/screenplay-to-ppf.ts",
    "public/docs/readme/WRITING-AND-PRODUCTION.md",
    "templates/github-story-project/plotpickle-project.json",
  ];
  for (const filePath of candidates) {
    const value = await source(filePath);
    if (intentional.has(filePath)) assert.match(value, /1\.0\.0-rc\.3/);
    else assert.doesNotMatch(value, /1\.0\.0-rc\.(?:2|3)/, `${filePath} retains a stale current-version literal`);
  }
});
