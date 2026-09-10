import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#1872 makes Cloud and Local Story Mode header/footer chrome solid Skin V1 green", async () => {
  const [cloud, local] = await Promise.all([
    read("app/skin-v1/cloud-story-mode-host.tsx"),
    read("app/skin-v1/local-ai-skin-host.tsx"),
  ]);

  for (const source of [cloud, local]) {
    assert.match(source, /const chromeBoundary: React\.CSSProperties/u);
    assert.match(source, /background: "var\(--pp-skin-accent-deep\)"/u);
    assert.match(source, /backgroundImage: "none"/u);
    assert.ok((source.match(/data-skin-chrome="solid"/gu) || []).length >= 3);
  }
});

test("#1872 extends WebMCP to govern Story Mode chrome and privacy-safe runtime error leakage", async () => {
  const audit = await read("lib/verification/skin-v1-menu-contract-audit.mjs");

  assert.match(audit, /\[data-skin-chrome='solid'\]/u);
  assert.match(audit, /CLOUD_STORY_MODE/u);
  assert.match(audit, /LOCAL_AI/u);
  assert.match(audit, /runtimeErrorLeak/u);
  assert.match(audit, /skin-v1-system-content-contract/u);
  assert.match(audit, /scope\.querySelectorAll\("\[role='status'\], \[role='alert'\]"\)/u);
  assert.doesNotMatch(audit, /querySelectorAll\("p, label, small"\)/u);
  assert.match(audit, /"detected",\s*\n\s*"none"/u);
});

test("#1872 prepares the disposable synthetic profile tree before browser UAT concurrency begins", async () => {
  const auth = await read("scripts/full-verification-auth.mjs");

  assert.match(auth, /const SYNTHETIC_PROFILE_DIRECTORIES = Object\.freeze/u);
  assert.match(auth, /async function prepareSyntheticProfileStorage\(home, profileId\)/u);
  assert.match(auth, /mkdir\(profileRoot, \{ recursive: true, mode: 0o700 \}\)/u);
  assert.match(auth, /SYNTHETIC_PROFILE_DIRECTORIES\.map/u);
  assert.match(auth, /await prepareSyntheticProfileStorage\(home, profileId\);[\s\S]*const signedIn = await profilePost/u);
});
