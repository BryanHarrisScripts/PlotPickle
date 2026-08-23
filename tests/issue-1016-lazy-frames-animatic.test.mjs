import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { deriveLazyFramesAnimatic, lazyFramesSlug } from "../lib/lazy-frames-core.mjs";

const root = path.resolve(import.meta.dirname, "..");
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("derived Lazy Frames specs use approved Build sequences without becoming canon", () => {
  const project = {
    id: "Story 42",
    metadata: { title: "The Test Story", updatedAt: "2026-08-18T12:00:00.000Z" },
    extensions: {
      buildSequenceApprovals: [
        { id: "approval-1", blockNumber: 1, miniBlockNumber: 1, sceneId: "scene-1", sourceIds: ["screen-1", "visual-1"], approvedAt: "2026-08-18T11:00:00.000Z" },
        { id: "approval-2", blockNumber: 2, miniBlockNumber: 3, sceneId: "scene-2", sourceIds: ["screen-2"], approvedAt: "2026-08-18T11:30:00.000Z" },
      ],
    },
    screenplay: {
      draftElements: [
        { id: "e1", type: "scene-heading", text: "INT. PICKLE HOUSE - NIGHT", blockNumber: 1, miniBlockNumber: 1, omitted: false },
        { id: "e2", type: "action", text: "A hidden door opens behind the bookcase.", blockNumber: 1, miniBlockNumber: 1, omitted: false },
      ],
    },
    blocks: [
      { title: "The Door", summary: "Discovery", visuals: [{ id: "frame-1", miniBlockNumber: 1, approvedImageVersionId: "v1", src: "local-frame.png", caption: "Hidden door", versions: [{ id: "v1", status: "approved", src: "local-frame.png" }] }] },
      { title: "The Crossing", summary: "The writer crosses the threshold.", visuals: [] },
    ],
  };

  const derived = deriveLazyFramesAnimatic(project);
  assert.equal(derived.spec.specVersion, 1);
  assert.equal(derived.spec.meta.id, "story-42-animatic");
  assert.equal(derived.spec.meta.width % 2, 0);
  assert.equal(derived.spec.meta.height % 2, 0);
  assert.equal(derived.spec.scenes.length, 2);
  assert.equal(derived.spec.scenes[0].type, "typography");
  assert.equal(derived.spec.outputs[0].path, "out/plotpickle-animatic.mp4");
  assert.equal(derived.provenance.canonicalAuthority, "PPF");
  assert.equal(derived.provenance.rules.derivedOnly, true);
  assert.equal(derived.provenance.rules.ppfMutationAllowed, false);
  assert.deepEqual(derived.provenance.scenes[0].sourceIds, ["screen-1", "visual-1"]);
  assert.equal(derived.provenance.scenes[0].approvedVisualCandidate.versionId, "v1");
  assert.equal(derived.provenance.scenes[0].materialization, "typography-fallback");
});

test("derived animatic identifiers are bounded safe slugs", () => {
  assert.equal(lazyFramesSlug(" Afterglow / V10 !!! "), "afterglow-v10");
  assert.equal(lazyFramesSlug("***", "fallback"), "fallback");
  assert.ok(lazyFramesSlug("x".repeat(200)).length <= 72);
});

test("Lazy Frames host adapter pins reviewed local install and has no arbitrary command surface", () => {
  const gateway = source("build/lazy-frames-gateway.ts");
  const registry = source("build/local-ai-gateway.ts");

  assert.match(gateway, /LAZY_FRAMES_VERSION = "0\.6\.3"/);
  assert.match(gateway, /\/api\/render\/lazy-frames/);
  assert.match(gateway, /isLocalRequest/);
  assert.match(gateway, /MAX_BODY_BYTES/);
  assert.match(gateway, /--ignore-scripts/);
  assert.match(gateway, /--no-audit/);
  assert.match(gateway, /--save-exact/);
  assert.match(gateway, /shell:\s*false/g);
  assert.match(gateway, /body\.approved !== true/);
  assert.match(gateway, /PREVIEW_PORT = 4287/);
  assert.match(gateway, /plotpickle-check\.json/);
  assert.match(gateway, /specSha256/);
  assert.match(gateway, /snapshot/);
  assert.match(gateway, /check/);
  assert.doesNotMatch(gateway, /\bnpx\b/);
  assert.doesNotMatch(gateway, /plugin\s+install/i);
  assert.doesNotMatch(gateway, /--live-cloud|ELEVENLABS|OPENAI_API_KEY/);
  assert.match(registry, /registerLazyFramesGateway/);
});

test("BUILD exposes writer-facing prepare validate preview and explicit render controls", () => {
  const ui = source("app/build-animatic-studio.tsx");
  const layout = source("app/layout.tsx");

  assert.match(ui, /Turn approved sequences into a motion preview/);
  assert.match(ui, /Install Lazy Frames/);
  assert.match(ui, /Prepare animatic/);
  assert.match(ui, /Validate/);
  assert.match(ui, /Open preview/);
  assert.match(ui, /Render MP4/);
  assert.match(ui, /window\.confirm/);
  assert.match(ui, /approved:\s*true/);
  assert.match(ui, /PPF remains the story source of truth/);
  assert.match(layout, /BuildAnimaticStudio/);
  assert.match(layout, /build-animatic-studio\.css/);
});

test("Lazy Frames Skill remains procedure-only and registered under host authority", () => {
  const skill = source(".agents/skills/lazy-frames-animatic/SKILL.md");
  const registry = JSON.parse(source("config/agent-skills.json"));
  const trust = JSON.parse(source("config/agent-skill-trust.json"));
  const entry = registry.skills.find((item) => item.id === "lazy-frames-animatic");
  const record = trust.records.find((item) => item.uri === "skill://plotpickle/lazy-frames-animatic");

  assert.ok(entry);
  assert.equal(entry.primaryWorker, "host");
  assert.equal(entry.localOnly, true);
  assert.ok(record);
  assert.equal(record.evalStatus, "covered");
  assert.match(skill, /does not grant process execution, installation, provider choice, credentials, external services, project writes, or render approval/i);
  assert.match(skill, /Do not install Lazy Frames plugins or external providers automatically/);
  assert.match(skill, /Do not activate cloud services or paid generation as a fallback/);
});

test("PlotPickle does not make Lazy Frames a required application dependency", () => {
  const packageJson = JSON.parse(source("package.json"));
  assert.equal(packageJson.dependencies?.["lazy-frames"], undefined);
  assert.equal(packageJson.devDependencies?.["lazy-frames"], undefined);
});
