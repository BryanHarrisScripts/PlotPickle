import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeOutlineAgentAssessments } from "../core/contracts/outline-agent-assessment.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("agent proposals survive PPF normalization while malformed results do not", () => {
  const valid = {
    version: 1, blockNumber: 17, inputFingerprint: "12345678", assessedAt: "2026-09-23T00:00:00Z", model: "local",
    structural: { state: "unresolved", reason: "The sampled scenes show no attributable structural turn.", passageIds: [] },
    characters: [],
    miniBlocks: [1, 2, 3, 4].map((ordinal) => ({ ordinal, state: "partial", reason: "Scene evidence suggests the movement but does not establish the change.", passageIds: [], storyboardCue: "Which visible action carries this shift?" })),
  };
  assert.equal(normalizeOutlineAgentAssessments([valid]).length, 1);
  assert.equal(normalizeOutlineAgentAssessments([{ ...valid, miniBlocks: [] }]).length, 0);
  assert.equal(normalizeOutlineAgentAssessments([{ ...valid, inputFingerprint: "invalid" }]).length, 0);
  assert.equal(normalizeOutlineAgentAssessments([{ ...valid, characters: [{ characterId: "amy", state: "invented-state", reason: "Unsupported", passageIds: [] }] }]).length, 0);
  assert.equal(normalizeOutlineAgentAssessments([{ ...valid, miniBlocks: valid.miniBlocks.map((mini) => ({ ...mini, ordinal: 1 })) }]).length, 0);
});

test("Outline agent uses current screenplay, validates source citations and carries cues to Storyboard", async () => {
  const [agent, model, board, script, storyboard, evidence] = await Promise.all([
    read("modules/plan/outline-agent-assessment.ts"), read("modules/plan/outline-readiness.ts"),
    read("app/skin-v1/story-card-foundation-board.tsx"), read("app/skin-v1/act-written-story-board.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"), read("core/contracts/imported-screenplay-evidence/index.ts"),
  ]);
  assert.match(agent, /samplePassages\(passages\)/);
  assert.match(agent, /citations\(structural.passageIds, allowed/);
  assert.match(agent, /new Set\(cell.passageIds.filter/);
  assert.match(agent, /No finding was saved/);
  assert.match(agent, /inputFingerprint: outlineAssessmentFingerprint/);
  assert.match(agent, /agentId: "story-architect"/);
  assert.match(model, /currentOutlineAssessment\(project, block.number\)/);
  assert.match(board, /Assess Act \$\{act\} with Story Architect/);
  assert.match(board, /Screenplay passages behind this finding/);
  assert.doesNotMatch(board, /<select\s/u);
  assert.match(script, /Storyboard handoff/);
  assert.match(storyboard, /outlineAssessment\.miniBlocks\[miniNumber - 1\]/);
  assert.match(evidence, /normalizeOutlineAgentAssessments\(source.outlineAssessments\)/);
});
