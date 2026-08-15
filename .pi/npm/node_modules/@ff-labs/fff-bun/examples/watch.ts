#!/usr/bin/env bun
import { FileFinder } from "../src/index";
import type { WatchEvent } from "../src/index";

const KIND = {
  created: "+ created ",
  modified: "~ modified",
  removed: "- removed ",
  rescan: "! rescan  ",
} as const;

const targetDir = process.argv[2] || process.cwd();
const pattern = process.argv[3]; // if omitted watch the entire indexed tree

const created = FileFinder.create({ basePath: targetDir });
if (!created.ok) {
  console.error(`Init failed: ${created.error}`);
  process.exit(1);
}
const finder = created.value;

// Wait for the initial scan + watcher so indexing noise isn't reported.
await finder.waitForScan(30_000);
for (
  let p = finder.getScanProgress();
  !p.ok || !p.value.isWatcherReady;
  p = finder.getScanProgress()
) {
  await Bun.sleep(50);
}

let batch = 0;
const onBatch = (events: WatchEvent[]) => {
  console.log(`\nbatch #${++batch} (${events.length} events)`);
  for (const e of events) console.log(`  ${KIND[e.kind]} ${e.path}`);
};

const sub = pattern ? finder.watch(pattern, onBatch) : finder.watch(onBatch);
if (!sub.ok) {
  console.error(`Watch failed: ${sub.error}`);
  finder.destroy();
  process.exit(1);
}

console.log(
  `Watching ${targetDir} (pattern: ${pattern ?? "whole tree"}), Ctrl-C to stop.`,
);

// A recurring timer keeps the event loop alive so watch batches are delivered.
const keepAlive = setInterval(() => {}, 1000);

process.on("SIGINT", () => {
  clearInterval(keepAlive);
  sub.value();
  finder.destroy();
  process.exit(0);
});
