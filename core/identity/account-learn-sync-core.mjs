const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,127}$/i;
const PRIVATE_OR_PROJECT_FIELD_PATTERN = /(private.?key|credential|provider.?token|filesystem|local.?path|ppf|build.?prompt|hidden.?reasoning|system.?reasoning)/i;
const PRIVATE_KEY_MATERIAL_PATTERN = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;

function stableId(value, label) {
  const normalized = String(value || "").trim();
  if (!ID_PATTERN.test(normalized)) throw new Error(`${label} must be a stable 2-128 character identifier.`);
  return normalized;
}

function cleanText(value, label, maximum) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
  if (/[\u0000-\u001F\u007F]/.test(normalized)) throw new Error(`${label} contains unsupported control characters.`);
  if (PRIVATE_KEY_MATERIAL_PATTERN.test(normalized)) throw new Error(`${label} cannot contain private key material.`);
  return normalized;
}

function validIso(value, label) {
  const normalized = String(value || "");
  if (!normalized || Number.isNaN(Date.parse(normalized))) throw new Error(`${label} must be an ISO date-time.`);
  return normalized;
}

function publicKeyPem(value) {
  const normalized = String(value || "").trim();
  if (!normalized.includes("BEGIN PUBLIC KEY") || !normalized.includes("END PUBLIC KEY")) {
    throw new Error("Node public key must be an exported public key PEM.");
  }
  if (/PRIVATE KEY/.test(normalized)) throw new Error("Node authorization cannot contain a private key.");
  return normalized;
}

function uniqueSorted(values) {
  return [...new Set((values || []).filter((value) => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()))].sort();
}

function sanitizedAvatarDraft(draft) {
  return {
    draftId: stableId(draft?.draftId, "Avatar draft id"),
    displayName: cleanText(draft?.displayName, "Avatar display name", 80),
    ...(draft?.bio?.trim() ? { bio: cleanText(draft.bio, "Avatar bio", 500) } : {}),
    ...(draft?.visualAssetRef?.trim() ? { visualAssetRef: cleanText(draft.visualAssetRef, "Avatar visual asset reference", 500) } : {}),
  };
}

export function createAccountSyncState(personId) {
  return { version: 1, personId: stableId(personId, "Person id"), avatar: null, nodes: {} };
}

export function authorizeNode(account, input) {
  const nodeId = stableId(input?.nodeId, "Node id");
  const nextNode = {
    nodeId,
    publicKeyPem: publicKeyPem(input?.publicKeyPem),
    authorizedAt: validIso(input?.authorizedAt, "Node authorization time"),
    revokedAt: null,
  };
  return { ...account, nodes: { ...account.nodes, [nodeId]: nextNode } };
}

export function revokeNode(account, nodeId, revokedAt) {
  const id = stableId(nodeId, "Node id");
  const existing = account.nodes[id];
  if (!existing) throw new Error("Cannot revoke a Node that is not authorized for this account.");
  return {
    ...account,
    nodes: { ...account.nodes, [id]: { ...existing, revokedAt: validIso(revokedAt, "Node revocation time") } },
  };
}

export function assertAuthorizedNode(account, nodeId) {
  const id = stableId(nodeId, "Node id");
  const node = account.nodes[id];
  if (!node || node.revokedAt) throw new Error("This Node is not authorized for account synchronization.");
  return node;
}

export function claimOrAdoptAvatar(account, nodeId, localDraft, input) {
  assertAuthorizedNode(account, nodeId);
  const preservedDraft = sanitizedAvatarDraft(localDraft);
  if (account.avatar) {
    return { account, canonicalAvatar: account.avatar, localDraft: preservedDraft, adoptedExistingAvatar: true };
  }
  const now = validIso(input?.now, "Avatar claim time");
  const canonicalAvatar = {
    avatarId: stableId(input?.avatarId, "Avatar id"),
    ownerPersonId: account.personId,
    displayName: preservedDraft.displayName,
    ...(preservedDraft.bio ? { bio: preservedDraft.bio } : {}),
    ...(preservedDraft.visualAssetRef ? { visualAssetRef: preservedDraft.visualAssetRef } : {}),
    claimedAt: now,
    updatedAt: now,
  };
  return {
    account: { ...account, avatar: canonicalAvatar },
    canonicalAvatar,
    localDraft: preservedDraft,
    adoptedExistingAvatar: false,
  };
}

