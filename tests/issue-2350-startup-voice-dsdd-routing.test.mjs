import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const json = async (path) => JSON.parse(await read(path));

test("#2350 normal Human startup owns reviewed whisper.cpp/base.en readiness", async () => {
  const [launcher, manifest, provenance] = await Promise.all([
    read("Start-PlotPickle.bat"),
    json("config/local-voice-input.json"),
    read("runtime/whisper/MODEL-PROVENANCE.md"),
  ]);

  assert.match(launcher, /if \/I "!PLOTPICKLE_STARTUP_TESTING_MODE!"=="human" \([\s\S]*call :prepare_local_dictation/u);
  assert.match(launcher, /powershell\.exe .*install-whisper-cpp\.ps1.*-Mode Verify/u);
  assert.match(launcher, /powershell\.exe .*install-whisper-cpp\.ps1.*-Mode Install -Approved/u);
  assert.ok(launcher.indexOf("call :prepare_local_dictation") < launcher.indexOf("Startup checks complete. PlotPickle can now start."));
  assert.equal(manifest.execution.automaticRuntimeDownload, true);
  assert.match(provenance, /Normal Human startup provisions the pinned model/u);
});

test("#2350 WebMCP startup does not provision the reviewed speech model", async () => {
  const launcher = await read("Start-PlotPickle.bat");
  const humanBlockStart = launcher.indexOf('if /I "!PLOTPICKLE_STARTUP_TESTING_MODE!"=="human" (');
  const humanBlockEnd = launcher.indexOf('if not exist "%AGENT_SKILLS_CLI%"', humanBlockStart);
  const humanBlock = launcher.slice(humanBlockStart, humanBlockEnd);
  assert.match(humanBlock, /call :prepare_local_dictation/u);
  assert.doesNotMatch(launcher.slice(0, humanBlockStart), /call :prepare_local_dictation/u);
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

test("#2350 expensive Windows proof is split between Pi integration and local voice scope", async () => {
  const [architecture, productGate, prGate] = await Promise.all([
    read(".github/workflows/architecture-shadow.yml"),
    read(".github/workflows/product-gate.yml"),
    read(".github/workflows/pr-gate.yml"),
  ]);

  const piScopeStart = architecture.indexOf("  pi-windows-scope:");
  const piProofStart = architecture.indexOf("  pi-windows-proof:", piScopeStart);
  const voiceScopeStart = architecture.indexOf("  voice-windows-scope:");
  const voiceProofStart = architecture.indexOf("  voice-windows-proof:", voiceScopeStart);
  const piScope = architecture.slice(piScopeStart, piProofStart);
  const voiceScope = architecture.slice(voiceScopeStart, voiceProofStart);
  const voiceProof = architecture.slice(voiceProofStart);
  assert.match(piScope, /pi-087-dsdd-session-evaluation/u);
  assert.doesNotMatch(piScope, /voice-input-control|local-voice|install-whisper/u);
  assert.match(voiceScope, /install-whisper-cpp/u);
  assert.match(voiceProof, /-Mode Smoke -Approved/u);
  assert.doesNotMatch(productGate, /tests\/issue-2338-pi-087-dsdd-session\.test\.mjs/u);
  assert.doesNotMatch(prGate, /Validate DSDD intent-to-evidence and Pi 0\.87 session contracts/u);
});
