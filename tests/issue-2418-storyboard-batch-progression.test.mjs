import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  storyboardFrameBriefs,
  storyboardPositionsForScope,
} from "../app/_components/storyboard/storyboard-frame-planner.ts";
import { storyboardFramePrompt } from "../app/_components/storyboard/storyboard-editorial-model.ts";

const ren = {
  id: "ren",
  name: "Ren",
  pronouns: "he/him",
  role: "Protagonist",
  description: "A grieving scientist trying to reconnect with life.",
  truthClaims: ["Ren carries the loss of Sarah and Claire."],
  approvedVisualRefs: ["/api/local-ai/assets/ren-approved.webp"],
  identityLock: {
    characterId: "ren",
    status: "locked",
    version: 3,
    approvedPrompt: "Locked Ren identity prompt.",
  },
};

const amy = {
  id: "amy",
  name: "Amy",
  pronouns: "she/her",
  role: "Mentor and narrator",
  description: "A sentient guide who challenges and protects Ren.",
  truthClaims: ["Amy narrates the opening movement."],
  approvedVisualRefs: [],
  identityLock: null,
};

test("#2418 maps selected, five-frame and full Mini-Block scopes deterministically", () => {
  assert.deepEqual(storyboardPositionsForScope(7, "single"), [7]);
  assert.deepEqual(storyboardPositionsForScope(7, "group5"), [6, 7, 8, 9, 10]);
  assert.deepEqual(storyboardPositionsForScope(1, "group5"), [1, 2, 3, 4, 5]);
  assert.deepEqual(storyboardPositionsForScope(24, "group5"), [21, 22, 23, 24, 25]);
  assert.deepEqual(storyboardPositionsForScope(12, "all25"), Array.from({ length: 25 }, (_, index) => index + 1));
});

test("#2418 distributes screenplay evidence in source order across 25 distinct frame briefs", () => {
  const passages = [
    { id: "p01", type: "action", text: "Amy turns to face Ren at BBT." },
    { id: "p02", type: "dialogue", text: "Amy tells Ren the board has made its decision." },
    { id: "p03", type: "action", text: "Ren absorbs the disappointment in silence." },
    { id: "p04", type: "action", text: "Ren enters his dark home office and studies his stopped watch." },
    { id: "p05", type: "action", text: "Amy pauses over a photograph of Ren and Sarah." },
  ];
  const briefs = storyboardFrameBriefs({
    positions: Array.from({ length: 25 }, (_, index) => index + 1),
    passages,
    characters: [ren, amy],
  });

  assert.equal(briefs.length, 25);
  assert.equal(new Set(briefs.map((brief) => brief.storyFunction)).size, 25);
  assert.equal(new Set(briefs.map((brief) => brief.visibleChange)).size, 25);
  assert.equal(briefs[0].evidence[0].id, "p01");
  assert.equal(briefs[24].evidence.at(-1).id, "p05");

  const firstPassageNumbers = briefs.map((brief) => Number(brief.evidence[0].id.slice(1)));
  for (let index = 1; index < firstPassageNumbers.length; index += 1) {
    assert.ok(firstPassageNumbers[index] >= firstPassageNumbers[index - 1]);
  }
});

test("#2418 injects explicit character truth and locked approved references only when applicable", () => {
  const [renBrief] = storyboardFrameBriefs({
    positions: [1],
    passages: [{ id: "p01", type: "action", text: "Ren steps into the dark office and looks at his watch." }],
    characters: [ren, amy],
  });
  assert.deepEqual(renBrief.characters.map((character) => character.id), ["ren"]);
  assert.match(renBrief.characterTruth, /Ren; pronouns he\/him; role Protagonist/u);
  assert.deepEqual(renBrief.approvedVisualRefs, ["/api/local-ai/assets/ren-approved.webp"]);
  assert.equal(renBrief.identityMode, "approved-reference");
  assert.equal(renBrief.identityLocks[0].approvedPrompt, "Locked Ren identity prompt.");

  const [amyBrief] = storyboardFrameBriefs({
    positions: [1],
    passages: [{ id: "p01", type: "action", text: "Amy studies the photograph in silence." }],
    characters: [ren, amy],
  });
  assert.match(amyBrief.characterTruth, /Amy; pronouns she\/her/u);
  assert.deepEqual(amyBrief.approvedVisualRefs, []);
  assert.equal(amyBrief.identityMode, "exploratory");
});

test("#2418 final prompt carries frame-specific story function, character truth and identity mode", () => {
  const [brief] = storyboardFrameBriefs({
    positions: [4],
    passages: [{ id: "p04", type: "action", text: "Ren studies the stopped watch in the dark office." }],
    characters: [ren],
  });
  const prompt = storyboardFramePrompt({
    title: "Afterglow",
    blockNumber: 1,
    miniBlockNumber: 1,
    position: 4,
    scene: "Ren's home office",
    beat: "",
    shot: "",
    source: brief.evidenceSummary,
    storyFunction: brief.storyFunction,
    visibleChange: brief.visibleChange,
    characterTruth: brief.characterTruth,
    identityMode: brief.identityMode,
    continuityIn: brief.continuityIn,
    continuityOut: brief.continuityOut,
  });
  assert.match(prompt, /Frame-brief story function:/u);
  assert.match(prompt, /Required visible progression:/u);
  assert.match(prompt, /Canonical character truth.*Ren; pronouns he\/him/u);
  assert.match(prompt, /locked approved character visual references are attached/u);
  assert.match(prompt, /Position-specific screenplay evidence: Ren studies the stopped watch/u);
});

test("#2418 Storyboard UI submits separate local WebP requests with 1 5 25 scope and character grounding", async () => {
  const source = await readFile(new URL("../app/_components/storyboard/storyboard-readiness-workspace.tsx", import.meta.url), "utf8");
  assert.match(source, /useState<StoryboardGenerationScope>\("group5"\)/u);
  assert.match(source, /Selected frame/u);
  assert.match(source, /Current group of 5/u);
  assert.match(source, /All 25 frames/u);
  assert.match(source, /I approve this image generation request through my configured provider/u);
  assert.match(source, /storyboardPositionsForScope\(promptPosition, generationScope\)/u);
  assert.match(source, /for \(let index = 0; index < positions\.length; index \+= 1\)/u);
  assert.match(source, /approvedCharacterReferences: plan\.brief\.approvedVisualRefs/u);
  assert.match(source, /identityLocks: plan\.brief\.identityLocks/u);
  assert.match(source, /frameNumber: position/u);
  assert.match(source, /workflow: "storyboard-frame-webp-v2"/u);
  assert.match(source, /reviewState: "draft"/u);
});
