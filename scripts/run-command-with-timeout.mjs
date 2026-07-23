import { spawn } from "node:child_process";

function parseDuration(value, fallback) {
  if (!value) return fallback;
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/i);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unit = (match[2] ?? "ms").toLowerCase();
  const multiplier = unit === "h" ? 3_600_000 : unit === "m" ? 60_000 : unit === "s" ? 1_000 : 1;
  return Math.max(1, Math.round(amount * multiplier));
}

const separator = process.argv.indexOf("--");
if (separator < 0 || separator === process.argv.length - 1) {
  console.error("Usage: node run-command-with-timeout.mjs <timeout> <kill-after> -- <command> [...args]");
  process.exit(64);
}

const timeoutMs = parseDuration(process.argv[2], 180_000);
const killAfterMs = parseDuration(process.argv[3], 10_000);
const [command, ...args] = process.argv.slice(separator + 1);
let timedOut = false;
let forceTimer;

const child = spawn(command, args, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

const timeoutTimer = setTimeout(() => {
  timedOut = true;
  console.error(`Command exceeded ${timeoutMs}ms; requesting termination.`);
  child.kill("SIGTERM");
  forceTimer = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) {
      console.error(`Command did not stop within ${killAfterMs}ms; forcing termination.`);
      child.kill("SIGKILL");
    }
  }, killAfterMs);
  forceTimer.unref();
}, timeoutMs);

timeoutTimer.unref();

child.on("error", (error) => {
  clearTimeout(timeoutTimer);
  if (forceTimer) clearTimeout(forceTimer);
  console.error(`Could not start command: ${error.message}`);
  process.exitCode = 69;
});

child.on("exit", (code, signal) => {
  clearTimeout(timeoutTimer);
  if (forceTimer) clearTimeout(forceTimer);
  if (timedOut) {
    process.exitCode = 124;
    return;
  }
  if (signal) {
    console.error(`Command stopped by ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
