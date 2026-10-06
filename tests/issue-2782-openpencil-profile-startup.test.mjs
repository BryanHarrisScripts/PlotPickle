import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  OPENPENCIL_MCP_VERSION,
  resolveOpenPencilHttpLaunch,
} from "../build/openpencil/openpencil-mcp-runtime.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2782 OpenPencil API receives canonical authenticated Human profile scope", async () => {
  const context = await read("build/auth/profile-request-context.ts");
  const gateway = await read("build/openpencil/openpencil-mcp-gateway.ts");

  assert.match(context, /PROFILE_SCOPED_API_PREFIXES[\s\S]*"\/api\/openpencil"/u);
  assert.match(gateway, /currentProfileRequestContext\(\)/u);
  assert.match(gateway, /Unlock the local PlotPickle profile before using OpenPencil/u);
  assert.match(gateway, /acceptsDsddLoopbackRequest\(request, OPENPENCIL_MCP_API\)/u);
});

test("#2782 PlotPickle-managed OpenPencil entrypoint wins before global npm fallback", () => {
  assert.equal(OPENPENCIL_MCP_VERSION, "0.15.1");
  const managed = "C:\\Users\\Bryan\\AppData\\Local\\PlotPickle\\tools\\openpencil\\node_modules\\@open-pencil\\mcp\\dist\\index.mjs";
  const globalShim = "C:\\Users\\Bryan\\AppData\\Roaming\\npm\\openpencil-mcp-http.cmd";
  const globalEntry = "C:\\Users\\Bryan\\AppData\\Roaming\\npm\\node_modules\\@open-pencil\\mcp\\dist\\index.mjs";
  const found = new Set([managed, globalShim, globalEntry]);

  const launch = resolveOpenPencilHttpLaunch({
    platform: "win32",
    env: {
      LOCALAPPDATA: "C:\\Users\\Bryan\\AppData\\Local",
      PATH: "C:\\Users\\Bryan\\AppData\\Roaming\\npm",
    },
    repositoryRoot: "C:\\Users\\Bryan\\PlotPickle",
    nodeExecutable: "C:\\Program Files\\nodejs\\node.exe",
    exists: value => found.has(value),
  });

  assert.deepEqual(launch, {
    executable: "C:\\Program Files\\nodejs\\node.exe",
    args: [managed],
    source: "plotpickle-managed",
  });
});

test("#2782 deferred startup preparation is pinned, user-writable, and never launches the MCP server", async () => {
  const [setup, deferred, launcher] = await Promise.all([
    read("scripts/ensure-openpencil-mcp.ps1"),
    read("scripts/windows-companion-maintenance-after-ready.ps1"),
    read("Start-PlotPickle.bat"),
  ]);

  assert.match(setup, /\[string\]\$Version = "0\.15\.1"/u);
  assert.match(setup, /LOCALAPPDATA/u);
  assert.match(setup, /PlotPickle\\tools\\openpencil/u);
  assert.match(setup, /@open-pencil\/mcp@\$Version/u);
  assert.match(setup, /designs\\openpencil/u);
  assert.match(setup, /OpenPencil is not launched or connected during startup/u);
  assert.doesNotMatch(setup, /openpencil-mcp-http/u);
  assert.doesNotMatch(setup, /Start-Process -FilePath \$desktop/u);

  const readyGate = deferred.indexOf("if (-not $ready)");
  const setupInvocation = deferred.indexOf("& $OpenPencilSetup");
  assert.ok(readyGate >= 0 && setupInvocation > readyGate, "OpenPencil preparation must run only after core readiness");
  assert.match(deferred, /Core PlotPickle remains available/u);
  assert.match(launcher, /OpenPencil MCP, CLI and desktop GUI are prepared after readiness but never launched until you explicitly connect or open a named surface from PlotPickle/u);
});

test("#2782 repository design workspace is tracked and prefilled in Settings", async () => {
  const [panel, adapter, designReadme] = await Promise.all([
    read("app/_components/settings/openpencil-command-panel.tsx"),
    read("config/openpencil-adapter.json").then(JSON.parse),
    read("designs/openpencil/README.md"),
  ]);

  assert.match(panel, /recommendedWorkspace\?: string/u);
  assert.match(panel, /body\.status\?\.recommendedWorkspace/u);
  assert.match(panel, /repository-owned designs\\openpencil folder/u);
  assert.equal(adapter.workspaceScope.default, "<repo>\\designs\\openpencil");
  assert.equal(adapter.workspaceScope.repositoryTracked, true);
  assert.match(designReadme, /canonical repository-owned OpenPencil design workspace/u);
  assert.match(designReadme, /does not automatically commit or merge/u);
});

test("#2782 managed preparation stays outside normal PlotPickle dependency graph and explicit connection remains required", async () => {
  const [pkg, adapter, architecture] = await Promise.all([
    read("package.json").then(JSON.parse),
    read("config/openpencil-adapter.json").then(JSON.parse),
    read("docs/architecture/OPENPENCIL-DESIGN-BRIDGE.md"),
  ]);
  const dependencies = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  assert.equal(Object.keys(dependencies).some(name => name.startsWith("@open-pencil/")), false);
  assert.equal(adapter.managedPackage.version, "0.15.1");
  assert.equal(adapter.managedPackage.installTiming, "after-core-ready");
  assert.equal(adapter.managedPackage.launchesServer, false);
  assert.equal(adapter.mcp.explicitConnectRequired, true);
  assert.equal(adapter.launchOnPlotPickleStartup, false);
  assert.match(architecture, /Core PlotPickle reaches ready state first/u);
  assert.match(architecture, /Human explicitly selects \*\*Connect OpenPencil\*\*/u);
});
