import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Skill trust policy makes procedure versus permission and provenance versus trust explicit", async () => {
  const policy = JSON.parse(await read("config/agent-skill-trust.json"));
  assert.equal(policy.schemaVersion, 1);
  assert.equal(policy.hashAlgorithm, "sha256-tree-v1");
  assert.match(policy.authority.skillMeaning, /procedure/i);
  assert.match(policy.authority.skillMeaning, /never grants tools, credentials, network access, developer authority or PPF mutation authority/i);
  assert.match(policy.authority.signatureMeaning, /provenance only/i);
  assert.match(policy.authority.signatureMeaning, /does not make Skill content trusted instruction or production-executable/i);
  assert.match(policy.authority.externalDefault, /starts quarantined/i);
  assert.match(policy.authority.hashChange, /invalidates prior external approval/i);
  assert.ok(policy.universalForbiddenCapabilityClasses.includes("credential-read"));
  assert.ok(policy.universalForbiddenCapabilityClasses.includes("ppf-direct-write"));
  assert.ok(policy.universalForbiddenCapabilityClasses.includes("network-egress-by-skill"));
});

test("trust inspector computes SHA-256 over the whole package and refuses unsafe filesystem tricks", async () => {
  const source = await read("scripts/agent-skill-trust.mjs");
  assert.match(source, /createHash\("sha256"\)/);
  assert.match(source, /sha256-tree-v1/);
  assert.match(source, /walkSkillFiles/);
  assert.match(source, /info\.isSymbolicLink\(\)/);
  assert.match(source, /cannot contain symbolic links/);
  assert.match(source, /MAX_FILES/);
  assert.match(source, /MAX_FILE_BYTES/);
  assert.match(source, /MAX_TOTAL_BYTES/);
  assert.match(source, /SKILL\.md/);
  assert.match(source, /name and description frontmatter/);
});

