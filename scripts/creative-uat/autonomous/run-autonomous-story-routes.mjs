#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  assessAutonomousRoute,
  autonomousContractTestsFromRegistry,
  autonomousStoryRoutes,
  materializeAutonomousRoute,
  skippedAutonomousRoute,
  summarizeAutonomousRouteResults,
  validateAutonomousStoryRoutes,
} from "../../../lib/verification/autonomous-story-routes.mjs";
import { consoleHasErrors, McpClient, resultText, toolArguments } from "../mcp-runtime.mjs";
import { waitForRenderedArea } from "../render-readiness.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const argv = process.argv.slice(2);
const optionValues = new Map();
for (let index = 0; index < argv.length - 1; index += 1) {
  const name = argv[index];
  const value = argv[index + 1];
  if (name.startsWith("--") && value && !value.startsWith("--")) optionValues.set(name, value);
}
const baseUrl = optionValues.get("--base-url") || process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173";
const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const artifactRoot = path.resolve(optionValues.get("--artifact-root") || path.join(localRoot, "PlotPickle", "uat-autonomous-story"));
const routeInputsPath = optionValues.get("--route-inputs") || "";
const contractsOnly = argv.includes("--contracts-only");
const registryPath = path.join(repoRoot, "config", "uat-autopilot-registry.json");
const pluginRoot = path.join(repoRoot, "tools", "agent-plugins", "plotpickle-workflow-tester");
const reportPath = path.join(artifactRoot, "autonomous-story-routes.md");
const jsonPath = path.join(artifactRoot, "autonomous-story-routes.json");

function runContracts(files) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--test", ...files], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", (error) => resolve({ code: 1, error: error.message }));
    child.once("exit", (code) => resolve({ code: Number(code ?? 1), error: "" }));
  });
}

