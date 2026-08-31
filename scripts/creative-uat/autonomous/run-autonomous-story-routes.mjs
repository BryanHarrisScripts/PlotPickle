#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  captureAutonomousRouteOperationProbe,
  evaluateAutonomousRouteOperation,
} from "../../../lib/verification/autonomous-route-operations.mjs";
import {
  assessAutonomousRoute,
  autonomousContractTestsFromRegistry,
  autonomousStoryRoutes,
  materializeAutonomousRoute,
  skippedAutonomousRoute,
  summarizeAutonomousRouteResults,
  validateAutonomousStoryRoutes,
} from "../../../lib/verification/autonomous-story-routes.mjs";
import { consoleHasErrors, extractPageState, McpClient, resultText, toolArguments } from "../mcp-runtime.mjs";
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
const explicitProjectId = optionValues.get("--project-id") || process.env.PLOTPICKLE_AUTONOMOUS_PROJECT_ID || "";
const contractsOnly = argv.includes("--contracts-only");
const registryPath = path.join(repoRoot, "config", "uat-autopilot-registry.json");
const pluginRoot = path.join(repoRoot, "tools", "agent-plugins", "plotpickle-workflow-tester");
const reportPath = path.join(artifactRoot, "autonomous-story-routes.md");
const jsonPath = path.join(artifactRoot, "autonomous-story-routes.json");
const bootstrapReportPath = path.join(artifactRoot, "afterglow-working-copy-bootstrap.json");
const persistentBrowserProfile = path.join(artifactRoot, "browser-profile");
const restartSurfaceIds = Object.freeze(["visual-readiness", "storyboard", "previs-animatic"]);
const autonomousRunContracts = Object.freeze(["tests/issue-1553-autonomous-convergence-restart.test.mjs"]);

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

async function loadExpectedProjectId() {
  if (explicitProjectId.trim()) return explicitProjectId.trim();
  try {
    const bootstrap = JSON.parse(await readFile(bootstrapReportPath, "utf8"));
    return String(bootstrap?.projectId || "").trim();
  } catch {
    return "";
  }
}

function persistentMcpArgs(args) {
  const next = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--isolated") continue;
    if (args[index] === "--user-data-dir") { index += 1; continue; }
    next.push(args[index]);
  }
  next.push("--user-data-dir", persistentBrowserProfile);
  return next;
}

async function startBrowserSession() {
  const pluginData = path.join(artifactRoot, "agent-plugin");
  await mkdir(pluginData, { recursive: true });
  await mkdir(persistentBrowserProfile, { recursive: true });
  const mcpConfig = JSON.parse(await readFile(path.join(pluginRoot, "mcp.json"), "utf8"));
  const server = mcpConfig?.mcpServers?.playwright;
  if (!server || server.type !== "stdio") throw new Error("Autonomous story routing requires the local Playwright MCP runtime.");
  const expand = (value) => String(value).replaceAll("${PLUGIN_ROOT}", pluginRoot).replaceAll("${PLUGIN_DATA}", pluginData);
  const args = persistentMcpArgs((server.args || []).map(expand));
  const client = new McpClient(expand(server.command), args, {
    cwd: expand(server.cwd || pluginRoot),
    env: Object.fromEntries(Object.entries(server.env || {}).map(([key, value]) => [key, expand(value)])),
  });
  await client.initialize();
  const tools = await client.tools();
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  for (const required of ["browser_navigate", "browser_snapshot", "browser_evaluate"]) {
    if (!toolMap.has(required)) throw new Error(`Playwright MCP is missing ${required}.`);
  }
  return { client, tools, toolMap };
}

async function closeBrowserSession(session, label) {
  try {
    if (session?.tools?.some((tool) => tool.name === "browser_close")) await session.client.call("browser_close", {});
  } catch (error) {
    process.stderr.write(`${label} browser cleanup warning: ${error instanceof Error ? error.message : String(error)}\n`);
  }
  await session?.client?.close();
}

