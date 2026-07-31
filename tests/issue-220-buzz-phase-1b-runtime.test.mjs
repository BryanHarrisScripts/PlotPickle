import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #220 centralizes managed Buzz lifecycle guards", async () => {
  const policy = await source("lib/buzz-managed-runtime.ts");
  assert.match(policy, /getBuzzManagedRuntimeActions/);
  assert.match(policy, /const prerequisitesReady = state\.bundleAvailable && state\.dockerAvailable/);
  assert.match(policy, /const transitional = \["configuring", "starting", "stopping"\]/);
  assert.match(policy, /install: prerequisitesReady && !state\.installed/);
  assert.match(policy, /start: prerequisitesReady && state\.installed && state\.configured && !state\.running/);
  assert.match(policy, /backup: state\.installed && state\.running && state\.reachable/);
  assert.match(policy, /remove: state\.installed && !state\.running/);
});

test("issue #220 prevents stopped-only maintenance while managed Buzz is running", async () => {
  const policy = await source("lib/buzz-managed-runtime.ts");
  assert.match(policy, /repair: prerequisitesReady && state\.installed && !state\.running && repairState/);
  assert.match(policy, /update: prerequisitesReady && state\.installed && !state\.running/);
  assert.match(policy, /remove: state\.installed && !state\.running/);
});

test("issue #220 wires the shared policy into Repository and Collab settings", async () => {
  const settings = await source("app/buzz-settings-panel.tsx");
  assert.match(settings, /getBuzzManagedRuntimeActions/);
  assert.match(settings, /describeBuzzManagedRuntime/);
  assert.match(settings, /disabled=\{!managedActions\.install \|\| blocked\}/);
  assert.match(settings, /disabled=\{!managedActions\.backup \|\| blocked\}/);
  assert.match(settings, /disabled=\{!managedActions\.remove \|\| blocked\}/);
  assert.match(settings, /Stop managed Buzz before removing its runtime and data/);
  assert.match(settings, /Updates, repairs and removal require the managed runtime to be stopped/);
});

test("issue #220 preserves the pinned local-only deployment boundary", async () => {
  const [gateway, manifest, compose] = await Promise.all([
    source("build/buzz-gateway.ts"),
    source("runtime/buzz/manifest.json"),
    source("runtime/buzz/compose.yml"),
  ]);
  assert.match(gateway, /verifyBundle/);
  assert.match(gateway, /MANAGED_RELAY_URL = "http:\/\/127\.0\.0\.1:3000"/);
  assert.match(gateway, /writeCredentialJson\(MANAGED_SECRETS_FILE/);
  assert.match(manifest, /"localOnly": true/);
  assert.match(manifest, /"validationGate"/);
  assert.match(compose, /127\.0\.0\.1:\$\{BUZZ_HTTP_PORT/);
});

test("issue #220 does not weaken the human canon boundary", async () => {
  const [settings, storyRoom] = await Promise.all([
    source("app/buzz-settings-panel.tsx"),
    source("lib/buzz-story-room.ts"),
  ]);
  assert.match(settings, /Only an explicit human approval applies a selected proposal/);
  assert.match(storyRoom, /applyBuzzStoryProposal/);
  assert.match(storyRoom, /declineBuzzStoryProposal/);
});
