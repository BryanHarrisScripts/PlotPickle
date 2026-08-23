import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#667 Sage rejects weak conversation output and keeps bounded local-only recovery", async () => {
  const source = await read("modules/creative-room/sage-conversation-specialist.ts");
  assert.match(source, /function sageConversationAnswerUsable/);
  assert.match(source, /INTERNAL_MARKERS/);
  assert.match(source, /hasRunawayRepetition/);
  assert.match(source, /new Set\(words\)\.size \/ words\.length < 0\.42/);
  assert.match(source, /SAGE CONVERSATION QUALITY REPAIR/);
  assert.match(source, /role: "fast", repair: false/);
  assert.match(source, /role: "quality", repair: true/);
  assert.match(source, /role: "fast", repair: true/);
  assert.match(source, /safeConversationFallback/);
  assert.match(source, /Never expose a weak generation|Never expose a weak generation to the writer|never expose a weak generation/i);
  assert.doesNotMatch(source, /provider:\s*"openai"|provider:\s*"minimax"/i);
});

test("#668 PLAN falls through request-level failures to structured repair and per-field recovery", async () => {
  const drafter = await read("modules/plan/foundations-plan-drafter.ts");
  assert.match(drafter, /returned no text/);
  assert.match(drafter, /for \(const attemptMessage of \[message, `\$\{repairInstruction\(\)\}\\n\\n\$\{message\}`\]\)/);
  assert.match(drafter, /recover each field through Quality -> Fast locally/);
  assert.match(drafter, /recoverFieldsIndividually\(input, lastModel\)/);
  assert.match(drafter, /for \(const field of input\.lesson\.fields\)/);
  assert.match(drafter, /\{ role: "quality", message: compactMessage, timeoutMs: 35_000 \}/);
  assert.match(drafter, /\{ role: "fast", message: fastMessage, timeoutMs: 25_000 \}/);
  assert.match(drafter, /requestFoundationProposal\(attempt\.message, \[field\.id\], attempt\.timeoutMs, attempt\.role\)/);
  assert.match(drafter, /looksLikeThinPlaceholder/);
  assert.doesNotMatch(drafter, /safeProvisionalFallback|provisional safety fallback/i);
  assert.doesNotMatch(drafter, /provider:\s*"openai"|provider:\s*"minimax"/i);
});

test("#669 Wyrmwood Rival Director rejects garbled output, retries locally, and has a playable fallback", async () => {
  const director = await read("modules/wyrmwood/rival-director.ts");
  assert.match(director, /function textLooksGarbled/);
  assert.match(director, /REPAIR ONE WYRMWOOD PLAYER TURN/);
  assert.match(director, /role: "fast", repair: false/);
  assert.match(director, /role: "fast", repair: true/);
  assert.match(director, /role: "quality", repair: true/);
  assert.match(director, /export function deterministicWyrmwoodTurn/);
  assert.match(director, /Wyrmwood deterministic playable fallback/);
  for (const rival of ["aiden-glowhart", "damien-darkmore", "barnaby-barnacle", "master-spirit-talker", "sienna-silvertongue"]) {
    assert.match(director, new RegExp(rival));
  }
  assert.doesNotMatch(director, /provider:\s*"openai"|provider:\s*"minimax"/i);
});

test("#669 Wyrmwood evaluator rejects weak text and falls back to a readable deterministic teaching debrief", async () => {
  const evaluator = await read("modules/wyrmwood/curriculum-evaluator.ts");
  assert.match(evaluator, /function textLooksGarbled/);
  assert.match(evaluator, /REPAIR ONE WYRMWOOD CURRICULUM EVALUATION/);
  assert.match(evaluator, /export function deterministicWyrmwoodEvaluation/);
  assert.match(evaluator, /Wyrmwood deterministic curriculum fallback/);
  assert.match(evaluator, /Make one concrete choice, use something already established in the scene, and show the consequence/);
  assert.match(evaluator, /Keep recovery local and bounded/);
  assert.doesNotMatch(evaluator, /provider:\s*"openai"|provider:\s*"minimax"/i);
});

test("#648 Windows Cline install skips unreviewed global lifecycle scripts and still verifies the CLI", async () => {
  const setup = await read("scripts/setup-developer-agent-stack.ps1");
  assert.match(setup, /npm install -g cline --ignore-scripts/);
  assert.match(setup, /cline version/);
  assert.match(setup, /approve-scripts cannot manage global installs/);
  assert.doesNotMatch(setup, /dangerously-allow-all-scripts/);
});
