import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

for (const path of [
  "app/skin-v1/node-shutdown-panel.tsx",
  "app/plotpickle-workspace-shell.tsx",
]) {
  test(`#2510 ${path} obtains the authenticated CSRF proof before its shutdown save`, async () => {
    const source = await read(path);
    const profileAt = source.indexOf('fetch("/api/auth/profile"');
    const saveAt = source.indexOf("persistActiveProfileProject(currentProfile.csrfToken)", profileAt);
    const flushAt = source.indexOf("flushProfilePrivateWrites()", saveAt);
    const logoutAt = source.indexOf("logoutHumanProfile(currentProfile.csrfToken)", flushAt);
    const releaseAt = source.indexOf("clearProfilePrivateBrowser()", logoutAt);
    const shutdownAt = source.indexOf('nodeAction("complete-shutdown"', releaseAt);
    assert.ok(profileAt >= 0, "profile status must be read");
    assert.match(source.slice(profileAt, saveAt), /!currentProfile\.authenticated \|\| !currentProfile\.csrfToken/u);
    assert.ok(profileAt < saveAt, "authenticated profile proof must precede save");
    assert.ok(saveAt < flushAt, "save must precede write flush");
    assert.ok(flushAt < logoutAt, "writes must flush before logout");
    assert.ok(logoutAt < releaseAt, "server session must be released before browser authority");
    assert.ok(releaseAt < shutdownAt, "profile teardown must precede Node teardown");
    assert.doesNotMatch(source.slice(profileAt, shutdownAt), /persistActiveProfileProject\(\);/u);
  });
}

test("#2510 blocked profile state is actionable and does not silently discard work", async () => {
  const panel = await read("app/skin-v1/node-shutdown-panel.tsx");
  assert.match(panel, /Shutdown could not verify the active Human Profile for saving/u);
  assert.match(panel, /Your work was not discarded/u);
  assert.match(panel, /unlock the profile, then try Shut Down again/u);
  assert.match(panel, /nodeAction\("block-shutdown", \{ shutdownToken, message \}\)/u);
});

test("#2510 preserves launcher-owned shutdown and avoids unrelated process termination", async () => {
  const [gateway, launcher] = await Promise.all([
    read("build/node-topology-gateway.ts"),
    read("Start-PlotPickle.bat"),
  ]);
  assert.match(gateway, /resetProfileExperienceRuntime\(\)/u);
  assert.match(gateway, /stopManagedLlama\(\)/u);
  assert.match(gateway, /signalOwnedLauncher\(identity\)/u);
  assert.match(gateway, /server\.close\(\)/u);
  assert.match(gateway, /process\.exit\(0\)/u);
  assert.match(launcher, /PLOTPICKLE_SHUTDOWN_SIGNAL/u);
  assert.match(launcher, /Stop-Process -Id \$browser\.Id/u);
  assert.doesNotMatch(gateway + launcher, /taskkill|killall|pkill/iu);
});


test("#2510 root workspace shutdown owner is mapped in architecture verification", async () => {
  const ownership = JSON.parse(await read("config/verification/ownership-map.json"));
  const rule = ownership.rules.find((candidate) => candidate.id === "root-workspace-shell-experience");
  assert.ok(rule, "root workspace shell must have explicit production ownership");
  assert.equal(rule.ownerLayer, "experience-contract");
  assert.ok(rule.include.includes("app/plotpickle-workspace-shell.tsx"));
});
