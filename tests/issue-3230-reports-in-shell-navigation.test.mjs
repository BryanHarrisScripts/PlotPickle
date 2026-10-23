import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (name) => readFile(path.join(root, name), "utf8");

test("#3230 embedded Reports uses canonical host return without route or login reload", async () => {
  const [host, explorer, page, workspace] = await Promise.all([
    source("app/skin-v1/dashboard-bbs-review-host.tsx"),
    source("app/_components/dashboard/dashboard-exploration-surface.tsx"),
    source("app/reports/page.tsx"),
    source("app/reports/library-ppf-reports-workspace.tsx"),
  ]);
  assert.match(host, /const closeExploration = \(\) => \{/u);
  assert.match(host, /url\.searchParams\.set\("workspace", "dashboard"\)/u);
  assert.match(host, /onBackDashboard=\{closeExploration\}/u);
  assert.match(explorer, /<ReportsPage onBackDashboard=\{onBackDashboard\} onOpenLibrary=\{onOpenLibrary\}/u);
  assert.match(page, /onBackDashboard=\{onBackDashboard\} onOpenLibrary=\{onOpenLibrary\}/u);
  assert.match(workspace, /onClick=\{onBackDashboard \?\? \(\(\) => router\.push\("\/skin-v1"\)\)\}/u);
  assert.doesNotMatch(workspace, /onClick=\{\(\) => router\.push\("\/skin-v1"\)\}/u);
  assert.match(host, /returnDashboard\(explorationOpen\)/u);
});

test("#3233 Reports Library button returns into canonical Matrix Library and not legacy /library", async () => {
  const [host, workspace] = await Promise.all([
    source("app/skin-v1/dashboard-bbs-review-host.tsx"),
    source("app/reports/library-ppf-reports-workspace.tsx"),
  ]);
  assert.match(host, /onOpenLibrary=\{\(\) => \{ closeExploration\(\); setLibraryOpen\(true\); onSurfaceNameChange\("LIBRARY"\); \}\}/u);
  assert.ok(workspace.includes('onClick={onOpenLibrary ?? (() => router.push("/skin-v1?workspace=library"))}'));
  assert.match(host, /<LibraryWorkspace\s*\/>/u);
});

test("#3230/#3233 preserve standalone Reports routes and report data authority", async () => {
  const [page, workspace] = await Promise.all([
    source("app/reports/page.tsx"),
    source("app/reports/library-ppf-reports-workspace.tsx"),
  ]);
  assert.match(page, /loadLibraryProjectSnapshot/u);
  assert.match(page, /sessionActiveProjectId\(\)/u);
  assert.match(page, /resolveActiveLibraryReportsProject/u);
  assert.match(page, /profilePrivateBrowserReadyFor/u);
  assert.match(workspace, /router\.push\("\/skin-v1"\)/u);
  assert.ok(workspace.includes('router.push("/skin-v1?workspace=library")'));
  assert.match(workspace, /data-reports-authority="active-library-ppf"/u);
  assert.doesNotMatch(workspace, /saveActiveLibraryProject\(|switchActiveLibraryProject\(|Save & Lock.*onClick/u);
});
