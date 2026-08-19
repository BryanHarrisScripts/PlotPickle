import { spawn } from "node:child_process";
import process from "node:process";

function quoteWindowsShellArg(value) {
  const text = String(value);
  if (/[\r\n\0"]/u.test(text)) {
    throw new Error(`Windows verification argument contains unsupported characters: ${text}`);
  }
  return `"${text}"`;
}

function cleanCleanupDetail(value, limit = 300) {
  return String(value || "")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[redacted-token]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|xai-[A-Za-z0-9_-]{16,})\b/g, "[redacted-api-key]")
    .replace(/\b[A-Za-z]:\\Users\\[^\\\s]+/gi, "%USERPROFILE%")
    .replace(/\/(?:home|Users)\/[^/\s]+/g, "~")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-limit);
}

function reportCleanupFailure(context, error, stderr = process.stderr) {
  const detail = cleanCleanupDetail(error instanceof Error ? error.message : String(error));
  stderr?.write?.(`[verification-cleanup] ${context}: ${detail || "unknown process cleanup error"}\n`);
}

function processAlreadyClosed(child) {
  return !child || child.exitCode !== null || child.signalCode !== null;
}

async function waitForProcessClose(child, timeoutMs) {
  if (processAlreadyClosed(child)) return true;
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.off("close", onClose);
      resolve(processAlreadyClosed(child));
    }, timeoutMs);
    const onClose = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(true);
    };
    child.once("close", onClose);
  });
}

async function stopTaskkillProcess(killer, pid, stderr) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      try {
        killer.kill();
      } catch (error) {
        reportCleanupFailure(`could not stop taskkill for PID ${pid}`, error, stderr);
      }
      settled = true;
      resolve();
    }, 5_000);
    const complete = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reportCleanupFailure(`taskkill for PID ${pid} failed`, error, stderr);
      resolve();
    };
    killer.once("error", complete);
    killer.once("close", () => complete());
  });
}

export function windowsVerificationCommand(command, args = []) {
  return [command, ...args].map(quoteWindowsShellArg).join(" ");
}

export function verificationCommandFor(node, options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const nodeExecPath = options.nodeExecPath || process.execPath;

  if (node.tool === "node") {
    return { command: nodeExecPath, args: [...node.args] };
  }

  if (node.tool === "npm") {
    if (platform === "win32") {
      return {
        command: env.ComSpec || "cmd.exe",
        args: ["/d", "/s", "/c", windowsVerificationCommand("npm.cmd", node.args)],
      };
    }
    return { command: "npm", args: [...node.args] };
  }

  throw new Error(`Unsupported Full Verification tool: ${node.tool}`);
}

export async function terminateVerificationProcessTree(child, options = {}) {
  if (!child?.pid || processAlreadyClosed(child)) return;
  const stderr = options.stderr || process.stderr;

  if (process.platform === "win32") {
    let killer;
    try {
      killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        shell: false,
        stdio: "ignore",
      });
    } catch (error) {
      reportCleanupFailure(`could not start taskkill for PID ${child.pid}`, error, stderr);
    }
    if (killer) await stopTaskkillProcess(killer, child.pid, stderr);
    if (await waitForProcessClose(child, 3_000)) return;
    try {
      child.kill();
    } catch (error) {
      reportCleanupFailure(`could not stop PID ${child.pid} after taskkill`, error, stderr);
    }
    await waitForProcessClose(child, 2_000);
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch (error) {
    reportCleanupFailure(`could not send SIGTERM to PID ${child.pid}`, error, stderr);
  }
  if (await waitForProcessClose(child, 3_000)) return;
  try {
    child.kill("SIGKILL");
  } catch (error) {
    reportCleanupFailure(`could not send SIGKILL to PID ${child.pid}`, error, stderr);
  }
  await waitForProcessClose(child, 2_000);
}
