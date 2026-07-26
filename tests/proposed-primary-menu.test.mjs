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

test("the application renders the shared menu with Dashboard ready behind the splash", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /PRODUCT_NAVIGATION/);
  assert.match(page, /type MainTab = ProductNavigationId/);
  assert.match(page, /useState<MainTab>\("dashboard"\)/);
  assert.match(page, /const \[showLanding, setShowLanding\] = useState\(true\)/);
  assert.match(page, /activeTab === "dashboard"[\s\S]*ProjectOverview/);
  assert.match(page, /className="dashboard-actions"/);
  assert.equal((page.match(/ref={fileInputRef}/g) ?? []).length, 1);
  assert.match(page, /<\/header>[\s\S]*ref={fileInputRef}[\s\S]*<div className="project-strip">/);
  assert.doesNotMatch(page, /<small>{tab\.description}<\/small>/);
});

test("the brand opens the marketing splash and the top bar stays navigation-only", async () => {
  const page = await source("app/page.tsx");
  const topbar = page.match(/<header className="topbar">([\s\S]*?)<\/header>/)?.[1] ?? "";
  assert.match(topbar, /setShowLanding\(true\)/);
  assert.match(topbar, /Open the PlotPickle marketing page/);
  assert.doesNotMatch(topbar, /project-actions/);
  assert.doesNotMatch(topbar, />New</);
});

test("the proposed menu has responsive styling and Dashboard actions", async () => {
  const css = await source("app/premium-ui.css");
  assert.match(css, /grid-template-columns:minmax\(190px,1fr\) auto minmax\(190px,1fr\)/);
  assert.match(css, /\.main-tabs\{justify-self:center/);
  assert.match(css, /min-height:70px/);
  assert.match(css, /\.dashboard-actions/);
  assert.match(css, /@media \(max-width: 600px\)/);
});
