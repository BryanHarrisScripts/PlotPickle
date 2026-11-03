import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = file => readFile(new URL("../" + file, import.meta.url), "utf8");

test("#3355 mounts a real Agent Workspace in the existing Collab entry", async () => {
  const [page, entry, styles] = await Promise.all([
    read("app/page.tsx"),
    read("app/_components/collab/collab-entry-workspace.tsx"),
    read("app/_components/collab/collab-entry-workspace.module.css"),
  ]);
  assert.match(page, /<CollabEntryWorkspace projectTitle=\{currentProjectTitle\(\)\}/);
  assert.match(entry, /aria-label="Elara Agent Workspace"/);
  assert.match(entry, /<TwoWayConversationTest\s*\/>/);
  assert.match(entry, /const STAGES = \["Build", "Test", "Fix", "Verify", "Merge"\]/);
  assert.match(entry, /Teams 2–5 are planned, not installed/);
  assert.match(styles, /\.teamRoles\s*\{/);
  assert.match(styles, /@media \(max-width: 36rem\)/);
  assert.match(entry, /data-agent-columns="story-mission-conversation"/);
  const storyIndex = entry.indexOf('aria-label="Story and mission navigator"');
  const canvasIndex = entry.indexOf('aria-label="Mission canvas"');
  const roomIndex = entry.indexOf('aria-label="Creative Room and durable conversation evidence"');
  assert.ok(storyIndex > 0 && storyIndex < canvasIndex && canvasIndex < roomIndex,
    "the story, mission and conversation columns must keep their shared order");
  assert.match(entry, /href="\/storyboard"/);
  assert.match(entry, /href="\/previs"/);
  assert.match(entry, /Act, Sequence, Block, Mini-Block and Shot are not selected here/);
  assert.match(styles, /\.agentColumns\s*\{/);
  assert.match(styles, /\.agentRoom\s*\{/);
  assert.match(styles, /grid-template-columns:\s*minmax\(12rem,/);
  assert.match(styles, /@media \(max-width: 48rem\)/);
});

test("#3355 cannot turn a heartbeat or a test reply into a worker, reviewer or merge", async () => {
  const source = await read("app/_components/collab/collab-entry-workspace.tsx");
  assert.match(source, /authenticatedProfileFetch\(SUPERVISOR_ENDPOINT/);
  assert.match(source, /authenticatedProfileFetch\(CONVERSATION_ENDPOINT/);
  assert.match(source, /supervisor\.sourceHead === conversation\.sourceHead/);
  assert.match(source, /conversation\?\.code === "ANSWERED"/);
  assert.match(source, /conversation\.plotpickleToChatgpt === "VERIFIED"/);
  assert.match(source, /conversation\.chatgptToPlotpickle === "VERIFIED"/);
  assert.match(source, /setSupervisor\(null\)/);
  assert.match(source, /setConversation\(null\)/);
  assert.match(source, /Specialist agent/);
  assert.match(source, /NOT ASSIGNED · No delegation grant/);
  assert.match(source, /"NOT AUTHORIZED" : "NOT VERIFIED"/);
  assert.doesNotMatch(source, /autoMerge|grantCoding|startWorker|spawn\(/);
});

test("#3355 reuses the existing profile-authorized, durable conversation gate", async () => {
  const [source, ui, http, server] = await Promise.all([
    read("app/_components/collab/collab-entry-workspace.tsx"),
    read("app/_components/settings/tunnel/two-way-conversation-panel.tsx"),
    read("scripts/engineering-team/gateway/conversation-http.mjs"),
    read("app/api/factory/conversation/route.ts"),
  ]);
  assert.match(source, /from "\.\.\/settings\/tunnel\/two-way-conversation-panel"/);
  assert.match(ui, /authenticatedProfileFetch\(ENDPOINT/);
  assert.match(ui, /plotpickleToChatgpt/);
  assert.match(ui, /chatgptToPlotpickle/);
  assert.match(http, /await authorize\(request, mutation\)/);
  assert.match(http, /ACTION_NOT_AUTHORIZED/);
  assert.match(server, /authorizeLocalFactoryRequest/);
  assert.doesNotMatch(source, /(?:window\.)?(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(/);
  assert.doesNotMatch(source, /fetch\("https?:\/\//);
});
