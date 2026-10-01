import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2623 locked profile gate exposes Shut Down PlotPickle on startup, chooser and login", async () => {
  const source = await read("app/profile-access/profile-access-boundary.tsx");

  assert.match(source, /function LockedNodeShutdown\(\)/u);
  assert.match(source, />\s*Shut Down PlotPickle\s*<\/button>/u);
  assert.match(source, /screen === "login"[\s\S]*<LockedNodeShutdown \/>/u);
  assert.match(source, /screen === "server-unavailable"[\s\S]*<LockedNodeShutdown \/>/u);
  assert.match(source, /aria-busy=\{screen === "loading"\}[\s\S]*<LockedNodeShutdown \/>/u);
  assert.match(source, /screen === "create"[\s\S]*!status\?\.authenticated \? <LockedNodeShutdown \/>/u);
  assert.doesNotMatch(source, /screen === "guest"[\s\S]{0,1200}<LockedNodeShutdown \/>/u);
  assert.doesNotMatch(source, /screen === "recovery"[\s\S]{0,1600}<LockedNodeShutdown \/>/u);
});

test("#2623 locked shutdown confirms intent and fails closed if a Human session exists", async () => {
  const source = await read("app/profile-access/profile-access-boundary.tsx");
  const start = source.indexOf("function LockedNodeShutdown()");
  const end = source.indexOf("async function profileRequest", start);
  const shutdown = source.slice(start, end);

  assert.match(shutdown, /role="dialog"/u);
  assert.match(shutdown, /Shut down this PlotPickle Node\?/u);
  assert.match(shutdown, /This does not shut down or restart Windows/u);
  assert.match(shutdown, /fetch\("\/api\/auth\/profile", \{ credentials: "same-origin", cache: "no-store" \}\)/u);
  assert.match(shutdown, /if \(profileStatus\.authenticated\)[\s\S]*use the Dashboard Shut Down action so current work can be saved first/u);

  const profileCheck = shutdown.indexOf('fetch("/api/auth/profile"');
  const begin = shutdown.indexOf('lockedNodeAction("begin-shutdown")');
  const complete = shutdown.indexOf('lockedNodeAction("complete-shutdown"');
  assert.ok(profileCheck >= 0 && profileCheck < begin);
  assert.ok(begin < complete);
});

test("#2623 reuses canonical local Node-control authority and does not add a second backend", async () => {
  const [boundary, gateway] = await Promise.all([
    read("app/profile-access/profile-access-boundary.tsx"),
    read("build/node-topology-gateway.ts"),
  ]);

  assert.match(boundary, /"X-PlotPickle-Node-Control": "confirmed"/u);
  assert.match(boundary, /fetch\("\/api\/system\/node-control"/u);
  assert.match(gateway, /const NODE_CONTROL_PATH = "\/api\/system\/node-control"/u);
  assert.match(gateway, /if \(!isLocalNodeRequest\(request\)\)/u);
  assert.match(gateway, /request\.headers\[NODE_CONTROL_HEADER\] !== "confirmed"/u);
  assert.doesNotMatch(boundary, /process\.exit|server\.close|Stop-Process|taskkill/iu);
});

test("#2623 authenticated Dashboard shutdown remains the save-first authority", async () => {
  for (const path of [
    "app/skin-v1/node-shutdown-panel.tsx",
    "app/plotpickle-workspace-shell.tsx",
  ]) {
    const source = await read(path);
    const profileAt = source.indexOf('fetch("/api/auth/profile"');
    const saveAt = source.indexOf("persistActiveProfileProject(currentProfile.csrfToken)", profileAt);
    const flushAt = source.indexOf("flushProfilePrivateWrites()", saveAt);
    const logoutAt = source.indexOf("logoutHumanProfile(currentProfile.csrfToken)", flushAt);
    const completeAt = source.indexOf('nodeAction("complete-shutdown"', logoutAt);
    assert.ok(profileAt >= 0 && profileAt < saveAt, `${path}: profile proof must precede save`);
    assert.ok(saveAt < flushAt, `${path}: save must precede flush`);
    assert.ok(flushAt < logoutAt, `${path}: flush must precede logout`);
    assert.ok(logoutAt < completeAt, `${path}: logout must precede Node teardown`);
  }
});

test("#2623 locked shutdown has an explicit danger treatment without changing the login-card hierarchy", async () => {
  const css = await read("app/profile-access/profile-access-boundary.module.css");
  assert.match(css, /\.lockedShutdown \{/u);
  assert.match(css, /\.shutdownButton \{/u);
  assert.match(css, /border: 1px solid var\(--pp-danger\)/u);
  assert.match(css, /\.shutdownConfirm \{/u);
});
