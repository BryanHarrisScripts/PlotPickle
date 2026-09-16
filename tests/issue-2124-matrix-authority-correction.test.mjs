import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#2124 keeps Dashboard as the sole locked Matrix baseline", async () => {
  const manifest = JSON.parse(await read("tests/visual-baselines/skin-v1/manifest.json"));
  const locked = Object.entries(manifest.surfaces)
    .filter(([, entry]) => entry.status === "locked")
    .map(([id]) => id);

  assert.deepEqual(locked, ["dashboard"]);
  assert.equal(manifest.designReference, "dashboard");
  for (const [id, entry] of Object.entries(manifest.surfaces)) {
    if (id !== "dashboard") assert.equal(entry.status, "candidate", `${id} must remain unlocked/candidate`);
  }
});

test("#2124 preserves the three SVG boards as superseded design studies", async () => {
  const metadata = JSON.parse(await read("docs/experience/matrix-reference/candidates/phase-2-candidate-metadata.json"));

  assert.equal(metadata.status, "superseded-reference");
  assert.equal(metadata.humanApprovalState, "superseded-after-review");
  assert.match(metadata.visualPrecedent, /existing Matrix implementation/u);
  assert.match(metadata.visualPrecedent, /Dashboard as the sole locked baseline/u);
  assert.equal(metadata.boards.length, 3);
  for (const board of metadata.boards) assert.equal(board.approvalState, "superseded-reference");
});

test("#2124 makes real Matrix implementation the visual precedent for Phase 4", async () => {
  const contract = await read("docs/experience/matrix-reference/experience-surface-contract.md");

  assert.match(contract, /Dashboard locked real-app baseline as canonical visual precedent/u);
  assert.match(contract, /other real Matrix screenshots as unlocked\/candidate reference corpus/u);
  assert.match(contract, /three Phase 2 SVG boards are now `superseded-reference`/u);
  assert.match(contract, /do not treat the superseded SVG compositions as layout specifications/u);
  assert.match(contract, /Story Map, Visual Story and Scene Timeline should first enter the verification system as candidate\/unlocked surfaces/u);
});
