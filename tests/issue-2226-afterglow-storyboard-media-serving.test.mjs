import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("#2226 bundles the four Afterglow Block 17 WebP references consumed by Storyboard and Previs", async () => {
  for (const mini of [1, 2, 3, 4]) {
    const url = new URL(`public/afterglow/storyboard/block-17-mini-${mini}.webp`, root);
    const [bytes, info] = await Promise.all([readFile(url), stat(url)]);
    assert.ok(info.size > 0, `Block 17.${mini} must not be empty`);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
  }
});

test("#2226 storyboard-reference route serves bytes itself instead of redirecting through a second static request", async () => {
  const route = await readFile(new URL("app/api/local-ai/assets/storyboard-reference/route.ts", root), "utf8");
  assert.match(route, /readFile\(asset\.absolutePath\)/u);
  assert.match(route, /new Response\(bytes/u);
  assert.match(route, /image\/webp/u);
  assert.match(route, /image\/svg\+xml/u);
  assert.match(route, /Cache-Control/u);
  assert.match(route, /nosniff/u);
  assert.doesNotMatch(route, /Response\.redirect/u);
  assert.doesNotMatch(route, /fetch\(/u);
});


test("#2226 maps storyboard reference serving to the provider runtime while preserving surface/visual verification", async () => {
  const ownership = JSON.parse(await readFile(new URL("config/verification/ownership-map.json", root), "utf8"));
  const rule = ownership.rules.find((entry) => entry.id === "storyboard-reference-asset-serving");
  assert.ok(rule);
  assert.equal(rule.ownerLayer, "provider-runtime");
  assert.ok(rule.include.includes("app/api/local-ai/assets/storyboard-reference/route.ts"));
  assert.ok(rule.riskTokens.includes("surface"));
  assert.ok(rule.riskTokens.includes("visual"));
});
