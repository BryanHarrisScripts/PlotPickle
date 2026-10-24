import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  inspectFactoryStorage, validStorageReportArgs, STORAGE_ROOT_IDS, STORAGE_SCAN_MODES,
} from "../scripts/engineering-team/mcp/storage/factory-storage-inventory.mjs";
import {
  handleRpc, MCP_TOOLS, MCP_CONTROL_TOOLS, MCP_CONVERSATION_TOOLS,
  MCP_ENGINEERING_TOOLS, MCP_STORAGE_TOOLS,
} from "../scripts/engineering-team/mcp/factory-readonly-server.mjs";

const MAIN = "a".repeat(40);
const args = { expectedHead: MAIN, rootId: "runtimes", scanMode: "quick" };
const item = (state, code) => ({
  id: "runtimes", state, code, apparentBytes: "42", uniqueFileBytes: "42",
  files: 1, directories: 0, skippedLinks: 0, errors: 0,
  children: [{ name: "safe.txt", apparentBytes: "42", files: 1,
    directories: 0, skippedLinks: 0, errors: 0, privateContents: "NEVER SHOW" }],
  privatePath: "C:/PRIVATE/hidden",
});
const inventory = root => ({ roots: [root], metadataOnly: true,
  cleanupAuthorized: false, bytesAreReclaimable: false, visitedEntries: 1,
  privateToken: "NEVER SHOW" });
const harness = (root, changes = {}) => {
  const observed = [];
  return {
    observed,
    options: { ...args, repoRoot: path.join(os.tmpdir(), "plotpickle-storage-repo"),
      environment: { LOCALAPPDATA: path.join(os.tmpdir(), "plotpickle-storage-home") },
      verifyHead: async () => MAIN,
      scan: async input => { observed.push(input); return inventory(root); },
      capacityCheck: async () => ({ state: "READY", code: "DISK_SPACE_SUFFICIENT",
        freeBytes: 5000000000, requiredBytes: 4294967296, checkedDestinations: 2,
        secret: "NEVER SHOW" }), ...changes },
  };
};

test("#3278 storage selection accepts only fixed roots, modes and an exact SHA", () => {
  assert.deepEqual(STORAGE_ROOT_IDS, ["runtimes", "npm-cache", "engineering-team", "repository-artifacts"]);
  assert.deepEqual(STORAGE_SCAN_MODES, ["quick", "deep", "profile"]);
  assert.equal(validStorageReportArgs(args), true);
  for (const change of [{ rootId: "../../private" }, { rootId: "secret" },
    { scanMode: "unbounded" }, { expectedHead: "not-a-sha" },
    { directory: "C:/private" }, { shell: "Remove-Item" }, { maxDurationMsPerRoot: 999999 },
  ]) assert.equal(validStorageReportArgs({ ...args, ...change }), false);
});

test("#3278 reported states preserve MISSING, BLOCKED and PARTIAL, never claim cleanup", async () => {
  for (const [state, code] of [
    ["COMPLETE", "INVENTORY_COMPLETE"], ["PARTIAL", "TIME_LIMIT_REACHED"],
    ["PARTIAL", "ENTRY_TYPE_UNVERIFIED"], ["MISSING", "ROOT_NOT_PRESENT"],
    ["BLOCKED", "STORAGE_ROOT_UNVERIFIED"],
  ]) {
    const h = harness(item(state, code));
    const report = await inspectFactoryStorage(h.options);
    assert.equal(report.state, state, code);
    assert.equal(report.code, code);
    assert.equal(report.cleanupAuthorized, false);
    assert.equal(report.deletionImplemented, false);
    assert.equal(report.metadataOnly, true);
    assert.equal(report.independentVerification, false);
    assert.equal(report.totalsAreLowerBounds, state !== "COMPLETE");
    assert.equal(h.observed.length, 1);
    assert.equal(h.observed[0].roots.length, 1);
    assert.equal(h.observed[0].maxDurationMsPerRoot, 15000);
    assert.equal(h.observed[0].maxEntriesPerRoot, 35000);
    assert.equal(JSON.stringify(report).includes("NEVER SHOW"), false);
    assert.equal(JSON.stringify(report).includes("C:/PRIVATE"), false);
  }
});

test("#3278 unrecognized scanner state/code combinations fail closed", async () => {
  for (const [state, code] of [
    ["MISSING", "INVENTORY_COMPLETE"], ["COMPLETE", "ROOT_NOT_PRESENT"],
    ["PARTIAL", "STORAGE_ROOT_UNVERIFIED"], ["BROKEN", "ENTRY_LIMIT_REACHED"],
    ["PARTIAL", "UNREVIEWED_NEW_ERROR"],
  ]) {
    const result = await inspectFactoryStorage(harness(item(state, code)).options);
    assert.deepEqual(result, { state: "BLOCKED", code: "STORAGE_SCAN_UNVERIFIED",
      sourceHead: MAIN, rootId: "runtimes", cleanupAuthorized: false });
  }
});

