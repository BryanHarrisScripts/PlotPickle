import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assessDsddInterpretation } from "../scripts/dsdd-integrity.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2376 microphone narration can never become no-action", () => {
  const result = assessDsddInterpretation({
    humanStatement: "This is not a problem, but I am dictating this through DSDD.",
    interpretation: "Understood. This is not a problem and no development action is required. I’ll retain it as a UAT observation.",
    inputMode: "voice",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "voice-no-action");
});

test("#2376 typed Human can still explicitly declare a no-action observation", () => {
  const result = assessDsddInterpretation({
    humanStatement: "No change needed. Just record this observation.",
    interpretation: "Understood. This is not a problem and no development action is required. I’ll retain it as a UAT observation.",
    inputMode: "typed",
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, "valid-no-action");
});

test("#2376 typed actionable narration cannot be downgraded to no-action", () => {
  const result = assessDsddInterpretation({
    humanStatement: "Rename Discover to Mind Map and move Story under it on the Dashboard.",
    interpretation: "Understood. No development action is required.",
    inputMode: "typed",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "unjustified-no-action");
});

test("#2376 voice provenance flows from dictation into the DSDD session", async () => {
  const [voice, panel, gateway] = await Promise.all([
    read("app/_components/voice-input-control.tsx"),
    read("app/skin-v1/global-dsdd-conversation.tsx"),
    read("build/dsdd/dsdd-session-gateway.ts"),
  ]);

  assert.match(voice, /onDictationInserted\?: \(\) => void/u);
  assert.match(voice, /onValueChange\(next\.value\);\s*onDictationInserted\?\.\(\);/u);

  assert.match(panel, /onDictationInserted=\{\(\) => setDraftHasVoice\(true\)\}/u);
  assert.match(panel, /draftHasVoice \? "voice" : "typed"/u);
  assert.match(panel, /action: "append-human", text: submitted, context: snapshot, inputMode/u);
  assert.match(panel, /INPUT MODE: MICROPHONE DICTATION\. This narration is actionable/u);

  assert.match(gateway, /const inputMode = normalizeInputMode\(body\.inputMode\)/u);
  assert.match(gateway, /inputMode: latestHuman\.inputMode \|\| "typed"/u);
  assert.match(gateway, /inputMode: human\.inputMode \|\| "typed"/u);
});

test("#2376 a new Human narration invalidates stale active locked intent without deleting history", async () => {
  const [panel, gateway] = await Promise.all([
    read("app/skin-v1/global-dsdd-conversation.tsx"),
    read("build/dsdd/dsdd-session-gateway.ts"),
  ]);

  const submitReset = panel.indexOf("setLockedIntent(null);");
  const appendHuman = panel.indexOf('action: "append-human"');
  assert.ok(submitReset >= 0 && appendHuman > submitReset, "active locked intent must clear before the new Human narration is persisted");

  assert.match(panel, /latestHuman\?\.id === latestIntent\.humanEntryId \? latestIntent : null/u);
  assert.match(panel, /for \(let index = messages\.length - 1; index > latestHumanIndex; index -= 1\)/u);
  assert.match(panel, /activeInputMode === "typed" && NO_DEVELOPMENT_ACTION_PATTERN/u);

  assert.match(gateway, /function currentLockedIntent\(session: DsddSession\)/u);
  assert.match(gateway, /intent\.humanEntryId !== latestHuman\.id/u);
  assert.match(gateway, /const intent = currentLockedIntent\(session\);/u);
  assert.match(gateway, /Publish Brief requires a locked intent for the current Human narration/u);
});

test("#2376 current interpretation prompt cannot be contaminated by prior DSDD model output", async () => {
  const panel = await read("app/skin-v1/global-dsdd-conversation.tsx");
  assert.match(panel, /messages\s*\.filter\(\(message\) => message\.role === "human"\)/u);
  assert.match(panel, /PRIOR HUMAN NARRATION \(context only\)/u);
  assert.match(panel, /NEW HUMAN NARRATION — AUTHORITATIVE FOR THIS CYCLE/u);
  assert.doesNotMatch(panel, /RECENT CONVERSATION\\n/u);
});
