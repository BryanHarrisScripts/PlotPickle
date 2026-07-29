import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #187 creates one deterministic Google Meet request per project event", async () => {
  const [meet, calendar] = await Promise.all([
    source("build/google-meet.ts"),
    source("build/google-calendar.ts"),
  ]);
  assert.match(meet, /createHash\("sha256"\)/);
  assert.match(meet, /plotpickle-meet\\0\$\{projectId\}\\0\$\{eventId\}/);
  assert.match(meet, /conferenceSolutionKey: \{ type: "hangoutsMeet" \}/);
  assert.match(meet, /meetConferenceRequestId/);
  assert.match(calendar, /ensureMeetConferenceForEvent/);
  assert.match(calendar, /meeting\.conferenceStatus !== "none"/);
  assert.ok(calendar.indexOf("const existing = await authorizedRequest") < calendar.indexOf('method: "POST"'));
});

test("issue #187 adds conferenceDataVersion only through the owned Calendar event contract", async () => {
  const [calendar, meet, status] = await Promise.all([
    source("build/google-calendar.ts"),
    source("build/google-meet.ts"),
    source("lib/connection-status.ts"),
  ]);
  assert.match(calendar, /conferenceDataVersion=1/);
  assert.match(calendar, /createMeetConferenceData/);
  assert.match(calendar, /method: "PATCH"/);
  assert.match(status, /GOOGLE_MEET_SCOPE = GOOGLE_CALENDAR_SCOPE/);
  assert.doesNotMatch(`${calendar}\n${meet}\n${status}`, /meetings\.googleapis\.com|meetings\.space\.created/);
});

test("issue #187 preserves conference metadata when Calendar events are updated or cancelled", async () => {
  const calendar = await source("build/google-calendar.ts");
  assert.match(calendar, /preserveOrCreateMeetConference\(existing\.conferenceData/);
  assert.match(calendar, /JSON\.stringify\(providerBody\(input, conferenceData\)\)/);
  assert.match(calendar, /method: "PUT"/);
  assert.match(calendar, /cancelCalendarEvent/);
  assert.match(calendar, /method: "DELETE"/);
});

test("issue #187 exposes only sanitized Meet identity, URL and status", async () => {
  const meet = await source("build/google-meet.ts");
  for (const field of ["meetingId", "meetUrl", "conferenceStatus"]) {
    assert.ok(meet.includes(field), `Sanitized Meet metadata is missing: ${field}`);
  }
  assert.match(meet, /url\.protocol !== "https:"/);
  assert.match(meet, /url\.hostname !== "meet\.google\.com"/);
  assert.match(meet, /requestStatus === "pending"/);
  assert.match(meet, /requestStatus === "success"/);
  assert.match(meet, /requestStatus === "failure"/);
  assert.doesNotMatch(meet, /accessToken|refreshToken|attendees|description/);
});

test("issue #187 keeps Meet attachment behind the private loopback gateway", async () => {
  const gateway = await source("build/google-calendar-gateway.ts");
  assert.match(gateway, /MEET_API = "\/api\/local-google\/meet"/);
  assert.match(gateway, /attachMeetConference/);
  assert.match(gateway, /isLocalRequest/);
  assert.match(gateway, /request\.method === "POST" && url\.pathname === MEET_API/);
  assert.doesNotMatch(gateway, /accessToken|refreshToken/);
});

test("issue #187 presents pending, failed and ready meetings without auto-opening links", async () => {
  const [workspace, meetUi, calendarUi] = await Promise.all([
    source("app/collab-workspace.tsx"),
    source("app/google-meet-workspace.tsx"),
    source("app/google-calendar-workspace.tsx"),
  ]);
  assert.match(workspace, /import GoogleMeetWorkspace/);
  assert.match(workspace, /<GoogleMeetWorkspace/);
  assert.match(meetUi, /api\/local-google\/meet/);
  assert.match(meetUi, /Creating link/);
  assert.match(meetUi, /Needs attention/);
  assert.match(meetUi, /Open Google Meet/);
  assert.match(meetUi, /onClick=\{\(\) => openMeetLink\(item\)\}/);
  assert.match(meetUi, /window\.open\(url\.toString\(\), "_blank", "noopener,noreferrer"\)/);
  assert.match(meetUi, /Calendar event remains available/);
  assert.match(calendarUi, /Create Calendar event \+ Meet link/);
  assert.doesNotMatch(`${meetUi}\n${calendarUi}`, /conferenceData|accessToken|refreshToken/);
});

test("issue #187 focused test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-185-google-calendar\.test\.mjs/);
  assert.match(packageJson.scripts.test, /issue-187-google-meet\.test\.mjs/);
  assert.equal(packageJson.scripts["test:google-calendar"], "node --test tests/issue-185-google-calendar.test.mjs");
  assert.equal(packageJson.scripts["test:google-meet"], "node --test tests/issue-187-google-meet.test.mjs");
});
