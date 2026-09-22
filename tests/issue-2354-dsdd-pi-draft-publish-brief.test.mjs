import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const json = async (file) => JSON.parse(await read(file));

test("#2354 exposes explicit Clear Draft, Interpret, Pi Draft and Publish Brief actions", async () => {
  const panel = await read("app/skin-v1/global-dsdd-conversation.tsx");
  assert.match(panel, />Clear draft<\/button>/u);
  assert.match(panel, /"Interpret"/u);
  assert.match(panel, /"Pi draft"/u);
  assert.match(panel, /"Publish brief"/u);
  assert.doesNotMatch(panel, /Build this|action: "build"/u);
});

test("#2354 Clear Draft only clears the current narration textbox", async () => {
  const panel = await read("app/skin-v1/global-dsdd-conversation.tsx");
  const start = panel.indexOf("function clearDraft()");
  const end = panel.indexOf("\n  if (!eligible)", start);
  const block = panel.slice(start, end);
  assert.match(block, /setDraft\(""\)/u);
  assert.doesNotMatch(block, /setMessages|setLockedIntent|setHydrated|authenticatedProfileFetch/u);
});

test("#2354 bounds DSDD interpretation before the 128 KiB session request boundary", async () => {
  const [panel, gateway] = await Promise.all([
    read("app/skin-v1/global-dsdd-conversation.tsx"),
    read("build/dsdd/dsdd-session-gateway.ts"),
  ]);
  assert.match(panel, /MAX_INTERPRETATION_CHARS = 6000/u);
  assert.match(panel, /under 3500 characters/u);
  assert.match(panel, /boundedInterpretation\(body\.text!\)/u);
  assert.match(gateway, /MAX_BODY = 128 \* 1024/u);
  assert.match(gateway, /const interpretation = text\(body\.text, 6000\)/u);
});

test("#2354 Pi Draft uses the canonical read-only Pi runner and cannot mutate the repository", async () => {
  const [draft, runtime, gateway] = await Promise.all([
    read("scripts/dsdd-pi-draft.mjs"),
    read("scripts/pi-worker-runtime.mjs"),
    read("build/dsdd/dsdd-session-gateway.ts"),
  ]);
  assert.match(draft, /runPiReadOnly/u);
  assert.match(draft, /Do not edit, write, delete, run shell commands/u);
  assert.match(runtime, /"--tools", "read,grep,find,ls"/u);
  assert.match(gateway, /runDsddPiBrief/u);
  assert.match(gateway, /repositoryMutation: false/u);
  assert.match(gateway, /mutationAuthority: "none-dsdd"/u);
  assert.doesNotMatch(gateway, /run-uat-repair-agent\.mjs|prepareWorktree|git-worktree/u);
});

test("#2354 Publish Brief creates a GitHub Issue only and deduplicates by persisted intent publication", async () => {
  const [publisher, gateway] = await Promise.all([
    read("scripts/dsdd-publish-brief.mjs"),
    read("build/dsdd/dsdd-session-gateway.ts"),
  ]);
  assert.match(publisher, /"issue", "create"/u);
  assert.match(publisher, /BryanHarrisScripts\/PlotPickle/u);
  assert.doesNotMatch(publisher, /"pr", "create"|git worktree|git commit|git push/u);
  assert.match(gateway, /if \(intent\.publishedIssue\) return \{ session, intent \};/u);
  assert.match(gateway, /action === "publish-brief"/u);
  assert.doesNotMatch(gateway, /action === "build"/u);
});

test("#2354 published Issue preserves Human, DSDD and Pi developer intent without claiming code changes", async () => {
  const gateway = await read("build/dsdd/dsdd-session-gateway.ts");
  for (const contract of [
    "## Human intent",
    "## DSDD interpretation",
    "## Locked requirements",
    "## Pi technical developer draft",
    "DSDD has not edited source, created a branch, committed, pushed, opened a PR, or merged code.",
    "Implementation authority: downstream developer workflow against this Issue",
  ]) assert.ok(gateway.includes(contract), `missing contract: ${contract}`);
});

test("#2354 architecture keeps the visible contract in Layer 2 and Pi handoff in Layer 4", async () => {
  const catalog = await json("config/verification/test-catalog.json");
  const experience = catalog.entries.find((entry) => entry.id === "experience.dsdd-brief-handoff-2354");
  const agent = catalog.entries.find((entry) => entry.id === "agent.dsdd-brief-handoff-2354");
  assert.equal(experience?.ownerLayer, "experience-contract");
  assert.equal(agent?.ownerLayer, "agent-runtime");
  assert.ok(experience?.runner.targets.includes("tests/issue-2354-dsdd-pi-draft-publish-brief.test.mjs"));
  assert.ok(agent?.runner.targets.includes("tests/issue-2354-dsdd-pi-draft-publish-brief.test.mjs"));
});
