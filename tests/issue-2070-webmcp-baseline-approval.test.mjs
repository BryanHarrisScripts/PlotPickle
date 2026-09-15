import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  lockAllVisualBaselines,
  lockVisualBaseline,
} from "../scripts/lock-skin-visual-baseline.mjs";
import { approvesVisualBaselineReplacement } from "../scripts/run-webmcp-startup-uat.mjs";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

async function writeFixture(root) {
  const manifestPath = path.join(root, "tests/visual-baselines/skin-v1/manifest.json");
  const dashboardCandidate = path.join(root, ".artifacts/visual-readiness/dashboard-canonical.png");
  const profileCandidate = path.join(root, ".artifacts/visual-readiness/profile-candidate.png");
  const dashboardBaseline = path.join(root, "tests/visual-baselines/skin-v1/dashboard.png");
  const profileBaseline = path.join(root, "tests/visual-baselines/skin-v1/profile.png");

  await mkdir(path.dirname(dashboardCandidate), { recursive: true });
  await mkdir(path.dirname(dashboardBaseline), { recursive: true });
  await writeFile(dashboardCandidate, PNG);
  await writeFile(profileCandidate, PNG);
  await writeFile(dashboardBaseline, Buffer.from("old-dashboard"));
  await writeFile(profileBaseline, Buffer.from("old-profile"));
  await writeFile(manifestPath, `${JSON.stringify({
    version: 1,
    skin: "skin-v1",
    surfaces: {
      dashboard: {
        label: "Dashboard",
        status: "locked",
        candidate: ".artifacts/visual-readiness/dashboard-canonical.png",
        baseline: "tests/visual-baselines/skin-v1/dashboard.png",
      },
      profile: {
        label: "Identity",
        status: "candidate",
        candidate: ".artifacts/visual-readiness/profile-candidate.png",
        baseline: "tests/visual-baselines/skin-v1/profile.png",
      },
    },
  }, null, 2)}\n`, "utf8");

  return { manifestPath, dashboardBaseline, profileBaseline };
}

test("#2070 keeps ordinary single-surface locking protected", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-baseline-"));
  try {
    await writeFixture(root);
    await assert.rejects(lockVisualBaseline("dashboard", { root }), /already locked/u);
    await assert.rejects(lockAllVisualBaselines({ root }), /explicit --replace flag/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#2070 explicit replace-all promotes every current candidate locally", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-baseline-"));
  try {
    const fixture = await writeFixture(root);
    const result = await lockAllVisualBaselines({ root, replace: true });
    assert.equal(result.baselines.length, 2);
    assert.deepEqual(await readFile(fixture.dashboardBaseline), PNG);
    assert.deepEqual(await readFile(fixture.profileBaseline), PNG);
    const manifest = JSON.parse(await readFile(fixture.manifestPath, "utf8"));
    assert.equal(manifest.surfaces.dashboard.status, "locked");
    assert.equal(manifest.surfaces.profile.status, "locked");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#2070 Y is explicit approval and every other answer is the safe no-change default", () => {
  assert.equal(approvesVisualBaselineReplacement("Y"), true);
  assert.equal(approvesVisualBaselineReplacement("y"), true);
  for (const answer of ["", "N", "n", "yes", "anything else"]) {
    assert.equal(approvesVisualBaselineReplacement(answer), false);
  }
});

test("#2070 successful WebMCP runs offer local approval while failed runs never reach the prompt", async () => {
  const runner = await read("scripts/run-webmcp-startup-uat.mjs");
  const lockScript = await read("scripts/lock-skin-visual-baseline.mjs");
  const prompt = runner.indexOf("await promptVisualBaselineReplacement()");
  const successReturn = runner.indexOf("return 0;", prompt);
  const catchBlock = runner.indexOf("} catch (error) {", successReturn);

  assert.ok(prompt >= 0 && successReturn > prompt && catchBlock > successReturn);
  assert.match(runner, /Replace ALL Skin V1 visual baselines with the screenshots from this run\? \[Y\/N\]/u);
  assert.match(runner, /runExistingScript\("scripts\/lock-skin-visual-baseline\.mjs", \["all", "--replace"\]\)/u);
  assert.match(runner, /Existing Skin V1 visual baselines were left unchanged/u);
  assert.match(lockScript, /surface === "all"/u);
  assert.match(lockScript, /process\.argv\.includes\("--replace"\)/u);
  assert.match(lockScript, /No GitHub commit or push was performed/u);
});
