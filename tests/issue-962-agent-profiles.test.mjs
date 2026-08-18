import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const EXPECTED_PROFILES = [
  "sage-brinewick",
  "tamsin-hearthquill",
  "master-oaken-vague",
  "rowan-scalequill",
  "quillan-reedcloak",
  "elowen-mapweaver",
  "mira-threadmere",
  "avery-north",
  "luma-glassfern",
  "bram-gatewick",
  "rook-ironquill",
  "orin-ledgerbark",
  "fen-copperwind",
].sort();

const HOST_FORBIDDEN = ["ppf-direct-write", "github-write", "developer-shell", "credential-read", "provider-selection"];
const MODEL_ROLES = new Set(["fast", "quality", "deep", "vision", "repair"]);
const BUZZ_MUTABLE_KEYS = [
  "harness", "provider", "model", "effort", "memory", "coreMemory", "coldMemory", "respondTo", "respondToPubkeys",
  "parallelism", "idleTimeout", "maxTurnDuration", "startOnLaunch", "autoRestart", "environment", "env", "runtimeArgs",
  "acpCommand", "maxOutputTokens", "contextLimit", "maxRounds",
];

test("one canonical Agent Profile registry covers the initial PlotPickle roster", async () => {
  const registry = JSON.parse(await read("config/agent-profiles.json"));
  assert.equal(registry.schemaVersion, 1);
  assert.deepEqual(registry.profiles.map((profile) => profile.id).sort(), EXPECTED_PROFILES);
  assert.match(registry.authority.profileMeaning, /do not grant permissions/i);
  assert.match(registry.authority.skillMeaning, /never expands host authority/i);
  assert.match(registry.authority.creativeAuthority, /PPF remains creative authority/i);
  assert.match(registry.authority.creativeAuthority, /writer remains the final creative decision maker/i);
});

test("profiles request capability roles rather than vendor or model identities", async () => {
  const raw = await read("config/agent-profiles.json");
  const registry = JSON.parse(raw);
  for (const profile of registry.profiles) {
    if (profile.requestedModelRole !== null) assert.ok(MODEL_ROLES.has(profile.requestedModelRole), `${profile.id} must request a capability role`);
  }
  assert.doesNotMatch(raw, /qwen|deepseek|llama[-_. ]?cpp|ollama|openai|anthropic|gemini|mistral|gpt[-_. ]?\d/i);
});

test("BUZZ owns mutable character-host settings while PlotPickle keeps only authority and product bindings", async () => {
  const [raw, authoritySource, contextSource] = await Promise.all([
    read("config/agent-profiles.json"),
    read("lib/agent-profiles.ts"),
    read("lib/context-engine.ts"),
  ]);
  const registry = JSON.parse(raw);

  for (const profile of registry.profiles) {
    for (const key of BUZZ_MUTABLE_KEYS) assert.equal(Object.hasOwn(profile, key), false, `${profile.id} must not duplicate BUZZ-owned ${key}`);
  }

  assert.match(authoritySource, /BUZZ_OWNED_MUTABLE_PROFILE_KEYS/);
  assert.match(authoritySource, /BUZZ owns cryptographic identity, instructions\/personality, encrypted core\/cold memory, ACP harness, provider\/model\/effort/);
  assert.match(authoritySource, /BUZZ memory and PlotPickle project memory may be bounded context or evidence; neither is PPF canon/);
  assert.match(authoritySource, /cannot duplicate BUZZ-owned mutable setting/);
  assert.match(authoritySource, /runtime records which PlotPickle execution surface currently serves the role/);
  assert.match(authoritySource, /lifecycleState records PlotPickle presentation availability only/);

  // Context packets carry PlotPickle authority metadata, not BUZZ Brain/Memory/Social/Lifecycle configuration.
  assert.doesNotMatch(contextSource, /profile\.(?:harness|provider|model|effort|coreMemory|coldMemory|respondTo|parallelism|startOnLaunch|autoRestart|runtimeArgs|acpCommand)/);
});

