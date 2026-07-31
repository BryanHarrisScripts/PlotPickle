import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #214 registers the local-only Buzz gateway", async () => {
  const [vite, gateway] = await Promise.all([source("vite.config.ts"), source("build/buzz-gateway.ts")]);
  assert.match(vite, /import \{ buzzGateway \} from "\.\/build\/buzz-gateway"/);
  assert.match(vite, /import \{ buzzBundleNormalizer \} from "\.\/build\/buzz-bundle-normalizer"/);
  assert.match(vite, /localConnectionsGateway\(\),\s*buzzBundleNormalizer\(\),\s*buzzGateway\(\)/);
  assert.match(gateway, /const API = "\/api\/local-buzz"/);
  assert.match(gateway, /if \(!isLocalRequest\(request\)\)/);
  assert.match(gateway, /readCredentialJson/);
  assert.match(gateway, /writeCredentialJson/);
  assert.match(gateway, /removeCredentialFile/);
});

test("issue #214 provides project-specific Story Rooms and signed relay operations", async () => {
  const [model, workspace, gateway] = await Promise.all([
    source("lib/buzz-story-room.ts"),
    source("app/buzz-workspace.tsx"),
    source("build/buzz-gateway.ts"),
  ]);
  for (const room of ["story", "characters", "structure", "continuity", "visual-development", "production-notes"]) {
    assert.match(model, new RegExp(`id: "${room}"`));
  }
  assert.match(workspace, /Create missing rooms/);
  assert.match(workspace, /Create reviewable proposal/);
  assert.match(workspace, /Approve into PPF/);
  assert.match(workspace, />Decline</);
  assert.match(gateway, /"channels", "create"/);
  assert.match(gateway, /"messages", "send"/);
  assert.match(gateway, /BUZZ_PRIVATE_KEY/);
});

test("issue #214 keeps PPF authority human-controlled and auditable", async () => {
  const [model, workspace] = await Promise.all([source("lib/buzz-story-room.ts"), source("app/buzz-workspace.tsx")]);
  assert.match(model, /export type BuzzProposalStatus = "open" \| "approved" \| "declined" \| "conflict"/);
  assert.match(model, /source: BuzzDiscussionReference/);
  assert.match(model, /messageId: string/);
  assert.match(model, /decidedAt: string/);
  assert.match(model, /applyBuzzStoryProposal/);
  assert.match(model, /declineBuzzStoryProposal/);
  assert.match(workspace, /window\.localStorage\.setItem\(PROJECT_STORAGE_KEY/);
  assert.match(workspace, /Human approval gate/);
  assert.match(workspace, /Approval writes one exact story field/);
});

test("issue #214 connects Settings to encrypted Phase 1A controls", async () => {
  const settings = await source("app/buzz-settings-panel.tsx");
  assert.match(settings, /Save encrypted connection/);
  assert.match(settings, /Test Buzz connection/);
  assert.match(settings, /Remove connection and identity/);
  assert.match(settings, /Existing Buzz relay/);
  assert.match(settings, /Buzz private key/);
  assert.match(settings, /method: "PUT"/);
  assert.match(settings, /method: "DELETE"/);
});

test("issue #214 exposes the managed Phase 1B lifecycle only behind verified prerequisites", async () => {
  const [settings, gateway, manifest, compose] = await Promise.all([
    source("app/buzz-settings-panel.tsx"),
    source("build/buzz-gateway.ts"),
    source("runtime/buzz/manifest.json"),
    source("runtime/buzz/compose.yml"),
  ]);
  for (const label of ["Install", "Start", "Stop", "Restart", "Repair", "Update pinned bundle", "Back up", "Remove runtime and data"]) {
    assert.match(settings, new RegExp(label));
  }
  assert.match(settings, /getBuzzManagedRuntimeActions/);
  assert.match(gateway, /verifyBundle/);
  assert.match(gateway, /command\("docker", \["compose", "version", "--short"\]/);
  assert.match(gateway, /127\.0\.0\.1/);
  assert.match(manifest, /"sourceTag": "v0\.4\.26"/);
  assert.match(manifest, /"validationGate"/);
  assert.match(compose, /127\.0\.0\.1:\$\{BUZZ_HTTP_PORT/);
});

test("issue #214 stays Buzz-only", async () => {
  const changed = [
    "app/buzz-workspace.tsx",
    "app/settings/buzz/page.tsx",
    "build/buzz-gateway.ts",
    "lib/buzz-runtime.ts",
    "lib/buzz-story-room.ts",
    "runtime/buzz/compose.yml",
    "runtime/buzz/manifest.json",
  ];
  const combined = (await Promise.all(changed.map(source))).join("\n");
  assert.doesNotMatch(combined, /Modem Story Intelligence/i);
  assert.doesNotMatch(combined, /ComfyUI/i);
  assert.doesNotMatch(combined, /Graphic Novel Post-Production Editor/i);
});
