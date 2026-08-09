import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { attachGeneratedVisual, createFullStoryProject, fullStorySummary } from "../lib/full-story-builder.mjs";
import { visualRequestPlan } from "../scripts/full-story-builder-agent.mjs";

const root = new URL("../", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");
const fixed = { now: "2026-08-09T12:00:00.000Z", jobId: "full-story-test" };

test("#542 creates a complete canonical 24/96 story with an exact 120-page structural target", () => {
  const project = createFullStoryProject({ title: "The Test Signal", protagonist: "Mara Vale", originalitySeed: "issue-542-a" }, fixed);
  const scenes = project.blocks.flatMap((block) => block.scenes);
  const minis = scenes.flatMap((scene) => scene.miniBlocks);
  const summary = fullStorySummary(project);

  assert.equal(project.schemaVersion, "1.7.0");
  assert.equal(project.blocks.length, 24);
  assert.equal(project.structure.sequences.length, 12);
  assert.equal(minis.length, 96);
  assert.equal(new Set(minis.map((mini) => mini.id)).size, 96);
  assert.equal(scenes.reduce((pages, scene) => pages + scene.pageEstimate, 0), 120);
  assert.deepEqual(summary, {
    projectId: project.id,
    title: "The Test Signal",
    targetPages: 120,
    estimatedPages: 120,
    blockCount: 24,
    miniBlockCount: 96,
    screenplayWordCount: project.extensions.fullStoryBuilder.screenplayWordCount,
    visualCount: 0,
  });
});

test("#542 fills story, world, character, block, scene, mini-block, screenplay, visual and production fields", () => {
  const project = createFullStoryProject({ premise: "A locally supplied original premise.", originalitySeed: "issue-542-fields" }, fixed);
  for (const field of ["premise", "logline", "theme", "antiTheme", "dramaticQuestion", "hook", "catalyst", "stakes", "ending", "notes"]) {
    assert.ok(project.story[field], `story.${field} should be populated`);
  }
  for (const field of ["ordinaryWorld", "newWorld", "period", "history", "cultures", "rules", "technology", "visualLanguage"]) {
    assert.ok(project.world[field], `world.${field} should be populated`);
  }
  assert.equal(project.characters.length, 4);
  assert.equal(project.world.locations.length, 6);
  assert.ok(project.characters.every((character) => character.want && character.need && character.arc && character.voice && character.arcMatrix.climaxChoice));
  assert.ok(project.blocks.every((block) => block.summary && block.goal && block.conflict && block.choice && block.action && block.consequence && block.storyboardDirection));
  assert.ok(project.blocks.every((block) => block.visuals.length === 4 && block.visuals.every((frame) => frame.prompt && frame.alt && frame.shot && frame.continuity)));
  assert.ok(project.blocks.flatMap((block) => block.scenes).every((scene) => scene.objective && scene.opposition && scene.reversal && scene.outcome));
  assert.ok(project.blocks.flatMap((block) => block.scenes.flatMap((scene) => scene.miniBlocks)).every((mini) => mini.objective && mini.resistance && mini.action && mini.revelation && mini.turn && mini.visualBeat && mini.dialogueIntention));
  assert.equal(project.screenplay.format, "fountain");
  assert.ok(project.screenplay.sourceText.split(/\s+/).length > 10_000);
  assert.ok(project.screenplay.draftElements.length > 700);
  assert.equal(project.production.shots.length, 96);
  assert.equal(project.production.breakdowns.length, 48);
  assert.equal(project.production.schedule.length, 12);
});

test("#542 records Learn evidence, original-draft boundaries and local provenance without secrets", () => {
  const project = createFullStoryProject({ projectOwner: "Test Writer", originalitySeed: "issue-542-rights" }, fixed);
  const extension = project.extensions.fullStoryBuilder;
  assert.equal(extension.workspace, "Learn");
  assert.equal(extension.workflow, "human-style-24-96");
  assert.equal(extension.textRoute, "deterministic-local");
  assert.equal(extension.humanReviewRequired, true);
  assert.ok(extension.learningEvidence.includes("pitch"));
  assert.ok(extension.learningEvidence.includes("24b-story-beats"));
  assert.ok(extension.learningEvidence.includes("responsible-ai"));
  assert.equal(project.rights.adaptationStatus, "original");
  assert.equal(project.rights.projectOwner, "Test Writer");
  assert.match(project.rights.aiProvenance[0].humanDecision, /human review/i);
  assert.doesNotMatch(JSON.stringify(project), /api[_-]?key|bearer\s|sk-[a-z0-9]/i);
});

test("#542 creates distinct projects from distinct originality seeds", () => {
  const first = createFullStoryProject({ originalitySeed: "first-original-story" }, fixed);
  const second = createFullStoryProject({ originalitySeed: "second-original-story" }, fixed);
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.extensions.fullStoryBuilder.originalitySeedHash, second.extensions.fullStoryBuilder.originalitySeedHash);
  assert.equal(first.rights.sourceWorkTitle, "");
  assert.equal(second.rights.sourceWorkAuthor, "");
});

