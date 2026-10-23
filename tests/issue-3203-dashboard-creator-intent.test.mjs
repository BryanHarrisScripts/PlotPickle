import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");

async function loadInterpreter() {
  const compiled = await build({
    entryPoints: [path.join(root, "modules/intent/model/read-only-creator-intent.ts")],
    bundle: true, platform: "node", format: "esm", target: "node26",
    write: false, logLevel: "silent",
  });
  return import("data:text/javascript;base64," +
    Buffer.from(compiled.outputFiles[0].text).toString("base64"));
}

test("#3203 creator intent interpretation is deterministic and read-only", async () => {
  const { interpretReadOnlyCreatorIntent } = await loadInterpreter();
  const cases = [
    ["Where am I?", "WHERE_AM_I"],
    [" what should i review next? ", "WHERE_AM_I"],
    ["Continue This Film", "WHERE_AM_I"],
    ["Review film readiness", "REVIEW_FILM"],
    ["review my film's readiness!", "REVIEW_FILM"],
  ];
  for (const [input, kind] of cases) {
    const interpreted = interpretReadOnlyCreatorIntent(input);
    assert.deepEqual(interpreted, {
      version: 1, authority: "READ_ONLY", state: "SUPPORTED", kind,
    });
    assert.equal(Object.isFrozen(interpreted), true);
  }
  for (const input of ["", "approve every shot", "unlock my profile",
    "start generating paid videos", "merge all PRs", "where am i; save",
    null, { prompt: "Where am I?" }, 15]) {
    const interpreted = interpretReadOnlyCreatorIntent(input);
    assert.equal(interpreted.state, "UNSUPPORTED", String(input));
    assert.equal(interpreted.kind, null);
    assert.equal(interpreted.authority, "READ_ONLY");
  }
});

test("#3203 Dashboard uses exactly the existing Library PPF and Reports projection", async () => {
  const [surface, panel, host, model] = await Promise.all([
    read("app/skin-v1/continue-this-film.tsx"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("modules/intent/model/read-only-creator-intent.ts"),
  ]);
  assert.match(panel, /<ContinueThisFilm onOpenLibrary=\{onOpenLibrary\} onOpenOutline=\{onOpenOutline\}/u);
  assert.match(host, /onOpenLibrary=\{\(\) => \{ setLibraryOpen\(true\)/u);
  assert.match(host, /onOpenOutline=\{\(blockNumber\) => openOutline\(\{ blockNumber, miniBlockNumber: 1 \}\)\}/u);
  assert.match(surface, /interpretReadOnlyCreatorIntent\(intentText\)/u);
  assert.match(surface, /profilePrivateBrowserReadyFor\(profileId\)/u);
  assert.match(surface, /sessionActiveProjectId\(\)/u);
  assert.match(surface, /loadLibraryProjectSnapshot\(selectedId\)/u);
  assert.match(surface, /project\.id !== selectedId/u);
  assert.match(surface, /projectRevision: project\.revision/u);
  assert.match(surface, /providerPolicy: "LOCAL_READ_ONLY"/u);
  assert.match(surface, /observeHollywoodProductionReadiness\(\{/u);
  assert.match(surface, /PROJECT_LIBRARY_CHANGED_EVENT, refresh/u);
  assert.match(surface, /Refresh evidence/u);
  assert.match(surface, /status: "NO_PROFILE" \| "NO_PROJECT" \| "PROJECT_UNAVAILABLE"/u);
  assert.match(surface, /No creative approval, Save & Lock/u);
  assert.doesNotMatch(surface, /loadActiveLibraryProject\(|saveActiveLibraryProject\(|switchActiveLibraryProject\(|authenticatedComputeFetch\(|fetch\(|Save & Lock.*onClick/u);
  assert.doesNotMatch(model, /fetch\(|window|localStorage|sessionStorage|writeFile|spawn\(/u);
});

test("#3203 a missing or blocked source never presents observed film readiness", async () => {
  const source = await read("app/skin-v1/continue-this-film.tsx");
  assert.match(source, /const observed = observation\?\.status === "OBSERVED" && result\?\.state === "OBSERVED"/u);
  assert.match(source, /\{observed \? "OBSERVED" : "NOT VERIFIED"\}/u);
  assert.match(source, /status === "BLOCKED" \? `Observation blocked:/u);
  assert.match(source, /\{observed && block !== null \? <button/u);
  assert.match(source, /No project-bound production evidence can be shown/u);
  assert.match(source, /none is certified film-ready/u);
  assert.doesNotMatch(source, /filmReadyVerified: true|independentVerification: true|modelCalled: true|paidGenerationPermitted: true/u);
});
