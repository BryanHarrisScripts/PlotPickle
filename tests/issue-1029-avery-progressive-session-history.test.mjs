import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));
const sessionUi = "modules/library/ui/avery-session-history/index.tsx";

test("#1029 defines one explicit current Avery frontier that stops at BUILD", async () => {
  const config = await readJson("config/writer-in-residence.json");
  assert.equal(config.currentFrontier.id, "build");
  assert.equal(config.currentFrontier.label, "BUILD");
  assert.equal(config.currentFrontier.completionScreenId, "world-build");
  assert.deepEqual(config.currentFrontier.reviewScreenIds, ["learn","plan","foundations-build","world-learn","world-plan","world-build"]);
  assert.ok(config.currentFrontier.futureAreasExcluded.includes("feedback"));
  assert.ok(config.currentFrontier.futureAreasExcluded.includes("refine"));
});

test("#1029 retains each Avery run as an isolated local synthetic session", async () => {
  const [runner, gateway] = await Promise.all([read("scripts/run-writer-in-residence-v4.mjs"), read("build/writer-in-residence-gateway.ts")]);
  assert.match(runner, /writer-in-residence", sessionId/);
  assert.match(runner, /pluginData = path\.join\(artifactRoot, "browser-profile"\)/);
  assert.doesNotMatch(runner, /client\.call\("browser_evaluate"/);
  assert.match(gateway, /Avery session review is restricted to this computer/);
  assert.match(gateway, /sort\(\(a, b\) => b\.localeCompare\(a\)\)/);
});

test("#1029 Library always reserves exactly four Avery session cards newest first", async () => {
  const [config, dashboard, library, sessions] = await Promise.all([readJson("config/writer-in-residence.json"), read("modules/dashboard/ui/dashboard-workspace.tsx"), read("modules/library/ui/library-workspace.tsx"), read(sessionUi)]);
  assert.equal(config.sessionReview.dashboardSlots, 4);
  assert.equal(config.sessionReview.emptyArtwork, "/brand/plotpickle-ouroboros-v2.png");
  assert.doesNotMatch(dashboard, /AverySessionHistory/);
  assert.match(library, /AverySessionHistory/);
  assert.match(sessions, /const SLOT_COUNT = 4/);
  assert.match(sessions, /Array\.from\(\{ length: SLOT_COUNT \}/);
  assert.match(sessions, /sessions\[index\] \|\| null/);
  assert.match(sessions, /UNUSED SESSION SLOT/);
  assert.match(sessions, /SYNTHETIC AVERY SESSION/);
  assert.match(sessions, /Exactly four Library positions stay reserved/);
});

test("#1029 keeps POSTER and TRAILER pills under every slot and session-bound", async () => {
  const [sessions, gateway] = await Promise.all([read(sessionUi), read("build/writer-in-residence-gateway.ts")]);
  assert.match(sessions, /artifactButton\("POSTER", session\?\.posterUrl \|\| ""\)/);
  assert.match(sessions, /artifactButton\("TRAILER", session\?\.trailerUrl \|\| ""\)/);
  assert.match(sessions, /disabled=\{!url\}/);
  assert.match(gateway, /posterUrl: poster \? assetUrl\(sessionId, poster\) : ""/);
  assert.match(gateway, /trailerUrl: trailer \? assetUrl\(sessionId, trailer\) : ""/);
});

test("#1029 in-app review exposes journey evidence without mutating the owner's project", async () => {
  const sessions = await read(sessionUi);
  for (const phrase of ["Avery Writer-in-Residence session review","Story and persisted creative memory","Stages visited in order","Confusion, friction, needs and possible bugs","Screenshots and visual observations","Full Writer-in-Residence history","Back to Library"]) assert.ok(sessions.includes(phrase), `Missing Avery Library review copy: ${phrase}`);
  assert.match(sessions, /searchParams\.set\("workspace", "library"\)/);
  assert.doesNotMatch(sessions, /localStorage|sessionStorage|FOUNDATION_PROJECT_STORAGE_KEY|saveFoundationProject/);
});

test("#1029 remains complementary to #1030D while the progressive journey reaches World BUILD", async () => {
  const [config, runner] = await Promise.all([readJson("config/writer-in-residence.json"), read("scripts/run-writer-in-residence-v4.mjs")]);
  const ids = config.reviewScreens.map((screen) => screen.id);
  assert.ok(ids.includes("dashboard") && ids.includes("wyrmwood") && ids.includes("settings") && ids.includes(config.currentFrontier.completionScreenId));
  assert.match(runner, /for \(const mission of config\.reviewScreens\)/);
  assert.match(runner, /writerVisitedScreens\.add\(mission\.id\)/);
});
