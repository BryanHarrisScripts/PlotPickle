import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2289 Library children expose one suppressed feature-owned return to the Library directory", async () => {
  const [library, css, orchestrator] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("app/skin-v1-surface-orchestrator.css"),
    read("app/skin-v1/surface-orchestrator.tsx"),
  ]);

  assert.match(library, /data-library-destination=\{destination\}[\s\S]*data-skin-v1-local-return="true"[\s\S]*onClick=\{returnToDirectory\}[\s\S]*>Back to Library<\/button>/u);
  assert.doesNotMatch(library, /data-library-back="directory"/u);
  assert.match(css, /\[data-skin-v1-orchestrator-active="true"\] \[data-skin-v1-local-return="true"\][\s\S]*display:\s*none !important/u);
  assert.match(orchestrator, /"\[data-skin-v1-local-return\]"/u);
  assert.match(orchestrator, /activateExistingReturn\(active\)/u);
});

test("#2289 live WebMCP audit proves Library child → Library → Dashboard continuity", async () => {
  const audit = await read("lib/verification/skin-v1-menu-contract-audit.mjs");

  const openLibrary = audit.indexOf('page.keyboard.press("L")');
  const openChild = audit.indexOf('[data-library-nav=\'new\']');
  const backLibrary = audit.indexOf('clickSurfaceReturn(page, "Back to Library")');
  const backDashboard = audit.indexOf('clickSurfaceReturn(page, "Back to Dashboard")', backLibrary);

  assert.ok(openLibrary >= 0);
  assert.ok(openChild > openLibrary);
  assert.ok(backLibrary > openChild);
  assert.ok(backDashboard > backLibrary);
  assert.match(audit, /library-nested-return/u);
  assert.match(audit, /nestedDestination"[\s\S]*"still-open"[\s\S]*"closed"/u);
});
