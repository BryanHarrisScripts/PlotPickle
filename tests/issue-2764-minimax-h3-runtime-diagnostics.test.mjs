import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2764 keeps provider authority save outside the Sharp/native media import graph", async () => {
  const [route, providerUrl, common] = await Promise.all([
    read("app/api/cloud-story-mode/provider/route.ts"),
    read("build/provider-url.ts"),
    read("build/media-provider-common.ts"),
  ]);

  assert.match(route, /build\/provider-url/u);
  assert.doesNotMatch(route, /media-provider-common/u);
  assert.doesNotMatch(providerUrl, /sharp|media-provider-common/u);
  assert.match(providerUrl, /export function normalizedUrl/u);
  assert.match(common, /export \{ normalizedUrl \} from "\.\/provider-url"/u);
});

test("#2764 preserves bounded timestamped diagnostics and handles non-JSON local errors", async () => {
  const panel = await read("app/skin-v1/cloud-provider-setup-panel.tsx");

  assert.match(panel, /const text = await response\.text\(\)/u);
  assert.match(panel, /PlotPickle expected JSON but the local endpoint returned/u);
  assert.match(panel, /plotpickle:cloud-provider-diagnostics/u);
  assert.match(panel, /sessionStorage\.setItem/u);
  assert.match(panel, /MiniMax accepted H3 job/u);
  assert.match(panel, /MiniMax H3 job/u);
  assert.match(panel, /outputAssetUrl/u);
  assert.match(panel, /Open completed video/u);
  assert.match(panel, /REFRESH STATUS/u);
  assert.doesNotMatch(panel, /const body = await response\.json\(\)/u);
});

test("#2764 uses the cheapest practical standard H3 request without changing models or authorizing a paid test", async () => {
  const [provider, brief] = await Promise.all([
    read("build/cloud-media-provider.ts"),
    read("docs/developer-briefs/2764-minimax-h3-runtime-diagnostics.md"),
  ]);

  assert.match(provider, /Math\.max\(4, Math\.min\(15/u);
  assert.match(provider, /resolution: "768P"/u);
  assert.doesNotMatch(provider, /resolution: "2K"/u);
  assert.match(brief, /does not switch to H3 Max/u);
  assert.match(brief, /No paid MiniMax request is authorized/u);
});
