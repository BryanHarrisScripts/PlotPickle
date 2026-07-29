import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #185 keeps Calendar transport private and loopback-only", async () => {
  const [calendar, gateway, vite] = await Promise.all([
    source("build/google-calendar.ts"),
    source("build/google-calendar-gateway.ts"),
    source("vite.config.ts"),
  ]);
  assert.match(calendar, /checkGoogleConnection/);
  assert.match(calendar, /GOOGLE_CALENDAR_SCOPE/);
  assert.match(gateway, /isLocalRequest/);
  assert.match(gateway, /127\.0\.0\.1/);
  assert.match(vite, /googleCalendarGateway\(\)/);
  assert.doesNotMatch(gateway, /accessToken|refreshToken/);
});

test("issue #185 keeps stable Calendar ownership while Meet is layered through conference data", async () => {
  const [calendar, meet] = await Promise.all([
    source("build/google-calendar.ts"),
    source("build/google-meet.ts"),
  ]);
  assert.match(calendar, /calendars\/primary\/events/);
  assert.match(calendar, /sendUpdates=all/);
  assert.match(calendar, /extendedProperties/);
  assert.match(calendar, /plotpickleProjectId/);
  assert.match(calendar, /plotpickleEventId/);
  assert.match(calendar, /conferenceDataVersion=1/);
  assert.match(meet, /conferenceSolutionKey/);
  assert.doesNotMatch(`${calendar}\n${meet}`, /meetings\.googleapis\.com|meetings\.space\.created/);
});

test("issue #185 makes Calendar create retries deterministic and non-duplicating", async () => {
  const calendar = await source("build/google-calendar.ts");
  assert.match(calendar, /createHash\("sha256"\)/);
  assert.match(calendar, /projectId.*eventId/s);
  assert.ok(calendar.indexOf("authorizedRequest(`/calendars/primary/events/${encodeURIComponent(id)}`)") < calendar.indexOf('method: "POST"'));
  assert.match(calendar, /slice\(0, 48\)/);
});

test("issue #185 supports project-focused list update and cancel", async () => {
  const [calendar, gateway] = await Promise.all([
    source("build/google-calendar.ts"),
    source("build/google-calendar-gateway.ts"),
  ]);
  for (const contract of [
    "listCalendarEvents",
    "updateCalendarEvent",
    "cancelCalendarEvent",
    "privateExtendedProperty",
    "singleEvents",
    "showDeleted",
    "orderBy",
  ]) assert.ok(calendar.includes(contract), `Calendar contract is missing: ${contract}`);
  assert.match(gateway, /request\.method === "GET"/);
  assert.match(gateway, /request\.method === "POST"/);
  assert.match(gateway, /request\.method === "PUT"/);
  assert.match(gateway, /request\.method === "DELETE"/);
});

test("issue #185 returns only sanitized event and conference metadata", async () => {
  const calendar = await source("build/google-calendar.ts");
  for (const field of [
    "eventId",
    "providerEventId",
    "projectId",
    "title",
    "start",
    "end",
    "timeZone",
    "status",
    "organizer",
    "attendeeCount",
    "updatedAt",
    "meetingId",
    "meetUrl",
    "conferenceStatus",
  ]) assert.ok(calendar.includes(field), `Sanitized event result is missing: ${field}`);
  assert.doesNotMatch(calendar, /return\s+connection|refreshToken/);
});

test("issue #185 exposes Calendar CRUD in Collab without leaking raw conference data", async () => {
  const [workspace, calendarUi, meetUi] = await Promise.all([
    source("app/collab-workspace.tsx"),
    source("app/google-calendar-workspace.tsx"),
    source("app/google-meet-workspace.tsx"),
  ]);
  assert.match(workspace, /GoogleCalendarWorkspace/);
  assert.match(workspace, /GoogleMeetWorkspace/);
  assert.match(calendarUi, /api\/local-google\/calendar/);
  assert.match(calendarUi, /method: existing \? "PUT" : "POST"/);
  assert.match(calendarUi, /method: "DELETE"/);
  assert.match(calendarUi, /does not import the complete personal calendar/);
  assert.match(calendarUi, /only sanitized metadata reaches this screen/);
  assert.match(meetUi, /api\/local-google\/meet/);
  assert.doesNotMatch(`${calendarUi}\n${meetUi}`, /conferenceData|hangoutLink|accessToken|refreshToken/);
});

test("issue #185 focused test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-185-google-calendar\.test\.mjs/);
  assert.equal(packageJson.scripts["test:google-calendar"], "node --test tests/issue-185-google-calendar.test.mjs");
});
