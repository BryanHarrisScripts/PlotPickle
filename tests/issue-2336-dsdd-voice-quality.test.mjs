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
