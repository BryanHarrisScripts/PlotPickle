import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
async function contract() {
  const raw = (await source("lib/collaboration-invitations.ts")).replace(/\r\n?/g, "\n");
  const compiled = stripTypeScriptTypes(raw, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}
function invitationInput(role = "writer") {
  return { invitationId: `invite-${role}`, projectId: "story-156", title: "Invitation Story", repositoryUrl: "https://github.com/example/invitation-story", owner: "example", repo: "invitation-story", approvedBranch: "main", canonicalRoot: "project", role, recipientName: "Taylor", issuer: "Project Lead", issuedAt: "2026-07-27T12:00:00.000Z", expiresAt: "2026-08-10T12:00:00.000Z" };
}

test("issue #156 creates credential-free invitations for every collaborator role", async () => {
  const api = await contract();
  for (const role of api.COLLABORATION_ROLES) {
    const invitation = api.createCollaborationInvitation(invitationInput(role));
    const serialized = api.serializeCollaborationInvitation(invitation);
    assert.doesNotMatch(serialized, /accessToken|refreshToken|apiKey|clientSecret|privateKey|credentialPath/);
    const parsed = api.parseCollaborationInvitation(JSON.parse(serialized), { now: "2026-07-28T12:00:00.000Z", expectedProjectId: "story-156", expectedRepository: "example/invitation-story" });
    assert.equal(parsed.invitation.role, role);
    assert.equal(parsed.defaults.defaultWorkspace, api.COLLABORATION_ROLE_DEFAULTS[role].defaultWorkspace);
  }
});

test("issue #156 rejects changed, expired, revoked and wrong-project packages", async () => {
  const api = await contract(); const invitation = api.createCollaborationInvitation(invitationInput("reviewer"));
  const changed = structuredClone(invitation); changed.invitation.role = "writer";
  assert.throws(() => api.parseCollaborationInvitation(changed, { now: "2026-07-28T12:00:00.000Z" }), /integrity/);
  assert.throws(() => api.parseCollaborationInvitation(invitation, { now: "2026-08-10T12:00:00.000Z" }), /expired/);
  assert.throws(() => api.parseCollaborationInvitation(invitation, { now: "2026-07-28T12:00:00.000Z", revokedIds: [invitation.invitationId] }), /revoked/);
  assert.throws(() => api.parseCollaborationInvitation(invitation, { now: "2026-07-28T12:00:00.000Z", expectedProjectId: "other" }), /different story project/);
});

test("issue #156 preserves exact registry identity and reviewer defaults", async () => {
  const api = await contract(); const invitation = api.createCollaborationInvitation(invitationInput("reviewer"));
  const record = { invitationId: invitation.invitationId, role: "reviewer", recipientName: "Taylor", issuer: "Project Lead", issuedAt: invitation.invitation.issuedAt, expiresAt: invitation.invitation.expiresAt, status: "active" };
  assert.equal(api.invitationMatchesRecord(invitation, record), true);
  assert.equal(api.invitationMatchesRecord(invitation, { ...record, expiresAt: "2026-09-01T00:00:00.000Z" }), false);
  assert.equal(api.COLLABORATION_ROLE_DEFAULTS.reviewer.readOnlyReview, true);
  assert.equal(api.COLLABORATION_ROLE_DEFAULTS.reviewer.canSubmitProposals, false);
  assert.equal(api.COLLABORATION_ROLE_DEFAULTS.writer.workspaceHref.includes("tab=script"), true);
  assert.equal(api.COLLABORATION_ROLE_DEFAULTS.director.workspaceHref.includes("storyboard"), true);
  assert.equal(api.COLLABORATION_ROLE_DEFAULTS.producer.workspaceHref.includes("reports"), true);
});

test("issue #156 server gateway guards existing collaboration engines before they run", async () => {
  const [gateway, github] = await Promise.all([source("build/collaboration-invitation-gateway.ts"), source("build/collaboration-invitation-github.ts")]);
  for (const phrase of ["/api/local-github/submit-proposal", "/api/local-github/approve-proposal", "/api/local-github/decline-proposal", "/api/local-github-sync/publish", "/api/local-github-sync/release-snapshot", "Reviewer read-only mode cannot create Story Proposals", "paused new Story Proposals", "hasProjectLeadPermission", "force: false"]) assert.ok(`${gateway}\n${github}`.includes(phrase), phrase);
  for (const phrase of ["collaboration/invitations.json", "plotpickle-project.json", "invitationMatchesRecord", "expectedRemoteCommit", "registered role, recipient, issuer, issue date or expiry details"]) assert.ok(github.includes(phrase), phrase);
  assert.doesNotMatch(`${gateway}\n${github}`, /accessToken:\s*invitation|refreshToken:\s*invitation|apiKey:\s*invitation/);
});

test("issue #156 mounts global onboarding and reviewer-safe role guidance", async () => {
  const [layout, ui, guard, vite, css] = await Promise.all([source("app/layout.tsx"), source("app/collaboration-invitations.tsx"), source("app/collaboration-role-guard.tsx"), source("vite.config.ts"), source("app/collaboration-invitations.module.css")]);
  for (const phrase of ["CollaborationInvitationHost", "CollaborationRoleGuard"]) assert.ok(layout.includes(phrase));
  for (const phrase of ["Open .ppinvite", "Create .ppinvite", "Accepting Proposals", "Reviewer read-only mode", "No repository metadata needs to be typed", "Return to Project Lead mode"]) assert.ok(ui.includes(phrase), phrase);
  for (const phrase of ["beforeinput", "change", "submit", "drop", "paste", "cut", "feedbackContext", "plotpickleReadOnly"]) assert.ok(guard.includes(phrase), phrase);
  assert.ok(vite.indexOf("collaborationInvitationGateway()") < vite.indexOf("githubProjectSyncGateway()"));
  for (const className of ["launcher", "reviewBanner", "dialog", "setting", "form", "list"]) assert.ok(css.includes(`.${className}`));
});

test("issue #156 schema, documentation and package registration are present", async () => {
  const [schema, docs, packageJson] = await Promise.all([source("schema/plotpickle-invitation.schema.json").then(JSON.parse), source("docs/issue-156-collaboration-invitations.md"), source("package.json").then(JSON.parse)]);
  assert.equal(schema.properties.format.const, "plotpickle-invitation");
  assert.deepEqual(schema.properties.invitation.properties.role.enum, ["writer", "director", "actor", "producer", "reviewer"]);
  for (const phrase of ["Writer → Write", "Reviewer → Feedback in read-only review mode", "Accepting Proposals", "encrypted local secrets area", "never contains"]) assert.ok(docs.includes(phrase), phrase);
  assert.match(packageJson.scripts.test, /issue-156-collaboration-invitations\.test\.mjs/);
  assert.equal(packageJson.scripts["test:collaboration-invitations"], "node --test tests/issue-156-collaboration-invitations.test.mjs");
});
