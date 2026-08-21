import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#1030D Dashboard derives writer-facing frontier status from the canonical progression engine", async () => {
  const [frontier, guided, dashboard] = await Promise.all([
    read("modules/dashboard/visual-writer-frontier.ts"),
    read("core/progression/guided-progression.ts"),
    read("modules/dashboard/ui/dashboard-workspace.tsx"),
  ]);

  assert.match(frontier, /deriveGuidedCreationProgression\(curriculum, project\)/);
  assert.doesNotMatch(frontier, /VISUAL_WRITER_GROUP_ORDER|GUIDED_CURRICULUM_GROUPS\s*=/);
  assert.match(frontier, /frontierLabel = progression\.world\.unlocked \? "Foundations \+ World" : "Foundations only"/);
  assert.match(frontier, /reachedImplementedBuildFrontier = progression\.world\.complete/);
  assert.match(frontier, /project\.build\.foundations\.acceptedVisualArtifactIds/);
  assert.match(frontier, /project\.build\.world\.acceptedVisualArtifactIds/);
  assert.match(guided, /readonly nextAction: GuidedNextAction/);
  assert.match(dashboard, /deriveVisualWriterFrontierStatus/);
  assert.match(dashboard, /aria-label="Visual Writer current frontier"/);
  assert.match(dashboard, /Current Visual Writer state/);
  assert.match(dashboard, /<strong>Frontier:<\/strong>/);
  assert.match(dashboard, /<strong>Artifacts:<\/strong>/);
  assert.match(dashboard, /<strong>Next:<\/strong>/);
  assert.match(dashboard, /<strong>Current stopping point:<\/strong>/);
});

test("#1030D Avery reviews the implemented Foundations plus World frontier through visible UI routes", async () => {
  const config = await readJson("config/writer-in-residence.json");
  const ids = config.reviewScreens.map((screen) => screen.id);
  assert.deepEqual(ids, [
    "dashboard",
    "learn",
    "plan",
    "foundations-build",
    "world-learn",
    "world-plan",
    "world-build",
    "wyrmwood",
    "settings",
  ]);
  assert.equal(config.schemaVersion, 3);
  assert.ok(config.persona.behaviour.some((item) => /locked.*prerequisite.*bypass/i.test(item)));
  assert.ok(config.persona.behaviour.some((item) => /provisional.*accepted/i.test(item)));
  assert.ok(config.journeyGoals.some((item) => /Dashboard.*current Visual Writer group.*workspace.*frontier.*artifact.*next action/i.test(item)));
  assert.ok(config.journeyGoals.some((item) => /World LEARN.*PLAN.*BUILD/i.test(item)));
  assert.ok(config.journeyGoals.some((item) => /Visual Narrative Wireframe.*provenance\/history.*accept\/reject\/regenerate/i.test(item)));
  assert.equal(config.reviewScreens.some((screen) => /character|theme|structure/i.test(`${screen.id} ${screen.route}`)), false);
});

test("#1030D uses the existing Writer-in-Residence UI-only loop and evidence model rather than a second journey engine", async () => {
  const runner = await read("scripts/run-writer-in-residence-v4.mjs");
  assert.match(runner, /for \(const mission of config\.reviewScreens\)/);
  assert.match(runner, /writerVisitedScreens\.add\(mission\.id\)/);
  assert.match(runner, /areaCounts\[mission\.id\] \+= 1/);
  assert.match(runner, /for \(const screen of config\.reviewScreens\)/);
  assert.match(runner, /safeScreenshot\(client, toolMap, `writer-review-\$\{screen\.id\}`/);
  assert.match(runner, /journeyCoverage:/);
  assert.match(runner, /writerVisitedScreens: journey\.writerVisitedScreens/);
  assert.match(runner, /visualReview,/);
  assert.match(runner, /diary,/);
  assert.match(runner, /finishedReason,/);
  assert.doesNotMatch(runner, /client\.call\("browser_evaluate"/);
  assert.match(runner, /Do not invent defects or request source, DOM, localStorage/);
  assert.doesNotMatch(runner, /localStorage\.(?:getItem|setItem|removeItem)|sessionStorage\.(?:getItem|setItem|removeItem)/);
});

test("#1030D Avery can inspect actual wireframe controls and provenance when BUILD is available, while locked states stay truthful", async () => {
  const [foundationsBuild, worldBuild] = await Promise.all([
    read("modules/build/ui/foundations-build-workspace.tsx"),
    read("modules/build/ui/world-build-workspace.tsx"),
  ]);
  assert.match(foundationsBuild, /Visual Narrative Wireframe · Foundations only/);
  assert.match(foundationsBuild, />Accept<|>Unaccept</);
  assert.match(foundationsBuild, />Regenerate frame</);
  assert.match(foundationsBuild, />Reject</);
  assert.match(foundationsBuild, /Finish PLAN before BUILD/);
  assert.match(worldBuild, /Foundations \+ World/);
  assert.match(worldBuild, /retainedFoundationFrames/);
  assert.match(worldBuild, /parentArtifactId/);
  assert.match(worldBuild, />Accept change<|>Unaccept</);
  assert.match(worldBuild, />Regenerate change</);
  assert.match(worldBuild, />Reject</);
  assert.match(worldBuild, /locked/i);
});

test("#1030D stops truthfully at the implemented World frontier and leaves future work gated", async () => {
  const [frontier, guided, config] = await Promise.all([
    read("modules/dashboard/visual-writer-frontier.ts"),
    read("core/progression/guided-progression.ts"),
    readJson("config/writer-in-residence.json"),
  ]);
  assert.match(frontier, /implemented Visual Writer frontier ends after accepted World BUILD/);
  assert.match(frontier, /Character is next in the canonical progression/);
  assert.match(guided, /groupId: "character"/);
  assert.match(guided, /workspace: null/);
  assert.equal(config.allowedRoutes.some((route) => /character|theme|structure/i.test(route)), false);
});
