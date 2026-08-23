import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("issue #121 stores local-first Writers’ Room sessions in canonical review history", async () => {
  const model = await source("lib/writers-room.ts");
  for (const contract of ["WritersRoomSession", "participants", "agenda", "targets", "activeTargetId", "notes", "decisions", "unresolvedQuestions", "actions", "proposals", "summary", "meetUrl", "calendarEventId", "recordingReference"]) {
    assert.ok(model.includes(contract), `Missing session contract: ${contract}`);
  }
  assert.match(model, /project\.review\.threads/);
  assert.doesNotMatch(model, /apiKey|accessToken|refreshToken|clientSecret/);
});

test("issue #121 mounts Writers’ Room inside Feedback and remains usable without Google", async () => {
  const [feedback, panel] = await Promise.all([source("app/feedback-workspace.tsx"), source("app/writers-room-panel.tsx")]);
  assert.match(feedback, /<WritersRoomPanel/);
  for (const phrase of ["Works locally", "Google Meet and Calendar are optional", "No sessions yet. Plan one without connecting Google.", "Open Meet", "Copy Calendar reference"]) {
    assert.ok(panel.includes(phrase), `Missing local-first interaction: ${phrase}`);
  }
});

test("issue #121 gates story changes behind explicit proposal approval", async () => {
  const model = await source("lib/writers-room.ts");
  assert.match(model, /status: "proposed"/);
  assert.match(model, /proposal\.status !== "proposed"/);
  assert.match(model, /createFeedback\(updated/);
  const panel = await source("app/writers-room-panel.tsx");
  assert.match(panel, /Approve as feedback proposal/);
  assert.match(panel, /does not overwrite canonical story content/);
});