test("profiles and Skills cannot request host-forbidden developer, credential, provider or direct canon authority", async () => {
  const [profileRaw, skillsRaw, authoritySource] = await Promise.all([
    read("config/agent-profiles.json"),
    read("config/agent-skills.json"),
    read("lib/agent-profiles.ts"),
  ]);
  const registry = JSON.parse(profileRaw);
  const skills = JSON.parse(skillsRaw);
  const knownSkillUris = new Set(skills.skills.map((skill) => skill.uri));

  for (const profile of registry.profiles) {
    for (const capability of HOST_FORBIDDEN) {
      assert.ok(profile.forbiddenCapabilities.includes(capability), `${profile.id} must explicitly forbid ${capability}`);
      assert.ok(!profile.requestedCapabilities.includes(capability), `${profile.id} cannot request ${capability}`);
    }
    for (const uri of profile.skillUris) assert.ok(knownSkillUris.has(uri), `${profile.id} references unknown Skill ${uri}`);
  }

  assert.match(authoritySource, /HOST_FORBIDDEN_PROFILE_CAPABILITIES/);
  assert.match(authoritySource, /requestedByProfile\.has\(capability\)/);
  assert.match(authoritySource, /forbidden\.has\(capability\)/);
  assert.match(authoritySource, /skillRequestedCapabilities/);
  assert.match(authoritySource, /return !skillRequests \|\| skillRequests\.has\(capability\)/);
  assert.doesNotMatch(authoritySource, /writeFile|unlink|rmSync|execSync|spawnSync|github\.com\/repos|api\.github\.com/);
});

test("a developer-capable BUZZ ACP harness can narrow but never expand PlotPickle authority", async () => {
  const source = await read("lib/agent-profiles.ts");
  assert.match(source, /resolveBoundAgentCapabilities/);
  assert.match(source, /boundAgentClaimedCapabilities/);
  assert.match(source, /resolveAgentProfileCapabilities\(\{/);
  assert.match(source, /\.filter\(\(capability\) => claimed\.has\(capability\)\)/);
  assert.match(source, /claims are only another narrowing input/);
  assert.match(source, /They can never expand what PlotPickle granted/);
});

test("Community roster consumes Agent Profiles instead of BUZZ actor descriptions", async () => {
  const [model, ui] = await Promise.all([
    read("lib/community-agent-roster.ts"),
    read("app/community-agent-roster.tsx"),
  ]);
  assert.match(model, /import \{ AGENT_PROFILES/);
  assert.doesNotMatch(model, /BUZZ_GUILDHALL_ACTORS/);
  assert.match(model, /summary: profile\.responsibility/);
  assert.match(model, /profile\.lifecycleState === "parked"/);
  assert.match(model, /requestedModelRole: profile\.requestedModelRole/);
  assert.match(ui, /Capabilities & boundaries/);
  assert.match(ui, /Skills describe procedure; they never grant permission/);
  assert.match(ui, /writer remains the final authority over creative changes/i);
  assert.match(ui, /Cannot do/);
  assert.match(ui, /Creative authority/);
  assert.doesNotMatch(ui, /Core memory|Cold memory|Respond-to|Parallelism|Start on launch|Auto-restart|ACP command/);
});

test("startup validates Agent Profiles before continuing existing health checks", async () => {
  const [entrypoint, profileLayer] = await Promise.all([
    read("build/startup-agent-diagnostics.ts"),
    read("build/startup-agent-diagnostics-runtime-v6.ts"),
  ]);
  assert.match(entrypoint, /startup-agent-diagnostics-runtime-v6/);
  assert.match(profileLayer, /assertAgentProfilesValid\(\)/);
  assert.match(profileLayer, /runStartupAgentDiagnostics as runV5/);
  assert.ok(profileLayer.indexOf("assertAgentProfilesValid()") < profileLayer.indexOf("return runV5(baseUrl)"));
});

test("defining or activating a profile has no direct PPF or GitHub mutation path", async () => {
  const source = await read("lib/agent-profiles.ts");
  assert.match(source, /profileCanRequestCapability/);
  assert.match(source, /HOST_FORBIDDEN\.has\(capability\)/);
  assert.doesNotMatch(source, /project-store|ppf-store|saveProject|writeProject|merge_pull_request|create_pull_request|update_ref/);
});