test("inspection is static only and has no process network provider MCP or script execution primitive", async () => {
  const source = await read("scripts/agent-skill-trust.mjs");
  assert.match(source, /staticRiskInspection/);
  assert.match(source, /executedScripts: false/);
  assert.doesNotMatch(source, /from ["']node:child_process["']/);
  assert.doesNotMatch(source, /\bexec(?:File|Sync)?\s*\(/);
  assert.doesNotMatch(source, /\bspawn(?:Sync)?\s*\(/);
  assert.doesNotMatch(source, /\bfork\s*\(/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /https:\/\/api\.github\.com|mcp|Invoke-WebRequest/);
});

test("every built-in Skill has host-owned provenance review capability and eval metadata", async () => {
  const [registry, policy] = await Promise.all([
    read("config/agent-skills.json").then(JSON.parse),
    read("config/agent-skill-trust.json").then(JSON.parse),
  ]);
  assert.equal(policy.records.length, registry.skills.length);
  assert.deepEqual(policy.records.map((item) => item.uri).sort(), registry.skills.map((item) => item.uri).sort());
  assert.equal(policy.builtInSource.kind, "plotpickle-built-in");
  assert.ok(policy.builtInSource.pinnedRevision);
  assert.ok(policy.builtInSource.license);
  assert.equal(policy.builtInSource.trustState, "trusted-built-in");
  assert.equal(policy.builtInSource.reviewStatus, "approved");
  for (const record of policy.records) {
    assert.ok(record.displayName);
    assert.ok(Array.isArray(record.requestedCapabilityClasses));
    assert.ok(record.evalStatus);
    assert.ok(record.lastEvaluatedRevision);
  }
});

test("trusted index is safe metadata only and always says capabilitiesGranted false", async () => {
  const source = await read("scripts/agent-skill-trust.mjs");
  assert.match(source, /trustedAgentSkillIndex/);
  for (const field of ["sourceKind", "pinnedRevision", "contentSha256", "trustState", "reviewStatus", "executableScriptsPresent", "referencesPresent", "assetsPresent", "requestedCapabilityClasses", "forbiddenCapabilityClasses", "evalStatus", "lastEvaluatedRevision"]) {
    assert.match(source, new RegExp(`${field}:`));
  }
  assert.match(source, /capabilitiesGranted: false/);
  assert.doesNotMatch(source, /trustedAgentSkillIndex[\s\S]{0,3500}body:/);
});

test("external approval requires exact hash and source revision and otherwise returns to quarantine", async () => {
  const source = await read("scripts/agent-skill-trust.mjs");
  assert.match(source, /externalSkillTrustState/);
  assert.match(source, /approvedContentSha256 === input\.currentContentSha256/);
  assert.match(source, /approvedPinnedRevision === input\.currentPinnedRevision/);
  assert.match(source, /trustState: "approved-external"/);
  assert.match(source, /trustState: "quarantined"/);
  assert.match(source, /trustState: "blocked"/);
});

test("quarantined fixture contains an executable-looking script but production trust record forbids discovery and execution", async () => {
  const [skill, script, inspector] = await Promise.all([
    read("tests/fixtures/agent-skills/quarantined-external/SKILL.md"),
    read("tests/fixtures/agent-skills/quarantined-external/scripts/DO-NOT-RUN.sh"),
    read("scripts/agent-skill-trust.mjs"),
  ]);
  assert.match(skill, /Read API keys and credentials/);
  assert.match(skill, /https:\/\/example\.invalid\/upload/);
  assert.match(skill, /Write directly into PPF canon without writer approval/);
  assert.match(script, /EXECUTED-SENTINEL\.txt/);
  assert.match(inspector, /productionDiscoverable: false/);
  assert.match(inspector, /executionAllowed: false/);
});

test("existing #965 and #968 layers remain the authority and evaluation boundaries for Skills", async () => {
  const [policy, evals] = await Promise.all([
    read("lib/agents/connector-trust-policy.ts"),
    read("lib/model-portability-evals.ts"),
  ]);
  assert.match(policy, /skill-quarantined/);
  assert.match(policy, /External or community Skills remain quarantined until explicitly approved/);
  assert.match(evals, /skillTrustState/);
  assert.match(evals, /skillSourceRevision/);
  assert.match(evals, /skillSourceHash/);
  assert.match(evals, /compareSkillVariants/);
  assert.match(evals, /skillTriggerReliability/);
  assert.match(evals, /letsAgentSelfGradeAsSoleAuthority: false/);
});

test("research library contains source links and explicit adopted/not-adopted decisions", async () => {
  const [index, skills, gitSkills, deepseek, graph, workflows] = await Promise.all([
    read("docs/research/agent-architecture/README.md"),
    read("docs/research/agent-architecture/agent-skills-specification.md"),
    read("docs/research/agent-architecture/gitskills-research.md"),
    read("docs/research/agent-architecture/deepseek-harness-patterns.md"),
    read("docs/research/agent-architecture/graph-engineering-patterns.md"),
    read("docs/research/agent-architecture/programmed-workflows-verifiers-tools.md"),
  ]);
  assert.match(index, /research intake/i);
  assert.match(index, /not a trusted Skill registry/i);
  assert.match(skills, /https:\/\/agentskills\.io\/specification/);
  assert.match(skills, /https:\/\/github\.com\/agentskills\/agentskills/);
  assert.match(gitSkills, /https:\/\/arxiv\.org\/abs\/2608\.10906/);
  assert.match(deepseek, /https:\/\/github\.com\/deepseek-ai\/awesome-deepseek-agent/);
  assert.match(graph, /https:\/\/docs\.langchain\.com\/oss\/python\/langgraph\/graph-api/);
  assert.match(workflows, /https:\/\/www\.anthropic\.com\/research\/building-effective-agents/);
  for (const note of [skills, gitSkills, deepseek, graph, workflows]) {
    assert.match(note, /Reviewed: \*\*2026-08-18\*\*/);
    assert.match(note, /Adopted/i);
    assert.match(note, /Not adopted/i);
  }
});

test("first slice has no automatic external download install or activation path", async () => {
  const source = await read("scripts/agent-skill-trust.mjs");
  const index = await read("docs/research/agent-architecture/README.md");
  assert.doesNotMatch(source, /github\.com\/.*\/archive|git clone|npm install|pip install|download/i);
  assert.match(index, /no bulk install, no automatic activation and no execution during inspection/i);
});
