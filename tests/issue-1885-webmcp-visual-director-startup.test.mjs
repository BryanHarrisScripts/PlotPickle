import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("#1885 local WebMCP Testing runs the Visual Director in the same isolated session", async () => {
  const runner = await read("scripts/run-webmcp-startup-uat.mjs");

  assert.match(runner, /VISUAL_DIRECTOR_REPORT_PATH/);
  assert.match(runner, /runSkinV1VisualDirector/);
  assert.match(runner, /const visualDirector = await runSkinV1VisualDirector\(\{/u);
  assert.match(runner, /serverUrl: server\.origin,[\s\S]*toolRoot: resolvedToolRoot,[\s\S]*storageStatePath: auth\.storageStatePath/u);

  const surfaceAudit = runner.indexOf("await runWebMcpSurfaceVisualAudit({");
  const visualDirector = runner.indexOf("const visualDirector = await runSkinV1VisualDirector({");
  const menuAudit = runner.indexOf("await runSkinV1MenuContractAudit({");
  assert.ok(surfaceAudit >= 0 && visualDirector > surfaceAudit && menuAudit > visualDirector,
    "startup must run surface audit, then Visual Director, then menu audit");

  assert.match(runner, /visualDirector:\s*\{[\s\S]*report: path\.resolve\(VISUAL_DIRECTOR_REPORT_PATH\)[\s\S]*surfaces: visualDirector\.totals\.surfaces[\s\S]*blockers: visualDirector\.totals\.blockers[\s\S]*advisories: visualDirector\.totals\.advisories/u);
  assert.match(runner, /Visual Director compared \$\{visualDirector\.totals\.surfaces\} submenus against Dashboard/u);
  assert.match(runner, /Visual Director report: \$\{path\.resolve\(VISUAL_DIRECTOR_REPORT_PATH\)\}/u);
});
