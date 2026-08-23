import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resultText } from "../scripts/creative-uat/mcp-runtime.mjs";
import {
  WRITER_OBSERVER_CHECKPOINTS,
  executeWriterObserverPageFunction,
  observeWriterJourneyFinalState,
  validateWriterObserverCheckpointOwnership,
  writerObserverFunctionSources,
} from "../scripts/writer-journey-final-state.mjs";

function persistedProject() {
  const foundationLessons = Object.fromEntries(Array.from({ length: 11 }, (_, lessonIndex) => [
    `foundation-${lessonIndex + 1}`,
    { answers: Object.fromEntries(Array.from({ length: 3 }, (_, fieldIndex) => [`field-${fieldIndex + 1}`, `Foundation ${lessonIndex + 1}.${fieldIndex + 1}`])) },
  ]));
  const worldLessons = Object.fromEntries(Array.from({ length: 5 }, (_, lessonIndex) => [
    `world-${lessonIndex + 1}`,
    { answers: Object.fromEntries(Array.from({ length: 2 }, (_, fieldIndex) => [`field-${fieldIndex + 1}`, `World ${lessonIndex + 1}.${fieldIndex + 1}`])) },
  ]));
  return {
    id: "issue-1170-fixture",
    title: "The Last Crossing",
    learning: { completedLessonIds: Array.from({ length: 16 }, (_, index) => `lesson-${index + 1}`) },
    foundations: { lessons: foundationLessons, brief: { content: "A saved Foundations Brief." } },
    world: { lessons: worldLessons, brief: { content: "A saved World Brief." } },
    build: {
      foundations: {
        visualArtifacts: [
          { id: "rough-1", frameNumber: 1, reviewState: "accepted", workflow: "foundations-visual-wireframe/v1", assetUrl: "/api/local-ai/assets/rough-1.png" },
          { id: "poster-1", reviewState: "draft", workflow: "marquee-director/foundations-first-poster-v1", curriculumFrontier: "Foundations", assetUrl: "/api/local-ai/assets/poster-1.png" },
        ],
        acceptedVisualArtifactIds: ["rough-1"],
      },
      world: {
        visualArtifacts: [{ id: "world-1", frameNumber: 1, reviewState: "accepted", assetUrl: "/api/local-ai/assets/world-1.png" }],
        acceptedVisualArtifactIds: ["world-1"],
      },
    },
  };
}

function pageEnvironment() {
  const state = { reads: 0, writes: 0 };
  const completeLessonButton = { getAttribute: (name) => name === "aria-pressed" ? "true" : "", textContent: "PLAN answers complete" };
  const topicSection = (label, count) => ({
    querySelector: () => ({ textContent: label }),
    querySelectorAll: () => Array.from({ length: count }, () => completeLessonButton),
  });
  const planRail = {
    querySelector: () => ({ textContent: "11 of 11 lessons answered · 33 of 33 fields" }),
    querySelectorAll: () => Array.from({ length: 11 }, () => completeLessonButton),
  };
  const worldRail = { querySelectorAll: () => Array.from({ length: 5 }, () => completeLessonButton) };
  const main = { textContent: "PlotPickle Wyrmwood Settings Setup & Connections AI & Runtime" };
  const document = {
    querySelector(selector) {
      if (selector === 'aside[aria-label="PLAN Foundations lessons"]') return planRail;
      if (selector === 'nav[aria-label="World PLAN lessons"]') return worldRail;
      if (selector === 'main[aria-label="World PLAN"]') return { textContent: "World PLAN: 10 / 10" };
      if (selector === 'main[aria-label="PlotPickle Dashboard"]') {
        return { textContent: "11 of 11 Foundations lessons complete · 33 of 33 PLAN answers saved · 1 accepted Foundations visual · 5 / 5 World lessons · 10 / 10 World PLAN decisions · 1 accepted World visual change" };
      }
      if (selector === "main") return main;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "section") return [topicSection("Foundations", 11), topicSection("World", 5)];
      if (selector === "button") return [{ textContent: "Marquee", disabled: false }];
      if (selector === "main img") return [{ getAttribute: () => "/api/local-ai/assets/fixture.png" }];
      if (selector === "main *") return [{ textContent: "Accepted" }];
      return [];
    },
  };
  const localStorage = {
    getItem() {
      state.reads += 1;
      return JSON.stringify(persistedProject());
    },
    setItem() { state.writes += 1; },
    removeItem() { state.writes += 1; },
    clear() { state.writes += 1; },
  };
  return { document, localStorage, state };
}

