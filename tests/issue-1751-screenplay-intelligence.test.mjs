import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (filePath) => readFile(new URL(filePath, root), "utf8");

async function contract() {
  const raw = (await source("lib/projects/screenplay/screenplay-intelligence.ts")).replace(/\r\n?/g, "\n");
  const withoutImports = raw.replace(/import[\s\S]*?;\n/g, "");
  const compiled = stripTypeScriptTypes(withoutImports, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}

function mini(number, characterId = "") {
  return {
    id: `mini-${number}`,
    number,
    label: `Mini ${number}`,
    function: "",
    purpose: "",
    characterId,
    objective: characterId ? "Protect the witness" : "",
    resistance: characterId ? "The route is exposed" : "",
    action: characterId ? "Moves the witness through the service corridor" : "",
    revelation: characterId ? "The ally leaked the route" : "",
    turn: characterId ? "Trust collapses" : "",
    visualBeat: "",
    dialogueIntention: "",
    entryState: "",
    exitState: "",
    setup: "",
    payoff: "",
    estimatedSeconds: 60,
    beatTarget: 4,
    shotTarget: 16,
    notes: "",
    shortScenes: [],
  };
}

function scene(blockNumber, characterId = "", locationIds = []) {
  return {
    id: `scene-${blockNumber}`,
    number: 1,
    title: `Scene ${blockNumber}`,
    sceneType: "action",
    purpose: "Protect the witness while trust fractures",
    entryCondition: "",
    exitCondition: "",
    characterIds: characterId ? [characterId] : [],
    locationIds,
    charactersEntering: [],
    charactersLeaving: [],
    objective: characterId ? "Protect the witness" : "",
    opposition: characterId ? "A surveillance team closes the exits" : "",
    conflict: characterId ? "Safety requires trusting the suspected ally" : "",
    action: characterId ? "Crosses the service corridor" : "",
    reversal: characterId ? "The escape route was leaked" : "",
    turn: characterId ? "The ally becomes a suspect" : "",
    resolution: "",
    outcome: characterId ? "They escape but no longer trust each other" : "",
    estimatedSeconds: 180,
    pageEstimate: 3,
    order: 0,
    threadIds: [],
    status: "outline",
    revisionColour: "none",
    locked: false,
    miniBlocks: [mini(1, characterId), mini(2), mini(3), mini(4)],
  };
}

function block(number, characterId = "", locationIds = []) {
  return {
    id: `block-${number}`,
    number,
    act: Math.floor((number - 1) / 6) + 1,
    sequenceNumber: Math.floor((number - 1) / 2) + 1,
    targetMinutes: 5,
    title: `Block ${number}`,
    purpose: "",
    summary: "",
    characterIds: characterId ? [characterId] : [],
    locationIds,
    goal: characterId ? "Reach safety" : "",
    conflict: characterId ? "Trust makes the escape dangerous" : "",
    choice: characterId ? "Trust the ally for one more move" : "",
    action: characterId ? "Take the hidden route" : "",
    consequence: characterId ? "The route succeeds but exposes a betrayal" : "",
    emotionalTurn: characterId ? "Reliance becomes suspicion" : "",
    audienceExpectation: "",
    pickleTurn: "",
    setup: "",
    payoff: characterId ? "The ally's access becomes evidence" : "",
    scriptExcerpt: "",
    storyboardDirection: "",
    notes: "",
    scenes: [scene(number, characterId, locationIds)],
    visuals: [],
  };
}

function project() {
  const character = {
    id: "char-lead",
    name: "Mara Vale",
    role: "Protagonist",
    pronouns: "she/her",
    description: "A careful investigator",
    want: "Protect the witness",
    need: "Risk honest trust",
    ghost: "A former partner sold her out",
    fatalFlaw: "Controls every contingency",
    strengths: "Observant and persistent",
    arc: "Learns to distinguish trust from surrender",
    voice: "Precise",
    arcMatrix: {
      startingState: "Closed and controlling",
      consciousWant: "Keep everyone safe",
      underlyingNeed: "Accept chosen vulnerability",
      protectiveLie: "Depending on anyone gives them power to destroy you",
      emergingTruth: "Trust can be chosen without surrendering judgment",
      midpointShift: "",
      crisisChoice: "",
      climaxChoice: "",
      endingState: "",
      relationshipImpact: "",
      checkpoints: [{
        id: "cp-6",
        kind: "threshold",
        blockNumber: 6,
        sceneId: "scene-6",
        belief: "The ally will eventually betray me",
        strategy: "Keep the real route secret",
        pressure: "The witness can only escape through the ally's access",
        choice: "Share part of the route",
        consequence: "The escape works but evidence points back to the ally",
        evidence: "Mara deletes the shared route immediately after use",
      }],
    },
    image: "",
    relationships: [],
  };
  return {
    schemaVersion: "1.7.0",
    id: "project-1751",
    metadata: { title: "Trust Line", subtitle: "", format: "Feature screenplay", targetMinutes: 120, genre: "Thriller", tone: "Grounded", status: "Draft", createdAt: "", updatedAt: "" },
    story: { premise: "", logline: "", theme: "Trust", antiTheme: "Isolation", dramaticQuestion: "Can Mara trust without surrendering judgment?", hook: "", catalyst: "", stakes: "", ending: "Mara gives the ally the final choice.", notes: "" },
    development: {
      ghost: { centralWound: "Betrayal", origin: "A trusted partner sold Mara out during her first major case", lie: "Trust creates weakness", trigger: "", presentPattern: "", truth: "Trust can be chosen with boundaries" },
      foundations: { protagonist: "Mara Vale", objective: "", opposition: "", urgency: "", storyEngine: "", transformation: "", endingProof: "Mara shares decisive information and lets the ally choose what to do with it." },
    },
    screenplay: { draftElements: [], productionDraft: { mode: "writer" } },
    characters: [character],
    blocks: Array.from({ length: 24 }, (_, index) => block(index + 1, index === 5 ? character.id : "", index === 5 ? ["loc-office"] : [])),
    world: {
      locations: [
        { id: "loc-office", name: "Operations Office", description: "A monitored secure office with glass walls", image: "" },
        { id: "loc-corridor", name: "Service Corridor", description: "A narrow surveillance corridor with exposed exits and maintenance doors", image: "corridor.png" },
        { id: "loc-garden", name: "Winter Garden", description: "A public garden with open sightlines", image: "" },
      ],
    },
    extensions: { preservedPlugin: { version: 3 } },
  };
}

test("#1751 stores controlling idea as an additive PPF extension and keeps 24/96 canon untouched", async () => {
  const api = await contract();
  const original = project();
  const updated = api.withControllingIdea(original, { value: "Trust restores agency", cause: "Mara chooses bounded vulnerability" }, "2026-09-08T03:20:00.000Z");

  assert.equal(original.extensions.screenplayIntelligence, undefined);
  assert.deepEqual(updated.extensions.preservedPlugin, { version: 3 });
  assert.equal(updated.extensions.screenplayIntelligence.version, 1);
  assert.equal(updated.extensions.screenplayIntelligence.controllingIdea.statement, "Trust restores agency because Mara chooses bounded vulnerability");
  assert.equal(updated.blocks, original.blocks);
  assert.equal(updated.story.theme, "Trust");

  const lens = api.buildControllingIdeaLens(updated);
  assert.equal(lens.status, "grounded");
  assert.deepEqual(lens.missing, []);
  assert.deepEqual(lens.candidateEvidenceBlocks, [6]);
});

test("#1751 treats the existing Arc Matrix as PlotPickle's native misbelief model", async () => {
  const api = await contract();
  const lens = api.buildCharacterMisbeliefLens(project(), "char-lead");
  assert.ok(lens);
  assert.equal(lens.misbelief, "Depending on anyone gives them power to destroy you");
  assert.equal(lens.origin, "A former partner sold her out");
  assert.equal(lens.truth, "Trust can be chosen without surrendering judgment");
  assert.equal(lens.pressurePoints.length, 1);
  assert.equal(lens.pressurePoints[0].blockNumber, 6);
  assert.deepEqual(lens.missing, []);
});

test("#1751 audits a character across the existing 24 Blocks without creating another structure", async () => {
  const api = await contract();
  const audit = api.auditCharacterPerspective(project(), "char-lead");
  assert.ok(audit);
  assert.equal(audit.rows.length, 24);
  assert.equal(audit.presentBlocks, 1);
  assert.equal(audit.activeBlocks, 1);
  assert.equal(audit.challengedBlocks, 1);
  assert.equal(audit.changedBlocks, 1);
  assert.deepEqual(audit.rows[5].gaps, []);
  assert.deepEqual(audit.rows[0].gaps, ["absent"]);
  assert.ok(audit.gapBlocks.includes(1));
  assert.ok(!audit.gapBlocks.includes(6));
});

test("#1751 challenges scene location only with canonical alternatives and never applies one automatically", async () => {
  const api = await contract();
  const input = project();
  const before = structuredClone(input.blocks[5].scenes[0].locationIds);
  const challenge = api.challengeSceneLocation(input, "scene-6", 2);
  assert.ok(challenge);
  assert.equal(challenge.currentLocationIds[0], "loc-office");
  assert.equal(challenge.candidates.length, 2);
  assert.equal(challenge.candidates[0].locationId, "loc-corridor");
  assert.equal(challenge.candidates[0].source, "canonical-world");
  assert.equal(challenge.candidates[0].requiresHumanAcceptance, true);
  assert.deepEqual(input.blocks[5].scenes[0].locationIds, before);
  assert.ok(challenge.candidates.every((candidate) => candidate.locationId !== "loc-office"));
});

test("#1751 spec readiness is deterministic, advisory, and catches screenplay-page problems", async () => {
  const api = await contract();
  const input = project();
  input.screenplay.draftElements = [
    { id: "h1", type: "scene-heading", text: "WAREHOUSE - NIGHT", omitted: false },
    { id: "a1", type: "action", text: "WE SEE Mara cross the room. She realizes the partner knows that she has hidden the evidence. " + "She keeps moving through the crowded warehouse while every guard watches the exits and the witness struggles to stay out of sight. ".repeat(3), omitted: false },
    { id: "c1", type: "character", text: "Mara", omitted: false },
    { id: "p1", type: "parenthetical", text: "quietly while trying not to panic at all", omitted: false },
    { id: "d1", type: "dialogue", text: "word ".repeat(75), omitted: false },
  ];
  input.screenplay.productionDraft.mode = "production";

  const report = api.scanSpecReadiness(input);
  const kinds = report.issues.map((issue) => issue.kind);
  assert.equal(report.elementCount, 5);
  assert.ok(report.warningCount >= 4);
  for (const kind of ["scene-heading", "camera-direction", "interior-thought", "action-density", "character-cue", "parenthetical-density", "dialogue-density", "production-mode"]) {
    assert.ok(kinds.includes(kind), `expected ${kind}`);
  }
  assert.ok(report.score < 90);
  assert.notEqual(report.status, "ready-to-review");

  const repeated = api.scanSpecReadiness(structuredClone(input));
  assert.deepEqual(repeated, report);
});

test("#1751 implementation uses PlotPickle wording and does not embed third-party screenplay systems", async () => {
  const implementation = await source("lib/projects/screenplay/screenplay-intelligence.ts");
  assert.doesNotMatch(implementation, /Save the Cat|McKee|Snyder|Field|jtydhr88|screenwriting-skills/i);
  assert.match(implementation, /SCREENPLAY_INTELLIGENCE_EXTENSION/);
  assert.match(implementation, /requiresHumanAcceptance: true/);
  assert.match(implementation, /project\.blocks/);
});
