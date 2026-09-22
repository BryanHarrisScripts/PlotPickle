import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2331 mounts one persistent DSDD conversation inside the authenticated PlotPickle shell", async () => {
  const [layout, panel] = await Promise.all([
    read("app/layout.tsx"),
    read("app/skin-v1/global-dsdd-conversation.tsx"),
  ]);

  assert.match(layout, /import GlobalDsddConversation from "\.\/skin-v1\/global-dsdd-conversation"/u);
  assert.equal((layout.match(/<GlobalDsddConversation \/>/gu) ?? []).length, 1);
  assert.match(
    layout,
    /<ProfileAccessRouter[\s\S]*<GlobalSageOverlay \/>[\s\S]*<GlobalDsddConversation \/>[\s\S]*<\/ProfileAccessRouter>/u,
  );
  assert.match(panel, /data-dsdd-conversational-uat="true"/u);
  assert.match(panel, /Conversational UAT/u);
});

test("#2331 keeps DSDD local/private and hidden from LOGON/public surfaces", async () => {
  const panel = await read("app/skin-v1/global-dsdd-conversation.tsx");

  assert.match(panel, /function loopbackHost\(\)/u);
  assert.match(panel, /isPublicWebPath\(pathname\)/u);
  assert.match(panel, /data-experience-surface="LOGON"/u);
  assert.match(panel, /setEligible\(!logonVisible && next\.surfaceId !== "LOGON"\)/u);
  assert.match(panel, /if \(!eligible\) return null/u);
});

test("#2331 grounds each narration in current route and governed surface context", async () => {
  const panel = await read("app/skin-v1/global-dsdd-conversation.tsx");

  assert.match(panel, /data-skin-v1-orchestrator-active="true"/u);
  assert.match(panel, /data-skin-v1-surface-id/u);
  assert.match(panel, /data-experience-surface/u);
  assert.match(panel, /route: pathname/u);
  assert.match(panel, /surfaceId:/u);
  assert.match(panel, /surfaceLabel/u);
  assert.match(panel, /context: snapshot/u);
  assert.match(panel, /CURRENT PLOTPICKLE CONTEXT/u);
});

test("#2331 keeps interpretation non-mutating and makes the Human handoff actions explicit", async () => {
  const panel = await read("app/skin-v1/global-dsdd-conversation.tsx");

  assert.match(panel, /fetch\("\/api\/local-ai\/generate\/text"/u);
  assert.match(panel, /"X-PlotPickle-DSDD-Scope": "intent"/u);
  assert.match(panel, /data-purpose="natural-language developer uat narration"/u);
  // #2357 replaced the prose toolbar and Clear Draft with numbered steps.
  assert.match(panel, /"UNDERSTAND INTENT"/u);
  assert.match(panel, /Step 02 Pi Draft locks it and adds repository-aware technical guidance without changing code/u);
  assert.match(panel, /Publishing the approved developer brief as a GitHub Issue/u);
  assert.match(panel, /"PI DRAFT"/u);
  assert.match(panel, /"PUBLISH BRIEF"/u);
  assert.match(panel, /"INTERPRET"/u);
  assert.doesNotMatch(panel, /Build this|action: "build"|Clear draft|function clearDraft/u);
});

test("#2331 preserves the live conversation across navigation in the persistent authenticated shell", async () => {
  const [layout, panel] = await Promise.all([
    read("app/layout.tsx"),
    read("app/skin-v1/global-dsdd-conversation.tsx"),
  ]);

  assert.match(layout, /<GlobalDsddConversation \/>/u);
  assert.match(panel, /const \[messages, setMessages\] = useState<DsddMessage\[\]>\(\[\]\)/u);
  assert.match(panel, /MutationObserver/u);
  assert.match(panel, /usePathname/u);
  assert.doesNotMatch(panel, /sessionStorage|localStorage/u);
});


test("#2331 DSDD local intent generation is isolated from Story Mode locality policy", async () => {
  const gateway = await read("build/story-mode-policy-gateway.ts");

  assert.match(gateway, /pathname === "\/api\/local-ai\/generate\/text"/u);
  assert.match(gateway, /request\.headers\["x-plotpickle-dsdd-scope"\] === "intent"/u);
  assert.match(gateway, /next\(\);\s*return;\s*\}\s*const policy = await readStoryModePolicy\(\)/u);
});


