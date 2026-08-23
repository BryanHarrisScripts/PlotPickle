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
  "marquee-director",
  "critics-circle",
  "avery-north",
  "luma-glassfern",
  "bram-gatewick",
  "rook-ironquill",
  "ben",
  "orin-ledgerbark",
  "fen-copperwind",
].sort();

const HOST_FORBIDDEN = ["ppf-direct-write", "github-write", "developer-shell", "credential-read", "provider-selection"];
const CAPABILITY_ROLES = new Set(["fast", "quality", "deep", "vision", "repair"]);

test("one canonical PlotPickle Agent Contract registry covers the initial roster", async () => {
  const registry = JSON.parse(await read("config/agent-profiles.json"));
  assert.equal(registry.schemaVersion, 2);
  assert.deepEqual(registry.profiles.map((profile) => profile.id).sort(), EXPECTED_PROFILES);
  assert.match(registry.ownership.boundaries.join(" "), /BUZZ memory is not PlotPickle project memory/i);
  assert.match(registry.ownership.boundaries.join(" "), /PPF canon/i);
  assert.match(registry.ownership.boundaries.join(" "), /writer remains the final creative decision maker/i);
  for (const expected of ["encrypted core and cold memory", "ACP harness/runtime", "provider, model and effort", "respond-to policy and allowlists", "start/restart lifecycle"]) {
    assert.ok(registry.ownership.buzzOwnsWhenManaged.includes(expected), `BUZZ ownership must include ${expected}`);
  }
});

test("PlotPickle profiles bind to BUZZ without duplicating BUZZ Brain, Memory, Social or Lifecycle settings", async () => {
  const raw = await read("config/agent-profiles.json");
  const registry = JSON.parse(raw);
  for (const profile of registry.profiles) {
    assert.ok(profile.buzzBinding?.actorId, `${profile.id} needs a BUZZ actor binding`);
    assert.ok(["mirrored", "native", "service"].includes(profile.buzzBinding.mode), `${profile.id} needs a supported BUZZ mode`);
    if (profile.requestedCapabilityRole !== null) assert.ok(CAPABILITY_ROLES.has(profile.requestedCapabilityRole), `${profile.id} must request a capability role`);
    for (const buzzOwnedKey of ["provider", "model", "effort", "memory", "coreMemory", "coldMemory", "respondTo", "allowlist", "parallelism", "runtimeArgs", "startOnLaunch", "autoRestart"]) {
      assert.equal(Object.hasOwn(profile, buzzOwnedKey), false, `${profile.id} must not duplicate BUZZ-owned ${buzzOwnedKey}`);
    }
  }
  assert.doesNotMatch(raw, /qwen|deepseek|llama[-_. ]?cpp|ollama|openai|anthropic|gemini|mistral|gpt[-_. ]?\d/i);
});

test("host policy, profiles and Skills cannot grant developer, credential, provider or direct canon authority", async () => {
  const [profileRaw, skillsRaw, authoritySource] = await Promise.all([
    read("config/agent-profiles.json"),
    read("config/agent-skills.json"),
    read("lib/agents/agent-profiles.ts"),
  ]);
  const registry = JSON.parse(profileRaw);
  const skills = JSON.parse(skillsRaw);
  const knownSkillUris = new Set(skills.skills.map((skill) => skill.uri));

  for (const capability of HOST_FORBIDDEN) assert.ok(registry.hostPolicy.forbiddenCapabilities.includes(capability));
  for (const profile of registry.profiles) {
    for (const capability of HOST_FORBIDDEN) assert.ok(!profile.requestedCapabilities.includes(capability), `${profile.id} cannot request ${capability}`);
    for (const uri of profile.skillUris) assert.ok(knownSkillUris.has(uri), `${profile.id} references unknown Skill ${uri}`);
  }

  assert.match(authoritySource, /HOST_FORBIDDEN_PROFILE_CAPABILITIES/);
  assert.match(authoritySource, /BUZZ_OWNED_AGENT_SETTINGS/);
  assert.match(authoritySource, /effectiveForbiddenCapabilities/);
  assert.match(authoritySource, /requestedByProfile\.has\(capability\)/);
  assert.match(authoritySource, /forbidden\.has\(capability\)/);
  assert.match(authoritySource, /skillRequestedCapabilities/);
  assert.doesNotMatch(authoritySource, /writeFile|unlink|rmSync|execSync|spawnSync|github\.com\/repos|api\.github\.com/);
});

test("a developer-capable BUZZ harness cannot become PlotPickle developer authority", async () => {
  const [registryRaw, authoritySource] = await Promise.all([
    read("config/agent-profiles.json"),
    read("lib/agents/agent-profiles.ts"),
  ]);
  const registry = JSON.parse(registryRaw);
  assert.match(registry.ownership.boundaries.join(" "), /Codex, Claude Code, Goose, buzz-agent/i);
  assert.match(registry.ownership.boundaries.join(" "), /without gaining PlotPickle developer, GitHub or PPF authority/i);
  assert.match(authoritySource, /"developer-shell"/);
  assert.match(authoritySource, /"github-write"/);
  assert.match(authoritySource, /"ppf-direct-write"/);
});

test("Community roster consumes PlotPickle Agent Contracts while technical authority detail stays secondary", async () => {
  const [model, ui] = await Promise.all([
    read("lib/community-agent-roster.ts"),
    read("app/community-agent-roster.tsx"),
  ]);
  assert.match(model, /import \{[\s\S]*AGENT_PROFILES/);
  assert.doesNotMatch(model, /BUZZ_GUILDHALL_ACTORS/);
  assert.match(model, /summary: profile\.responsibility/);
  assert.match(model, /profile\.defaultAvailability === "parked"/);
  assert.match(model, /profile\.execution\.kind === "embedded-mastra"/);
  assert.match(model, /profile\.execution\.kind === "buzz-managed"/);
  assert.match(model, /requestedModelRole: profile\.requestedCapabilityRole/);
  assert.match(model, /effectiveForbiddenCapabilities\(profile\)/);
  assert.match(model, /avatarInitials/);
  assert.match(model, /projectMemoryPolicy/);
  assert.match(model, /activeModel/);
  assert.match(ui, /<summary>Technical details<\/summary>/);
  assert.match(ui, /Cannot do/);
  assert.match(ui, /Memory policy/);
  assert.match(ui, /Verification/);
  assert.match(ui, /The connected Human signer is never an Agent signer/);
  assert.match(ui, /Official PlotPickle Agent private signers stay with PlotPickle Admin outside the distributed app/);
});

test("startup validates Agent Contracts before continuing existing health checks", async () => {
  const [entrypoint, profileLayer] = await Promise.all([
    read("build/startup-agent-diagnostics.ts"),
    read("build/startup-agent-diagnostics-runtime-v6.ts"),
  ]);
  assert.match(entrypoint, /startup-agent-diagnostics-runtime-v6/);
  assert.match(profileLayer, /assertAgentProfilesValid\(\)/);
  assert.match(profileLayer, /runStartupAgentDiagnostics as runV5/);
  assert.ok(profileLayer.indexOf("assertAgentProfilesValid()") < profileLayer.indexOf("return runV5(baseUrl)"));
});

test("defining, binding or activating an Agent Contract has no direct PPF or GitHub mutation path", async () => {
  const source = await read("lib/agents/agent-profiles.ts");
  assert.match(source, /profileCanRequestCapability/);
  assert.match(source, /HOST_FORBIDDEN\.has\(capability\)/);
  assert.doesNotMatch(source, /project-store|ppf-store|saveProject|writeProject|merge_pull_request|create_pull_request|update_ref/);
});