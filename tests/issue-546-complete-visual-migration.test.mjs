import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { auditContinuitySnapshot } from "../lib/ui-continuity-audit.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#546 replaces the retired global palette with one semantic matte-black system", async () => {
  const globals = await read("app/globals.css");
  const tokens = await read("app/design-tokens.css");
  for (const token of ["--pp-matte: #070707", "--pp-teal: #22bfae", "--pp-orange: #ff7a3d", "--pp-paper: #eee8dc", "--pp-success", "--pp-warning", "--pp-danger"]) {
    assert.match(tokens, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  for (const retired of ["#123442", "#f2fbfc", "#3c94a8", "#176274", "#dcf5ef", "#dff4ff", "#86a9d2"]) {
    assert.doesNotMatch(`${tokens}\n${globals}`, new RegExp(retired, "i"));
  }
  assert.doesNotMatch(globals, /:root\s*\{/);
  for (const family of ["Typography", "Spacing", "Shape, elevation and motion"]) assert.match(tokens, new RegExp(family));
  for (const architecturalToken of ["--pp-control-height-md", "--pp-touch-target", "--pp-width-reading", "--pp-width-board", "--pp-z-dialog", "--pp-z-notification", "data-plotpickle-contrast", "prefers-reduced-motion"]) {
    assert.ok(tokens.includes(architecturalToken), `missing architectural design token ${architecturalToken}`);
  }
});

test("#546 loads the authoritative visual system after all historical workspace layers", async () => {
  const layout = await read("app/layout.tsx");
  assert.ok(layout.indexOf('import "./design-tokens.css"') < layout.indexOf('import "./globals.css"'));
  const continuity = layout.indexOf('import "./ui-continuity-anchor.css"');
  const approved = layout.indexOf('import "./approved-visual-system.css"');
  assert.ok(continuity >= 0 && approved > continuity);
  const styles = await read("app/approved-visual-system.css");
  for (const contract of [".workspace", ".editor-page", ".standalone-studio-surface", "[role=\"dialog\"]", "--pp-line", "--pp-teal", "--pp-orange"]) {
    assert.ok(styles.includes(contract), `missing complete-migration contract ${contract}`);
  }
  assert.match(styles, /Red\/yellow\/green remain reserved for truthful system state/i);
  for (const navigationRule of ["display: flex !important", "overflow-x: auto !important", "flex: 0 0 auto !important", "overflow: visible !important"]) {
    assert.ok(styles.includes(navigationRule), `missing non-overlapping shell rule ${navigationRule}`);
  }
});

test("#546 blocks overlapping shared-shell navigation targets", () => {
  const result = auditContinuitySnapshot({ id: "reports", label: "Reports", path: "/?workspace=reports", kind: "workspace", activeWorkspace: "reports" }, {
    rendered: true,
    theme: "dark",
    legacyPalette: [],
    navigationOverlaps: [{ first: "Reports", second: "Community", width: 38, height: 28 }],
    anchor: { visible: true, name: "Open Agent and Settings", x: 8, y: 8 },
    shell: { contract: "v1", designSystem: "matte-black-teal-orange", height: 56, background: "rgb(7, 7, 7)", borderBottom: "rgba(34, 191, 174, 0.18)", fontFamily: "Courier New" },
    activeWorkspace: "reports",
    projectStrip: true,
    statusSignals: 1,
    navigation: ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Edit", "Graphic Novel", "Build", "Feedback", "Refine", "Reports"],
    returnControls: [],
  });
  assert.equal(result.findings.some((finding) => finding.id === "navigation-overlap" && finding.severity === "error"), true);
});

test("#546 turns a visible retired colour into a blocking continuity error", () => {
  const screen = { id: "learn", label: "Learn", path: "/?workspace=learn", kind: "workspace", activeWorkspace: "learn" };
  const result = auditContinuitySnapshot(screen, {
    rendered: true,
    theme: "dark",
    legacyPalette: [{ property: "backgroundColor", value: "rgb(60, 148, 168)", element: "section" }],
    anchor: { visible: true, name: "Open Agent and Settings", x: 8, y: 8 },
    shell: { contract: "v1", designSystem: "matte-black-teal-orange", height: 56, background: "rgb(7, 7, 7)", borderBottom: "rgba(34, 191, 174, 0.18)", fontFamily: "Courier New" },
    activeWorkspace: "learn",
    projectStrip: true,
    statusSignals: 1,
    navigation: ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Edit", "Graphic Novel", "Build", "Feedback", "Refine", "Reports"],
    returnControls: [],
  });
  assert.equal(result.passed, false);
  assert.equal(result.findings.some((finding) => finding.id === "legacy-palette" && finding.severity === "error"), true);
});

test("#546 preserves palette-regex escapes inside the serialized browser audit", async () => {
  const agent = await read("scripts/ui-continuity-agent.mjs");
  assert.match(agent, /rgba\?\\\\\(\(\\\\d\+\),\\\\s\*/);
});

test("#546 audits every standalone route as well as the canonical workspaces", async () => {
  const registry = JSON.parse(await read("config/ui-continuity-agent-registry.json"));
  const registered = new Set(registry.screens.map((screen) => screen.path.split("?")[0]));
  for (const route of ["/about", "/afterglow-reconciliation", "/ai-routing", "/buzz", "/characters-in-motion", "/core-curriculum", "/craftloop", "/diagnostics", "/dialogue-in-motion", "/draftlens", "/edit", "/git", "/labs", "/legal", "/pageflow", "/pitch-review", "/production", "/resonance", "/screenplay-readiness", "/settings/buzz", "/start-here", "/story-craft-essentials", "/structure", "/suggest-report", "/voiceprint", "/welcome", "/worked-examples", "/working-together"]) {
    assert.ok(registered.has(route), `standalone route missing from migration audit: ${route}`);
  }
});

test("#546 is registered in the blocking Visual gate and focused scripts", async () => {
  const workflow = await read(".github/workflows/visual.yml");
  const pkg = JSON.parse(await read("package.json"));
  assert.match(workflow, /tests\/issue-546-complete-visual-migration\.test\.mjs/);
  assert.equal(pkg.scripts["test:complete-visual-migration"], "node --test tests/issue-546-complete-visual-migration.test.mjs");
});
