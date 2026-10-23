import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { dispatchTunnelRequest } from "../scripts/engineering-team/windows/tunnel/tunnel-http.mjs";
import { launchOwnTunnel, tunnelLocalStatus, verifiedTunnelLauncher,
  TUNNEL_LAUNCHER_NAME } from "../scripts/engineering-team/windows/tunnel/owner-tunnel-launch.mjs";

const ENDPOINT = "http://127.0.0.1:4173/api/factory/tunnel";
const req = (method = "GET", body = null, origin = "http://127.0.0.1:4173") =>
  new Request(ENDPOINT, { method, headers: method === "POST"
    ? { Origin: origin, "Content-Type": "application/json", "X-PlotPickle-CSRF": "fixture" }
    : {}, body: method === "POST" ? JSON.stringify(body) : undefined });

test("#3254 user-owned Tunnel API requires local Windows and authenticated Human profile before reads and launches", async () => {
  let read = 0, starts = 0, auth = 0;
  const harness = {
    status: async () => { read++; return { version: 1, state: "READY_TO_LAUNCH",
      launcherAvailable: true, localMcpPortOccupied: false, remoteAuthorized: false }; },
    start: async () => { starts++; return { state: "LAUNCH_REQUESTED" }; },
    authorize: async (_, mutation) => { auth++; assert.equal(typeof mutation, "boolean"); },
    platform: "win32",
  };
  const ok = await dispatchTunnelRequest({ request: req(), ...harness });
  assert.equal((await ok.json()).state, "READY_TO_LAUNCH");
  assert.equal(ok.headers.get("Cache-Control"), "no-store");
  const requested = await dispatchTunnelRequest({ request: req("POST", { action: "start", engineering: true }), ...harness });
  assert.equal(requested.status, 202);
  assert.equal((await requested.json()).remoteAuthorized, false);
  assert.equal(read, 1);
  assert.equal(starts, 1);
  assert.equal(auth, 2);

  const forbidden = [
    req("POST", { action: "start", engineering: false }, "https://attacker.invalid"),
    req("POST", { action: "stop", engineering: true }),
    req("POST", { action: "start", engineering: true, command: "rm" }),
    req("POST", { action: "start", engineering: 1 }),
    new Request("http://evil.invalid/api/factory/tunnel"),
    new Request("http://127.0.0.1:4173/api/factory/tunnel?command=x"),
    new Request(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" },
      body: '{"action":"start","engineering":true}' }),
  ];
  for (const request of forbidden) {
    const before = starts;
    const response = await dispatchTunnelRequest({ request, ...harness });
    assert.notEqual(response.status, 202);
    assert.equal(starts, before);
  }
  const before = starts;
  const denied = await dispatchTunnelRequest({
    request: req("POST", { action: "start", engineering: false }),
    ...harness, authorize: async () => { throw Error("SECRET_AUTH_FAILURE"); },
  });
  assert.equal(denied.status, 403);
  assert.equal(starts, before);
  assert.doesNotMatch(await denied.text(), /SECRET_AUTH_FAILURE/u);
  const unsupported = await dispatchTunnelRequest({
    request: req("POST", { action: "start", engineering: false }),
    ...harness, platform: "linux",
  });
  assert.equal(unsupported.status, 403);
});

