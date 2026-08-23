import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("..", import.meta.url);
const require = createRequire(import.meta.url);

async function compileDiscovery() {
  const text = await readFile(new URL("build/buzz-desktop-discovery.ts", root), "utf8");
  const compiled = ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const runtimeModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: runtimeModule,
    exports: runtimeModule.exports,
    require,
    process,
    console,
  });
  return runtimeModule.exports;
}

const discovery = await compileDiscovery();

test("#1236 keeps BUZZ Desktop 0.5.3 as the compatibility floor while supporting newer installed sidecars", () => {
  assert.equal(discovery.BUZZ_DESKTOP_COMPATIBILITY.version, "0.5.3");
  assert.equal(discovery.BUZZ_DESKTOP_COMPATIBILITY.minimumVersion, "0.5.3");
  assert.equal(discovery.BUZZ_DESKTOP_COMPATIBILITY.releaseTag, "desktop-v0.5.3");
});

test("#1236 makes the desktop-closed path primary and allows BUZZ Desktop to already be running", () => {
  const policy = discovery.BUZZ_DESKTOP_RUNTIME_POLICY;
  assert.equal(policy.primary, "profile-scoped-cli");
  assert.equal(policy.desktopRequired, false);
  assert.equal(policy.desktopClosed, "supported");
  assert.equal(policy.desktopRunning, "supported");
  assert.equal(policy.desktopSessionSignerBridge, false);
  assert.match(policy.reason, /Human-profile encrypted signer/i);
});

test("#1236 ignores a stale configured CLI path and recovers through the installed BUZZ sidecar", async () => {
  const stale = "C:\\Old\\Buzz\\buzz.exe";
  const installed = "C:\\Users\\Bryan\\AppData\\Local\\Programs\\Buzz\\buzz.exe";
  const result = await discovery.resolveBuzzCliExecutable(stale, {
    platform: "win32",
    env: { LOCALAPPDATA: "C:\\Users\\Bryan\\AppData\\Local" },
    home: "C:\\Users\\Bryan",
    canAccess: async (candidate) => candidate.toLowerCase() === installed.toLowerCase(),
  });

  assert.equal(result.executable, installed);
  assert.equal(result.source, "buzz-desktop");
  assert.equal(result.discovered, true);
});

test("#1236 preserves explicit and environment CLI precedence when those paths are real", async () => {
  const explicit = "D:\\Tools\\buzz.exe";
  const environment = "C:\\Env\\buzz.exe";
  const explicitResult = await discovery.resolveBuzzCliExecutable(explicit, {
    platform: "win32",
    env: { BUZZ_CLI_PATH: environment },
    canAccess: async (candidate) => [explicit, environment].includes(candidate),
  });
  assert.equal(explicitResult.executable, explicit);
  assert.equal(explicitResult.source, "configured");

  const environmentResult = await discovery.resolveBuzzCliExecutable("", {
    platform: "win32",
    env: { BUZZ_CLI_PATH: environment },
    canAccess: async (candidate) => candidate === environment,
  });
  assert.equal(environmentResult.executable, environment);
  assert.equal(environmentResult.source, "environment");
});

test("#1236 never treats the BUZZ Desktop GUI process as the PlotPickle signing executable", async () => {
  const candidates = discovery.buzzDesktopCliCandidates("win32", {
    LOCALAPPDATA: "C:\\Users\\Bryan\\AppData\\Local",
    ProgramFiles: "C:\\Program Files",
  }, "C:\\Users\\Bryan");
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every((candidate) => !candidate.toLowerCase().endsWith("\\buzz-desktop.exe")));

  const gateway = await readFile(new URL("build/buzz-profile-identity-gateway.ts", root), "utf8");
  assert.match(gateway, /BUZZ_PRIVATE_KEY: connection\.privateKey/u);
  assert.match(gateway, /windowsHide: true/u);
  assert.doesNotMatch(gateway, /spawn\([^\n]*buzz-desktop\.exe/u);
});
