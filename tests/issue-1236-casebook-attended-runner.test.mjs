import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  createAttendedLiveStepDrivers,
  finalizeAttendedLiveProof,
} from "../scripts/casebook-attended-live-drivers.mjs";
import {
  CASEBOOK_ATTENDED_MODE,
  assertAttendedRecordSafe,
  attendedCheckpoint,
  attendedRecordSkeleton,
  buildAttendedOverlayScript,
  buildAttendedPlaywrightServer,
  buildHumanCheckpointOverlayScript,
  scrubAttendedText,
} from "../scripts/casebook-attended-runtime.mjs";
import { loadCasebook } from "../scripts/casebook-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("#1236 attended Casebook removes headless mode but preserves the existing isolated Playwright boundary", async () => {
  const config = JSON.parse(await read("tools/agent-plugins/plotpickle-workflow-tester/mcp.json"));
  const server = buildAttendedPlaywrightServer(config.mcpServers.playwright, {
    pluginRoot: path.join(repoRoot, "tools", "agent-plugins", "plotpickle-workflow-tester"),
    pluginData: path.join(repoRoot, ".artifacts", "casebook-attended-test"),
    browser: "chrome",
  });
  assert.equal(server.command, "node");
  assert.equal(server.args.includes("--headless"), false);
  assert.equal(server.args.includes("--isolated"), true);
  const browserIndex = server.args.indexOf("--browser");
  assert.ok(browserIndex >= 0);
  assert.equal(server.args[browserIndex + 1], "chrome");
  assert.equal(server.env.PLOTPICKLE_CASEBOOK_ATTENDED, "1");
});

test("#1236 attended Casebook declares Human-only checkpoints for credentials and native approval", () => {
  const buzz = attendedCheckpoint("buzz-connect-existing-identity", "enter-existing-key");
  assert.equal(buzz.secretEntry, true);
  assert.equal(buzz.evidencePolicy, "pause-sensitive-capture");
  assert.match(buzz.instruction, /only into PlotPickle/i);
  assert.match(buzz.instruction, /Do not paste it into this terminal/i);

  const profile = attendedCheckpoint("profile-isolation", "unlock-a");
  assert.equal(profile.secretEntry, true);
  assert.match(profile.instruction, /Do not paste credentials into this terminal/i);

  const comfy = attendedCheckpoint("comfyui-local-image-visible", "start-or-connect");
  assert.equal(comfy.secretEntry, false);
  assert.match(comfy.instruction, /Install \/ start local ComfyUI/i);
  assert.match(comfy.instruction, /Windows|ComfyUI Desktop|UAC/);
});

test("#1236 attended overlays show Case and step progress without containing executable controls or secrets", () => {
  const overlay = buildAttendedOverlayScript({
    caseIndex: 2,
    caseCount: 5,
    caseTitle: "Connect Existing BUZZ Identity",
    stepIndex: 2,
    stepCount: 5,
    stepAction: "Enter nsec1thismustnotappear into the private key field",
    state: "human-action",
  });
  assert.match(overlay, /CASEBOOK ATTENDED VERIFICATION/);
  assert.match(overlay, /Case/);
  assert.match(overlay, /Step/);
  assert.doesNotMatch(overlay, /nsec1thismustnotappear/i);
  assert.match(overlay, /\[REDACTED\]/);
  assert.match(overlay, /pointerEvents: 'none'/);

  const checkpoint = buildHumanCheckpointOverlayScript(attendedCheckpoint("buzz-connect-existing-identity", "enter-existing-key"));
  assert.match(checkpoint, /Sensitive capture paused/);
  assert.match(checkpoint, /Enter secrets only in PlotPickle/);
});

test("#1236 attended records stay non-green until independent proof and fault injection are supplied", async () => {
  const casebook = await loadCasebook();
  const definition = casebook.cases.find((item) => item.id === "sage-local-text-usable-response");
  const record = attendedRecordSkeleton(definition);
  assert.equal(record.mode, "real-machine");
  assert.equal(record.attendedMode, CASEBOOK_ATTENDED_MODE);
  assert.equal(record.independentVerification.status, "unverified");
  assert.deepEqual(record.faults, []);
  assertAttendedRecordSafe(record);
});

test("#1236 attended evidence scrubs secrets, local usernames and hidden reasoning", () => {
  const safe = scrubAttendedText("privateKey=nsec1abcdefghijklmnop C:\\Users\\Bryan\\file.txt Bearer abcdefghijklmnop");
  assert.doesNotMatch(safe, /nsec1/i);
  assert.doesNotMatch(safe, /Bryan/);
  assert.doesNotMatch(safe, /abcdefghijklmnop/);

  assert.throws(() => assertAttendedRecordSafe({ caseId: "x", private: "nsec1abcdefghijklmnop" }), /unredacted BUZZ private key/i);
  assert.throws(() => assertAttendedRecordSafe({ reasoning: "private scratchpad" }), /hidden reasoning/i);
});

