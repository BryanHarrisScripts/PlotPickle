import {
  normalizeStoryMapContext,
  normalizeStoryMapContextRegistry,
  type StoryMapContext,
} from "./story-map-context";
import { normalizeLibraryProject, type LibraryPPFProject } from "./library-project";
import type { AfterglowReviewDraft, AfterglowReviewSelections } from "../../modules/library/master/afterglow-review-draft.mjs";
import {
  clearLibraryProjectSessionCache,
  consumeSessionActiveProjectHandoff,
  PROJECT_LIBRARY_ACTIVE_PROFILE_KEY,
  PROJECT_LIBRARY_CHANGED_EVENT,
  hydrateProfileProjectLibrary,
  listArchivedLibraryProjects,
  listAfterglowExampleProjects,
  listPersistableLibraryProjects,
  loadLibraryProjectSnapshot,
  libraryProjectSnapshotText,
  initializeProjectLibrary,
  resumeSessionActiveProject,
  sessionActiveProjectId,
} from "./project-library-browser";

type HydratedPrivateProjectEntry = Readonly<{
  project: unknown;
  summary?: Readonly<Record<string, unknown>>;
}>;

export type ProfileRecoveryPoint = Readonly<{
  id: string;
  projectId: string;
  title: string;
  revision: number;
  createdAt: string;
  reason: "unload" | "manual" | "pre-restore";
  project: LibraryPPFProject;
}>;

type HydratedPrivateState = {
  readonly project: unknown | null;
  readonly activeProjectId?: string | null;
  readonly projects?: readonly HydratedPrivateProjectEntry[];
  readonly wyrmwood: unknown | null;
  readonly storyMapContexts: unknown | null;
  readonly recoveryPoints?: unknown;
  readonly afterglowMaster?: Readonly<{ masterId: string; updatedAt: string }> | null;
  readonly afterglowLastSave?: AfterglowMasterSaveAudit | null;
};

export type AfterglowMasterSaveAudit = Readonly<{
  version: 1;
  at: string;
  status: "started" | "blocked" | "saved";
  stage: string;
  message?: string;
  masterId?: string;
}>;

type ProfilePrivateSaveState = Readonly<{
  state: "saved" | "saving" | "blocked";
  message: string;
}>;

const LEGACY_LIBRARY_PREFIX = "plotpickle.library.profile.v1.";
const PROFILE_RECOVERY_LIMIT = 20;
export const PROFILE_PRIVATE_SAVE_STATE_EVENT = "plotpickle:profile-private-save-state";

function normalizeRecoveryPoints(value: unknown): readonly ProfileRecoveryPoint[] {
  if (!Array.isArray(value)) return [];
  const points: ProfileRecoveryPoint[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id.trim().slice(0, 360) : "";
    const projectId = typeof raw.projectId === "string" ? raw.projectId.trim().slice(0, 240) : "";
    const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 500) : "";
    const createdAt = typeof raw.createdAt === "string" ? raw.createdAt.trim().slice(0, 80) : "";
    const reason = raw.reason === "unload" || raw.reason === "manual" || raw.reason === "pre-restore" ? raw.reason : null;
    if (!id || !projectId || !title || !createdAt || !reason || !raw.project) continue;
    try {
      const project = normalizeLibraryProject(raw.project);
      if (project.id !== projectId) continue;
      points.push({
        id,
        projectId,
        title,
        revision: Number.isInteger(raw.revision) ? Number(raw.revision) : project.revision,
        createdAt,
        reason,
        project,
      });
    } catch {
      // Invalid recovery points remain ignored rather than becoming project authority.
    }
  }
  return points
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, PROFILE_RECOVERY_LIMIT);
}

let csrfToken = "";
let hydratedProfileId = "";
let hydrated: HydratedPrivateState = { project: null, wyrmwood: null, storyMapContexts: null, recoveryPoints: [] };
let pendingWrite: Promise<void> = Promise.resolve();
let pendingCacheWrite: Promise<void> = Promise.resolve();
let saveState: ProfilePrivateSaveState = Object.freeze({ state: "saved", message: "Saved" });
let authorityEpoch = 0;
let removeProjectPersistenceListener: (() => void) | null = null;

type ProjectWriteTarget = Readonly<{
  id: string;
  snapshot: string;
  summary: Readonly<Record<string, unknown>>;
  summaryText: string;
}>;

