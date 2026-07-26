import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #85 defines one canonical primary navigation", async () => {
  const contract = await source("lib/product-direction.ts");
  const expected = ["Dashboard", "Introduction", "Learn", "Plan", "Write", "Storyboard", "Refine", "Reports", "Settings"];
  for (const label of expected) assert.match(contract, new RegExp(`label: "${label.replace(/[&]/g, "\\&")}"`));
  assert.match(contract, /Simple Start/);
  assert.match(contract, /not a required splash screen/);
  assert.match(contract, /Terminology|terminology/);
  assert.match(contract, /Preferences and Setup/);
});

test("issue #85 exposes exactly five selling points and 81 learning modules", async () => {
  const contract = await source("lib/product-direction.ts");
  assert.match(contract, /LEARNING_MODULE_COUNT = 81/);
  for (const title of [
    "Complete screenplay studio",
    "81-module learning system",
    "Visual continuity engine",
    "Local-first ownership with optional AI",
    "Distributed PlotPickle collaboration",
  ]) assert.ok(contract.includes(title), `Missing selling point: ${title}`);
  const ids = [...contract.matchAll(/id: "(complete-studio|learning-system|visual-continuity|local-first|distributed-collaboration)"/g)];
  assert.equal(ids.length, 5);
});

test("issue #85 distinguishes complete PlotPickle servers from collaboration roles", async () => {
  const contract = await source("lib/product-direction.ts");
  assert.match(contract, /Every participant uses the same complete PlotPickle product/);
  assert.match(contract, /Local PlotPickle server/);
  assert.match(contract, /Private web-based PlotPickle server/);
  for (const role of ["Writer", "Director", "Producer", "Actor", "Reviewer"]) assert.ok(contract.includes(`"${role}"`));
  assert.match(contract, /roles within PlotPickle, not separate server editions/);
});

test("issue #85 defines explicit storage and synchronization states", async () => {
  const contract = await source("lib/product-direction.ts");
  for (const label of [
    "Local only",
    "Local project and local images",
    "Connected to GitHub — unpublished changes",
    "Synchronized with GitHub",
    "Remote changes available",
    "Conflict or review required",
    "Backup recommended",
  ]) assert.ok(contract.includes(label), `Missing storage status: ${label}`);
  assert.match(contract, /must not be overwritten automatically/);
  assert.match(contract, /verified repository revision/);
});

test("issue #85 records all completed child issues and the final consistency pass", async () => {
  const contract = await source("lib/product-direction.ts");
  const docs = await source("docs/issue-85-product-direction.md");
  const welcome = await source("app/welcome/page.tsx");
  const readme = await source("README.md");
  for (const issue of [86, 87, 88, 89, 90]) {
    assert.ok(contract.includes(`issue: ${issue}`), `Missing implementation issue #${issue}`);
    assert.ok(docs.includes(`#${issue}`), `Documentation missing issue #${issue}`);
  }
  for (const issue of [86, 87, 88, 89]) assert.match(docs, new RegExp(`#${issue}[^\n]*(complete|merged)`, "i"));
  assert.match(docs, /#90[^\n]*final implementation/i);
  assert.match(docs, /#90 merge completes issue #85/i);
  assert.match(welcome, /FIVE_KEY_SELLING_POINTS\.map/);
  assert.match(readme, /Five reasons to use PlotPickle/);
});
