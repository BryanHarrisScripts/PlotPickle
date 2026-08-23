import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("BUZZ exposes a signed active-room send-and-read round-trip health check", async () => {
  const [gateway, card, settings, vite, workflow, cleanup] = await Promise.all([
    read("build/buzz-live-health-gateway.ts"),
    read("app/buzz-live-health-card.tsx"),
    read("app/sage-settings-workspace.tsx"),
    read("vite.config.ts"),
    read(".github/workflows/buzz-guildhall.yml"),
    read("config/buzz-community-cleanup.json").then(JSON.parse),
  ]);

  assert.match(gateway, /HEALTH_ROOM = "great-hall"/);
  assert.match(gateway, /channel\.name === HEALTH_ROOM && !channel\.archived/);
  assert.match(gateway, /messages", "send"/);
  assert.match(gateway, /messages", "get"/);
  assert.match(gateway, /plotpickle-buzz-health:/);
  assert.match(gateway, /roundTrip: true/);
  assert.match(gateway, /url\.pathname === API/);
  assert.equal(cleanup.retainedRooms.some((room) => room.id === "great-hall"), true);
  assert.equal(cleanup.retiredRooms.some((room) => room.id === "gatehouse"), true);
  assert.doesNotMatch(gateway, /HEALTH_ROOM = "gatehouse"/);
  assert.match(card, /Test live BUZZ connection/);
  assert.match(card, /BUZZ transport reachable/);
  assert.match(card, /Great Hall connection probe/);
  assert.match(card, /Signed test message received/);
  assert.match(card, /\/api\/local-buzz\/live-health/);
  assert.match(settings, /<BuzzLiveHealthCard \/>/);
  assert.match(vite, /buzzLiveHealthGateway\(\)/);
  assert.match(workflow, /tests\/buzz-live-roundtrip\.test\.mjs/);
});

test("BUZZ health status does not claim live connectivity before an explicit round trip", async () => {
  const card = await read("app/buzz-live-health-card.tsx");
  assert.match(card, /roundTripState/);
  assert.match(card, /Not tested yet/);
  assert.match(card, /Round-trip failed/);
  assert.match(card, /response\.ok && body\.roundTrip/);
  assert.doesNotMatch(card, /guildhallReady \? "Signed test message received"/);
});

test("BUZZ live health does not expose secrets or story content in its probe", async () => {
  const gateway = await read("build/buzz-live-health-gateway.ts");
  assert.match(gateway, /safeError/);
  assert.match(gateway, /\[redacted-nsec\]/);
  assert.match(gateway, /signed BUZZ round-trip connection probe/);
  assert.doesNotMatch(gateway, /storyBody|fullPrompt|modelResponse|hiddenReasoning/);
});
