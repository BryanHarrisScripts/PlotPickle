import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assessSageConversationAnswer,
  buildUatFinding,
  findingFingerprint,
  SAGE_CONVERSATION_UAT_CASES,
  sageUatLeaksInternalScaffolding,
} from "../lib/sage-conversation-uat.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the screenshot regression is a hard Sage UAT failure", () => {
  const screenshotLeak = `QUALITY MODEL ESCALATION.\nProduce one clean final response to the writer now.\nCONVERSATION MODE: ordinary conversation.\n{"id":"68a561f5","title":"Untitled Story","revision":497,"completedLessonCount":0,"activeLessonId":"general-readme-md"}`;
  const identity = SAGE_CONVERSATION_UAT_CASES.find((entry) => entry.id === "identity-name");
  assert.ok(identity);
  assert.equal(sageUatLeaksInternalScaffolding(screenshotLeak), true);
  const result = assessSageConversationAnswer(identity, screenshotLeak);
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((message) => /internal PlotPickle prompt\/project scaffolding/i.test(message)));
  assert.equal(findingFingerprint(result.failures[0]), "sage.internal-scaffolding-leak");
});

test("Sage conversation matrix covers identity, name meaning, wellbeing, help, conversation, craft and follow-up", () => {
  assert.deepEqual(SAGE_CONVERSATION_UAT_CASES.map((entry) => entry.id), [
    "identity-name",
    "identity-who",
    "name-meaning",
    "wellbeing",
    "help",
    "greeting",
    "craft",
    "follow-up",
  ]);
  const goodIdentity = assessSageConversationAnswer(
    SAGE_CONVERSATION_UAT_CASES[0],
    "I’m Sage Brinewick, PlotPickle’s Curriculum Guide. I help you understand the lessons and apply them to your story.",
  );
  assert.equal(goodIdentity.passed, true);
  const finding = buildUatFinding({ message: "Sage exposed internal PlotPickle prompt/project scaffolding.", area: "sage-conversation" });
  assert.equal(finding.fingerprint, "sage.internal-scaffolding-leak");
});

test("LEARN routes visible Sage answers through the safety boundary", async () => {
  const [page, guard] = await Promise.all([
    read("app/page.tsx"),
    read("modules/creative-room/sage-safe-guide.ts"),
  ]);
  assert.match(page, /creative-room\/sage-safe-guide/);
  assert.match(guard, /what is your name\|whats your name/);
  assert.match(guard, /QUALITY MODEL ESCALATION/);
  assert.match(guard, /sageAnswerLeaksInternalScaffolding/);
  assert.match(guard, /PlotPickle’s Curriculum Guide/);
  assert.match(guard, /safeLeakRecoveryAnswer/);
  assert.doesNotMatch(guard, /throw new Error\("Sage blocked a response because it exposed internal PlotPickle instructions/);
});

test("live UAT exercises the actual Sage composer instead of only the raw chat endpoint", async () => {
  const runner = await read("scripts/run-sage-conversation-uat.mjs");
  assert.match(runner, /workspace=learn/);
  assert.match(runner, /creative-room-question/);
  assert.match(runner, /Ask the Guide/);
  assert.match(runner, /Persistent Creative Room/);
  assert.match(runner, /sage-conversation-report\.json/);
  assert.match(runner, /sage-conversation-failure\.png/);
});

test("UAT findings persist to GitHub and are handed to the local repair agent", async () => {
  const [reporter, handoff, workflow, closedLoop] = await Promise.all([
    read("scripts/report-uat-findings.mjs"),
    read(".github/workflows/uat-repair-handoff.yml"),
    read(".github/workflows/learn-validation.yml"),
    read("scripts/run-uat-closed-loop.mjs"),
  ]);
  assert.match(reporter, /plotpickle-uat-fingerprint/);
  assert.match(reporter, /uat:autopilot/);
  assert.match(reporter, /uat:auto-repair/);
  assert.match(reporter, /const url = await gh\([\s\S]*?"issue", "create"/);
  assert.match(handoff, /issues:\s*\n\s*types: \[labeled\]/);
  assert.match(handoff, /run-uat-repair-agent\.mjs --issue/);
  assert.doesNotMatch(handoff, /gh pr create --draft/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /\.artifacts\/uat-focused/);
  assert.match(closedLoop, /run-sage-conversation-uat\.mjs/);
  assert.match(closedLoop, /--github-report/);
  assert.match(closedLoop, /run-uat-repair-agent\.mjs/);
});

test("focused registry owns the PR 626 regression", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const startup = registry.areas.find((area) => area.id === "startup");
  const learn = registry.areas.find((area) => area.id === "foundations-learn");
  assert.ok(startup?.tests.includes("tests/issue-626-uat-findings-sage-repair.test.mjs"));
  assert.ok(learn?.tests.includes("tests/issue-626-uat-findings-sage-repair.test.mjs"));
});
