import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditPersistedWriterProject } from "../scripts/writer-journey-final-state.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function fixture() {
  const lessons = Object.fromEntries(Array.from({ length: 11 }, (_, lessonIndex) => [
    `foundation-${lessonIndex + 1}`,
    {
      answers: Object.fromEntries(Array.from({ length: 3 }, (_, fieldIndex) => [
        `field-${fieldIndex + 1}`,
        `Avery answer ${lessonIndex + 1}.${fieldIndex + 1}`,
      ])),
    },
  ]));
  const rough = {
    id: "rough-1",
    assetUrl: "/api/local-ai/assets/rough-1.png",
    frameNumber: 1,
    reviewState: "accepted",
    workflow: "foundations-visual-wireframe/v1",
  };
  const poster = {
    id: "poster-1",
    assetUrl: "/api/local-ai/assets/poster-1.png",
    curriculumFrontier: "Foundations",
    reviewState: "draft",
    workflow: "marquee-director/foundations-first-poster-v1",
    provider: "comfyui",
    model: "fixture",
  };
  return {
    project: {
      id: "avery-e2e",
      title: "The Last Crossing",
      learning: { completedLessonIds: Array.from({ length: 11 }, (_, index) => `foundation-${index + 1}`) },
      foundations: { lessons, brief: { content: "A persisted Foundations Brief." } },
      build: {
        foundations: {
          visualArtifacts: [rough, poster],
          acceptedVisualArtifactIds: [rough.id],
        },
      },
    },
    rendered: {
      learn: { foundationLessonCount: 11, foundationCompletedCount: 11, marqueeDisabled: false },
      plan: { completeLessonCount: 11, lessonCount: 11, answerCount: 33, fieldCount: 33 },
      build: { localAssetImageCount: 2, acceptedLabelCount: 1 },
      dashboard: { foundationLearnComplete: 11, foundationLearnTotal: 11, foundationPlanAnswers: 33, foundationPlanFields: 33, acceptedArtifactCount: 1 },
    },
  };
}

test("#1104 final-state observer passes only when persisted and reopened evidence agree", () => {
  const { project, rendered } = fixture();
  const audit = auditPersistedWriterProject(project, rendered);
  assert.equal(audit.passed, true);
  assert.equal(audit.checks.length, 9);
  assert.equal(audit.marketingReference.assetUrl, "/api/local-ai/assets/poster-1.png");
  assert.ok(audit.checks.every((item) => item.passed));
});

test("#1104 catches missing reopened green completion marks", () => {
  const { project, rendered } = fixture();
  rendered.learn.foundationCompletedCount = 10;
  const audit = auditPersistedWriterProject(project, rendered);
  assert.equal(audit.passed, false);
  assert.equal(audit.checks.find((item) => item.id === "learn.rendered").passed, false);
});

test("#1104 catches empty PLAN even when the transcript could claim completion", () => {
  const { project, rendered } = fixture();
  project.foundations.lessons = {};
  project.foundations.brief.content = "";
  const audit = auditPersistedWriterProject(project, rendered);
  assert.equal(audit.passed, false);
  assert.equal(audit.checks.find((item) => item.id === "plan.persisted").passed, false);
});

test("#1104 catches a lost BUILD visual or lost acceptance", () => {
  const { project, rendered } = fixture();
  project.build.foundations.visualArtifacts = project.build.foundations.visualArtifacts.filter((item) => item.id !== "rough-1");
  project.build.foundations.acceptedVisualArtifactIds = [];
  const audit = auditPersistedWriterProject(project, rendered);
  assert.equal(audit.passed, false);
  assert.equal(audit.checks.find((item) => item.id === "build.persisted").passed, false);
});

test("#1104 catches a missing Marquee Marketing Reference", () => {
  const { project, rendered } = fixture();
  project.build.foundations.visualArtifacts = project.build.foundations.visualArtifacts.filter((item) => item.id !== "poster-1");
  const audit = auditPersistedWriterProject(project, rendered);
  assert.equal(audit.passed, false);
  assert.equal(audit.checks.find((item) => item.id === "marquee.persisted").passed, false);
});

test("#1104 catches stale Dashboard progress after the project itself is complete", () => {
  const { project, rendered } = fixture();
  rendered.dashboard.foundationPlanAnswers = 0;
  rendered.dashboard.acceptedArtifactCount = 0;
  const audit = auditPersistedWriterProject(project, rendered);
  assert.equal(audit.passed, false);
  assert.equal(audit.checks.find((item) => item.id === "dashboard.progress").passed, false);
});

test("#1104 keeps Avery UI-only while the separate observer owns browser_evaluate", async () => {
  const [entrypoint, completion, observer, wrapper, legacy] = await Promise.all([
    read("scripts/run-writer-in-residence.mjs"),
    read("scripts/writer-journey-completion.mjs"),
    read("scripts/writer-journey-final-state.mjs"),
    read("scripts/run-writer-in-residence-e2e.mjs"),
    read("scripts/run-writer-in-residence-v4.mjs"),
  ]);
  assert.match(entrypoint, /run-writer-in-residence-e2e\.mjs/);
  assert.doesNotMatch(entrypoint, /run-writer-in-residence-v4\.mjs/);
  assert.doesNotMatch(completion, /browser_evaluate|localStorage\.(?:getItem|setItem|removeItem)|sessionStorage/);
  assert.match(completion, /lessonMarks = controls\.filter/);
  assert.match(completion, /complete\|incomplete/);
  assert.match(completion, /Create first poster/);
  assert.match(completion, /Generate.*wireframe/);
  assert.match(observer, /browser_evaluate/);
  assert.match(observer, /localStorage\.getItem/);
  assert.match(observer, /mutationAuthority: "none"/);
  assert.doesNotMatch(observer, /localStorage\.setItem|localStorage\.removeItem/);
  assert.match(wrapper, /run-writer-in-residence-v4\.mjs/);
  assert.match(wrapper, /browser-profile/);
  assert.match(wrapper, /final-state/);
  assert.match(wrapper, /poster-marketing-reference/);
  assert.doesNotMatch(legacy, /client\.call\("browser_evaluate"/);
});

test("#1104 remains the final acceptance layer inside canonical Full Verification stage 9", async () => {
  const [graph, gateway] = await Promise.all([
    read("scripts/full-verification-graph.mjs"),
    read("build/writer-in-residence-gateway.ts"),
  ]);
  assert.match(graph, /"9 of 9 - Writer-in-Residence"/);
  assert.match(graph, /args: \["scripts\/run-writer-in-residence\.mjs"\]/);
  assert.match(gateway, /poster|key\[-_ \]\?art/i);
  assert.match(gateway, /representativeVisualUrl/);
});
