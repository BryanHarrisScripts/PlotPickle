import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizeOutlineAgentAssessments,
  normalizeOutlineAssessmentRuns,
} from "../core/contracts/imported-screenplay-evidence/outline-agent-assessment.ts";

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

test("assessment run receipts are bounded, source-light and reject inconsistent history", () => {
  const valid = {
    version: 1,
    id: "outline-assessment-run-test",
    scope: "act",
    actNumber: 1,
    requestedBlockNumbers: [1, 2, 3, 4, 5, 6],
    completedBlockNumbers: [1, 2, 3, 4, 5, 6],
    changedBlockNumbers: [1, 3],
    status: "completed",
    assessedAt: "2026-09-25T11:43:00Z",
    acceptedStoryContentChanged: false,
    blockSummaries: [1, 2, 3, 4, 5, 6].map((blockNumber) => ({
      blockNumber,
      structuralState: "covered",
      citedPassageCount: 2,
      characterFindingCount: 1,
      miniBlockStates: ["supported", "supported", "partial", "supported"],
      model: "quality",
    })),
  };
  assert.equal(normalizeOutlineAssessmentRuns([valid]).length, 1);
  assert.equal(normalizeOutlineAssessmentRuns([{ ...valid, acceptedStoryContentChanged: true }]).length, 0);
  assert.equal(normalizeOutlineAssessmentRuns([{ ...valid, completedBlockNumbers: [1, 2] }]).length, 0);
  assert.equal(normalizeOutlineAssessmentRuns([{ ...valid, changedBlockNumbers: [7] }]).length, 0);
  assert.equal(normalizeOutlineAssessmentRuns([{ ...valid, blockSummaries: valid.blockSummaries.slice(0, 5) }]).length, 0);
  assert.equal(normalizeOutlineAssessmentRuns(Array.from({ length: 45 }, (_, index) => ({ ...valid, id: `run-${index}` }))).length, 40);
  assert.equal(JSON.stringify(normalizeOutlineAssessmentRuns([valid])).includes("screenplay"), false);
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
  assert.match(agent, /storyArchitectExecutionLabel\(result\)/);
  assert.match(agent, /runtimeProvider\?: string/);
  assert.match(agent, /computeSource\?: string/);
  assert.match(model, /currentOutlineAssessment\(project, block.number\)/);
  assert.match(board, /Assess Act \$\{act\} with Story Architect/);
  assert.match(board, /Screenplay passages behind this finding/);
  assert.match(board, /ASSESSED · Story Architect/);
  assert.match(board, /No accepted story content changed\./);
  assert.match(board, /Story Architect Assessment History/);
  assert.match(board, /outlineAssessmentRuns/);
  assert.match(board, /Reassess this Block/);
  assert.match(board, /saveAssessmentRun\(blockNumbers, completed, changedBlockNumbers, "completed"\)/);
  assert.match(board, /const previous = currentOutlineAssessment\(before, blockNumber\)/);
  assert.doesNotMatch(board, /<select\s/u);
  assert.match(script, /Storyboard handoff/);
  assert.match(storyboard, /outlineAssessment\.miniBlocks\[miniNumber - 1\]/);
  assert.match(evidence, /normalizeOutlineAgentAssessments\(source.outlineAssessments\)/);
  assert.match(evidence, /normalizeOutlineAssessmentRuns\(source.outlineAssessmentRuns\)/);
  assert.match(evidence, /outlineAssessmentRuns/);
});
