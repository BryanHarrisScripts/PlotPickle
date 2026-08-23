import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1265 attended Casebook proves PlotPickle is ready before browser navigation", async () => {
  const source = await read("scripts/run-casebook-attended.mjs");
  const checking = source.indexOf('status("Attended endpoint", "CHECKING"');
  const preflight = source.indexOf("await ensureWriterAppRuntime({");
  const ready = source.indexOf('status("Attended endpoint", "READY"');
  const initialize = source.indexOf("await client.initialize()");
  const navigate = source.indexOf("await browser.navigate(endpointTarget.baseUrl)");

  assert.ok(checking >= 0, "Casebook must describe an unresolved endpoint as CHECKING, not READY");
  assert.ok(preflight > checking, "PlotPickle preflight must follow the CHECKING status");
  assert.ok(ready > preflight, "READY must not be printed until PlotPickle preflight succeeds");
  assert.ok(initialize > ready, "Playwright MCP must not initialize before PlotPickle is proven ready");
  assert.ok(navigate > initialize, "browser navigation must happen only after the proven app preflight");
  assert.match(source, /import \{ ensureWriterAppRuntime \} from "\.\/writer-app-runtime\.mjs"/);
  assert.match(source, /baseUrl: endpointTarget\.baseUrl/);
  assert.match(source, /repoRoot,/);
  assert.match(source, /await endpointTarget\.assertCurrent\(\)/);
});

test("#1265 attended Casebook stops only the app runtime it acquired through the existing preflight seam", async () => {
  const runner = await read("scripts/run-casebook-attended.mjs");
  const runtime = await read("scripts/writer-app-runtime.mjs");

  assert.match(runner, /await appRuntime\.stop\(\)/);
  assert.match(runtime, /if \(!runtime\?\.owned \|\| runtime\.stopped\) return/);
  assert.match(runtime, /source: "existing"/);
  assert.match(runtime, /source: "writer-owned-vite"/);
  assert.match(runtime, /The target responded, but it did not identify itself as PlotPickle/);
  assert.match(runtime, /Automatic startup is limited to/);
});
