import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PLOTPICKLE_MOUNT_GATE, renderedAreaIsReady } from "../scripts/creative-uat/render-readiness.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const learnArea = {
  id: "foundations-learn",
  label: "Foundations and LEARN",
  route: "/?workspace=learn",
  requiredTerms: ["Foundations", "Learn"],
  minimumTextLength: 1200,
};

test("focused live UAT treats the 19-character PlotPickle mount gate as not ready", () => {
  assert.equal(PLOTPICKLE_MOUNT_GATE.length, 19);
  assert.equal(renderedAreaIsReady(learnArea, {
    bodyText: PLOTPICKLE_MOUNT_GATE,
    bodyLength: PLOTPICKLE_MOUNT_GATE.length,
  }), false);
});

test("focused live UAT waits for the real area contract instead of weakening it", () => {
  assert.equal(renderedAreaIsReady(learnArea, {
    bodyText: `Foundations Learn ${"story craft ".repeat(120)}`,
    bodyLength: 1500,
  }), true);
  assert.equal(renderedAreaIsReady(learnArea, {
    bodyText: `Foundations ${"story craft ".repeat(120)}`,
    bodyLength: 1500,
  }), false);
  assert.equal(renderedAreaIsReady(learnArea, {
    bodyText: "Foundations Learn",
    bodyLength: 17,
  }), false);
});

test("the live runner polls readiness before snapshot and rendered assertions", async () => {
  const source = await read("scripts/run-uat-autopilot.mjs");
  assert.match(source, /waitForRenderedArea\(client, area\)/);
  assert.doesNotMatch(source, /await delay\(650\)/);
  assert.ok(source.indexOf("waitForRenderedArea(client, area)") < source.indexOf('browser_snapshot'));
});

test("Windows developer setup prefers Git Bash and rejects the System32 WSL launcher", async () => {
  const source = await read("scripts/setup-developer-agent-stack.ps1");
  const candidateIndex = source.indexOf('"C:\\Program Files\\Git\\bin\\bash.exe"');
  const pathLookupIndex = source.indexOf("Get-Command bash");
  assert.ok(candidateIndex >= 0);
  assert.ok(pathLookupIndex > candidateIndex);
  assert.match(source, /Windows\\System32\\bash\\?\.exe|Windows\\System32\\bash\.exe/i);
  assert.match(source, /Git Bash was not found/i);
  assert.match(source, /Git Bash \.{3,}/);
});

test("focused Startup UAT owns the hydration and Git Bash regression", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const startup = registry.areas.find((area) => area.id === "startup");
  assert.ok(startup);
  assert.ok(startup.tests.includes("tests/issue-645-uat-readiness-git-bash.test.mjs"));
});
