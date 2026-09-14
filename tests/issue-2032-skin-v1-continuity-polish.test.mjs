import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#2032 promotes accepted Management destinations and keeps exact Human-facing copy", async () => {
  const [skin, markerStyles, audit] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.module.css"),
    read("lib/verification/skin-v1-menu-contract-audit.mjs"),
  ]);

  assert.match(skin, /id: "profile", shortcut: "U", label: "Profile", description: "Manage User Identity"/u);
  assert.match(skin, /id: "help", shortcut: "H", label: "Issue Log", description: "Prepare a PlotPickle Issue"/u);
  assert.match(skin, /id: "open-source", shortcut: "N", label: "Licensing", description: "Review Open Source Licensing and Attribution"/u);
  assert.doesNotMatch(markerStyles, /pp-skin-warning|data-dashboard-menu-item="help"|data-dashboard-menu-item="open-source"/u);
  assert.doesNotMatch(audit, /dashboardReview/u);
  assert.match(audit, /const expectedBackground = row\.connected \? result\.accentBright : result\.muted/u);
});

test("#2032 gives approved curriculum green availability, canonical family gaps and subtle grid structure", async () => {
  const css = await read("app/skin-v1-bbs-surfaces.css");

  assert.match(css, /LEARN Explore All Curriculum/u);
  assert.match(css, /background-image:[\s\S]*linear-gradient\(to right[\s\S]*linear-gradient\(to bottom/u);
  assert.match(css, /background-size: 32px 28px !important/u);
  assert.match(css, /\[data-learn-explore-lesson\] \.pp-skin-v1-dashboard-status-box[\s\S]*background: var\(--pp-skin-accent-bright\) !important/u);

  for (const topic of [
    "industry",
    "theme",
    "character",
    "world",
    "structure",
    "dialogue",
    "visual-storytelling",
    "drafting",
    "revision",
    "responsible-ai",
    "collaboration",
  ]) {
    assert.ok(css.includes(`data-learn-explore-topic="${topic}"`), `Missing canonical topic boundary: ${topic}`);
  }
  assert.match(css, /margin-top: var\(--pp-skin-space-5\) !important/u);
  assert.match(css, /border-top-color: var\(--pp-skin-accent\) !important/u);
});

test("#2032 uses one PLOTPICKLE SURFACE SKIN V1 header and demotes old surface banners to action rows", async () => {
  const [skin, host, dashboard, css, audit] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1-bbs-surfaces.css"),
    read("lib/verification/skin-v1-menu-contract-audit.mjs"),
  ]);

  assert.match(skin, /<header className="pp-skin-v1-bar" data-skin-v1-standard-header="true">[\s\S]*<strong>PLOTPICKLE<\/strong>[\s\S]*<span>\{businessUseCase\}<\/span>[\s\S]*<span>SKIN V1<\/span>[\s\S]*<\/header>/u);
  assert.match(skin, /const businessUseCase = userProfileOpen \? "PROFILE" : activeSurface === "DASHBOARD" \? dashboardSurfaceName : activeSurface/u);
  assert.match(skin, /onSurfaceNameChange=\{setDashboardSurfaceName\}/u);
  assert.match(host, /onSurfaceNameChange\("LICENSING"\)/u);
  assert.match(host, /onSurfaceNameChange\("ISSUE LOG"\)/u);
  assert.match(dashboard, /onSurfaceNameChange\("WRITER'S CRAFT"\)/u);
  assert.match(dashboard, /onSurfaceNameChange\("SETTINGS"\)/u);
  assert.match(dashboard, /onSurfaceNameChange\("AGENTS"\)/u);
  assert.match(dashboard, /onSurfaceNameChange\("ADVANCED"\)/u);

  assert.match(css, /\.pp-skin-v1-bar,[\s\S]*\.pp-skin-v1-title\[data-skin-v1-standard-header="true"\][\s\S]*grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\)/u);
  assert.match(css, /\.pp-skin-v1-bbs-banner > h1,[\s\S]*\.pp-skin-v1-profile-banner > h1[\s\S]*display: none !important/u);
  assert.match(css, /\.pp-skin-v1-surface-actions,[\s\S]*background: transparent !important/u);
  assert.doesNotMatch(audit, /"\.pp-skin-v1-bbs-banner"|"\.pp-skin-v1-profile-banner"/u);
});
