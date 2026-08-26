import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1422 Story Bridge is protected by the same active-Human profile scope as BUZZ APIs", async () => {
  const context = await read("build/profile-request-context.ts");
  assert.match(context, /PROFILE_SCOPED_API_PREFIXES[\s\S]*"\/api\/local-buzz"[\s\S]*"\/api\/story-workflow\/buzz-bridge"/u);
  assert.match(context, /requiresProfileScope\(url\.pathname\)/u);
  assert.match(context, /boundary\.authorizeRequest\(sessionRequest\(request, origin\)\)/u);
  assert.match(context, /profileRequestScope\.run/u);
});

test("#1422 browser live proof carries the active Human cookie and CSRF proof", async () => {
  const liveTest = await read("modules/story-workflow/ui/foundations-buzz-story-live-test.tsx");
  assert.match(liveTest, /authenticatedProfileFetch/u);
  assert.match(liveTest, /authenticatedProfileFetch\("\/api\/story-workflow\/buzz-bridge"/u);
  assert.match(liveTest, /authenticatedProfileFetch\("\/api\/responsibility-runs"/u);
  assert.doesNotMatch(liveTest, /fetch\("\/api\/story-workflow\/buzz-bridge"/u);
  assert.doesNotMatch(liveTest, /fetch\("\/api\/responsibility-runs"/u);
});

test("#1422 internal same-origin BUZZ calls forward only Human session and CSRF proof", async () => {
  const gateway = await read("build/story-workflow-buzz-bridge-gateway.ts");
  const forwarding = gateway.match(/function forwardedProfileHeaders[\s\S]*?\n\}/u)?.[0] || "";
  assert.match(forwarding, /requestHeader\(request, "cookie"\)/u);
  assert.match(forwarding, /headers\.Cookie = cookie/u);
  assert.match(forwarding, /requestHeader\(request, "x-plotpickle-csrf"\)/u);
  assert.match(forwarding, /headers\["X-PlotPickle-CSRF"\] = csrf/u);
  assert.doesNotMatch(forwarding, /authorization|private[_ -]?key|nsec|secret|token/iu);
  assert.match(gateway, /\.\.\.forwardedProfileHeaders\(request, method\)/u);
});

test("#1422 Story Bridge transport reads fail closed instead of becoming empty state", async () => {
  const gateway = await read("build/story-workflow-buzz-bridge-gateway.ts");
  assert.doesNotMatch(gateway, /human-identity"\)\.catch\(\(\) => \(\{\}\)\)/u);
  assert.doesNotMatch(gateway, /then\(\(value\) => value\.rooms \?\? \[\]\)\.catch\(\(\) => \[\]\)/u);
  assert.doesNotMatch(gateway, /recentMessages\(request, room\.id\)\.catch\(\(\) => \[\]\)/u);
  assert.match(gateway, /const existing = await recentMessages\(request, room\.id\);/u);
});

test("#1422 Settings diagnostics exercise the real profile-scoped Story Bridge without write probes", async () => {
  const [gateway, card] = await Promise.all([
    read("build/story-workflow-buzz-bridge-gateway.ts"),
    read("app/buzz-live-health-card.tsx"),
  ]);
  const diagnostics = gateway.match(/async function storyBridgeDiagnostics[\s\S]*?\n\}\n\nasync function dispatch/u)?.[0] || "";
  assert.match(diagnostics, /currentProfileRequestContext\(\)/u);
  assert.match(diagnostics, /\/api\/local-buzz\/human-identity/u);
  assert.match(diagnostics, /\/api\/local-buzz\/rooms\?projectPrefix=/u);
  assert.match(diagnostics, /storyBridgeAgentSignerDiagnostics\(\)/u);
  assert.doesNotMatch(diagnostics, /rooms\/ensure|\/api\/local-buzz\/messages|ensurePrivateBuzzAgentMembership/u);
  assert.match(gateway, /if \(action === "diagnostics"\)/u);

  assert.match(card, /body: JSON\.stringify\(\{ action: "diagnostics" \}\)/u);
  assert.match(card, /window\.setInterval\(\(\) => void refreshDiagnostics\(\), 60_000\)/u);
  for (const label of ["Community Transport", "Human Identity", "Agent Signers", "Story Bridge"]) {
    assert.ok(card.includes(label), `Settings diagnostics are missing ${label}.`);
  }
  assert.match(card, /data-state=\{row\.ready \? "connected" : "degraded"\}/u);
  assert.match(card, /Test signed BUZZ round trip/u);
});

test("#1422 Agent signer diagnostics cover every public-BUZZ profile and require Tamsin", async () => {
  const adapter = await read("modules/story-workflow/buzz-story-bridge.ts");
  assert.match(adapter, /AGENT_PROFILES\.filter\(\(profile\) => agentExecutionContexts\(profile\.id\)\.includes\("public-buzz"\)\)/u);
  assert.match(adapter, /boundCount === requiredProfiles\.length/u);
  assert.match(adapter, /profileId === "tamsin-hearthquill" && binding\.ready/u);
  assert.match(adapter, /tamsinReady/u);
});