test("#3278 rejects stale source before and after scan without reading owner files", async () => {
  let scans = 0;
  const stale = harness(item("COMPLETE", "INVENTORY_COMPLETE"), {
    verifyHead: async () => "b".repeat(40),
    scan: async () => { scans++; throw Error("should not scan"); },
  });
  assert.equal((await inspectFactoryStorage(stale.options)).code, "EXACT_HEAD_MISMATCH");
  assert.equal(scans, 0);
  let checks = 0;
  const moved = harness(item("COMPLETE", "INVENTORY_COMPLETE"), {
    verifyHead: async () => ++checks === 1 ? MAIN : null,
  });
  assert.equal((await inspectFactoryStorage(moved.options)).code, "EXACT_HEAD_MISMATCH");
  assert.equal((await inspectFactoryStorage({ ...args, rootId: "arbitrary" })).code, "STORAGE_SELECTION_INVALID");
});

test("#3278 authenticated MCP controls storage discovery and rejects arbitrary arguments", async () => {
  assert.equal(MCP_STORAGE_TOOLS.length, 1);
  assert.equal(MCP_STORAGE_TOOLS[0].name, "factory_storage_inventory");
  assert.equal(MCP_STORAGE_TOOLS[0].annotations.readOnlyHint, true);
  const request = (method, name, parameters) => ({
    jsonrpc: "2.0", id: 5, method,
    ...(name ? { params: { name, arguments: parameters } } : {}),
  });
  const noAuth = await handleRpc(request("tools/list"), { controlAuthenticated: false });
  assert.equal(noAuth.result.tools.some(tool => tool.name === "factory_storage_inventory"), false);
  const authenticated = await handleRpc(request("tools/list"), {
    controlAuthenticated: true, engineeringEnabled: false,
  });
  assert.equal(authenticated.result.tools.some(tool => tool.name === "factory_storage_inventory"), true);
  let called = 0;
  const services = { controlAuthenticated: true,
    storageInspect: async () => { called++; return { state: "COMPLETE", code: "INVENTORY_COMPLETE" }; } };
  assert.equal((await handleRpc(request("tools/call", "factory_storage_inventory", {
    ...args, path: "C:/secret",
  }), services)).error.code, -32602);
  assert.equal((await handleRpc(request("tools/call", "factory_storage_inventory", args), {
    ...services, controlAuthenticated: false,
  })).error.code, -32001);
  assert.equal(called, 0);
  const granted = await handleRpc(request("tools/call", "factory_storage_inventory", args), services);
  assert.equal(granted.result.structuredContent.state, "COMPLETE");
  assert.equal(called, 1);
});

test("#3278 repository manifest matches exact named catalogue in both opt-in modes", async () => {
  const catalog = JSON.parse(await readFile("config/mcp/factory-tool-catalog.json", "utf8"));
  const names = list => list.map(tool => tool.name);
  assert.deepEqual(catalog.public, names(MCP_TOOLS));
  assert.deepEqual(catalog.control, names(MCP_CONTROL_TOOLS));
  assert.deepEqual(catalog.conversation, names(MCP_CONVERSATION_TOOLS));
  assert.deepEqual(catalog.storage, names(MCP_STORAGE_TOOLS));
  assert.deepEqual(catalog.engineeringOptIn, names(MCP_ENGINEERING_TOOLS));
  const publicNames = catalog.public;
  const baseline = [...publicNames, ...catalog.control, ...catalog.conversation, ...catalog.storage];
  assert.equal(new Set(baseline).size, 10);
  assert.equal(new Set([...baseline, ...catalog.engineeringOptIn]).size, 11);
  assert.equal(publicNames.length, 4);
});

test("#3278 launcher migration must be guarded, offline, and atomic", async () => {
  const root = "scripts/engineering-team/windows/tunnel/";
  const migration = await readFile(root + "Upgrade-PlotPickleTunnelCatalog.ps1", "utf8");
  const verifier = await readFile(root + "Assert-PlotPickleMcpCatalog.ps1", "utf8");
  assert.match(migration, /\[System\.IO\.File\]::Replace\(\$temp, \$launcher, \$backup/);
  assert.doesNotMatch(migration, /WriteAllText\(\$launcher,/);
  assert.match(migration, /ParseFile\(\$temp/);
  assert.match(migration, /TUNNEL_CATALOG_UPGRADE_UNRECOGNIZED_LAUNCHER/);
  assert.match(verifier, /Compare-Object/);
  assert.match(verifier, /MCP_CATALOG_DUPLICATE_DECLARATION/);
  assert.doesNotMatch(migration + verifier, /Invoke-Expression|DownloadString|Invoke-WebRequest/);
});
