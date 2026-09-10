import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEVELOPER_STACK_PATH = path.join(REPO_ROOT, "config", "developer-agent-stack.json");
const PROTOCOL_VERSION = "2025-06-18";
const MAX_OUTPUT = 20_000;

const TOOLS = [
  {
    name: "plotpickle_status",
    title: "PlotPickle repository status",
    description: "Read the current PlotPickle branch, working-tree status, and Node version without changing files.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "plotpickle_hooks",
    title: "PlotPickle developer harness hooks",
    description: "Read the deterministic PlotPickle developer hook registry, lifecycle flows, repair workers, and exact-head merge policy. This tool cannot execute hooks or mutate repository state.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "plotpickle_uat_findings",
    title: "PlotPickle focused UAT findings",
    description: "Read the newest local focused-UAT evidence if it exists. Does not start UAT or change repository state.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "plotpickle_focused_uat",
    title: "Run PlotPickle focused UAT contracts",
    description: "Run the focused Startup, Settings, Foundations/LEARN, PLAN, and Wyrmwood contract suite and write normal local evidence artifacts.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "plotpickle_build",
    title: "Build PlotPickle",
    description: "Run the verified PlotPickle production build in the current repository.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "plotpickle_validate",
    title: "Validate PlotPickle change",
    description: "Run the registered focused-UAT and production-build hooks. This is the deterministic pre-PR gate for developer agents; GitHub exact-head CI remains the final merge gate.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

function clip(value) {
  const text = String(value ?? "");
  if (text.length <= MAX_OUTPUT) return text;
  return `${text.slice(0, MAX_OUTPUT)}\n...[truncated ${text.length - MAX_OUTPUT} chars]`;
}

function commandName(name) {
  if (process.platform !== "win32") return name;
  if (name === "npm") return "npm.cmd";
  return name;
}

function run(command, args, timeoutMs = 180_000) {
  return new Promise((resolve) => {
    const child = spawn(commandName(command), args, {
      cwd: REPO_ROOT,
      windowsHide: true,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ exitCode: -1, stdout: "", stderr: error.message, timedOut: false });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? -1, stdout: clip(stdout), stderr: clip(stderr), timedOut });
    });
  });
}

function toolResult(payload, isError = false) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return {
    content: [{ type: "text", text: clip(text) }],
    isError,
  };
}

async function readDeveloperStack() {
  return JSON.parse(await readFile(DEVELOPER_STACK_PATH, "utf8"));
}

function safeHarnessProjection(stack) {
  const harness = stack?.harness;
  if (!harness || !Array.isArray(harness.hooks)) throw new Error("Developer harness registry is unavailable or invalid.");
  return {
    schemaVersion: harness.schemaVersion,
    coordinator: harness.coordinator,
    policy: harness.policy,
    mode: harness.mode,
    hooks: harness.hooks.map((hook) => ({
      id: hook.id,
      responsibility: hook.responsibility,
      entrypoint: hook.entrypoint ?? null,
      kind: hook.kind,
      findingSource: Boolean(hook.findingSource),
      requiresLiveServer: Boolean(hook.requiresLiveServer),
      repairAuthority: Boolean(hook.repairAuthority),
      mergeAuthority: Boolean(hook.mergeAuthority),
    })),
    flows: {
      prePr: [...(harness.flows?.prePr || [])],
      liveUi: [...(harness.flows?.liveUi || [])],
      closedLoop: harness.flows?.closedLoop || "",
      finalGate: harness.flows?.finalGate || "",
    },
    repairWorkers: [...(stack?.repair?.selectableWorkers || [])],
    mergePolicy: stack?.mergePolicy || "",
  };
}

async function developerHooks() {
  try {
    return toolResult(safeHarnessProjection(await readDeveloperStack()));
  } catch (error) {
    return toolResult({ error: error instanceof Error ? error.message : "Developer harness registry could not be read." }, true);
  }
}

async function repositoryStatus() {
  const [status, branch, node] = await Promise.all([
    run("git", ["status", "--short", "--branch"], 15_000),
    run("git", ["rev-parse", "--abbrev-ref", "HEAD"], 15_000),
    run(process.execPath, ["--version"], 15_000),
  ]);

  const failed = [status, branch, node].some((entry) => entry.exitCode !== 0);
  return toolResult(
    {
      repoRoot: REPO_ROOT,
      branch: branch.stdout.trim(),
      status: status.stdout.trim(),
      node: node.stdout.trim(),
      ok: !failed,
    },
    failed,
  );
}

async function readUatFindings() {
  const candidates = [
    path.join(REPO_ROOT, ".artifacts", "uat-focused", "autopilot-report.md"),
    path.join(REPO_ROOT, ".artifacts", "uat-focused", "uat-findings.json"),
  ];

  if (process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, "PlotPickle", "uat-focused", "uat-findings.json"));
    candidates.push(path.join(process.env.LOCALAPPDATA, "PlotPickle", "uat-focused", "startup-agent-findings.json"));
  } else {
    candidates.push(path.join(os.homedir(), ".plotpickle", "uat-focused", "uat-findings.json"));
  }

  for (const candidate of candidates) {
    try {
      const content = await readFile(candidate, "utf8");
      return toolResult({ path: candidate, content: clip(content) });
    } catch (error) {
      if (error?.code !== "ENOENT") return toolResult({ path: candidate, error: error.message }, true);
    }
  }

  return toolResult({ found: false, searched: candidates });
}

