import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const marketing = readFileSync(resolve(root, "modules/learn/model/marquee-director.ts"), "utf8");
const overlay = readFileSync(resolve(root, "modules/learn/ui/marquee-agent-overlay.tsx"), "utf8");
const marketingContract = readFileSync(resolve(root, "core/contracts/build-progress.ts"), "utf8");
const page = readFileSync(resolve(root, "app/page.tsx"), "utf8");
const communityRoster = readFileSync(resolve(root, "app/community-agent-roster.tsx"), "utf8");
const skill = readFileSync(resolve(root, ".agents/skills/marquee-director/SKILL.md"), "utf8");

test("#1080 unlocks Marquee only from canonical completed Foundations progression", () => {
  assert.match(marketing, /deriveGuidedCreationProgression\(curriculum, project\)\.foundations\.complete/);
  assert.match(overlay, /Complete Foundations to unlock/);
  assert.match(overlay, /disabled=\{!unlocked\}/);
  assert.match(overlay, /if \(!unlocked && activeAgent === "marquee"\) setActiveAgent\("sage"\)/);
  assert.match(page, /<MarqueeAgentOverlay curriculum=\{plotPickleCurriculum\} \/>/);
});

test("#1080 keeps Marquee beside Sage in LEARN and out of the Community BBS UI", () => {
  assert.match(overlay, /Creative Room agent selector/);
  assert.match(overlay, />Sage<\/button>/);
  assert.match(overlay, /Marquee\{unlocked \? "" : " · locked"\}/);
  assert.match(overlay, /aria-label="The Marquee Director private project agent"/);
  assert.doesNotMatch(overlay, /\/api\/local-buzz/);
  assert.match(communityRoster, /PRIVATE_PROJECT_AGENT_IDS = new Set\(\["marquee-director"\]\)/);
  assert.match(communityRoster, /\.filter\(\(agent\) => !PRIVATE_PROJECT_AGENT_IDS\.has\(agent\.id\)\)/);
  assert.equal(skill.includes("not a BBS/Guildhall conversation agent"), true);
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

test("#1080 generates exactly one first poster through existing image routing and never silently promotes cloud", () => {
  assert.match(overlay, /"\/api\/ai-routing\/status"/);
  assert.match(overlay, /"\/api\/local-ai\/generate\/image"/);
  assert.match(overlay, /aspect: "portrait"/);
  assert.match(overlay, /requestCount: 1/);
  assert.match(overlay, /cloudRoute && !billingAcknowledged/);
  assert.match(overlay, /Manual image mode is selected/);
  assert.match(marketing, /Output exactly one poster image/);
  assert.match(marketing, /Do not create a comparison sheet, contact sheet, alternate version, triptych or multiple poster concepts/);
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
