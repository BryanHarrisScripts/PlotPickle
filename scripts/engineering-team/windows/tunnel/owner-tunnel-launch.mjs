import { spawn as spawnProcess } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

export const TUNNEL_LAUNCHER_NAME = "Start-PlotPickle-Tunnel-Authenticated.ps1";
export const TUNNEL_MCP_PORT = 43115;
const MCP_HOST = "127.0.0.1";

// Socket presence is not proof of MCP identity, remote authentication or a
// connected ChatGPT plugin. Never promote this observation to TUNNEL_READY.
export function localMcpPortOccupied({ port = TUNNEL_MCP_PORT, host = MCP_HOST, timeoutMs = 750 } = {}) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (occupied) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(occupied);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

export async function verifiedTunnelLauncher({
  repoRoot = process.cwd(), readStat = lstat, resolveReal = realpath,
} = {}) {
  const root = path.resolve(repoRoot);
  const launcher = path.join(root, TUNNEL_LAUNCHER_NAME);
  try {
    const [rootInfo, fileInfo, resolvedRoot, resolvedFile] = await Promise.all([
      readStat(root), readStat(launcher), resolveReal(root), resolveReal(launcher),
    ]);
    // Windows filesystem paths are case-insensitive. A differently cased realpath
    // is not a symlink, but any actual symlink is rejected by lstat.
    const samePath = (left, right) => process.platform === "win32"
      ? path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
      : path.resolve(left) === path.resolve(right);
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() ||
        !fileInfo.isFile() || fileInfo.isSymbolicLink() ||
        !samePath(resolvedRoot, root) || !samePath(resolvedFile, launcher)) {
      return null;
    }
    return launcher;
  } catch {
    return null;
  }
}

export async function tunnelLocalStatus({
  platform = process.platform, verify = verifiedTunnelLauncher,
  portOccupied = localMcpPortOccupied,
} = {}) {
  if (platform !== "win32") return Object.freeze({
    version: 1, state: "WINDOWS_ONLY", launcherAvailable: false,
    localMcpPortOccupied: false, remoteAuthorized: false,
  });
  const [launcher, occupied] = await Promise.all([verify(), portOccupied()]);
  return Object.freeze({
    version: 1,
    state: occupied ? "LOCAL_MCP_PORT_OCCUPIED"
      : launcher ? "READY_TO_LAUNCH" : "LAUNCHER_NOT_INSTALLED",
    launcherAvailable: Boolean(launcher),
    localMcpPortOccupied: Boolean(occupied),
    remoteAuthorized: false,
  });
}

function minimalLauncherEnvironment(source, engineering) {
  // Never inherit server/service/provider secrets into a newly spawned terminal.
  const allowed = ["PATH", "Path", "PATHEXT", "SystemRoot", "windir", "WINDIR",
    "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "APPDATA", "LOCALAPPDATA", "TEMP",
    "TMP", "PSModulePath", "COMSPEC"];
  const result = Object.fromEntries(allowed
    .filter((key) => typeof source[key] === "string" && source[key].length > 0)
    .map((key) => [key, source[key]]));
  result.PLOTPICKLE_FACTORY_ENGINEERING_ENABLED = engineering ? "1" : "0";
  return result;
}

// Only an owner-authorized POST can run this operation. There is no
// browser-selected executable, command, argument, path, port or credential.
export async function launchOwnTunnel({
  engineering = false, platform = process.platform, repoRoot = process.cwd(),
  verify = verifiedTunnelLauncher, portOccupied = localMcpPortOccupied,
  launch = spawnProcess, sourceEnv = process.env,
} = {}) {
  if (platform !== "win32") return { state: "BLOCKED", code: "WINDOWS_ONLY" };
  if (typeof engineering !== "boolean") return { state: "BLOCKED", code: "ACTION_INVALID" };
  if (await portOccupied()) return { state: "BLOCKED", code: "LOCAL_MCP_PORT_OCCUPIED" };
  const launcher = await verify({ repoRoot });
  if (!launcher) return { state: "BLOCKED", code: "LAUNCHER_NOT_INSTALLED" };
  const cwd = path.resolve(repoRoot);
  // Ownership of this detached terminal belongs to the Human user.
  // The launching GUI must not guess PIDs or kill it later.
  try {
    const child = launch("powershell.exe", [
      "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-NoExit", "-File", launcher,
    ], {
      cwd, shell: false, windowsHide: false, detached: true, stdio: "ignore",
      env: minimalLauncherEnvironment(sourceEnv, engineering),
    });
    if (!Number.isInteger(child?.pid) || child.pid <= 0) {
      return { state: "BLOCKED", code: "TERMINAL_LAUNCH_UNVERIFIED" };
    }
    child.once?.("error", () => { /* Never claim remote authorization from launch. */ });
    child.unref?.();
    return { state: "LAUNCH_REQUESTED", remoteAuthorized: false };
  } catch {
    return { state: "BLOCKED", code: "TERMINAL_LAUNCH_FAILED" };
  }
}
