import { spawn as spawnProcess, execFile } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { terminateVerificationProcessTree } from "../../../full-verification-process.mjs";

export const TUNNEL_LAUNCHER_NAME = "Start-PlotPickle-Tunnel-Authenticated.ps1";
export const TUNNEL_MCP_PORT = 43115;
const MCP_HOST = "127.0.0.1";
const git = promisify(execFile);

// Socket presence is not proof of MCP identity, remote authentication or a
// connected ChatGPT plugin. Never promote this observation to TUNNEL_READY.
export function observeLocalMcpPort({ port = TUNNEL_MCP_PORT, host = MCP_HOST, timeoutMs = 750,
  connect = options => net.createConnection(options) } = {}) {
  return new Promise((resolve) => {
    let socket;
    let settled = false;
    const finish = (state, code) => {
      if (settled) return;
      settled = true;
      socket?.destroy();
      resolve(Object.freeze({ state, code }));
    };
    try {
      socket = connect({ host, port });
      socket.setTimeout(timeoutMs, () => finish("UNVERIFIED", "MCP_PROBE_TIMEOUT"));
      socket.once("connect", () => finish("LISTENING", "MCP_LISTENER_OBSERVED"));
      socket.once("error", error => error?.code === "ECONNREFUSED"
        ? finish("FREE", "MCP_PORT_FREE") : finish("UNVERIFIED", "MCP_PROBE_UNVERIFIED"));
    } catch { finish("UNVERIFIED", "MCP_PROBE_UNVERIFIED"); }
  });
}

