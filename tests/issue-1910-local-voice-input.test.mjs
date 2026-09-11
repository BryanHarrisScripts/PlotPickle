import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as ts from "typescript";

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");
const json = async (path) => JSON.parse(await text(path));

async function voiceContract() {
  const source = await text("lib/voice-input.ts");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#${Date.now()}-${Math.random()}`);
}

test("#1910 pins one reviewed whisper.cpp Windows CPU runtime and immutable base.en model", async () => {
  const manifest = await json("config/local-voice-input.json");
  assert.equal(manifest.provider, "whisper.cpp");
  assert.equal(manifest.platform, "windows-x64-cpu");
  assert.equal(manifest.runtime.releaseTag, "b5130");
  assert.equal(manifest.runtime.sourceCommit, "927cfce34f31707e17f2bff35c349632fb9e2c3a");
  assert.equal(manifest.runtime.assetName, "whisper-bin-x64.zip");
  assert.equal(manifest.runtime.sizeBytes, 8573270);
  assert.equal(manifest.runtime.sha256, "f9ec6c52a2e949b62ab51fa21d0d497958f9e41c3010c157c4e42932d5316f3c");
  assert.equal(manifest.model.id, "base.en");
  assert.equal(manifest.model.revision, "80da2d8bfee42b0e836fc3a9890373e5defc00a6");
  assert.equal(manifest.model.sizeBytes, 147964211);
  assert.equal(manifest.model.sha256, "a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002");
  assert.equal(manifest.capture.sampleRate, 16000);
  assert.equal(manifest.capture.channels, 1);
  assert.equal(manifest.capture.bitsPerSample, 16);
  assert.equal(manifest.capture.maxDurationSeconds, 120);
  assert.equal(manifest.execution.cloudFallback, false);
  assert.equal(manifest.execution.automaticRuntimeDownload, false);
});

test("#1910 dictated text preserves existing content, selection and ordinary field semantics", async () => {
  const voice = await voiceContract();
  assert.deepEqual(voice.insertDictationText("Hello world", "brave new", 5, 5), { value: "Hello brave new world", caret: 15 });
  assert.deepEqual(voice.insertDictationText("Alpha OLD omega", "new", 6, 9), { value: "Alpha new omega", caret: 9 });
  assert.deepEqual(voice.insertDictationText("Keep me", "   ", 0, 0), { value: "Keep me", caret: 0 });
  assert.equal(voice.voiceInputFieldAllowed({ type: "text", descriptor: "Story note" }), true);
  assert.equal(voice.voiceInputFieldAllowed({ type: "search", descriptor: "Search every lesson" }), true);
});

test("#1910 centralized eligibility excludes secrets and specialized controls", async () => {
  const voice = await voiceContract();
  for (const type of ["password", "file", "number", "date", "time", "url", "email", "tel"]) {
    assert.equal(voice.voiceInputFieldAllowed({ type, descriptor: "field" }), false, `${type} must not expose dictation`);
  }
  for (const descriptor of ["OpenAI API key", "private signing key", "repository URL", "server address", "file path", "terminal command", "provider model id", "timecode"]) {
    assert.equal(voice.voiceInputFieldAllowed({ type: "text", descriptor }), false, `${descriptor} must not expose dictation`);
  }
  assert.equal(voice.voiceInputFieldAllowed({ type: "text", descriptor: "Story note", voiceInput: false }), false);
  assert.equal(voice.voiceInputFieldAllowed({ type: "text", descriptor: "Story note", disabled: true }), false);
  assert.equal(voice.voiceInputFieldAllowed({ type: "text", descriptor: "Story note", readOnly: true }), false);
});

