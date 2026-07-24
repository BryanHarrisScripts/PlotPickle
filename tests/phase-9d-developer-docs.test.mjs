import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("docs/developer");
const requiredPages = [
  "README.md",
  "getting-started.md",
  "plugin-manifest.md",
  "api-reference.md",
  "permissions-security.md",
  "events-extensions.md",
  "integration-guides.md",
  "testing-compatibility.md",
];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("Phase 9D ships a complete offline documentation bundle", () => {
  for (const page of requiredPages) {
    assert.ok(fs.existsSync(path.join(root, page)), `missing ${page}`);
    assert.ok(read(page).startsWith("# "), `${page} must have a title`);
  }
});

test("developer documentation has no broken relative Markdown links", () => {
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  for (const page of requiredPages) {
    const content = read(page);
    for (const [, href] of content.matchAll(linkPattern)) {
      if (/^(https?:|mailto:|#)/.test(href)) continue;
      const target = href.split("#")[0];
      assert.ok(fs.existsSync(path.resolve(root, path.dirname(page), target)), `${page} -> ${href}`);
    }
  }
});

test("search index covers every developer page", () => {
  const index = JSON.parse(read("search-index.json"));
  assert.equal(index.version, 1);
  const indexed = new Set(index.documents.map((document) => document.path));
  for (const page of requiredPages) assert.ok(indexed.has(page), `${page} missing from search index`);
});

test("API reference documents every public plugin SDK export", () => {
  const source = fs.readFileSync("sdk/plugin/src/index.ts", "utf8");
  const testing = fs.readFileSync("sdk/plugin/src/testing.ts", "utf8");
  const reference = read("api-reference.md");
  const names = new Set();
  for (const match of source.matchAll(/export\s+(?:const|class|function|interface|type)\s+([A-Za-z0-9_]+)/g)) names.add(match[1]);
  for (const match of testing.matchAll(/export\s+(?:const|class|function|interface|type)\s+([A-Za-z0-9_]+)/g)) names.add(match[1]);
  for (const name of names) assert.match(reference, new RegExp(`\\b${name}\\b`), `${name} is undocumented`);
});

test("documentation distinguishes stable preview and internal APIs", () => {
  const portal = read("README.md");
  assert.match(portal, /Stable:/);
  assert.match(portal, /Preview:/);
  assert.match(portal, /Internal:/);
});
