import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#2352 Node runtime accepts a legacy BOM-prefixed installed.json without weakening validation", async () => {
  const runtime = await read("build/voice/local-voice-runtime.ts");

  assert.match(runtime, /source\.replace\(\/\^\\uFEFF\/u, ""\)/u);
  assert.match(runtime, /installed\.provider === "whisper\.cpp"/u);
  assert.match(runtime, /installed\.sourceArchiveSha256 === voiceManifest\.runtime\.sha256/u);
  assert.match(runtime, /installed\.modelSha256 === voiceManifest\.model\.sha256/u);
  assert.match(runtime, /executableHash === installed\.executableSha256/u);
  assert.match(runtime, /modelHash === voiceManifest\.model\.sha256/u);

  const legacy = "\uFEFF{\"provider\":\"whisper.cpp\"}";
  assert.deepEqual(JSON.parse(legacy.replace(/^\uFEFF/u, "")), { provider: "whisper.cpp" });
});

test("#2352 PowerShell installer writes new installed.json as BOM-free UTF-8", async () => {
  const installer = await read("scripts/install-whisper-cpp.ps1");

  assert.match(installer, /System\.Text\.UTF8Encoding\(\$false\)/u);
  assert.match(installer, /\[IO\.File\]::WriteAllText\(\$Path, \$Content, \$encoding\)/u);
  assert.match(installer, /Write-Utf8NoBom \$InstalledPath \$installedJson/u);
  assert.match(installer, /Assert-Utf8NoBom \$InstalledPath/u);
  assert.match(installer, /0xEF[\s\S]*0xBB[\s\S]*0xBF/u);
  assert.doesNotMatch(installer, /Set-Content -LiteralPath \$InstalledPath -Encoding UTF8/u);
});

test("#2352 local voice installer stays owned by Layer 6 Provider Runtime", async () => {
  const ownership = JSON.parse(await read("config/verification/ownership-map.json"));
  const rule = ownership.rules.find((entry) => entry.id === "local-voice-provider-runtime");
  assert.equal(rule?.ownerLayer, "provider-runtime");
  assert.ok(rule?.include.includes("scripts/install-whisper-cpp.ps1"));
});

test("#2352 focused regression is selected by the local voice provider contract", async () => {
  const catalog = JSON.parse(await read("config/verification/test-catalog.json"));
  const entry = catalog.entries.find((item) => item.id === "provider.local-voice-runtime-2350");
  assert.equal(entry?.ownerLayer, "provider-runtime");
  assert.ok(entry?.runner.targets.includes("tests/issue-2352-local-voice-manifest-bom.test.mjs"));
});
