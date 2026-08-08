import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = resolve(repoRoot, "tools/agent-plugins/plotpickle-workflow-tester");
const pluginData = resolve(process.env.PLOTPICKLE_AGENT_PLUGIN_DATA || resolve(repoRoot, ".artifacts/agent-plugin"));
const codexHome = resolve(process.env.CODEX_HOME || resolve(repoRoot, ".artifacts/codex-home"));
const configPath = resolve(codexHome, "config.toml");

const mcp = JSON.parse(await readFile(resolve(pluginRoot, "mcp.json"), "utf8"));
const server = mcp?.mcpServers?.playwright;
if (!server || server.type !== "stdio" || typeof server.command !== "string") {
  throw new Error("PlotPickle workflow tester requires a stdio Playwright MCP server.");
}

const expand = (value) => String(value)
  .replaceAll("${PLUGIN_ROOT}", pluginRoot)
  .replaceAll("${PLUGIN_DATA}", pluginData);

const tomlString = (value) => JSON.stringify(expand(value));
const args = Array.isArray(server.args) ? server.args.map(tomlString).join(", ") : "";
const envEntries = Object.entries(server.env || {}).map(([key, value]) => `${JSON.stringify(key)} = ${tomlString(value)}`);

const lines = [
  'approval_policy = "never"',
  'sandbox_mode = "read-only"',
  '',
  '[mcp_servers.playwright]',
  `command = ${tomlString(server.command)}`,
  `args = [${args}]`,
  `cwd = ${tomlString(server.cwd || pluginRoot)}`,
];
if (envEntries.length) lines.push(`env = { ${envEntries.join(", ")} }`);
lines.push("");

await mkdir(pluginData, { recursive: true });
await mkdir(codexHome, { recursive: true });
await writeFile(configPath, lines.join("\n"), "utf8");

process.stdout.write(`${configPath}\n`);
