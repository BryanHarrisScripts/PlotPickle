import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { lockVisualBaseline, SKIN_V1_BASELINE_MANIFEST } from "../scripts/lock-skin-visual-baseline.mjs";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("#1815 defines one versioned Skin V1 manifest for candidate and locked surface baselines", async () => {
  const manifest = JSON.parse(await read(SKIN_V1_BASELINE_MANIFEST));
  assert.equal(manifest.version, 1);
  assert.equal(manifest.skin, "skin-v1");
  assert.equal(manifest.designReference, "dashboard");
  assert.deepEqual(manifest.viewport, { width: 1440, height: 1100 });
  assert.ok(manifest.comparison.channelDelta > 0);
  assert.ok(manifest.comparison.maxChangedPixelRatio > 0 && manifest.comparison.maxChangedPixelRatio < 0.1);
  assert.deepEqual(Object.keys(manifest.surfaces), [
    "dashboard",
    "community",
    "settings",
    "cloud-story-mode",
    "agents",
    "profile",
    "local-ai",
    "node",
  ]);
  for (const [surface, entry] of Object.entries(manifest.surfaces)) {
    assert.equal(entry.status, "candidate", `${surface} should start as candidate until its actual approved PNG is committed`);
    assert.match(entry.candidate, /^\.artifacts\/visual-readiness\/.+\.png$/u);
    assert.match(entry.baseline, /^tests\/visual-baselines\/skin-v1\/.+\.png$/u);
    assert.ok(entry.selector);
  }
});

test("#1815 lock helper promotes exactly one explicit PNG candidate and never auto-overwrites", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-baseline-"));
  try {
    const manifest = {
      version: 1,
      skin: "skin-v1",
      designReference: "dashboard",
      viewport: { width: 1440, height: 1100 },
      comparison: { channelDelta: 24, maxChangedPixelRatio: 0.02 },
      surfaces: {
        dashboard: {
          label: "Dashboard",
          status: "candidate",
          selector: "#dashboard",
          candidate: ".artifacts/visual-readiness/dashboard-canonical.png",
          baseline: "tests/visual-baselines/skin-v1/dashboard.png",
        },
      },
    };
    const manifestPath = path.join(root, SKIN_V1_BASELINE_MANIFEST);
    const candidatePath = path.join(root, manifest.surfaces.dashboard.candidate);
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await mkdir(path.dirname(candidatePath), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const candidate = Buffer.concat([PNG_SIGNATURE, Buffer.from("approved-dashboard")]);
    await writeFile(candidatePath, candidate);

    const locked = await lockVisualBaseline("dashboard", { root });
    assert.equal(locked.surface, "dashboard");
    assert.deepEqual(await readFile(locked.baselinePath), candidate);
    const updated = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.equal(updated.surfaces.dashboard.status, "locked");
    await assert.rejects(() => lockVisualBaseline("dashboard", { root }), /already locked/u);
    await assert.rejects(() => lockVisualBaseline("community", { root }), /Unknown Skin V1 visual surface/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#1815 lock helper rejects missing and non-PNG candidate evidence", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-baseline-invalid-"));
  try {
    const manifest = {
      version: 1,
      skin: "skin-v1",
      surfaces: {
        community: {
          label: "Community",
          status: "candidate",
          selector: "#community",
          candidate: ".artifacts/visual-readiness/community-candidate.png",
          baseline: "tests/visual-baselines/skin-v1/community.png",
        },
      },
    };
    const manifestPath = path.join(root, SKIN_V1_BASELINE_MANIFEST);
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await assert.rejects(() => lockVisualBaseline("community", { root }), /does not exist/u);
    const candidatePath = path.join(root, manifest.surfaces.community.candidate);
    await mkdir(path.dirname(candidatePath), { recursive: true });
    await writeFile(candidatePath, "not-a-png");
    await assert.rejects(() => lockVisualBaseline("community", { root }), /not a PNG/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#1815 keeps candidate evidence disposable and locked baselines repository-owned", async () => {
  const [audit, workflow, readme] = await Promise.all([
    read("lib/verification/webmcp-surface-visual-audit.mjs"),
    read(".github/workflows/visual-readiness.yml"),
    read("tests/visual-baselines/README.md"),
  ]);
  assert.match(audit, /tests\/visual-baselines\/skin-v1\/manifest\.json/u);
  assert.match(audit, /captureSurfaceCandidate/u);
  assert.match(audit, /compareLockedBaseline/u);
  assert.match(audit, /maxChangedPixelRatio/u);
  assert.match(workflow, /\.artifacts\/visual-readiness\/\*\.png/u);
  assert.match(readme, /never updates a locked baseline/u);
  assert.match(readme, /Dashboard is the canonical Skin V1 design reference/u);
});
