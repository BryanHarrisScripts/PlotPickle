import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { createOwnerTunnelController, resolveOwnerTunnelLauncher, observeLocalMcpPort, tunnelLocalStatus, TUNNEL_LAUNCHER_NAME } from "../scripts/engineering-team/windows/tunnel/owner-tunnel-launch.mjs";
import { dispatchTunnelRequest } from "../scripts/engineering-team/windows/tunnel/tunnel-http.mjs";

function harness() {
  const child = { pid: 3210, exitCode: null, signalCode: null, once() {}, unref() {} };
  const state = { occupied: false, launches: 0, stops: 0 };
  const options = { platform: "win32", repoRoot: path.resolve("owner-repo"), verify: async () => path.resolve(TUNNEL_LAUNCHER_NAME),
    portOccupied: async () => state.occupied,
    launch: () => { state.launches++; return child; },
    stopTree: async target => { assert.equal(target, child); state.stops++; child.exitCode = 0; },
  };
  return { child, state, options, controller: createOwnerTunnelController(options) };
}

test("#3268 controls start one owned launcher, reject duplicates and stop only that child", async () => {
  const { controller, state } = harness();
  assert.equal((await controller.start()).state, "LAUNCH_REQUESTED");
  const status = await controller.status();
  assert.equal(status.launcherOwned, true);
  assert.equal(status.remoteAuthorized, false);
  assert.equal(status.localMcpIdentityVerified, false);
  assert.equal((await controller.start()).code, "OWNED_LAUNCHER_ALREADY_RUNNING");
  assert.equal((await controller.clearStaleSession()).code, "LIVE_SESSION_CANNOT_BE_CLEARED");
  assert.equal(state.launches, 1);
  state.occupied = true;
  const stop = await controller.stop();
  assert.equal(stop.state, "OWNED_LAUNCHER_STOPPED");
  assert.equal(stop.localMcpPortOccupied, true, "an occupied port is still explicitly unverified");
  assert.equal(stop.remoteAuthorized, false);
  assert.equal(state.stops, 1);
  assert.equal((await controller.status()).launcherOwned, false);
});

test("#3268 stale exited session can be cleared without touching an unrelated listener", async () => {
  const { controller, child, state } = harness();
  await controller.start(); child.exitCode = 1; state.occupied = true;
  const stale = await controller.status();
  assert.equal(stale.launcherState, "STALE_SESSION");
  assert.equal(stale.launcherOwned, false);
  assert.equal((await controller.stop()).code, "TUNNEL_PROCESS_NOT_OWNED");
  assert.equal((await controller.start()).code, "STALE_SESSION_REQUIRES_CLEAR");
  assert.equal((await controller.clearStaleSession()).state, "STALE_SESSION_CLEARED");
  const observed = await controller.status();
  assert.equal(observed.state, "LOCAL_MCP_PORT_OCCUPIED");
  assert.equal(observed.staleSession, false);
  assert.equal((await controller.start()).code, "LOCAL_MCP_PORT_OCCUPIED");
  assert.equal(state.stops, 0);
});

test("#3268 a new app session never adopts a previous or external launcher; failed stop stays unverified", async () => {
  const { controller, options, state } = harness();
  state.occupied = true;
  assert.equal((await controller.stop()).code, "TUNNEL_PROCESS_NOT_OWNED");
  assert.equal((await controller.clearStaleSession()).code, "STALE_SESSION_NOT_OBSERVED");
  state.occupied = false;
  const failed = createOwnerTunnelController({ ...options, stopTree: async () => { throw Error("PRIVATE_ERROR"); } });
  await failed.start();
  const receipt = await failed.stop();
  assert.equal(receipt.code, "TUNNEL_STOP_UNVERIFIED");
  assert.equal(JSON.stringify(receipt).includes("PRIVATE_ERROR"), false);
  const afterRestart = createOwnerTunnelController(options);
  state.occupied = true;
  assert.equal((await afterRestart.status()).launcherState, "NO_OWNED_SESSION");
  assert.equal((await afterRestart.stop()).code, "TUNNEL_PROCESS_NOT_OWNED");
  assert.equal(state.stops, 0);
});

