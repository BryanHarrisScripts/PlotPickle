import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

const temp = await mkdtemp(path.resolve("node_modules/.openpencil-2780-"));
await build({
  stdin: {
    contents: `
      export {
        createOpenPencilMcpController,
        resolveOpenPencilHttpLaunch,
        OPENPENCIL_MCP_ENDPOINT,
      } from "./build/openpencil/openpencil-mcp-gateway.ts";
      export {
        parseOpenPencilCommand,
        OPENPENCIL_COMMAND_HELP,
      } from "./app/_components/settings/openpencil-command.ts";
    `,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: path.join(temp, "host.mjs"),
  logLevel: "silent",
  plugins: [{
    name: "openpencil-2780-isolation",
    setup(builder) {
      builder.onLoad({ filter: /profile-request-context\.ts$/ }, () => ({
        contents: "export function currentProfileRequestContext(){ return { profileId: 'fixture' }; }",
        loader: "ts",
      }));
      builder.onLoad({ filter: /dsdd-session-gateway\.ts$/ }, () => ({
        contents: "export function acceptsDsddLoopbackRequest(){ return true; } export async function readDsddRequestBody(){ return {}; }",
        loader: "ts",
      }));
    },
  }],
});
const host = await import(pathToFileURL(path.join(temp, "host.mjs")).href);
test.after(() => rm(temp, { recursive: true, force: true }));

test("Command recognizes bounded OpenPencil operational verbs", () => {
  assert.deepEqual(host.parseOpenPencilCommand("OpenPencil status"), { action: "status" });
  assert.deepEqual(host.parseOpenPencilCommand("open pencil disconnect"), { action: "disconnect" });
  assert.deepEqual(host.parseOpenPencilCommand("Connect OpenPencil C:\\PlotPickle Designs"), {
    action: "connect",
    workspaceRoot: "C:\\PlotPickle Designs",
  });
  assert.deepEqual(host.parseOpenPencilCommand('OpenPencil connect "C:\\Design Files"'), {
    action: "connect",
    workspaceRoot: "C:\\Design Files",
  });
  assert.equal(host.parseOpenPencilCommand("redesign Timeline"), null);
  assert.match(host.OPENPENCIL_COMMAND_HELP, /OpenPencil status/);
});

test("Windows OpenPencil launch resolves the reviewed npm JS entrypoint without cmd.exe", () => {
  const shim = "C:\\Users\\Bryan\\AppData\\Roaming\\npm\\openpencil-mcp-http.cmd";
  const entry = "C:\\Users\\Bryan\\AppData\\Roaming\\npm\\node_modules\\@open-pencil\\mcp\\dist\\index.mjs";
  const found = new Set([shim, entry]);
  const launch = host.resolveOpenPencilHttpLaunch({
    platform: "win32",
    env: { PATH: "C:\\Users\\Bryan\\AppData\\Roaming\\npm" },
    nodeExecutable: "C:\\Program Files\\nodejs\\node.exe",
    exists: value => found.has(value),
  });
  assert.deepEqual(launch, {
    executable: "C:\\Program Files\\nodejs\\node.exe",
    args: [entry],
    source: "npm-global",
  });
});

test("explicit connection scopes OpenPencil to the selected workspace and owns only its child", async () => {
  class FakeChild extends EventEmitter {
    exitCode = null;
    signalCode = null;
    killed = false;
    kill() { this.killed = true; this.signalCode = "SIGTERM"; this.emit("exit", null, "SIGTERM"); return true; }
  }
  const child = new FakeChild();
  const spawnCalls = [];
  let phase = "before";
  const controller = host.createOpenPencilMcpController({
    platform: "win32",
    env: { PATH: "C:\\npm" },
    nodeExecutable: "C:\\node.exe",
    exists: value => new Set([
      "C:\\npm\\openpencil-mcp-http.cmd",
      "C:\\npm\\node_modules\\@open-pencil\\mcp\\dist\\index.mjs",
    ]).has(value),
    statPath: async value => ({ isDirectory: () => value === "C:\\Designs" }),
    portReady: async () => phase === "running",
    wait: async () => {},
    spawnProcess: (command, args, options) => {
      spawnCalls.push({ command, args: [...args], options });
      phase = "running";
      return child;
    },
  });

  await assert.rejects(controller.connect({ workspaceRoot: "relative" }), /OPENPENCIL_WORKSPACE_REQUIRED/);
  const connected = await controller.connect({ workspaceRoot: "C:\\Designs" });
  assert.equal(connected.state, "ready");
  assert.equal(connected.owned, true);
  assert.equal(connected.endpoint, host.OPENPENCIL_MCP_ENDPOINT);
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0].command, "C:\\node.exe");
  assert.deepEqual(spawnCalls[0].args, ["C:\\npm\\node_modules\\@open-pencil\\mcp\\dist\\index.mjs"]);
  assert.equal(spawnCalls[0].options.cwd, "C:\\Designs");
  assert.equal(spawnCalls[0].options.env.OPENPENCIL_MCP_ROOT, "C:\\Designs");
  assert.equal(spawnCalls[0].options.shell, false);
  assert.equal(spawnCalls[0].options.windowsHide, true);

  phase = "stopped";
  const disconnected = await controller.disconnect();
  assert.equal(disconnected.state, "disconnected");
  assert.equal(child.killed, true);
});

test("missing OpenPencil package remains optional and never launches", async () => {
  let spawned = 0;
  const controller = host.createOpenPencilMcpController({
    platform: "linux",
    env: { PATH: "/usr/bin" },
    exists: () => false,
    statPath: async () => ({ isDirectory: () => true }),
    portReady: async () => false,
    wait: async () => {},
    spawnProcess: () => { spawned++; throw new Error("must not spawn"); },
  });
  const status = await controller.status();
  assert.equal(status.state, "unavailable");
  assert.equal(status.installed, false);
  const connect = await controller.connect({ workspaceRoot: "/tmp/designs" });
  assert.equal(connect.state, "unavailable");
  assert.equal(spawned, 0);
});
