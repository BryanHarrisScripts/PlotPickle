import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#1047 release history has one maintained structured source ordered newest first", async () => {
  const history = await readJson("config/release-history.json");
  assert.equal(history.schemaVersion, 1);
  assert.ok(Array.isArray(history.releases));
  assert.ok(history.releases.length >= 3);

  let previousDate = Number.POSITIVE_INFINITY;
  const ids = new Set();
  for (const release of history.releases) {
    assert.equal(typeof release.id, "string");
    assert.ok(release.id.length > 0);
    assert.equal(ids.has(release.id), false, `duplicate release id ${release.id}`);
    ids.add(release.id);
    assert.equal(typeof release.label, "string");
    assert.ok(release.label.trim().length > 0);
    assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(typeof release.title, "string");
    assert.ok(release.title.trim().length > 0);
    assert.equal(typeof release.summary, "string");
    assert.ok(release.summary.trim().length > 0);
    for (const group of ["added", "changed", "fixed"]) {
      assert.ok(Array.isArray(release[group]), `${release.id}.${group} must be an array`);
    }
    const currentDate = Date.parse(`${release.date}T00:00:00Z`);
    assert.ok(Number.isFinite(currentDate));
    assert.ok(currentDate <= previousDate, "release entries must be newest first");
    previousDate = currentDate;
  }
});

test("#1047 What's New UI reads the canonical history and clearly marks the newest release", async () => {
  const [settings, panel] = await Promise.all([
    read("app/sage-settings-workspace.tsx"),
    read("modules/dashboard/ui/release-history/index.tsx"),
  ]);
  assert.match(settings, /ReleaseHistoryPanel/);
  assert.match(panel, /config\/release-history\.json/);
  assert.match(panel, /What&apos;s New/);
  assert.match(panel, /PlotPickle Release History/);
  assert.match(panel, /Latest release/);
  assert.match(panel, /NEWEST/);
  assert.match(panel, /ChangeGroup label="Added"/);
  assert.match(panel, /ChangeGroup label="Changed"/);
  assert.match(panel, /ChangeGroup label="Fixed"/);
  assert.match(panel, /releaseHistory\.releases\.map/);
});

test("#1047 releases are curated user-facing entries rather than build/commit automation", async () => {
  const [source, panel] = await Promise.all([
    read("config/release-history.json"),
    read("modules/dashboard/ui/release-history/index.tsx"),
  ]);
  assert.doesNotMatch(source, /buildTimestamp|Date\.now|git log|every commit|dependency bump/i);
  assert.doesNotMatch(panel, /fetch\(|Date\.now|performance\.now|git log/i);
  assert.match(panel, /Dependency bumps and routine commits are intentionally excluded/);
});
