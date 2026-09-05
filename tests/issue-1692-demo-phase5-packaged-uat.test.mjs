import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getDemoAccessMode } from "../core/demo-onboarding/demo-access-mode.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1692 Phase 5 packaged DEMO UAT script parses and drives the real first-run controls", async () => {
  const scriptPath = fileURLToPath(new URL("../scripts/windows-installer/demo-onboarding-smoke.mjs", import.meta.url));
  const syntax = spawnSync(process.execPath, ["--check", scriptPath], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

  const source = await read("scripts/windows-installer/demo-onboarding-smoke.mjs");
  for (const contract of [
    /data-demo-onboarding=\\?"fresh-desktop/u,
    /data-demo-entry-action=\\?"demo/u,
    /data-demo-decision/u,
    /data-demo-action=\\?"reset/u,
    /data-demo-action=\\?"exit/u,
    /data-demo-action=\\?"make-this-mine/u,
    /establishVerificationSyntheticHuman/u,
    /Network\.setCookie/u,
    /\/api\/auth\/profile-private/u,
    /data-demo-entry-action=\\?"demo-returning/u,
    /Network\.deleteCookies/u,
  ]) assert.match(source, contract);

  assert.match(source, /serializedImported\.includes\("demo:"\)/u);
  assert.match(source, /anonymousPrivate\.status === 200/u);
  assert.match(source, /afterSnapshot !== privateSnapshot/u);
  assert.doesNotMatch(source, /providerCredentials|BUZZ_AUTH|connectorScopes|ppf\.canon\.write|agent\.grant-authority/u);
});

test("#1692 Phase 5 DEMO story cold path preserves access-mode semantics without hydrating private profile runtime", async () => {
  assert.equal(getDemoAccessMode({}), "desktop-loopback");
  assert.equal(getDemoAccessMode({ PLOTPICKLE_ACCESS_MODE: "server-network" }), "desktop-loopback");
  assert.equal(getDemoAccessMode({
    PLOTPICKLE_ACCESS_MODE: "server-network",
    PLOTPICKLE_BIND_HOST: "0.0.0.0",
    PLOTPICKLE_EXTERNAL_ORIGIN: "https://plotpickle.example",
    PLOTPICKLE_SERVER_NETWORK_ENABLED: "true",
  }), "server-network");

  const route = await read("app/api/demo/story/route.ts");
  assert.match(route, /getDemoAccessMode/u);
  assert.match(route, /runtimeState\.accessMode === "desktop-loopback"/u);
  assert.doesNotMatch(route, /getProfileExperienceRuntime|profile-private-storage|plotpickle-auth/u);
});

test("#1692 Phase 5 stable UI selectors describe behavior without exposing private authority", async () => {
  const [experience, onboarding] = await Promise.all([
    read("app/profile-access/demo/demo-experience.tsx"),
    read("app/profile-access/demo/demo-onboarding-boundary.tsx"),
  ]);

  assert.match(experience, /data-demo-story-status=\{completed \? "completed" : "playing"\}/u);
  assert.match(experience, /data-demo-turns=\{world\.evidence\.turns\}/u);
  assert.match(experience, /data-demo-decision=\{decision\.id\}/u);
  for (const action of ["make-this-mine", "reset", "enter-plotpickle", "exit"]) {
    assert.ok(experience.includes(`data-demo-action="${action}"`), `Missing stable DEMO action selector ${action}`);
  }
  assert.match(onboarding, /data-demo-entry-action="demo"/u);
  assert.match(onboarding, /data-demo-entry-action="enter-plotpickle"/u);
  assert.match(onboarding, /data-demo-entry-action="demo-returning"/u);
  assert.match(onboarding, /data-demo-handoff-state=\{handoffState\}/u);
});

test("#1692 Phase 5 Windows installer compiles the real setup and runs both generic and DEMO packaged interaction proofs", async () => {
  const workflow = await read(".github/workflows/windows-installer.yml");

  assert.match(workflow, /Build PlotPickleSetup\.exe/u);
  assert.match(workflow, /windows-interaction-smoke\.mjs releases\/stage\/PlotPickle-Windows/u);
  assert.match(workflow, /demo-onboarding-smoke\.mjs releases\/stage\/PlotPickle-Windows/u);
  assert.match(workflow, /smoke\.ps1 -SetupPath releases\/windows-installer\/PlotPickleSetup\.exe/u);
  assert.match(workflow, /releases\/windows-installer\/PlotPickleSetup\.exe/u);
  assert.match(workflow, /reports\/windows-installer-demo-onboarding/u);
});
