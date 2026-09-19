import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalSurface } from "../lib/verification/skin-v1-surface-registry.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const shellFiles = [
  "app/_components/preproduction/preproduction-context-nav.module.css",
  "app/_components/preproduction/preproduction-capability-return.module.css",
  "app/_components/preproduction/preproduction-visual-thinking.module.css",
  "app/_components/storyboard/storyboard-readiness-workspace.module.css",
  "app/_components/previs/previs-readiness-workspace.module.css",
  "app/_components/storyboard/storyboard-editorial-workspace.module.css",
  "app/_components/storyboard/visual-story-workspace.module.css",
  "modules/write/ui/block-native-write-workspace.module.css",
  "app/pageflow/pageflow.module.css",
];

test("#2226 Phase 4 moves the UAT/preproduction family onto the canonical 1180px shell", async () => {
  for (const path of shellFiles) {
    const css = await read(path);
    assert.doesNotMatch(css, /1500px/u, path + " must not keep the old 1500px production shell");
    assert.match(css, /--pp-skin-shell-max/u, path + " must consume the canonical shell token");
  }
});

test("#2226 Phase 4 removes stark-white selected state from governed preproduction surfaces", async () => {
  const files = await Promise.all([
    read("app/skin-v1/preproduction-matrix-contract.css"),
    read("app/_components/preproduction/preproduction-context-nav.module.css"),
    read("app/_components/storyboard/storyboard-readiness-workspace.module.css"),
    read("app/_components/previs/previs-readiness-workspace.module.css"),
    read("app/_components/storyboard/visual-story-workspace.module.css"),
    read("app/_components/storyboard/scene-timeline-workspace.module.css"),
    read("modules/write/ui/block-native-write-workspace.module.css"),
    read("app/pageflow/pageflow.module.css"),
  ]);

  for (const css of files) {
    assert.doesNotMatch(css, /var\(--pp-skin-selected-bg\)/u);
    assert.doesNotMatch(css, /var\(--pp-skin-selected-ink\)/u);
  }
  assert.match(files.join("\n"), /var\(--pp-skin-accent-deep\)/u);
  assert.match(files.join("\n"), /var\(--pp-skin-accent-bright\)/u);
});

test("#2226 Phase 4 uses project-aware titles for Storyboard, Previs and Visual Story", async () => {
  const [storyboard, previs, visual] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/_components/storyboard/visual-story-workspace.tsx"),
  ]);
  assert.match(storyboard, /Storyboard · \{project\.title \|\| "Untitled Story"\}/u);
  assert.match(previs, /Previs · \{project\.title \|\| "Untitled Story"\}/u);
  assert.match(visual, /Visual \{project\.title \|\| "Untitled Story"\} Screenplay/u);
  assert.doesNotMatch(visual, />Black-and-white visual screenplay<\/h2>/u);
});

test("#2226 Phase 4 keeps Visual Story and Scene Workspace nested under Storyboard authority", () => {
  assert.equal(canonicalSurface("storyboard").formatProfile.shell, "production");
  assert.equal(canonicalSurface("visual-story").parent, "storyboard");
  assert.equal(canonicalSurface("visual-story").formatProfile.shell, "production-nested");
  assert.equal(canonicalSurface("scene-timeline").parent, "storyboard");
  assert.equal(canonicalSurface("scene-timeline").formatProfile.shell, "production-nested");
  assert.equal(canonicalSurface("scene-timeline").formatProfile.layout, "timeline-workspace");
});

test("#2226 Phase 4 normalizes Visual Story structural frames to declared solid borders", async () => {
  const css = await read("app/_components/storyboard/visual-story-workspace.module.css");
  assert.doesNotMatch(css, /border(?:-top)?:\s*var\(--pp-skin-border-thin\) dashed/u);
  assert.doesNotMatch(css, /border-style:\s*dashed/u);
  assert.match(css, /border: var\(--pp-skin-border-strong\) solid var\(--pp-skin-line-strong\)/u);
  assert.match(css, /inset 0 0 0 var\(--pp-skin-border-thin\) var\(--pp-skin-line\)/u);
});

test("#2226 Phase 4 preserves the production family authority and return relationships", () => {
  assert.equal(canonicalSurface("story-map").formatProfile.shell, "production");
  assert.equal(canonicalSurface("storyboard").parent, "dashboard");
  assert.equal(canonicalSurface("previs").parent, "dashboard");
  assert.equal(canonicalSurface("write").parent, "dashboard");
  assert.equal(canonicalSurface("pageflow").parent, "refine");
  assert.equal(canonicalSurface("pageflow").formatProfile.shell, "diagnostic");
});
