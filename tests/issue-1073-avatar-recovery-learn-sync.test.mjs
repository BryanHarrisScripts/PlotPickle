import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPortableLearnStateToProject,
  authorizeNode,
  claimOrAdoptAvatar,
  createAccountSyncState,
  createPortableLearnState,
  nextLearnActionLessonId,
  reconcileForAuthorizedNode,
  reconcilePortableLearnState,
  revokeNode,
} from "../core/identity/account-learn-sync-core.mjs";

const PUBLIC_KEY_A = "-----BEGIN PUBLIC KEY-----\nNODE-A\n-----END PUBLIC KEY-----";
const PUBLIC_KEY_B = "-----BEGIN PUBLIC KEY-----\nNODE-B\n-----END PUBLIC KEY-----";

function baseLearn(overrides = {}) {
  return createPortableLearnState({
    activeLessonId: "world-02",
    activeLessonUpdatedAt: "2026-08-19T12:00:00.000Z",
    completedLessonIds: ["world-01"],
    ...overrides,
  });
}

test("one account claims one canonical Avatar and a second Node adopts it without merging its draft", () => {
  let account = createAccountSyncState("person_bryan");
  account = authorizeNode(account, {
    nodeId: "pp_studio_NODEA123",
    publicKeyPem: PUBLIC_KEY_A,
    authorizedAt: "2026-08-19T12:00:00.000Z",
  });
  const first = claimOrAdoptAvatar(account, "pp_studio_NODEA123", {
    draftId: "draft_desktop",
    displayName: "Bryan of the Brine",
    bio: "Desktop draft",
  }, {
    avatarId: "avatar_bryan",
    now: "2026-08-19T12:01:00.000Z",
  });

  account = authorizeNode(first.account, {
    nodeId: "pp_studio_NODEB456",
    publicKeyPem: PUBLIC_KEY_B,
    authorizedAt: "2026-08-19T12:02:00.000Z",
  });
  const second = claimOrAdoptAvatar(account, "pp_studio_NODEB456", {
    draftId: "draft_laptop",
    displayName: "Conflicting Laptop Persona",
    bio: "Keep me local until the writer decides.",
  }, {
    avatarId: "avatar_should_not_replace",
    now: "2026-08-19T12:03:00.000Z",
  });

  assert.equal(second.adoptedExistingAvatar, true);
  assert.equal(second.canonicalAvatar.avatarId, "avatar_bryan");
  assert.equal(second.canonicalAvatar.displayName, "Bryan of the Brine");
  assert.equal(second.localDraft.displayName, "Conflicting Laptop Persona");
  assert.equal(second.account.avatar.avatarId, "avatar_bryan");
  assert.notEqual(second.account.nodes.pp_studio_NODEA123.publicKeyPem, second.account.nodes.pp_studio_NODEB456.publicKeyPem);
});

test("Node authorization keeps one stable independent signing key per Node", () => {
  let account = createAccountSyncState("person_bryan");
  account = authorizeNode(account, { nodeId: "node-a", publicKeyPem: PUBLIC_KEY_A, authorizedAt: "2026-08-19T12:00:00.000Z" });
  const idempotent = authorizeNode(account, { nodeId: "node-a", publicKeyPem: PUBLIC_KEY_A, authorizedAt: "2026-08-19T12:01:00.000Z" });
  assert.equal(idempotent, account);
  assert.throws(
    () => authorizeNode(account, { nodeId: "node-b", publicKeyPem: PUBLIC_KEY_A, authorizedAt: "2026-08-19T12:02:00.000Z" }),
    /independent signing public key/i,
  );
  assert.throws(
    () => authorizeNode(account, { nodeId: "node-a", publicKeyPem: PUBLIC_KEY_B, authorizedAt: "2026-08-19T12:02:00.000Z" }),
    /cannot change its signing public key/i,
  );
  const revoked = revokeNode(account, "node-a", "2026-08-19T12:03:00.000Z");
  assert.throws(
    () => authorizeNode(revoked, { nodeId: "node-a", publicKeyPem: PUBLIC_KEY_A, authorizedAt: "2026-08-19T12:04:00.000Z" }),
    /cannot be silently reauthorized/i,
  );
});

