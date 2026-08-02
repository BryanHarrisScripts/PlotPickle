import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("..", import.meta.url);
const modeSource = await readFile(new URL("lib/collaboration-mode.ts", root), "utf8");
const uiSource = await readFile(new URL("app/github-collaboration.tsx", root), "utf8");

const compiled = ts.transpileModule(modeSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const runtimeModule = { exports: {} };
vm.runInNewContext(compiled, {
  module: runtimeModule,
  exports: runtimeModule.exports,
  require: () => ({}),
});
const transitions = runtimeModule.exports;

const MODES = ["local-story", "writers-room", "repository-collaboration"];

function projectFor(mode) {
  return {
    id: "project-step-6",
    metadata: { title: "Transition proof", updatedAt: "2026-07-31T00:00:00.000Z" },
    story: { premise: "Canon must remain unchanged." },
    structure: { acts: [{ id: "act-1" }] },
    revisions: [{ id: "revision-1", contentHash: "abc123" }],
    assets: { items: [{ id: "asset-1" }] },
    collaboration: {
      mode,
      provider: "github",
      repositoryUrl: "https://github.com/example/story",
      sourceRepositoryUrl: "https://github.com/example/template",
      owner: "example",
      repo: "story",
      branch: "main",
      projectPath: "story.ppf",
      syncEnabled: true,
      lastPulledCommit: "pull-123",
      lastPushedCommit: "push-456",
      connectedAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
    },
  };
}

function json(value) {
  return JSON.stringify(value);
}

test("Step 6 implements all nine mode transitions without touching canonical project data", () => {
  let pairs = 0;
  for (const from of MODES) {
    for (const to of MODES) {
      pairs += 1;
      const project = projectFor(from);
      const beforeCollaboration = { ...project.collaboration };
      const result = transitions.transitionCollaborationMode(project, to, { buzz: true, github: true });
      assert.equal(result.plan.from, from);
      assert.equal(result.plan.to, to);
      assert.equal(result.plan.changed, from !== to);
      assert.equal(result.plan.status, "ready");
      assert.deepEqual([...result.plan.automaticActions], []);
      assert.ok(Object.values(result.plan.preserves).every(Boolean));

      if (from === to) {
        assert.strictEqual(result.project, project);
      } else {
        assert.notStrictEqual(result.project, project);
        assert.strictEqual(result.project.story, project.story);
        assert.strictEqual(result.project.structure, project.structure);
        assert.strictEqual(result.project.revisions, project.revisions);
        assert.strictEqual(result.project.assets, project.assets);
        assert.equal(json(result.project.collaboration), json({ ...beforeCollaboration, mode: to }));
      }
    }
  }
  assert.equal(pairs, 9);
});

test("Step 6 treats missing required services as attention, never failure", () => {
  const writersRoom = transitions.planCollaborationModeTransition("local-story", "writers-room", {
    buzz: "unconfigured",
    github: "unconfigured",
  });
  assert.equal(writersRoom.status, "attention");
  assert.deepEqual([...writersRoom.requiredServices], ["buzz"]);
  assert.deepEqual([...writersRoom.missingRequiredServices], ["buzz"]);
  assert.match(writersRoom.guidance, /Configure or connect Buzz deliberately/);

  const repository = transitions.planCollaborationModeTransition("local-story", "repository-collaboration", {
    buzz: "unconfigured",
    github: "unknown",
  });
  assert.equal(repository.status, "attention");
  assert.deepEqual([...repository.requiredServices], ["github"]);
  assert.deepEqual([...repository.missingRequiredServices], ["github"]);
  assert.match(repository.guidance, /Configure a story repository deliberately/);

  const local = transitions.planCollaborationModeTransition("repository-collaboration", "local-story", {
    buzz: "unconfigured",
    github: "unconfigured",
  });
  assert.equal(local.status, "ready");
  assert.deepEqual([...local.missingRequiredServices], []);
  assert.notEqual(writersRoom.status, "failed");
  assert.notEqual(repository.status, "failed");
});

test("Step 6 normalizes legacy modes and preserves GitHub configuration markers", () => {
  const project = projectFor("legacy-mode");
  const result = transitions.transitionCollaborationMode(project, "writers-room", { buzz: true, github: true });
  assert.equal(result.plan.from, "local-story");
  assert.equal(result.plan.to, "writers-room");
  for (const key of [
    "provider", "repositoryUrl", "sourceRepositoryUrl", "owner", "repo", "branch", "projectPath",
    "syncEnabled", "lastPulledCommit", "lastPushedCommit", "connectedAt", "updatedAt",
  ]) {
    assert.equal(result.project.collaboration[key], project.collaboration[key], `Changed ${key}`);
  }
});

test("Step 6 keeps service checks read-only and cancellation before onChange", () => {
  assert.doesNotMatch(modeSource, /\bfetch\s*\(|connectGitHub|disconnectGitHub|startBuzz|stopBuzz|syncProject|publishProject|createProposal|approveProposal/);
  assert.match(uiSource, /transitionCollaborationMode\(project, mode/);
  assert.match(uiSource, /collaborationTransitionConfirmation\(result\.plan\)/);
  const selectionStart = uiSource.indexOf("function selectMode");
  const cancellation = uiSource.indexOf("if (!confirmed) return", selectionStart);
  const change = uiSource.indexOf("onChange(next)", selectionStart);
  assert.ok(selectionStart >= 0 && cancellation > selectionStart && change > cancellation);
  assert.doesNotMatch(uiSource, /onChange\(\{[\s\S]{0,200}withCollaborationMode/);
  assert.match(uiSource, /fetch\(BUZZ_STATUS_API/);
  assert.doesNotMatch(uiSource, /fetch\(BUZZ_STATUS_API[\s\S]{0,120}method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
});

test("Step 6 confirmation states the preservation and no-automation boundary", () => {
  const plan = transitions.planCollaborationModeTransition("local-story", "repository-collaboration", {
    github: false,
  });
  const message = transitions.collaborationTransitionConfirmation(plan);
  assert.match(message, /PPF, local backups, GitHub setup and Buzz setup will be preserved/);
  assert.match(message, /will not connect or disconnect GitHub or Buzz/);
  assert.match(message, /start synchronization, publish changes, or alter story canon/);
  assert.match(message, /Next step after selection/);
});
