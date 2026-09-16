import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2092 phase 4 connects PRE-PRODUCTION to existing canonical LEARN lessons", async () => {
  const [nav, structure, theme, visual] = await Promise.all([
    read("app/_components/preproduction/preproduction-context-nav.tsx"),
    read("learn/structure.json"),
    read("learn/theme.json"),
    read("learn/visual-storytelling.json"),
  ]);

  for (const lessonId of [
    "24b-structure-guide",
    "mood-colour-visual-language",
    "early-visual-development",
    "essentials-screen-evidence",
  ]) {
    assert.match(nav, new RegExp(lessonId));
    assert.ok(
      structure.includes(`\"id\": \"${lessonId}\"`)
        || theme.includes(`\"id\": \"${lessonId}\"`)
        || visual.includes(`\"id\": \"${lessonId}\"`),
      `${lessonId} must remain an existing LEARN lesson rather than duplicated Phase 4 content`,
    );
  }

  assert.match(nav, /type: "lesson\.open"/);
  assert.match(nav, /loadFoundationProject/);
  assert.match(nav, /saveFoundationProject/);
  assert.match(nav, /workspace: "learn"/);
  assert.match(nav, /from: "preproduction"/);
  assert.match(nav, /return: returnPath/);
});

test("#2092 phase 4 preserves deterministic return from contextual LEARN", async () => {
  const [host, returnNav, root] = await Promise.all([
    read("app/_components/preproduction/preproduction-learn-return-host.tsx"),
    read("app/_components/preproduction/preproduction-capability-return.tsx"),
    read("app/layout.tsx"),
  ]);

  assert.match(host, /workspace.*learn/);
  assert.match(host, /from.*preproduction/);
  assert.match(host, /PreproductionCapabilityReturn/);
  assert.match(root, /PreproductionLearnReturnHost/);
  assert.match(returnNav, /Return to Outline/);
  assert.match(returnNav, /Return to Storyboard/);
  assert.match(returnNav, /Return to Previs/);
  assert.match(returnNav, /safeReturnPath/);
});

test("#2092 phase 4 reuses VisualReference and Project Asset Registry for rough visual thinking", async () => {
  const [capture, project, assets, outlineLayout] = await Promise.all([
    read("app/_components/preproduction/preproduction-visual-thinking.tsx"),
    read("lib/projects/project.ts"),
    read("lib/projects/persistence/project-assets.ts"),
    read("app/structure/layout.tsx"),
  ]);

  assert.match(project, /export type VisualReference =/);
  assert.match(project, /assets: ProjectAssetRegistry/);
  assert.match(assets, /export function registerProjectAssetSource/);

  assert.match(capture, /registerProjectAssetSource\(project\.assets/);
  assert.match(capture, /approval: "unreviewed"/);
  assert.match(capture, /preproductionRole: "rough-visual-thinking"/);
  assert.match(capture, /planningEvidence: true/);
  assert.match(capture, /purpose: sourceType === "manual-import" \? "composition" : "inspiration"/);
  assert.match(capture, /Storyboard canon was not changed/);
  assert.match(capture, /toDataURL\("image\/webp"/);
  assert.match(outlineLayout, /PreproductionVisualThinking/);
});

test("#2092 phase 4 keeps rough capture upstream and preserves downstream visual authorities", async () => {
  const [storyboardLayout, previsLayout, dashboard] = await Promise.all([
    read("app/storyboard/layout.tsx"),
    read("app/previs/layout.tsx"),
    read("app/skin-v1/dashboard-menu-registry.ts"),
  ]);

  assert.doesNotMatch(storyboardLayout, /PreproductionVisualThinking/);
  assert.doesNotMatch(previsLayout, /PreproductionVisualThinking/);
  assert.match(dashboard, /label: "Outline"[\s\S]*group: "PRE-PRODUCTION"/);
  assert.match(dashboard, /label: "Storyboard"[\s\S]*group: "PRE-PRODUCTION"/);
  assert.match(dashboard, /label: "Previs"[\s\S]*group: "PRE-PRODUCTION"/);
  assert.doesNotMatch(dashboard, /label: "Breakdown"/);
  assert.doesNotMatch(dashboard, /label: "Production Plan"/);
});
