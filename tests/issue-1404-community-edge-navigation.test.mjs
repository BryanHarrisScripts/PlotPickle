import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

test("#1404 enters Community without a document-level RSC reload", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /if \(workspace === "community"\) \{/);
  assert.match(page, /window\.history\.pushState\(\{ plotpickleWorkspace: workspace \}, "", href\)/);
  assert.match(page, /window\.dispatchEvent\(new PopStateEvent\("popstate"\)\)/);
  assert.match(page, /window\.location\.assign\(href\)/);

  const communityBlock = page.match(/if \(workspace === "community"\) \{[\s\S]*?\n  \}/)?.[0] || "";
  assert.ok(communityBlock, "Community-specific navigation branch must exist");
  assert.doesNotMatch(communityBlock, /location\.assign|location\.replace|location\.href\s*=/);
});

test("#1404 Node 24 server smoke compiles the Community query-state workspace", async () => {
  const smoke = await source("scripts/windows-server-smoke.mjs");
  assert.match(smoke, /communityProbeUrl/);
  assert.match(smoke, /new URL\("\/\?workspace=community", url\)\.href/);
  assert.match(smoke, /PlotPickle Community probe failed/);
  assert.match(smoke, /root, navigation and Community probes passed/);
});

test("#1404 managed browser smoke uses Edge app mode and observes renderer crashes", async () => {
  const smoke = await source("scripts/windows-community-edge-smoke.mjs");
  for (const contract of [
    "Microsoft\\Edge\\Application\\msedge.exe",
    "--app=",
    "--user-data-dir=",
    "--headless=new",
    "Inspector.targetCrashed",
    "performance.timeOrigin",
    "STATUS_ACCESS_VIOLATION",
    "stableCommunityMs",
  ]) assert.ok(smoke.includes(contract), `Managed Edge Community smoke is missing: ${contract}`);
  assert.match(smoke, /data-workspace-nav-id=.*community/);
  assert.match(smoke, /data-community-native-buzz=.*true/);
  assert.doesNotMatch(smoke, /--disable-gpu/);
  assert.match(smoke, /process\.platform !== "win32"/);
});

test("#1404 Profile Experience runs the Community regression and managed Edge smoke on Windows", async () => {
  const workflow = await source(".github/workflows/profile-experience.yml");
  assert.match(workflow, /tests\/issue-1404-community-edge-navigation\.test\.mjs/);
  assert.match(workflow, /scripts\/windows-community-edge-smoke\.mjs/);
  assert.match(workflow, /Validate managed Edge Community navigation/);
  assert.match(workflow, /node scripts\/windows-community-edge-smoke\.mjs \./);
  assert.match(workflow, /if: matrix\.os == 'windows-latest'/);
});
