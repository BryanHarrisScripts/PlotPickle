import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("launcher checks clean main for GitHub updates before probing localhost", async () => {
  const [launcher, sync] = await Promise.all([
    read("Start-PlotPickle.bat"),
    read("scripts/windows-source-sync.mjs"),
  ]);

  const sourceCheck = launcher.indexOf("[SOURCE] Checking whether this PlotPickle checkout is current");
  const portProbe = launcher.indexOf("[CHECK] Looking for an existing PlotPickle session");
  assert.ok(sourceCheck >= 0 && portProbe > sourceCheck, "source update must happen before local-session reuse");
  assert.match(launcher, /SOURCE_SYNC=scripts\\windows-source-sync\.mjs/);
  assert.match(launcher, /PLOTPICKLE_SOURCE_UPDATED/);
  assert.match(launcher, /call "%~f0" --source-current/);

  assert.match(sync, /branch !== "main"/);
  assert.match(sync, /status", "--porcelain", "--untracked-files=no/);
  assert.match(sync, /fetch", "--quiet", "origin", "main"/);
  assert.match(sync, /merge-base", "--is-ancestor", "HEAD", "origin\/main"/);
  assert.match(sync, /merge", "--ff-only", "origin\/main"/);
  assert.match(sync, /result\.updated = "1"/);
});

test("current page and Windows probe share an explicit startup marker", async () => {
  const [page, launcher] = await Promise.all([
    read("app/page.tsx"),
    read("Start-PlotPickle.bat"),
  ]);

  assert.match(page, /STARTUP_CONTRACT = "plotpickle-startup-v2"/);
  assert.match(page, /data-plotpickle-startup=\{STARTUP_CONTRACT\}/);
  assert.match(launcher, /PLOTPICKLE_STARTUP_MARKER=plotpickle-startup-v2/);
  assert.match(launcher, /\$response\.Content -match '%PLOTPICKLE_STARTUP_MARKER%'/);
  assert.match(launcher, /exit 3/);
  assert.match(launcher, /\[STALE SESSION\]/);
  assert.match(launcher, /Close the older PlotPickle command window with Ctrl\+C/);
});

test("automatic source sync is deliberately non-destructive", async () => {
  const sync = await read("scripts/windows-source-sync.mjs");

  assert.match(sync, /tracked local changes/);
  assert.match(sync, /result\.mode = "dirty"/);
  assert.match(sync, /result\.mode = "diverged"/);
  assert.match(sync, /result\.mode = "fetch-failed"/);
  assert.doesNotMatch(sync, /reset\s+--hard|clean\s+-f|checkout\s+-f|push\s+--force/);
});