test("revoking one Node blocks its sync without destroying the account, Avatar or another Node", () => {
  let account = createAccountSyncState("person_bryan");
  account = authorizeNode(account, { nodeId: "node-a", publicKeyPem: PUBLIC_KEY_A, authorizedAt: "2026-08-19T12:00:00.000Z" });
  account = claimOrAdoptAvatar(account, "node-a", { draftId: "draft-a", displayName: "Canonical Avatar" }, {
    avatarId: "avatar-bryan",
    now: "2026-08-19T12:01:00.000Z",
  }).account;
  account = authorizeNode(account, { nodeId: "node-b", publicKeyPem: PUBLIC_KEY_B, authorizedAt: "2026-08-19T12:02:00.000Z" });
  account = revokeNode(account, "node-a", "2026-08-19T12:03:00.000Z");

  const state = baseLearn();
  assert.throws(() => reconcileForAuthorizedNode(account, "node-a", state, state), /not authorized/i);
  assert.doesNotThrow(() => reconcileForAuthorizedNode(account, "node-b", state, state));
  assert.equal(account.personId, "person_bryan");
  assert.equal(account.avatar.avatarId, "avatar-bryan");
  assert.equal(account.nodes["node-b"].revokedAt, null);
});

test("two clients reconcile completion and resume so the next lesson advances across devices", () => {
  let account = createAccountSyncState("person_bryan");
  account = authorizeNode(account, { nodeId: "node-a", publicKeyPem: PUBLIC_KEY_A, authorizedAt: "2026-08-19T11:00:00.000Z" });
  account = authorizeNode(account, { nodeId: "node-b", publicKeyPem: PUBLIC_KEY_B, authorizedAt: "2026-08-19T11:01:00.000Z" });

  const desktop = baseLearn({
    activeLessonId: "world-02",
    activeLessonUpdatedAt: "2026-08-19T12:00:00.000Z",
    completedLessonIds: ["world-01"],
  });
  const phone = baseLearn({
    activeLessonId: "world-03",
    activeLessonUpdatedAt: "2026-08-19T12:05:00.000Z",
    completedLessonIds: ["world-01", "world-02", "world-03"],
  });

  const canonical = reconcileForAuthorizedNode(account, "node-b", phone, desktop).state;
  const resumedDesktop = reconcileForAuthorizedNode(account, "node-a", desktop, canonical).state;
  assert.deepEqual(resumedDesktop.completedLessonIds, ["world-01", "world-02", "world-03"]);
  assert.equal(resumedDesktop.activeLessonId, "world-03");
  assert.equal(nextLearnActionLessonId(["world-01", "world-02", "world-03", "world-04"], resumedDesktop), "world-04");
});

test("offline notes and curriculum answers append versions instead of silently overwriting writer text", () => {
  const desktop = baseLearn({
    notes: [{
      versionId: "note-v1-a",
      noteId: "world-note",
      lessonId: "world-03",
      body: "Desktop wording",
      nodeId: "node-a",
      updatedAt: "2026-08-19T12:10:00.000Z",
    }],
    curriculumAnswers: [{
      versionId: "answer-v1-a",
      answerId: "world-answer",
      lessonId: "world-03",
      value: "Desktop answer",
      nodeId: "node-a",
      updatedAt: "2026-08-19T12:10:00.000Z",
    }],
  });
  const laptop = baseLearn({
    notes: [{
      versionId: "note-v1-b",
      noteId: "world-note",
      lessonId: "world-03",
      body: "Offline laptop wording",
      nodeId: "node-b",
      updatedAt: "2026-08-19T12:11:00.000Z",
    }],
    curriculumAnswers: [{
      versionId: "answer-v1-b",
      answerId: "world-answer",
      lessonId: "world-03",
      value: "Offline laptop answer",
      nodeId: "node-b",
      updatedAt: "2026-08-19T12:11:00.000Z",
    }],
  });

  const merged = reconcilePortableLearnState(desktop, laptop).state;
  assert.deepEqual(merged.notes.map((item) => item.body), ["Desktop wording", "Offline laptop wording"]);
  assert.deepEqual(merged.curriculumAnswers.map((item) => item.value), ["Desktop answer", "Offline laptop answer"]);
});

