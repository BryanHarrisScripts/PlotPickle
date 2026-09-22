import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");

test("#2336 exposes visible local dictation state while preserving the shared voice control", async () => {
  const [control, css, layer] = await Promise.all([
    text("app/_components/voice-input-control.tsx"),
    text("app/_components/voice-input-control.module.css"),
    text("app/_components/universal-voice-input-layer.tsx"),
  ]);

  assert.match(control, /data-voice-state={state}/u);
  assert.match(control, /role="status" aria-live="polite"/u);
  assert.match(control, /REQUESTING_PERMISSION/u);
  assert.match(control, /LISTENING/u);
  assert.match(control, /RUNTIME_UNAVAILABLE/u);
  assert.match(control, /MODEL_UNAVAILABLE/u);
  assert.match(control, /TRANSCRIPTION_FAILED/u);
  assert.match(css, /\.status \{[\s\S]*max-width:[\s\S]*background:[\s\S]*font-size:/u);
  assert.match(css, /\.control\[data-voice-state="IDLE"\] \.status/u);
  assert.match(css, /\.control\[data-voice-state="LISTENING"\] \.button/u);
  assert.match(layer, /<VoiceInputControl/u);
  assert.equal((layer.match(/<VoiceInputControl/gu) ?? []).length, 1);
});

test("#2336 keeps the shared voice control under the canonical experience-skins owner", async () => {
  const ownership = await text("config/verification/ownership-map.json");

  assert.match(ownership, /"id": "universal-voice-input-experience"[\s\S]*"app\/_components\/universal-voice-input-layer\.tsx"[\s\S]*"app\/_components\/voice-input-control\.tsx"[\s\S]*"app\/_components\/voice-input-control\.module\.css"[\s\S]*"ownerLayer": "experience-skins"/u);
});

test("#2336 uses the Quality role for DSDD intent interpretation and surfaces actual model metadata", async () => {
  const dsdd = await text("app/skin-v1/global-dsdd-conversation.tsx");

  assert.match(dsdd, /modelRole: "quality"/u);
  assert.doesNotMatch(dsdd, /modelRole: "fast"/u);
  assert.match(dsdd, /provider\?: string/u);
  assert.match(dsdd, /model\?: string/u);
  assert.match(dsdd, /provider: body\.provider/u);
  assert.match(dsdd, /model: body\.model/u);
  assert.match(dsdd, /Intent model:/u);
  assert.match(dsdd, /This first slice records and interprets intent; it does not edit code/u);
});


test("#2331 keeps DSDD dictation progress inside the panel and shows elapsed work", async () => {
  const [control, css, dsdd] = await Promise.all([
    text("app/_components/voice-input-control.tsx"),
    text("app/_components/voice-input-control.module.css"),
    text("app/skin-v1/global-dsdd-conversation.tsx"),
  ]);

  assert.match(control, /statusPlacement\?: "overlay" \| "inline"/u);
  assert.match(control, /data-voice-placement=\{statusPlacement\}/u);
  assert.match(control, /const \[elapsedSeconds, setElapsedSeconds\]/u);
  assert.match(control, /preflightDsddLocalVoiceReady/u);
  assert.match(control, /ensureDsddLocalVoiceReady\(\(message\)/u);
  assert.match(css, /\.control\[data-voice-placement="inline"\] \.status \{[\s\S]*position: static/u);
  assert.match(css, /\.control\[data-voice-placement="inline"\] \.meter \{[\s\S]*position: static/u);
  assert.match(dsdd, /statusPlacement="inline"/u);
  assert.match(dsdd, /className=\{styles\.voiceControl\}/u);
});

test("#2331 exposes the local STT handoff and avoids rehashing the model for every dictation", async () => {
  const [gateway, runtime] = await Promise.all([
    text("build/voice/local-voice-gateway.ts"),
    text("build/voice/local-voice-runtime.ts"),
  ]);

  assert.match(gateway, /STT setup [.]+"? STARTED/u);
  assert.match(gateway, /Downloading reviewed .* speech model/u);
  assert.match(gateway, /Transcription request [.]+"? RECEIVED/u);
  assert.match(runtime, /verifiedRuntimeFingerprint/u);
  assert.match(runtime, /sameFingerprint/u);
  assert.match(runtime, /STT integrity [.]+"? VERIFYING/u);
  assert.match(runtime, /Transcription [.]+"? STARTED whisper\.cpp/u);
  assert.match(runtime, /Text produced [.]+"? PASS/u);
});
