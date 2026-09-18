import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canonicalEvidencePaths,
  canonicalNavigationEvidenceStem,
  canonicalWebMcpSurfaceIds,
} from "../lib/verification/skin-v1-surface-registry.mjs";
import {
  WEBMCP_STANDARD_SURFACE_REGISTRY,
  WEBMCP_STANDARD_SURFACE_TARGETS,
} from "../lib/verification/webmcp-canonical-surface-registry.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2226 Phase 1 orders standard evidence by the current Human navigation flow", () => {
  assert.deepEqual([...canonicalWebMcpSurfaceIds()], [
    "dashboard",
    "community",
    "writers-craft",
    "library",
    "library-new",
    "library-import",
    "library-load",
    "library-examples",
    "library-presets",
    "library-avery",
    "library-archive",
    "story-map",
    "storyboard",
    "visual-story",
    "scene-timeline",
    "previs",
    "write",
    "pageflow",
    "profile",
    "settings",
    "general",
    "story-mode",
    "local-ai",
    "cloud-story-mode",
    "hybrid-story-mode",
    "node",
    "agents",
    "issue-log",
    "licensing",
    "shutdown-node",
  ]);
  assert.deepEqual(WEBMCP_STANDARD_SURFACE_TARGETS, [...canonicalWebMcpSurfaceIds()]);
});

test("#2226 Phase 1 derives sortable candidate and baseline names from navigation identity", () => {
  const expected = {
    dashboard: ["00-dashboard", ".artifacts/visual-readiness/00-dashboard__candidate.png", "tests/visual-baselines/skin-v1/00-dashboard.png"],
    "library-load": ["03-library__03-load", ".artifacts/visual-readiness/03-library__03-load__candidate.png", "tests/visual-baselines/skin-v1/03-library__03-load.png"],
    "scene-timeline": ["05-storyboard__02-scene-workspace", ".artifacts/visual-readiness/05-storyboard__02-scene-workspace__candidate.png", "tests/visual-baselines/skin-v1/05-storyboard__02-scene-workspace.png"],
    "cloud-story-mode": ["15-manage__02-story-mode__02-cloud", ".artifacts/visual-readiness/15-manage__02-story-mode__02-cloud__candidate.png", "tests/visual-baselines/skin-v1/15-manage__02-story-mode__02-cloud.png"],
    pageflow: ["10-refine__03-pageflow", ".artifacts/visual-readiness/10-refine__03-pageflow__candidate.png", "tests/visual-baselines/skin-v1/10-refine__03-pageflow.png"],
  };

  for (const [id, [stem, candidate, baseline]] of Object.entries(expected)) {
    assert.equal(canonicalNavigationEvidenceStem(id), stem);
    const evidence = canonicalEvidencePaths(id);
    assert.equal(evidence?.candidate, candidate);
    assert.equal(evidence?.baseline, baseline);
  }
});

test("#2226 Phase 1 keeps manifest paths and report/capture projection on one canonical order", async () => {
  const manifest = await readJson("tests/visual-baselines/skin-v1/manifest.json");
  const targets = [...canonicalWebMcpSurfaceIds()];

  assert.equal(manifest.evidenceNaming.issue, 2226);
  assert.equal(manifest.evidenceNaming.authority, "config/skin-v1-surface-registry.json#navigationIdentity");

  for (const id of targets) {
    const evidence = canonicalEvidencePaths(id);
    const manifestEntry = manifest.surfaces[id];
    const projected = WEBMCP_STANDARD_SURFACE_REGISTRY[id];
    assert.ok(manifestEntry, "manifest missing " + id);
    assert.equal(manifestEntry.candidate, evidence?.candidate);
    assert.equal(manifestEntry.baseline, evidence?.baseline);
    assert.equal(projected.candidate, evidence?.candidate);
    assert.equal(projected.baseline, evidence?.baseline);
    assert.equal(projected.evidenceStem, evidence?.stem);
  }

  const stems = targets.map((id) => canonicalNavigationEvidenceStem(id));
  assert.deepEqual(stems, [...stems].sort((left, right) => left.localeCompare(right)));
});

test("#2226 Phase 1 preserves discoverable legacy evidence aliases", async () => {
  const registry = await readJson("config/skin-v1-surface-registry.json");
  const dashboard = registry.surfaces.find((surface) => surface.id === "dashboard");
  const cloud = registry.surfaces.find((surface) => surface.id === "cloud-story-mode");

  assert.deepEqual(dashboard.legacyEvidence, {
    candidate: ".artifacts/visual-readiness/dashboard-canonical.png",
    baseline: "tests/visual-baselines/skin-v1/dashboard.png",
  });
  assert.deepEqual(cloud.legacyEvidence, {
    candidate: ".artifacts/visual-readiness/cloud-story-mode-candidate.png",
    baseline: "tests/visual-baselines/skin-v1/cloud-story-mode.png",
  });

  const [legacyDashboard, orderedDashboard] = await Promise.all([
    readFile(new URL("../tests/visual-baselines/skin-v1/dashboard.png", import.meta.url)),
    readFile(new URL("../tests/visual-baselines/skin-v1/00-dashboard.png", import.meta.url)),
  ]);
  assert.deepEqual(orderedDashboard, legacyDashboard, "renamed locked Dashboard evidence must be byte-for-byte identical");
});

test("#2226 Phase 1 keeps Dashboard as the sole locked reference and changes no visual authority", async () => {
  const [manifest, standardCatalogue, visualDirector, startup, locker] = await Promise.all([
    readJson("tests/visual-baselines/skin-v1/manifest.json"),
    read("lib/verification/webmcp-standard-surface-catalogue.mjs"),
    read("lib/verification/skin-v1-visual-director.mjs"),
    read("scripts/run-webmcp-startup-uat.mjs"),
    read("scripts/lock-skin-visual-baseline.mjs"),
  ]);

  const locked = Object.entries(manifest.surfaces)
    .filter(([, entry]) => entry.status === "locked")
    .map(([id]) => id);
  assert.deepEqual(locked, ["dashboard"]);

  for (const source of [standardCatalogue, visualDirector, startup]) {
    assert.match(source, /webmcp-canonical-surface-registry\.mjs/u);
  }
  assert.match(locker, /canonicalEvidencePaths/u);
  assert.match(locker, /visual evidence path drifted from canonical navigation identity/u);
  assert.match(standardCatalogue, /new URL\(page\.url\(\)\)\.pathname !== "\\/skin-v1"/u);
  assert.match(standardCatalogue, /const visibleContracts = contracts/u);
  assert.match(standardCatalogue, /root\.contains\(otherRoot\)/u);
  assert.match(standardCatalogue, /mostSpecific\?\.contract/u);
});
