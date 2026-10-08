import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2817 Storyboard Save writes against the latest persisted project", async () => {
  const source = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  assert.match(source, /const current = loadFoundationProject\(\)/u);
  assert.match(source, /current\.build\.foundations\.visualArtifacts\.find/u);
  assert.match(source, /STORYBOARD_LOCAL_SAVE_MARKER/u);
  assert.match(source, /applyStoryCommand\(current/u);
  assert.match(source, /await saveFoundationProjectDurably\(next, current\.revision\)/u);
});

test("#2817 Previs narration sends the authenticated Human CSRF proof", async () => {
  const source = await read("app/_components/previs/previs-readiness-workspace.tsx");
  assert.match(source, /fetch\("\/api\/auth\/profile"/u);
  assert.match(source, /profileStatus\.csrfToken/u);
  assert.match(source, /"X-PlotPickle-CSRF": profileStatus\.csrfToken/u);
  assert.match(source, /credentials: "same-origin"/u);
});

test("#2817 narration API distinguishes expired mutation proof from sign-in", async () => {
  const source = await read("app/api/previs/narration/route.ts");
  assert.match(source, /code === "CSRF_REJECTED"/u);
  assert.match(source, /session proof is missing or expired/u);
  assert.match(source, /Sign in to authorize narration generation/u);
});

test("#2817 media profile normalization preserves legacy authority instead of dropping it", async () => {
  const source = await read("build/media-routing-store.ts");
  assert.match(source, /function normalizeProfile/u);
  assert.match(source, /videoVerifiedAt: typeof item\.videoVerifiedAt === "string" \? item\.videoVerifiedAt : ""/u);
  assert.match(source, /const minimax = normalizeProfile\(item\.profiles\?\.minimax, "minimax"\)/u);
});

test("#2817 successful MiniMax H3 verification persists verification without changing the selected route", async () => {
  const source = await read("build/media-routing-gateway.ts");
  const query = source.slice(source.indexOf("async function queryVideo"), source.indexOf("async function handleApi"));
  assert.match(query, /profile\.videoVerifiedAt = now/u);
  assert.doesNotMatch(query, /store\.videoRoute\s*=/u);
  assert.match(query, /await writeMediaRoutingStore\(store\)/u);
});
