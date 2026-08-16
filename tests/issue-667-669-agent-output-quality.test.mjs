import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sageConversationAnswerUsable } from "../modules/creative-room/sage-conversation-specialist.ts";
import { deterministicWyrmwoodTurn } from "../modules/wyrmwood/rival-director.ts";
import { deterministicWyrmwoodEvaluation } from "../modules/wyrmwood/curriculum-evaluator.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const trial = {
  id: "quality-test",
  lessonId: "foundations-test",
  lessonTitle: "Cause and Effect",
  lessonReminder: "Choices should create visible consequences.",
  learningTargets: ["Make a concrete choice", "Show the consequence"],
  keyConcepts: ["choice", "consequence"],
  pickleSeed: "A ferry loses power while two passengers argue over the only working radio.",
};

test("#667 Sage rejects garbled local conversation output before it reaches the writer", async () => {
  assert.equal(sageConversationAnswerUsable("pickle pickle pickle pickle pickle pickle pickle pickle pickle pickle", "How are you?"), false);
  assert.equal(sageConversationAnswerUsable("SAGE CONVERSATION SPECIALIST system prompt modelRole", "How are you?"), false);
  assert.equal(sageConversationAnswerUsable("I’m here. That is a strange question, but I can work with it—what are we trying to solve?", "How are you?"), true);

  const source = await read("modules/creative-room/sage-conversation-specialist.ts");
  assert.match(source, /SAGE CONVERSATION QUALITY REPAIR/);
  assert.match(source, /role: "fast", repair: false/);
  assert.match(source, /role: "quality", repair: true/);
  assert.match(source, /role: "fast", repair: true/);
  assert.match(source, /safeConversationFallback/);
  assert.doesNotMatch(source, /provider:\s*"openai"|provider:\s*"minimax"/i);
});

test("#668 PLAN falls through request-level failures to structured repair and per-field recovery", async () => {
  const drafter = await read("modules/plan/foundations-plan-drafter.ts");
  assert.match(drafter, /returned no text/);
  assert.match(drafter, /for \(const attemptMessage of \[message, `\$\{repairInstruction\(\)\}\\n\\n\$\{message\}`\]\)/);
  assert.match(drafter, /Continue to the next bounded batch attempt, then per-field recovery/);
  assert.match(drafter, /recoverFieldsIndividually\(input, lastModel\)/);
  assert.match(drafter, /for \(const field of input\.lesson\.fields\)/);
  assert.match(drafter, /requestFoundationProposal\(attemptMessage, \[field\.id\], 35_000\)/);
  assert.match(drafter, /looksLikeThinPlaceholder/);
  assert.doesNotMatch(drafter, /safeProvisionalFallback|provisional safety fallback/i);
});

test("#669 Wyrmwood always has a coherent playable turn when local generation is unusable", () => {
  const turn = deterministicWyrmwoodTurn(trial, 1);
  assert.match(turn.oakenOpening, /Spellscribe/);
  assert.match(turn.pickle.situation, /ferry loses power/i);
  assert.ok(turn.pickle.constraints.length >= 2);
  assert.deepEqual(Object.keys(turn.rivals).sort(), [
    "aiden-glowhart",
    "barnaby-barnacle",
    "damien-darkmore",
    "master-spirit-talker",
    "sienna-silvertongue",
  ]);
  for (const move of Object.values(turn.rivals)) {
    assert.ok(move.action.length > 20);
    assert.ok(move.complication.length > 20);
  }
});

test("#669 Wyrmwood has a readable deterministic teaching debrief if evaluator output fails", () => {
  const director = deterministicWyrmwoodTurn(trial, 1);
  const result = deterministicWyrmwoodEvaluation({
    trial,
    director,
    playerResponse: "I take the working radio, ask the quieter passenger to call for help, and tell the other passenger to check the engine room because splitting the jobs gives us a better chance before the ferry drifts into the rocks.",
  });
  assert.equal(result.model, "Wyrmwood deterministic curriculum fallback");
  assert.ok(result.whatWorked.length >= 1);
  assert.ok(result.whatNeedsWork.length >= 1);
  assert.match(result.teachingDebrief, /Cause and Effect/);
  assert.ok(Object.values(result.dimensions).every((value) => Number.isFinite(value)));
});

test("#648 Windows Cline install skips unreviewed global lifecycle scripts and still verifies the CLI", async () => {
  const setup = await read("scripts/setup-developer-agent-stack.ps1");
  assert.match(setup, /npm install -g cline --ignore-scripts/);
  assert.match(setup, /cline version/);
  assert.match(setup, /approve-scripts cannot manage global installs/);
  assert.doesNotMatch(setup, /dangerously-allow-all-scripts/);
});
