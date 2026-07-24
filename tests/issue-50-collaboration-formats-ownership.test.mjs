import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const legacyBlogSources = [
  "GitHub for Screenwriters",
  "GitHub Collaborative Writing",
  "GitHub Mastering Markdown",
  "GitHub Merging Final Draft and Text",
  "Open-Sourcing Licensing and Protection",
  "Open-Sourcing Your Screenplay",
  "LLMs, Twitter, GitHub, and AI",
  "LLMs and AI Navigation",
];

const lessonTitles = [
  "Choose Your PlotPickle Workflow",
  "Collaborate Without Losing the Source of Truth",
  "Formats That Travel",
  "Ownership, Licences and Sharing Choices",
  "AI, GitHub and Public Publishing as Optional Tools",
];

test("all eight legacy Blog sources map into five PlotPickled lessons", async () => {
  const collection = await source("app/learning-collaboration-ownership.ts");
  for (const legacySource of legacyBlogSources) assert.ok(collection.includes(`source: "${legacySource}"`), `Missing source map: ${legacySource}`);
  for (const title of lessonTitles) assert.ok(collection.includes(`title: "${title}"`), `Missing lesson: ${title}`);
  assert.match(collection, /legacyBlogSourceMap/);
  assert.equal((collection.match(/collection: "Collaboration, Formats & Ownership"/g) ?? []).length, 5);
});

test("the first-run chooser compares all five valid workflow paths", async () => {
  const collection = await source("app/learning-collaboration-ownership.ts");
  const studio = await source("app/learning-studio.tsx");
  for (const path of [
    "Solo and entirely local",
    "Local with file exchange",
    "Local with optional AI assistance",
    "Private team collaboration",
    "Public or openly licensed project",
  ]) assert.ok(collection.includes(`title: "${path}"`), `Missing workflow path: ${path}`);
  for (const statement of ["No online account required", "Accounts optional", "AI provider optional", "Private GitHub access required", "Public publishing is a deliberate choice"]) {
    assert.ok(collection.includes(statement), `Missing workflow condition: ${statement}`);
  }
  assert.match(studio, /First-run guide/);
  assert.match(studio, /Choose how you want to work/);
  assert.match(studio, /plotpickle-workflow-choice/);
  assert.match(studio, /window\.localStorage\.setItem\(workflowStorageKey, choice\.id\)/);
});

test("Git concepts are translated into writer-facing decisions", async () => {
  const collection = await source("app/learning-collaboration-ownership.ts");
  const translations = [
    ["Repository", "Project home"],
    ["Branch", "Proposed alternate version"],
    ["Commit", "Saved change set"],
    ["Pull request", "Reviewable change proposal"],
    ["Merge", "Owner-approved adoption"],
    ["Conflict", "Competing changes requiring a decision"],
  ];
  for (const [term, meaning] of translations) {
    assert.ok(collection.includes(`term: "${term}"`), `Missing Git term: ${term}`);
    assert.ok(collection.includes(`writerMeaning: "${meaning}"`), `Missing writer meaning: ${meaning}`);
  }
  for (const rule of ["Propose rather than overwrite", "compare", "explicit approval", "Attribution", "canonical project"]) {
    assert.ok(collection.toLowerCase().includes(rule.toLowerCase()), `Missing collaboration rule: ${rule}`);
  }
});

test("the format chooser distinguishes project, screenplay, reading and presentation formats", async () => {
  const collection = await source("app/learning-collaboration-ownership.ts");
  for (const format of [".ppf", ".plotpickle.json", "Markdown", "Fountain", "FDX", "PDF", "HTML and Markdown presentation exports"]) {
    assert.ok(collection.includes(`format: "${format}"`), `Missing format: ${format}`);
  }
  assert.match(collection, /Markdown is not screenplay formatting/);
  assert.match(collection, /Import FDX directly/);
  assert.match(collection, /Export FDX for Final Draft interchange/);
  assert.match(collection, /Export Fountain for portable screenplay text/);
  assert.match(collection, /WriterDuet, copied plain text or Markdown conversion/);
  assert.match(collection, /round trip/i);
  assert.match(collection, /what it preserves/i);
  assert.match(collection, /what it omits/i);
});