test("#3268 launch serialization blocks concurrent starts while verification is pending", async () => {
  const { options, state } = harness();
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const controller = createOwnerTunnelController({ ...options, verify: async () => { await pending; return path.resolve(TUNNEL_LAUNCHER_NAME); } });
  const first = controller.start();
  assert.equal((await controller.start()).code, "TUNNEL_CONTROL_BUSY");
  assert.equal((await controller.stop()).code, "TUNNEL_CONTROL_BUSY");
  release();
  assert.equal((await first).state, "LAUNCH_REQUESTED");
  assert.equal(state.launches, 1);
});

test("#3268 refused, occupied and uncertain sockets are different observations; uncertainty blocks launch without claiming a listener", async () => {
  const probe = async mode => observeLocalMcpPort({ connect: () => {
    const socket = new EventEmitter();
    socket.destroy = () => { socket.destroyed = true; };
    socket.setTimeout = (_, timeout) => { if (mode === "timeout") queueMicrotask(timeout); };
    if (mode !== "timeout") queueMicrotask(() => mode === "connect" ? socket.emit("connect") : socket.emit("error", { code: mode }));
    return socket;
  } });
  assert.equal((await probe("ECONNREFUSED")).state, "FREE");
  assert.equal((await probe("connect")).state, "LISTENING");
  for (const mode of ["EACCES", "ECONNRESET", "timeout"]) {
    const observation = await probe(mode);
    assert.equal(observation.state, "UNVERIFIED");
    const status = await tunnelLocalStatus({ platform: "win32", verify: async () => "launcher", probePort: async () => observation });
    assert.equal(status.state, "LOCAL_MCP_PROBE_UNVERIFIED");
    assert.equal(status.localMcpPortOccupied, true, "conservative launch interlock stays blocked");
    assert.equal(status.remoteAuthorized, false);
  }
});

test("#3268 Stop/Clear use exact authenticated same-origin mutations; unknown actions and caller PIDs remain rejected", async () => {
  const endpoint = "http://127.0.0.1:4173/api/factory/tunnel";
  const req = (body, origin = "http://127.0.0.1:4173") => new Request(endpoint, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let actions = 0, auth = 0;
  const args = { platform: "win32", authorize: async (_, mutation) => { assert.equal(mutation, true); auth++; },
    stop: async () => { actions++; return { state: "OWNED_LAUNCHER_STOPPED" }; },
    clearStaleSession: async () => { actions++; return { state: "STALE_SESSION_CLEARED" }; } };
  for (const action of ["stop", "clear-stale-session"]) {
    const response = await dispatchTunnelRequest({ ...args, request: req({ action }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).remoteAuthorized, false);
  }
  assert.equal(actions, 2); assert.equal(auth, 2);
  for (const request of [req({ action: "stop", pid: 1234 }), req({ action: "clear-stale-session", path: "private" }),
    req({ action: "start-all" }), req({ action: "stop" }, "https://untrusted.invalid")]) {
    const response = await dispatchTunnelRequest({ ...args, request });
    assert.ok(response.status >= 400);
    assert.equal(actions, 2);
  }
  const denied = await dispatchTunnelRequest({ ...args, request: req({ action: "stop" }), authorize: async () => { throw Error("SESSION_EXPIRED"); } });
  assert.equal(denied.status, 403); assert.equal(actions, 2);
});

test("#3268 PR TEST resolves only its pinned canonical main checkout's regular provisioned launcher", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "pp-owner-tunnel-"));
  try {
    const owner = path.join(base, "owner"), stage = path.join(base, "stage");
    await mkdir(path.join(owner, ".git"), { recursive: true }); await mkdir(stage);
    const launcher = path.join(owner, TUNNEL_LAUNCHER_NAME);
    await writeFile(launcher, "Write-Host 'test fixture'\n");
    const runGit = async (_, args, options) => {
      assert.equal(options.windowsHide, true);
      assert.equal(options.timeout, 5000);
      return { stdout: args[0] === "remote" ? "https://github.com/BryanHarrisScripts/PlotPickle.git" :
        args[0] === "rev-parse" ? path.join(owner, ".git") : "main" };
    };
    assert.equal(await resolveOwnerTunnelLauncher({ repoRoot: stage, runGit }), launcher);
    assert.equal(await resolveOwnerTunnelLauncher({ repoRoot: stage, runGit: async () => ({ stdout: "https://untrusted.invalid/repo.git" }) }), null);
    assert.equal(await readFile(launcher, "utf8"), "Write-Host 'test fixture'\n");
  } finally { await rm(base, { recursive: true, force: true }); }
});
