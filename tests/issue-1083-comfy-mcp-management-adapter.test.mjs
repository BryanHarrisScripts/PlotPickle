import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1083 treats Comfy MCP as an optional management adapter, not the image-generation authority", async () => {
  const [diagnostics, providerGateway, localAi] = await Promise.all([
    source("build/comfyui-connection-diagnostics.ts"),
    source("build/provider-diagnostics-gateway.ts"),
    source("build/local-ai-gateway.ts"),
  ]);
  assert.match(diagnostics, /adapter: "comfy-mcp" \| "direct-api"/);
  assert.match(diagnostics, /Comfy MCP is optional and is not installed/);
  assert.match(diagnostics, /PlotPickle still owns provider choice, consent and generation routing/);
  assert.match(providerGateway, /diagnoseComfyUI\(baseUrl, store\.comfyui\.h3Workflow\)/);
  assert.match(localAi, /\/api\/local-ai\/generate\/image/);
  assert.doesNotMatch(localAi, /partner_generate|comfy-mcp.*generate/i);
});

test("#1083 verifies the official local MCP prerequisites and preserves direct fallback", async () => {
  const diagnostics = await source("build/comfyui-connection-diagnostics.ts");
  assert.match(diagnostics, /COMFY_MCP_MINIMUM_CLI_VERSION = "1\.14\.0"/);
  assert.match(diagnostics, /probeExecutableVersion\("comfy-mcp"\)/);
  assert.match(diagnostics, /process\.env\.COMFY_BIN\?\.trim\(\) \|\| "comfy"/);
  assert.match(diagnostics, /execFileAsync\(executable, \["--version"\]/);
  assert.match(diagnostics, /comfyVersionAtLeast\(cli\.version\)/);
  assert.match(diagnostics, /adapter: "direct-api"/);
  assert.match(diagnostics, /Direct local ComfyUI support remains available/);
});

test("#1083 never invokes management commands through a shell and bounds their output/time", async () => {
  const [diagnostics, onboarding] = await Promise.all([
    source("build/comfyui-connection-diagnostics.ts"),
    source("build/comfyui-onboarding-gateway.ts"),
  ]);
  assert.match(diagnostics, /execFileAsync\(comfyBin, \["launch", "--background"\]/);
  assert.match(diagnostics, /windowsHide: true/);
  assert.match(diagnostics, /MANAGEMENT_PROBE_TIMEOUT_MS = 4_000/);
  assert.match(diagnostics, /MANAGEMENT_OUTPUT_LIMIT = 64 \* 1024/);
  assert.doesNotMatch(diagnostics, /shell:\s*true/);
  assert.doesNotMatch(onboarding, /shell:\s*true/);
});

test("#1083 prefers managed comfy-cli lifecycle only when the Comfy MCP stack is ready", async () => {
  const onboarding = await source("build/comfyui-onboarding-gateway.ts");
  const managedIndex = onboarding.indexOf("launchComfyWithManagedCli()");
  const fallbackIndex = onboarding.indexOf("return startWithDesktopFallback()");
  assert.ok(managedIndex >= 0 && fallbackIndex > managedIndex, "Managed lifecycle must run before Desktop fallback");
  assert.match(onboarding, /diagnoseComfyUI\(LOCAL_COMFY_URL, null\)/);
  assert.match(onboarding, /existing\.serviceReady/);
  assert.match(onboarding, /"mcp-managed-started-ready"/);
  assert.match(onboarding, /"desktop-fallback"/);
  assert.match(onboarding, /PlotPickle needs your permission before opening or starting a local ComfyUI workspace/);
});

test("#1083 keeps ComfyUI local and never silently promotes a failed local setup to cloud", async () => {
  const [diagnostics, onboarding, panel] = await Promise.all([
    source("build/comfyui-connection-diagnostics.ts"),
    source("build/comfyui-onboarding-gateway.ts"),
    source("app/media-routing-panel.tsx"),
  ]);
  assert.match(diagnostics, /LOOPBACK_HOSTS = new Set\(\["127\.0\.0\.1", "localhost", "\[::1\]", "::1"\]\)/);
  assert.match(diagnostics, /ComfyUI must use a local loopback address/);
  assert.match(onboarding, /LOCAL_COMFY_URL = "http:\/\/127\.0\.0\.1:8188"/);
  assert.match(panel, /PlotPickle never falls back to a paid provider automatically/);
  assert.match(panel, /Your current image provider remains active/);
});

test("#1083 exposes only bounded hardware facts and does not return raw ComfyUI system command details", async () => {
  const diagnostics = await source("build/comfyui-connection-diagnostics.ts");
  assert.match(diagnostics, /gpuName: string/);
  assert.match(diagnostics, /totalVramMb: number \| null/);
  assert.match(diagnostics, /freeVramMb: number \| null/);
  assert.match(diagnostics, /safeDeviceName/);
  assert.match(diagnostics, /slice\(0, 160\)/);
  assert.match(diagnostics, /hardware: hardwareFromSystem\(system\)/);
  assert.doesNotMatch(diagnostics, /python_version\s*:/);
  assert.doesNotMatch(diagnostics, /argv\s*:/);
  assert.doesNotMatch(diagnostics, /environment\s*:/);
});

test("#1083 shows the normalized Comfy management and safe GPU facts in Settings", async () => {
  const host = await source("app/configuration-dashboard-host.tsx");
  assert.match(host, /aria-label="ComfyUI management readiness"/);
  assert.match(host, /Managed · Comfy MCP/);
  assert.match(host, /Direct local ComfyUI API/);
  assert.match(host, /Installed · not running/);
  assert.match(host, /Local GPU:/);
  assert.match(host, /totalVramMb/);
  assert.match(host, /freeVramMb/);
  assert.match(host, /never turns a failed local setup into a paid cloud request automatically/i);
  assert.doesNotMatch(host, /python_version|argv|environment|privateKey|apiKey/);
});

test("#1083 does not give creative agents custom-node install, partner-credit or arbitrary MCP authority", async () => {
  const [diagnostics, onboarding] = await Promise.all([
    source("build/comfyui-connection-diagnostics.ts"),
    source("build/comfyui-onboarding-gateway.ts"),
  ]);
  for (const forbidden of ["install_node", "partner_generate", "auth_login", "download_model", "run_workflow", "run_template"]) {
    assert.equal(diagnostics.includes(forbidden), false, `${forbidden} must not enter the host management adapter`);
    assert.equal(onboarding.includes(forbidden), false, `${forbidden} must not enter the startup gateway`);
  }
  assert.match(diagnostics, /PlotPickle still owns provider choice, consent and generation routing/);
});
