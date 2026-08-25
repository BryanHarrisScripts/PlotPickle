import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runner = await readFile(new URL("../scripts/run-local-browser-uat.mjs", import.meta.url), "utf8");
const shell = await readFile(new URL("../app/plotpickle-workspace-shell.tsx", import.meta.url), "utf8");
const profileBoundary = await readFile(new URL("../app/profile-access/profile-access-boundary.tsx", import.meta.url), "utf8");

test("#1239 local UAT observes the current workspace shell instead of removed legacy attributes", () => {
  assert.match(runner, /\[data-active-workspace\]/);
  assert.match(runner, /\[data-workspace-nav-id\]/);
  assert.match(runner, /button\[aria-current=/);
  assert.doesNotMatch(runner, /data-workspace-active/);
  assert.doesNotMatch(runner, /querySelectorAll\('\[data-workspace-id\]'/);

  assert.match(shell, /data-active-workspace=\{activeWorkspace\}/);
  assert.match(shell, /data-workspace-nav-id=\{item\.id\}/);
});

test("#1239 deterministic journey covers current selectable workspaces, not future disabled stages", () => {
  for (const workspace of ["learn", "community", "library", "wyrmwood", "plan", "build", "dashboard", "settings"]) {
    assert.match(runner, new RegExp(`id: "${workspace}"`));
  }
  for (const staleLabel of ["Storyboard", "Write", "Graphic Novel", "Feedback", "Refine", "Reports"]) {
    assert.doesNotMatch(runner, new RegExp(`label: "${staleLabel}"`));
  }
});

test("#1239 deterministic runner stops honestly at the Human-only profile boundary", () => {
  assert.match(runner, /profileAuthenticated/);
  assert.match(runner, /profileGateVisible/);
  assert.match(runner, /Human-only profile gate/);
  assert.match(runner, /does not automate a passphrase or recovery secret/);
  assert.match(profileBoundary, /aria-label="Active PlotPickle Human"/);
});
