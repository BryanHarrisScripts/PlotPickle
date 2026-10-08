import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { qualityWritingReadiness, sameLocalWritingExecution } from "../core/contracts/compute/local-writing-readiness.mjs";

const execution = {
  runtime: "ollama",
  baseUrl: "http://127.0.0.1:11434/v1",
  textModel: "writer-quality:7b",
  contextTokens: 16384,
};
const profile = {
  provider: "local",
  ...execution,
  assistantVerifiedAt: "2026-10-08T12:00:00Z",
  lastError: "",
};
const snapshot = {
  activeRuntime: { reachable: true, kind: execution.runtime, baseUrl: execution.baseUrl },
  roles: {
    fast: { available: true, selected: "fast-1b" },
    quality: { available: true, selected: execution.textModel },
  },
  settings: { contextTokens: execution.contextTokens },
};

test("PP-COMP-002 exact Quality writing identity requires real response proof and reachable model", () => {
  assert.equal(sameLocalWritingExecution(profile, execution), true);
  assert.equal(qualityWritingReadiness(profile, snapshot).ready, true);
  assert.equal(qualityWritingReadiness({ ...profile, assistantVerifiedAt: "" }, snapshot).ready, false,
    "model detection alone is not readiness");
  assert.equal(qualityWritingReadiness({ ...profile, lastError: "Empty response" }, snapshot).ready, false);
  assert.equal(qualityWritingReadiness(profile, {
    ...snapshot, activeRuntime: { ...snapshot.activeRuntime, reachable: false },
  }).ready, false);
  assert.equal(qualityWritingReadiness(profile, {
    ...snapshot, roles: { ...snapshot.roles, quality: { available: false, selected: "" } },
  }).ready, false);
});
test("PP-COMP-002 Fast evidence never authorizes a different Quality model", () => {
  const fastProfile = { ...profile, textModel: "fast-1b" };
  assert.equal(qualityWritingReadiness(fastProfile, snapshot).ready, false);
  assert.match(qualityWritingReadiness(fastProfile, snapshot).error, /changed|Test Writing/);
  assert.equal(qualityWritingReadiness(profile, {
    ...snapshot, roles: { fast: { available: true, selected: "something-else" }, quality: snapshot.roles.quality },
  }).ready, true, "unrelated Fast model changes do not invalidate this Quality proof");
  for (const changed of [
    { ...profile, runtime: "llama.cpp" },
    { ...profile, baseUrl: "http://127.0.0.1:1234/v1" },
    { ...profile, textModel: "other-writer" },
    { ...profile, contextTokens: 32768 },
  ]) assert.equal(qualityWritingReadiness(changed, snapshot).ready, false,
    "different runtime, endpoint, model or context must invalidate old proof");
});
test("PP-COMP-002 Settings, Hybrid and Bubble share Quality identity, never catalog-only proof", async () => {
  const [gateway, routeStatus, bubbleRoute, localUi, focusedUi, computeUi, contract] = await Promise.all([
    readFile("build/writing-assistant-gateway.ts", "utf8"),
    readFile("build/ai-routing-gateway.ts", "utf8"),
    readFile("app/api/previs/narration/route.ts", "utf8"),
    readFile("app/skin-v1/local-ai-skin-host.tsx", "utf8"),
    readFile("app/skin-v1/local-writing-verification.tsx", "utf8"),
    readFile("app/settings/compute/ai-compute-workspace.tsx", "utf8"),
    readFile("docs/behavioral-contracts/PP-COMP-002.md", "utf8"),
  ]);
  assert.match(gateway, /body\.modelRole === "quality" \? "quality" : "fast"/u,
    "real writing test must support the Bubble Quality role without treating Fast as proof");
  assert.match(gateway, /sameLocalWritingExecution\(profile, execution\)/u,
    "Bubble preflight must compare against actual Quality execution route");
  assert.match(gateway, /qualityWritingReadiness\(store\.profiles\.local, localRuntime\)/u);
  const handleStatus = gateway.slice(gateway.indexOf("async function handleStatus("),gateway.indexOf("async function handleActive("));
  assert.doesNotMatch(handleStatus, /synchronizeLocalFastProfile\(store\)/u,
    "observational status must not overwrite a verified Quality model");
  assert.match(routeStatus, /qualityWritingReadiness\(assistant\.profiles\.local, localRuntime\)/u,
    "Hybrid must read exact same Quality verification contract");
  assert.match(bubbleRoute, /resolveConfiguredLocalNarrationProfile/u);
  assert.doesNotMatch(bubbleRoute.slice(bubbleRoute.indexOf("let profile;"), bubbleRoute.indexOf("let text;")), /fallback|routeCloud|requireRouteConsent/u,
    "the approved Bubble pilot remains local-only with no paid fallback");
  assert.match(localUi, /localWritingConnection/u);
  assert.match(localUi, /LocalWritingVerificationPanel/u);
  assert.match(focusedUi, /modelRole: "quality"/u);
  assert.match(focusedUi, /Test Writing/u);
  assert.match(focusedUi, /body\.text\?\.trim\(\)/u);
  assert.match(computeUi, /LocalWritingVerificationPanel/u);
  assert.match(contract, /Collect comprehensively; retrieve selectively; decide precisely/u);
  assert.match(contract, /4,000-character/u);
});
