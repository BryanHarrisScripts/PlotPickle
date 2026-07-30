import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Graphic Novel language and entire-cast regeneration replace the old Comic Book UX", async () => {
  const [direction, workspace, queue] = await Promise.all([
    read("lib/product-direction.ts"),
    read("app/ai-pitch-deck-workspace.tsx"),
    read("app/use-cast-identity-queue.ts"),
  ]);
  assert.doesNotMatch(direction, /comic-book|Comic Book/);
  assert.match(workspace, /Regenerate Entire Cast/);
  assert.match(workspace, /Existing locked identities remain active/);
  assert.match(workspace, /paid image API calls/);
  assert.match(queue, /for \(const queueItem of remaining\)/);
  assert.match(queue, /window\.confirm/);
  assert.match(queue, /saveVisualIdentityDraft/);
  assert.doesNotMatch(queue, /approvePendingVisualIdentity|lockCharacterVisualIdentity/);
});

test("Dashboard separates loaded source, local storage, GitHub repository and approved story", async () => {
  const dashboard = await read("app/dashboard-command-centre.tsx");
  assert.match(dashboard, /Current project source/);
  assert.match(dashboard, /Local project on this device/);
  assert.match(dashboard, /Repository configured; local project still loaded/);
  assert.match(dashboard, /GitHub repository working copy/);
  assert.match(dashboard, /Local project disconnected/);
  assert.match(dashboard, /<dt>Loaded story|<span>Loaded story/);
  assert.match(dashboard, /<dt>Local storage/);
  assert.match(dashboard, /<dt>GitHub repository/);
  assert.match(dashboard, /<dt>Approved story/);
  assert.match(dashboard, /source\.isBundledExample && afterglowMessage/);
});

test("New and imported project entry points do not expose Afterglow-specific labels", async () => {
  const [header, simpleStart, direction] = await Promise.all([
    read("app/application-shell-header.tsx"),
    read("app/simple-start.tsx"),
    read("lib/product-direction.ts"),
  ]);
  assert.match(header, /Load Example/);
  assert.doesNotMatch(simpleStart, /[>\"](?:Load|Explore|Open)[^<\"]*Afterglow/);
  assert.match(simpleStart, /bundled example project/);
  assert.match(direction, /load-afterglow", label: "Load Example/);
});

test("Approvals explains GitHub as the provider instead of the connection screen", async () => {
  const collab = await read("app/collab-workspace.tsx");
  assert.match(collab, /Powered by GitHub/);
  assert.match(collab, /It is not the GitHub connection screen/);
  assert.match(collab, /View GitHub connection settings/);
  assert.match(collab, /Approved story refresh required/);
  assert.match(collab, /repository connected|Repository \{githubConnected/);
});

test("Refresh actions share an accessible glyph component", async () => {
  const [component, workspace, collab, dashboard] = await Promise.all([
    read("app/refresh-action.tsx"),
    read("app/ai-pitch-deck-workspace.tsx"),
    read("app/collab-workspace.tsx"),
    read("app/dashboard-command-centre.tsx"),
  ]);
  assert.match(component, /aria-label=\{text\}/);
  assert.match(component, /aria-busy/);
  assert.match(component, /↻/);
  assert.match(workspace, /RefreshAction label="Refresh plan, keep completed art"/);
  assert.match(collab, /RefreshAction/);
  assert.match(dashboard, /RefreshAction/);
});

test("Windows navigation polish removes the Learn tab scrollbar and strengthens active navigation", async () => {
  const css = await read("app/issue-208-polish.css");
  assert.match(css, /\.learn-section-tabs[\s\S]*overflow: visible !important/);
  assert.match(css, /\.learn-section-tabs::-webkit-scrollbar[\s\S]*display: none/);
  assert.match(css, /\.application-shell-header \.main-tabs button\.active/);
  assert.match(css, /height: 4px !important/);
  assert.match(css, /font-weight: 900/);
});
