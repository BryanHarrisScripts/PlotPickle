import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const marketing = readFileSync(resolve(root, "modules/learn/model/marquee-director.ts"), "utf8");
const overlay = readFileSync(resolve(root, "modules/learn/ui/marquee-agent-overlay.tsx"), "utf8");
const roster = readFileSync(resolve(root, "modules/learn/model/learn-agent-roster.ts"), "utf8");
const marketingContract = readFileSync(resolve(root, "core/contracts/build-progress.ts"), "utf8");
const visualContract = readFileSync(resolve(root, "core/visual-contract/visual-contract.ts"), "utf8");
const page = readFileSync(resolve(root, "app/page.tsx"), "utf8");
const communityRoster = readFileSync(resolve(root, "app/community-agent-roster.tsx"), "utf8");
const publicPresentations = JSON.parse(readFileSync(resolve(root, "config/agent-profile-extensions/public.json"), "utf8"));
const skill = readFileSync(resolve(root, ".agents/skills/marquee-director/SKILL.md"), "utf8");
const visualContractSkill = readFileSync(resolve(root, ".agents/skills/visual-contract/SKILL.md"), "utf8");
const skillRegistry = JSON.parse(readFileSync(resolve(root, "config/agent-skills.json"), "utf8"));

test("#1080 unlocks Marquee only from canonical completed Foundations progression", () => {
  assert.match(marketing, /deriveGuidedCreationProgression\(curriculum, project\)\.foundations\.complete/);
  assert.match(overlay, /\{unlocked \? \([\s\S]*Marquee · Marketing Director/);
  assert.match(overlay, /if \(!unlocked && activeAgent === "marquee"\) setActiveAgent\("sage"\)/);
  assert.match(page, /<MarqueeAgentOverlay curriculum=\{plotPickleCurriculum\} \/>/);
});

test("#1080 keeps Marquee additive in LEARN while its official Community identity stays separate from private project context", () => {
  assert.match(overlay, /Creative Room agent selector/);
  assert.match(overlay, /WIZARD_ROSTER\.map/);
  assert.match(roster, /"sage-brinewick"[\s\S]*"tamsin-hearthquill"[\s\S]*"master-oaken-vague"[\s\S]*"rowan-scalequill"[\s\S]*"quillan-reedcloak"/);
  const rosterIndex = overlay.indexOf("WIZARD_ROSTER.map");
  const marqueeIndex = overlay.indexOf("Marquee · Marketing Director", rosterIndex);
  assert.ok(rosterIndex >= 0 && marqueeIndex > rosterIndex, "Marquee must remain additive after the five-wizard roster");
  assert.match(overlay, /aria-label="The Marquee Director private project agent"/);
  assert.doesNotMatch(overlay, /\/api\/local-buzz/);
  assert.equal(publicPresentations.profiles["marquee-director"].avatarRef, "/assets/helpers/lore/marquee-director.svg");
  assert.ok(publicPresentations.profiles["marquee-director"].executionContexts.includes("public-buzz"));
  assert.match(communityRoster, /publicAgentByProfileId\(PLOTPICKLE_COMMUNITY_EXTENSIONS, agent\.id\)/);
  assert.equal(skill.includes("not a BBS/Guildhall conversation agent in this workflow"), true);
  assert.equal(skill.includes("Do not publish, mirror or summarize private project context into BUZZ"), true);
});

test("#1080 derives a bounded Marketing Context from PPF Foundations evidence", () => {
  const deriveStart = marketing.indexOf("export function deriveMarketingContextV1");
  const deriveEnd = marketing.indexOf("function compactDecisionContext");
  assert.ok(deriveStart >= 0 && deriveEnd > deriveStart);
  const deriveSource = marketing.slice(deriveStart, deriveEnd);
  assert.match(deriveSource, /projectTitle: project\.title/);
  assert.match(deriveSource, /project\.foundations\.brief\.content/);
  assert.match(deriveSource, /Object\.entries\(project\.foundations\.lessons\)/);
  assert.match(deriveSource, /project\.build\.foundations\.acceptedVisualArtifactIds/);
  assert.doesNotMatch(deriveSource, /apiKey|privateKey|credential|creativeRoom|buzz/i);
  assert.match(marketing, /Use only the supplied Marketing Context as project fact/);
});

test("#1267 registers a shared provider-neutral Visual Contract Skill instead of another Agent", () => {
  const registered = skillRegistry.skills.find((candidate) => candidate.id === "visual-contract");
  assert.deepEqual(registered.roles, ["visual-contract"]);
  assert.equal(registered.primaryWorker, "host");
  assert.equal(registered.uri, "skill://plotpickle/visual-contract");
  assert.match(visualContractSkill, /Hard constraints[\s\S]*Derived constraints[\s\S]*Open choices/);
  assert.match(visualContractSkill, /lower-priority choice never overrides a higher-priority requirement/i);
  assert.match(visualContractSkill, /does not select providers, spend money, store credentials, call image services, mutate PPF/i);
  assert.match(visualContractSkill, /provider-neutral/i);
  assert.doesNotMatch(visualContractSkill, /new Agent\(|new Mastra\(/);
});

test("#1267 Visual Contract core separates authority, references, scene construction and independent validation", () => {
  assert.match(visualContract, /hardConstraints: readonly VisualConstraint\[\]/);
  assert.match(visualContract, /derivedConstraints: readonly VisualConstraint\[\]/);
  assert.match(visualContract, /openChoices: readonly string\[\]/);
  assert.match(visualContract, /referenceMap: readonly VisualContractReference\[\]/);
  assert.match(visualContract, /macroScene: readonly string\[\]/);
  assert.match(visualContract, /elementInventory: readonly VisualContractElement\[\]/);
  assert.match(visualContract, /relationships: readonly VisualContractRelationship\[\]/);
  assert.match(visualContract, /geometry: readonly string\[\]/);
  assert.match(visualContract, /composition: readonly string\[\]/);
  assert.match(visualContract, /lighting: readonly string\[\]/);
  assert.match(visualContract, /textRequirements: readonly string\[\]/);
  assert.match(visualContract, /failureConstraints: readonly string\[\]/);
  assert.match(visualContract, /validationChecks: readonly VisualContractValidation\[\]/);
  assert.match(visualContract, /priority: hardConstraints\.length \+ index \+ 1/);
  assert.match(visualContract, /Open choices may fill unspecified details only when they do not conflict with hard or derived constraints/);
  assert.doesNotMatch(visualContract, /GPT Image|Nano Banana|OpenAI|ComfyUI|MiniMax/i);
});

test("#1267 compiles the first Marquee poster from the shared Visual Contract while preserving Foundations authority", () => {
  assert.match(marketing, /buildFoundationsMarketingVisualContract/);
  assert.match(marketing, /buildVisualContract\(\{/);
  assert.match(marketing, /compileVisualContractPrompt\(buildFoundationsMarketingVisualContract\(context\)\)/);
  assert.match(marketing, /canonical project title is/);
  assert.match(marketing, /Treat supplied Foundations decisions and brief as story authority/);
  assert.match(marketing, /roles: \["visual-language" as const\]/);
  assert.match(marketing, /Produce exactly one standalone poster image/);
  assert.match(marketing, /Do not add fake billing blocks, critic quotes, awards, festival laurels, release dates, studio\/platform logos/);
  assert.match(skill, /shared `visual-contract` Skill/);
  assert.match(skill, /provider-specific prompt must never silently weaken project-title spelling, accepted Foundations facts, accepted visual-reference intentions/);
});

test("#1080 generates exactly one first poster through existing image routing and never silently promotes cloud", () => {
  assert.match(overlay, /"\/api\/ai-routing\/status"/);
  assert.match(overlay, /"\/api\/local-ai\/generate\/image"/);
  assert.match(overlay, /aspect: "portrait"/);
  assert.match(overlay, /requestCount: 1/);
  assert.match(overlay, /cloudRoute && !billingAcknowledged/);
  assert.match(overlay, /Manual image mode is selected/);
  assert.match(marketing, /Produce exactly one standalone poster image/);
  assert.match(marketing, /comparison sheet, contact sheet, triptych or alternate set/);
});

test("#1080 automatically stores the successful poster as a PPF Marketing Reference without a v1 approval surface", () => {
  assert.match(marketingContract, /FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW/);
  assert.match(marketingContract, /marquee-director\/\$\{FOUNDATIONS_MARKETING_REFERENCE_RECIPE\}/);
  assert.match(marketingContract, /authority:marketing-reference/);
  assert.match(marketing, /reviewState: "draft"/);
  assert.match(overlay, /type: "foundations\.visual\.store"/);
  assert.match(overlay, /automatically saved as the PPF Marketing Reference/);
  assert.match(overlay, /data-marketing-reference="current"/);
  assert.doesNotMatch(overlay, />\s*(Approve|Accept|Reject|Regenerate|Try again)\s*</i);
  assert.doesNotMatch(overlay, /foundations\.visual\.(accept|discard|unaccept)/);
});

test("#1080 keeps the first poster out of story canon and preserves provenance for later marketing progression", () => {
  assert.match(marketing, /PPF Marketing Reference · first poster after Foundations/);
  assert.match(marketingContract, /ppf-revision:/);
  assert.match(marketingContract, /recipe:/);
  assert.match(marketingContract, /decision:/);
  assert.match(marketingContract, /artifact:/);
  assert.match(overlay, /It is marketing key art, not story canon/);
  assert.match(skill, /Marketing Reference is key-art authority for later marketing work, not story canon/);
  assert.match(skill, /writer is not asked to approve\/select\/reject\/regenerate it yet/);
});

test("#1080 reuses the existing Mastra visual-director runtime instead of creating a parallel agent engine", () => {
  assert.match(overlay, /agentId: "visual-director"/);
  assert.match(skill, /Mastra visual-director role/);
  assert.doesNotMatch(overlay, /new Agent\(|new Mastra\(/);
});
