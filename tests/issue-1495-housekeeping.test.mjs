import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1495 keeps Settings off every locked profile-access surface", async () => {
  const boundary = await source("app/profile-access/profile-access-boundary.tsx");
  const lockedSurfaces = boundary.match(/<main className=\{styles\.boundary\} data-profile-access-boundary="locked">/g) ?? [];
  assert.ok(lockedSurfaces.length >= 5, "all non-ready profile screens must declare the locked boundary");
  assert.doesNotMatch(boundary, /<main className=\{styles\.boundary\}>/);

  const anchor = await source("app/ui-continuity-anchor.tsx");
  assert.match(anchor, /data-profile-access-boundary="locked"/);
  assert.match(anchor, /const profileLocked = Boolean/);
  assert.match(anchor, /!profileLocked/);
  assert.match(anchor, /if \(!standalone\) return null/);
});

test("#1495 gives the Learn center lesson an intentional rounded page surface", async () => {
  const css = await source("modules/learn/ui/learn-workspace.module.css");
  const lesson = css.match(/\.lesson \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(lesson, /margin: 12px 14px/);
  assert.match(lesson, /border: 1px solid rgba\(53, 201, 184, 0\.22\)/);
  assert.match(lesson, /border-radius: 18px/);
  assert.match(lesson, /overflow-y: auto/);
  assert.match(lesson, /#0d0f10/);
  assert.match(css, /grid-template-columns: minmax\(240px, 19%\) minmax\(440px, 56%\) minmax\(310px, 25%\)/);
});

test("#1495 removes tracked root validation logs while keeping logs ignored", async () => {
  const debris = [
    "issue-52-validation.log",
    "issue-53-validation.log",
    "issue-54-validation.log",
    "issue-55-validation.log",
    "issue-56-validation.log",
    "issue-58-validation.log",
    "issue-59-validation.log",
    "issues-60-62-validation.log",
  ];
  for (const path of debris) {
    await assert.rejects(access(new URL(path, root)), `${path} must not remain at repository root`);
  }
  const gitignore = await source(".gitignore");
  assert.match(gitignore, /^\*\.log$/m);
});
