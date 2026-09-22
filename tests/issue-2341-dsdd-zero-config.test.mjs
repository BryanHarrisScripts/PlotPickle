import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");

test("#2341 DSDD bypasses global provider selection and requests local Quality directly", async () => {
  const [dsdd, gateway] = await Promise.all([
    text("app/skin-v1/global-dsdd-conversation.tsx"),
    text("build/writing-assistant-gateway.ts"),
  ]);

  assert.match(dsdd, /provider: "local"[\s\S]*modelRole: "quality"/u);
  assert.match(gateway, /const explicitLocal = body\.provider === "local"/u);
  assert.match(gateway, /const requestedProvider = explicitLocal \? "local" : store\.activeProvider/u);
  assert.match(gateway, /profileForProvider\(store, requestedProvider, role\)/u);
  assert.doesNotMatch(dsdd, /Select a text engine|Configuration Dashboard|OpenAI|Gemini|MiniMax/u);
});

test("#2341 owned Edge app grants the real default microphone without a settings detour", async () => {
  const launcher = await text("Start-PlotPickle.bat");

  assert.match(launcher, /--auto-accept-camera-and-microphone-capture/u);
  assert.match(launcher, /--user-data-dir='?\+\$env:PLOTPICKLE_BROWSER_PROFILE|--user-data-dir/u);
  assert.match(launcher, /mediaCapture='auto-accept-default-device'/u);
  assert.doesNotMatch(launcher, /--use-fake-device-for-media-stream/u);
});

test("#2341 DSDD microphone activation automatically prepares reviewed local dictation", async () => {
  const [layer, control, voiceContract] = await Promise.all([
    text("app/_components/universal-voice-input-layer.tsx"),
    text("app/_components/voice-input-control.tsx"),
    text("lib/voice-input.ts"),
  ]);

  assert.match(layer, /purpose=\{target\.getAttribute\("data-purpose"\) \|\| "natural-language"\}/u);
  assert.match(control, /natural-language developer uat narration/u);
  assert.match(control, /fetch\("\/api\/local-voice\/setup"/u);
  assert.match(control, /JSON\.stringify\(\{ approved: true \}\)/u);
  assert.match(control, /fetch\("\/api\/local-voice\/status"/u);
  assert.match(control, /PROVISIONING_LOCAL/u);
  assert.match(voiceContract, /"PROVISIONING_LOCAL"/u);
  assert.match(control, /navigator\.mediaDevices\.getUserMedia/u);
});

test("#2341 voice status remains visibly readable inside the self-contained Edge window", async () => {
  const css = await text("app/_components/voice-input-control.module.css");

  assert.match(css, /\.status \{[\s\S]*position: fixed;[\s\S]*right: 16px;[\s\S]*bottom: 16px;[\s\S]*z-index: 2147483647;/u);
  assert.match(css, /data-voice-state="PROVISIONING_LOCAL"/u);
  assert.match(css, /max-width: min\(22rem, calc\(100vw - 2rem\)\)/u);
});

test("#2341 keeps zero-configuration behavior scoped to the DSDD narration field", async () => {
  const [dsdd, control, settings] = await Promise.all([
    text("app/skin-v1/global-dsdd-conversation.tsx"),
    text("app/_components/voice-input-control.tsx"),
    text("app/local-voice-settings.tsx"),
  ]);

  assert.match(dsdd, /data-purpose="natural-language developer uat narration"/u);
  assert.match(control, /purpose\.trim\(\)\.toLowerCase\(\) === "natural-language developer uat narration"/u);
  assert.match(settings, /Install local dictation/u);
  assert.match(settings, /approved: true/u);
  assert.match(control, /No Settings step is required/u);
});