function executeSource(source, environment) {
  return Function("document", "localStorage", `"use strict"; return (${source})();`)(environment.document, environment.localStorage);
}

function browserFixture({ malformedFunction = "", productFailureFunction = "" } = {}) {
  const environment = pageEnvironment();
  const calls = [];
  const client = {
    async call(name, args) {
      calls.push({ name, args });
      if (name === "browser_navigate") return { content: [] };
      assert.equal(name, "browser_evaluate");
      if (malformedFunction && args.function.includes(`function ${malformedFunction}`)) {
        return { content: [{ type: "text", text: "### Result\nnot-json" }] };
      }
      let value = executeSource(args.function, environment);
      if (productFailureFunction && args.function.includes(`function ${productFailureFunction}`)) {
        value = JSON.stringify({ lessonCount: 5, completeLessonCount: 5, answerCount: 0, fieldCount: 10 });
      }
      return { content: [{ type: "text", text: `### Result\n${JSON.stringify(value)}` }] };
    },
  };
  return { client, calls, environment };
}

test("#1170 executes every observer function through the shared browser-evaluate payload contract", async () => {
  const { client, calls, environment } = browserFixture();
  const sources = writerObserverFunctionSources();
  for (const [functionName, pageFunction] of Object.entries(sources)) {
    const execution = await executeWriterObserverPageFunction({ client, resultText, functionName, pageFunction });
    assert.equal(execution.passed, true, `${functionName} must execute and parse through the adapter fixture`);
    assert.equal(typeof execution.evidence, "object");
  }
  assert.equal(calls.filter((call) => call.name === "browser_evaluate").length, Object.keys(sources).length);
  assert.equal(environment.state.writes, 0);
});

test("#1170 World PLAN returns parseable structured evidence through the exact serialized payload path", async () => {
  const { client } = browserFixture();
  const pageFunction = writerObserverFunctionSources().inspectWorldPlanPage;
  const execution = await executeWriterObserverPageFunction({ client, resultText, functionName: "inspectWorldPlanPage", pageFunction });
  assert.equal(execution.passed, true);
  assert.deepEqual(execution.evidence, { lessonCount: 5, completeLessonCount: 5, answerCount: 10, fieldCount: 10 });
});

test("#1170 rejects malformed or write-capable payloads before browser execution", async () => {
  let calls = 0;
  const client = { async call() { calls += 1; return { content: [] }; } };
  const malformed = await executeWriterObserverPageFunction({
    client,
    resultText,
    functionName: "inspectWorldPlanPage",
    pageFunction: "function inspectWorldPlanPage( {",
  });
  assert.equal(malformed.passed, false);
  assert.equal(malformed.stage, "payload-validation");

  const writeCapable = await executeWriterObserverPageFunction({
    client,
    resultText,
    functionName: "writeProjectPage",
    pageFunction: "function writeProjectPage() { localStorage.setItem('unsafe', 'true'); return '{}'; }",
  });
  assert.equal(writeCapable.passed, false);
  assert.equal(writeCapable.stage, "payload-validation");
  assert.match(writeCapable.error, /forbidden browser storage mutation/i);
  assert.equal(calls, 0);
});

test("#1170 turns malformed browser output into structured failure instead of throwing", async () => {
  const { client } = browserFixture({ malformedFunction: "inspectWorldPlanPage" });
  const execution = await executeWriterObserverPageFunction({
    client,
    resultText,
    functionName: "inspectWorldPlanPage",
    pageFunction: writerObserverFunctionSources().inspectWorldPlanPage,
  });
  assert.equal(execution.passed, false);
  assert.equal(execution.status, "observer-failed");
  assert.equal(execution.stage, "result-parse");
  assert.match(execution.error, /no parseable JSON evidence/i);
});

