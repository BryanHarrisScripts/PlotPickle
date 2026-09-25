import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2289 Library children expose one suppressed feature-owned return to Dashboard", async () => {
  const [library, css, orchestrator] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("app/skin-v1-surface-orchestrator.css"),
    read("app/skin-v1/surface-orchestrator.tsx"),
  ]);

  assert.match(library, /data-library-destination=\{destination\}[\s\S]*data-skin-v1-local-return="true"[\s\S]*onClick=\{openActiveProject\}[\s\S]*>Back to Dashboard<\/button>/u);
  assert.doesNotMatch(library, /data-library-back="directory"/u);
  assert.match(css, /\[data-skin-v1-orchestrator-active="true"\] \[data-skin-v1-local-return="true"\][\s\S]*display:\s*none !important/u);
  assert.match(orchestrator, /"\[data-skin-v1-local-return\]"/u);
  assert.match(orchestrator, /activateExistingReturn\(active\)/u);
});

test("#2289 live WebMCP audit proves Library child → Dashboard continuity", async () => {
  const audit = await read("lib/verification/skin-v1-menu-contract-audit.mjs");

  const openLibrary = audit.indexOf('page.keyboard.press("L")');
  const openChild = audit.indexOf('[data-library-nav=\'new\']');
  const backDashboard = audit.indexOf('clickSurfaceReturn(page, "Back to Dashboard")', openChild);

  assert.ok(openLibrary >= 0);
  assert.ok(openChild > openLibrary);
  assert.ok(backDashboard > openChild);
  assert.doesNotMatch(audit, /library-nested-return/u);
});
