import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadPlotPickleNativeMcpRegistration(cwd = process.cwd()) {
  const sharedPath = path.resolve(cwd, ".mcp.json");
  const policyPath = path.resolve(cwd, "config", "pi-tool-exposure-policy.json");
  const [shared, policy] = await Promise.all([
    readFile(sharedPath, "utf8").then(JSON.parse),
    readFile(policyPath, "utf8").then(JSON.parse),
  ]);
  const serverName = policy.server;
  const canonical = shared?.mcpServers?.[serverName];
  if (!canonical) throw new Error(`Canonical MCP server ${serverName} is missing from .mcp.json.`);
  if (policy.canonicalConfig !== ".mcp.json") throw new Error("Pi MCP policy must point at the canonical shared .mcp.json.");
  return {
    name: serverName,
    config: {
      ...canonical,
      exposure: policy.serverExposure,
      toolExposure: policy.toolExposure,
      description: policy.description,
    },
  };
}

export default async function plotpickleNativeMcp(pi) {
  const registration = await loadPlotPickleNativeMcpRegistration();
  pi.registerMcpServer(registration.name, registration.config);
}