test("#1170 preserves the partial ledger and continues safe evidence after a World observer failure", async () => {
  const { client, calls, environment } = browserFixture({ malformedFunction: "inspectWorldPlanPage" });
  const audit = await observeWriterJourneyFinalState({
    client,
    resultText,
    baseUrl: "http://127.0.0.1:4173",
    settleMs: 0,
    provenance: { testedCommit: "fixture-head", platform: "win32" },
  });
  const worldPlan = audit.ledger.find((entry) => entry.id === "world-plan");
  const worldBuild = audit.ledger.find((entry) => entry.id === "world-build");
  const dashboard = audit.ledger.find((entry) => entry.id === "dashboard-final");
  assert.equal(audit.passed, false);
  assert.equal(worldPlan.status, "observer-failed");
  assert.equal(worldPlan.stage, "result-parse");
  assert.notEqual(worldBuild.status, "not-reached");
  assert.notEqual(dashboard.status, "not-reached");
  assert.ok(audit.observerFailures.some((failure) => failure.checkpointId === "world-plan"));
  assert.ok(calls.some((call) => call.name === "browser_navigate" && call.args.url.includes("workspace=settings")));
  assert.equal(audit.provenance.testedCommit, "fixture-head");
  assert.equal(environment.state.writes, 0);
});

test("#1170 distinguishes product-state failure from observer transport failure", async () => {
  const { client } = browserFixture({ productFailureFunction: "inspectWorldPlanPage" });
  const audit = await observeWriterJourneyFinalState({ client, resultText, baseUrl: "http://127.0.0.1:4173", settleMs: 0 });
  const worldPlan = audit.ledger.find((entry) => entry.id === "world-plan");
  assert.equal(worldPlan.status, "product-state-failed");
  assert.equal(worldPlan.stage, "acceptance");
  assert.equal(audit.observerFailures.some((failure) => failure.checkpointId === "world-plan"), false);
});

test("#1170 repeated observer payload execution does not mutate project state", async () => {
  const { client, environment } = browserFixture();
  const before = JSON.stringify(persistedProject());
  for (let index = 0; index < 2; index += 1) {
    const execution = await executeWriterObserverPageFunction({
      client,
      resultText,
      functionName: "readProjectPage",
      pageFunction: writerObserverFunctionSources().readProjectPage,
    });
    assert.equal(execution.passed, true);
    assert.equal(JSON.stringify(execution.evidence), before);
  }
  assert.equal(environment.state.reads, 2);
  assert.equal(environment.state.writes, 0);
});

test("#1170 keeps one canonical final-state owner for every journey checkpoint", () => {
  assert.equal(validateWriterObserverCheckpointOwnership(), true);
  assert.deepEqual(WRITER_OBSERVER_CHECKPOINTS.map((checkpoint) => checkpoint.id), [
    "dashboard-start",
    "foundations-learn",
    "foundations-plan",
    "foundations-build",
    "marquee-marketing-reference",
    "world-learn",
    "world-plan",
    "world-build",
    "wyrmwood",
    "settings",
    "dashboard-final",
  ]);
  assert.throws(() => validateWriterObserverCheckpointOwnership([
    WRITER_OBSERVER_CHECKPOINTS[0],
    { ...WRITER_OBSERVER_CHECKPOINTS[0], owner: "duplicate-auditor" },
  ]), /explicit architecture override/i);
});

test("#1170 records exact-head runtime proof and classifies stale only after a green Windows run", async () => {
  const [entrypoint, wrapper] = await Promise.all([
    readFile(new URL("../scripts/run-writer-in-residence.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/run-writer-in-residence-e2e.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(entrypoint, /PLOTPICKLE_WRITER_RUNTIME_SOURCE/);
  assert.match(wrapper, /git", \["rev-parse", "HEAD"\]/);
  assert.match(wrapper, /git", \["status", "--porcelain"\]/);
  assert.match(wrapper, /const testedCommit = execFileSync\("git", \["rev-parse", "HEAD"\]/);
  assert.match(wrapper, /const workingTreeClean = execFileSync\("git", \["status", "--porcelain"\]/);
  assert.match(wrapper, /platform: process\.platform/);
  assert.match(wrapper, /endpoint: baseUrl/);
  assert.match(wrapper, /worldPlanObserver/);
  assert.match(wrapper, /fullVerificationIntegration/);
  assert.match(wrapper, /process\.platform === "win32" && runProvenance\.workingTreeClean[\s\S]*"STALE_EXTERNAL_TOPIC"/);
  assert.match(wrapper, /UNCLASSIFIED_PENDING_EXACT_WINDOWS_LIVE_PROOF/);
});
