import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("phase 2 step 4 exposes all three project modes in Repository & Collab settings", async () => {
  const [collaboration, mode] = await Promise.all([
    source("app/github-collaboration.tsx"),
    source("lib/collaboration-mode.ts"),
  ]);
  assert.match(collaboration, /Project operating mode/);
  for (const text of ["Local Story Mode", "Writers' Room Mode", "Repository Collaboration Mode"]) {
    assert.match(mode, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(collaboration, /surface === "configuration" \? <ProjectModeSettings/);
  assert.match(collaboration, /role="radiogroup"/);
  assert.match(collaboration, /role="radio"/);
  assert.match(collaboration, /aria-checked=\{active\}/);
});

test("phase 2 step 4 requires an explicit human confirmation before mode changes", async () => {
  const [collaboration, mode] = await Promise.all([
    source("app/github-collaboration.tsx"),
    source("lib/collaboration-mode.ts"),
  ]);
  assert.match(collaboration, /window\.confirm\(collaborationTransitionConfirmation\(result\.plan\)\)/);
  assert.match(mode, /This changes the project operating mode only/);
  assert.match(mode, /It will not connect or disconnect GitHub or Buzz/);
  assert.match(mode, /start synchronization, publish changes, or alter story canon/);
  assert.ok(collaboration.indexOf("if (!confirmed) return") < collaboration.indexOf("onChange(result.project)"));
});

test("phase 2 step 4 delegates mode changes to the preservation-safe transition engine", async () => {
  const [collaboration, mode] = await Promise.all([
    source("app/github-collaboration.tsx"),
    source("lib/collaboration-mode.ts"),
  ]);
  assert.match(collaboration, /transitionCollaborationMode\(project, mode/);
  assert.match(mode, /collaboration: withCollaborationMode\(project\.collaboration, plan\.to\)/);
  assert.match(mode, /\.\.\.project/);
  assert.match(mode, /\.\.\.collaboration/);
  assert.doesNotMatch(collaboration, /connectGitHub|disconnectGitHub|startBuzz|stopBuzz|syncProject|publishProject/);
  assert.match(collaboration, /Changing mode preserves the PPF, local backups and all GitHub and Buzz setup/);
  assert.match(collaboration, /every canon change still requires explicit human approval/);
});

test("phase 2 step 4 keeps legacy projects safe and Dashboard mode composition unchanged", async () => {
  const [mode, dashboard] = await Promise.all([
    source("lib/collaboration-mode.ts"),
    source("app/project-collaboration-status.tsx"),
  ]);
  assert.match(mode, /return isCollaborationMode\(value\) \? value : "local-story"/);
  assert.match(dashboard, /normalizeCollaborationModeRecord\(project\.collaboration\)/);
  assert.match(dashboard, /COLLABORATION_MODE_COPY\[collaboration\.mode\]/);
});

test("phase 2 step 4 styles remain responsive and semantic", async () => {
  const css = await source("app/project-mode-settings.module.css");
  for (const selector of [".panel", ".options", ".active", ".boundary"]) assert.ok(css.includes(selector));
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.doesNotMatch(css, /#f00|#ff0000|\bred\b/i);
});
