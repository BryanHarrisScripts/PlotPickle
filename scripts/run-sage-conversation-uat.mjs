#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  assessSageConversationAnswer,
  buildUatFinding,
  SAGE_CONVERSATION_UAT_CASES,
} from "../lib/sage-conversation-uat.mjs";
import {
  delay,
  extractPageState,
  McpClient,
  resultText,
  toolArguments,
} from "./creative-uat/mcp-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const argument = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};
const baseUrl = argument("--base-url", process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173");
const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const artifactRoot = path.resolve(argument("--artifact-root", path.join(localRoot, "PlotPickle", "uat-focused", "sage-conversation")));
const pluginRoot = path.join(repoRoot, "tools", "agent-plugins", "plotpickle-workflow-tester");

async function roomState(client) {
  const result = await client.call("browser_evaluate", {
    function: `() => ({
      url: location.href,
      texts: Array.from(document.querySelectorAll('aside[aria-label="Persistent Creative Room"] [aria-live="polite"] > div p')).map((node) => (node.textContent || '').trim()).filter(Boolean),
      alert: document.querySelector('aside[aria-label="Persistent Creative Room"] [role="alert"]')?.textContent?.trim() || '',
      hasComposer: Boolean(document.getElementById('creative-room-question')),
      sendDisabled: Boolean(document.querySelector('button[aria-label="Ask the Guide"]')?.disabled)
    })`,
  });
  return extractPageState(resultText(result));
}

async function submitQuestion(client, question) {
  const serialized = JSON.stringify(String(question));
  return client.call("browser_evaluate", {
    function: `() => {
      const question = ${serialized};
      const textarea = document.getElementById('creative-room-question');
      const button = document.querySelector('button[aria-label="Ask the Guide"]');
      if (!(textarea instanceof HTMLTextAreaElement) || !(button instanceof HTMLButtonElement)) {
        return { ok: false, reason: 'Sage composer not found' };
      }
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(textarea, question);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      button.click();
      return { ok: true };
    }`,
  });
}

async function waitForAnswer(client, previousCount, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await delay(500);
    const state = await roomState(client);
    const texts = Array.isArray(state.texts) ? state.texts : [];
    const thinking = texts.at(-1) === "Thinking about your question…";
    if (state.alert) return { state, answer: "", error: String(state.alert) };
    if (!thinking && texts.length >= previousCount + 2) return { state, answer: String(texts.at(-1) || ""), error: "" };
  }
  const state = await roomState(client);
  return { state, answer: "", error: "Timed out waiting for Sage's visible UI answer." };
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  const pluginData = path.join(artifactRoot, "agent-plugin");
  await mkdir(pluginData, { recursive: true });
  const mcpConfig = JSON.parse(await readFile(path.join(pluginRoot, "mcp.json"), "utf8"));
  const server = mcpConfig?.mcpServers?.playwright;
  if (!server || server.type !== "stdio") throw new Error("Sage UI UAT requires the local Playwright MCP runtime.");
  const expand = (value) => String(value).replaceAll("${PLUGIN_ROOT}", pluginRoot).replaceAll("${PLUGIN_DATA}", pluginData);
  const client = new McpClient(expand(server.command), (server.args || []).map(expand), {
    cwd: expand(server.cwd || pluginRoot),
    env: Object.fromEntries(Object.entries(server.env || {}).map(([key, value]) => [key, expand(value)])),
  });

  const results = [];
  const findings = [];
  let tools = [];
  try {
    await client.initialize();
    tools = await client.tools();
    const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
    for (const required of ["browser_navigate", "browser_evaluate", "browser_take_screenshot"]) {
      if (!toolMap.has(required)) throw new Error(`Playwright MCP is missing ${required}.`);
    }
    await client.call("browser_navigate", { url: new URL("/?workspace=learn", baseUrl).toString() });
    await delay(1_000);

    for (const testCase of SAGE_CONVERSATION_UAT_CASES) {
      const before = await roomState(client);
      const previousCount = Array.isArray(before.texts) ? before.texts.length : 0;
      await submitQuestion(client, testCase.question);
      const response = await waitForAnswer(client, previousCount);
      const assessment = response.error
        ? { passed: false, failures: [response.error] }
        : assessSageConversationAnswer(testCase, response.answer);
      const result = {
        id: testCase.id,
        kind: testCase.kind,
        question: testCase.question,
        answer: response.answer,
        passed: assessment.passed,
        failures: assessment.failures,
      };
      results.push(result);
      if (!result.passed) {
        for (const message of result.failures) {
          findings.push(buildUatFinding({
            message,
            area: "sage-conversation",
            evidence: { caseId: result.id, question: result.question, answer: result.answer, route: "/?workspace=learn" },
          }));
        }
      }
    }

    const screenshotArgs = toolArguments(toolMap.get("browser_take_screenshot"), {
      type: "png",
      filename: findings.length ? "sage-conversation-failure.png" : "sage-conversation-pass.png",
      fullPage: true,
    });
    await client.call("browser_take_screenshot", screenshotArgs);
  } finally {
    try {
      if (tools.some((tool) => tool.name === "browser_close")) await client.call("browser_close", {});
    } catch {}
    await client.close();
  }

  const generatedAt = new Date().toISOString();
  const report = { schemaVersion: 1, generatedAt, target: baseUrl, overall: findings.length ? "FAIL" : "PASS", results, findings };
  await writeFile(path.join(artifactRoot, "sage-conversation-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const markdown = [
    "# Sage Conversation UAT",
    "",
    `Overall: ${report.overall}`,
    `Generated: ${generatedAt}`,
    `Target: ${baseUrl}`,
    "",
    ...results.flatMap((result) => [
      `## ${result.passed ? "PASS" : "FAIL"} · ${result.id}`,
      "",
      `Writer: ${result.question}`,
      "",
      `Sage: ${result.answer || "(no answer)"}`,
      ...(result.failures.length ? ["", ...result.failures.map((failure) => `- ${failure}`)] : []),
      "",
    ]),
  ].join("\n");
  await writeFile(path.join(artifactRoot, "sage-conversation-report.md"), markdown, "utf8");
  process.stdout.write(`Sage conversation UAT ${report.overall}: ${findings.length} finding(s). Report: ${artifactRoot}\n`);
  process.exitCode = findings.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
