import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const sdkSource = fs.readFileSync("sdk/plugin/src/index.ts", "utf8");
const testingSource = fs.readFileSync("sdk/plugin/src/testing.ts", "utf8");
const packageSource = JSON.parse(fs.readFileSync("sdk/plugin/package.json", "utf8"));

const requiredEvents = [
  "ProjectOpened", "ProjectSaved", "CanonChanged", "CharacterUpdated", "SceneChanged",
  "ScreenplayChanged", "StoryboardChanged", "TimelineUpdated", "ApprovalGranted",
  "AICompleted", "ExportCompleted",
];

test("Phase 9B exposes the public plugin SDK package", () => {
  assert.equal(packageSource.name, "@plotpickle/plugin-sdk");
  assert.equal(packageSource.exports["./testing"].types, "./dist/testing.d.ts");
  assert.equal(packageSource.exports["./testing"].import, "./dist/testing.js");
  assert.match(sdkSource, /PLOTPICKLE_PLUGIN_SDK_VERSION/);
});

test("Phase 9B declares all initial typed events", () => {
  for (const event of requiredEvents) assert.match(sdkSource, new RegExp(`\\b${event}\\b`));
  assert.match(sdkSource, /class TypedEventBus/);
  assert.match(sdkSource, /async emit</);
});

test("subscriptions and registrations are disposable", () => {
  assert.match(sdkSource, /class DisposableStore/);
  assert.match(sdkSource, /registerCommand/);
  assert.match(sdkSource, /registerMenu/);
  assert.match(sdkSource, /registerPanel/);
  assert.match(sdkSource, /registerWorkspace/);
  assert.match(sdkSource, /this\.subscriptions\.dispose\(\)/);
});

test("permission failures are explicit and testable", () => {
  assert.match(sdkSource, /class PermissionError/);
  assert.match(sdkSource, /createPermissionAwareServices/);
  assert.match(sdkSource, /assertPermission/);
});

test("mock activation host and development reload boundaries exist", () => {
  assert.match(testingSource, /class MockPluginHost/);
  assert.match(testingSource, /class MockRegistrationHost/);
  assert.match(sdkSource, /createDevelopmentSession/);
  assert.match(sdkSource, /await host\?\.deactivate\(\)/);
});
