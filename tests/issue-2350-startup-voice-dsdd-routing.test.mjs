import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const json = async (path) => JSON.parse(await read(path));

test("#2350/#2468 normal and Conversational UAT startup own reviewed whisper.cpp/base.en readiness", async () => {
  const [launcher, manifest, provenance] = await Promise.all([
    read("Start-PlotPickle.bat"),
    json("config/local-voice-input.json"),
    read("runtime/whisper/MODEL-PROVENANCE.md"),
  ]);

  assert.match(launcher, /PLOTPICKLE_STARTUP_TESTING_MODE!"=="normal" set "PLOTPICKLE_PREPARE_LOCAL_DICTATION=1"/u);
  assert.match(launcher, /PLOTPICKLE_STARTUP_TESTING_MODE!"=="conversational-uat" set "PLOTPICKLE_PREPARE_LOCAL_DICTATION=1"/u);
  assert.match(launcher, /if "!PLOTPICKLE_PREPARE_LOCAL_DICTATION!"=="1" \([\s\S]*call :prepare_local_dictation/u);
  assert.match(launcher, /LOCAL_VOICE_INSTALLER=scripts\\install-whisper-cpp\.ps1/u);
  assert.match(launcher, /powershell\.exe .*"%LOCAL_VOICE_INSTALLER%" -Mode Verify/u);
  assert.match(launcher, /powershell\.exe .*"%LOCAL_VOICE_INSTALLER%" -Mode Install -Approved/u);
  assert.ok(launcher.indexOf("call :prepare_local_dictation") < launcher.indexOf("Startup checks complete. PlotPickle can now start."));
  assert.equal(manifest.execution.automaticRuntimeDownload, true);
  assert.match(provenance, /Normal Human startup provisions the pinned model/u);
});

test("#2350/#2468 WebMCP startup does not provision the reviewed speech model", async () => {
  const launcher = await read("Start-PlotPickle.bat");
  assert.doesNotMatch(launcher, /PLOTPICKLE_STARTUP_TESTING_MODE!"=="webmcp" set "PLOTPICKLE_PREPARE_LOCAL_DICTATION=1"/u);
  const preparation = launcher.slice(
    launcher.indexOf('set "PLOTPICKLE_PREPARE_LOCAL_DICTATION=0"'),
    launcher.indexOf('if not exist "%AGENT_SKILLS_CLI%"'),
  );
  assert.match(preparation, /call :prepare_local_dictation/u);
  assert.doesNotMatch(preparation, /=="webmcp" set "PLOTPICKLE_PREPARE_LOCAL_DICTATION=1"/u);
});

test("#2350 microphone never downloads speech dependencies and cannot turn green before readiness", async () => {
  const control = await read("app/_components/voice-input-control.tsx");
  const start = control.indexOf("async function startListening()");
  const stop = control.indexOf("async function stopAndTranscribe()");
  const listening = control.slice(start, stop);

  assert.doesNotMatch(control, /\/api\/local-voice\/setup/u);
  assert.ok(listening.indexOf("await requireLocalVoiceReady()") >= 0);
  assert.ok(listening.indexOf("navigator.mediaDevices.getUserMedia") > listening.indexOf("await requireLocalVoiceReady()"));
  assert.ok(listening.indexOf('setState("LISTENING")') > listening.indexOf("navigator.mediaDevices.getUserMedia"));
});

test("#2350 microphone presentation is red/slashed off and green only while listening", async () => {
  const [control, css] = await Promise.all([
    read("app/_components/voice-input-control.tsx"),
    read("app/_components/voice-input-control.module.css"),
  ]);

  assert.match(control, /className=\{styles\.offSlash\}/u);
  assert.match(css, /\.button \{[\s\S]*color: #ff5f68/u);
  assert.match(css, /\.control\[data-voice-state="LISTENING"\] \.button \{[\s\S]*color: #52ff88/u);
  assert.match(css, /\.control\[data-voice-state="LISTENING"\] \.offSlash \{[\s\S]*opacity: 0/u);
  assert.match(control, /role="meter"/u);
  assert.match(control, /setInputLevel\(Math\.min\(1, peak \* 4\)\)/u);
});

test("#2350 Settings is explicit verify/repair rather than mandatory first-use setup", async () => {
  const [settings, workspace] = await Promise.all([
    read("app/local-voice-settings.tsx"),
    read("app/sage-settings-workspace.tsx"),
  ]);

  assert.match(settings, /Repair local dictation/u);
  assert.match(settings, /Normal Human startup provisions and verifies local dictation once/u);
  assert.doesNotMatch(settings, /Install local dictation/u);
  assert.match(workspace, /Verify or repair startup-managed whisper\.cpp speech-to-text/u);
});

test("#2350 architecture catalog routes DSDD and voice proof away from permanent Layer 1 and Layer 7 lanes", async () => {
  const [catalog, ownership] = await Promise.all([
    json("config/verification/test-catalog.json"),
    json("config/verification/ownership-map.json"),
  ]);

  const byId = new Map(catalog.entries.map((entry) => [entry.id, entry]));
  assert.equal(byId.get("experience.voice-input-contract-2350")?.ownerLayer, "experience-contract");
  assert.equal(byId.get("agent.dsdd-intent-pi-contract-2350")?.ownerLayer, "agent-runtime");
  assert.equal(byId.get("provider.local-voice-runtime-2350")?.ownerLayer, "provider-runtime");
  assert.deepEqual(byId.get("agent.dsdd-intent-pi-contract-2350")?.runner.targets.slice(0, 2), [
    "tests/issue-2331-dsdd-conversational-uat.test.mjs",
    "tests/issue-2338-pi-087-dsdd-session.test.mjs",
  ]);

  const voiceContract = ownership.rules.find((rule) => rule.id === "universal-voice-input-contract");
  const voiceSkin = ownership.rules.find((rule) => rule.id === "universal-voice-input-skin");
  assert.equal(voiceContract?.ownerLayer, "experience-contract");
  assert.equal(voiceSkin?.ownerLayer, "experience-skins");
});

test("#2350 expensive Windows proof keeps Pi integration and local voice independently impact-selected", async () => {
  const [architecture, productGate, prGate] = await Promise.all([
    read(".github/workflows/architecture-shadow.yml"),
    read(".github/workflows/product-gate.yml"),
    read(".github/workflows/pr-gate.yml"),
  ]);

  const scopeStart = architecture.indexOf("  windows-product-scope:");
  const proofStart = architecture.indexOf("  windows-product-proof:", scopeStart);
  const scope = architecture.slice(scopeStart, proofStart);
  assert.match(scope, /pi-087-dsdd-session-evaluation/u);
  assert.match(scope, /install-whisper-cpp/u);
  assert.match(architecture, /voice: \$\{\{ needs\.windows-product-scope\.outputs\.voice == 'true' \}\}/u);
  assert.match(architecture, /pi: \$\{\{ needs\.windows-product-scope\.outputs\.pi == 'true' \}\}/u);

  const piStart = productGate.indexOf("  pi-runtime-windows:");
  const storyStart = productGate.indexOf("  story-architect-windows:", piStart);
  const piLane = productGate.slice(piStart, storyStart);
  const voiceStart = productGate.indexOf("  local-voice-windows:");
  const buildStart = productGate.indexOf("  windows-build-installer:", voiceStart);
  const voiceLane = productGate.slice(voiceStart, buildStart);

  assert.doesNotMatch(piLane, /install-whisper-cpp/u);
  assert.match(voiceLane, /-Mode Smoke -Approved/u);
  assert.doesNotMatch(productGate, /tests\/issue-2338-pi-087-dsdd-session\.test\.mjs/u);
  assert.doesNotMatch(prGate, /Validate DSDD intent-to-evidence and Pi 0\.87 session contracts/u);
});
