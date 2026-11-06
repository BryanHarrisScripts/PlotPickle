import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import { build } from "esbuild";

const directory = "tools/agent-plugins/plotpickle-story-reader";

test("#3411 bundled reader inspects existing PPF with pinned identity and repeatable read-only output", async t => {
  execFileSync(process.execPath, [directory + "/build.mjs"]);
  const compiled = await build({ entryPoints: ["core/storage/library-project.ts"], bundle: true,
    platform: "node", format: "esm", write: false, logLevel: "silent" });
  const { normalizeLibraryProject } = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
  const temporary = await mkdtemp(path.join(os.tmpdir(), "plotpickle-plugin-fixture-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const fixture = normalizeLibraryProject({ id: "plugin_fixture_project", title: "Synthetic project", revision: 9 });
  fixture.sourceEvidence.screenplay = { sourceFileName: "synthetic.fountain", sourceFormat: "fountain",
    importedAt: "2026-11-06T00:00:00.000Z", analysisStatus: "suggested", totalPassageCount: 4,
    storedPassageCount: 3, passagesTruncated: true, passages: [1,2,3].map(n => ({ id: `passage-${n}`,
      type: "action", text: `Synthetic passage ${n}`, blockNumber: 1, miniBlockNumber: 1, sceneNumber: 1, sceneId: null })) };
  fixture.build.foundations.visualArtifacts = [{ id: "synthetic-shot-candidate", assetUrl: "/api/local-ai/assets/synthetic.webp",
    prompt: "Synthetic visual", createdAt: "2026-11-06T00:00:00.000Z", provider: "local", model: "fixture",
    frameNumber: 1, workflow: "storyboard-frame-webp-v2", reviewState: "accepted", sourceDecisionKeys:
      ["storyboard-target:block:block-01", "storyboard-anchor:block:block-01:mini-1", "storyboard-local-save:v1"] }];
  fixture.build.foundations.acceptedVisualArtifactIds = ["synthetic-shot-candidate"];
  const file = path.join(temporary, "synthetic.ppf.json");
  await writeFile(file, JSON.stringify(fixture));
  const before = await readFile(file);
  const hash = createHash("sha256").update(before).digest("hex");
  const script = path.resolve(directory + "/skills/read-plotpickle-project/scripts/inspect-project.mjs");
  const invoke = (operation, extra = []) => spawnSync(process.execPath, [script, "--file", file, "--operation", operation,
    "--project-id", fixture.id, "--revision", "9", "--sha256", hash, ...extra], { encoding: "utf8", cwd: temporary });
  const parsed = (operation, extra) => {
    const run = invoke(operation, extra);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    return JSON.parse(run.stdout);
  };
  assert.equal(parsed("identity").project.sha256, hash);
  const summary = parsed("summary");
  assert.deepEqual(summary.plannedStructure, { acts: 4, sequences: 12, blocks: 24, miniBlocks: 96, shotsPerMiniBlock: 25, totalPlannedShots: 2400 });
  assert.equal(summary.liveVaultReadVerified, false);
  assert.equal(summary.canonMutated, false);
  assert.equal(summary.retainedSourceTruncated, true);
  assert.equal(invoke("summary").stdout, invoke("summary").stdout, "fresh-process repeatability");
  const first = parsed("source", ["--limit", "2"]), last = parsed("source", ["--offset", "2", "--limit", "2"]);
  assert.deepEqual([...first.passages, ...last.passages].map(p => p.id), ["passage-1", "passage-2", "passage-3"]);
  assert.equal(first.nextOffset, 2); assert.equal(last.nextOffset, null);
  const shots = parsed("shots", ["--block", "1", "--mini", "1"]);
  assert.equal(shots.shots.length, 25);
  assert.equal(shots.shots[0].shotStatus, "LOCKED");
  assert.equal(shots.shots[1].shotStatus, "EMPTY");
  assert.equal(shots.mediaBytesVerified, false);
  assert.equal(shots.shots[0].sourceEvidence.shotSpecificMappingVerified, false);
  assert.deepEqual(await readFile(file), before);
  for (const extra of [["--revision", "8"], ["--sha256", "0".repeat(64)], ["--project-id", "other_project"]]) {
    const run = invoke("summary", extra);
    assert.equal(run.status, 1); assert.equal(JSON.parse(run.stdout).state, "BLOCKED");
  }
  assert.equal(invoke("source", ["--limit", "51"]).status, 1);
  assert.equal(invoke("shots", ["--block", "25", "--mini", "1"]).status, 1);
  delete fixture.revision;
  await writeFile(file, JSON.stringify(fixture));
  assert.equal(JSON.parse(invoke("identity").stdout).code, "SAVED_IDENTITY_UNVERIFIABLE");
});

test("#3411 package declares no server, connected app or local executor requirement", async () => {
  const manifest = JSON.parse(await readFile(directory + "/plugin.json", "utf8"));
  assert.equal(manifest.name, "plotpickle-story-reader");
  assert.ok(manifest.extensions["com.openai"].interface.shortDescription.length <= 30);
  assert.equal(manifest.extensions["com.openai"].apps, undefined);
  const skill = await readFile(directory + "/skills/read-plotpickle-project/SKILL.md", "utf8");
  assert.match(skill, /Do not create a Site/);
  assert.match(skill, /request the export again/);
});
