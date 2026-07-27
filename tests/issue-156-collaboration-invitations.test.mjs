import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (filePath) => readFile(new URL(filePath, root), "utf8");

async function invitationContract() {
  const raw = (await source("lib/collaboration-invitations.ts")).replace(/\r\n?/g, "\n");
  const withoutImports = raw.replace(/import[\s\S]*?;\n/g, "");
  const compiled = stripTypeScriptTypes(withoutImports, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}

function project() {
  return {
    id: "story-156",
    metadata: { title: "Invitation Story", updatedAt: "2026-07-27T00:00:00.000Z" },
    collaboration: {
      provider: "none", repositoryUrl: "", sourceRepositoryUrl: "", owner: "", repo: "", branch: "main", projectPath: "project",
      syncEnabled: false, lastPulledCommit: "", lastPushedCommit: "", connectedAt: "", role: "project-lead", invitationId: "",
      invitationRecipientName: "", invitationIssuer: "", invitationIssuedAt: "", invitationExpiresAt: "", defaultWorkspace: "dashboard", readOnlyReview: false, acceptingProposals: true, updatedAt: "",
    },
  };
}

function invitationInput(role = "writer") {
  return {
    invitationId: `invite-${role}`,
    projectId: "story-156",
    title: "Invitation Story",
    repositoryUrl: "https://github.com/example/invitation-story",
    owner: "example",
    repo: "invitation-story",
    approvedBranch: "main",
    canonicalRoot: "project",
    role,
    recipientName: "Taylor",
    issuer: "Project Lead",
    issuedAt: "2026-07-27T12:00:00.000Z",
    expiresAt: "2026-08-10T12:00:00.000Z",
  };
}

test("issue #156 creates credential-free role invitations with deterministic validation", async () => {
  const contract = await invitationContract();
  for (const role of contract.INVITABLE_COLLABORATION_ROLES) {
    const invitation = contract.createCollaborationInvitation(invitationInput(role));
    const serialized = contract.serializeCollaborationInvitation(invitation);
    assert.doesNotMatch(serialized, /accessToken|refreshToken|apiKey|clientSecret|privateKey|credentialPath/);
    const parsed = contract.parseCollaborationInvitation(JSON.parse(serialized), {
      now: "2026-07-28T12:00:00.000Z",
      expectedProjectId: "story-156",
      expectedOwner: "example",
      expectedRepo: "invitation-story",
      expectedBranch: "main",
    });
    assert.equal(parsed.invitation.role, role);
    assert.equal(parsed.defaults.defaultWorkspace, contract.COLLABORATION_ROLE_DEFAULTS[role].defaultWorkspace);
  }
});

test("issue #156 rejects changed, expired, revoked and wrong-project invitations", async () => {
  const contract = await invitationContract();
  const invitation = contract.createCollaborationInvitation(invitationInput("reviewer"));
  const changed = structuredClone(invitation);
  changed.invitation.role = "writer";
  assert.throws(() => contract.parseCollaborationInvitation(changed, { now: "2026-07-28T12:00:00.000Z" }), /integrity check/);
  assert.throws(() => contract.parseCollaborationInvitation(invitation, { now: "2026-08-10T12:00:00.000Z" }), /expired/);
  assert.throws(() => contract.parseCollaborationInvitation(invitation, { now: "2026-07-28T12:00:00.000Z", revokedInvitationIds: [invitation.invitationId] }), /revoked/);
  assert.throws(() => contract.parseCollaborationInvitation(invitation, { now: "2026-07-28T12:00:00.000Z", expectedProjectId: "another-story" }), /different story project/);
});

test("issue #156 applies role defaults and locks reviewer canon and proposals", async () => {
  const contract = await invitationContract();
  const reviewer = contract.createCollaborationInvitation(invitationInput("reviewer"));
  const reviewed = contract.applyCollaborationInvitation(project(), reviewer);
  assert.equal(reviewed.collaboration.role, "reviewer");
  assert.equal(reviewed.collaboration.defaultWorkspace, "feedback");
  assert.equal(reviewed.collaboration.invitationRecipientName, "Taylor");
  assert.equal(reviewed.collaboration.invitationIssuedAt, "2026-07-27T12:00:00.000Z");
  assert.equal(reviewed.collaboration.readOnlyReview, true);
  assert.equal(contract.collaborationCanEditCanon(reviewed), false);
  assert.equal(contract.collaborationCanSubmitProposal(reviewed), false);

  const writer = contract.applyCollaborationInvitation(project(), contract.createCollaborationInvitation(invitationInput("writer")));
  assert.equal(writer.collaboration.defaultWorkspace, "script");
  assert.equal(contract.collaborationCanEditCanon(writer), true);
  assert.equal(contract.collaborationCanSubmitProposal(writer), true);
  writer.collaboration.acceptingProposals = false;
  assert.equal(contract.collaborationCanSubmitProposal(writer), false);
});

test("issue #156 requires the remote registry to match invitation metadata", async () => {
  const contract = await invitationContract();
  const invitation = contract.createCollaborationInvitation(invitationInput("director"));
  const record = {
    invitationId: invitation.invitationId,
    role: invitation.invitation.role,
    recipientName: invitation.invitation.recipientName,
    issuer: invitation.invitation.issuer,
    issuedAt: invitation.invitation.issuedAt,
    expiresAt: invitation.invitation.expiresAt,
    status: "active",
  };
  assert.equal(contract.invitationMatchesRegistryRecord(invitation, record), true);
  assert.equal(contract.invitationMatchesRegistryRecord(invitation, { ...record, role: "producer" }), false);
  assert.equal(contract.invitationMatchesRegistryRecord(invitation, { ...record, expiresAt: "2026-09-01T00:00:00.000Z" }), false);
});

test("issue #156 gateway enforces Project Lead controls and invitation status server-side", async () => {
  const gateway = await source("build/github-review-gateway.ts");
  for (const phrase of [
    "collaboration/invitations.json",
    "createCollaborationInvitation",
    "invitationMatchesRegistryRecord",
    "validateContributorInvitation",
    "Only the Project Lead can change collaboration settings or invitation status",
    "requireProjectLead(input)",
    "The Project Lead paused new Story Proposals",
    "This PlotPickle invitation has been revoked",
    "This PlotPickle invitation has expired",
    "registered recipient, issuer, issue date or expiry details",
    "metadataMatches",
    "/collaboration-settings",
    "/create-invitation",
    "/revoke-invitation",
    "/validate-invitation",
    "force: false",
    "expectedBaseCommit",
  ]) assert.ok(gateway.includes(phrase), `Phase 5 gateway is missing: ${phrase}`);
  assert.doesNotMatch(gateway, /accessToken:\s*invitation|refreshToken:\s*invitation|apiKey:\s*invitation/);
});

test("issue #156 provides invited onboarding, role guidance and reviewer-safe UI", async () => {
  const [workspace, invitations, appConnection, proposals, projectSync, syncGateway, page, docs] = await Promise.all([
    source("app/github-collaboration.tsx"),
    source("app/collaboration-invitations.tsx"),
    source("app/github-app-connection.tsx"),
    source("app/story-proposals.tsx"),
    source("app/github-project-sync.tsx"),
    source("build/github-project-sync-gateway.ts"),
    source("app/page.tsx"),
    source("docs/issue-156-collaboration-invitations.md"),
  ]);
  for (const phrase of ["CollaborationInvitations", "preferredRepository", "invitationMode", "Repository details supplied by .ppinvite"]) assert.ok(workspace.includes(phrase));
  for (const phrase of ["Open .ppinvite", "Create .ppinvite", "Accepting Proposals", "Read-only review", "onOpenWorkspace", "Revoke"]) assert.ok(invitations.includes(phrase));
  for (const phrase of ["Invitation-selected story project", "Connect invited story project", "without asking for repository metadata"]) assert.ok(appConnection.includes(phrase));
  assert.match(proposals, /collaborationCanSubmitProposal/);
  assert.match(proposals, /only the Project Lead can approve or decline a Story Proposal/i);
  assert.match(proposals, /callerInvitationId/);
  assert.match(projectSync, /only the Project Lead can publish the approved folder/i);
  assert.match(syncGateway, /Only the Project Lead can publish the approved project folder or create repository release snapshots/);
  assert.match(syncGateway, /requireProjectLead\(project\)/);
  assert.match(page, /Reviewer read-only mode/);
  assert.match(page, /commitReview/);
  for (const phrase of ["Writer → Write", "Reviewer → Feedback in read-only review mode", "exactly", "encrypted local secrets area"]) assert.ok(docs.includes(phrase));
});

test("issue #156 schema and package scripts are registered", async () => {
  const [schema, legacySchema, packageJson] = await Promise.all([
    source("schema/plotpickle-project.schema.json").then(JSON.parse),
    source("schema/plotpickle-project-v1.7.schema.json").then(JSON.parse),
    source("package.json").then(JSON.parse),
  ]);
  for (const item of [schema, legacySchema]) {
    const collaboration = item.$defs.projectCollaboration;
    for (const field of ["role", "invitationId", "invitationRecipientName", "invitationIssuer", "invitationIssuedAt", "invitationExpiresAt", "defaultWorkspace", "readOnlyReview", "acceptingProposals"]) {
      assert.ok(collaboration.properties[field]);
    }
  }
  assert.match(packageJson.scripts.test, /issue-156-collaboration-invitations\.test\.mjs/);
  assert.equal(packageJson.scripts["test:collaboration-invitations"], "node --test tests/issue-156-collaboration-invitations.test.mjs");
});
