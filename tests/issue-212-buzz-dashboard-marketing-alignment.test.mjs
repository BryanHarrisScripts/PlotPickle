import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #212 makes Buzz configurable in Settings without faking packaged binaries", async () => {
  const [settings, runtime, gateway, header] = await Promise.all([
    source("app/buzz-settings-panel.tsx"),
    source("lib/buzz-runtime.ts"),
    source("build/buzz-gateway.ts"),
    source("app/application-shell-header.tsx"),
  ]);

  assert.match(settings, /Settings · Repository & Collab · Buzz/);
  assert.match(settings, /Managed local Buzz/);
  assert.match(settings, /Block-hosted Buzz community/);
  assert.match(settings, /Save encrypted connection/);
  assert.match(settings, /Test Buzz connection/);
  assert.match(settings, /Remove connection and identity/);
  assert.match(settings, />Start</);
  assert.match(settings, />Stop</);
  assert.match(settings, />Restart</);
  assert.match(settings, />Repair</);
  assert.match(settings, />Back up</);
  assert.match(settings, /Remove runtime and data/);
  assert.match(settings, /getBuzzManagedRuntimeActions/);
  assert.match(gateway, /writeCredentialJson/);
  assert.match(gateway, /verifyBundle/);
  assert.match(gateway, /127\.0\.0\.1/);
  assert.doesNotMatch(header, /Buzz Setup|\/settings\/buzz/);
  assert.match(header, /data-legacy-workspace-label="pitch"/);
  assert.match(header, /hidden[\s\S]*aria-hidden="true"[\s\S]*role="tab"[\s\S]*aria-selected=\{activeTab === "pitch"\}[\s\S]*onClick=\{\(\) => onNavigate\("pitch"\)\}[\s\S]*Pitch[\s\S]*<\/button>/);
  assert.match(runtime, /packaged: false/);
  assert.match(runtime, /processRunning: false/);
  assert.match(runtime, /relayListening: false/);
  assert.match(runtime, /identityCreated: false/);
  assert.match(runtime, /dataCreated: false/);
});

test("issue #212 aligns the real Dashboard with product-authentic cards", async () => {
  const dashboard = await source("app/project-overview.tsx");

  for (const label of [
    "Storyworld Overview",
    "Writing Progress",
    "Recent Activity",
    "GitHub Approvals",
    "Optional Buzz workspace",
    "Storage & Backups",
    "Canon & decisions",
  ]) assert.match(dashboard, new RegExp(label.replace(/[&]/g, "\\&")));

  assert.match(dashboard, /Current project source/);
  assert.match(dashboard, /Real project state/);
  assert.match(dashboard, /Configure Buzz/);
  assert.match(dashboard, /Open Collab approvals/);
  assert.match(dashboard, /plotpickle\.settings\.section/);
  assert.doesNotMatch(dashboard, /avatar|collaborators online|mascot/i);
});

test("issue #212 updates Splash positioning README and explicit workspace deep links", async () => {
  const [direction, splash, wrapper, readme] = await Promise.all([
    source("lib/product-direction.ts"),
    source("app/marketing-splash-base.tsx"),
    source("app/marketing-splash.tsx"),
    source("README.md"),
  ]);

  assert.match(direction, /Graphic Novel/);
  assert.match(direction, /Collab \+ Buzz/);
  assert.match(direction, /optional Buzz rooms, agents and development discussion/i);
  assert.match(splash, /Product-authentic PlotPickle Dashboard preview/);
  assert.match(splash, /Buzz is dormant by default/);
  assert.doesNotMatch(splash, /collaborators online|user avatar/i);
  assert.match(wrapper, /DEEP_LINK_WORKSPACES/);
  assert.match(wrapper, /React\.useLayoutEffect/);
  assert.match(wrapper, /requestedWorkspace && DEEP_LINK_WORKSPACES\.has\(requestedWorkspace\)/);
  for (const workspace of ["dashboard", "settings", "collab", "feedback", "reports"]) {
    assert.match(wrapper, new RegExp(`"${workspace}"`));
  }
  assert.match(readme, /Dashboard · Learn · Plan · Storyboard · Write · Graphic Novel/);
  assert.match(readme, /Buzz: optional and dormant by default/);
  assert.match(readme, /no Buzz process runs/);
  assert.match(readme, /pinned Buzz `v0\.4\.26` Docker Compose bundle/);
  assert.match(readme, /does not embed or advertise unverified platform-native Buzz executables/);
  assert.match(readme, /Windows/);
  assert.match(readme, /macOS/);
  assert.match(readme, /Linux/);
  assert.match(readme, /GNU AGPLv3 or later/);
  assert.match(readme, /Not yet claimed as shipped/);
});
