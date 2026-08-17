import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function extractArchivedV10Elements(source) {
  const match = source.match(/const sourceElements: SourceElement\[\] = (\[[\s\S]*?\n\]);\n\nfunction fountainLine/);
  assert.ok(match, "archived v10 sourceElements should remain recoverable");
  return JSON.parse(match[1]);
}

test("Afterglow keeps v9 as the complete canonical baseline", async () => {
  const v9 = await read("data/afterglow-screenplay.ts");
  assert.match(v9, /Afterglow v9 Twitter Rewrite \(2023\) — complete screenplay/);
  assert.match(v9, /blocks: 24/);
  assert.match(v9, /screenplayPages: 80/);
  assert.match(v9, /afterglow-v9-/);
});

test("the exact historical v10 partial rewrite is preserved", async () => {
  const archived = await read("data/afterglow-v10-screenplay-source.txt");
  const elements = extractArchivedV10Elements(archived);
  assert.equal(elements.length, 368);
  assert.equal(Math.max(...elements.map((element) => element.blockNumber)), 8);
  assert.equal(Math.max(...elements.map((element) => element.sceneNumber)), 38);
  assert.deepEqual([...new Set(elements.map((element) => element.blockNumber))], [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("screenplay revisions are portable writer-controlled decisions", async () => {
  const revisions = await read("lib/screenplay-revisions.ts");
  for (const decision of ["pending", "keep-baseline", "replace-with-revision", "merge-selected", "write-new", "discard-revision"]) {
    assert.match(revisions, new RegExp(decision));
  }
  assert.match(revisions, /beforeText/);
  assert.match(revisions, /proposedText/);
  assert.match(revisions, /acceptedText/);
  assert.match(revisions, /decisionNote/);
  assert.match(revisions, /decidedAt/);
  assert.match(revisions, /SCREENPLAY_REVISIONS_EXTENSION_KEY/);
});

test("Afterglow reference PPF carries complete v9 plus partial v10 without treating untouched Blocks as deletions", async () => {
  const reference = await read("lib/afterglow-reference-ppf.ts");
  assert.match(reference, /Afterglow\.ppf/);
  assert.match(reference, /Afterglow v9 — Complete 2023 Baseline/);
  assert.match(reference, /Afterglow v10 — Unfinished Blocks 1–8 Rewrite/);
  assert.match(reference, /Array\.from\(\{ length: 8 \}/);
  assert.match(reference, /Array\.from\(\{ length: 16 \}, \(_, index\) => index \+ 9\)/);
  assert.match(reference, /must never be interpreted as deletions/);
  assert.match(reference, /kind: "complete-project"/);
  assert.match(reference, /rightsConfirmed: true/);
});

test("PPF project extensions preserve the revision workspace on export and import", async () => {
  const [folder, exchange] = await Promise.all([
    read("lib/project-folder.ts"),
    read("lib/ppf-exchange.ts"),
  ]);
  assert.match(folder, /projectExtensions: project\.extensions \?\? \{\}/);
  assert.match(folder, /extensions: manifestExtensions\.projectExtensions/);
  assert.match(exchange, /createProjectFolder\(project/);
  assert.match(exchange, /parseProjectFolder\(files\)/);
  assert.match(exchange, /gitIncluded: false/);
});

test("the reference PPF is available as a deterministic download endpoint", async () => {
  const route = await read("app/api/afterglow/reference-ppf/route.ts");
  assert.match(route, /createAfterglowReferencePpf/);
  assert.match(route, /application\/vnd\.plotpickle\.ppf\+zip/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /no-store/);
});
