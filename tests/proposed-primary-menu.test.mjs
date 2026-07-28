import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("the primary menu uses the approved short labels in order", async () => {
  const contract = await source("lib/product-direction.ts");
  const primary = contract.slice(
    contract.indexOf("export const PRIMARY_WORKFLOW_NAVIGATION"),
    contract.indexOf("export const PRODUCT_NAVIGATION"),
  );
  const labels = ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Pitch", "Build", "Feedback", "Refine", "Reports"];
  let lastIndex = -1;
  for (const label of labels) {
    const index = primary.indexOf(`label: "${label}"`);
    assert.ok(index > lastIndex, `Missing or out-of-order menu label: ${label}`);
    lastIndex = index;
  }
  assert.equal([...primary.matchAll(/label: "/g)].length, labels.length);
  assert.doesNotMatch(primary, /Introduction|Settings/);
});

test("the application renders the shared shell and command-centre Dashboard behind the splash", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /ApplicationShellHeader/);
  assert.match(page, /DashboardCommandCentre/);
  assert.match(page, /type MainTab = ProductNavigationId/);
  assert.match(page, /useState<MainTab>\("dashboard"\)/);
  assert.match(page, /const \[showLanding, setShowLanding\] = useState\(true\)/);
  assert.equal((page.match(/ref={fileInputRef}/g) ?? []).length, 1);
  assert.doesNotMatch(page, /className="dashboard-actions"/);
  assert.doesNotMatch(page, /const dashboardStatuses/);
});

test("the shared header owns the two workflow groups, project actions and configuration", async () => {
  const shell = await source("app/application-shell-header.tsx");
  for (const zone of ["shell-zone-discovery", "shell-zone-production", "shell-zone-project-actions", "shell-zone-configuration"]) assert.ok(shell.includes(zone), `Missing shell zone: ${zone}`);
  assert.match(shell, /Discovery &amp; Pre-Production/);
  assert.match(shell, /Production &amp; Polishing/);
  assert.match(shell, /onOpenLanding/);
  assert.match(shell, /PROJECT_ACTIONS\.map/);
  assert.match(shell, /Open the PlotPickle marketing page/);
});

test("the Dashboard command centre has responsive local styling", async () => {
  const css = await source("app/dashboard-command-centre.module.css");
  assert.match(css, /grid-template-columns:250px minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:1100px\)/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /tone-green/);
  assert.match(css, /tone-yellow/);
  assert.match(css, /tone-red/);
});
