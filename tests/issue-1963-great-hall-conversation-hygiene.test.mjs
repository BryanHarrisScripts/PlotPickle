import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { changedFilesFromGit, runDevelopmentConvergence } from "../scripts/run-development-convergence.mjs";

const read = (path) => readFile(path, "utf8");

test("#1963 Great Hall hides BUZZ health probes and legacy operational dumps from conversation", async () => {
  const [social, healthGateway] = await Promise.all([
    read("modules/community/community-buzz-social.tsx"),
    read("build/buzz-live-health-gateway.ts"),
  ]);

  assert.match(healthGateway, /plotpickle-buzz-health:/u);
  assert.match(healthGateway, /PlotPickle signed BUZZ round-trip connection probe/u);
  assert.match(social, /function isNonConversationDiagnostic\(message: BuzzMessage\)/u);
  assert.match(social, /plotpickle-buzz-health:/u);
  assert.match(social, /PlotPickle signed BUZZ round-trip connection probe/u);
  assert.match(social, /plotpickle-live-activity:/u);
  assert.match(social, /target=live-activity-verification/u);
  assert.match(social, /filter\(\(message\) => !isNonConversationDiagnostic\(message\)\)/u);
});

test("#1963 Human and Agent replies still use one authoritative BUZZ conversation", async () => {
  const social = await read("modules/community/community-buzz-social.tsx");

  assert.match(social, /authenticatedProfileFetch\(`\$\{BUZZ_API\}\/messages\?channel=/u);
  assert.match(social, /chronological\(Array\.isArray\(body\.messages\) \? body\.messages : \[\]\)/u);
  assert.match(social, /window\.setInterval\(\(\) => \{ void refresh\(true\); \}, 5000\)/u);
  assert.match(social, /authenticatedProfileFetch\(forum \? `\$\{BUZZ_API\}\/community\/forum-topic` : `\$\{BUZZ_API\}\/messages`/u);
  assert.match(social, /data-buzz-event-id=\{message\.id\}/u);
  assert.match(social, /agent \? <small>AGENT<\/small> : null/u);
});

test("#1963 Community explains live BUZZ reply behavior in the existing context rail", async () => {
  const social = await read("modules/community/community-buzz-social.tsx");

  assert.match(social, /data-community-conversation-sync="buzz"/u);
  assert.match(social, /Live BUZZ conversation/u);
  assert.match(social, /Incoming Human and Agent replies refresh automatically from the same signed room history\./u);
  assert.match(social, /Enter to post · Shift\+Enter for a new line · replies refresh automatically from BUZZ/u);
});

test("#1963 is governed and selected by the seven-layer verification mesh", async () => {
  const [catalogSource, ownershipSource] = await Promise.all([
    read("config/verification/test-catalog.json"),
    read("config/verification/ownership-map.json"),
  ]);
  const catalog = JSON.parse(catalogSource);
  const ownership = JSON.parse(ownershipSource);

  const entry = catalog.entries.find((candidate) => candidate.id === "experience.community-conversation-1963");
  assert.ok(entry);
  assert.equal(entry.ownerLayer, "experience-skins");
  assert.deepEqual(entry.runner.targets, ["tests/issue-1963-great-hall-conversation-hygiene.test.mjs"]);
  assert.ok(entry.triggerTokens.includes("mcp"));
  assert.ok(entry.triggerTokens.includes("surface"));

  const owner = ownership.rules.find((rule) => rule.id === "community-conversation-surface");
  assert.ok(owner);
  assert.ok(owner.include.includes("modules/community/community-buzz-social.tsx"));
  assert.equal(owner.ownerLayer, "experience-skins");
});

test("#1963 canonical development convergence reports CONVERGED against the real diff", async (t) => {
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "main";
  const changedFiles = changedFilesFromGit({ root: process.cwd(), baseRef });
  if (!changedFiles.includes("config/development-convergence/1963.json")) {
    t.skip("#1963 issue-specific convergence only applies when its convergence manifest is part of the current diff.");
    return;
  }

  const result = await runDevelopmentConvergence([
    "--manifest",
    "config/development-convergence/1963.json",
    "--base-ref",
    baseRef,
    "--report-dir",
    ".artifacts/development-convergence",
  ]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.reports.length, 1);
  assert.equal(result.reports[0].issue, 1963);
  assert.equal(result.reports[0].status, "CONVERGED");
  assert.deepEqual(result.reports[0].remaining, []);
});
