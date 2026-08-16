import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Master Oaken-Vague is a separate Wyrmwood agent with its own playbook", async () => {
  const [runtime, playbook, sage] = await Promise.all([
    read("build/mastra-agent-runtime.ts"),
    read("agents/master-oaken-vague.md"),
    read("agents/sage-brinewick.md"),
  ]);

  assert.match(runtime, /MASTER_OAKEN_VAGUE_PLAYBOOK_PATH/);
  assert.match(runtime, /loadMasterOakenVaguePlaybook/);
  assert.match(runtime, /"wyrmwood-rival-director"/);
  assert.match(runtime, /Master Oaken-Vague playbook/);
  assert.match(playbook, /not Sage Brinewick/);
  assert.match(playbook, /deterministic Wyrmwood engine owns game truth/);
  assert.doesNotMatch(sage, /Master Oaken-Vague/);
});

test("the five fixed rivals preserve their exact trope identities", async () => {
  const [director, playbook] = await Promise.all([
    read("modules/wyrmwood/rival-director.ts"),
    read("agents/master-oaken-vague.md"),
  ]);
  const rivals = [
    ["Aiden Glowhart", "The Chosen One"],
    ["Damien Darkmore", "The Brooding Anti-Hero"],
    ["Barnaby Barnacle", "The Comic Relief"],
    ["Master Spirit-Talker", "The Cryptic Mentor"],
    ["Sienna Silvertongue", "The Charming Rogue"],
  ];
  for (const [name, trope] of rivals) {
    assert.match(director, new RegExp(name));
    assert.match(director, new RegExp(trope));
    assert.match(playbook, new RegExp(name));
  }
  assert.match(playbook, /prophecy, destiny, divine intervention/);
  assert.match(playbook, /rejects teamwork/);
  assert.match(playbook, /slapstick/);
  assert.match(playbook, /operationally unhelpful/);
  assert.match(playbook, /charm, bribery, bluffing, shortcuts/);
});

test("Fast remains the primary Rival Director while bounded local repair can use Quality", async () => {
  const [director, runtime] = await Promise.all([
    read("modules/wyrmwood/rival-director.ts"),
    read("build/mastra-agent-runtime.ts"),
  ]);

  assert.equal((director.match(/fetch\("\/api\/writing-assistant\/chat"/g) ?? []).length, 1);
  assert.match(director, /agentId: "wyrmwood-rival-director"/);
  assert.match(director, /modelRole: role/);
  assert.match(director, /role: "fast", repair: false/);
  assert.match(director, /role: "fast", repair: true/);
  assert.match(director, /role: "quality", repair: true/);
  assert.match(director, /Create a genuinely playable Pickle/);
  assert.match(director, /pickle: \{/);
  assert.match(director, /rivals,/);
  assert.match(runtime, /wyrmwoodRivalDirectorSchema/);
  assert.match(runtime, /structuredOutput/);
  assert.match(runtime, /sienna-silvertongue/);
});

test("the deterministic engine owns the five-Pickle player-turn loop", async () => {
  const [engine, contracts, ui] = await Promise.all([
    read("modules/wyrmwood/engine.ts"),
    read("modules/wyrmwood/contracts.ts"),
    read("modules/wyrmwood/ui/wyrmwood-workspace.tsx"),
  ]);

  assert.match(engine, /WYRMWOOD_PICKLES_PER_MATCH = 5/);
  assert.match(engine, /beginWyrmwoodRound/);
  assert.match(engine, /activateWyrmwoodRound/);
  assert.match(engine, /submitWyrmwoodPlayerTurn/);
  assert.match(engine, /continueWyrmwoodLoop/);
  assert.match(engine, /response\.split\(\/\\s\+\/\)\.length > 150/);
  assert.match(contracts, /schemaVersion: 3/);
  assert.match(contracts, /currentDirectorTurn/);
  assert.match(contracts, /turnHistory/);
  assert.match(ui, /Generate Pickle/);
  assert.match(ui, /Commit my move/);
  assert.match(ui, /Continue to Pickle/);
  assert.match(ui, /WYRMWOOD_PICKLES_PER_MATCH/);
});

test("Phase 2 Rival Director still cannot score or mutate persistent game truth", async () => {
  const [director, playbook, ui] = await Promise.all([
    read("modules/wyrmwood/rival-director.ts"),
    read("agents/master-oaken-vague.md"),
    read("modules/wyrmwood/ui/wyrmwood-workspace.tsx"),
  ]);

  assert.match(director, /Do not score, judge, award, alter Spotlight, grant coins or XP/);
  assert.match(playbook, /never claim to alter those values/);
  assert.match(playbook, /Do not judge the player's answer in this phase/);
  assert.match(ui, /Master Oaken-Vague/);
  assert.doesNotMatch(director, /spotlightDelta|brineCoinsEarned|xpGained/);
});
