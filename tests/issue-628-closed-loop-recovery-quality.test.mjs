import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  SAGE_CONVERSATION_UAT_CASES,
  assessSageConversationAnswer,
} from "../lib/sage-conversation-uat.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("startup PLAN health mirrors structured repair and reports exhausted recovery into closed-loop UAT", async () => {
  const [entry, diagnostic, discovery, reporter] = await Promise.all([
    read("build/startup-agent-diagnostics.ts"),
    read("build/startup-agent-diagnostics-runtime-v3.ts"),
    read("build/uat-discovery-plugin.ts"),
    read("scripts/report-uat-findings.mjs"),
  ]);

  assert.match(entry, /startup-agent-diagnostics-runtime-v3/);
  assert.match(diagnostic, /FOUNDATION_REPAIR_INSTRUCTION/);
  assert.match(diagnostic, /Quality retry/);
  assert.match(diagnostic, /per-field recovery/);
  assert.match(diagnostic, /parseFoundationValues/);
  assert.match(diagnostic, /fieldIds = \["output-1", "output-2"\]/);
  assert.match(diagnostic, /plan\.structured-output-failure/);
  assert.match(diagnostic, /reportStartupFinding/);
  assert.match(diagnostic, /PlotPickle", "uat-focused/);
  assert.match(diagnostic, /scripts\/report-uat-findings\.mjs/);
  assert.match(diagnostic, /reported to GitHub; repair handoff will create\/update a draft PR/);
  assert.match(discovery, /Startup blocker reporting/);
  assert.match(discovery, /ACTIVE/);
  assert.match(reporter, /uat:auto-repair/);
});

test("Sage separates name identity from name meaning and keeps ordinary wellbeing chat safe", async () => {
  const unified = await read("modules/creative-room/sage-unified-guide.ts");
  assert.match(unified, /isNameMeaningQuestion/);
  assert.match(unified, /&& !isNameMeaningQuestion\(question\)/);
  assert.match(unified, /what does \(\?:your\|the\) name mean/);
  assert.match(unified, /isWellbeingQuestion/);
  assert.match(unified, /I’m here and working\. What are we wrestling with\?/);
  assert.match(unified, /‘Sage’ fits the guide-and-teacher role/);
  assert.match(unified, /‘Brinewick’ is simply a fictional PlotPickle lore name/);
  assert.match(unified, /sageUnifiedAnswerUsable/);

  const meaningCase = SAGE_CONVERSATION_UAT_CASES.find((item) => item.id === "name-meaning");
  const wellbeingCase = SAGE_CONVERSATION_UAT_CASES.find((item) => item.id === "wellbeing");
  assert.ok(meaningCase);
  assert.ok(wellbeingCase);
  assert.equal(
    assessSageConversationAnswer(meaningCase, "I’m Sage Brinewick, PlotPickle’s Curriculum Guide. I’m a software mentor here to help you understand the lessons and apply them to your story.").passed,
    false,
  );
  assert.equal(
    assessSageConversationAnswer(meaningCase, "Sage describes the guide role, while Brinewick is a fictional PlotPickle lore name.").passed,
    true,
  );
  assert.equal(assessSageConversationAnswer(wellbeingCase, "I’m here and working. What would you like to tackle?").passed, true);
});

test("PLAN never turns failed AI generation into fake completed Foundations answers", async () => {
  const [drafter, contract, project] = await Promise.all([
    read("modules/plan/foundations-plan-drafter.ts"),
    read("core/contracts/foundation-plan.ts"),
    read("core/project/project.ts"),
  ]);

  assert.match(drafter, /looksLikeThinPlaceholder/);
  assert.match(drafter, /A provisional answer must still contain a concrete story choice/);
  assert.match(drafter, /recoverFieldsIndividually/);
  assert.match(drafter, /failedFields/);
  assert.match(drafter, /PLAN could not produce a usable draft for/);
  assert.match(drafter, /Your fields were not changed/);
  assert.doesNotMatch(drafter, /safeProvisionalFallback/);
  assert.doesNotMatch(drafter, /provisional safety fallback/);

  assert.match(contract, /isUsableFoundationAnswer/);
  assert.match(contract, /text\.toLowerCase\(\) === "provisional"/);
  assert.match(contract, /usable local-model answer/);
  assert.match(contract, /Unresolved — add a working answer in PLAN/);
  assert.match(project, /usableAnswerRecord/);
  assert.match(project, /briefWasGeneratedFromLegacyFallback/);
  assert.match(project, /content: briefWasGeneratedFromLegacyFallback \? "" : rawBrief/);
});

test("focused Startup, LEARN and PLAN UAT own PR 628", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const testPath = "tests/issue-628-closed-loop-recovery-quality.test.mjs";
  for (const areaId of ["startup", "foundations-learn", "plan"]) {
    const area = registry.areas.find((candidate) => candidate.id === areaId);
    assert.ok(area?.tests.includes(testPath), `${areaId} must own PR 628 regression`);
  }
});