test("ownership guidance separates every PlotPickle rights layer", async () => {
  const collection = await source("app/learning-collaboration-ownership.ts");
  for (const distinction of [
    "PlotPickle software: AGPL-3.0-or-later.",
    "Reusable method and educational documentation: CC BY-SA 4.0 unless otherwise marked.",
    "User-created stories and screenplays: remain the user's work and are not automatically licensed to PlotPickle or the public.",
    "Third-party text, images, music, likenesses and reference material",
    "PlotPickle names, logos and brand assets",
  ]) assert.ok(collection.includes(distinction), `Missing ownership distinction: ${distinction}`);
  for (const separateChoice of ["Access: who can see or review.", "Publication: whether the work is made public.", "Licence: what reuse is permitted."]) {
    assert.ok(collection.includes(separateChoice), `Missing separate sharing choice: ${separateChoice}`);
  }
  assert.match(collection, /not legal advice/i);
  assert.match(collection, /does not guarantee attribution, payment, discovery, production, enforcement or practical control/i);
  assert.match(collection, /qualified professional/i);
});

test("AI, GitHub and publishing remain optional and provider-independent", async () => {
  const collection = await source("app/learning-collaboration-ownership.ts");
  for (const principle of [
    "Provider-independent setup",
    "Smallest useful context",
    "Original preserved",
    "Explicit writer approval",
    "Private team access",
    "Public source access",
    "Promotional publishing",
    "Openly licensed reuse",
  ]) assert.ok(collection.includes(principle), `Missing optional-tools principle: ${principle}`);
  assert.match(collection, /AI-Assisted Revision collection from issue #49/);
  assert.match(collection, /without naming a model brand/);
  assert.match(collection, /AI-assisted, AI-generated and no-AI/);
  assert.doesNotMatch(collection, /GPT-4|Claude 3|token limit|pages per prompt/i);
});

test("every lesson includes source aliases, worked application and a direct workspace target", async () => {
  const collection = await source("app/learning-collaboration-ownership.ts");
  for (const field of ["sourceAliases", "sourceNote", "workspaceLabel", "workspaceTarget", "workspaceHref", "example:", "mistakes:", "exercise:"]) {
    assert.ok(collection.includes(field), `Missing learning field: ${field}`);
  }
  assert.equal((collection.match(/workspaceHref:/g) ?? []).length, 5);
  assert.equal((collection.match(/sourceAliases:/g) ?? []).length, 5);
  assert.equal((collection.match(/example: \{/g) ?? []).length, 5);
  assert.equal((collection.match(/exercise: "/g) ?? []).length, 5);
});

test("legacy titles and major terms remain searchable in Read and Learn", async () => {
  const collection = await source("app/learning-collaboration-ownership.ts");
  const studio = await source("app/learning-studio.tsx");
  for (const alias of ["GitHub for Screenwriters", "Mastering Markdown", "open-source screenplay", "Final Draft and text", "LLMs and AI Navigation"]) {
    assert.ok(collection.toLowerCase().includes(alias.toLowerCase()), `Missing searchable alias: ${alias}`);
  }
  assert.match(collection, /collaborationOwnershipSearchText/);
  assert.match(studio, /collaborationOwnershipSearchText/);
  assert.match(studio, /Collaboration, Formats & Ownership/);
  assert.match(studio, /collaborationOwnershipLessons/);
  assert.match(studio, /legacy source aliases/);
});

test("learning actions open current PlotPickle workspaces instead of obsolete workarounds", async () => {
  const studio = await source("app/learning-studio.tsx");
  for (const integration of [
    "Primary workspaces",
    "Story Planner story sections",
    "Project Overview",
    "Settings sections",
    "AI Setup",
    "GitHub",
    "onOpenScreenplay",
    "window.location.assign(module.workspaceHref)",
  ]) assert.ok(studio.includes(integration), `Missing workspace integration: ${integration}`);
  assert.match(studio, /Opening it does not publish, connect, licence, merge or apply story changes automatically/);
});
