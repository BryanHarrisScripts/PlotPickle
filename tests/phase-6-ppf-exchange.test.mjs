import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const exchange = await readFile(new URL("../lib/ppf-exchange.ts", import.meta.url), "utf8");
const pdf = await readFile(new URL("../lib/pdf-screenplay-import.ts", import.meta.url), "utf8");
const docs = await readFile(new URL("../docs/PHASE-6-PPF-EXCHANGE.md", import.meta.url), "utf8").catch(() => "");

test("Phase 6 defines ZIP exchange packages and checksums", () => {
  assert.match(exchange, /plotpickle-exchange/);
  assert.match(exchange, /createStoreZip/);
  assert.match(exchange, /readStoreZip/);
  assert.match(exchange, /sha256/);
  assert.match(exchange, /packageKind/);
  assert.match(exchange, /gitIncluded: false/);
  assert.match(exchange, /Unsafe package path|unsafe path/);
});

test("Phase 6 supports selective package kinds", () => {
  for (const kind of ["complete-project", "screenplay", "dialogue", "character", "production-breakdown", "structural-analysis", "reference-only", "template"]) assert.match(exchange, new RegExp(kind));
});

test("PDF screenplay import validates structure and preserves provenance", () => {
  assert.match(pdf, /const sceneHeading/);
  assert.match(pdf, /scene-heading/);
  assert.match(pdf, /parenthetical/);
  assert.match(pdf, /scanned or image-only/);
  assert.match(pdf, /pdf-import/);
  assert.match(pdf, /reviewStatus: "unreviewed"/);
});

test("Phase 6 documentation freezes folder-first exchange boundaries", () => {
  assert.match(docs, /canonical PlotPickle working format remains the open project folder/);
  assert.match(docs, /no automatic canon approval/);
  assert.match(docs, /no automatic OCR/);
  assert.match(docs, /redistribution/);
});
