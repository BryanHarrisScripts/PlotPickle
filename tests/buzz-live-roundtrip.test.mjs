import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("BUZZ Guildhall exposes a signed Great Hall round-trip health check", async () => {
  const [gateway, settings, workflow] = await Promise.all([
    read("build/buzz-guildhall-gateway.ts"),
    read("app/buzz-settings-panel.tsx"),
    read(".github/workflows/buzz-guildhall.yml"),
  ]);

  assert.match(gateway, /messages", "send"/);
  assert.match(gateway, /messages", "get"/);
  assert.match(gateway, /plotpickle-buzz-health:/);
  assert.match(gateway, /roundTrip/);
  assert.match(gateway, /url\.pathname === `\$\{API\}\/health`/);
  assert.match(settings, /Test live BUZZ connection/);
  assert.match(settings, /Guildhall reachable/);
  assert.match(settings, /Signed test message received/);
  assert.match(settings, /\/guildhall\/health/);
  assert.match(workflow, /tests\/buzz-live-roundtrip\.test\.mjs/);
});

test("BUZZ health status does not claim live connectivity before an explicit round trip", async () => {
  const settings = await read("app/buzz-settings-panel.tsx");
  assert.match(settings, /roundTripState/);
  assert.match(settings, /Not tested yet/);
  assert.match(settings, /Round-trip failed/);
  assert.doesNotMatch(settings, /guildhallReady \? "Signed test message received"/);
});
