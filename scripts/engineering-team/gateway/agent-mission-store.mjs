/**
 * #3355 — immutable, profile-scoped mission DRAFTS in the existing private
 * gateway root. No new service, authority, model request or agent dispatcher.
 *
 * The caller MUST provide an independently authenticated host authorization
 * bound to the current clean source and profile. Neither browser nor model
 * content is allowed to construct this object.
 */
import { createHash, randomBytes } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ID = /^[a-f0-9]{32}$/;
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const SECRET = /(?:sk-[a-zA-Z0-9_-]{12,}|ghp_[a-zA-Z0-9]{12,}|bearer\s+\S+|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----)/i;
const LIFETIME_MS = 24 * 60 * 60 * 1000;
const LIMIT = 128;
const KEYS = ["version", "missionId", "profileScopeDigest", "sourceHead",
  "sourceChannel", "goal", "createdAt", "expiresAt", "state", "specialist",
  "evidenceRefs", "integrityDigest"];
const result = (code, data = {}) => Object.freeze({ code, ...data,
  delegated: false, modelInvoked: false, releaseAuthorized: false });
const object = v => !!v && typeof v === "object" && !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype;
const exact = (v, keys) => object(v) && Object.keys(v).length === keys.length &&
  keys.every(key => Object.hasOwn(v, key));
const goodSource = s => object(s) && SHA.test(s.head || "") &&
  ["main", "candidate"].includes(s.channel);
const goodGoal = s => typeof s === "string" && s === s.trim() &&
  s.length >= 5 && s.length <= 180 && !/[\u0000-\u001f\u007f]/.test(s) &&
  !SECRET.test(s);
const digest = v => createHash("sha256").update(JSON.stringify(v), "utf8").digest("hex");

function authorized(auth, source, operation, now) {
  return exact(auth, ["verified", "profileScopeDigest", "sourceHead",
    "sourceChannel", "expiresAt", "permittedOperations"]) &&
    auth.verified === true && DIGEST.test(auth.profileScopeDigest) &&
    auth.sourceHead === source.head && auth.sourceChannel === source.channel &&
    Number.isSafeInteger(auth.expiresAt) && auth.expiresAt > now &&
    auth.expiresAt <= now + 60_000 &&
    Array.isArray(auth.permittedOperations) &&
    auth.permittedOperations.length <= 2 &&
    auth.permittedOperations.includes(operation) &&
    auth.permittedOperations.every(p => ["mission.create", "mission.read"].includes(p));
}

function recordValid(r, profileScopeDigest) {
  if (!exact(r, KEYS) || r.version !== 1 || !ID.test(r.missionId || "") ||
    r.profileScopeDigest !== profileScopeDigest ||
    !DIGEST.test(r.profileScopeDigest || "") ||
    !SHA.test(r.sourceHead || "") ||
    !["main", "candidate"].includes(r.sourceChannel) ||
    !goodGoal(r.goal) || r.state !== "DRAFT_NOT_DELEGATED" ||
    r.specialist !== "NOT_ASSIGNED" ||
    !Array.isArray(r.evidenceRefs) || r.evidenceRefs.length !== 0 ||
    !Number.isSafeInteger(r.createdAt) || r.createdAt < 0 ||
    !Number.isSafeInteger(r.expiresAt) ||
    r.expiresAt - r.createdAt !== LIFETIME_MS ||
    !DIGEST.test(r.integrityDigest || "")) return false;
  const { integrityDigest, ...body } = r;
  return digest(body) === integrityDigest;
}

async function directory(folder, create = false) {
  try {
    if (create) await mkdir(folder, { recursive: true, mode: 0o700 });
    const st = await lstat(folder);
    if (!st.isDirectory() || st.isSymbolicLink()) throw Error("MISSION_DIRECTORY_UNTRUSTED");
    return true;
  } catch (error) {
    if (!create && error?.code === "ENOENT") return false;
    throw error;
  }
}

