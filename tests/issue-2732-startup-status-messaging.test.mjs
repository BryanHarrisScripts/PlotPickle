import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LocalSidecarSupervisor } from "../core/sidecars/local-supervisor.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2732 registered sidecars are waiting before startup instead of falsely unavailable", async () => {
  const [contract, supervisorSource] = await Promise.all([
    read("core/sidecars/contract.ts"),
    read("scripts/runtime-sidecar-supervisor.mjs"),
  ]);
  const supervisor = new LocalSidecarSupervisor();
  assert.equal(supervisor.status("dsdd").state, "waiting");
  assert.match(contract, /["waiting", "starting", "ready", "degraded", "unavailable", "failed", "stopped"]/u);
  assert.match(supervisorSource, /registered runtime services are waiting for core readiness/u);
  assert.match(supervisorSource, /service\.state !== "waiting"/u);
  assert.doesNotMatch(
    supervisorSource.slice(
      supervisorSource.indexOf('console.log("[SIDECARS] Runtime supervisor starting'),
      supervisorSource.indexOf("const ready = await waitForCore()"),
    ),
    /unavailable/u,
    "pre-core startup must not print unavailable for not-yet-started services",
  );
});

test("#2732 unavailable is retained for a runtime that is actually unusable", async () => {
  const supervisorSource = await read("scripts/runtime-sidecar-supervisor.mjs");
  const localSupervisor = await read("core/sidecars/local-supervisor.ts");
  assert.match(supervisorSource, /mark\(service\.id, "unavailable"/u);
  assert.match(supervisorSource, /runtime entrypoint not installed yet/u);
  assert.match(localSupervisor, /spec\.enabled === false[\s\S]*?"unavailable"/u);
});

test("#2732 optional media degradation says core and non-renderer workflows remain available", async () => {
  const [media, supervisorSource] = await Promise.all([
    read("scripts/sidecars/media-runtime-service.mjs"),
    read("scripts/runtime-sidecar-supervisor.mjs"),
  ]);
  assert.match(media, /state: capability\.state === "ready" \? "ready" : "degraded"/u);
  assert.match(media, /Optional renderer is not ready/u);
  assert.match(media, /Core PlotPickle, Flip Book, Graphic Novel and WebP remain available/u);
  assert.match(supervisorSource, /Media Runtime: optional renderer not ready; core PlotPickle, Flip Book, Graphic Novel and WebP remain available/u);
});

test("#2732 launcher remains concise while preserving real warnings and clean closeout success", async () => {
  const launcher = await read("Start-PlotPickle.bat");
  assert.match(launcher, /Registered runtime services are waiting for core readiness and will initialize asynchronously after PlotPickle is ready/u);
  assert.match(launcher, /Runtime sidecar supervisor is unavailable\. Core PlotPickle will continue normally/u);
  assert.match(launcher, /PlotPickle saved the current session, stopped its managed services, and closed its owned app window/u);
  assert.match(launcher, /READY WITH WARNINGS/u);
  assert.match(launcher, /\[ERROR\]/u);
});
