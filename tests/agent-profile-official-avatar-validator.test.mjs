import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("public Agent registry and runtime validator share the canonical official WebP avatar contract", async () => {
  const [publicConfig, profileRuntime] = await Promise.all([
    read("config/agent-profile-extensions/public.json").then(JSON.parse),
    read("lib/agents/agent-profiles.ts"),
  ]);

  const entries = Object.entries(publicConfig.profiles);
  assert.ok(entries.length >= 12, "Expected the public PlotPickle Agent roster to include the official roster");

  for (const [profileId, presentation] of entries) {
    const expectedRef = `/assets/helpers/official/${profileId}.webp`;
    assert.equal(presentation.avatarRef, expectedRef, `${profileId} must use its canonical official avatar`);
    await access(new URL(`public${expectedRef}`, root));
  }

  assert.ok(
    profileRuntime.includes('const PUBLIC_AVATAR_REF = /^\\/assets\\/helpers\\/official\\/[a-z0-9-]+\\.webp$/;'),
    "Runtime validation must accept the same official WebP path used by the public Agent registry",
  );
  assert.ok(!profileRuntime.includes('const PUBLIC_AVATAR_REF = /^\\/assets\\/helpers\\/lore\\/[a-z0-9-]+\\.svg$/;'));
});