// Session-local acknowledgements, never an alternative durable authority.
const acknowledgedProjects = new Map<string, Readonly<{ snapshot: string; summaryText: string }>>();
let pendingLibraryWrite: Readonly<{
  epoch: number;
  token: string;
  activeProjectId: string | null;
  projects: readonly ProjectWriteTarget[];
  confirmations: Set<string>;
  skipped: Set<string>;
  promise: Promise<void>;
}> | null = null;

function profileProjectWriteTargets() {
  return [...listPersistableLibraryProjects(), ...listArchivedLibraryProjects()].map((item): ProjectWriteTarget => {
    const snapshot = libraryProjectSnapshotText(item.id);
    if (!snapshot) throw new Error(`Library snapshot for ${item.title} is unavailable; the last saved profile state was preserved.`);
    const summary = {
      projectId: item.id,
      title: item.title, updatedAt: item.updatedAt, createdAt: item.createdAt,
      progress: item.progress, frontier: item.frontier, thumbnailRef: item.thumbnail,
      sourceKind: item.sourceKind, sourceId: item.sourceId, genre: item.genre,
      format: item.format, archivedAt: item.archivedAt,
    };
    return { id: item.id, snapshot, summary, summaryText: JSON.stringify(summary) };
  });
}

function observeProjectWrites() {
  removeProjectPersistenceListener?.();
  const persist = async () => {
    const epoch = authorityEpoch;
    try {
      await persistActiveProfileProject();
    } catch (error) {
      if (epoch !== authorityEpoch) return;
      updateSaveState("blocked", error instanceof Error ? error.message : "Project changes could not be persisted.");
    }
  };
  window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, persist);
  removeProjectPersistenceListener = () => window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, persist);
}

function updateSaveState(state: ProfilePrivateSaveState["state"], message: string) {
  saveState = Object.freeze({ state, message });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PROFILE_PRIVATE_SAVE_STATE_EVENT, { detail: saveState }));
}

