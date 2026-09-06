import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("release navigation keeps one PlotPickle shell owner on standalone workspaces and contextual STORY", async () => {
  const [layout, boundary, shell, shortcuts, storyPage] = await Promise.all([
    source("app/layout.tsx"),
    source("app/navigation/release-experience-boundary.tsx"),
    source("app/plotpickle-workspace-shell.tsx"),
    source("app/navigation/global-shortcuts.ts"),
    source("app/story/page.tsx"),
  ]);
  assert.match(layout, /<ReleaseExperienceBoundary>\{children\}<\/ReleaseExperienceBoundary>/);
  for (const route of ["/library", "/storyboard", "/previs", "/pageflow", "/edit", "/pitch-review", "/diagnostics", "/production"]) {
    assert.ok(boundary.includes(`"${route}"`), `Standalone release route is missing the global shell: ${route}`);
  }
  assert.doesNotMatch(boundary, /"\/story":/);
  assert.match(storyPage, /<PlotPickleWorkspaceShell activeWorkspace="story" activeShortcutId="story"/);
  assert.doesNotMatch(shortcuts, /\{ id: "story", key:/);
  assert.match(shell, /activeShortcutId/);
  assert.match(shell, /data-plotpickle-global-nav="v4"/);
  assert.match(shell, /data-current-navigation-area/);
});

test("release navigation gives BUILD a discoverable production stage rail instead of stacking Story Workflow before Story Coverage", async () => {
  const boundary = await source("app/navigation/release-experience-boundary.tsx");
  for (const label of ["Story Coverage", "Story Workflow", "Wireframe", "Storyboard", "Previs", "Render Plan"]) {
    assert.ok(boundary.includes(label), `BUILD stage navigation is missing ${label}`);
  }
  assert.match(boundary, /frame\.appendChild\(workflow\)/);
  assert.match(boundary, /data-story-coverage/);
  assert.match(boundary, /data-story-workflow/);
});

test("release navigation keeps shortcut letters out of navigation subtitles and documents them in Settings Help", async () => {
  const [shell, boundary] = await Promise.all([
    source("app/plotpickle-workspace-shell.tsx"),
    source("app/navigation/release-experience-boundary.tsx"),
  ]);
  assert.match(shell, /<small>\{item\.detail\}<\/small>/);
  assert.doesNotMatch(shell, /item\.detail\} · \$\{item\.key/);
  assert.doesNotMatch(shell, /data-global-shortcut-help/);
  assert.match(boundary, /SettingsKeyboardShortcutsHost/);
  assert.match(boundary, /GLOBAL_SHORTCUTS\.map/);
  assert.match(boundary, /Keyboard navigation/);
});

test("release navigation forces standalone Write and Feedback surfaces onto approved PlotPickle design tokens", async () => {
  const css = await source("app/navigation/release-experience-boundary.module.css");
  for (const selector of ["standalone-studio-surface", "feedback-studio-shell", 'workspace[data-write-studio="true"]']) {
    assert.ok(css.includes(selector), `Release colour guard is missing ${selector}`);
  }
  for (const token of ["--pp-matte", "--pp-surface", "--pp-text", "--pp-teal", "--pp-orange", "--pp-orange-bright"]) {
    assert.ok(css.includes(token), `Release colour guard is missing ${token}`);
  }
  assert.doesNotMatch(css, /#7d72c6|#e6f2ff|#fff0c7/);
});