async function inspectRoutesWithSession(session, registry, routeInputs, operationContext) {
  const results = [];
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
    let action = {};
    try {
      await session.client.call("browser_navigate", { url: new URL(materialized.route, baseUrl).toString() });
      const state = await waitForRenderedArea(session.client, { ...route, route: materialized.route });
      const snapshotText = resultText(await session.client.call("browser_snapshot", {}));
      evidence.reached = true;
      evidence.url = String(state.url || "");
      evidence.bodyText = String(state.bodyText || snapshotText || "");
      evidence.bodyLength = Number(state.bodyLength || evidence.bodyText.length);
      if (session.toolMap.has("browser_console_messages")) {
        const consoleText = resultText(await session.client.call("browser_console_messages", toolArguments(session.toolMap.get("browser_console_messages"), { level: "error", all: false })));
        evidence.consoleErrors = consoleHasErrors(consoleText);
      }
      if (route.operation === "operate") {
        const probe = await captureAutonomousRouteOperationProbe(session, route);
        action = evaluateAutonomousRouteOperation(route, evidence, probe, operationContext);
      }
    } catch (error) {
      evidence.error = error instanceof Error ? error.message : String(error);
    }
    evidence.timingMs = Date.now() - startedAt;
    results.push(assessAutonomousRoute(route, evidence, action));
  }
  return results;
}

