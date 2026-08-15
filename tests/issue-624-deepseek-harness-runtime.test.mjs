import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("DeepSeek Harness is an optional local-only gateway and never part of normal startup", async () => {
  const [localGateway, gateway, runtime] = await Promise.all([
    read("build/local-ai-gateway.ts"),
    read("build/deepseek-harness-gateway.ts"),
    read("build/deepseek-harness-runtime.ts"),
  ]);

  assert.match(localGateway, /registerDeepSeekHarnessGateway/);
  assert.match(localGateway, /registerDeepSeekHarnessGateway\(server\)/);
  assert.match(gateway, /\/api\/deepseek-harness\/status/);
  assert.match(gateway, /\/api\/deepseek-harness\/launch/);
  assert.match(gateway, /isLocalRequest\(request\)/);
  assert.match(gateway, /pathname === STATUS_PATH && request\.method === "GET"/);
  assert.match(gateway, /pathname === LAUNCH_PATH && request\.method === "POST"/);
  assert.match(runtime, /optional: true/);
  assert.match(runtime, /autoInstallOnStartup: false/);
  assert.doesNotMatch(localGateway, /launchDeepSeekHarness\(/);
});

test("DSH detection distinguishes running, installed, available and not installed states", async () => {
  const runtime = await read("build/deepseek-harness-runtime.ts");

  assert.match(runtime, /"running" \| "installed" \| "available" \| "not-installed"/);
  assert.match(runtime, /runCommand\("ollama", \["--version"\]/);
  assert.match(runtime, /runCommand\("ollama", \["launch", "--help"\]/);
  assert.match(runtime, /commandExists\("dsh"\)/);
  assert.match(runtime, /dshProcessRunning\(\)/);
  assert.match(runtime, /command: "ollama launch dsh"/);
});

test("launching DSH is an explicit user action through Ollama", async () => {
  const [runtime, panel] = await Promise.all([
    read("build/deepseek-harness-runtime.ts"),
    read("app/deepseek-harness-panel.tsx"),
  ]);

  assert.match(runtime, /export async function launchDeepSeekHarness/);
  assert.match(runtime, /spawn\("ollama", \["launch", "dsh"\]/);
  assert.match(runtime, /cmd \/k ollama launch dsh/);
  assert.match(panel, />DeepSeek Harness</);
  assert.match(panel, /Install & launch DSH/);
  assert.match(panel, /\/api\/deepseek-harness\/launch/);
  assert.match(panel, /method: "POST"/);
  assert.match(panel, /never installs or launches DeepSeek Harness during normal startup/i);
  assert.match(panel, /native Agent Activity trace as the normal product runtime/i);
});

test("Settings exposes DSH only in advanced runtime details", async () => {
  const workspace = await read("app/sage-settings-workspace.tsx");

  assert.match(workspace, /DeepSeekHarnessPanel/);
  const detailsIndex = workspace.indexOf("<details");
  const harnessIndex = workspace.indexOf("<DeepSeekHarnessPanel />");
  assert.ok(detailsIndex >= 0 && harnessIndex > detailsIndex);
  assert.match(workspace, /Advanced runtime details/);
});

test("focused Startup and Settings UAT own the DSH regression", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const startup = registry.areas.find((area) => area.id === "startup");
  const settings = registry.areas.find((area) => area.id === "settings");
  assert.ok(startup?.tests.includes("tests/issue-624-deepseek-harness-runtime.test.mjs"));
  assert.ok(settings?.tests.includes("tests/issue-624-deepseek-harness-runtime.test.mjs"));
});

test("observability documentation describes the supported DSH adapter boundary", async () => {
  const doc = await read("docs/architecture/agent-observability.md");
  assert.match(doc, /Ollama supports DeepSeek Harness/i);
  assert.match(doc, /ollama launch dsh/);
  assert.match(doc, /optional/i);
  assert.match(doc, /native operational trace remains the canonical baseline/i);
});
