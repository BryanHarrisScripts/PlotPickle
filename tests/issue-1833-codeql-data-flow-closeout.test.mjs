import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { callCdpPageFunction } from "../lib/verification/cdp-page-function.mjs";
import { createCasebookHumanInteractionAdapter } from "../scripts/casebook-evidence.mjs";
import { windowsJavaScriptCliInvocation } from "../scripts/spawn-command.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#1833 carries hostile browser labels as CDP values, never function source", async () => {
  const calls = [];
  const client = {
    async send(method, params) {
      calls.push([method, params]);
      if (method === "Runtime.evaluate") return { result: { objectId: "main-global" } };
      if (method === "Runtime.callFunctionOn") return { result: { value: true } };
      return {};
    },
  };
  const hostileLabel = '"); globalThis.__injected = true; //';
  const fixedFunction = "function (wantedLabel) { return document.title === wantedLabel; }";

  assert.equal(await callCdpPageFunction(client, fixedFunction, [hostileLabel]), true);
  const call = calls.find(([method]) => method === "Runtime.callFunctionOn")[1];
  assert.equal(call.functionDeclaration, fixedFunction);
  assert.equal(call.functionDeclaration.includes(hostileLabel), false);
  assert.deepEqual(call.arguments, [{ value: hostileLabel }]);
  assert.ok(calls.some(([method, params]) => method === "Runtime.releaseObject" && params.objectId === "main-global"));
});

test("#1833 resolves only approved Windows JavaScript wrappers", () => {
  const nodeExecutable = path.join("runtime", "node.exe");
  const npmEntry = path.join("runtime", "node_modules", "npm", "bin", "npm-cli.js");
  const npm = windowsJavaScriptCliInvocation("npm.cmd", ["--version"], {
    nodeExecutable,
    existsSync: (candidate) => candidate === npmEntry,
  });
  assert.deepEqual(npm, { executable: nodeExecutable, args: [npmEntry, "--version"] });

  const vinextWrapper = path.join("project", "node_modules", ".bin", "vinext.cmd");
  const vinextEntry = path.resolve(path.dirname(vinextWrapper), "..", "vinext", "dist", "cli.js");
  const vinext = windowsJavaScriptCliInvocation(vinextWrapper, ["build"], {
    nodeExecutable,
    existsSync: (candidate) => candidate === vinextEntry,
  });
  assert.deepEqual(vinext, { executable: nodeExecutable, args: [vinextEntry, "build"] });
  assert.equal(windowsJavaScriptCliInvocation("unreviewed.cmd", [], { nodeExecutable, existsSync: () => true }), null);
});

test("#1833 routes Casebook focus labels through the structured Creative Browser capability", async () => {
  const calls = [];
  const label = '"); globalThis.__injected = true; //';
  const adapter = createCasebookHumanInteractionAdapter({
    client: { async call(name, args) { calls.push([name, args]); return { content: [] }; } },
    tools: [{ name: "browser_evaluate", inputSchema: { properties: { function: { type: "string" } }, required: ["function"] } }],
    creativeBrowser: {
      clickVisible: async () => true,
      fillByLabel: async () => ({ ok: true }),
      navigate: async () => ({ ok: true }),
      screenshot: async () => ({ ok: true }),
      async focusVisible(value) { calls.push(["focusVisible", value]); return { ok: true, method: "visible keyboard focus" }; },
    },
  });

  assert.equal((await adapter.focusByLabel(label)).ok, true);
  assert.deepEqual(calls, [["focusVisible", label]]);
});

test("#1833 source contracts contain no sanitizer-to-code bridge", async () => {
  const [releaseSmoke, issueSmoke, casebook, spawnCommand] = await Promise.all([
    read("scripts/windows-release-smoke.mjs"),
    read("scripts/windows-issue-208-smoke.mjs"),
    read("scripts/casebook-evidence.mjs"),
    read("scripts/spawn-command.mjs"),
  ]);

  for (const source of [releaseSmoke, issueSmoke]) {
    assert.match(source, /callCdpPageFunction/u);
    assert.doesNotMatch(source, /safeBrowserStringLiteral/u);
  }
  assert.match(casebook, /creativeBrowser\.focusVisible\(String\(label\)\)/u);
  assert.doesNotMatch(casebook, /safeBrowserStringLiteral/u);
  assert.match(spawnCommand, /Unsupported Windows batch wrapper/u);
  assert.doesNotMatch(spawnCommand, /windowsBatchInvocation|spawn\(\s*["']cmd\.exe|PLOTPICKLE_BATCH_/u);
});
