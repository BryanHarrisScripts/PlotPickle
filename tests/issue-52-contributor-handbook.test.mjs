import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const modelPath = new URL("../lib/collaboration-handbook.ts", import.meta.url);
const learningPath = new URL("../app/learning-working-together.ts", import.meta.url);
const pagePath = new URL("../app/collaboration-handbook/page.tsx", import.meta.url);
const cssPath = new URL("../app/collaboration-handbook/collaboration-handbook.module.css", import.meta.url);

const [model, learning, page, css] = await Promise.all([
  readFile(modelPath, "utf8"),
  readFile(learningPath, "utf8"),
  readFile(pagePath, "utf8"),
  readFile(cssPath, "utf8"),
]);

test("issue 52 maps the legacy Collaborators guide into a complete learning collection", () => {
  for (const alias of [
    "Your Role and Key Questions",
    "Process Post-Submission",
    "Feedback and Communication",
    "Unlimited Contributions",
    "Evolving Together",
    "Act review questions",
    "Afterglow collaborator guide",
  ]) {
    assert.match(learning, new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.match(learning, /collaboratorSourceMap/);
  assert.match(learning, /11 PlotPickled lessons|workingTogetherLessons/);
  for (const lesson of [
    "Choose the Collaboration Model",
    "Define Roles and Decision Authority",
    "Create a Contribution Brief",
    "Start From the Approved Story",
    "Submit a Reviewable Proposal",
    "Review the Change, Not the Person",
    "Make the Canon Decision Explicit",
    "Resolve Creative Disagreements",
    "Record Credit, Ownership and Permissions",
    "Protect Privacy and Unfinished Work",
    "Scale Beyond One Owner and a Few Contributors",
  ]) assert.match(learning, new RegExp(lesson.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("issue 52 supports every required collaboration model without requiring GitHub", () => {
  for (const modelId of [
    "solo-feedback",
    "private-review",
    "invited-contributor",
    "co-writing",
    "commissioned",
    "production-team",
    "public-feedback",
    "open-community",
  ]) assert.match(model, new RegExp(`id: "${modelId}"`));
  assert.match(model, /local-only/);
  assert.match(model, /private-file-exchange/);
  assert.match(model, /private-repository/);
  assert.match(model, /public-repository/);
  assert.match(learning, /GitHub is optional|No public repository, GitHub account|local-only/i);
});

test("issue 52 separates roles and creative authority from technical permissions", () => {
  for (const roleId of [
    "project-owner",
    "co-owner-maintainer",
    "writer-co-writer",
    "contributor",
    "reviewer",
    "story-editor",
    "research-continuity",
    "specialist-contributor",
  ]) assert.match(model, new RegExp(`id: "${roleId}"`));
  for (const authority of [
    "view",
    "comment",
    "create-review-threads",
    "propose-changes",
    "edit-rights-records",
    "approve-specialist-assets",
    "merge-canon",
    "change-licence",
    "manage-collaborators",
  ]) assert.match(model, new RegExp(`"${authority}"`));
  assert.match(learning, /Creative authority is not the same as repository access|Technical permission/i);
  assert.match(page, /Save rights and authority records/);
});

test("issue 52 provides canonical contribution briefs and all requested templates", () => {
  assert.match(model, /export type ContributionBrief/);
  for (const field of [
    "title",
    "contributorId",
    "requestedRole",
    "decisionMaker",
    "targetKind",
    "problem",
    "storyPurpose",
    "canonLocks",
    "mustNotChange",
    "preferredOutput",
    "creativeFreedom",
    "dueDate",
    "reviewWindow",
    "privacy",
    "creditExpectation",
    "compensationReference",
    "ownershipReference",
    "licenceReference",
    "acceptanceCriteria",
  ]) assert.match(model, new RegExp(`${field}:`));
  for (const template of [
    "Feedback only",
    "Rewrite proposal",
    "Alternative scene or Block",
    "Dialogue pass",
    "Character or world contribution",
    "Research or continuity check",
    "Storyboard, music or production asset",
    "Pitch or marketing material",
  ]) assert.match(model, new RegExp(template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(page, /Save contribution brief/);
});

test("issue 52 creates shareable welcome cards without granting rights or access", () => {
  assert.match(model, /buildWelcomeCardMarkdown/);
  assert.match(model, /buildWelcomeCardHtml/);
  for (const phrase of [
    "Project owner:",
    "Collaboration model:",
    "Your role:",
    "Privacy and sharing:",
    "Current brief:",
    "Decision path:",
    "Reuse licence:",
  ]) assert.match(model, new RegExp(phrase));
  assert.match(page, /Download Markdown/);
  assert.match(page, /Download HTML/);
  assert.match(page, /does not itself grant access, ownership or a licence/i);
});

test("issue 52 teaches approved-story, local-draft and stale-base safety", () => {
  assert.match(learning, /Pull approved story/);
  assert.match(learning, /Compare before applying/);
  assert.match(learning, /Work locally/);
  assert.match(learning, /Stale proposal/);
  assert.match(page, /Approved story → local draft → proposal → review → decision → canon/);
  assert.match(page, /does not pretend two complete creative versions can always be mechanically merged/i);
  assert.match(page, /lastPulledCommit/);
});

test("issue 52 creates structured proposal review packets", () => {
  assert.match(model, /export type ProposalReviewPacket/);
  for (const field of [
    "changed",
    "reason",
    "audienceEffect",
    "affectedAreas",
    "beforeAfterEvidence",
    "dependencies",
    "characterEffects",
    "continuityEffects",
    "runtimeProductionEffects",
    "rightsEffects",
    "newCanonAssumptions",
    "unresolvedQuestions",
    "alternativesConsidered",
    "sourceRecordIds",
    "aiProvenanceIds",
    "requestedCredit",
    "inspectClosely",
    "baseRevision",
    "pullRequestNumber",
  ]) assert.match(model, new RegExp(`${field}:`));
  assert.match(model, /buildProposalSummary/);
  assert.match(page, /Copy GitHub contributor note/);
});

test("issue 52 categorizes and anchors feedback with complete outcomes", () => {
  for (const category of ["required", "continuity", "rights", "craft", "question", "preference", "praise"]) assert.match(model, new RegExp(`"${category}"`));
  for (const outcome of ["accepted", "changes-requested", "question-for-contributor", "deferred", "declined", "superseded", "withdrawn", "resolved-without-change"]) assert.match(model, new RegExp(`"${outcome}"`));
  assert.match(model, /type CategorizedReviewNote/);
  assert.match(model, /anchor: ReviewAnchor/);
  assert.match(page, /Observation or audience experience/);
  assert.match(page, /Specific evidence/);
  assert.match(page, /Intended outcome/);
});

test("issue 52 records explicit canon decisions with revision snapshots", () => {
  for (const outcome of ["merged", "declined", "deferred", "withdrawn", "superseded"]) assert.match(model, new RegExp(`"${outcome}"`));
  assert.match(model, /recordCollaborationDecision/);
  assert.match(model, /createRevisionSnapshot/);
  assert.match(model, /revisionSnapshotId/);
  assert.match(page, /Record decision and snapshot/);
  assert.match(page, /Accepted portions/);
  assert.match(page, /Declined portions/);
  assert.match(page, /Follow-up work/);
});

test("issue 52 connects credit, ownership, permissions and accepted work", () => {
  assert.match(model, /addRightsCollaborator/);
  assert.match(model, /ownershipShare/);
  assert.match(model, /agreementReference/);
  assert.match(model, /creditedAs/);
  assert.match(learning, /feedback does not automatically create ownership/i);
  assert.match(learning, /GitHub pull request is not a collaboration, employment, assignment or licence agreement/i);
  assert.match(learning, /software and documentation licences do not automatically apply/i);
});

test("issue 52 protects privacy, credentials and unfinished local work", () => {
  assert.match(learning, /Local drafts, autosaves, AI prompts and private assets do not leave the computer/i);
  assert.match(learning, /secrets remain outside the `.ppf`/i);
  assert.match(learning, /Only intentionally submitted proposal material is shared/i);
  assert.match(page, /Autosaves, prompts and drafts remain private/);
  assert.match(page, /GitHub is optional/);
});

test("issue 52 provides contextual Act, Block, scene and character review questions", () => {
  assert.match(model, /contextualCollaborationQuestions/);
  assert.match(model, /act === 1/);
  assert.match(model, /act === 2/);
  assert.match(model, /act === 3/);
  assert.match(model, /Selected Block evidence/);
  assert.match(model, /Selected scene/);
  assert.match(model, /characterName|character\.name|For \$\{character\.name\}/);
  assert.match(page, /contextualQuestions\.map/);
});

test("issue 52 stores structured records in portable canonical review, rights and revision data", () => {
  for (const marker of [
    "PLOTPICKLE_COLLAB_AGREEMENT_V1",
    "PLOTPICKLE_AUTHORITY_V1",
    "PLOTPICKLE_BRIEF_V1",
    "PLOTPICKLE_PACKET_V1",
    "PLOTPICKLE_DECISION_V1",
    "PLOTPICKLE_REVIEW_NOTE_V1",
  ]) assert.match(model, new RegExp(marker));
  assert.match(model, /project\.review\.threads|next\.review\.threads/);
  assert.match(model, /project\.rights\.collaborators|next\.rights\.collaborators/);
  assert.match(model, /createRevisionSnapshot/);
  assert.doesNotMatch(model, /localStorage/);
  assert.match(page, /window\.localStorage\.setItem\(STORAGE_KEY/);
});

test("issue 52 contributor workspace is responsive and exposes all operating sections", () => {
  for (const id of ["dashboard", "agreement", "roles", "briefs", "workflow", "proposals", "reviews", "decisions", "learning"]) assert.match(page, new RegExp(`id="${id}"`));
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.modelGrid/);
  assert.match(css, /\.authorityGrid/);
  assert.match(css, /\.flow/);
  assert.match(css, /\.lessonGrid/);
});


test("issue 52 appears as a first-class collection in the central Read & Learn library", async () => {
  const studio = await readFile(new URL("../app/learning-studio.tsx", import.meta.url), "utf8");
  assert.match(studio, /workingTogetherLessons/);
  assert.match(studio, /Working Together in PlotPickle/);
  assert.match(studio, /setView\("working-together"\)/);
  assert.match(studio, /isWorkingTogetherLesson/);
  assert.match(studio, /Contributor Handbook/);
});
