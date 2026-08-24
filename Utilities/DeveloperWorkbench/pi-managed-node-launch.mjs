import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  configurePiLocalRuntime,
  piLocalEnvironment,
  runPortableCommand,
} from "../../scripts/pi-worker-runtime.mjs";

const PI_PACKAGE_PATH = ["node_modules", "@earendil-works", "pi-coding-agent"];
const WORKBENCH_PROVIDER_ID = "plotpickle-workbench-local";
const WORKBENCH_SMOKE_MARKER = "PLOTPICKLE_WORKBENCH_PI_READY";
const WORKBENCH_SMOKE_TIMEOUT = 45_000;
const QUIET_RESOURCE_FLAGS = [
  "--no-extensions",
  "--no-skills",
  "--no-prompt-templates",
  "--no-themes",
  "--no-context-files",
];

function packageRootForManagedPi(pi) {
  if (!pi?.root) throw new Error("PlotPickle-managed Pi did not report its private installation root.");
  return path.join(path.resolve(pi.root), ...PI_PACKAGE_PATH);
}

export async function resolveManagedPiCliEntry(pi) {
  const packageRoot = packageRootForManagedPi(pi);
  const packageJsonPath = path.join(packageRoot, "package.json");
  const manifest = JSON.parse(await readFile(packageJsonPath, "utf8"));

  const binEntry = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.pi;
  if (!binEntry || typeof binEntry !== "string") {
    throw new Error(`PlotPickle-managed Pi package metadata does not declare the expected pi CLI entry at ${packageJsonPath}.`);
  }

  const cliEntry = path.resolve(packageRoot, binEntry);
  const relative = path.relative(packageRoot, cliEntry);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`PlotPickle-managed Pi declared an unsafe CLI entry outside its private package root: ${binEntry}`);
  }
  try {
    await access(cliEntry);
  } catch (error) {
    throw new Error(`PlotPickle-managed Pi CLI entry is missing or unreadable at ${cliEntry}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  return cliEntry;
}

function workbenchProviderSource(runtime, baseUrl) {
  const provider = {
    name: "PlotPickle Workbench Local",
    baseUrl,
    apiKey: "plotpickle-local",
    api: "openai-completions",
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      supportsUsageInStreaming: false,
    },
    models: [{
      id: runtime.model,
      name: `PlotPickle Workbench — ${runtime.model}`,
      reasoning: false,
      input: ["text"],
      contextWindow: 131072,
      maxTokens: 16384,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    }],
  };
  return [
    "export default function registerPlotPickleWorkbenchProvider(pi) {",
    `  pi.registerProvider(${JSON.stringify(WORKBENCH_PROVIDER_ID)}, ${JSON.stringify(provider, null, 2)});`,
    "}",
    "",
  ].join("\n");
}

async function configureWorkbenchProvider(runtime, purpose) {
  const configured = await configurePiLocalRuntime(runtime, { purpose });
  const extensionPath = path.join(configured.agentDir, "plotpickle-workbench-local-provider.mjs");
  await writeFile(extensionPath, workbenchProviderSource(runtime, configured.baseUrl), "utf8");
  return { ...configured, extensionPath };
}

function directPiArgs(cliEntry, extensionPath, runtime, toolArgs, prompt) {
  return [
    cliEntry,
    "-p",
    "--no-session",
    ...toolArgs,
    ...QUIET_RESOURCE_FLAGS,
    "--extension", extensionPath,
    "--provider", WORKBENCH_PROVIDER_ID,
    "--model", runtime.model,
    prompt,
  ];
}

async function verifyManagedPiInference({ cliEntry, configured, runtime, cwd }) {
  const result = await runPortableCommand(process.execPath, directPiArgs(
    cliEntry,
    configured.extensionPath,
    runtime,
    ["--no-tools"],
    `Reply with exactly ${WORKBENCH_SMOKE_MARKER}.`,
  ), {
    cwd,
    timeout: WORKBENCH_SMOKE_TIMEOUT,
    env: piLocalEnvironment(configured.agentDir),
    maxBuffer: 4 * 1024 * 1024,
  });
  if (!result.stdout.includes(WORKBENCH_SMOKE_MARKER)) {
    throw new Error(`Pi reached ${runtime.label} (${runtime.model}) but the bounded local-model handshake did not return ${WORKBENCH_SMOKE_MARKER}. Output: ${result.stdout.slice(-500) || result.stderr.slice(-500) || "<empty>"}`);
  }
}

function childFailureDetail(error) {
  const stderr = String(error?.stderr || "").trim();
  const stdout = String(error?.stdout || "").trim();
  const detail = stderr || stdout;
  return detail.length <= 8_000 ? detail : `${detail.slice(-8_000)}\n[Pi child output truncated to the final 8000 characters.]`;
}

export async function runManagedPiReadOnly({ pi, runtime, prompt, cwd, purpose = "work-item-review", timeout = 15 * 60_000 }) {
  const cliEntry = await resolveManagedPiCliEntry(pi);
  const configured = await configureWorkbenchProvider(runtime, purpose);
  await verifyManagedPiInference({ cliEntry, configured, runtime, cwd });
  const args = directPiArgs(
    cliEntry,
    configured.extensionPath,
    runtime,
    ["--tools", "read,grep,find,ls"],
    prompt,
  );

  try {
    return await runPortableCommand(process.execPath, args, {
      cwd,
      timeout,
      env: piLocalEnvironment(configured.agentDir),
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const detail = childFailureDetail(error);
    throw new Error([
      "PlotPickle-managed Pi exited before completing the Developer Workbench review.",
      detail ? `Pi detail:\n${detail}` : "Pi produced no stderr/stdout detail.",
      `Runtime: ${runtime.label} · ${runtime.model}`,
      `Direct launcher: ${process.execPath} ${cliEntry}`,
    ].join("\n"), { cause: error });
  }
}
