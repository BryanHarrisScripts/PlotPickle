import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  configurePiLocalRuntime,
  piLocalEnvironment,
} from "../../scripts/pi-worker-runtime.mjs";

const PI_PACKAGE_PATH = ["node_modules", "@earendil-works", "pi-coding-agent"];
export const WORKBENCH_CANONICAL_PROVIDER_ID = "plotpickle-local";
export const WORKBENCH_CANONICAL_SMOKE_MARKER = "PLOTPICKLE_PI_READY";
export const WORKBENCH_CANONICAL_SMOKE_TIMEOUT_MS = 4 * 60_000;
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

function directPiArgs(cliEntry, runtime, toolArgs, prompt) {
  return [
    cliEntry,
    "-p",
    "--no-session",
    ...toolArgs,
    ...QUIET_RESOURCE_FLAGS,
    "--provider", WORKBENCH_CANONICAL_PROVIDER_ID,
    "--model", runtime.model,
    prompt,
  ];
}

function trimChildOutput(value, maxLength) {
  const text = String(value || "").trim();
  return text.length <= maxLength ? text : `${text.slice(-maxLength)}\n[Pi child output truncated to the final ${maxLength} characters.]`;
}

export function runManagedPiProcess(args, options = {}) {
  return new Promise((resolve, reject) => {
    const maxBuffer = options.maxBuffer || 32 * 1024 * 1024;
    const child = spawn(process.execPath, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...(options.env || {}) },
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let timedOut = false;
    let settled = false;

    const append = (stream, chunk) => {
      const text = String(chunk || "");
      outputBytes += Buffer.byteLength(text, "utf8");
      if (outputBytes > maxBuffer) {
        const error = new Error(`PlotPickle-managed Pi exceeded the ${maxBuffer}-byte output limit.`);
        error.stdout = stdout;
        error.stderr = stderr;
        child.kill();
        if (!settled) {
          settled = true;
          reject(error);
        }
        return;
      }
      if (stream === "stdout") stdout += text;
      else stderr += text;
    };

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => append("stdout", chunk));
    child.stderr?.on("data", (chunk) => append("stderr", chunk));

    const timeout = Number(options.timeout || 0);
    const timer = timeout > 0 ? setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeout) : null;

    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      if (settled) return;
      error.stdout = stdout;
      error.stderr = stderr;
      settled = true;
      reject(error);
    });

    child.on("close", (code, signal) => {
      if (timer) clearTimeout(timer);
      if (settled) return;
      if (timedOut) {
        const error = new Error(`PlotPickle-managed Pi timed out after ${Math.max(1, Math.round(timeout / 1000))} seconds.`);
        error.code = "ETIMEDOUT";
        error.stdout = stdout;
        error.stderr = stderr;
        settled = true;
        reject(error);
        return;
      }
      if (code !== 0) {
        const error = new Error(`PlotPickle-managed Pi exited with code ${code}${signal ? ` (${signal})` : ""}.`);
        error.code = code;
        error.signal = signal;
        error.stdout = stdout;
        error.stderr = stderr;
        settled = true;
        reject(error);
        return;
      }
      settled = true;
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

function childFailureDetail(error) {
  const stderr = trimChildOutput(error?.stderr, 8_000);
  const stdout = trimChildOutput(error?.stdout, 8_000);
  return stderr || stdout;
}

async function verifyManagedPiInference({ cliEntry, configured, runtime, cwd, timeout }) {
  let result;
  try {
    result = await runManagedPiProcess(directPiArgs(
      cliEntry,
      runtime,
      ["--no-tools"],
      `Reply with exactly ${WORKBENCH_CANONICAL_SMOKE_MARKER}.`,
    ), {
      cwd,
      timeout,
      env: piLocalEnvironment(configured.agentDir),
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (error) {
    const detail = childFailureDetail(error);
    throw new Error([
      `Pi inference handshake failed for ${runtime.label} · ${runtime.model}.`,
      `Timeout budget: ${Math.max(1, Math.round(timeout / 1000))} seconds.`,
      detail ? `Pi detail:\n${detail}` : "Pi produced no stderr/stdout detail after stdin was closed.",
    ].join("\n"), { cause: error });
  }
  if (!result.stdout.includes(WORKBENCH_CANONICAL_SMOKE_MARKER)) {
    throw new Error(`Pi reached ${runtime.label} (${runtime.model}) but the canonical local-model handshake did not return ${WORKBENCH_CANONICAL_SMOKE_MARKER}. Output: ${result.stdout.slice(-500) || result.stderr.slice(-500) || "<empty>"}`);
  }
}

export async function probeManagedPiReadiness({
  pi,
  runtime,
  cwd,
  purpose = "work-item-readiness",
  smokeTimeout = WORKBENCH_CANONICAL_SMOKE_TIMEOUT_MS,
}) {
  const cliEntry = await resolveManagedPiCliEntry(pi);
  const configured = await configurePiLocalRuntime(runtime, { purpose });
  const startedAt = Date.now();
  await verifyManagedPiInference({ cliEntry, configured, runtime, cwd, timeout: smokeTimeout });
  return Object.freeze({
    cliEntry,
    configured,
    providerId: WORKBENCH_CANONICAL_PROVIDER_ID,
    latencyMs: Date.now() - startedAt,
  });
}

export async function runManagedPiReadOnly({ pi, runtime, prompt, cwd, purpose = "work-item-review", timeout = 15 * 60_000 }) {
  const readiness = await probeManagedPiReadiness({
    pi,
    runtime,
    cwd,
    purpose,
    smokeTimeout: WORKBENCH_CANONICAL_SMOKE_TIMEOUT_MS,
  });
  const { cliEntry, configured } = readiness;
  const args = directPiArgs(
    cliEntry,
    runtime,
    ["--tools", "read,grep,find,ls"],
    prompt,
  );

  try {
    return await runManagedPiProcess(args, {
      cwd,
      timeout,
      env: piLocalEnvironment(configured.agentDir),
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const detail = childFailureDetail(error);
    throw new Error([
      "PlotPickle-managed Pi exited before completing the Developer Workbench review.",
      detail ? `Pi detail:\n${detail}` : "Pi produced no stderr/stdout detail after stdin was closed.",
      `Runtime: ${runtime.label} · ${runtime.model}`,
      `Provider: ${WORKBENCH_CANONICAL_PROVIDER_ID}`,
      `Direct launcher: ${process.execPath} ${cliEntry}`,
    ].join("\n"), { cause: error });
  }
}
