import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditContinuitySnapshot, continuityReport, continuitySummary } from "../lib/ui-continuity-audit.mjs";

const root = new URL("../", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");
const navigation = ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Edit", "Graphic Novel", "Build", "Feedback", "Refine", "Reports"];

function snapshot(overrides = {}) {
  return {
    rendered: true,
    theme: "dark",
    activeWorkspace: "dashboard",
    navigation,
    projectStrip: true,
    statusSignals: 2,
    returnControls: [],
    anchor: { visible: true, name: "Open Agent and Settings", x: 12, y: 12 },
    shell: { contract: "v1", designSystem: "matte-black-antique-gold", height: 56, background: "rgb(7, 7, 7)", borderBottom: "rgba(205, 167, 88, 0.18)", fontFamily: "Courier New" },
    ...overrides,
  };
}

test("#544 evaluates a conforming rendered workspace against one deterministic shell contract", () => {
  const screen = { id: "dashboard", label: "Dashboard", path: "/?workspace=dashboard", kind: "workspace", activeWorkspace: "dashboard" };
  const result = auditContinuitySnapshot(screen, snapshot(), snapshot().shell);
  assert.equal(result.passed, true);
  assert.deepEqual(continuitySummary([result]), { screens: 1, passed: 1, findings: 0, errors: 0, warnings: 0 });
});

test("#544 reports anchor, theme, shell, context, navigation and named-return drift without changing it", () => {
  const screen = { id: "edit", label: "Edit", path: "/edit", kind: "nested-workspace", activeWorkspace: "edit", returnDestination: "Write" };
  const result = auditContinuitySnapshot(screen, snapshot({
    theme: "light",
    activeWorkspace: "",
    navigation: ["Dashboard"],
    projectStrip: false,
    statusSignals: 0,
    returnControls: ["Back to Dashboard"],
    anchor: { visible: true, name: "Settings", x: 90, y: 70 },
    shell: null,
  }), snapshot().shell);
  const ids = new Set(result.findings.map((finding) => finding.id));
  for (const id of ["theme", "agent-settings-position", "agent-settings-name", "shared-shell", "project-context", "status", "named-return", "navigation-learn"]) assert.ok(ids.has(id), `Missing finding ${id}`);
  assert.equal(result.passed, false);
});

test("#544 produces one human-readable advisory report with an explicit approval boundary", () => {
  const result = auditContinuitySnapshot({ id: "core", label: "Core", path: "/core", kind: "standalone", returnDestination: "Learn" }, snapshot({ shell: null, activeWorkspace: "", projectStrip: false, returnControls: ["Back to Learn"] }));
  const report = continuityReport({ generatedAt: "2026-08-09T00:00:00.000Z", server: "http://127.0.0.1:4173", results: [result] });
  assert.match(report, /Mode: read-only audit/);
  assert.match(report, /Automatic fixes: disabled/);
  assert.match(report, /explicitly approve a separate code change/);
  assert.doesNotMatch(report, /api[_-]?key|bearer\s|sk-[a-z0-9]/i);
});

test("#544 registers canonical top-level and nested routes with read-only policy", async () => {
  const registry = JSON.parse(await read("config/ui-continuity-agent-registry.json"));
  assert.equal(registry.mode, "read-only");
  assert.equal(registry.autoFix, false);
  assert.equal(registry.fixApprovalRequired, true);
  assert.equal(registry.designSystem, "matte-black-antique-gold");
  for (const id of ["dashboard", "learn", "plan", "plan-world", "storyboard", "write", "edit", "graphic-novel", "build", "feedback", "refine", "reports", "settings", "core-curriculum", "ai-routing"]) {
    assert.ok(registry.screens.some((screen) => screen.id === id), `Missing registered screen ${id}`);
  }
  assert.ok(registry.screens.filter((screen) => screen.returnDestination).every((screen) => screen.returnDestination.trim()));
});

test("#544 keeps the Agent & Settings control fixed in the shared shell and standalone routes", async () => {
  const [header, anchor, styles, layout] = await Promise.all([
    read("app/application-shell-header.tsx"),
    read("app/ui-continuity-anchor.tsx"),
    read("app/ui-continuity-anchor.css"),
    read("app/layout.tsx"),
  ]);
  assert.match(header, /data-ui-continuity-shell="v1"/);
  assert.match(header, /data-ui-continuity-theme="matte-black-antique-gold"/);
  assert.match(header, /data-ui-continuity-anchor="agent-settings"/);
  assert.match(header, /aria-label="Open Agent and Settings"/);
  assert.ok(header.indexOf("shell-agent-settings-anchor") < header.indexOf("shell-brand"));
  assert.match(anchor, /href="\/\?workspace=settings"/);
  assert.match(styles, /position: fixed/);
  assert.match(styles, /top: 12px/);
  assert.match(styles, /left: 12px/);
  assert.match(styles, /#cda758|#d8b769/);
  assert.match(layout, /<UiContinuityAnchor \/>/);
});

test("#544 launches concurrently beside the Full Story Builder and saves one local report", async () => {
  const [batch, agent, docs] = await Promise.all([
    read("Start-PlotPickle.bat"),
    read("scripts/ui-continuity-agent.mjs"),
    read("docs/issue-544-ui-continuity-agent.md"),
  ]);
  assert.match(batch, /set "UI_CONTINUITY_AGENT=scripts\\ui-continuity-agent\.mjs"/);
  assert.match(batch, /start "PlotPickle UI Continuity Agent" \/min node "%UI_CONTINUITY_AGENT%" --server "%PLOTPICKLE_URL%"/);
  assert.ok(batch.indexOf("call :start_full_story_builder") < batch.lastIndexOf('call "%VITE_CMD%"'));
  assert.ok(batch.indexOf("call :start_ui_continuity_agent") < batch.lastIndexOf('call "%VITE_CMD%"'));
  assert.match(agent, /ui-continuity-report\.md/);
  assert.match(agent, /writeFile\(reportPath, report, "utf8"\)/);
  assert.match(agent, /\.project-strip, \[class\*="projectStrip"\]/);
  assert.doesNotMatch(agent, /applyPatch|writeFile\([^r][^e][^p][^o][^r][^t]/i);
  assert.match(docs, /It has no automatic fix path/);
});

test("#544 is blocking in the deterministic Visual gate while preserving the exact 30-stage UAT", async () => {
  const [workflow, packageJson] = await Promise.all([read(".github/workflows/visual.yml"), read("package.json")]);
  assert.match(workflow, /tests\/issue-544-ui-continuity-agent\.test\.mjs/);
  assert.match(workflow, /node scripts\/ui-continuity-agent\.mjs/);
  assert.match(workflow, /reports\/ui-continuity-agent\/ui-continuity-report\.md/);
  assert.match(workflow, /Run exact 30-stage Creative Writer UAT/);
  assert.match(workflow, /node scripts\/run-creative-writer-uat\.mjs/);
  const scripts = JSON.parse(packageJson).scripts;
  assert.equal(scripts["test:ui-continuity-agent"], "node --test tests/issue-544-ui-continuity-agent.test.mjs");
  assert.equal(scripts["test:full-story-builder"], "node --test tests/issue-542-full-story-builder.test.mjs");
});
