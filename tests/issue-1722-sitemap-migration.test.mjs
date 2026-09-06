import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1722 routes the definitive sitemap through one forgiving-shell context map", async () => {
  const [context, boundary, shell, shortcuts] = await Promise.all([
    read("app/navigation/sitemap-route-context.ts"),
    read("app/navigation/release-experience-boundary.tsx"),
    read("app/plotpickle-workspace-shell.tsx"),
    read("app/navigation/global-shortcuts.ts"),
  ]);

  assert.match(boundary, /sitemapShellTarget/);
  assert.match(boundary, /publicShellException/);
  assert.doesNotMatch(boundary, /STANDALONE_TARGETS/);
  for (const prop of ["navigationArea", "contextId", "contextLabel", "contextDetail", "contextScope"]) {
    assert.match(boundary, new RegExp(`${prop}=\\{target\\.`));
  }

  assert.match(shell, /navigationArea\?: NavigationAreaId/);
  assert.match(shell, /data-current-context=\{contextId \|\| undefined\}/);
  assert.match(shell, /data-current-destination=\{currentDestination\}/);
  assert.match(shortcuts, /RootWorkspace[^\n]+"collab"/);
  assert.match(shortcuts, /workspace === "collab"\) return "connect"/);

  for (const route of [
    "/library", "/afterglow-reconciliation", "/core-curriculum", "/characters-in-motion",
    "/dialogue-in-motion", "/story-craft-essentials", "/worked-examples", "/working-together",
    "/structure", "/voiceprint", "/storyboard", "/previs", "/pageflow", "/edit",
    "/pitch-review", "/diagnostics", "/craftloop", "/draftlens", "/resonance",
    "/screenplay-readiness", "/production", "/git", "/buzz", "/ai-routing", "/settings/buzz",
  ]) {
    assert.ok(context.includes(`"${route}"`), `Missing sitemap shell classification for ${route}`);
  }

  for (const route of ["/welcome", "/start-here", "/about", "/legal", "/suggest-report"]) {
    assert.ok(context.includes(`path: "${route}"`), `Missing Public/Startup exception for ${route}`);
  }

  assert.match(context, /pathname === "\/labs"/);
  for (const scope of ["plan", "storyboard", "feedback", "refine"]) assert.match(context, new RegExp(`${scope}: \\{`));
  assert.doesNotMatch(context, /"\/story"\s*:/, "STORY must keep its existing self-owned single shell");
  assert.match(context, /"\/buzz"[\s\S]*rootContext: "collab"[\s\S]*contextId: "collab"/);
});

test("#1722 removes stale audit aliases and verifies all six areas plus Public\/Startup exceptions", async () => {
  const registry = JSON.parse(await read("config/ui-continuity-agent-registry.json"));
  assert.equal(registry.schemaVersion, 2);
  assert.equal(registry.sitemapMigrationIssue, 1722);
  assert.equal(registry.mode, "read-only");
  assert.equal(registry.autoFix, false);
  assert.equal(registry.fixApprovalRequired, true);

  const paths = new Set(registry.screens.map((screen) => screen.path));
  for (const stale of ["/?workspace=storyboard", "/?workspace=write", "/?workspace=pitch", "/?workspace=feedback", "/?workspace=refine", "/?workspace=reports"]) {
    assert.equal(paths.has(stale), false, `Stale audit alias remains: ${stale}`);
  }
  for (const current of ["/storyboard", "/previs", "/pageflow", "/edit", "/pitch-review", "/diagnostics", "/production", "/story", "/?workspace=collab"]) {
    assert.equal(paths.has(current), true, `Current sitemap route missing from audit registry: ${current}`);
  }

  const areas = new Set(registry.screens.map((screen) => screen.expectedArea).filter(Boolean));
  assert.deepEqual([...areas].sort(), ["connect", "create", "home", "produce", "review", "settings"]);
  assert.ok(registry.screens.filter((screen) => screen.migrationClass === "public-exception").length >= 5);
  assert.ok(registry.screens.filter((screen) => screen.migrationClass === "contextual").length >= 10);
});

test("#1722 restores the Collab deep link without reviving the retired rich-project mount", async () => {
  const [page, entry, legacy] = await Promise.all([
    read("app/page.tsx"),
    read("app/collab-entry-workspace.tsx"),
    read("app/collab-workspace.tsx"),
  ]);

  assert.match(page, /requested === "collab"/);
  assert.match(page, /activeWorkspace="collab"/);
  assert.match(page, /navigationArea="connect"/);
  assert.match(page, /contextId="collab"/);
  assert.match(page, /<CollabEntryWorkspace projectTitle=\{currentProjectTitle\(\)\}/);
  assert.doesNotMatch(page, /<CollabWorkspace/);

  for (const destination of ["/?workspace=community", "/?workspace=feedback", "/git", "/?workspace=settings"]) {
    assert.ok(entry.includes(destination), `Collab entry must route to canonical owner ${destination}`);
  }
  assert.match(entry, /profile-owned PPF/);
  assert.match(legacy, /PlotPickleProject/);
});

test("#1722 records the complete migration in the canonical sitemap without changing ownership rules", async () => {
  const sitemap = await read("PLOTPICKLE-SITEMAP.txt");
  assert.match(sitemap, /FORGIVING SHELL MIGRATION MAP/);
  assert.match(sitemap, /Status: Phase 2B \/ issue #1722, 2026-09-06/);
  for (const area of ["Home", "Create", "Produce", "Review", "Connect \/ Play", "Settings"]) assert.match(sitemap, new RegExp(area));
  for (const topLevel of [
    "00. Public / Startup", "01. Dashboard", "02. Library", "03. Learn", "04. Plan", "05. Build",
    "06. STORY: THE UNWRITTEN", "07. Storyboard", "08. Previs / Graphic Novel", "09. Write", "10. Edit",
    "11. Feedback", "12. Refine", "13. Reports", "14. Collaboration", "15. Wyrmwood", "16. Agents",
    "17. Skills", "18. PPF / Project Authority", "19. Context / Story Graph", "20. AI Runtime", "21. Settings",
  ]) assert.ok(sitemap.includes(topLevel), `Sitemap migration lost ${topLevel}`);
  assert.match(sitemap, /Issue #1723 owns restoration of the full formal Collab UI/);
  assert.match(sitemap, /EVERY CAPABILITY HAS ONE CANONICAL HOME/);
});
