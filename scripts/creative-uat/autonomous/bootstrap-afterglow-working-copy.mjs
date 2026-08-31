#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { extractPageState, extractRef, McpClient, resultText, toolArguments } from "../mcp-runtime.mjs";
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
const artifactRoot = path.resolve(optionValues.get("--artifact-root") || path.join(localRoot, "PlotPickle", "uat-autonomous-story-reference"));
const pluginRoot = path.join(repoRoot, "tools", "agent-plugins", "plotpickle-workflow-tester");
const persistentBrowserProfile = path.join(artifactRoot, "browser-profile");
const jsonPath = path.join(artifactRoot, "afterglow-working-copy-bootstrap.json");
const afterglowTitle = "Afterglow: Reflections of Sentience";

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
  if (!server || server.type !== "stdio") throw new Error("Afterglow bootstrap requires the local Playwright MCP runtime.");
  const expand = (value) => String(value).replaceAll("${PLUGIN_ROOT}", pluginRoot).replaceAll("${PLUGIN_DATA}", pluginData);
  const client = new McpClient(expand(server.command), persistentMcpArgs((server.args || []).map(expand)), {
    cwd: expand(server.cwd || pluginRoot),
    env: Object.fromEntries(Object.entries(server.env || {}).map(([key, value]) => [key, expand(value)])),
  });
  await client.initialize();
  const tools = await client.tools();
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  for (const required of ["browser_navigate", "browser_snapshot", "browser_evaluate", "browser_click"]) {
    if (!toolMap.has(required)) throw new Error(`Playwright MCP is missing ${required}.`);
  }
  return { client, tools, toolMap };
}

async function closeBrowserSession(session) {
  try {
    if (session?.tools?.some((tool) => tool.name === "browser_close")) await session.client.call("browser_close", {});
  } finally {
    await session?.client?.close();
  }
}

async function inspectActiveAfterglow(session) {
  const raw = resultText(await session.client.call("browser_evaluate", {
    function: `() => {
      const cards = [...document.querySelectorAll('[data-library-story-id]')];
      const active = cards.find((card) => {
        const text = (card.textContent || '').replace(/\\s+/g, ' ').trim();
        return text.includes(${JSON.stringify(afterglowTitle)}) && text.includes('Active story');
      });
      return active ? {
        active: true,
        projectId: active.getAttribute('data-library-story-id') || '',
        title: active.querySelector('h3')?.textContent?.trim() || '',
      } : { active: false, projectId: '', title: '' };
    }`,
  }));
  return extractPageState(raw);
}

async function openLibrary(session) {
  await session.client.call("browser_navigate", { url: new URL("/library", baseUrl).toString() });
  await waitForRenderedArea(session.client, {
    id: "library-afterglow-bootstrap",
    route: "/library",
    requiredTerms: ["Library", "Featured Examples", "Afterglow"],
    minimumTextLength: 500,
  });
}

async function bootstrap(session) {
  await openLibrary(session);
  let active = await inspectActiveAfterglow(session);
  if (active.active && active.projectId) return { action: "reused-existing-working-copy", ...active };

  const launchRaw = resultText(await session.client.call("browser_evaluate", {
    function: `() => {
      const card = document.querySelector('[data-library-catalog-id="afterglow-v9"]');
      const button = card ? [...card.querySelectorAll('button')].find((item) => (item.textContent || '').trim() === 'Load & Explore') : null;
      if (!card || !button) return { clicked: false };
      button.click();
      return { clicked: true };
    }`,
  }));
  if (extractPageState(launchRaw).clicked !== true) throw new Error("Afterglow Library card could not be opened through its Load & Explore action.");

  const snapshot = resultText(await session.client.call("browser_snapshot", {}));
  const confirmRef = extractRef(snapshot, "Save & Switch", ["button"]);
  if (!confirmRef) throw new Error("Afterglow Library confirmation did not expose Save & Switch.");
  await session.client.call("browser_click", toolArguments(session.toolMap.get("browser_click"), {
    ref: confirmRef,
    element: "Save & Switch",
  }));

  await openLibrary(session);
  active = await inspectActiveAfterglow(session);
  if (!active.active || !active.projectId) throw new Error("Afterglow working copy was not active after the normal Library Save & Switch flow.");
  return { action: "created-working-copy-through-library", ...active };
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  const session = await startBrowserSession();
  let result;
  try {
    result = await bootstrap(session);
  } finally {
    await closeBrowserSession(session);
  }
  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceCatalogId: "afterglow-v9",
    sourceKind: "example",
    sourceImmutable: true,
    workingCopyCreatedThrough: "Library Load & Explore -> Save & Switch",
    ...result,
  };
  await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  process.stdout.write(`Afterglow working copy ready through Library: ${evidence.projectId}\n`);
}

main().catch(async (error) => {
  await mkdir(artifactRoot, { recursive: true });
  const message = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(jsonPath, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), error: message }, null, 2)}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
});