test("#2331 persists semantic provenance and locks a versioned handoff packet before Pi Draft", async () => {
  const [panel, gateway] = await Promise.all([
    read("app/skin-v1/global-dsdd-conversation.tsx"),
    read("build/dsdd/dsdd-session-gateway.ts"),
  ]);
  assert.match(panel, /authenticatedProfileFetch\("\/api\/dsdd\/session"/u);
  assert.match(panel, /action: "append-human"/u);
  assert.match(panel, /action: "append-interpretation"/u);
  assert.match(panel, /action: "lock-intent"/u);
  assert.match(panel, /action: "draft-brief"/u);
  assert.match(panel, /action: "publish-brief"/u);
  assert.match(gateway, /domain: "memory"/u);
  assert.match(gateway, /version = \(session\.intents\.at\(-1\)\?\.version \|\| 0\) \+ 1/u);
  assert.match(gateway, /status: "UNPROVEN"/u);
  assert.match(gateway, /mutationAuthority: "none-dsdd"/u);
  assert.match(gateway, /publicationAuthority: "human-publish-brief"/u);
  assert.match(gateway, /mergeAuthority: "github-exact-head-green-only"/u);
});

test("#2331 maps requirement evidence to PASS FAIL or UNPROVEN without rewriting locked meaning", async () => {
  const gateway = await read("build/dsdd/dsdd-session-gateway.ts");
  assert.match(gateway, /status !== "PASS" && status !== "FAIL" && status !== "UNPROVEN"/u);
  assert.match(gateway, /const intent = session\.intents\.find/u);
  assert.match(gateway, /The referenced locked DSDD intent version does not exist/u);
  assert.doesNotMatch(gateway, /intent\.understoodMeaning\s*=/u);
});


test("#2331 dogfood record preserves the full intent-to-evidence chain without overstating live proof", async () => {
  const record = JSON.parse(await read("config/dsdd/dogfood-2331-story-mode-isolation.json"));
  assert.equal(record.issue, 2331);
  assert.match(record.humanStatement, /no local\/cloud configuration/u);
  assert.match(record.understoodMeaning, /must not inherit creative Story Mode locality policy/u);
  assert.equal(record.buildInstruction.implementationPr, 2343);
  assert.equal(record.buildInstruction.mergedCommit, "376fe131d193712d69d5cc756f06172e9f737504");
  assert.equal(record.verification.layersPassed, 7);
  assert.equal(record.verification.layersTotal, 7);
  const statuses = Object.fromEntries(record.verification.requirements.map((item) => [item.id, item.status]));
  assert.deepEqual(statuses, { R1: "PASS", R2: "PASS", R3: "UNPROVEN" });
  assert.equal(record.correctionClassification, "implementation-mismatch");
  assert.equal(record.hiddenReasoningStored, false);
  assert.equal(record.fullPrivateTranscriptStored, false);
});


test("#2331 keeps a shared microphone control visible without requiring narration focus", async () => {
  const panel = await read("app/skin-v1/global-dsdd-conversation.tsx");
  assert.match(panel, /import VoiceInputControl from "\.\.\/_components\/voice-input-control"/u);
  assert.match(panel, /<VoiceInputControl\s+value=\{draft\}\s+onValueChange=\{setDraft\}\s+inputRef=\{narrationRef\}/u);
  assert.match(panel, /ref=\{narrationRef\}\s+data-voice-input="false"/u);
  assert.match(panel, /inputType="textarea"\s+purpose="natural-language developer uat narration"/u);
});


test("#2331 keeps DSDD dictation status inline without installing speech dependencies in the panel", async () => {
  const [control, css, dsdd, dsddCss] = await Promise.all([
    read("app/_components/voice-input-control.tsx"),
    read("app/_components/voice-input-control.module.css"),
    read("app/skin-v1/global-dsdd-conversation.tsx"),
    read("app/skin-v1/global-dsdd-conversation.module.css"),
  ]);

  assert.match(control, /statusPlacement\?: "overlay" \| "inline"/u);
  assert.match(control, /data-voice-placement=\{statusPlacement\}/u);
  assert.match(control, /requireLocalVoiceReady/u);
  assert.doesNotMatch(control, /provisionDsddLocalVoiceReady|\/api\/local-voice\/setup/u);
  assert.doesNotMatch(control, /elapsedSeconds/u);
  assert.match(css, /\.control\[data-voice-placement="inline"\] \.status \{[\s\S]*position: static/u);
  assert.match(css, /\.control\[data-voice-placement="inline"\] \.meter \{[\s\S]*position: static/u);
  assert.match(dsdd, /statusPlacement="inline"/u);
  assert.match(dsdd, /className=\{styles\.voiceControl\}/u);
  assert.match(dsddCss, /\.voiceControl \{[\s\S]*width: 100%/u);
});

test("#2331 exposes the local STT handoff and caches verified runtime integrity within the app session", async () => {
  const [gateway, runtime] = await Promise.all([
    read("build/voice/local-voice-gateway.ts"),
    read("build/voice/local-voice-runtime.ts"),
  ]);

  assert.match(gateway, /\[VOICE\] STT setup [ .]+STARTED/u);
  assert.match(gateway, /Downloading reviewed .* speech model/u);
  assert.match(gateway, /\[VOICE\] Transcription request [ .]+RECEIVED/u);
  assert.match(runtime, /verifiedRuntimeFingerprint/u);
  assert.match(runtime, /sameFingerprint/u);
  assert.match(runtime, /\[VOICE\] STT integrity [ .]+VERIFYING/u);
  assert.match(runtime, /\[VOICE\] Transcription [ .]+STARTED whisper\.cpp/u);
  assert.match(runtime, /\[VOICE\] Text produced [ .]+PASS/u);
});
