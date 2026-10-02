import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FFramesLocalMediaEngine, retainFFramesVideo } from "../core/media/fframes-local-media-engine.ts";
import { projectScreeningMediaEvidence } from "../core/media/screening-media-evidence.ts";

test("#2698 media artifacts survive workspace cleanup and invalid output is rejected", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-media-"));
  const workspace = path.join(root, "temporary");
  const persistent = path.join(root, "persistent");
  try {
    await mkdir(workspace);
    await assert.rejects(retainFFramesVideo(workspace, persistent, "missing"), { code: "ENOENT" });
    await writeFile(path.join(workspace, "render.mp4"), "not an mp4 container");
    await assert.rejects(retainFFramesVideo(workspace, persistent, "invalid"), /not an MP4/);
    // Container-shaped bytes exercise retention, not rendering or playable-video proof.
    const bytes = Buffer.from("000000186674797069736f6d0000000069736f6d6d703432", "hex");
    await writeFile(path.join(workspace, "render.mp4"), bytes);
    const retained = await retainFFramesVideo(workspace, persistent, "project:../unsafe-request");
    assert.equal(path.dirname(retained), persistent);
    assert.match(path.basename(retained), /^fframes-[a-f0-9]{24}\.mp4$/);
    await rm(workspace, { recursive: true });
    assert.deepEqual(await readFile(retained), bytes);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("#2698 source bridge without a prepared binary reports optional media unavailable", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-capability-"));
  try {
    const manifest = path.join(root, "tools", "fframes-bridge", "Cargo.toml");
    await mkdir(path.dirname(manifest), { recursive: true });
    await writeFile(manifest, "[package]\nname='plotpickle-fframes-bridge'\n");
    const capability = await new FFramesLocalMediaEngine(root).capabilities();
    assert.equal(capability.state, "unavailable");
    assert.equal(capability.automaticInstall, false);
    assert.match(capability.reason, /not built/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("#2698 Screening refuses success evidence with no playback artifact", () => {
  const evidence = { state: "succeeded", artifacts: { videoPath: "" } };
  const projection = projectScreeningMediaEvidence({ roughCutId: "cut", currentSourceRefs: [], media: { roughCutId: "cut", state: "succeeded", sourceRefs: [], engineEvidence: [evidence] } });
  assert.equal(projection.state, "failed");
  assert.deepEqual(projection.playbackArtifactPaths, []);
});