// The compatibility boolean is a launch interlock, not a readiness claim.
export async function localMcpPortOccupied(options) {
  return (await observeLocalMcpPort(options)).state !== "FREE";
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

/** PR TEST worktrees do not contain the separately provisioned owner launcher.
 * Resolve only their canonical main checkout, with a pinned repository origin.
 * The browser cannot supply a root, command, executable or argument here.
 */
export async function resolveOwnerTunnelLauncher({ repoRoot = process.cwd(), runGit = git } = {}) {
  const direct = await verifiedTunnelLauncher({ repoRoot });
  if (direct) return direct;
  try {
    const root = path.resolve(repoRoot), info = await lstat(root);
    const resolved = await realpath(root);
    const sameRoot = process.platform === "win32" ? resolved.toLowerCase() === root.toLowerCase() : resolved === root;
    if (!info.isDirectory() || info.isSymbolicLink() || !sameRoot) return null;
    const read = async (args, cwd = root) => String((await runGit("git", args,
      { cwd, windowsHide: true, timeout: 5000, maxBuffer: 4096, encoding: "utf8" })).stdout || "").trim();
    const origin = await read(["remote", "get-url", "origin"]);
    if (!["https://github.com/BryanHarrisScripts/PlotPickle.git", "https://github.com/BryanHarrisScripts/PlotPickle",
      "git@github.com:BryanHarrisScripts/PlotPickle.git", "git@github.com:BryanHarrisScripts/PlotPickle"].includes(origin)) return null;
    const common = await read(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
    if (!path.isAbsolute(common) || path.basename(common) !== ".git") return null;
    const ownerRoot = path.dirname(common);
    if (await read(["branch", "--show-current"], ownerRoot) !== "main") return null;
    return await verifiedTunnelLauncher({ repoRoot: ownerRoot });
  } catch { return null; }
}

export async function tunnelLocalStatus({
  platform = process.platform, verify = verifiedTunnelLauncher,
  portOccupied = localMcpPortOccupied, probePort = null,
} = {}) {
  if (platform !== "win32") return Object.freeze({
    version: 1, state: "WINDOWS_ONLY", launcherAvailable: false,
    localMcpPortOccupied: false, remoteAuthorized: false,
  });
  const observe = async () => typeof probePort === "function" ? probePort() :
    portOccupied === localMcpPortOccupied ? observeLocalMcpPort() :
      { state: await portOccupied() ? "LISTENING" : "FREE", code: "INJECTED_PORT_OBSERVATION" };
  const [launcher, port] = await Promise.all([verify(), observe()]);
  const occupied = port.state !== "FREE";
  return Object.freeze({
    version: 1,
    state: port.state === "UNVERIFIED" ? "LOCAL_MCP_PROBE_UNVERIFIED" : occupied ? "LOCAL_MCP_PORT_OCCUPIED"
      : launcher ? "READY_TO_LAUNCH" : "LAUNCHER_NOT_INSTALLED",
    launcherAvailable: Boolean(launcher),
    localMcpPortOccupied: Boolean(occupied),
    localMcpProbeCode: port.code,
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

// This fixed PowerShell bootstrap creates the owner-visible *target* in a
// separate console while this directly owned wrapper waits for it. The parent
// handle is deliberately retained, so taskkill /T can stop the entire tree.
// No cmd.exe, caller-selected command, or interpolated executable is involved.
// The verified local .ps1 path is serialized as a single-quoted literal; a
// filename quote cannot become PowerShell source text.
function visibleOwnerTunnelArguments(launcher) {
  const literalPath = launcher.replaceAll("'", "''");
  const bootstrap = [
    "$ErrorActionPreference = 'Stop'",
    "$ownerLauncher = '" + literalPath + "'",
    '$arguments = \'-NoLogo -NoProfile -ExecutionPolicy Bypass -NoExit -File "\' + $ownerLauncher + \'"\'',
    "try {",
    "  $process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Normal -PassThru -Wait -ErrorAction Stop",
    "  if (-not $process) { exit 2 }",
    "  exit $process.ExitCode",
    "} catch { exit 3 }",
  ].join("; ");
  return ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand",
    Buffer.from(bootstrap, "utf16le").toString("base64")];
}

// Only an owner-authorized POST can run this operation. There is no
// browser-selected executable, command, argument, path, port or credential.
export async function launchOwnTunnel({
  engineering = false, platform = process.platform, repoRoot = process.cwd(),
  verify = verifiedTunnelLauncher, portOccupied = localMcpPortOccupied,
  launch = spawnProcess, sourceEnv = process.env, onLaunch = () => {},
} = {}) {
  if (platform !== "win32") return { state: "BLOCKED", code: "WINDOWS_ONLY" };
  if (typeof engineering !== "boolean") return { state: "BLOCKED", code: "ACTION_INVALID" };
  if (await portOccupied()) return { state: "BLOCKED", code: "LOCAL_MCP_PORT_OCCUPIED" };
  const launcher = await verify({ repoRoot });
  if (!launcher) return { state: "BLOCKED", code: "LAUNCHER_NOT_INSTALLED" };
  const cwd = path.dirname(launcher);
  // A controller can retain this child handle. It may never guess a PID or
  // adopt a separately started terminal after an app restart.
  try {
    // A directly spawned non-detached PowerShell script runs but can remain
    // attached to its parent's console. The fixed Start-Process bootstrap
    // requests its *own visible* terminal and waits, keeping an owned parent
    // PID for taskkill /T. Never pass the launcher through cmd.exe or use a
    // detached process, which Windows PowerShell 5.1 may fail to execute.
    const child = launch("powershell.exe", visibleOwnerTunnelArguments(launcher), {
      cwd, shell: false, windowsHide: true, detached: false, stdio: "ignore",
      env: minimalLauncherEnvironment(sourceEnv, engineering),
    });
    if (!Number.isInteger(child?.pid) || child.pid <= 0) {
      return { state: "BLOCKED", code: "TERMINAL_LAUNCH_UNVERIFIED" };
    }
    child.once?.("error", () => { /* Never claim remote authorization from launch. */ });
    child.unref?.();
    onLaunch(child);
    return { state: "LAUNCH_REQUESTED", remoteAuthorized: false };
  } catch {
    return { state: "BLOCKED", code: "TERMINAL_LAUNCH_FAILED" };
  }
}

/** #3268: a live child handle is the sole STOP authority. App restarts do not
 * adopt external launchers or stale PIDs. Clearing a dead session changes only
 * this controller's memory, never files, receipts, listeners or Factory queues.
 */
export function createOwnerTunnelController({
  platform = process.platform, repoRoot = process.cwd(),
  verify = resolveOwnerTunnelLauncher, portOccupied = localMcpPortOccupied,
  launch = spawnProcess, sourceEnv = process.env,
  stopTree = terminateVerificationProcessTree,
} = {}) {
  let owned = null, busy = false;
  const alive = () => Boolean(owned?.pid > 0 && owned.exitCode === null && owned.signalCode === null);
  const blocked = code => ({ state: "BLOCKED", code, remoteAuthorized: false });
  const dependencies = { platform, repoRoot, verify: () => verify({ repoRoot }), portOccupied, launch, sourceEnv };
  return Object.freeze({
    async status() {
      const local = await tunnelLocalStatus(dependencies);
      const launcherOwned = alive(), staleSession = Boolean(owned && !launcherOwned);
      return { ...local, launcherOwned, staleSession,
        launcherState: launcherOwned ? "OWNED_LAUNCHER_OBSERVED" : staleSession ? "STALE_SESSION" : "NO_OWNED_SESSION",
        localMcpIdentityVerified: false, remoteAuthorized: false };
    },
    async start({ engineering = false } = {}) {
      if (busy) return blocked("TUNNEL_CONTROL_BUSY");
      if (alive()) return blocked("OWNED_LAUNCHER_ALREADY_RUNNING");
      if (owned) return blocked("STALE_SESSION_REQUIRES_CLEAR");
      busy = true;
      try { return await launchOwnTunnel({ ...dependencies, engineering, onLaunch: child => { owned = child; } }); }
      finally { busy = false; }
    },
    async stop() {
      if (platform !== "win32") return blocked("WINDOWS_ONLY");
      if (busy) return blocked("TUNNEL_CONTROL_BUSY");
      if (!alive()) return blocked("TUNNEL_PROCESS_NOT_OWNED");
      busy = true;
      try {
        await stopTree(owned, { stderr: { write() {} } });
        if (alive()) return blocked("TUNNEL_STOP_UNVERIFIED");
        owned = null;
        return { state: "OWNED_LAUNCHER_STOPPED", code: "OWNED_LAUNCHER_STOPPED",
          localMcpPortOccupied: await portOccupied(), localMcpIdentityVerified: false, remoteAuthorized: false };
      } catch { return blocked("TUNNEL_STOP_UNVERIFIED"); }
      finally { busy = false; }
    },
    async clearStaleSession() {
      if (platform !== "win32") return blocked("WINDOWS_ONLY");
      if (busy) return blocked("TUNNEL_CONTROL_BUSY");
      if (alive()) return blocked("LIVE_SESSION_CANNOT_BE_CLEARED");
      if (!owned) return blocked("STALE_SESSION_NOT_OBSERVED");
      owned = null;
      return { state: "STALE_SESSION_CLEARED", code: "STALE_SESSION_CLEARED", remoteAuthorized: false };
    },
  });
}

const ownerController = createOwnerTunnelController();
export const observeOwnTunnel = () => ownerController.status();
export const startOwnedTunnel = options => ownerController.start(options);
export const stopOwnTunnel = () => ownerController.stop();
export const clearStaleTunnelSession = () => ownerController.clearStaleSession();
