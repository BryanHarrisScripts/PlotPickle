import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

test("#1404 reuses the Windows interaction harness for focused Microsoft Edge Community liveness", async () => {
  const smoke = await source("scripts/windows-interaction-smoke.mjs");
  for (const contract of [
    "PLOTPICKLE_SMOKE_COMMUNITY_EDGE",
    '"Microsoft", "Edge", "Application", "msedge.exe"',
    "communityEdgeMode ? edgeCandidates",
    "--app=",
    "--user-data-dir=",
    "--headless=new",
    "createTarget",
    "Inspector.targetCrashed",
    "runCommunityEdgeScenario",
    "performance.timeOrigin",
    "STATUS_ACCESS_VIOLATION",
    "communityStableMs",
    "establishVerificationSyntheticHuman",
    "PLOTPICKLE_VERIFICATION_AUTH_COOKIE",
    "Network.setCookie",
  ]) assert.ok(smoke.includes(contract), `Windows interaction smoke is missing Community Edge contract: ${contract}`);
  assert.match(smoke, /data-navigation-area-id=.*connect/);
  assert.match(smoke, /button.checkVisibility\(\)/);
  assert.match(smoke, /data-workspace-nav-id=.*community/);
  assert.match(smoke, /data-community-native-buzz=.*true/);
  assert.match(smoke, /communityEdgeMode \? \[`--app=\$\{baseUrl\}\/\?workspace=dashboard`\] : \["--disable-gpu", "about:blank"\]/);

  const syntax = spawnSync(process.execPath, ["--check", "scripts/windows-interaction-smoke.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
});

test("#1404 does not add a second root-level CDP smoke implementation", async () => {
  await assert.rejects(source("scripts/windows-community-edge-smoke.mjs"), /ENOENT/);
});

test("#1404 Profile Experience runs the focused mode through the existing interaction harness on Windows", async () => {
  const workflow = await source(".github/workflows/profile-experience.yml");
  assert.match(workflow, /tests\/issue-1404-community-edge-navigation\.test\.mjs/);
  assert.match(workflow, /scripts\/windows-interaction-smoke\.mjs/);
  assert.match(workflow, /PLOTPICKLE_SMOKE_COMMUNITY_EDGE: "1"/);
  assert.match(workflow, /Validate managed Edge Community navigation/);
  assert.match(workflow, /node scripts\/windows-interaction-smoke\.mjs \. reports\/windows-community-edge/);
  assert.match(workflow, /if: matrix\.os == 'windows-latest'/);
});
