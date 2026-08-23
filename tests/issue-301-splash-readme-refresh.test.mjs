import "./issue-343-marketing-splash-ux.test.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #301 preserves the AIDA story while adding the latest product capabilities", async () => {
  const splash = await source("app/marketing-splash-base.tsx");
  const sequence = [
    "Stop losing the story",
    "Learn the craft inside the story you are building.",
    "Start privately. Add people only when the story needs them.",
    "Load Afterglow",
  ];
  let cursor = -1;
  for (const phrase of sequence) {
    const next = splash.indexOf(phrase);
    assert.ok(next > cursor, `AIDA sequence is missing or out of order: ${phrase}`);
    cursor = next;
  }
  for (const phrase of [
    "story graph",
    "portable PPF",
    "Visual writing",
    "Visual pitch",
    "81 guided modules",
    "MiniMax H3",
    "ComfyUI",
    "Suggest / Report",
  ]) assert.match(splash, new RegExp(phrase, "i"), `Missing refreshed splash capability: ${phrase}`);
});

test("issue #301 explains optional compute and account requirements without overclaiming", async () => {
  const splash = await source("app/marketing-splash-base.tsx");
  for (const phrase of [
    "not every computer can run every model",
    "official-source workflow",
    "No silent model or custom-node downloads",
    "No automatic paid cloud fallback",
    "Bring your own GitHub account and story repository",
    "Bring your own Buzz or BuilderLab account",
    "Bring your own provider account, API key and billing",
    "encrypted for the current operating-system user",
  ]) assert.ok(splash.includes(phrase), `Missing setup or safety boundary: ${phrase}`);
  assert.doesNotMatch(splash, /automatic cloud fallback|bundled provider account|native H3 works on every computer/i);
});

test("issue #301 keeps collaboration and feedback human controlled", async () => {
  const splash = await source("app/marketing-splash-base.tsx");
  for (const phrase of [
    "GitHub Story Proposals",
    "owner-approved merges",
    "Buzz / BuilderLab account",
    "sanitized Suggest / Report path",
    "never attaches story files, credentials or local paths automatically",
    "nothing becomes canonical until a person approves it",
  ]) assert.ok(splash.includes(phrase), `Missing collaboration boundary: ${phrase}`);
});

test("issue #301 aligns README product truth with the splash", async () => {
  const readme = await source("README.md");
  for (const phrase of [
    "Suggest / Report",
    "clickable Settings sitemap",
    "guarded native MiniMax H3",
    "official-source manifest",
    "8 GB VRAM system is treated as constrained",
    "A GitHub account and one story repository",
    "A Buzz or BuilderLab account",
    "The user’s own provider account, API key, billing",
    "Windows, macOS and Linux packaging validation",
    "GNU AGPLv3 or later",
  ]) assert.ok(readme.includes(phrase), `README is missing refreshed product truth: ${phrase}`);
  assert.doesNotMatch(readme, /no active API connects it to Graphic Novel generation yet|Universal native H3 support is available/i);
});

test("issue #301 focused regression is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-301-splash-readme-refresh\.test\.mjs/);
  assert.equal(packageJson.scripts["test:splash-readme-refresh"], "node --test tests/issue-301-splash-readme-refresh.test.mjs");
});