async function scopePath(root, scopeDigest, create = false) {
  if (typeof root !== "string" || !path.isAbsolute(root) ||
      !DIGEST.test(scopeDigest || "")) throw Error("MISSION_SCOPE_UNVERIFIED");
  const top = path.join(root, "agent-workspace");
  const scope = path.join(top, scopeDigest);
  // Existing gateway root may be absent on first use; each newly visited
  // directory is checked after creation, including symlink refusal.
  for (const dir of [root, top, scope]) {
    if (!await directory(dir, create)) return null;
  }
  return scope;
}

async function readRecord(file, scopeDigest) {
  const st = await lstat(file);
  if (!st.isFile() || st.isSymbolicLink() || st.size < 100 || st.size > 2048)
    throw Error("MISSION_FILE_UNTRUSTED");
  const r = JSON.parse(await readFile(file, "utf8"));
  if (!recordValid(r, scopeDigest) ||
      path.basename(file) !== r.missionId + ".json")
    throw Error("MISSION_RECORD_UNVERIFIED");
  return r;
}
const observed = (r, source, now) => result(
  r.sourceHead !== source.head || r.sourceChannel !== source.channel
    ? "MISSION_SOURCE_REVIEW_REQUIRED"
    : now >= r.expiresAt ? "MISSION_EXPIRED" : "MISSION_DRAFT",
  { missionId: r.missionId, goal: r.goal, sourceHead: r.sourceHead,
    sourceChannel: r.sourceChannel, createdAt: r.createdAt, expiresAt: r.expiresAt,
    state: r.state, specialist: r.specialist, evidenceRefs: r.evidenceRefs });

export async function createAgentMission({
  root, source, authorization, goal, now = Date.now(),
} = {}) {
  if (!goodSource(source) || !authorized(authorization, source, "mission.create", now))
    return result("MISSION_AUTHORITY_UNVERIFIED");
  if (!goodGoal(goal)) return result("MISSION_GOAL_INVALID");
  try {
    const scope = await scopePath(root, authorization.profileScopeDigest, true);
    if ((await readdir(scope)).length >= LIMIT) return result("MISSION_RECORD_LIMIT");
    const body = {
      version: 1, missionId: randomBytes(16).toString("hex"),
      profileScopeDigest: authorization.profileScopeDigest,
      sourceHead: source.head, sourceChannel: source.channel,
      goal, createdAt: now, expiresAt: now + LIFETIME_MS,
      state: "DRAFT_NOT_DELEGATED", specialist: "NOT_ASSIGNED", evidenceRefs: [],
    };
    const record = { ...body, integrityDigest: digest(body) };
    const file = path.join(scope, record.missionId + ".json");
    const handle = await open(file, "wx", 0o600);
    try {
      await handle.writeFile(JSON.stringify(record) + "\n", "utf8");
      await handle.sync();
    } finally { await handle.close(); }
    const verified = await readRecord(file, authorization.profileScopeDigest);
    return observed(verified, source, now);
  } catch { return result("MISSION_WRITE_UNVERIFIED"); }
}

export async function readLatestAgentMission({
  root, source, authorization, now = Date.now(),
} = {}) {
  if (!goodSource(source) || !authorized(authorization, source, "mission.read", now))
    return result("MISSION_AUTHORITY_UNVERIFIED");
  try {
    const scope = await scopePath(root, authorization.profileScopeDigest);
    if (!scope) return result("MISSION_NONE");
    const entries = await readdir(scope);
    if (entries.length > LIMIT || entries.some(name => !ID.test(name.slice(0, -5)) ||
        !name.endsWith(".json"))) return result("MISSION_DIRECTORY_UNVERIFIED");
    let latest = null;
    for (const name of entries) {
      const record = await readRecord(path.join(scope, name), authorization.profileScopeDigest);
      if (!latest || record.createdAt > latest.createdAt ||
          (record.createdAt === latest.createdAt && record.missionId > latest.missionId))
        latest = record;
    }
    return latest ? observed(latest, source, now) : result("MISSION_NONE");
  } catch { return result("MISSION_READ_UNVERIFIED"); }
}