function safeSignature(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function captureResumeSurfaces(session, registry, routeInputs) {
  const surfaces = [];
  for (const id of restartSurfaceIds) {
    const route = autonomousStoryRoutes(registry).find((candidate) => candidate.id === id);
    if (!route) continue;
    const materialized = materializeAutonomousRoute(route, routeInputs);
    if (!materialized.route) continue;
    try {
      await session.client.call("browser_navigate", { url: new URL(materialized.route, baseUrl).toString() });
      await waitForRenderedArea(session.client, { ...route, route: materialized.route });
      const raw = resultText(await session.client.call("browser_evaluate", {
        function: `() => {
          const body = (document.body.innerText || '').replace(/\\s+/g, ' ').trim();
          const revisionMatch = body.match(/(?:PPF|Current) revision\\s+([0-9]+)/i);
          const root = document.querySelector('[data-canonical-project-id]');
          const states = {};
          for (const state of ['defined', 'observed', 'emerging', 'missing', 'locked', 'current', 'stale']) {
            states[state] = document.querySelectorAll('[data-state="' + state + '"], [data-readiness-state="' + state + '"]').length;
          }
          return {
            url: location.href,
            projectId: root ? (root.getAttribute('data-canonical-project-id') || '') : '',
            revision: revisionMatch ? revisionMatch[1] : '',
            stateCounts: states,
            storyDecisionTargets: document.querySelectorAll('[data-story-decision-target]').length,
            readinessItems: document.querySelectorAll('[data-canonical-readiness-item]').length,
            staleProductionTargets: document.querySelectorAll('[data-stale="true"]').length
          };
        }`,
      }));
      const state = extractPageState(raw);
      const actual = new URL(String(state.url || baseUrl), baseUrl);
      const safe = {
        id,
        actualRoute: `${actual.pathname}${actual.search}`,
        projectId: String(state.projectId || ""),
        revision: String(state.revision || ""),
        stateCounts: state.stateCounts && typeof state.stateCounts === "object" ? state.stateCounts : {},
        storyDecisionTargets: Math.max(0, Number(state.storyDecisionTargets || 0)),
        readinessItems: Math.max(0, Number(state.readinessItems || 0)),
        staleProductionTargets: Math.max(0, Number(state.staleProductionTargets || 0)),
      };
      surfaces.push({ ...safe, signature: safeSignature(safe), error: "" });
    } catch (error) {
      surfaces.push({ id, signature: "", error: error instanceof Error ? error.message : String(error) });
    }
  }
  return surfaces;
}

function compareRestartSurfaces(before, after) {
  const afterById = new Map(after.map((surface) => [surface.id, surface]));
  const usable = before.filter((surface) => surface.signature && !surface.error);
  const mismatches = [];
  if (usable.length < 2) mismatches.push("Fewer than two canonical visual surfaces were available for restart comparison.");
  if (!usable.some((surface) => surface.projectId && surface.revision)) {
    mismatches.push("No restart surface exposed both canonical project identity and PPF revision.");
  }
  for (const surface of usable) {
    const reopened = afterById.get(surface.id);
    if (!reopened?.signature) mismatches.push(`${surface.id} could not be re-opened after the fresh browser session.`);
    else if (surface.signature !== reopened.signature) mismatches.push(`${surface.id} changed across the fresh browser session.`);
  }
  return {
    attempted: true,
    verified: mismatches.length === 0,
    boundary: "fresh-playwright-mcp-process-shared-browser-profile",
    applicationProcessRestarted: false,
    requiresApplicationLifecycleProof: true,
    surfaces: usable.map((surface) => ({
      id: surface.id,
      actualRoute: surface.actualRoute,
      projectId: surface.projectId,
      revision: surface.revision,
      signature: surface.signature,
      matchedAfterRestart: surface.signature === afterById.get(surface.id)?.signature,
    })),
    mismatches,
  };
}

async function inspectRoutes(registry, routeInputs, operationContext) {
  const first = await startBrowserSession();
  let results = [];
  let before = [];
  try {
    results = await inspectRoutesWithSession(first, registry, routeInputs, operationContext);
    before = await captureResumeSurfaces(first, registry, routeInputs);
  } finally {
    await closeBrowserSession(first, "Autonomous route first-session");
  }

  const second = await startBrowserSession();
  let after = [];
  try {
    after = await captureResumeSurfaces(second, registry, routeInputs);
  } finally {
    await closeBrowserSession(second, "Autonomous route restart-session");
  }
  return { results, restartProof: compareRestartSurfaces(before, after) };
}

function markdownReport({ generatedAt, mode, routes, results, summary, contracts, restartProof }) {
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
  for (const [disposition, total] of Object.entries(summary.counts)) lines.push(`- ${disposition}: ${total}`);
  if (restartProof?.attempted) {
    lines.push("", "## Fresh-session restart proof", "", `Verified: ${restartProof.verified ? "yes" : "no"}`, `Boundary: ${restartProof.boundary}`, "Application process restart remains a separate lifecycle proof required by the Slice E controller.");
    for (const message of restartProof.mismatches || []) lines.push(`- ${message}`);
  }
  lines.push("", "The machine report stores readiness terms, bounded canonical identifiers/counts/revisions and operation receipts, not page text, hidden reasoning, credentials or story content.", "");
  return lines.join("\n");
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  const errors = validateAutonomousStoryRoutes(registry);
  if (errors.length) throw new Error(errors.join("\n"));
  const routes = autonomousStoryRoutes(registry);
  const contracts = await runContracts([...new Set([...autonomousContractTestsFromRegistry(registry), ...autonomousRunContracts])]);
  const routeInputs = await loadRouteInputs();
  const expectedProjectId = await loadExpectedProjectId();
  if (!contractsOnly && !expectedProjectId) throw new Error("Live autonomous route operation requires the Afterglow working-copy project id from bootstrap or --project-id.");
  const operationContext = { expectedProjectId };
  const live = contractsOnly ? { results: [], restartProof: { attempted: false, verified: false } } : await inspectRoutes(registry, routeInputs, operationContext);
  const routeSummary = summarizeAutonomousRouteResults(live.results);
  const restartBlockers = !contractsOnly && live.restartProof?.verified !== true
    ? (live.restartProof?.mismatches?.length ? live.restartProof.mismatches : ["Fresh-session restart proof did not verify."])
    : [];
  const summary = contracts.code !== 0 || restartBlockers.length
    ? { ...routeSummary, overall: "FAIL", blockers: [...routeSummary.blockers, ...(contracts.code ? [`Contract tests exited with code ${contracts.code}.`] : []), ...restartBlockers] }
    : routeSummary;
  const generatedAt = new Date().toISOString();
  const mode = contractsOnly ? "contracts-only" : "autonomous-route-live";
  const machine = {
    schemaVersion: 3,
    generatedAt,
    target: baseUrl,
    mode,
    overall: summary.overall,
    summary,
    contracts,
    operationContext: { expectedProjectId },
    restartProof: live.restartProof,
    routePlan: routes.map(({ id, label, order, route, routeTemplate, operation, prerequisites }) => ({ id, label, order, canonicalRoute: route || routeTemplate, operation, prerequisites })),
    results: live.results,
    evidencePolicy: "No page text, hidden reasoning, credentials or private story content is persisted; operation evidence is bounded to route ids, project/revision identifiers, counts and outcomes.",
  };
  await writeFile(jsonPath, `${JSON.stringify(machine, null, 2)}\n`, "utf8");
  await writeFile(reportPath, markdownReport({ generatedAt, mode, routes, results: live.results, summary, contracts, restartProof: live.restartProof }), "utf8");
  process.stdout.write(`Autonomous story routes ${summary.overall}: ${live.results.length} result(s). Report: ${reportPath}\n`);
  process.exitCode = summary.overall === "FAIL" ? 1 : 0;
}

main().catch(async (error) => {
  await mkdir(artifactRoot, { recursive: true });
  const message = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(reportPath, `# PlotPickle Autonomous Story Route Report\n\nOverall: FAIL\n\n${message}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
});