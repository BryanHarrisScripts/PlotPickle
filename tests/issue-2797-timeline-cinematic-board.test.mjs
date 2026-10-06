import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2797 presents Timeline as one canonical 25-Shot cinematic production board", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /data-timeline-shot-board="25-shot"/u);
  assert.match(workspace, /Production context/u);
  assert.match(workspace, /Shot storyboard & shotlist/u);
  assert.match(workspace, /25 Shots · approximately 3 seconds each · 75 seconds total/u);
  assert.match(workspace, /Array\.from\(\{ length: SHOTS_PER_MINI_BLOCK \}/u);
  assert.match(workspace, /aria-label="25 Shot cinematic production board"/u);
});

test("#2797 integrates Shot selection, story evidence and motion state in each Shot row", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /seekToShot\(placementIndex, shotNumber\)/u);
  assert.match(workspace, /storyboardPositionProgression\(shotNumber\)/u);
  assert.match(workspace, /Synchronized screenplay source/u);
  assert.match(workspace, /Current Mini-Block evidence/u);
  assert.match(workspace, /current\?\.status === "succeeded"[\s\S]*"READY"/u);
  assert.match(workspace, /Retry motion/u);
  assert.match(workspace, /Regenerate motion/u);
  assert.match(workspace, /Generate motion/u);
});

test("#2797 keeps authoritative references and continuity explicit instead of inventing facts", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /Locked visual continuity/u);
  assert.match(workspace, /Not established in authoritative Timeline data/u);
  assert.match(workspace, /Continuity bible/u);
  assert.match(workspace, /Timeline does not invent continuity facts/u);
  assert.match(workspace, /No approved Timeline source/u);
});

test("#2797 preserves compact assembly, export and chronological placement controls", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /Assembly & export/u);
  assert.match(workspace, /Export selected Mini-Block MP4/u);
  assert.match(workspace, /Four Mini-Blocks = one 5-minute Block/u);
  assert.match(workspace, /Chronological Mini-Block assembly/u);
  assert.match(workspace, /Move earlier/u);
  assert.match(workspace, /Move later/u);
  assert.match(workspace, /Update to current Previs source/u);
});

test("#2797 removes the separate dominant motion grid while retaining governed motion behavior", async () => {
  const [workspace, styles] = await Promise.all([
    read("app/_components/timeline/timeline-assembly-workspace.tsx"),
    read("app/_components/timeline/timeline-assembly-workspace.module.css"),
  ]);

  assert.doesNotMatch(workspace, /className=\{styles\.motionGrid\}/u);
  assert.match(workspace, /className=\{styles\.motionCell\}/u);
  assert.match(styles, /\.shotRows/u);
  assert.match(styles, /max-height: 43rem/u);
  assert.match(styles, /\.motionCell\[data-motion-status="stale"\]/u);
});