function assertPortableTopLevelFields(input) {
  for (const key of Object.keys(input || {})) {
    if (PRIVATE_OR_PROJECT_FIELD_PATTERN.test(key)) throw new Error(`LEARN sync field is outside the portable allowlist: ${key}`);
  }
}

function cleanNoteVersion(note) {
  return {
    versionId: stableId(note?.versionId, "Note version id"),
    noteId: stableId(note?.noteId, "Note id"),
    lessonId: stableId(note?.lessonId, "Note lesson id"),
    body: cleanText(note?.body, "Note body", 20_000),
    nodeId: stableId(note?.nodeId, "Note Node id"),
    updatedAt: validIso(note?.updatedAt, "Note update time"),
  };
}

function cleanAnswerVersion(answer) {
  return {
    versionId: stableId(answer?.versionId, "Answer version id"),
    answerId: stableId(answer?.answerId, "Answer id"),
    lessonId: stableId(answer?.lessonId, "Answer lesson id"),
    value: cleanText(answer?.value, "Curriculum answer", 20_000),
    nodeId: stableId(answer?.nodeId, "Answer Node id"),
    updatedAt: validIso(answer?.updatedAt, "Answer update time"),
  };
}

function cleanSageMessage(message) {
  if (message?.role !== "writer" && message?.role !== "guide") return null;
  return {
    messageId: stableId(message?.messageId, "Sage message id"),
    role: message.role,
    text: cleanText(message?.text, "Visible Sage message", 20_000),
    createdAt: validIso(message?.createdAt, "Sage message time"),
  };
}

export function createPortableLearnState(input = {}) {
  assertPortableTopLevelFields(input);
  const sageMessages = (input.sageMessages || []).map(cleanSageMessage).filter(Boolean);
  return {
    version: 1,
    activeLessonId: input.activeLessonId ? stableId(input.activeLessonId, "Active lesson id") : null,
    activeLessonUpdatedAt: validIso(input.activeLessonUpdatedAt, "Active lesson update time"),
    completedLessonIds: uniqueSorted(input.completedLessonIds || []).map((value) => stableId(value, "Completed lesson id")),
    bookmarks: Object.fromEntries(Object.entries(input.bookmarks || {}).map(([lessonId, updatedAt]) => [stableId(lessonId, "Bookmark lesson id"), validIso(updatedAt, "Bookmark update time")])),
    notes: (input.notes || []).map(cleanNoteVersion),
    curriculumAnswers: (input.curriculumAnswers || []).map(cleanAnswerVersion),
    sageMessages,
    lessonVersions: Object.fromEntries(Object.entries(input.lessonVersions || {}).map(([lessonId, version]) => [stableId(lessonId, "Lesson version lesson id"), cleanText(version, "Lesson version", 120)])),
    visualWriterFrontier: input.visualWriterFrontier
      ? {
          lessonId: input.visualWriterFrontier.lessonId ? stableId(input.visualWriterFrontier.lessonId, "Visual Writer frontier lesson id") : null,
          label: cleanText(input.visualWriterFrontier.label, "Visual Writer frontier label", 160),
          updatedAt: validIso(input.visualWriterFrontier.updatedAt, "Visual Writer frontier update time"),
        }
      : null,
  };
}

export function portableLearnStateFromProject(project, now = new Date()) {
  return createPortableLearnState({
    activeLessonId: project.learning.activeLessonId,
    activeLessonUpdatedAt: now.toISOString(),
    completedLessonIds: project.learning.completedLessonIds,
  });
}

