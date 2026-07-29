import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const gateway = await readFile(new URL("../build/native-git-gateway.ts", import.meta.url), "utf8");
const workspace = await readFile(new URL("../app/git/native-git-workspace.tsx", import.meta.url), "utf8");
const vite = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");

test("Phase 5 exposes terminal-free native Git operations", () => {
  for (const route of ["/status", "/history", "/branches", "/revision", "/branch", "/proposal", "/switch", "/remote", "/pull", "/publish", "/conflicts", "/resolve"]) {
    assert.match(gateway, new RegExp(route.replace("/", "\\/")));
  }
  assert.match(gateway, /execFile/);
  assert.doesNotMatch(gateway, /exec\s*\(/);
  assert.match(gateway, /--ff-only/);
  assert.match(gateway, /--set-upstream/);
});

test("native Git is local-only and constrained to project folders", () => {
  assert.match(gateway, /isLoopback/);
  assert.match(gateway, /projects-v2/);
  assert.match(gateway, /safeKey/);
  assert.match(gateway, /safeBranch/);
  assert.match(gateway, /file\.includes\("\.\.\/"\)/);
});

test("Phase 5 UI presents the planned story-oriented commands", () => {
  for (const label of ["Save Revision", "Revision History", "Story Branches", "Story Proposal", "Pull Latest", "Publish Changes", "Resolve Conflict"]) {
    assert.match(workspace, new RegExp(label));
  }
  assert.match(workspace, /Keep Current/);
  assert.match(workspace, /Accept Incoming/);
  assert.match(workspace, /Mark Resolved/);
});

test("native Git gateway is mounted with canonical folder storage", () => {
  assert.match(vite, /nativeGitGateway/);
  assert.ok(vite.indexOf("folderProjectGateway()") < vite.indexOf("nativeGitGateway()"));
  assert.ok(vite.indexOf("nativeGitGateway()") < vite.indexOf("localProjectGateway()"));
});
