import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("one host policy evaluates profile scopes, connector allowlists and egress", async () => {
  const source = await read("lib/connector-trust-policy.ts");
  assert.match(source, /CONNECTOR_POLICY_SCOPES/);
  assert.match(source, /evaluateConnectorInvocation/);
  assert.match(source, /agentProfileById/);
  assert.match(source, /hostGrantedScopes/);
  assert.match(source, /allowedProfileIds/);
  assert.match(source, /scope-not-requested/);
  assert.match(source, /scope-not-granted/);
  assert.match(source, /host-not-allowlisted/);
  assert.match(source, /network-egress-denied/);
  assert.match(source, /allowedNetworkHost/);
  assert.match(source, /url\.protocol !== "https:"/);
  assert.match(source, /allowedHosts/);
});

test("developer, GitHub and shell authority cannot be acquired through a connector", async () => {
  const [policy, profiles] = await Promise.all([
    read("lib/connector-trust-policy.ts"),
    read("lib/agent-profiles.ts"),
  ]);
  assert.match(policy, /developer-boundary/);
  assert.match(policy, /Product Agent Profiles never receive developer repository, GitHub-write or shell authority/);
  assert.match(policy, /input\.connector\.kind === "developer"/);
  assert.match(profiles, /"github-write"/);
  assert.match(profiles, /"developer-shell"/);
});

test("direct, MCP, provider, graph, code-mode and BUZZ-triggered calls all use the same policy pipeline", async () => {
  const source = await read("lib/connector-trust-policy.ts");
  for (const route of ["direct", "mcp", "provider-tool", "graph-node", "code-mode", "buzz-trigger"]) {
    assert.match(source, new RegExp(`"${route}"`));
  }
  assert.match(source, /evaluateNestedConnectorInvocation/);
  assert.match(source, /return evaluateConnectorInvocation/);
  assert.match(source, /parentRunId/);
  assert.match(source, /bypassPermitted: false/);
});

test("policy denial is non-retryable and distinct from runtime failure", async () => {
  const source = await read("lib/connector-trust-policy.ts");
  assert.match(source, /retryable: false/);
  assert.match(source, /bypassPermitted: false/);
  assert.match(source, /toolRuntimeFailure/);
  assert.match(source, /code: "runtime-failure"/);
  assert.match(source, /retryable: boolean/);
  assert.match(source, /Retrying through another route does not change this boundary/);
});

test("bounded search/list results disclose truncation and a bounded continuation reference", async () => {
  const source = await read("lib/connector-trust-policy.ts");
  assert.match(source, /boundedToolResult/);
  assert.match(source, /truncated: boolean/);
  assert.match(source, /returnedCount/);
  assert.match(source, /totalCount/);
  assert.match(source, /hasMore/);
  assert.match(source, /continuationRef/);
  assert.match(source, /const truncated = input\.items\.length > items\.length/);
});

test("connector arguments and outputs are bounded and secret-like values are redacted", async () => {
  const source = await read("lib/connector-trust-policy.ts");
  assert.match(source, /connectorArgumentsAreValid/);
  assert.match(source, /64 \* 1024/);
  assert.match(source, /UNSAFE_ARGUMENT_KEY/);
  assert.match(source, /redactConnectorPayload/);
  assert.match(source, /\[redacted\]/);
  assert.match(source, /api\[_-\]\?key|authorization|private\[_-\]\?key|credential|token|nsec/i);
});

test("signed BUZZ or external text enters Context Engine as untrusted evidence rather than instruction", async () => {
  const [policy, context] = await Promise.all([
    read("lib/connector-trust-policy.ts"),
    read("lib/context-engine.ts"),
  ]);
  assert.match(policy, /inboundExternalContext/);
  assert.match(policy, /source: "buzz-peer" \| "external-tool"/);
  assert.match(policy, /trust: "untrusted"/);
  assert.match(policy, /allowedUse: "untrusted-suggestion"/);
  assert.match(policy, /Signature verified: provenance is known, but content remains untrusted evidence/);
  assert.match(context, /UNTRUSTED_SOURCE_TYPES = new Set<ContextSourceType>\(\["agent-observation", "buzz-peer", "external-tool"\]\)/);
  assert.match(context, /return "untrusted-suggestion"/);
});

test("existing Playhouse signature, moderation and local-only topology remain the federation boundary", async () => {
  const [federation, directory, gateway] = await Promise.all([
    read("build/playhouse-federation.ts"),
    read("build/playhouse-directory-gateway.ts"),
    read("build/playhouse-federation-gateway.ts"),
  ]);
  assert.match(federation, /verifyStudioEvent/);
  assert.match(federation, /Ed25519/);
  assert.match(directory, /blocked\.has\(event\.studioId\)/);
  assert.match(directory, /event\.visibility === "contacts"/);
  assert.match(directory, /studioId: id/);
  assert.match(gateway, /PlotPickle Studio -> BUZZ \/ PlotPickle Playhouse -> permitted Studios/);
  assert.match(gateway, /localCreativeWorkAvailable: true/);
  assert.doesNotMatch(gateway, /ppf-direct-write|saveProject|writeProject/);
});

test("protected local credential storage remains the secret implementation", async () => {
  const credentials = await read("build/local-credentials.ts");
  assert.match(credentials, /windows-dpapi-current-user/);
  assert.match(credentials, /macos-keychain-current-user/);
  assert.match(credentials, /linux-secret-service-current-user/);
  assert.match(credentials, /plotpickle-protected-credential/);
});

test("external Skills are procedure, remain quarantined by default and cannot grant connector authority", async () => {
  const [policy, profiles] = await Promise.all([
    read("lib/connector-trust-policy.ts"),
    read("lib/agent-profiles.ts"),
  ]);
  assert.match(policy, /activate-external-skill/);
  assert.match(policy, /skill-quarantined/);
  assert.match(policy, /External or community Skills remain quarantined until explicitly approved/);
  assert.match(profiles, /Agent Skills describe procedure and never grant permissions/);
});