test("#3254 launcher is fixed to repo root, must be regular non-symlink file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pp-tunnel-test-"));
  try {
    assert.equal(await verifiedTunnelLauncher({ repoRoot: dir }), null);
    await writeFile(path.join(dir, TUNNEL_LAUNCHER_NAME), "Write-Host 'owner test'\n");
    assert.equal(await verifiedTunnelLauncher({ repoRoot: dir }), path.join(dir, TUNNEL_LAUNCHER_NAME));
    const out = await launchOwnTunnel({
      repoRoot: dir, platform: "win32", engineering: true,
      portOccupied: async () => false,
      sourceEnv: { Path: "C:\\Windows", CONTROL_PLANE_API_KEY: "SECRET_API_KEY", OPENAI_API_KEY: "SECRET_PROVIDER_KEY" },
      launch: (exe, args, opts) => {
        assert.equal(exe, "powershell.exe");
        assert.deepEqual(args.slice(0, 7), ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-NoExit", "-File", path.join(dir, TUNNEL_LAUNCHER_NAME)]);
        assert.equal(opts.shell, false);
        assert.equal(opts.detached, true);
        assert.equal(opts.windowsHide, false);
        assert.equal(opts.env.PLOTPICKLE_FACTORY_ENGINEERING_ENABLED, "1");
        assert.equal(opts.env.CONTROL_PLANE_API_KEY, undefined);
        assert.equal(opts.env.OPENAI_API_KEY, undefined);
        return { pid: 1234, once() {}, unref() {} };
      },
    });
    assert.deepEqual(out, { state: "LAUNCH_REQUESTED", remoteAuthorized: false });
    let invoked = false;
    const dup = await launchOwnTunnel({
      repoRoot: dir, platform: "win32", portOccupied: async () => true,
      launch: () => { invoked = true; },
    });
    assert.equal(dup.code, "LOCAL_MCP_PORT_OCCUPIED");
    assert.equal(invoked, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  const root = await mkdtemp(path.join(os.tmpdir(), "pp-tunnel-link-"));
  try {
    await writeFile(path.join(root, "target.ps1"), "Write-Host 'source'\n");
    await symlink("target.ps1", path.join(root, TUNNEL_LAUNCHER_NAME));
    assert.equal(await verifiedTunnelLauncher({ repoRoot: root }), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("#3254 local port observation never implies remote authorization", async () => {
  const status = await tunnelLocalStatus({ platform: "win32",
    verify: async () => "C:\\PlotPickle\\Start-PlotPickle-Tunnel-Authenticated.ps1",
    portOccupied: async () => true });
  assert.equal(status.state, "LOCAL_MCP_PORT_OCCUPIED");
  assert.equal(status.remoteAuthorized, false);
  const missing = await tunnelLocalStatus({ platform: "win32",
    verify: async () => null, portOccupied: async () => false });
  assert.equal(missing.state, "LAUNCHER_NOT_INSTALLED");
  assert.equal((await tunnelLocalStatus({ platform: "linux" })).state, "WINDOWS_ONLY");
});

test("#3254 Settings Compute has only one Tunnel with guarded owner-start, no browser credentials", async () => {
  const read = p => readFile(new URL("../" + p, import.meta.url), "utf8");
  const [menu, ui, gateway, route] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/tunnel-settings-panel.tsx"),
    read("build/local-profile-auth-gateway.ts"),
    read("app/api/factory/tunnel/route.ts"),
  ]);
  assert.match(menu, /id: "tunnel", shortcut: SETTINGS_SHORTCUTS\.tunnel, label: "Tunnel"[^\n]*group: "COMPUTE"/u);
  assert.match(menu, /if \(item\.id === "tunnel"\) \{ setTunnelOpen\(true\)/u);
  assert.match(menu, /<TunnelSettingsPanel \/>/u);
  assert.match(ui, /Start My Tunnel/u);
  assert.match(ui, /authenticatedProfileFetch\(ENDPOINT/u);
  assert.match(ui, /PLOTPICKLE TUNNEL READY/u);
  assert.match(ui, /not.*remote|remote.*not|plugin authorization|authorization: NOT VERIFIED/iu);
  assert.doesNotMatch(ui, /type="password"|localStorage|sessionStorage|CONTROL_PLANE_API_KEY/u);
  assert.match(gateway, /"\/api\/factory\/tunnel"/u);
  assert.match(route, /recentReauthentication: true/u);
  assert.match(route, /state\.accessMode !== "desktop-loopback"/u);
});