function mergeTimestampRecord(left, right) {
  const merged = { ...left };
  for (const [key, value] of Object.entries(right)) {
    const current = merged[key];
    if (!current || Date.parse(value) > Date.parse(current)) merged[key] = value;
  }
  return merged;
}

function appendVersions(left, right) {
  const byId = new Map();
  for (const item of [...left, ...right]) {
    const existing = byId.get(item.versionId);
    if (!existing || Date.parse(item.updatedAt) > Date.parse(existing.updatedAt)) byId.set(item.versionId, item);
  }
  return [...byId.values()].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.versionId.localeCompare(b.versionId));
}

function mergeVisibleMessages(left, right) {
  const byId = new Map();
  for (const item of [...left, ...right]) byId.set(item.messageId, item);
  return [...byId.values()]
    .filter((message) => message.role === "writer" || message.role === "guide")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.messageId.localeCompare(b.messageId))
    .slice(-200);
}

function newerFrontier(left, right) {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(right.updatedAt) > Date.parse(left.updatedAt) ? right : left;
}

export function reconcilePortableLearnState(left, right) {
  const rightCursorIsNewer = Date.parse(right.activeLessonUpdatedAt) > Date.parse(left.activeLessonUpdatedAt);
  const lessonVersionKeys = uniqueSorted([...Object.keys(left.lessonVersions), ...Object.keys(right.lessonVersions)]);
  const lessonVersionConflicts = lessonVersionKeys
    .map((lessonId) => ({
      lessonId,
      versions: uniqueSorted([left.lessonVersions[lessonId], right.lessonVersions[lessonId]].filter(Boolean)),
    }))
    .filter((entry) => entry.versions.length > 1);
  return {
    state: {
      version: 1,
      activeLessonId: rightCursorIsNewer ? right.activeLessonId : left.activeLessonId,
      activeLessonUpdatedAt: rightCursorIsNewer ? right.activeLessonUpdatedAt : left.activeLessonUpdatedAt,
      completedLessonIds: uniqueSorted([...left.completedLessonIds, ...right.completedLessonIds]),
      bookmarks: mergeTimestampRecord(left.bookmarks, right.bookmarks),
      notes: appendVersions(left.notes, right.notes),
      curriculumAnswers: appendVersions(left.curriculumAnswers, right.curriculumAnswers),
      sageMessages: mergeVisibleMessages(left.sageMessages, right.sageMessages),
      lessonVersions: { ...left.lessonVersions, ...right.lessonVersions },
      visualWriterFrontier: newerFrontier(left.visualWriterFrontier, right.visualWriterFrontier),
    },
    lessonVersionConflicts,
  };
}

export function reconcileForAuthorizedNode(account, nodeId, localState, canonicalState) {
  assertAuthorizedNode(account, nodeId);
  return reconcilePortableLearnState(localState, canonicalState);
}

export function applyPortableLearnStateToProject(project, state, now = new Date()) {
  return {
    ...project,
    revision: project.revision + 1,
    updatedAt: now.toISOString(),
    learning: { activeLessonId: state.activeLessonId, completedLessonIds: state.completedLessonIds },
  };
}

export function nextLearnActionLessonId(orderedLessonIds, state) {
  const completed = new Set(state.completedLessonIds);
  if (!orderedLessonIds.length) return null;
  const activeIndex = state.activeLessonId ? orderedLessonIds.indexOf(state.activeLessonId) : -1;
  for (let offset = 1; offset <= orderedLessonIds.length; offset += 1) {
    const index = (Math.max(activeIndex, -1) + offset) % orderedLessonIds.length;
    if (!completed.has(orderedLessonIds[index])) return orderedLessonIds[index];
  }
  return null;
}

export const PORTABLE_LEARN_SYNC_ALLOWLIST = Object.freeze([
  "activeLessonId",
  "activeLessonUpdatedAt",
  "completedLessonIds",
  "bookmarks",
  "notes",
  "curriculumAnswers",
  "sageMessages",
  "lessonVersions",
  "visualWriterFrontier",
]);
