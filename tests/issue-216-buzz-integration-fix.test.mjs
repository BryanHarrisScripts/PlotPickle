import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

function canonicalTrustBytes(path, sourceText) {
  const canonical = /\.(?:ya?ml|md|txt)$/i.test(path)
    ? sourceText.replace(/\r\n?/g, "\n")
    : sourceText;
  return Buffer.from(canonical, "utf8");
}

test("issue #216 makes Buzz hydration deterministic", async () => {
  const [panel, route] = await Promise.all([source("app/buzz-collab-panel.tsx"), source("app/buzz/page.tsx")]);
  assert.match(panel, /useState\(false\)/);
  assert.match(panel, /setMounted\(true\)/);
  assert.match(panel, /if \(!mounted\) return/);
  assert.match(panel, /window\.localStorage\.setItem\(PROJECT_STORAGE_KEY/);
  assert.match(route, /window\.sessionStorage\.setItem\(COLLAB_SECTION_KEY, "buzz"\)/);
});

test("issue #216 canonicalizes Windows text line endings without rewriting tracked files", async () => {
  const [normalizer, gateway, vite, attributes] = await Promise.all([
    source("build/buzz-bundle-normalizer.ts"),
    source("build/buzz-gateway.ts"),
    source("vite.config.ts"),
    source(".gitattributes"),
  ]);
  assert.match(normalizer, /canonicalBuzzText/);
  assert.match(normalizer, /canonicalBuzzBytes/);
  assert.match(normalizer, /replace\(\/\\r\\n\?\/g, "\\n"\)/);
  assert.doesNotMatch(normalizer, /writeFile|configureServer|configurePreviewServer/);
  assert.match(vite, /buzzBundleNormalizer\(\),\s*buzzGateway\(\)/);
  assert.match(gateway, /file\.byteLength === item\.bytes && sha256\(file\) === item\.sha256/);
  assert.match(attributes, /runtime\/buzz\/compose\.yml text eol=lf/);
  assert.match(attributes, /runtime\/buzz\/README\.md text eol=lf/);
  assert.match(attributes, /runtime\/buzz\/LICENSE\.buzz\.txt text eol=lf/);
});

test("issue #216 packages and validates the complete Buzz trust bundle", async () => {
  const packager = await source("scripts/package-platform.mjs");
  assert.match(packager, /"runtime"/);
  assert.match(packager, /verifyPackagedBuzzBundle/);
  assert.match(packager, /Packaged Buzz trust file is missing/);
  assert.match(packager, /Packaged Buzz trust file failed verification/);
});

test("issue #216 locks every trust-file fingerprint to the committed manifest", async () => {
  const manifest = JSON.parse(await source("runtime/buzz/manifest.json"));
  assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0);
  for (const item of manifest.files) {
    const bytes = canonicalTrustBytes(item.path, await source(`runtime/buzz/${item.path}`));
    const digest = createHash("sha256").update(bytes).digest("hex");
    assert.equal(bytes.byteLength, item.bytes, `${item.path} byte length is stale`);
    assert.equal(digest, item.sha256, `${item.path} checksum is stale`);
  }
});

test("issue #216 consolidates Buzz under Collab and Repository & Collab settings", async () => {
  const [direction, header, collab, settings, compatibility] = await Promise.all([
    source("lib/product-direction.ts"),
    source("app/application-shell-header.tsx"),
    source("app/collab-workspace.tsx"),
    source("app/github-collaboration.tsx"),
    source("app/buzz/page.tsx"),
  ]);
  assert.doesNotMatch(direction, /id: "buzz", label: "Buzz"/);
  assert.doesNotMatch(header, /Buzz Setup|id === "buzz"/);
  assert.match(collab, /id: "buzz", label: "Buzz"/);
  assert.match(collab, /<BuzzCollabPanel/);
  assert.match(settings, /surface === "configuration" \? <BuzzSettingsPanel \/>/);
  assert.match(compatibility, /workspace=collab/);
});