async function privateMutation(action: string, payload: Record<string, unknown>, token = csrfToken) {
  if (!token) throw new Error("The Human profile is locked.");
  const result = await fetch("/api/auth/profile-private", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": token },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await result.json().catch(() => ({})) as Record<string, unknown>;
  if (!result.ok) throw new Error(typeof body.message === "string" ? body.message : "PlotPickle could not persist the encrypted profile state.");
  return body;
}

function queueWriteOperation(operation: (token: string) => Promise<void>, explicitToken = "") {
  const token = explicitToken || csrfToken;
  if (!token) {
    updateSaveState("blocked", "The Human profile is locked.");
    return Promise.reject(new Error("The Human profile is locked."));
  }
  const epoch = authorityEpoch;
  updateSaveState("saving", "Unsaved changes");
  const current = pendingWrite.catch(() => undefined).then(() => {
    if (epoch !== authorityEpoch) throw new Error("The Human profile changed before this write could start.");
    return operation(token);
  });
  pendingWrite = current;
  void current.then(
    () => { if (epoch === authorityEpoch && pendingWrite === current) updateSaveState("saved", "Saved"); },
    (error) => {
      if (epoch === authorityEpoch && pendingWrite === current) updateSaveState("blocked", error instanceof Error ? error.message : "Unsaved changes could not be persisted.");
    },
  );
  return current;
}

function queueWrite(action: string, payload: Record<string, unknown>, explicitToken = "") {
  return queueWriteOperation(async (token) => {
    await privateMutation(action, payload, token);
  }, explicitToken);
}

function queueCacheWrite(action: string, payload: Record<string, unknown>) {
  const token = csrfToken;
  if (!token) return Promise.reject(new Error("The Human profile is locked."));
  const current = pendingCacheWrite.catch(() => undefined).then(async () => {
    await privateMutation(action, payload, token);
  });
  pendingCacheWrite = current;
  return current;
}

// Browser snapshots are recovery evidence, never sign-in authority. Preserve
// legacy session records under quarantine before replacing the live session.
function preserveLegacySessionRecords() {
  return Array.from({ length: window.sessionStorage.length }, (_, index) => window.sessionStorage.key(index))
    .filter((key): key is string => Boolean(key?.startsWith(LEGACY_LIBRARY_PREFIX)))
    .map((key) => [key.includes(".quarantine.") ? key : `${LEGACY_LIBRARY_PREFIX}quarantine.sign-in.${key}`, window.sessionStorage.getItem(key)] as const);
}

export async function hydrateProfilePrivateBrowser(profileId: string, token: string, forceVerifiedReload = false) {
  // A normal sign-in hydration may never replace a newer working story.
  // A verified master commit is the sole deliberate forced fresh readback.
  if (!forceVerifiedReload && profilePrivateBrowserAuthorityMatches(profileId, token)) return;
  if (hydratedProfileId) await flushProfilePrivateWrites();
  const epoch = ++authorityEpoch;
  acknowledgedProjects.clear();
  pendingLibraryWrite = null;
  removeProjectPersistenceListener?.();
  removeProjectPersistenceListener = null;
  try {
    const legacyRecords = preserveLegacySessionRecords();
    const result = await fetch("/api/auth/profile-private", { credentials: "same-origin", cache: "no-store" });
    if (!result.ok) throw new Error("PlotPickle could not open the encrypted profile state.");
    const next = await result.json() as HydratedPrivateState;
    if (epoch !== authorityEpoch) throw new Error("The Human profile changed while encrypted state was loading.");
    csrfToken = token;
    const explicitSessionProjectId = consumeSessionActiveProjectHandoff(profileId);
    clearLibraryProjectSessionCache();
    window.sessionStorage.clear();
    for (const [key, value] of legacyRecords) if (value !== null) window.sessionStorage.setItem(key, value);
    window.sessionStorage.setItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY, profileId);
    const projects = Array.isArray(next.projects) && next.projects.length
      ? next.projects
      : next.project
        ? [{ project: next.project }]
        : [];
    const activeProjectId = typeof next.activeProjectId === "string" && next.activeProjectId.trim()
      ? next.activeProjectId
      : next.project && typeof next.project === "object" && !Array.isArray(next.project) && typeof (next.project as { readonly id?: unknown }).id === "string"
        ? String((next.project as { readonly id: string }).id)
        : null;
    const restored = hydrateProfileProjectLibrary({ activeProjectId, projects });
    if (explicitSessionProjectId && restored.registry.activeProjectId === explicitSessionProjectId) {
      resumeSessionActiveProject(explicitSessionProjectId);
    }
    hydrated = {
      ...next,
      project: restored.activeProject,
      activeProjectId: restored.registry.activeProjectId,
      projects,
      storyMapContexts: normalizeStoryMapContextRegistry(next.storyMapContexts),
      recoveryPoints: normalizeRecoveryPoints(next.recoveryPoints),
    };
    hydratedProfileId = profileId;
    // Only the successfully loaded encrypted inventory may seed acknowledgements.
    for (const entry of profileProjectWriteTargets()) {
      acknowledgedProjects.set(entry.id, { snapshot: entry.snapshot, summaryText: entry.summaryText });
    }
    updateSaveState("saved", "Saved");
  } finally {
    if (epoch === authorityEpoch && hydratedProfileId) observeProjectWrites();
  }
}

/**
 * Opening the Afterglow chooser is an explicit read of the encrypted Library,
 * never a read of an hours-old browser dropdown. Do not create a story, mark a
 * browser snapshot as server truth, or discard any queued authoring writes.
 *
 * The committed server master is identified by its server-minted immutable ID,
 * not by the generic Library active-story selection (which unload can clear).
 */
