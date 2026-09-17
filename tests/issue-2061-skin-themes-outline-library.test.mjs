import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#2061 keeps skin-v1 internal while presenting Matrix and Black and White aliases", async () => {
  const [runtime, settings, layout] = await Promise.all([
    read("app/skin-v1-runtime.tsx"),
    read("app/skin-v1/settings-workspace-panel.tsx"),
    read("app/layout.tsx"),
  ]);

  assert.match(runtime, /const SKIN_V1 = "skin-v1"/u);
  assert.match(runtime, /const SKIN_V2 = "skin-v2"/u);
  assert.match(runtime, /dataset\.plotpickleSkin = SKIN_V1/u);
  assert.match(runtime, /dataset\.plotpickleSkinTheme = theme/u);
  assert.match(runtime, /"BLACK AND WHITE" : "MATRIX"/u);
  assert.match(runtime, /plotpickle:skin-change/u);

  assert.match(settings, /const SKIN_STORAGE_KEY = "plotpickle\.skin"/u);
  assert.match(settings, /<option value="skin-v1">Matrix<\/option>/u);
  assert.match(settings, /<option value="skin-v2">Black and White<\/option>/u);
  assert.doesNotMatch(settings, /<select value="skin-v1" disabled aria-label="Theme">/u);
  assert.match(settings, /window\.dispatchEvent\(new CustomEvent\("plotpickle:skin-change"\)\)/u);

  assert.match(layout, /import "\.\/skin-v2-definition\.css"/u);
  assert.match(layout, /import "\.\/issue-2061\.css"/u);
});

test("#2061 Black and White is a palette-only skin with exactly nine black and nine white steps", async () => {
  const skin = await read("app/skin-v2-definition.css");
  const blacks = [...skin.matchAll(/--pp-skin-black-(\d):/gu)].map((match) => Number(match[1]));
  const whites = [...skin.matchAll(/--pp-skin-white-(\d):/gu)].map((match) => Number(match[1]));

  assert.deepEqual(blacks, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(whites, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.match(skin, /html\[data-plotpickle-skin-theme="skin-v2"\]/u);
  assert.match(skin, /--pp-skin-ready:/u);
  assert.doesNotMatch(skin, /--pp-skin-space-/u);
  assert.doesNotMatch(skin, /--pp-skin-font-/u);
  assert.doesNotMatch(skin, /--pp-skin-control-height:/u);
});

test("#2061/#2124 exposes Library and the PPF-backed Story Map as Matrix review destinations", async () => {
  const [menu, host, hostStyles, issueStyles, storyMapSurface] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.module.css"),
    read("app/issue-2061.css"),
    read("app/skin-v1/matrix-story-map-surface.tsx"),
  ]);

  assert.match(menu, /CONNECTED_DASHBOARD_ITEM_IDS[\s\S]*"library"[\s\S]*"plan"/u);
  assert.match(host, /import LibraryWorkspace from "\.\.\/\.\.\/modules\/library\/ui\/library-workspace"/u);
  assert.match(host, /import MatrixStoryMapSurface from "\.\/matrix-story-map-surface"/u);
  assert.doesNotMatch(host, /StructureEnginePage/u);
  assert.match(host, /data-dashboard-review-surface="library"/u);
  assert.match(host, /data-dashboard-review-surface="outline"/u);
  assert.equal((host.match(/>IN REVIEW</gu) || []).length, 2);
  assert.match(host, /event\.key === "Escape"[\s\S]*closeReview\("library"\)/u);
  assert.match(host, /event\.key === "Escape"[\s\S]*closeReview\("plan"\)/u);
  assert.match(host, /restoreDashboardFocus\(itemId\)/u);
  assert.match(host, /<LibraryWorkspace \/>/u);
  assert.match(host, /<MatrixStoryMapSurface \/>/u);
  assert.match(storyMapSurface, /loadFoundationProject/u);
  assert.match(storyMapSurface, /<ProgressiveStoryMap project=\{project\} \/>/u);
  assert.match(hostStyles, /\.reviewSurface[\s\S]*--pp-skin-warning-line/u);
  assert.match(issueStyles, /data-dashboard-menu-item="library"[\s\S]*--pp-skin-warning/u);
  assert.match(issueStyles, /data-dashboard-menu-item="plan"[\s\S]*--pp-skin-warning/u);
});

test("#2061 presents six compact Dashboard readiness entries from the existing backend authorities", async () => {
  const [rail, railStyles, footer, footerStyles, host, issueStyles] = await Promise.all([
    read("app/skin-v1/dashboard-readiness-rail.tsx"),
    read("app/skin-v1/dashboard-readiness-rail.module.css"),
    read("app/skin-v1/menu-feedback-footer.tsx"),
    read("app/skin-v1/menu-feedback-footer.module.css"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/issue-2061.css"),
  ]);

  for (const label of ["BUZZ Identity", "BUZZ Community", "Models", "ComfyUI", "Local Compute", "Cloud Compute"]) {
    assert.equal(rail.split(`label: "${label}"`).length - 1, 1, `${label} should appear once in the Dashboard readiness model`);
  }

  for (const shortLabel of ["BUZZ", "COMMUNITY", "MODELS", "COMFY", "LOCAL", "CLOUD"]) {
    assert.match(rail, new RegExp(`shortLabel: "${shortLabel}"`, "u"));
  }

  for (const endpoint of [
    "/api/local-buzz/human-identity",
    "/api/local-buzz/guildhall/status",
    "/api/writing-assistant/status",
    "/api/local-connections",
  ]) assert.match(rail, new RegExp(endpoint.replaceAll("/", "\\/"), "u"));

  assert.match(rail, /target: "profile"/u);
  assert.match(rail, /target: "local-story-mode"/u);
  assert.match(rail, /target: "cloud"/u);
  assert.match(rail, /data-readiness-break=\{item\.shortLabel === "LOCAL" \? "true" : undefined\}/u);
  assert.match(railStyles, /padding-bottom: 4px/u);
  assert.match(railStyles, /data-readiness-break="true"[\s\S]*margin-inline-start: 4px/u);
  assert.match(footer, /import DashboardReadinessRail/u);
  assert.match(footer, /id === "dashboard-menu-status"/u);
  assert.match(footer, /styles\.dashboardReserve/u);
  assert.match(footer, /dashboardFooter \? <span className=\{styles\.dashboardReadiness\}><DashboardReadinessRail \/><\/span>/u);
  assert.match(footerStyles, /\.dashboardReserve[\s\S]*visibility: hidden/u);
  assert.match(footerStyles, /\.dashboardReadiness[\s\S]*position: absolute/u);
  assert.doesNotMatch(host, /DashboardReadinessRail/u);
  assert.doesNotMatch(issueStyles, /Profile readiness/u);
  assert.doesNotMatch(issueStyles, /display: none !important/u);
});