test("#1236 attended live drivers cover the complete Sage and ComfyUI Human journeys", async () => {
  const browser = {
    clickVisible: async () => false,
    fillByLabel: async () => ({ ok: false, method: "test" }),
  };
  const client = { call: async () => ({ content: [{ type: "text", text: "{}" }] }) };
  const drivers = createAttendedLiveStepDrivers({ browser, client, baseUrl: "http://127.0.0.1:4173", runState: {} });
  for (const key of [
    "sage-local-text-usable-response:ask-normal-question",
    "sage-local-text-usable-response:invoke-selected-provider",
    "sage-local-text-usable-response:render-answer",
    "sage-local-text-usable-response:evaluate-answer",
    "comfyui-local-image-visible:configure-comfyui",
    "comfyui-local-image-visible:start-or-connect",
    "comfyui-local-image-visible:verify-prerequisites",
    "comfyui-local-image-visible:run-test-image",
    "comfyui-local-image-visible:observe-output-asset",
    "comfyui-local-image-visible:render-output",
    "comfyui-local-image-visible:enable-local-route",
  ]) assert.equal(typeof drivers.get(key), "function", `missing attended driver ${key}`);

  const casebook = await loadCasebook();
  const sage = casebook.cases.find((item) => item.id === "sage-local-text-usable-response");
  const proof = { id: "proof", kind: "evaluation", status: "verified", source: "sage-response-evaluator", independent: true, summary: "verified" };
  assert.equal(await finalizeAttendedLiveProof({ caseDefinition: sage, client, baseUrl: "http://127.0.0.1:4173", runState: { sage: { independentProof: proof } } }), proof);
});

test("#1236 Windows attended API probes always use the resolved PlotPickle origin", async () => {
  const source = await read("scripts/casebook-attended-live-drivers.mjs");
  assert.match(source, /const requestUrl = new URL\(pathname, baseUrl\)\.toString\(\)/);
  assert.match(source, /fetch\(\$\{JSON\.stringify\(requestUrl\)\}/);
  assert.match(source, /browserFetchStatus\(\{ client, baseUrl, pathname: "\/api\/ai-routing\/status"/);
  assert.match(source, /browserFetchStatus\(\{ client, baseUrl, pathname: "\/api\/media-routing\/status"/);
});

test("#1236 runner is explicitly interactive, resumes after Human authority, executes bounded fault checks, and does not abort on one broken step", async () => {
  const source = await read("scripts/run-casebook-attended.mjs");
  assert.match(source, /process\.stdin\.isTTY/);
  assert.match(source, /Human authorization checkpoints must never be automated/);
  assert.match(source, /Sensitive evidence capture is paused/);
  assert.match(source, /automated outcome proof is not implemented/);
  assert.match(source, /Secret entry is Human-only and does not become PASS/);
  assert.match(source, /typeof afterHuman === "function"/);
  assert.match(source, /finalizeAttendedLiveProof/);
  assert.match(source, /runPhase3b3Faults/);
  assert.match(source, /record\.faults = await runPhase3b3Faults/);
  assert.match(source, /safeFailureObservation/);
  assert.match(source, /caught a bounded runner error instead of aborting the attended run/i);
  assert.match(source, /Independent Business Case proof raised a bounded runner error/);
  assert.match(source, /Deliberate fault verification raised a bounded runner error/);
  assert.match(source, /One or more required deliberate fault checks are missing or were not detected/);
  assert.match(source, /A case remains non-green if any critical step, independent proof or fault detector is missing/);
  assert.doesNotMatch(source, /Deliberate real-machine fault injection is still required before this attended record can become green/);
  assert.match(source, /import \{ createInterface \} from "node:readline\/promises"/);
  assert.doesNotMatch(source, /const argument\s*=|function argument\s*\(/);
  assert.doesNotMatch(source, /catch\s*\{\s*\}/);
  assert.doesNotMatch(source, /readline.*nsec|question\([^\n]*private key/i);
});

test("#1269 attended Casebook asks the Human to stop or continue after the first critical non-pass", async () => {
  const source = await read("scripts/run-casebook-attended.mjs");
  assert.match(source, /async function operatorCriticalDecision/);
  assert.match(source, /Choose \[C\]ontinue or \[S\]top/);
  assert.match(source, /answer === "c" \|\| answer === "continue"/);
  assert.match(source, /answer === "s" \|\| answer === "stop"/);
  assert.match(source, /observation\.critical !== false && observation\.outcome !== "pass"/);
  assert.match(source, /record\.criticalInteractionsUnreached = Math\.max\(0, caseDefinition\.humanJourney\.length - stepOffset - 1\)/);
  assert.match(source, /remaining dependent journey step\(s\) were not exercised/);
  assert.match(source, /Independent Business Case outcome proof was not run after the Human-controlled critical interruption/);
  assert.match(source, /Deliberate fault checks were not run because the journey stopped at a critical non-pass/);
  assert.match(source, /if \(caseDecision === "stop"\)/);
  assert.match(source, /if \(caseDecision === "continue"\)[\s\S]*await browser\.navigate\(endpointTarget\.baseUrl\)/);
  assert.match(source, /Casebook stopped by Human choice after a critical non-pass/);
  assert.match(source, /await writeFile[\s\S]*if \(caseDecision === "stop"\)/);
  assert.doesNotMatch(source, /\[C\/s\]|\[c\/S\]/);
});