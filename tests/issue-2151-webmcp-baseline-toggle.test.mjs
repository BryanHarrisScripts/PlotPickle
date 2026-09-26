import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  readVisualBaselineManifest,
  toggleVisualBaselines,
} from "../scripts/lock-skin-visual-baseline.mjs";
import {
  parseVisualBaselineSelection,
  promptVisualBaselineChanges,
  visualBaselineResultLines,
  visualBaselineReviewLines,
  visualBaselineSelectionLines,
} from "../scripts/run-webmcp-startup-uat.mjs";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TARGETS = ["dashboard", "story-map", "visual-story"];
const LABELS = {
  dashboard: "Dashboard",
  "story-map": "Story Map",
  "visual-story": "Visual Story",
};

async function writeFixture(root) {
  const manifest = {
    version: 1,
    skin: "skin-v1",
    surfaces: Object.fromEntries(TARGETS.map((surface) => [surface, {
      label: LABELS[surface],
      status: surface === "dashboard" ? "locked" : "candidate",
      candidate: `.artifacts/visual-readiness/${surface}-candidate.png`,
      baseline: `tests/visual-baselines/skin-v1/${surface}.png`,
    }])),
  };
  const manifestPath = path.join(root, "tests/visual-baselines/skin-v1/manifest.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  for (const surface of TARGETS) {
    const candidatePath = path.join(root, manifest.surfaces[surface].candidate);
    await mkdir(path.dirname(candidatePath), { recursive: true });
    await writeFile(candidatePath, Buffer.concat([PNG, Buffer.from(`candidate-${surface}`)]));
  }
  const dashboardBaseline = path.join(root, manifest.surfaces.dashboard.baseline);
  await mkdir(path.dirname(dashboardBaseline), { recursive: true });
  await writeFile(dashboardBaseline, Buffer.concat([PNG, Buffer.from("approved-dashboard")]));
  return { manifestPath, manifest };
}

test("#2151 N exits after the single approval question with zero mutation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2151-no-"));
  try {
    const fixture = await writeFixture(root);
    const before = await readFile(fixture.manifestPath, "utf8");
    const questions = [];
    const approval = await promptVisualBaselineChanges({
      manifest: fixture.manifest,
      targets: TARGETS,
      labels: LABELS,
      output: { write() {} },
      question: async (question) => {
        questions.push(question);
        return "N";
      },
    });

    assert.deepEqual(approval, { prompted: true, approved: false, surfaces: [] });
    assert.deepEqual(questions, ["Do you want to change the locked visual baselines? [Y/N] "]);
    assert.equal(await readFile(fixture.manifestPath, "utf8"), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#2151 derives numbered locked states from the supplied catalogue and manifest", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2151-list-"));
  try {
    const fixture = await writeFixture(root);
    assert.deepEqual(visualBaselineReviewLines({ manifest: fixture.manifest, targets: TARGETS, labels: LABELS }), [
      "Visual review complete.",
      "3 surfaces captured.",
      "Currently locked visual baselines: [1] Dashboard",
    ]);
    const listing = visualBaselineSelectionLines({ manifest: fixture.manifest, targets: TARGETS, labels: LABELS }).join("\n");
    assert.match(listing, /\[1\] Dashboard\s+\[LOCKED\]/u);
    assert.match(listing, /\[2\] Story Map\s+\[UNLOCKED\]/u);
    assert.match(listing, /\[3\] Visual Story\s+\[UNLOCKED\]/u);
    assert.deepEqual(parseVisualBaselineSelection(" 2, 3 ", TARGETS), ["story-map", "visual-story"]);

    const answers = ["Y", "2, 3"];
    let output = "";
    const approval = await promptVisualBaselineChanges({
      manifest: fixture.manifest,
      targets: TARGETS,
      labels: LABELS,
      output: { write(value) { output += value; } },
      question: async () => answers.shift(),
    });
    assert.deepEqual(approval, { prompted: true, approved: true, surfaces: ["story-map", "visual-story"] });
    assert.match(output, /Select the surface numbers that should be LOCKED/u);
    assert.match(output, /\[1\] Dashboard\s+\[LOCKED\]/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#2151 locks one current candidate through the existing manifest and PNG paths", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2151-lock-"));
  try {
    const fixture = await writeFixture(root);
    const result = await toggleVisualBaselines(["story-map"], { root });
    const { manifest } = await readVisualBaselineManifest({ root });
    assert.equal(manifest.surfaces.dashboard.status, "locked");
    assert.equal(manifest.surfaces["story-map"].status, "locked");
    assert.equal(manifest.surfaces["visual-story"].status, "candidate");
    assert.deepEqual(
      await readFile(path.join(root, manifest.surfaces["story-map"].baseline)),
      await readFile(path.join(root, manifest.surfaces["story-map"].candidate)),
    );
    assert.deepEqual(result.lockedSurfaces, ["dashboard", "story-map"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#2151 unlocks a locked surface without deleting its prior evidence", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2151-unlock-"));
  try {
    const fixture = await writeFixture(root);
    const baselinePath = path.join(root, fixture.manifest.surfaces.dashboard.baseline);
    const before = await readFile(baselinePath);
    const result = await toggleVisualBaselines(["dashboard"], { root });
    const { manifest } = await readVisualBaselineManifest({ root });
    assert.equal(manifest.surfaces.dashboard.status, "candidate");
    assert.deepEqual(await readFile(baselinePath), before);
    assert.match(visualBaselineResultLines(result, { targets: TARGETS }).join("\n"), /\[1\] Dashboard \[LOCKED → UNLOCKED\]/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#2151 validates the full mixed selection before changing any baseline state", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2151-mixed-"));
  try {
    const fixture = await writeFixture(root);
    const before = await readFile(fixture.manifestPath, "utf8");
    for (const invalid of ["", "0", "4", "1,1", "1,,2", "one"]) {
      assert.throws(() => parseVisualBaselineSelection(invalid, TARGETS));
    }
    await assert.rejects(toggleVisualBaselines(["story-map", "story-map"], { root }), /duplicate/u);
    await assert.rejects(toggleVisualBaselines(["story-map", "unknown"], { root }), /Unknown/u);
    assert.equal(await readFile(fixture.manifestPath, "utf8"), before);

    const result = await toggleVisualBaselines(["dashboard", "story-map", "visual-story"], { root });
    const { manifest } = await readVisualBaselineManifest({ root });
    assert.equal(manifest.surfaces.dashboard.status, "candidate");
    assert.equal(manifest.surfaces["story-map"].status, "locked");
    assert.equal(manifest.surfaces["visual-story"].status, "locked");
    assert.deepEqual(result.lockedSurfaces, ["story-map", "visual-story"]);
    assert.match(visualBaselineResultLines(result, { targets: TARGETS }).at(-1), /\[2\], \[3\]/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
