import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#536 keeps the canonical top navigation order and makes the brand return to Dashboard", async () => {
  const [direction, header, page] = await Promise.all([read("lib/product-direction.ts"), read("app/application-shell-header.tsx"), read("app/page.tsx")]);
  const labels = ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Edit", "Graphic Novel", "Build", "Feedback", "Refine", "Reports"];
  let cursor = -1;
  for (const label of labels) {
    const next = direction.indexOf(`label: "${label}"`, cursor + 1);
    assert.ok(next > cursor, `${label} must remain in the canonical visible order`);
    cursor = next;
  }
  assert.match(header, /aria-label="Return to PlotPickle Dashboard"/);
  assert.doesNotMatch(header, /Open the PlotPickle marketing page/);
  assert.match(page, /onOpenLanding=\{\(\) => \{[\s\S]*setShowLanding\(false\)[\s\S]*setActiveTab\("dashboard"\)/);
  assert.match(page, /data-active-workspace=\{activeTab\}/);
});

test("#536 hydrates current and legacy deep links into the named visible destination", async () => {
  const page = await read("app/page.tsx");
  for (const mapping of ['planner: "planner"', 'visuals: "visuals"', 'script: "script"', 'engines: "engines"', 'instructions: "instructions"']) assert.ok(page.includes(mapping), `Missing legacy mapping ${mapping}`);
  for (const parameter of ["tab", "section", "block", "mini", "view"]) assert.match(page, new RegExp(`parameters\\.get\\(\\"${parameter}\\"\\)`));
  assert.match(page, /storySections\.some\(\(section\) => section\.id === requestedSection\)/);
  assert.match(page, /requestedBlock >= 1 && requestedBlock <= 24/);
  assert.match(page, /requestedMiniBlock >= 1 && requestedMiniBlock <= 4/);
});

test("#536 generic exits name and reach their owning workspaces", async () => {
  const contracts = {
    "app/core-curriculum/page.tsx": ['href="/?workspace=learn"', "Back to Learn"],
    "app/craftloop/page.tsx": ['href="/?workspace=refine"', "Back to Refine"],
    "app/structure/page.tsx": ['href="/?workspace=plan&section=structureMap"', "Back to Plan"],
    "app/legal/page.tsx": ['href="/?workspace=settings"', "Back to Settings"],
    "app/suggest-report/page.tsx": ['href="/?workspace=dashboard"', "Back to Dashboard"],
    "app/edit-workspace.tsx": ['window.location.assign("/?workspace=dashboard")'],
  };
  for (const [path, phrases] of Object.entries(contracts)) {
    const source = await read(path);
    for (const phrase of phrases) assert.ok(source.includes(phrase), `${path} must contain ${phrase}`);
  }
  for (const path of ["app/about/page.tsx", "app/afterglow-reconciliation/page.tsx", "app/characters-in-motion/page.tsx", "app/core-curriculum/page.tsx", "app/craftloop/page.tsx", "app/dialogue-in-motion/page.tsx", "app/legal/page.tsx", "app/structure/page.tsx", "app/suggest-report/page.tsx", "app/working-together/page.tsx"]) assert.doesNotMatch(await read(path), /href="\/"/, `${path} must not fall back to the splash/root exit`);
});

test("#536 applies the approved studio theme to unconverted top-level and rabbit-hole surfaces", async () => {
  const [layout, theme] = await Promise.all([read("app/layout.tsx"), read("app/studio-surface-continuity.css")]);
  assert.match(layout, /studio-surface-continuity\.css/);
  for (const workspace of ["engines", "reports", "settings", "collab", "community"]) assert.ok(theme.includes(`data-active-workspace="${workspace}"`), `Missing ${workspace} continuity surface`);
  for (const token of ["#090909", "#cda758", "Courier New", "standalone-studio-surface"]) assert.ok(theme.includes(token));
  for (const path of ["app/core-curriculum/page.tsx", "app/structure/page.tsx", "app/diagnostics/page.tsx", "app/labs/page.tsx", "app/production/page.tsx", "app/pitch-review/page.tsx", "app/craftloop/page.tsx", "app/resonance/page.tsx"]) assert.match(await read(path), /standalone-studio-surface/, `${path} must use the approved studio surface`);
});

test("#536 expands rendered UAT through navigation, rabbit holes and named returns", async () => {
  const [runner, matrix] = await Promise.all([read("scripts/run-creative-writer-uat.mjs"), read("docs/issue-536-navigation-route-matrix.md")]);
  for (const stage of ["Exit Returns to Dashboard", "Top Navigation Forward and Back", "Plan Rabbit Hole Return", "Refine Rabbit Hole Return", "Reports Context Return", "Settings Rabbit Hole Return"]) assert.ok(runner.includes(stage), `Missing rendered UAT stage ${stage}`);
  assert.match(runner, /nav\.method !== "visible workspace control"/);
  assert.match(matrix, /Dashboard → Learn → Plan → Storyboard → Write → Edit → Graphic Novel → Build → Feedback → Refine → Reports/);
  assert.match(matrix, /Act → Block → Scene → Mini-Block/);
});
