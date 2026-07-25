import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("the primary menu uses the approved short labels in order", async () => {
  const contract = await source("lib/product-direction.ts");
  const labels = ["Dashboard", "Instructions", "Learn", "Plan", "Write", "Storyboard", "Refine", "Reports", "Settings"];
  let lastIndex = -1;
  for (const label of labels) {
    const index = contract.indexOf(`label: "${label}"`);
    assert.ok(index > lastIndex, `Missing or out-of-order menu label: ${label}`);
    lastIndex = index;
  }
});

test("the application renders the shared menu and opens on Dashboard", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /PRODUCT_NAVIGATION/);
  assert.match(page, /type MainTab = ProductNavigationId/);
  assert.match(page, /useState<MainTab>("dashboard")/);
  assert.match(page, /activeTab === "dashboard"[sS]*ProjectOverview/);
  assert.match(page, /className="dashboard-actions"/);
  assert.doesNotMatch(page, /<small>{tab.description}</small>/);
});

test("the brand opens the marketing splash and the top bar stays navigation-only", async () => {
  const page = await source("app/page.tsx");
  const topbar = page.match(/<header className="topbar">([sS]*?)</header>/)?.[1] ?? "";
  assert.match(topbar, /setShowLanding(true)/);
  assert.match(topbar, /Open the PlotPickle marketing page/);
  assert.doesNotMatch(topbar, /project-actions/);
  assert.doesNotMatch(topbar, />New</);
});

test("the proposed menu has responsive styling and Dashboard actions", async () => {
  const css = await source("app/ui-ux-cleanup.css");
  assert.match(css, /Proposed simplified primary menu/);
  assert.match(css, /grid-template-columns: minmax(220px, 0.9fr) minmax(0, 4fr)/);
  assert.match(css, /min-height: 64px/);
  assert.match(css, /.dashboard-actions/);
  assert.match(css, /@media (max-width: 600px)/);
});