async function focusedUat() {
  const result = await run(process.execPath, [
    "scripts/run-uat-autopilot.mjs",
    "--contracts-only",
    "--artifact-root",
    ".artifacts/uat-focused",
  ], 300_000);
  return toolResult({ hook: "focused-uat", command: "focused-uat", ...result }, result.exitCode !== 0);
}

async function productionBuild() {
  const result = await run("npm", ["run", "build"], 600_000);
  return toolResult({ hook: "build", command: "build", ...result }, result.exitCode !== 0);
}

async function validate() {
  const hooksRun = ["focused-uat"];
  const uat = await run(process.execPath, [
    "scripts/run-uat-autopilot.mjs",
    "--contracts-only",
    "--artifact-root",
    ".artifacts/uat-focused",
  ], 300_000);
  if (uat.exitCode !== 0) return toolResult({ stage: "focused-uat", hooksRun, ...uat }, true);

  hooksRun.push("build");
  const build = await run("npm", ["run", "build"], 600_000);
  return toolResult({
    stage: build.exitCode === 0 ? "complete" : "build",
    hooksRun,
    nextGate: build.exitCode === 0 ? "github-ci" : null,
    focusedUat: uat,
    build,
  }, build.exitCode !== 0);
}

async function callTool(name) {
  switch (name) {
    case "plotpickle_status":
      return repositoryStatus();
    case "plotpickle_hooks":
      return developerHooks();
    case "plotpickle_uat_findings":
      return readUatFindings();
    case "plotpickle_focused_uat":
      return focusedUat();
    case "plotpickle_build":
      return productionBuild();
    case "plotpickle_validate":
      return validate();
    default:
      return null;
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function protocolError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(message) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") return;
  if (!("id" in message)) return;

  if (message.method === "initialize") {
    const requested = message.params?.protocolVersion;
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: typeof requested === "string" ? requested : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "plotpickle-dev", title: "PlotPickle Developer Tools", version: "1.0.0" },
        instructions: "Use AGENTS.md as the development contract. plotpickle_hooks is the read-only registry for the deterministic PlotPickle Harness; Pi/Cline remain bounded workers and GitHub exact-head CI remains the merge gate.",
      },
    });
    return;
  }

  if (message.method === "ping") {
    send({ jsonrpc: "2.0", id: message.id, result: {} });
    return;
  }

  if (message.method === "tools/list") {
    send({ jsonrpc: "2.0", id: message.id, result: { tools: TOOLS } });
    return;
  }

  if (message.method === "tools/call") {
    const name = message.params?.name;
    if (typeof name !== "string") {
      protocolError(message.id, -32602, "tools/call requires a tool name");
      return;
    }
    const result = await callTool(name);
    if (!result) {
      protocolError(message.id, -32602, `Unknown tool: ${name}`);
      return;
    }
    send({ jsonrpc: "2.0", id: message.id, result });
    return;
  }

  protocolError(message.id, -32601, `Method not found: ${message.method}`);
}

async function selfTest() {
  const status = await run("git", ["rev-parse", "--is-inside-work-tree"], 15_000);
  if (status.exitCode !== 0 || status.stdout.trim() !== "true") {
    console.error("PlotPickle MCP self-test FAIL: repository root is not available.");
    process.exitCode = 1;
    return;
  }

  let stack;
  let harness;
  try {
    stack = await readDeveloperStack();
    harness = safeHarnessProjection(stack);
  } catch (error) {
    console.error(`PlotPickle MCP self-test FAIL: ${error instanceof Error ? error.message : "developer harness registry is invalid."}`);
    process.exitCode = 1;
    return;
  }

  const hookIds = new Set(harness.hooks.map((hook) => hook.id));
  const onlyGithubMerges = harness.hooks.filter((hook) => hook.mergeAuthority).map((hook) => hook.id);
  if (
    TOOLS.length < 6
    || !TOOLS.some((tool) => tool.name === "plotpickle_hooks")
    || !TOOLS.some((tool) => tool.name === "plotpickle_validate")
    || !["focused-uat", "webmcp-ui", "closed-loop-uat", "ben-code-quality", "build", "semantic-repair", "github-ci"].every((id) => hookIds.has(id))
    || harness.flows.finalGate !== "github-ci"
    || stack.mergePolicy !== "green-exact-head-only"
    || JSON.stringify(onlyGithubMerges) !== JSON.stringify(["github-ci"])
  ) {
    console.error("PlotPickle MCP self-test FAIL: tool or harness registry is incomplete.");
    process.exitCode = 1;
    return;
  }
  console.log("PlotPickle MCP self-test PASS");
}

if (process.argv.includes("--self-test")) {
  await selfTest();
} else {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        void handle(message).catch((error) => {
          if ("id" in message) protocolError(message.id, -32603, error.message || "Internal error");
        });
      } catch (error) {
        process.stderr.write(`plotpickle-dev MCP parse error: ${error.message}\n`);
      }
    }
  });
}
