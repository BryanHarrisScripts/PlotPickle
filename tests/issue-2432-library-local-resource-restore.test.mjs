import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../modules/library/local-resource-recovery.ts", import.meta.url),
  "utf8",
);

function storyboardPatternFromSource() {
  const match = source.match(/const STORYBOARD_FILE = \/(.*?)\/iu;/u);
  assert.ok(match, "Storyboard recovery filename regex must remain explicit.");
  return new RegExp(match[1], "iu");
}

test("#2432 parses current Storyboard WebP filenames into bounded Block/Mini-Block/position evidence", () => {
  const pattern = storyboardPatternFromSource();
  const valid = pattern.exec("storyboard-afterglow-session-a-1-1-11-1760000000000-1760000001000.webp");
  assert.ok(valid);
  assert.equal(valid[1], "afterglow-session-a");
  assert.equal(Number.parseInt(valid[2], 10), 1);
  assert.equal(Number.parseInt(valid[3], 10), 1);
  assert.equal(Number.parseInt(valid[4], 10), 11);

  assert.match(source, /blockNumber < 1 \|\| blockNumber > 24/u);
  assert.match(source, /miniBlockNumber < 1 \|\| miniBlockNumber > 4/u);
  assert.match(source, /position < 1 \|\| position > 25/u);
  assert.match(source, /asset\.url\.startsWith\("\/api\/local-ai\/assets\/"\)/u);
  assert.match(source, /asset\.mediaType !== "image\/webp"/u);
});

test("#2432 preselects only exact-project resource groups and keeps unmatched legacy groups explicit", () => {
  assert.match(source, /const exactProject = originProjectId\.toLowerCase\(\) === projectId/u);
  assert.match(source, /selectedByDefault: exactProject/u);
  assert.match(source, /Number\(right\.exactProject\) - Number\(left\.exactProject\)/u);
});

test("#2432 restores selected Storyboard resources additively as draft candidates without accepting or overwriting defaults", () => {
  assert.match(source, /existingUrls\.has\(resource\.assetUrl\) \|\| existingIds\.has\(id\)/u);
  assert.match(source, /type: "foundations\.visual\.store"/u);
  assert.match(source, /workflow: "storyboard-frame-webp-v2"/u);
  assert.match(source, /reviewState: "draft"/u);
  assert.match(source, /provider: "local recovery"/u);
  assert.match(source, /storyboard-anchor:block:block-\$\{blockRef\}:mini-\$\{resource\.miniBlockNumber\}/u);
  assert.match(source, /storyboard-position:\$\{resource\.position\}/u);
  assert.doesNotMatch(source, /foundations\.visual\.accept/u);
  assert.doesNotMatch(source, /foundations\.visual\.discard/u);
});

test("#2432 Load Session records the comparison ancestor and refuses last-write-wins semantics", () => {
  assert.match(source, /baseRevision: project\.revision/u);
  assert.match(source, /sourceIdentity: normalizedSourceIdentity\(project\)/u);
  assert.match(source, /currentRevision === baseline\.baseRevision \? "same-base" : "requires-three-way"/u);
});
