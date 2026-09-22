import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { piDraftGrounding } from "../build/dsdd/dsdd-integrity.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#2369 blocks the invented repository path pattern published in #2367", async () => {
  const bad = [
    "# Pi Technical Developer Draft",
    "## Likely files and symbols",
    "- Inspect: `src/config/menus.ts`",
    "- Likely change: `src/tests/config/menus.test.ts`",
  ].join("\n");
  const result = await piDraftGrounding(bad, root);
  assert.equal(result.ok, false);
  assert.ok(result.missingPaths.includes("src/config/menus.ts"));
});

test("#2369 blocks speculative primitive claims instead of presenting them as evidence", async () => {
  const result = await piDraftGrounding(
    "## Existing contracts and primitives to reuse\nIf a function exists such as `updateMenu` or similar functions, use it.",
    root,
  );
  assert.equal(result.ok, false);
  assert.match(result.message, /speculative technical claims/iu);
});

test("#2369 accepts a bounded Pi draft that references real repository evidence", async () => {
  const good = [
    "# Pi Technical Developer Draft",
    "## Architecture ownership",
    "DSDD session and Skin V1 experience boundaries.",
    "## Likely files and symbols",
    "- Inspect: `app/skin-v1/global-dsdd-conversation.tsx`",
    "- Inspect: `build/dsdd/dsdd-session-gateway.ts`",
    "## Unknowns",
    "None found from bounded inspection.",
  ].join("\n");
  const result = await piDraftGrounding(good, root);
  assert.equal(result.ok, true);
});

test("#2369 Pi prompt and server both enforce grounding before Publish Brief", async () => {
  const [draft, gateway] = await Promise.all([
    read("scripts/dsdd-pi-draft.mjs"),
    read("build/dsdd/dsdd-session-gateway.ts"),
  ]);
  assert.match(draft, /Every repository path you place in backticks must exist/u);
  assert.match(draft, /If bounded inspection does not find an evidence-backed file/u);
  assert.match(gateway, /await assertPiDraftGrounding\(draft\.text, process\.cwd\(\)\)/u);
  assert.match(gateway, /await assertPiDraftGrounding\(intent\.developerBrief\.text, process\.cwd\(\)\)/u);
  const publicationValidation = gateway.indexOf("await assertPiDraftGrounding(intent.developerBrief.text, process.cwd());");
  const publishCall = gateway.indexOf("const published = await publishDsddBrief");
  assert.ok(publicationValidation >= 0 && publishCall > publicationValidation);
});
