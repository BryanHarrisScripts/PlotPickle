import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createOpenPencilMcpController,
  resolveOpenPencilHttpLaunch,
  OPENPENCIL_MCP_ENDPOINT,
} from "../build/openpencil/openpencil-mcp-runtime.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Command exposes bounded OpenPencil operational verbs outside DSDD persistence", async () => {
  const [parser, conversation, panel, dashboard] = await Promise.all([
    read("app/_components/settings/openpencil-command.ts"),
    read("app/skin-v1/global-dsdd-conversation.tsx"),
    read("app/_components/settings/openpencil-command-panel.tsx"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
  ]);
  for (const phrase of [
    "OpenPencil status",
    "OpenPencil connect <absolute local design workspace>",
    "OpenPencil disconnect",
  ]) assert.ok(parser.includes(phrase), `missing Command phrase: ${phrase}`);
  assert.match(conversation, /runOpenPencilCommand/);
  assert.match(conversation, /role: "command"/);
  assert.match(conversation, /role: "tool"/);
  const operational = conversation.slice(conversation.indexOf("async function runOpenPencilCommand"), conversation.indexOf("async function submit"));
  assert.doesNotMatch(operational, /append-human|append-interpretation|draft-brief|publish-brief/);
  assert.match(panel, /Connect OpenPencil/);
  assert.match(panel, /Check status/);
  assert.match(dashboard, /<OpenPencilCommandPanel \/>/);
});

test("Windows OpenPencil launch resolves the reviewed npm JS entrypoint without cmd.exe", () => {
  const shim = "C:\\Users\\Bryan\\AppData\\Roaming\\npm\\openpencil-mcp-http.cmd";
  const entry = "C:\\Users\\Bryan\\AppData\\Roaming\\npm\\node_modules\\@open-pencil\\mcp\\dist\\index.mjs";
  const found = new Set([shim, entry]);
  const launch = resolveOpenPencilHttpLaunch({
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
  assert.notEqual(launch.executable.toLowerCase(), "cmd.exe");
});

test("explicit connection scopes OpenPencil to the selected workspace and owns only its child", async () => {
  class FakeChild extends EventEmitter {
    exitCode = null;
    signalCode = null;
    killed = false;
    kill() {
      this.killed = true;
      this.signalCode = "SIGTERM";
      this.emit("exit", null, "SIGTERM");
      return true;
    }
  }

  const child = new FakeChild();
  const spawnCalls = [];
  let phase = "before";
  const controller = createOpenPencilMcpController({
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
  assert.equal(connected.endpoint, OPENPENCIL_MCP_ENDPOINT);
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
  const controller = createOpenPencilMcpController({
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

test("an unowned process on the OpenPencil port blocks connection", async () => {
  let spawned = 0;
  const controller = createOpenPencilMcpController({
    platform: "linux",
    env: { PATH: "/usr/local/bin" },
    exists: value => value === "/usr/local/bin/openpencil-mcp-http",
    statPath: async () => ({ isDirectory: () => true }),
    portReady: async () => true,
    wait: async () => {},
    spawnProcess: () => { spawned++; throw new Error("must not spawn"); },
  });
  await assert.rejects(controller.connect({ workspaceRoot: "/tmp/designs" }), /OPENPENCIL_PORT_IN_USE/);
  assert.equal(spawned, 0);
});
