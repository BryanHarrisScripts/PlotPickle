import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("PR #175 blocks cross-project restore while preserving the active project identity", async () => {
  const wrapper = await source("app/github-collaboration.tsx");
  assert.match(wrapper, /incoming\.id !== project\.id/);
  assert.match(wrapper, /different project/);
  assert.match(wrapper, /next\.id !== project\.id/);
  assert.match(wrapper, /Open or import it instead/);
});

test("PR #175 exposes chronological active-project restore points and current snapshots", async () => {
  const [wrapper, safety, vite] = await Promise.all([
    source("app/github-collaboration.tsx"),
    source("build/local-storage-safety-gateway.ts"),
    source("vite.config.ts"),
  ]);
  assert.match(wrapper, /searchParams\.set\("project", portableProjectFileName\(project\)\)/);
  assert.match(wrapper, /\/api\/local-projects\/snapshot/);
  assert.match(wrapper, /body\.backupLimit = effectiveBackupLimit/);
  assert.match(safety, /createdAt: info\.mtime\.toISOString\(\)/);
  assert.match(safety, /right\.createdAt\.localeCompare\(left\.createdAt\)/);
  assert.match(safety, /createCurrentProjectSnapshot/);
  assert.match(safety, /pruneRestorePoints/);
  assert.match(safety, /normalizeBackupLimit/);
  assert.match(vite, /localStorageSafetyGateway\(\)/);
  assert.ok(vite.indexOf("localStorageSafetyGateway()") < vite.indexOf("localProjectGateway()"));
});

test("PR #175 uses compact navigation without visible workflow containers", async () => {
  const [header, css, layout] = await Promise.all([
    source("app/application-shell-header.tsx"),
    source("app/minimal-navigation.css"),
    source("app/layout.tsx"),
  ]);
  assert.match(header, /shell-primary-navigation/);
  assert.match(header, /shell-divider/);
  assert.doesNotMatch(header, /shell-zone-label/);
  assert.doesNotMatch(header, /primary-button compact/);
  assert.match(css, /border-radius: 0/);
  assert.match(css, /background: transparent/);
  assert.match(css, /\.application-shell-header \.main-tabs button\.active::after\s*\{\s*background: var\(--shell-accent\);/);
  assert.match(layout, /minimal-navigation\.css/);
});