export async function refreshAfterglowLibraryFromEncryptedProfile(): Promise<Readonly<{
  readonly masterId: string | null;
  readonly masterUpdatedAt: string | null;
}>> {
  const profileId = hydratedProfileId, token = csrfToken;
  if (!profileId || !token || !profilePrivateBrowserReadyFor(profileId)) {
    throw new Error("Unlock your personal profile to check saved Afterglow.");
  }
  await flushProfilePrivateWrites();
  const response = await fetch("/api/auth/profile-private", {
    credentials: "same-origin", cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Encrypted Afterglow Library verification failed. Older browser choices are not authoritative.");
  }
  const server = await response.json() as HydratedPrivateState;
  // GET provides only a master whose independently written encrypted commit
  // ledger matches this profile's current unarchived Afterglow index. A normal
  // saved copy with a convincing-looking ID is not consolidation authority.
  const serverMaster = server.afterglowMaster;
  const masterId = typeof serverMaster?.masterId === "string"
    && serverMaster.masterId.startsWith("afterglow-consolidated-")
    ? serverMaster.masterId : null;
  const masterUpdatedAt = masterId && typeof serverMaster?.updatedAt === "string"
    ? serverMaster.updatedAt : null;
  if (masterId && !(server.projects ?? []).some(entry =>
    entry.project && typeof entry.project === "object"
    && (entry.project as { id?: unknown }).id === masterId
    && entry.summary?.sourceKind === "example"
    && entry.summary?.sourceId === "afterglow-v9"
    && !entry.summary?.archivedAt)) {
    throw new Error("Encrypted master ledger and saved Library inventory disagree. Do not save again.");
  }
  const selectedProjectId = sessionActiveProjectId();
  await hydrateProfilePrivateBrowser(profileId, token, true);
  if (hydratedProfileId !== profileId || csrfToken !== token) {
    throw new Error("The signed-in profile changed during Afterglow verification.");
  }
  if (masterId) {
    const masterSummary = listAfterglowExampleProjects().find(item => item.id === masterId);
    const snapshot = masterSummary ? loadLibraryProjectSnapshot(masterId) : null;
    if (!snapshot || snapshot.id !== masterId
      || snapshot.sourceEvidence.referenceFixture?.sourceId !== "afterglow-v9-complete-baseline") {
      throw new Error("The encrypted profile has a consolidated Afterglow, but Library cannot read its exact saved snapshot. Do not save again.");
    }
  }
  // Browsing a starting-point dialog is not consent to unload another story.
  if (selectedProjectId && loadLibraryProjectSnapshot(selectedProjectId)) {
    resumeSessionActiveProject(selectedProjectId);
  }
  return {masterId, masterUpdatedAt};
}

/** Read the last authoritative save result without resetting in-progress review choices. */
export async function readAfterglowMasterSaveAudit(): Promise<AfterglowMasterSaveAudit | null> {
  const profileId = hydratedProfileId, token = csrfToken;
  if (!profileId || !token || !profilePrivateBrowserReadyFor(profileId)) {
    throw new Error("Unlock your profile before checking Afterglow save status.");
  }
  const response = await fetch("/api/auth/profile-private?afterglowSaveAudit=1", {
    credentials: "same-origin", cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not verify the last encrypted Afterglow save attempt.");
  const record = await response.json() as {lastSave?: AfterglowMasterSaveAudit | null};
  if (profileId !== hydratedProfileId || token !== csrfToken) {
    throw new Error("The signed-in profile changed while checking Afterglow save status.");
  }
  const entry = record.lastSave;
  if (!entry || entry.version !== 1 ||
      !["started", "blocked", "saved"].includes(entry.status)) return null;
  return entry;
}

/** Diagnostic receipt from the authenticated encrypted profile, not localStorage. */
export function lastAfterglowMasterSaveAttempt(): AfterglowMasterSaveAudit | null {
  const entry = hydrated.afterglowLastSave;
  return entry?.version === 1 && (entry.status === "started" ||
    entry.status === "blocked" || entry.status === "saved") ? entry : null;
}

export function profilePrivateBrowserAuthorityMatches(profileId: string, token: string) {
  const normalizedProfileId = profileId.trim();
  return Boolean(normalizedProfileId && token && hydratedProfileId === normalizedProfileId && csrfToken === token);
}

/** Read-only authority check for profile-scoped Settings previews.
 * An initialized browser Library alone is not proof of a signed-in Human.
 * This exposes no token, credentials, private project data or write authority.
 */
export function profilePrivateBrowserReadyFor(profileId: string) {
  return Boolean(profileId.trim() && hydratedProfileId === profileId.trim() && csrfToken);
}

export function listProfileRecoveryPoints(projectId = "") {
  const points = normalizeRecoveryPoints(hydrated.recoveryPoints);
  const normalizedProjectId = projectId.trim();
  return normalizedProjectId ? points.filter((point) => point.projectId === normalizedProjectId) : points;
}

export function profileRecoveryPoint(pointId: string) {
  const id = pointId.trim();
  return listProfileRecoveryPoints().find((point) => point.id === id) ?? null;
}

export function createProfileRecoveryPoint(
  projectValue: LibraryPPFProject,
  reason: ProfileRecoveryPoint["reason"] = "manual",
) {
  const project = normalizeLibraryProject(structuredClone(projectValue));
  const createdAt = new Date().toISOString();
  const idSuffix = globalThis.crypto?.randomUUID?.() ?? String(Date.now());
  const point: ProfileRecoveryPoint = Object.freeze({
    id: `${project.id}:${createdAt}:${idSuffix}`,
    projectId: project.id,
    title: project.title,
    revision: project.revision,
    createdAt,
    reason,
    project,
  });
  const next = normalizeRecoveryPoints([point, ...listProfileRecoveryPoints()]);
  hydrated = { ...hydrated, recoveryPoints: next };
  return queueCacheWrite("save-recovery-points", { value: next }).then(() => point);
}

export function hydratedProfilePrivateValue(key: "wyrmwood") {
  return hydrated[key];
}

export function hydratedStoryMapContext(projectId: string) {
  return normalizeStoryMapContextRegistry(hydrated.storyMapContexts)[projectId] ?? null;
}

export function persistActiveProfileProject(explicitToken = "", confirmProjectId = "") {
  const token = explicitToken || csrfToken;
  if (!token) {
    updateSaveState("blocked", "The Human profile is locked.");
    return Promise.reject(new Error("The Human profile is locked."));
  }
  const epoch = authorityEpoch;
  const activeProjectId = sessionActiveProjectId();
  const projects = profileProjectWriteTargets();
  const persistedActiveProjectId = activeProjectId && projects.some((item) => item.id === activeProjectId && !item.summary.archivedAt)
    ? activeProjectId
    : null;
  if (confirmProjectId && !projects.some((entry) => entry.id === confirmProjectId)) {
    return Promise.reject(new Error("The story to confirm is no longer in this Human Library."));
  }
  const previous = pendingLibraryWrite;
  if (previous && previous.epoch === epoch && previous.token === token
    && previous.activeProjectId === persistedActiveProjectId
    && previous.projects.length === projects.length
    && (!confirmProjectId || !previous.skipped.has(confirmProjectId))
    && projects.every((entry, index) => entry.id === previous.projects[index].id
      && entry.snapshot === previous.projects[index].snapshot
      && entry.summaryText === previous.projects[index].summaryText)) {
    if (confirmProjectId) previous.confirmations.add(confirmProjectId);
    return previous.promise;
  }
  const confirmations = new Set(confirmProjectId ? [confirmProjectId] : []);
  const skipped = new Set<string>();
  const requireCurrentAuthority = () => {
    if (epoch !== authorityEpoch) throw new Error("The Human profile changed while this write was being persisted.");
  };
  const promise = queueWriteOperation(async (writeToken) => {
    for (const entry of projects) {
      requireCurrentAuthority();
      const acknowledged = acknowledgedProjects.get(entry.id);
      if (!confirmations.has(entry.id) && acknowledged?.snapshot === entry.snapshot
        && acknowledged.summaryText === entry.summaryText) {
        skipped.add(entry.id);
        continue;
      }
      // Read the captured bytes, not a possibly newer live snapshot: queue order
      // must preserve each requested decision and its own acknowledgement.
      const project = normalizeLibraryProject((JSON.parse(entry.snapshot) as { project: unknown }).project);
      if (project.id !== entry.id) throw new Error("The Library snapshot identity does not match the story being saved.");
      await privateMutation("save-project", {
        project,
        summary: entry.summary,
        activate: false,
      }, writeToken);
      requireCurrentAuthority();
      acknowledgedProjects.set(entry.id, { snapshot: entry.snapshot, summaryText: entry.summaryText });
    }
    requireCurrentAuthority();
    await privateMutation("sync-library-index", {
      summaries: projects.map((entry) => entry.summary),
      activeProjectId: persistedActiveProjectId,
    }, writeToken);
    requireCurrentAuthority();
  }, token);
  const target = { epoch, token, activeProjectId: persistedActiveProjectId, projects, confirmations, skipped, promise };
  pendingLibraryWrite = target;
  const clear = () => { if (pendingLibraryWrite === target) pendingLibraryWrite = null; };
  void promise.then(clear, clear);
  return promise;
}

/**
 * A single, authenticated encrypted review draft. Queued writes serialize
 * rapid creative selections with existing profile persistence operations.
 * The server confirms encrypted readback, and the browser checks exact
 * decision bytes; an unacknowledged write is NEVER "Review saved".
 */
export async function saveAfterglowReviewDraft(input: Readonly<{
  sourceFingerprint: string;
  selections: AfterglowReviewSelections;
}>): Promise<string> {
  const profileId=hydratedProfileId,token=csrfToken;
  if (!profileId||!token||!profilePrivateBrowserReadyFor(profileId)) {
    throw new Error("Unlock your profile before automatically saving this review.");
  }
  // Capture the exact click's choices synchronously, then queue BEFORE any
  // asynchronous hashing. Otherwise a slow earlier digest could queue behind
  // a newer choice and incorrectly become the last saved review.
  const selections=JSON.parse(JSON.stringify(input.selections)) as AfterglowReviewSelections;
  let savedAt="";
  await queueWriteOperation(async writeToken=>{
    const digestBytes=await crypto.subtle.digest("SHA-256",
      new TextEncoder().encode(JSON.stringify(selections)));
    const selectionsDigest="sha256:"+Array.from(new Uint8Array(digestBytes))
      .map(b=>b.toString(16).padStart(2,"0")).join("");
    const ack=await privateMutation("save-afterglow-review-draft",{
      draft:{version:1,sourceFingerprint:input.sourceFingerprint,selections},
    },writeToken);
    if(ack.ok!==true || ack.sourceFingerprint!==input.sourceFingerprint ||
      ack.selectionsDigest!==selectionsDigest || typeof ack.savedAt!=="string") {
      throw new Error("The encrypted review readback did not match your selected choices.");
    }
    if(!profilePrivateBrowserReadyFor(profileId)) {
      throw new Error("The signed-in profile changed before review save confirmation.");
    }
    savedAt=ack.savedAt;
  },token);
  return savedAt;
}

/** Read exact single current review; never restore a working project or backup. */
export async function loadAfterglowReviewDraft(): Promise<AfterglowReviewDraft | null> {
  const profileId=hydratedProfileId,token=csrfToken;
  if(!profileId||!token||!profilePrivateBrowserReadyFor(profileId)) {
    throw new Error("Unlock your profile to continue your last Afterglow review.");
  }
  await flushProfilePrivateWrites();
  const result=await fetch("/api/auth/profile-private?afterglowReviewDraft=1",{
    credentials:"same-origin",cache:"no-store",
  });
  if(!result.ok)throw new Error("Encrypted Afterglow review could not be read.");
  const payload=await result.json() as {draft?:AfterglowReviewDraft|null};
  if(hydratedProfileId!==profileId||csrfToken!==token) {
    throw new Error("The signed-in profile changed while loading the saved review.");
  }
  return payload.draft?.version===1?payload.draft:null;
}

export async function clearAfterglowReviewDraft(masterId:string):Promise<void> {
  if(!masterId.startsWith("afterglow-consolidated-")) {
    throw new Error("A verified consolidated master ID is required.");
  }
  await queueWrite("clear-afterglow-review-draft",{masterId});
}

export type ConsolidatedAfterglowReceipt = Readonly<{
  ok:true;masterId:string;sourceCount:number;historicalSources:number;
  archivedSourceCount:number;decisionsCompleted:number;readbackVerified:true;
  message:string;libraryRefreshed:boolean;
}>;

/**
 * Only a signed-in, encrypted profile may request a server-recomputed master.
 * The caller supplies review evidence, never a client-controlled saved story.
 */
export async function commitConsolidatedAfterglow(input:Readonly<{
  selections:Readonly<{
    decisions:Readonly<Record<string,number|"baseline">>;
    exclusions:readonly string[];
    confirmedCurrent:Readonly<Record<string,boolean>>;
    imageChoices:Readonly<Record<string,"keep"|"exclude">>;
  }>;
  expectedSources:readonly Readonly<{key:string;digest:string}>[];
}>):Promise<ConsolidatedAfterglowReceipt> {
  await flushProfilePrivateWrites();
  const profileId=hydratedProfileId,token=csrfToken;
  if(!profileId || !token || !profilePrivateBrowserReadyFor(profileId)) {
    throw new Error("Unlock your personal profile before saving consolidated Afterglow.");
  }
  let receipt:ConsolidatedAfterglowReceipt|null=null;
  await queueWriteOperation(async writeToken=>{
    if(hydratedProfileId!==profileId||csrfToken!==token)
      throw new Error("The signed-in profile changed before consolidation.");
    receipt=await privateMutation("commit-afterglow-master",{
      selections:input.selections,expectedSources:input.expectedSources,
    },writeToken) as unknown as ConsolidatedAfterglowReceipt;
    if(!receipt.ok || receipt.readbackVerified!==true || !receipt.masterId) {
      throw new Error("Afterglow did not pass authenticated master readback.");
    }
  },token);
  if(!receipt)throw new Error("The consolidated story did not receive a server receipt.");
  let libraryRefreshed=false;
  try {
    if(profilePrivateBrowserReadyFor(profileId))
      await hydrateProfilePrivateBrowser(profileId,token,true);
    // A successful profile reload is NOT proof the newly committed master is
    // available from Library. Match the exact encrypted receipt identity and
    // packaged-reference lineage, rather than relying on a recent timestamp.
    const masterSummary = listAfterglowExampleProjects().find(item =>
      item.id === receipt.masterId && !item.archivedAt);
    const masterSnapshot = masterSummary ? loadLibraryProjectSnapshot(receipt.masterId) : null;
    libraryRefreshed = profilePrivateBrowserReadyFor(profileId)
      && Boolean(masterSummary && masterSnapshot
        && masterSnapshot.id === receipt.masterId
        && masterSnapshot.sourceEvidence.referenceFixture?.sourceId === "afterglow-v9-complete-baseline");
    // The deliberate save is an explicit user choice of the new working story.
    // Make that same verified master current for this session, including after
    // Library unload/reopen, without silently opening anything on future login.
    if (libraryRefreshed) {
      const reopened = resumeSessionActiveProject(receipt.masterId);
      libraryRefreshed = Boolean(reopened && reopened.id === receipt.masterId);
    }
  } catch {
    // The server already committed and returned a validated receipt.
    // Do not retry the transaction or misrepresent a successful write as
    // unsaved. User can sign in again to refresh their Library.
    libraryRefreshed=false;
  }
  return {...receipt,libraryRefreshed};
}

export function deleteArchivedProfileProjectFromVault(projectId: string) {
  return queueWrite("delete-archived-project", { projectId });
}

export function persistProfilePrivateValue(key: "wyrmwood", value: unknown) {
  hydrated = { ...hydrated, [key]: structuredClone(value) };
  return queueWrite("save-wyrmwood", { value });
}

export function persistStoryMapContext(projectId: string, value: StoryMapContext) {
  const id = projectId.trim();
  if (!id || id.length > 240) return Promise.reject(new Error("Story Map context requires a valid project id."));
  const current = normalizeStoryMapContextRegistry(hydrated.storyMapContexts);
  const context = normalizeStoryMapContext(value);
  const previous = current[id];
  if (previous
    && previous.blockNumber === context.blockNumber
    && previous.miniBlockNumber === context.miniBlockNumber
    && previous.stage === context.stage
    && previous.passageId === context.passageId) return Promise.resolve();
  const storyMapContexts = normalizeStoryMapContextRegistry({ ...current, [id]: context });
  hydrated = { ...hydrated, storyMapContexts };
  return queueCacheWrite("save-story-map-contexts", { value: storyMapContexts });
}

export function getProfilePrivateSaveState() {
  return saveState;
}

export async function flushProfilePrivateWrites() {
  // A write queued while awaiting an earlier one is part of the same flush.
  for (;;) {
    const current = pendingWrite;
    await current;
    if (pendingWrite === current) break;
  }
  await pendingCacheWrite.catch(() => undefined);
}

export function releaseProfilePrivateBrowserAuthority() {
  authorityEpoch += 1;
  removeProjectPersistenceListener?.();
  removeProjectPersistenceListener = null;
  csrfToken = "";
  hydratedProfileId = "";
  acknowledgedProjects.clear();
  pendingLibraryWrite = null;
  hydrated = { project: null, wyrmwood: null, storyMapContexts: null, recoveryPoints: [] };
  pendingWrite = Promise.resolve();
  pendingCacheWrite = Promise.resolve();
  saveState = Object.freeze({ state: "saved", message: "Saved" });
  clearLibraryProjectSessionCache();
}

export function clearProfilePrivateBrowser() {
  releaseProfilePrivateBrowserAuthority();
  window.sessionStorage.clear();
}
