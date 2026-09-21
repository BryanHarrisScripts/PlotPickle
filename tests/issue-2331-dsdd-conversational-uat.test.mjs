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

test("#2331 keeps conversation non-mutating until explicit Build this confirmation", async () => {
  const panel = await read("app/skin-v1/global-dsdd-conversation.tsx");

  assert.match(panel, /fetch\("\/api\/local-ai\/generate\/text"/u);
  assert.match(panel, /"X-PlotPickle-DSDD-Scope": "intent"/u);
  assert.match(panel, /data-purpose="natural-language developer uat narration"/u);
  assert.match(panel, /Microphone is ready here/u);
  assert.match(panel, /Do not claim that code was changed, fixed, tested, committed, or merged/u);
  assert.match(panel, /Nothing enters BUILD until you choose Build this/u);
  assert.match(panel, />Build this</u);
  assert.doesNotMatch(panel, /\/api\/github/u);
  assert.doesNotMatch(panel, /merge_pull_request|create_pull_request|update_file/u);
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


test("#2331 persists semantic provenance and locks a versioned build packet before build", async () => {
  const [panel, gateway] = await Promise.all([
    read("app/skin-v1/global-dsdd-conversation.tsx"),
    read("build/dsdd/dsdd-session-gateway.ts"),
  ]);
  assert.match(panel, /authenticatedProfileFetch\("\/api\/dsdd\/session"/u);
  assert.match(panel, /action: "append-human"/u);
  assert.match(panel, /action: "append-interpretation"/u);
  assert.match(panel, /action: "lock-intent"/u);
  assert.match(panel, /action: "build"/u);
  assert.match(gateway, /domain: "memory"/u);
  assert.match(gateway, /version = \(session\.intents\.at\(-1\)\?\.version \|\| 0\) \+ 1/u);
  assert.match(gateway, /status: "UNPROVEN"/u);
  assert.match(gateway, /repairMayMutateIntent: false/u);
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