test("#1910 one app-shell voice layer uses explicit microphone action and the existing input/onChange path without auto-submit", async () => {
  const [control, layer, layout] = await Promise.all([
    text("app/_components/voice-input-control.tsx"),
    text("app/_components/universal-voice-input-layer.tsx"),
    text("app/layout.tsx"),
  ]);
  assert.match(layout, /<UniversalVoiceInputLayer \/>/u);
  assert.equal((layout.match(/<UniversalVoiceInputLayer \/>/gu) ?? []).length, 1);
  assert.match(control, /navigator\.mediaDevices\.getUserMedia/u);
  assert.match(control, /onClick=\{\(\) => \{ if \(listening\) void stopAndTranscribe\(\); else void startListening\(\); \}\}/u);
  assert.match(control, /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/u);
  assert.match(control, /new Blob\(\[buffer\], \{ type: "audio\/wav" \}\)/u);
  assert.match(control, /fetch\("\/api\/local-voice\/transcribe"/u);
  assert.match(control, /aria-label=\{label\}/u);
  assert.match(control, /"Dictate text"/u);
  assert.match(control, /"Stop dictation"/u);
  assert.match(control, /aria-live="polite"/u);
  assert.doesNotMatch(control, /onSubmit|requestSubmit|\.submit\(/u);
  assert.match(layer, /voiceInputFieldAllowed/u);
  assert.match(layer, /fieldRef\.current = next/u);
  assert.match(layer, /Object\.getOwnPropertyDescriptor\(prototype, "value"\)/u);
  assert.match(layer, /dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/u);
  assert.match(layer, /const field = fieldRef\.current;\s*if \(!field\) return;\s*setNativeFieldValue\(field, next\)/u);
});

test("#1910 native execution is fixed-path, bounded, non-shell, ephemeral and fail-closed", async () => {
  const [runtime, gateway] = await Promise.all([
    text("build/voice/local-voice-runtime.ts"),
    text("build/voice/local-voice-gateway.ts"),
  ]);
  assert.match(runtime, /persistentHome\(\).*"runtime", "voice"/su);
  assert.match(runtime, /spawn\(command, args/u);
  assert.match(runtime, /shell: false/u);
  assert.match(runtime, /windowsHide: true/u);
  assert.match(runtime, /VOICE_AUDIO_BOUNDS/u);
  assert.match(runtime, /maxDurationSeconds/u);
  assert.match(runtime, /randomUUID\(\)/u);
  assert.match(runtime, /finally \{\s*await rm\(runDirectory, \{ recursive: true, force: true \}\);\s*\}/u);
  assert.match(runtime, /executableHash === installed\.executableSha256/u);
  assert.match(runtime, /modelHash === voiceManifest\.model\.sha256/u);
  assert.doesNotMatch(runtime, /openai|gpt-live|heygen|cloud transcription/iu);
  assert.match(gateway, /isLoopback/u);
  assert.match(gateway, /body\.approved !== true/u);
  assert.match(gateway, /let transcriptionActive = false/u);
  assert.match(gateway, /Another local dictation transcription is already active/u);
  assert.match(gateway, /Content-Type.*audio\/wav/su);
});

test("#1910 setup is explicit in Settings and no model/provider selector is introduced", async () => {
  const [settingsWorkspace, settings] = await Promise.all([
    text("app/sage-settings-workspace.tsx"),
    text("app/local-voice-settings.tsx"),
  ]);
  assert.match(settingsWorkspace, /id: "voice", label: "Local Dictation"/u);
  assert.match(settingsWorkspace, /<LocalVoiceSettings \/>/u);
  assert.match(settings, /Install local dictation/u);
  assert.match(settings, /approved: true/u);
  assert.match(settings, /Fallback<\/dt><dd>None/u);
  assert.doesNotMatch(settings, /<select/u);
});

test("#1910 installer verifies exact bytes before activation and Product Gate proves local fixture transcription", async () => {
  const [installer, productGate] = await Promise.all([
    text("scripts/install-whisper-cpp.ps1"),
    text(".github/workflows/product-gate.yml"),
  ]);
  assert.match(installer, /if \(-not \$Approved\).*Explicit approval/su);
  assert.match(installer, /Assert-Hash \$RuntimeArchive \$Config\.runtime\.sha256/u);
  assert.match(installer, /Assert-Hash \$ModelDownload \$Config\.model\.sha256/u);
  assert.match(installer, /sourceArchiveSha256/u);
  assert.match(installer, /executableSha256/u);
  assert.match(installer, /System\.Speech\.Synthesis\.SpeechSynthesizer/u);
  assert.match(installer, /PLOTPICKLE_VOICE_SMOKE_STATUS=passed/u);
  assert.match(productGate, /Validate local whisper\.cpp dictation fixture/u);
  assert.match(productGate, /install-whisper-cpp\.ps1.*-Mode Smoke.*-Approved/u);
});

test("#1910 OSS attribution and model provenance are auditable", async () => {
  const [registry, license, provenance] = await Promise.all([
    json("config/third-party-oss.json"),
    text("runtime/whisper/LICENSE.whisper.cpp.txt"),
    text("runtime/whisper/MODEL-PROVENANCE.md"),
  ]);
  const whisper = registry.systems.find((item) => item.id === "whisper-cpp");
  assert.ok(whisper, "whisper.cpp must be in the canonical OSS registry");
  assert.equal(whisper.license, "MIT");
  assert.equal(whisper.noticePath, "runtime/whisper/LICENSE.whisper.cpp.txt");
  assert.equal(whisper.manifestPath, "config/local-voice-input.json");
  const model = registry.thirdPartyAssets.find((item) => item.id === "whisper-base-en");
  assert.ok(model, "base.en must be registered as a reviewed third-party model asset");
  assert.equal(model.license, "MIT");
  assert.match(license, /MIT License/u);
  assert.match(provenance, /a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002/u);
});

test("#1910 focused regression runs in PR Gate and the local gateway is composed once", async () => {
  const [prGate, gateway, brief] = await Promise.all([
    text(".github/workflows/pr-gate.yml"),
    text("build/local-ai-gateway.ts"),
    text("docs/developer-briefs/1910-local-voice-input.md"),
  ]);
  assert.match(prGate, /Validate universal local voice input/u);
  assert.match(prGate, /tests\/issue-1910-local-voice-input\.test\.mjs/u);
  assert.equal((gateway.match(/registerLocalVoiceGateway\(server\)/gu) ?? []).length, 1);
  for (let item = 1; item <= 12; item += 1) assert.match(brief, new RegExp(`\\n${item}\\.`, "u"));
  assert.match(brief, /No GPT-Live/u);
  assert.match(brief, /No cloud fallback/u);
});
