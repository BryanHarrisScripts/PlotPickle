import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Connected Studios consumes only signed Playhouse Studio presence", async () => {
  const [federation, directory] = await Promise.all([
    read("build/playhouse-federation.ts"),
    read("build/playhouse-directory-gateway.ts"),
  ]);
  assert.match(federation, /export type Availability = "online" \| "away" \| "busy" \| "offline"/);
  assert.match(federation, /export function parseStudioEvent/);
  assert.match(federation, /verifyStudioEvent/);
  assert.match(directory, /parseStudioEvent\(message\.content\)/);
  assert.match(directory, /event\.type === "studio\.test"/);
  assert.match(directory, /latestByStudio/);
});

test("Public Contacts and Invisible discovery are enforced before rendering", async () => {
  const directory = await read("build/playhouse-directory-gateway.ts");
  assert.match(directory, /event\.visibility === "invisible"/);
  assert.match(directory, /event\.visibility === "contacts" && !contacts\.has\(event\.studioId\)/);
  assert.match(directory, /blocked\.has\(event\.studioId\)/);
  assert.match(directory, /own\.configured && event\.studioId === own\.studioId/);
  assert.match(directory, /relationship: contacts\.has\(event\.studioId\) \? "contact" : "public"/);
});

test("moderation and relationships attach to immutable Studio ID", async () => {
  const directory = await read("build/playhouse-directory-gateway.ts");
  assert.match(directory, /const STUDIO_ID = \/\^pp_studio_/);
  assert.match(directory, /current\.blocked = \[\.\.\.new Set\(\[\.\.\.current\.blocked, id\]\)\]/);
  assert.match(directory, /current\.contacts = \[\.\.\.new Set\(\[\.\.\.current\.contacts, id\]\)\]/);
  assert.match(directory, /studioId: id, displayName: event\?\.displayName/);
  assert.match(directory, /playhouse-directory-moderation\.json/);
  assert.match(directory, /writeCredentialJson/);
});

test("Connected Studios UI is a community directory, not network administration", async () => {
  const [workspace, panel, styles] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/connected-studios-panel.tsx"),
    read("app/connected-studios-panel.module.css"),
  ]);
  assert.match(workspace, /ConnectedStudiosPanel/);
  assert.match(workspace, /onOpenGreatHall=\{\(\) => setSection\("great-hall"\)\}/);
  assert.match(panel, /This is a community directory, not a server list/);
  assert.match(panel, /Studio \{studio\.shortCode\}/);
  for (const label of ["Online", "Away", "Busy", "Offline"]) assert.match(`${panel}\n${styles}`, new RegExp(label, "i"));
  for (const label of ["Open Studio", "Visit Great Hall", "Add to Contacts", "Block", "Report"]) assert.match(panel, new RegExp(label));
  assert.match(panel, /Block and report attach to the permanent Studio ID/);
  assert.doesNotMatch(panel, /IP address|127\.0\.0\.1|localhost|Ollama|ComfyUI|Windows username|machine name|filesystem path/i);
});

test("BUZZ outage leaves local creative work available", async () => {
  const [directory, panel] = await Promise.all([
    read("build/playhouse-directory-gateway.ts"),
    read("app/connected-studios-panel.tsx"),
  ]);
  assert.match(directory, /playhouseOnline: false/);
  assert.match(directory, /Local creative work remains available/);
  assert.match(directory, /localCreativeWorkAvailable: true/);
  assert.match(panel, /Playhouse discovery offline/);
  assert.match(panel, /Check my Playhouse presence/);
});