async function loadRouteInputs() {
  if (!routeInputsPath) return {};
  const parsed = JSON.parse(await readFile(path.resolve(routeInputsPath), "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("--route-inputs must name a JSON object.");
  return parsed;
}

async function inspectRoutes(registry, routeInputs) {
  const pluginData = path.join(artifactRoot, "agent-plugin");
  await mkdir(pluginData, { recursive: true });
  const mcpConfig = JSON.parse(await readFile(path.join(pluginRoot, "mcp.json"), "utf8"));
  const server = mcpConfig?.mcpServers?.playwright;
  if (!server || server.type !== "stdio") throw new Error("Autonomous story routing requires the local Playwright MCP runtime.");
  const expand = (value) => String(value).replaceAll("${PLUGIN_ROOT}", pluginRoot).replaceAll("${PLUGIN_DATA}", pluginData);
  const client = new McpClient(expand(server.command), (server.args || []).map(expand), {
    cwd: expand(server.cwd || pluginRoot),
    env: Object.fromEntries(Object.entries(server.env || {}).map(([key, value]) => [key, expand(value)])),
  });
  const results = [];
  let tools = [];
  try {
    await client.initialize();
    tools = await client.tools();
    const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
    for (const required of ["browser_navigate", "browser_snapshot", "browser_evaluate"]) {
      if (!toolMap.has(required)) throw new Error(`Playwright MCP is missing ${required}.`);
    }

    for (const route of autonomousStoryRoutes(registry)) {
      const materialized = materializeAutonomousRoute(route, routeInputs);
      if (!materialized.route) {
        results.push(skippedAutonomousRoute(route, materialized.missingInputs));
        continue;
      }

      const startedAt = Date.now();
      const evidence = {
        reached: false,
        resolvedRoute: materialized.route,
        url: "",
        bodyText: "",
        bodyLength: 0,
        consoleErrors: false,
        error: "",
        timingMs: 0,
      };
      try {
        await client.call("browser_navigate", { url: new URL(materialized.route, baseUrl).toString() });
        const state = await waitForRenderedArea(client, { ...route, route: materialized.route });
        const snapshotText = resultText(await client.call("browser_snapshot", {}));
        evidence.reached = true;
        evidence.url = String(state.url || "");
        evidence.bodyText = String(state.bodyText || snapshotText || "");
        evidence.bodyLength = Number(state.bodyLength || evidence.bodyText.length);
        if (toolMap.has("browser_console_messages")) {
          const consoleText = resultText(await client.call("browser_console_messages", toolArguments(toolMap.get("browser_console_messages"), { level: "error", all: false })));
          evidence.consoleErrors = consoleHasErrors(consoleText);
        }
      } catch (error) {
        evidence.error = error instanceof Error ? error.message : String(error);
      }
      evidence.timingMs = Date.now() - startedAt;
      results.push(assessAutonomousRoute(route, evidence));
    }
  } finally {
    try {
      if (tools.some((tool) => tool.name === "browser_close")) await client.call("browser_close", {});
    } catch (error) {
      process.stderr.write(`Autonomous route browser cleanup warning: ${error instanceof Error ? error.message : String(error)}\n`);
    }
    await client.close();
  }
  return results;
}

function markdownReport({ generatedAt, mode, routes, results, summary, contracts }) {
  const lines = [
    "# PlotPickle Autonomous Story Route Report",
    "",
    `Overall: ${summary.overall}`,
    `Mode: ${mode}`,
    `Generated: ${generatedAt}`,
    `Target: ${baseUrl}`,
    `Contract test exit: ${contracts.code}`,
    "",
    "## Route coverage",
    "",
    "| Order | Surface | Canonical route | Intended operation | Result | Reason |",
    "| ---: | --- | --- | --- | --- | --- |",
  ];
  const byId = new Map(results.map((result) => [result.id, result]));
  for (const route of routes) {
    const result = byId.get(route.id);
    lines.push(`| ${route.order} | ${route.label} | \`${route.route || route.routeTemplate}\` | ${route.operation} | ${result?.disposition || "not-run"} | ${(result?.reason || "").replaceAll("|", "\\|")} |`);
  }
  lines.push("", "## Totals", "");
  for (const [disposition, count] of Object.entries(summary.counts)) lines.push(`- ${disposition}: ${count}`);
  lines.push("", "The machine report stores readiness term matches and lengths, not page text, hidden reasoning, credentials or story content.", "");
  return lines.join("\n");
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  const errors = validateAutonomousStoryRoutes(registry);
  if (errors.length) throw new Error(errors.join("\n"));
  const routes = autonomousStoryRoutes(registry);
  const contracts = await runContracts(autonomousContractTestsFromRegistry(registry));
  const routeInputs = await loadRouteInputs();
  const results = contractsOnly ? [] : await inspectRoutes(registry, routeInputs);
  const routeSummary = summarizeAutonomousRouteResults(results);
  const summary = contracts.code === 0
    ? routeSummary
    : { ...routeSummary, overall: "FAIL", blockers: [...routeSummary.blockers, `Contract tests exited with code ${contracts.code}.`] };
  const generatedAt = new Date().toISOString();
  const mode = contractsOnly ? "contracts-only" : "autonomous-route-live";
  const machine = {
    schemaVersion: 1,
    generatedAt,
    target: baseUrl,
    mode,
    overall: summary.overall,
    summary,
    contracts,
    routePlan: routes.map(({ id, label, order, route, routeTemplate, operation, prerequisites }) => ({ id, label, order, canonicalRoute: route || routeTemplate, operation, prerequisites })),
    results,
    evidencePolicy: "No page text, hidden reasoning, credentials or private story content is persisted.",
  };
  await writeFile(jsonPath, `${JSON.stringify(machine, null, 2)}\n`, "utf8");
  await writeFile(reportPath, markdownReport({ generatedAt, mode, routes, results, summary, contracts }), "utf8");
  process.stdout.write(`Autonomous story routes ${summary.overall}: ${results.length} result(s). Report: ${reportPath}\n`);
  process.exitCode = summary.overall === "FAIL" ? 1 : 0;
}

main().catch(async (error) => {
  await mkdir(artifactRoot, { recursive: true });
  const message = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(reportPath, `# PlotPickle Autonomous Story Route Report\n\nOverall: FAIL\n\n${message}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
});
