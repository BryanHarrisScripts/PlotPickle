import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  UI_CLS_PROBES,
  UI_CLS_REFERENCE_CEILING,
  UI_ZOOM_TEXT_SCALE,
} from "../lib/verification/ui-experience-audit.mjs";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("#1715 Phase 1D keeps STORY contextual rather than adding a fifteenth equal nav choice", async () => {
  const shortcuts = await source("app/navigation/global-shortcuts.ts");
  const storyPage = await source("app/story/page.tsx");
  assert.match(shortcuts, /RootWorkspace[^\n]+"story"/);
  assert.doesNotMatch(shortcuts, /id:\s*"story"/);
  assert.match(storyPage, /activeWorkspace="story"/);
  assert.match(storyPage, /activeShortcutId="story"/);
  assert.match(storyPage, /<StoryZeroWorkspace \/>/);
});

test("#1715 Phase 1D STORY zero state reads the canonical project and exposes one next step per context", async () => {
  const workspace = await source("app/_components/story/story-zero-workspace.tsx");
  assert.match(workspace, /loadFoundationProject/);
  assert.match(workspace, /kind: "loading"/);
  assert.match(workspace, /kind: "empty"/);
  assert.match(workspace, /kind: "project"/);
  assert.match(workspace, /Choose a story/);
  assert.match(workspace, /Prepare playable setup/);
  assert.match(workspace, /router\.push\("\/library"\)/);
  assert.match(workspace, /router\.push\("\/\?workspace=build"\)/);
  assert.match(workspace, /No active STORY session/);
  assert.match(workspace, /play never silently rewrites canon/i);
  assert.match(workspace, /<dl className=\{styles\.context\}>/);
  assert.match(workspace, /<dd>\{hasProject \? model\.project\.title/);
  assert.match(workspace, /<aside className=\{styles\.reassurance\}>/);
  assert.match(workspace, /<SectionHeading>Play safely\.<\/SectionHeading>/);
  assert.match(workspace, /embedded \? "h3" : "h1"/);
  assert.doesNotMatch(workspace, /useId/);
  assert.doesNotMatch(workspace, /aria-live=/);
  assert.doesNotMatch(workspace, /role="status"/);
  assert.doesNotMatch(workspace, /aria-labelledby/);
  assert.doesNotMatch(workspace, /aria-label="STORY authority boundary"/);
  assert.doesNotMatch(workspace, /saveStory|writeStory|canonAdmission|admit.*canon/i);
});

test("#1715 Phase 1D STORY primitives expose semantic card and validator states without invalid ARIA", async () => {
  const card = await source("app/_components/story/story-piece-card.tsx");
  const validator = await source("app/_components/story/story-validator-finding.tsx");
  for (const state of ["available", "selected", "illegal", "loading", "partial", "error"]) assert.match(card, new RegExp(state));
  for (const label of ["ERROR", "WARNING", "NOTE", "PASS"]) assert.match(validator, new RegExp(label));
  assert.match(card, /STATE_LABELS/);
  assert.match(card, /<h3 className=\{styles\.title\}>\{type\}: \{title\}<\/h3>/);
  assert.match(card, /<p className=\{styles\.state\}>\{STATE_LABELS\[state\]\}<\/p>/);
  assert.doesNotMatch(card, /className=\{styles\.type\}/);
  assert.match(validator, /SEVERITY_LABELS/);
  assert.doesNotMatch(card, /aria-disabled/);
  assert.doesNotMatch(card, /data-story-piece-unavailable/);
  assert.doesNotMatch(validator, /role=\{severity/);
});

test("#1715 Phase 1D state gallery uses real production components and hostile fixtures", async () => {
  const gallery = await source("app/_components/foundation/ui-experience-gallery.tsx");
  for (const component of ["UiStateSurface", "UiWorkStatus", "StoryPieceCard", "StoryValidatorFinding", "StoryZeroWorkspaceView"]) {
    assert.match(gallery, new RegExp(component));
  }
  assert.match(gallery, /StoryZeroWorkspaceView embedded/);
  assert.match(gallery, /LONG_TOKEN/);
  assert.match(gallery, /世界の物語/);
  assert.match(gallery, /AI suggestion/);
  assert.match(gallery, /Accepted consequence/);
  assert.match(gallery, /Canon accepted/);
  assert.match(gallery, /notifyPlotPickle/);
  assert.match(gallery, /data-ui-experience-probe/);
});

test("#1715 Phase 1D gallery is verification-only and mounts production components outside the product router", async () => {
  const entry = await source("lib/verification/ui-experience-fixture/entry.tsx");
  const config = await source("lib/verification/ui-experience-fixture/vite.config.ts");
  const shim = await source("lib/verification/ui-experience-fixture/next-navigation-shim.ts");

  assert.match(entry, /UiExperienceGallery/);
  assert.match(entry, /CommonOverlayLayer/);
  assert.match(entry, /app\/design-tokens\.css/);
  assert.match(entry, /app\/globals\.css/);
  assert.match(config, /@vitejs\/plugin-react/);
  assert.match(config, /"next\/navigation"/);
  assert.match(config, /allow:\s*\[repoRoot\]/);
  assert.match(shim, /export function useRouter/);
  await assert.rejects(access(new URL("../app/ui-lab/page.tsx", import.meta.url)));
});

test("#1715 Phase 1D browser gate enforces CLS, 200% stress, long content and reduced motion", async () => {
  assert.equal(UI_CLS_REFERENCE_CEILING, 0.1);
  assert.equal(UI_ZOOM_TEXT_SCALE, "200%");
  assert.deepEqual(UI_CLS_PROBES, ["transition", "notification", "consequence"]);

  const audit = await source("lib/verification/ui-experience-audit.mjs");
  assert.match(audit, /PerformanceObserver/);
  assert.match(audit, /layout-shift/);
  assert.match(audit, /!entry\.hadRecentInput/);
  assert.match(audit, /fixtureServerUrl/);
  assert.match(audit, /--fixture-server/);
  assert.match(audit, /zoom\.overflow > 1/);
  assert.match(audit, /primaryWidth < 44 \|\| zoom\.primaryHeight < 44/);
  assert.match(audit, /reducedMotion: "reduce"/);
  assert.match(audit, /story\.primaryActions !== 1/);
  assert.match(audit, /return await page\.evaluate/);
  assert.doesNotMatch(audit, /return page\.evaluate/);
  assert.doesNotMatch(audit, /lighthouse/i);
});

test("#1715 Phase 1D extends axe coverage to the real STORY home", async () => {
  const registry = JSON.parse(await source("config/ui-axe-routes.json"));
  assert.equal(registry.routes.find((route) => route.id === "story")?.path, "/story");
});
