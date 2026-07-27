import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (filePath) => readFile(new URL(filePath, root), "utf8");

async function invitationContract() {
  const raw = (await source("lib/collaboration-invitations.ts")).replace(/\r\n?/g, "\n");
  const compiled = stripTypeScriptTypes(raw, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}

function invitationInput(overrides = {}) {
  return {
    projectId: "story-156",
    projectTitle: "Invitation Story",
    owner: "PlotPickleOwner",
    repo: "invitation-story",
    repositoryUrl: "https://github.com/PlotPickleOwner/invitation-story",
    branch: "main",
    projectRoot: "project",
    role: "writer",
    recipientName: "Casey Writer",
    issuerName: "Project Lead",
    issuerGitHubLogin: "PlotPickleOwner",
    issuedAt: "2026-07-27T12:00:00.000Z",
    expiresAt: "2026-08-27T12:00:00.000Z",
    note: "Revise dialogue and submit a Story Proposal.",
    invitationId: "invite-story-156-writer",
    ...overrides,
  };
}

test("issue #156 creates credential-free role invitations with derived permissions", async () => {
  const contract = await invitationContract();
  const writer = contract.createPlotPickleInvitation(invitationInput());
  assert.equal(writer.role, "writer");
  assert.equal(writer.permissions.readOnly, false);
  assert.equal(writer.permissions.canSubmitProposals, true);
  assert.equal(writer.repository.projectRoot, "project");
  assert.equal(contract.invitationFileName(writer), "Invitation-Story-writer.ppinvite");

  const reviewer = contract.createPlotPickleInvitation(invitationInput({ role: "reviewer", recipientName: "Riley Reviewer", invitationId: "invite-reviewer" }));
  assert.equal(reviewer.permissions.readOnly, true);
  assert.equal(reviewer.permissions.canSubmitProposals, false);
  assert.equal(contract.collaborationRoleProfile("reviewer").primaryWorkspace, "/feedback");
  assert.deepEqual(contract.COLLABORATION_ROLE_PROFILES.map((profile) => profile.id), ["writer", "director", "actor", "producer", "reviewer"]);

  const serialized = contract.serializePlotPickleInvitation(writer);
  assert.doesNotMatch(serialized, /accessToken|refreshToken|clientSecret|privateKey|password/i);
  assert.equal(contract.parsePlotPickleInvitation(serialized).invitationId, writer.invitationId);
});

test("issue #156 rejects expired, revoked, wrong-project and credential-bearing invitations", async () => {
  const contract = await invitationContract();
  const invitation = contract.createPlotPickleInvitation(invitationInput());
  const policy = contract.createCollaborationPolicy("story-156", "Project Lead");

  assert.throws(() => contract.validateInvitationUse({ invitation, now: "2026-09-01T00:00:00.000Z" }), /expired/i);
  assert.throws(() => contract.validateInvitationUse({ invitation, projectId: "another-story" }), /different project/i);
  assert.throws(() => contract.validateInvitationUse({ invitation, owner: "SomeoneElse" }), /does not match/i);
  assert.throws(() => contract.validateInvitationUse({ invitation, policy: { ...policy, revokedInvitationIds: [invitation.invitationId] } }), /revoked/i);

  const unsafe = JSON.parse(contract.serializePlotPickleInvitation(invitation));
  unsafe.repository.accessToken = "not-allowed";
  assert.throws(() => contract.parsePlotPickleInvitation(unsafe), /forbidden credential material/i);
});

test("issue #156 normalizes canonical proposal policy deterministically", async () => {
  const contract = await invitationContract();
  const policy = contract.parseCollaborationPolicy({
    format: contract.PLOTPICKLE_COLLABORATION_POLICY_FORMAT,
    formatVersion: contract.PLOTPICKLE_COLLABORATION_POLICY_VERSION,
    projectId: "story-156",
    acceptingProposals: false,
    revokedInvitationIds: ["z-last", "a-first", "z-last", ""],
    updatedAt: "2026-07-27T12:00:00.000Z",
    updatedBy: "Lead",
  }, "story-156");
  assert.equal(policy.acceptingProposals, false);
  assert.deepEqual(policy.revokedInvitationIds, ["a-first", "z-last"]);
  assert.match(contract.serializeCollaborationPolicy(policy), /"acceptingProposals": false/);
  assert.throws(() => contract.parseCollaborationPolicy({ ...policy, projectId: "wrong" }, "story-156"), /different PlotPickle project/i);
});

test("issue #156 enforces roles and Accepting Proposals before protected APIs", async () => {
  const [guard, gateway, vite] = await Promise.all([
    source("build/collaboration-access-guard.ts"),
    source("build/collaboration-invitation-gateway.ts"),
    source("vite.config.ts"),
  ]);
  for (const phrase of [
    "/api/local-github/submit-proposal",
    "/api/local-github/approve-proposal",
    "/api/local-github/decline-proposal",
    "/api/local-collaboration/create-invitation",
    "/api/local-collaboration/policy",
    "Only the Project Lead workspace",
    "not accepting new Story Proposals",
    "does not permit Story Proposal submission",
    "validateInvitationUse",
  ]) assert.ok(guard.includes(phrase), `Collaboration access guard is missing: ${phrase}`);
  assert.ok(vite.indexOf("collaborationAccessGuard()") < vite.indexOf("githubReviewGateway()"), "Role guard must run before Story Proposal routes.");
  assert.ok(vite.indexOf("collaborationAccessGuard()") < vite.indexOf("collaborationInvitationGateway()"), "Role guard must run before invitation policy routes.");
  for (const phrase of [
    "collaboration/policy.json",
    "force: false",
    "expectedRemoteCommit",
    "collaboration-invitation.json",
    "writeCredentialJson",
    "removeCredentialFile",
  ]) assert.ok(gateway.includes(phrase), `Invitation gateway is missing: ${phrase}`);
  assert.doesNotMatch(gateway, /writeCredentialJson\([^,]+,\s*[^)]*token/i);
});

test("issue #156 exposes role-first onboarding and Project Lead-only decisions", async () => {
  const [component, proposals, styles, docs, contractSource] = await Promise.all([
    source("app/collaboration-invitations.tsx"),
    source("app/story-proposals.tsx"),
    source("app/collaboration-invitations.module.css"),
    source("docs/issue-156-collaboration-invitations.md"),
    source("lib/collaboration-invitations.ts"),
  ]);
  for (const phrase of [
    "Open a .ppinvite",
    "Create and download .ppinvite",
    "Accepting Proposals",
    "Read-only review",
    "repository details already inside the invitation",
    "Revoked invitation IDs",
  ]) assert.ok(component.includes(phrase), `Invitation UI is missing: ${phrase}`);
  for (const role of ["writer", "director", "actor", "producer", "reviewer"]) assert.ok(contractSource.includes(`id: "${role}"`), `Role profile is missing: ${role}`);
  assert.match(proposals, /access\.isProjectLead/);
  assert.match(proposals, /access\.canSubmitProposals/);
  assert.match(proposals, /access\.acceptingProposals/);
  assert.match(proposals, /disabled=\{!access\.isProjectLead\}/);
  for (const className of ["panel", "modeBadge", "roleWorkspace", "leadGrid", "rolePreview", "toggle", "revokedList"]) {
    assert.ok(styles.includes(`.${className}`), `Invitation styling is missing: ${className}`);
  }
  for (const phrase of ["credential-free `.ppinvite`", "role-based defaults", "read-only review", "Accepting Proposals", "server-side access guard", "repository metadata hidden", "Phase 6"]) {
    assert.ok(docs.includes(phrase), `Phase 5 documentation is missing: ${phrase}`);
  }
});

test("issue #156 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-156-collaboration-invitations\.test\.mjs/);
  assert.equal(packageJson.scripts["test:collaboration-invitations"], "node --test tests/issue-156-collaboration-invitations.test.mjs");
});