test("#542 keeps local visuals safe and requires exact opt-in for any paid cloud route", () => {
  const local = visualRequestPlan({ imageRoute: "comfyui", comfyui: { reachable: true, imageNodesReady: true } }, { visualMode: "local-if-available", maximumVisuals: 4 });
  assert.deepEqual(local, { route: "comfyui", maximum: 4, allowed: true, reason: "Local ComfyUI is ready." });

  const unpaid = visualRequestPlan({ imageRoute: "openai" }, { visualMode: "local-if-available", maximumVisuals: 4 });
  assert.equal(unpaid.allowed, false);
  assert.match(unpaid.reason, /skipped without exact per-job consent/i);

  const statement = "I authorize up to 2 paid image requests for this Full Story Builder job.";
  const paid = visualRequestPlan({ imageRoute: "minimax" }, { visualMode: "paid-cloud", maximumVisuals: 2, paidVisualConsent: { acknowledged: true, maximumRequests: 2, confirmedAt: fixed.now, statement } });
  assert.equal(paid.allowed, true);
  assert.equal(paid.maximum, 2);

  const mismatched = visualRequestPlan({ imageRoute: "minimax" }, { visualMode: "paid-cloud", maximumVisuals: 2, paidVisualConsent: { acknowledged: true, maximumRequests: 4, confirmedAt: fixed.now, statement } });
  assert.equal(mismatched.allowed, false);
});

test("#542 attaches generated local visual candidates without approving them", () => {
  const project = createFullStoryProject({ originalitySeed: "issue-542-visual" }, fixed);
  assert.equal(attachGeneratedVisual(project, { blockNumber: 1, miniBlockNumber: 1, assetUrl: "/api/local-ai/assets/test.webp", route: "comfyui", createdAt: fixed.now }), true);
  const frame = project.blocks[0].visuals[0];
  assert.equal(frame.src, "/api/local-ai/assets/test.webp");
  assert.equal(frame.versions[0].status, "candidate");
  assert.equal(project.assets.assets[0].approvedVariationId, "");
  assert.equal(project.assets.assets[0].variations[0].approval, "unreviewed");
});

test("#542 launches a second agent beside the Windows server and preserves its metadata through canonical folders", async () => {
  const [batch, vite, gateway, worker, folder, packageJson] = await Promise.all([
    read("Start-PlotPickle.bat"), read("vite.config.ts"), read("build/full-story-builder-gateway.ts"), read("scripts/full-story-builder-agent.mjs"), read("lib/project-folder.ts"), read("package.json"),
  ]);
  assert.match(batch, /set "STORY_BUILDER_AGENT=scripts\\full-story-builder-agent\.mjs"/);
  assert.match(batch, /start "PlotPickle Full Story Builder" \/min node "%STORY_BUILDER_AGENT%" --server "%PLOTPICKLE_URL%"/);
  assert.ok(batch.indexOf("call :start_full_story_builder") < batch.indexOf('call "%VITE_CMD%"'));
  assert.match(vite, /fullStoryBuilderGateway\(\)/);
  assert.match(gateway, /persistentHome\(\), "full-story-builder", "jobs\.json"/);
  assert.match(gateway, /Recovered after the prior worker stopped/);
  assert.match(worker, /\/api\/local-projects\/save/);
  assert.doesNotMatch(worker, /\/generate\/text/);
  assert.match(folder, /projectExtensions: project\.extensions \?\? \{\}/);
  assert.match(folder, /extensions: manifestExtensions\.projectExtensions/);
  assert.equal(JSON.parse(packageJson).scripts["test:full-story-builder"], "node --test tests/issue-542-full-story-builder.test.mjs");
});

test("#542 Learn panel exposes the complete brief, local fallback and explicit cost consent", async () => {
  const [studio, panel] = await Promise.all([read("app/learning-studio.tsx"), read("app/full-story-builder-panel.tsx")]);
  assert.match(studio, /<FullStoryBuilderPanel \/>/);
  for (const label of ["Working title", "Premise", "Protagonist", "Story world / setting", "Protagonist's goal", "Opposition", "Theme / human question", "Visual language", "Project owner"]) assert.match(panel, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(panel, /Use local ComfyUI if it is ready; otherwise keep prompts/);
  assert.match(panel, /Paid-provider confirmation/);
  assert.match(panel, /Cloud text is never used by this agent/);
  assert.match(panel, /It does not replace the active story, connect GitHub, publish, send mail or approve generated material/);
  assert.match(panel, /window\.localStorage\.setItem\(PROJECT_KEY, JSON\.stringify\(result\.project\)\)/);
  assert.match(panel, /requestPlotPickleConfirmation/);
  assert.doesNotMatch(panel, /window\.confirm/);
});
