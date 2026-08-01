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
  const [model, workspace, workspaceStyles, gateway] = await Promise.all([
    source("lib/buzz-story-room.ts"),
    source("app/buzz-workspace.tsx"),
    source("app/buzz-workspace.module.css"),
    source("build/buzz-gateway.ts"),
  ]);
  for (const room of ["story", "characters", "structure", "continuity", "visual-development", "production-notes"]) {
    assert.match(model, new RegExp(`id: "${room}"`));
  }
  assert.match(workspace, /Create missing rooms/);
  assert.match(workspace, /Create reviewable proposal/);
  assert.match(workspace, /Approve into PPF/);
  assert.match(workspace, />Decline</);
  for (const className of ["setupGuide", "workspaceGrid", "roomRail", "conversation", "proposalBuilder", "reviewQueue"]) {
    assert.match(workspaceStyles, new RegExp(`\\.${className}\\b`));
  }
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
  const [settings, collab, settingsPanel, compatibilityRoute, taxonomy] = await Promise.all([
    source("app/buzz-settings-panel.tsx"),
    source("app/collab-workspace.tsx"),
    source("app/settings-panel.tsx"),
    source("app/settings/buzz/page.tsx"),
    source("config/settings-system-taxonomy.json"),
  ]);
  assert.match(settings, /Save & verify all three pieces/);
  assert.match(settings, /Test Buzz connection/);
  assert.match(settings, /Remove connection and identity/);
  assert.match(settings, /Block-hosted Buzz community/);
  assert.match(settings, /Buzz private identity key/);
  assert.match(settings, /wss:\/\/plotpickleplayhouse\.communities\.buzz\.xyz/);
  assert.match(settings, /Settings &gt; Profile &gt; Identity &gt; Private key/);
  assert.match(settings, /Do not paste the public npub/);
  assert.match(settings, /buzz:\/\/add-community\?\$\{query\.toString\(\)\}/);
  assert.match(settings, /Buzz calls shared discussion spaces|Buzz (?:already )?uses <strong>channels/);
  assert.match(settings, /huddles/);
  assert.match(settings, /method: "PUT"/);
  assert.match(settings, /method: "DELETE"/);
  assert.match(collab, /onOpenSettings\("buzz"\)/);
  assert.doesNotMatch(collab, /onOpenSettings=\{\(\) => onOpenSettings\("github"\)\}/);
  assert.match(settingsPanel, /activeItem\.target === "buzz"/);
  assert.match(compatibilityRoute, /SETTINGS_SECTION_KEY, "buzz"/);
  assert.doesNotMatch(compatibilityRoute, /SETTINGS_SECTION_KEY, "github"/);
  assert.match(taxonomy, /"target": "buzz"/);
});

test("issue #214 verifies the hosted community, CLI and paired identity together", async () => {
  const [settings, gateway] = await Promise.all([
    source("app/buzz-settings-panel.tsx"),
    source("build/buzz-gateway.ts"),
  ]);
  assert.match(gateway, /await runBuzz\(connection, \["users", "get"\]\)/);
  assert.match(gateway, /verificationVersion: retainVerification \? 2 : undefined/);
  assert.match(gateway, /identityVerified: connection\.verificationVersion === 2/);
  assert.match(gateway, /Buzz rejected this identity or it is not a member of the community/);
  assert.match(settings, /reachable && identityVerified \? "connected" : "degraded"/);
  assert.match(settings, /Save & verify all three pieces/);
  assert.match(settings, /The public npub cannot sign these actions/);
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
