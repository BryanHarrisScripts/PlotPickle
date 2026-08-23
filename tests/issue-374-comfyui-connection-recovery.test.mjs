import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #374 preserves user-selected loopback ComfyUI ports", async () => {
  const diagnostics = await source("build/comfyui-connection-diagnostics.ts");

  for (const contract of [
    'const DEFAULT_PORT = "8188"',
    'new Set(["127.0.0.1", "localhost", "[::1]", "::1"])',
    "const port = url.port || DEFAULT_PORT",
    "portNumber < 1 || portNumber > 65_535",
    "return `${url.protocol}//${url.hostname}:${port}`",
  ]) assert.ok(diagnostics.includes(contract), `Missing configurable loopback contract: ${contract}`);

  assert.doesNotMatch(diagnostics, /\(url\.port \|\| "8188"\) !== "8188"/);
  assert.doesNotMatch(diagnostics, /return DEFAULT_BASE_URL;\s*\n}/);
});

test("issue #374 probes safe loopback alternatives without allowing remote hosts", async () => {
  const diagnostics = await source("build/comfyui-connection-diagnostics.ts");

  for (const contract of [
    "export function localComfyCandidates",
    "`http://127.0.0.1:${port}`",
    "`http://localhost:${port}`",
    "`http://[::1]:${port}`",
    "for (const candidate of candidates)",
    'requestJson(candidate, "/system_stats")',
    "attemptedUrls.push(candidate)",
  ]) assert.ok(diagnostics.includes(contract), `Missing alternate loopback probe: ${contract}`);

  assert.ok(diagnostics.includes("ComfyUI must use a local loopback address"));
  assert.ok(diagnostics.includes("url.protocol !== \"http:\" || !loopbackHost(url.hostname)"));
});

test("issue #374 separates service reachability from generation readiness", async () => {
  const diagnostics = await source("build/comfyui-connection-diagnostics.ts");

  for (const contract of [
    'export type ComfyConnectionState = "ready" | "running-setup" | "not-listening" | "timeout" | "invalid-response"',
    "connectionState: state",
    'connectionState: ready ? "ready" : "running-setup"',
    "serviceReady: true",
    "capabilityError",
    "repairGuidance",
  ]) assert.ok(diagnostics.includes(contract), `Missing structured ComfyUI state: ${contract}`);
});

test("issue #374 gives actionable stopped wrong-port timeout and invalid-response guidance", async () => {
  const diagnostics = await source("build/comfyui-connection-diagnostics.ts");

  for (const phrase of [
    "ComfyUI may be installed but not running, or it may be using another local port",
    "ComfyUI may be installed but still starting",
    "it did not respond like the ComfyUI API",
    "If it is not port 8188, enter the displayed loopback port above and retry",
    "install or enable the listed checkpoint and nodes",
  ]) assert.ok(diagnostics.includes(phrase), `Missing recovery guidance: ${phrase}`);
});

test("issue #374 continues to persist diagnostics and refresh Dashboard status", async () => {
  const [gateway, panel] = await Promise.all([
    source("build/provider-diagnostics-gateway.ts"),
    source("app/media-routing-panel.tsx"),
  ]);

  for (const contract of [
    "normalizeLocalComfyUrl(body.baseUrl ?? store.comfyui.baseUrl)",
    "store.comfyui.baseUrl = baseUrl",
    "diagnoseComfyUI(baseUrl, store.comfyui.h3Workflow)",
  ]) assert.ok(gateway.includes(contract), `Missing persisted diagnostic contract: ${contract}`);

  for (const contract of [
    "Save & run live ComfyUI diagnostic",
    "setComfyBaseUrl(merged.comfyui.baseUrl)",
    "requestConnectionStatusRefresh()",
    'window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"))',
  ]) assert.ok(panel.includes(contract), `Missing ComfyUI interface refresh contract: ${contract}`);
});
