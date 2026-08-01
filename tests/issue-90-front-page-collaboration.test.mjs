import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const sellingPoints = [
  "Visual storyworld in one PPF",
  "Story logic you can see",
  "Connected visual development",
  "A clearer case for the movie",
  "Local-first ownership with optional connections",
];

const readmePillars = [
  "Self-learning modules beside the work",
  "A story graph you can see",
  "One open, portable PPF",
  "Visual story logic",
  "Visual writing and visual pitch",
  "Community collaboration without accidental canon changes",
];

test("issue #90 front page uses the official repository and canonical product contract", async () => {
  const welcome = await source("app/welcome/page.tsx");
  assert.match(welcome, /PLOTPICKLE_REPOSITORY_URL/);
  assert.match(welcome, /Official PlotPickle GitHub repository/);
  assert.match(welcome, /FIVE_KEY_SELLING_POINTS\.map/);
  assert.match(welcome, /LEARNING_MODULE_COUNT/);
  assert.match(welcome, /Complete Learning Library/);
  assert.match(welcome, /GitHubMark/);
});

test("issue #90 presents exactly five canonical selling points", async () => {
  const contract = await source("lib/product-direction.ts");
  const welcome = await source("app/welcome/page.tsx");
  for (const title of sellingPoints) assert.ok(contract.includes(title), `Missing selling point: ${title}`);
  const ids = [...contract.matchAll(/id: "(complete-studio|learning-system|visual-continuity|local-first|distributed-collaboration)"/g)];
  assert.equal(ids.length, 5);
  assert.match(welcome, /Five connected advantages, one canonical project/);
  assert.doesNotMatch(welcome, /className=\{styles\.principles\}/);
});

test("issue #90 explains complete local and web installations with role badges", async () => {
  const welcome = await source("app/welcome/page.tsx");
  const diagram = await source("docs/images/plotpickle-multi-server-collaboration.svg");
  for (const phrase of [
    "Every collaborator uses the same complete PlotPickle product",
    "Local PlotPickle",
    "Private web PlotPickle",
    "one person may hold several roles",
    "Local work remains local until explicitly proposed or synchronized",
    "repository owner or maintainer decides what becomes canonical",
  ]) assert.ok(`${welcome}\n${diagram}`.toLowerCase().includes(phrase.toLowerCase()), `Missing collaboration rule: ${phrase}`);
  for (const role of ["Writer", "Director", "Producer", "Actor", "Reviewer"]) assert.ok(`${welcome}\n${diagram}`.includes(role), `Missing role: ${role}`);
  assert.doesNotMatch(diagram, /Writer server|Director server|Producer server|Actor server/);
});

test("issue #85 final consistency keeps the canonical contract and current README product story", async () => {
  const readme = await source("README.md");
  const docs = await source("docs/issue-85-product-direction.md");
  for (const title of readmePillars) assert.ok(readme.includes(title), `README missing product pillar: ${title}`);
  assert.match(readme, /81 guided modules|81-module learning library/);
  assert.match(readme, /complete local or private web-based PlotPickle installations/i);
  assert.match(readme, /Writer, Director, Producer, Actor and Reviewer are roles within PlotPickle/i);
  assert.match(docs, /#86.*complete|#86.*merged/i);
  assert.match(docs, /#87.*complete|#87.*merged/i);
  assert.match(docs, /#88.*complete|#88.*merged/i);
  assert.match(docs, /#89.*complete|#89.*merged/i);
  assert.match(docs, /#90.*final|#90.*complete|#90.*merge/i);
});
