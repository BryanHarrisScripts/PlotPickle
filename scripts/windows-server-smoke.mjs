import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const viteEntry = path.join(root, "node_modules", "vite", "bin", "vite.js");
const url = "http://127.0.0.1:4173/";
const logFile = path.join(root, "windows-server-smoke.log");
const timeoutMs = 120_000;

if (!existsSync(viteEntry)) throw new Error(`Vite entry is missing: ${viteEntry}`);

let output = "";
let exited = false;
let exitCode = null;
let exitSignal = null;
let lastResponse = "No HTTP response received.";

function append(label, chunk) {
  const text = chunk.toString();
  output += `[${label}] ${text}`;
  process.stdout.write(text);
}

function saveLog(summary) {
  writeFileSync(
    logFile,
    [
      `PlotPickle Windows server smoke`,
      `Node: ${process.version}`,
      `Platform: ${process.platform} ${process.arch}`,
      `Root: ${root}`,
      `URL: ${url}`,
      `Result: ${summary}`,
      `Exit code: ${exitCode ?? "running"}`,
      `Exit signal: ${exitSignal ?? "none"}`,
      `Last response: ${lastResponse}`,
      "",
      output || "No process output captured.",
    ].join("\n"),
    "utf8",
  );
}

const server = spawn(
  process.execPath,
  [viteEntry, "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
  {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      NODE_ENV: "development",
      WRANGLER_WRITE_LOGS: "false",
      WRANGLER_LOG_PATH: ".wrangler/logs",
      MINIFLARE_REGISTRY_PATH: ".wrangler/registry",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

server.stdout.on("data", (chunk) => append("stdout", chunk));
server.stderr.on("data", (chunk) => append("stderr", chunk));
server.on("error", (error) => {
  output += `[process-error] ${error.stack || error.message}\n`;
});
server.on("exit", (code, signal) => {
  exited = true;
  exitCode = code;
  exitSignal = signal;
});

const startedAt = Date.now();
let success = false;
try {
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    if (exited) throw new Error(`Vite exited before responding (code ${exitCode ?? "unknown"}, signal ${exitSignal ?? "none"}).`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4_000) });
      lastResponse = `${response.status} ${response.statusText}`;
      if (response.ok) {
        success = true;
        saveLog(lastResponse);
        console.log(`PlotPickle answered at ${url} with ${lastResponse}.`);
        break;
      }
      const body = await response.text();
      lastResponse += body ? ` — ${body.slice(0, 500).replace(/\s+/g, " ")}` : "";
    } catch (error) {
      lastResponse = error instanceof Error ? error.message : String(error);
    }
  }
  if (!success) throw new Error(`PlotPickle did not return a successful response within ${timeoutMs / 1_000} seconds.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  saveLog(message);
  console.error(message);
  console.error(`Diagnostic log: ${logFile}`);
  process.exitCode = 1;
} finally {
  if (!exited) server.kill("SIGTERM");
}