test("bookmarks reconcile by newest timestamp and lesson-version disagreement is surfaced", () => {
  const desktop = baseLearn({
    bookmarks: { "world-03": "2026-08-19T12:01:00.000Z" },
    lessonVersions: { "world-03": "curriculum-2026.08-a" },
  });
  const laptop = baseLearn({
    bookmarks: { "world-03": "2026-08-19T12:09:00.000Z" },
    lessonVersions: { "world-03": "curriculum-2026.08-b" },
  });
  const merged = reconcilePortableLearnState(desktop, laptop);
  assert.equal(merged.state.bookmarks["world-03"], "2026-08-19T12:09:00.000Z");
  assert.deepEqual(merged.lessonVersionConflicts, [{
    lessonId: "world-03",
    versions: ["curriculum-2026.08-a", "curriculum-2026.08-b"],
  }]);
});

test("LEARN sync allowlist rejects every unknown field and private key material", () => {
  assert.throws(() => createPortableLearnState({
    activeLessonUpdatedAt: "2026-08-19T12:00:00.000Z",
    providerCredentials: { token: "secret" },
  }), /outside the portable allowlist/i);
  assert.throws(() => createPortableLearnState({
    activeLessonUpdatedAt: "2026-08-19T12:00:00.000Z",
    harmlessLookingExtra: "not explicitly portable",
  }), /outside the portable allowlist/i);
  assert.throws(() => createPortableLearnState({
    activeLessonUpdatedAt: "2026-08-19T12:00:00.000Z",
    notes: [{
      versionId: "note-secret",
      noteId: "note-secret",
      lessonId: "world-03",
      body: "-----BEGIN PRIVATE KEY----- abc",
      nodeId: "node-a",
      updatedAt: "2026-08-19T12:01:00.000Z",
    }],
  }), /private key material/i);
});

test("only visible Sage writer/guide continuity is portable", () => {
  const state = createPortableLearnState({
    activeLessonUpdatedAt: "2026-08-19T12:00:00.000Z",
    sageMessages: [
      { messageId: "msg-writer", role: "writer", text: "Help me understand World.", createdAt: "2026-08-19T12:01:00.000Z" },
      { messageId: "msg-guide", role: "guide", text: "Start with the governing rules.", createdAt: "2026-08-19T12:02:00.000Z" },
      { messageId: "msg-system", role: "system", text: "hidden reasoning", createdAt: "2026-08-19T12:03:00.000Z" },
    ],
  });
  assert.deepEqual(state.sageMessages.map((message) => message.role), ["writer", "guide"]);
});

test("applying portable state changes only the PPF LEARN slice and preserves project/build truth", () => {
  const project = {
    format: "2.0-foundation",
    id: "project-1",
    title: "Afterglow",
    revision: 7,
    createdAt: "2026-08-19T10:00:00.000Z",
    updatedAt: "2026-08-19T11:00:00.000Z",
    learning: { activeLessonId: "world-02", completedLessonIds: ["world-01"] },
    creativeRoom: { threadId: "thread-1" },
    foundations: { keep: "canonical-foundations" },
    world: { keep: "canonical-world" },
    build: { keep: "private-build-state" },
  };
  const state = baseLearn({
    activeLessonId: "world-03",
    activeLessonUpdatedAt: "2026-08-19T12:00:00.000Z",
    completedLessonIds: ["world-01", "world-02", "world-03"],
  });
  const next = applyPortableLearnStateToProject(project, state, new Date("2026-08-19T12:30:00.000Z"));
  assert.equal(next.revision, 8);
  assert.deepEqual(next.learning, { activeLessonId: "world-03", completedLessonIds: ["world-01", "world-02", "world-03"] });
  assert.equal(next.foundations, project.foundations);
  assert.equal(next.world, project.world);
  assert.equal(next.build, project.build);
  assert.equal(next.creativeRoom, project.creativeRoom);
});
