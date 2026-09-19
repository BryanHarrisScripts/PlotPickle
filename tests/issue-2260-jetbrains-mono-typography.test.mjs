import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const text = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await text(path));

test("#2260 self-hosts pinned JetBrains Mono behind canonical typography tokens", async () => {
  const [css, layout, grammar, manifest] = await Promise.all([
    text("app/skin-v1-definition.css"),
    text("app/layout.tsx"),
    json("config/skin-v1-surface-grammar.json"),
    json("public/fonts/jetbrains-mono/manifest.json"),
  ]);

  assert.match(css, /font-family:\s*"JetBrains Mono"/);
  assert.match(css, /JetBrainsMono-Regular\.woff2/);
  assert.match(css, /JetBrainsMono-SemiBold\.woff2/);
  assert.match(css, /JetBrainsMono-Bold\.woff2/);
  assert.match(
    css,
    /--pp-skin-font-ui:\s*"JetBrains Mono",\s*"Courier New",\s*"Lucida Console",\s*"Liberation Mono",\s*Consolas,\s*monospace;/,
  );
  assert.match(css, /font-variant-ligatures:\s*none/);
  assert.match(css, /font-feature-settings:\s*"liga" 0,\s*"calt" 0/);
  assert.match(layout, /JetBrains Mono/);

  assert.equal(grammar.typographyProfiles["standard-ui"].canonicalFamily, "JetBrains Mono");
  assert.equal(grammar.typographyProfiles["standard-ui"].ligatures, "none");
  assert.equal(
    grammar.typographyProfiles["standard-ui"].selfHostedAssetManifest,
    "public/fonts/jetbrains-mono/manifest.json",
  );
  assert.equal(manifest.version, "2.304");
  assert.equal(manifest.sourceRevision, "cd5227bd1f61dff3bbd6c814ceaf7ffd95e947d9");
});

test("#2260 bundled font bytes match reviewed SHA-256 provenance", async () => {
  const manifest = await json("public/fonts/jetbrains-mono/manifest.json");
  assert.equal(manifest.files.length, 3);

  for (const entry of manifest.files) {
    const bytes = await readFile(new URL(`../${entry.path}`, import.meta.url));
    assert.equal(bytes.length, entry.bytes, `${entry.path} byte size drifted`);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      entry.sha256,
      `${entry.path} SHA-256 drifted`,
    );
  }
});

test("#2260 retains OFL notice and registers the bundled font without a remote runtime dependency", async () => {
  const [license, registry, ownership, css] = await Promise.all([
    text("public/fonts/jetbrains-mono/OFL.txt"),
    json("config/third-party-oss.json"),
    json("config/verification/ownership-map.json"),
    text("app/skin-v1-definition.css"),
  ]);

  assert.match(license, /Copyright 2020 The JetBrains Mono Project Authors/);
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);

  const font = registry.systems.find((entry) => entry.id === "jetbrains-mono");
  assert.ok(font, "JetBrains Mono must be registered");
  assert.equal(font.usage, "bundled");
  assert.equal(font.version, "2.304");
  assert.equal(font.license, "OFL-1.1");
  assert.equal(font.noticePath, "public/fonts/jetbrains-mono/OFL.txt");
  assert.equal(font.manifestPath, "public/fonts/jetbrains-mono/manifest.json");

  const assetOwner = ownership.rules.find((entry) => entry.id === "skin-v1-bundled-font-assets");
  assert.ok(assetOwner, "bundled font assets need fail-closed verification ownership");
  assert.ok(assetOwner.include.includes("public/fonts/jetbrains-mono/**"));
  assert.doesNotMatch(css, /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net/i);
  assert.match(css, /url\("\/fonts\/jetbrains-mono\//);
});

test("#2260 keeps the prior Dashboard baseline as Human-controlled evidence", async () => {
  const baselines = await json("tests/visual-baselines/skin-v1/manifest.json");
  assert.equal(baselines.surfaces.dashboard.status, "candidate");
  assert.equal(
    baselines.surfaces.dashboard.baseline,
    "tests/visual-baselines/skin-v1/00-dashboard.png",
    "the previously approved Dashboard PNG stays in place until a Human locks a replacement",
  );
});
