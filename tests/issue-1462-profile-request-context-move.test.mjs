import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1462 moves the shared Human profile request context into build/auth", async () => {
  await assert.rejects(access(new URL("build/profile-request-context.ts", root)));
  await access(new URL("build/auth/profile-request-context.ts", root));
  const context = await source("build/auth/profile-request-context.ts");
  assert.match(context, /from "\.\.\/\.\.\/core\/auth\/plotpickle-auth"/);
  assert.match(context, /from "\.\.\/\.\.\/core\/storage\/profile-private\/profile-private-storage"/);
  assert.match(context, /from "\.\.\/\.\.\/core\/auth\/profile-experience\/profile-experience-runtime"/);
});

test("#1462 preserves the Human session, CSRF and private-storage authority boundary", async () => {
  const context = await source("build/auth/profile-request-context.ts");
  assert.match(context, /new AsyncLocalStorage<ProfileRequestContext>/);
  assert.match(context, /"\/api\/local-buzz"/);
  assert.match(context, /"\/api\/story-workflow\/buzz-bridge"/);
  assert.match(context, /"\/api\/story-decisions"/);
  assert.match(context, /authorizeRequest\(sessionRequest\(request, origin\)\)/);
  assert.match(context, /runtime\.auth\.getAuthStatus\(authContext\)\.profile\?\.profileId/);
  assert.match(context, /privateStorage: runtime\.privateStorage/);
  assert.match(context, /code === "CSRF_REJECTED"/);
  assert.match(context, /Cache-Control", "no-store"/);
  assert.match(context, /X-Content-Type-Options", "nosniff"/);
});

test("#1462 retargets every runtime importer to the canonical auth-owned context", async () => {
  const expectations = new Map([
    ["build/buzz-story-room-access-gateway.ts", '"./auth/profile-request-context"'],
    ["build/buzz-story-room-directory-gateway.ts", '"./auth/profile-request-context"'],
    ["build/buzz-story-room-identity-gateway.ts", '"./auth/profile-request-context"'],
    ["build/buzz-story-room-listing-gateway.ts", '"./auth/profile-request-context"'],
    ["build/local-credentials.ts", '"./auth/profile-request-context"'],
    ["build/story-workflow-buzz-bridge-gateway.ts", '"./auth/profile-request-context"'],
    ["build/buzz/buzz-profile-migration-gateway.ts", '"../auth/profile-request-context"'],
    ["build/story-decisions/gateway.ts", '"../auth/profile-request-context"'],
    ["vite.config.ts", '"./build/auth/profile-request-context"'],
  ]);
  for (const [path, expected] of expectations) {
    const value = await source(path);
    assert.ok(value.includes(expected), `${path} must import the canonical auth request context`);
  }
});

test("#1462 retargets hardcoded workflow and regression paths with no compatibility shim", async () => {
  for (const path of [
    ".github/workflows/buzz-profile-agent-scope.yml",
    ".github/workflows/profile-experience.yml",
    ".github/workflows/story-bridge.yml",
    "tests/buzz-profile-csrf-browser.test.mjs",
    "tests/issue-1144-buzz-profile-agent-scope.test.mjs",
    "tests/issue-1144-buzz-profile-migration-contract.test.mjs",
    "tests/issue-1418-story-decisions.test.mjs",
    "tests/issue-1422-buzz-story-bridge-session-diagnostics.test.mjs",
  ]) {
    const value = await source(path);
    assert.match(value, /build\/auth\/profile-request-context\.ts/);
    assert.doesNotMatch(value, /build\/profile-request-context\.ts/);
  }
});
