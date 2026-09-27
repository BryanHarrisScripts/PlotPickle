import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2502 Previs keeps one project hydration owner and one intentional opening state", async () => {
  const surfaces = await read("app/skin-v1/preproduction-review-surfaces.tsx");
  const start = surfaces.indexOf("export function SkinV1PrevisCompositeSurface");
  const end = surfaces.indexOf("export function SkinV1TimelineReviewSurface", start);
  const previs = surfaces.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.equal((previs.match(/loadFoundationProject\(\)/g) ?? []).length, 1);
  assert.equal((previs.match(/Opening Previs…/g) ?? []).length, 1);
  assert.match(previs, /window\.addEventListener\(FOUNDATION_PROJECT_SAVED_EVENT, sync\)/u);
  assert.match(previs, /window\.removeEventListener\(FOUNDATION_PROJECT_SAVED_EVENT, sync\)/u);
});

test("#2502 stage activation yields to the surface before durable context persistence", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  assert.match(host, /function schedulePreproductionContextPersistence/u);
  assert.match(host, /window\.requestAnimationFrame\(\(\) => \{[\s\S]*?window\.setTimeout\(\(\) => rememberPreproductionContext\(stage, address\), 0\)/u);
  assert.match(host, /function updateReviewAddress[\s\S]*?setReviewAddress\(address\);[\s\S]*?schedulePreproductionContextPersistence\(stage, address\)/u);
});

test("#2502 unchanged active project snapshots are cached instead of repeatedly normalizing the same large project", async () => {
  const library = await read("core/storage/project-library-browser.ts");
  assert.match(library, /type ActiveProjectReadCache/u);
  assert.match(library, /function readActiveProjectSnapshotFast/u);
  assert.match(library, /activeProjectReadCache\.registryRaw === registryRaw/u);
  assert.match(library, /activeProjectReadCache\.projectRaw === projectRaw/u);
  assert.match(library, /if \(fast\) return fast/u);
  assert.match(library, /return null;[\s\S]*?const initialized = initializeProjectLibrary\(\)/u);
});

test("#2502 Previs uses the same per-state colour contract for Blocks and Mini-Blocks as Storyboard", async () => {
  const css = await read("app/_components/previs/previs-readiness-workspace.module.css");
  assert.match(css, /\.workspace \[data-state="defined"\] \{ --story-state:/u);
  assert.match(css, /\.workspace \[data-state="observed"\] \{ --story-state:/u);
  assert.match(css, /\.workspace \[data-state="emerging"\] \{ --story-state:/u);
  assert.match(css, /\.workspace \[data-state="missing"\] \{ --story-state:/u);
  assert.match(css, /\.workspace \[data-state="locked"\] \{ --story-state:/u);
  assert.match(css, /\.blockTab\[aria-selected="true"\][\s\S]*?border-color: var\(--story-state\)/u);
  assert.match(css, /\.anchorCard \{[\s\S]*?border:[\s\S]*?var\(--story-state\)/u);
  assert.match(css, /\.anchorCard\[data-selected="true"\][\s\S]*?border-color: var\(--story-state\)/u);
  assert.match(css, /\.stateLight \{[\s\S]*?background: var\(--story-state/u);
});
