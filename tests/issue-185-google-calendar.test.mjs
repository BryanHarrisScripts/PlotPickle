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

test("issue #185 creates only Calendar events without conference data", async () => {
  const calendar = await source("build/google-calendar.ts");
  assert.match(calendar, /calendars\/primary\/events/);
  assert.match(calendar, /sendUpdates=all/);
  assert.match(calendar, /extendedProperties/);
  assert.match(calendar, /plotpickleProjectId/);
  assert.match(calendar, /plotpickleEventId/);
  assert.doesNotMatch(calendar, /conferenceData|conferenceDataVersion|hangoutLink|meet\.google/);
});

test("issue #185 makes create retries deterministic and non-duplicating", async () => {
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

test("issue #185 returns only sanitized event metadata", async () => {
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
  ]) assert.ok(calendar.includes(field), `Sanitized event result is missing: ${field}`);
  assert.doesNotMatch(calendar, /return\s+connection|refreshToken/);
});
