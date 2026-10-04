import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  DeveloperToolClass,
  authorizeDeveloperTool,
} from "../lib/agents/developer-tool-authorization.mjs";
import { loadPlotPickleNativeMcpRegistration } from "../.pi/extensions/plotpickle-native-mcp.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await read(path));
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

function mcpRoundTrip(registration) {
  return new Promise((resolve, reject) => {
    const child = spawn(registration.config.command, registration.config.args, {
      cwd: registration.config.cwd || REPO_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const responses = new Map();
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => finish(new Error(`MCP stdio proof timed out. stderr=${stderr}`)), 10_000);

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdin.end();
      child.kill();
      if (error) reject(error);
      else resolve(responses);
    };

    child.on("error", finish);
    child.on("exit", (code) => {
      if (!settled && responses.size < 2) finish(new Error(`MCP server exited early with code ${code}. stderr=${stderr}`));
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      const lines = stdout.split(/\r?\n/u);
      stdout = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const message = JSON.parse(line);
        if (message.id === 1 || message.id === 2) responses.set(message.id, message);
      }
      if (responses.has(1) && responses.has(2)) finish();
    });

    child.stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "plotpickle-phase2-proof", version: "1.0.0" },
      },
    }) + "\n");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");
  });
}

test("#2591 Pi uses the canonical PlotPickle MCP server through native 0.99 registration", async () => {
  const [registration, shared, cline, policy, settings, stack] = await Promise.all([
    loadPlotPickleNativeMcpRegistration(REPO_ROOT),
    json(".mcp.json"),
    json(".cline/mcp.json"),
    json("config/pi-tool-exposure-policy.json"),
    json(".pi/settings.json"),
    json("config/developer-agent-stack.json"),
  ]);

  assert.equal(registration.name, "plotpickle-dev");
  assert.equal(registration.config.command, shared.mcpServers["plotpickle-dev"].command);
  assert.deepEqual(registration.config.args, shared.mcpServers["plotpickle-dev"].args);
  assert.equal(cline.mcpServers["plotpickle-dev"].command, shared.mcpServers["plotpickle-dev"].command);
  assert.deepEqual(cline.mcpServers["plotpickle-dev"].args, shared.mcpServers["plotpickle-dev"].args);
  assert.equal(registration.config.exposure, "codemode");
  assert.equal(registration.config.toolExposure.plotpickle_status, "direct");
  assert.equal(registration.config.toolExposure.plotpickle_hooks, "direct");
  assert.equal(registration.config.toolExposure.plotpickle_validate, "codemode");
  assert.equal(policy.canonicalConfig, ".mcp.json");
  assert.ok(settings.defaultTools.includes("+codemode"));
  assert.equal(settings.packages.some((item) => item.includes("pi-mcp-adapter")), false);
  assert.equal(stack.piRuntime.nativeMcp.enabled, true);
  assert.equal(stack.piRuntime.nativeMcp.legacyAdapterRollbackPolicy, "dormant-audit-only-not-loaded");
  assert.equal(stack.mcp.piNative, true);
});

test("#2591 native registration completes a real plotpickle-dev stdio round trip", async () => {
  const registration = await loadPlotPickleNativeMcpRegistration(REPO_ROOT);
  const responses = await mcpRoundTrip(registration);
  const initialized = responses.get(1);
  const tools = responses.get(2);

  assert.equal(initialized?.result?.serverInfo?.name, "plotpickle-dev");
  const names = tools?.result?.tools?.map((tool) => tool.name) ?? [];
  assert.deepEqual(names, [
    "plotpickle_status",
    "plotpickle_hooks",
    "plotpickle_uat_findings",
    "plotpickle_focused_uat",
    "plotpickle_build",
    "plotpickle_validate",
  ]);
});

test("#2591 tool exposure never substitutes for governed authorization", () => {
  assert.equal(authorizeDeveloperTool({
    toolName: "plotpickle_status",
    toolClass: DeveloperToolClass.READ,
  }).allowed, true);

  assert.equal(authorizeDeveloperTool({
    toolName: "plotpickle_validate",
    toolClass: DeveloperToolClass.EVIDENCE,
  }).allowed, true);

  assert.deepEqual(authorizeDeveloperTool({
    toolName: "source_write",
    toolClass: DeveloperToolClass.SOURCE_MUTATION,
  }), {
    allowed: false,
    reason: "governed-task-authorization-required",
  });

  const governed = {
    authorized: true,
    state: "building",
    mutationAuthorized: true,
    allowedTools: ["source_write", "delete_branch"],
  };
  assert.equal(authorizeDeveloperTool({
    toolName: "source_write",
    toolClass: DeveloperToolClass.SOURCE_MUTATION,
    task: governed,
  }).allowed, true);

  assert.equal(authorizeDeveloperTool({
    toolName: "delete_branch",
    toolClass: DeveloperToolClass.DESTRUCTIVE_ADMIN,
    task: governed,
  }).allowed, false);

  assert.equal(authorizeDeveloperTool({
    toolName: "delete_branch",
    toolClass: DeveloperToolClass.DESTRUCTIVE_ADMIN,
    task: { ...governed, destructiveAuthorized: true },
  }).allowed, true);

  assert.equal(authorizeDeveloperTool({
    toolName: "read_secret",
    toolClass: DeveloperToolClass.SECRET,
    task: { ...governed, destructiveAuthorized: true, allowedTools: ["*"] },
  }).allowed, false);
});

test("#2591 live MCP dispatcher classifies every exposed tool before execution", async () => {
  const source = await read("scripts/developer-agent-mcp.mjs");
  for (const tool of [
    "plotpickle_status",
    "plotpickle_hooks",
    "plotpickle_uat_findings",
    "plotpickle_focused_uat",
    "plotpickle_build",
    "plotpickle_validate",
  ]) {
    assert.match(source, new RegExp(`${tool}: DeveloperToolClass\\.`));
  }
  assert.match(source, /assertDeveloperToolAuthorized\(\{ toolName: name, toolClass \}\)/u);
  assert.doesNotMatch(source, /DeveloperToolClass\.SOURCE_MUTATION/u);
  assert.doesNotMatch(source, /DeveloperToolClass\.DESTRUCTIVE_ADMIN/u);
});

test("#2591 retires pi-mcp-adapter from every loaded project package path", async () => {
  const [settings, stack, setup, compatibility] = await Promise.all([
    json(".pi/settings.json"),
    json("config/developer-agent-stack.json"),
    read("scripts/setup-developer-agent-stack.ps1"),
    json("config/pi-099-compatibility.json"),
  ]);

  assert.equal(settings.packages.some((item) => item.includes("pi-mcp-adapter")), false);
  assert.equal(stack.piPackages.some((item) => item.includes("pi-mcp-adapter")), false);
  assert.equal(stack.piRuntime.nativeMcp.legacyAdapterRollbackPackage, "npm:pi-mcp-adapter@2.26.0");
  assert.equal(stack.piRuntime.nativeMcp.legacyAdapterRollbackPolicy, "dormant-audit-only-not-loaded");
  assert.doesNotMatch(setup, /pi-mcp-adapter/u);
  assert.match(setup, /node scripts\/ensure-pi-cli\.mjs/u);
  assert.equal(stack.piRuntime.managedVersion, "1.0.1");
  assert.equal(compatibility.phase2Migration.nativeMcp, true);
  assert.equal(compatibility.phase2Migration.legacyAdapterLoaded, false);
});
