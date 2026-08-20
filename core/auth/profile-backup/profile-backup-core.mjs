import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chmod, lstat, mkdir, open, readFile, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import {
  ARGON2ID_DEFAULTS,
  generateRecoverySecret,
  parsePasswordWrappedProfileKey,
  parseRecoveryWrappedProfileKey,
  unwrapProfileMasterKeyWithPassword,
  unwrapProfileMasterKeyWithRecovery,
  unwrapProfileSecret,
  wrapProfileMasterKeyWithPassword,
  wrapProfileMasterKeyWithRecovery,
} from "../profile-crypto-contract-core.mjs";
import { parseAuthPersistentState } from "../plotpickle-auth-core.mjs";
import { profileStoragePaths } from "../../storage/profile-private/profile-private-storage-core.mjs";

export const PROFILE_BACKUP_FORMAT = "plotpickle-human-backup";
export const PROFILE_BACKUP_VERSION = 1;
export const PROFILE_BACKUP_MANIFEST_FORMAT = "plotpickle-human-backup-manifest";

const PROFILE_OBJECT_FORMAT = "plotpickle-profile-private-object";
const PROFILE_OBJECT_VERSION = 1;
const INCLUDED_DOMAINS = Object.freeze(["projects", "library", "memory", "indexes", "assets", "credentials", "settings"]);
const OPTIONAL_NETWORK_DOMAIN = "buzz";
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
const RECOVERY_SECRET_PREFIX = "pprec1";
const RECOVERY_CHECKSUM_BYTES = 5;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const BACKUP_ID_PATTERN = /^backup_[A-Za-z0-9_-]{16,120}$/u;
const ENTRY_REF_PATTERN = /^object-[0-9]{6}$/u;
const PROFILE_ID_PATTERN = /^profile_[A-Za-z0-9_-]+$/u;
const DOMAIN_PATTERN = /^[a-z][a-z0-9-]{1,31}$/u;
const OBJECT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,239}$/iu;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

function fail(code, message, cause) {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.code = code;
  throw error;
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertExactFields(value, fields, label) {
  if (!isRecord(value)) fail("INVALID_PROFILE_BACKUP", `${label} must be an object.`);
  const unexpected = Object.keys(value).filter((key) => !fields.includes(key));
  if (unexpected.length) fail("INVALID_PROFILE_BACKUP", `${label} contains unsupported fields.`);
}

function canonicalIso(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    fail("INVALID_PROFILE_BACKUP", `${label} must be a canonical ISO timestamp.`);
  }
  return value;
}

function profileId(value) {
  if (typeof value !== "string" || !PROFILE_ID_PATTERN.test(value)) fail("INVALID_PROFILE_BACKUP", "Backup profile id is invalid.");
  const encoded = value.slice("profile_".length);
  const decoded = Buffer.from(encoded, "base64url");
  if (!BASE64URL_PATTERN.test(encoded) || decoded.toString("base64url") !== encoded || decoded.byteLength < 16) {
    fail("INVALID_PROFILE_BACKUP", "Backup profile id lacks required opaque entropy.");
  }
  return value;
}

function backupId(value) {
  if (typeof value !== "string" || !BACKUP_ID_PATTERN.test(value)) fail("INVALID_PROFILE_BACKUP", "Backup id is invalid.");
  return value;
}

function entryRef(value) {
  if (typeof value !== "string" || !ENTRY_REF_PATTERN.test(value)) fail("INVALID_PROFILE_BACKUP", "Backup entry reference is invalid.");
  return value;
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("base64url");
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

function profileObjectSecretId(domain, objectId) {
  return `profile-storage:v${PROFILE_OBJECT_VERSION}:${domain}:${objectId}`;
}

function manifestSecretId(id) {
  return `profile-backup:v${PROFILE_BACKUP_VERSION}:${id}:manifest`;
}

function contained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function requireAbsolutePath(value, label) {
  if (typeof value !== "string" || !path.isAbsolute(value)) fail("INVALID_PROFILE_BACKUP_PATH", `${label} must be an absolute path.`);
  return path.resolve(value);
}

function relativeProfilePath(value) {
  if (typeof value !== "string" || value.includes("\\") || value.startsWith("/") || value.includes("\0")) {
    fail("PROFILE_BACKUP_PATH_REJECTED", "Backup object path is invalid.");
  }
  const parts = value.split("/");
  if (parts.length !== 2 || parts.some((part) => !part || part === "." || part === "..")) {
    fail("PROFILE_BACKUP_PATH_REJECTED", "Backup object path is invalid.");
  }
  const [domain, fileName] = parts;
  if (!DOMAIN_PATTERN.test(domain) || !fileName.endsWith(".json")) fail("PROFILE_BACKUP_PATH_REJECTED", "Backup object path is invalid.");
  const objectId = fileName.slice(0, -5);
  if (!OBJECT_ID_PATTERN.test(objectId) || objectId === "." || objectId === "..") fail("PROFILE_BACKUP_PATH_REJECTED", "Backup object id is invalid.");
  return { domain, objectId, relativePath: `${domain}/${fileName}` };
}

function parseEntry(value) {
  assertExactFields(value, ["ref", "sha256", "bytes", "data"], "Backup entry");
  const ref = entryRef(value.ref);
  if (typeof value.sha256 !== "string" || !BASE64URL_PATTERN.test(value.sha256)) fail("INVALID_PROFILE_BACKUP", "Backup entry digest is invalid.");
  if (!Number.isSafeInteger(value.bytes) || value.bytes < 0 || value.bytes > MAX_ENTRY_BYTES) fail("INVALID_PROFILE_BACKUP", "Backup entry size is invalid.");
  if (typeof value.data !== "string") fail("INVALID_PROFILE_BACKUP", "Backup entry payload is invalid.");
  const bytes = Buffer.from(value.data, "base64");
  if (bytes.byteLength !== value.bytes || bytes.toString("base64") !== value.data || sha256Bytes(bytes) !== value.sha256) {
    fail("PROFILE_BACKUP_TAMPERED", "Backup entry integrity check failed.");
  }
  return Object.freeze({ ref, sha256: value.sha256, bytes: value.bytes, data: value.data });
}

export function parseProfileBackupBundle(value) {
  assertExactFields(value, ["format", "version", "header", "credential", "manifestEnvelope", "entries"], "Profile backup");
  if (value.format !== PROFILE_BACKUP_FORMAT || value.version !== PROFILE_BACKUP_VERSION) fail("INVALID_PROFILE_BACKUP", "Profile backup format or version is unsupported.");
  assertExactFields(value.header, ["profileId", "backupId", "createdAt"], "Profile backup header");
  const normalizedProfileId = profileId(value.header.profileId);
  const normalizedBackupId = backupId(value.header.backupId);
  const createdAt = canonicalIso(value.header.createdAt, "Backup creation time");
  assertExactFields(value.credential, ["profileId", "passwordEnvelope", "recoveryEnvelope"], "Profile backup credential");
  if (value.credential.profileId !== normalizedProfileId) fail("INVALID_PROFILE_BACKUP", "Backup credential owner is invalid.");
  const credential = Object.freeze({
    profileId: normalizedProfileId,
    passwordEnvelope: parsePasswordWrappedProfileKey(value.credential.passwordEnvelope),
    recoveryEnvelope: parseRecoveryWrappedProfileKey(value.credential.recoveryEnvelope),
  });
  if (credential.passwordEnvelope.profileId !== normalizedProfileId || credential.recoveryEnvelope.profileId !== normalizedProfileId) {
    fail("INVALID_PROFILE_BACKUP", "Backup credential does not match the backup profile.");
  }
  if (!isRecord(value.manifestEnvelope)
    || value.manifestEnvelope.profileId !== normalizedProfileId
    || value.manifestEnvelope.secretId !== manifestSecretId(normalizedBackupId)) {
    fail("INVALID_PROFILE_BACKUP", "Backup manifest envelope ownership is invalid.");
  }
  if (!Array.isArray(value.entries)) fail("INVALID_PROFILE_BACKUP", "Backup entries must be an array.");
  let total = 0;
  const entries = value.entries.map((item) => {
    const parsed = parseEntry(item);
    total += parsed.bytes;
    if (total > MAX_TOTAL_BYTES) fail("PROFILE_BACKUP_TOO_LARGE", "Profile backup exceeds the supported size boundary.");
    return parsed;
  });
  if (new Set(entries.map((item) => item.ref)).size !== entries.length) fail("INVALID_PROFILE_BACKUP", "Backup entry references must be unique.");
  return Object.freeze({
    format: PROFILE_BACKUP_FORMAT,
    version: PROFILE_BACKUP_VERSION,
    header: Object.freeze({ profileId: normalizedProfileId, backupId: normalizedBackupId, createdAt }),
    credential,
    manifestEnvelope: structuredClone(value.manifestEnvelope),
    entries: Object.freeze(entries),
  });
}

function decodeRecoverySecret(value) {
  if (typeof value !== "string") fail("PROFILE_BACKUP_AUTH_REJECTED", "Profile backup authentication failed.");
  if (!value.startsWith(`${RECOVERY_SECRET_PREFIX}.`)) {
    const raw = Buffer.from(value, "base64url");
    if (!BASE64URL_PATTERN.test(value) || raw.toString("base64url") !== value || raw.byteLength !== 32) fail("PROFILE_BACKUP_AUTH_REJECTED", "Profile backup authentication failed.");
    return raw;
  }
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== RECOVERY_SECRET_PREFIX) fail("PROFILE_BACKUP_AUTH_REJECTED", "Profile backup authentication failed.");
  const secret = Buffer.from(parts[1], "base64url");
  const supplied = Buffer.from(parts[2], "base64url");
  if (secret.byteLength !== 32 || supplied.byteLength !== RECOVERY_CHECKSUM_BYTES
    || secret.toString("base64url") !== parts[1] || supplied.toString("base64url") !== parts[2]) {
    secret.fill(0);
    supplied.fill(0);
    fail("PROFILE_BACKUP_AUTH_REJECTED", "Profile backup authentication failed.");
  }
  const expected = createHash("sha256")
    .update("plotpickle:recovery-secret:v1\0", "utf8")
    .update(secret)
    .digest()
    .subarray(0, RECOVERY_CHECKSUM_BYTES);
  try {
    if (!timingSafeEqual(supplied, expected)) fail("PROFILE_BACKUP_AUTH_REJECTED", "Profile backup authentication failed.");
    return secret;
  } catch (error) {
    secret.fill(0);
    throw error;
  } finally {
    supplied.fill(0);
    expected.fill(0);
  }
}

function encodeRecoverySecret(value) {
  const secret = Buffer.from(value);
  const checksum = createHash("sha256")
    .update("plotpickle:recovery-secret:v1\0", "utf8")
    .update(secret)
    .digest()
    .subarray(0, RECOVERY_CHECKSUM_BYTES);
  try {
    return `${RECOVERY_SECRET_PREFIX}.${secret.toString("base64url")}.${checksum.toString("base64url")}`;
  } finally {
    secret.fill(0);
    checksum.fill(0);
  }
}

async function unwrapBackupPmk(bundle, secret) {
  let recovery;
  try {
    if (secret?.password !== undefined) {
      return await unwrapProfileMasterKeyWithPassword(bundle.credential.passwordEnvelope, secret.password, bundle.header.profileId);
    }
    if (secret?.recoverySecret !== undefined) {
      recovery = decodeRecoverySecret(secret.recoverySecret);
      return await unwrapProfileMasterKeyWithRecovery(bundle.credential.recoveryEnvelope, recovery, bundle.header.profileId);
    }
    fail("PROFILE_BACKUP_AUTH_REJECTED", "Profile backup authentication failed.");
  } catch (error) {
    if (error?.code === "PROFILE_BACKUP_AUTH_REJECTED") throw error;
    fail("PROFILE_BACKUP_AUTH_REJECTED", "Profile backup authentication failed.", error);
  } finally {
    recovery?.fill(0);
  }
}

function parseManifest(value, bundle) {
  assertExactFields(value, ["format", "version", "backupId", "createdAt", "profile", "includeNetworkIdentity", "credentialSha256", "entries"], "Backup manifest");
  if (value.format !== PROFILE_BACKUP_MANIFEST_FORMAT || value.version !== PROFILE_BACKUP_VERSION) fail("INVALID_PROFILE_BACKUP", "Backup manifest format or version is unsupported.");
  if (backupId(value.backupId) !== bundle.header.backupId || canonicalIso(value.createdAt, "Backup manifest creation time") !== bundle.header.createdAt) {
    fail("PROFILE_BACKUP_TAMPERED", "Backup manifest does not match its public header.");
  }
  if (!isRecord(value.profile) || profileId(value.profile.profileId) !== bundle.header.profileId) fail("INVALID_PROFILE_BACKUP", "Backup profile metadata is invalid.");
  if (typeof value.profile.displayName !== "string" || !value.profile.displayName.trim() || value.profile.displayName.length > 120) fail("INVALID_PROFILE_BACKUP", "Backup profile display name is invalid.");
  if (typeof value.profile.status !== "string" || !["active", "disabled"].includes(value.profile.status)) fail("INVALID_PROFILE_BACKUP", "Backup profile status is invalid.");
  if (!Number.isSafeInteger(value.profile.vaultVersion) || value.profile.vaultVersion < 1 || !Array.isArray(value.profile.authMethods)) fail("INVALID_PROFILE_BACKUP", "Backup profile vault metadata is invalid.");
  if (typeof value.includeNetworkIdentity !== "boolean") fail("INVALID_PROFILE_BACKUP", "Backup network identity policy is invalid.");
  const credentialDigest = sha256Text(JSON.stringify(bundle.credential));
  if (value.credentialSha256 !== credentialDigest) fail("PROFILE_BACKUP_TAMPERED", "Backup credential record does not match the authenticated manifest.");
  if (!Array.isArray(value.entries) || value.entries.length !== bundle.entries.length) fail("INVALID_PROFILE_BACKUP", "Backup manifest entry inventory is invalid.");
  const manifestEntries = value.entries.map((item) => {
    assertExactFields(item, ["ref", "relativePath", "sha256", "bytes"], "Backup manifest entry");
    const normalized = relativeProfilePath(item.relativePath);
    const ref = entryRef(item.ref);
    if (typeof item.sha256 !== "string" || !BASE64URL_PATTERN.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 0) {
      fail("INVALID_PROFILE_BACKUP", "Backup manifest entry integrity metadata is invalid.");
    }
    return Object.freeze({ ref, ...normalized, sha256: item.sha256, bytes: item.bytes });
  });
  if (new Set(manifestEntries.map((item) => item.relativePath)).size !== manifestEntries.length) fail("INVALID_PROFILE_BACKUP", "Backup object paths must be unique.");
  const payloadByRef = new Map(bundle.entries.map((entry) => [entry.ref, entry]));
  for (const item of manifestEntries) {
    const payload = payloadByRef.get(item.ref);
    if (!payload || payload.sha256 !== item.sha256 || payload.bytes !== item.bytes) fail("PROFILE_BACKUP_TAMPERED", "Backup manifest entry does not match its payload.");
    if (![...INCLUDED_DOMAINS, ...(value.includeNetworkIdentity ? [OPTIONAL_NETWORK_DOMAIN] : [])].includes(item.domain)) {
      fail("PROFILE_BACKUP_PATH_REJECTED", "Backup contains a disallowed profile storage domain.");
    }
  }
  return Object.freeze({
    format: PROFILE_BACKUP_MANIFEST_FORMAT,
    version: PROFILE_BACKUP_VERSION,
    backupId: value.backupId,
    createdAt: value.createdAt,
    profile: Object.freeze(structuredClone(value.profile)),
    includeNetworkIdentity: value.includeNetworkIdentity,
    credentialSha256: value.credentialSha256,
    entries: Object.freeze(manifestEntries),
  });
}

async function verifyEntryRecord(entry, payload, profileMasterKey, expectedProfileId) {
  const source = Buffer.from(payload.data, "base64").toString("utf8");
  let record;
  try {
    record = JSON.parse(source);
  } catch (error) {
    fail("PROFILE_BACKUP_TAMPERED", "Backup profile object is not valid JSON.", error);
  }
  if (!isRecord(record)
    || record.format !== PROFILE_OBJECT_FORMAT
    || record.version !== PROFILE_OBJECT_VERSION
    || record.profileId !== expectedProfileId
    || record.domain !== entry.domain
    || record.objectId !== entry.objectId
    || !isRecord(record.envelope)) {
    fail("PROFILE_BACKUP_TAMPERED", "Backup profile object ownership metadata is invalid.");
  }
  let clear;
  try {
    clear = await unwrapProfileSecret(record.envelope, profileMasterKey, {
      profileId: expectedProfileId,
      secretId: profileObjectSecretId(entry.domain, entry.objectId),
    });
    JSON.parse(textDecoder.decode(clear));
  } catch (error) {
    fail("PROFILE_BACKUP_TAMPERED", "Backup profile object could not be authenticated.", error);
  } finally {
    clear?.fill(0);
  }
}

async function verifyWithPmk(bundle, profileMasterKey) {
  let manifestBytes;
  try {
    manifestBytes = await unwrapProfileSecret(bundle.manifestEnvelope, profileMasterKey, {
      profileId: bundle.header.profileId,
      secretId: manifestSecretId(bundle.header.backupId),
    });
    const manifest = parseManifest(JSON.parse(textDecoder.decode(manifestBytes)), bundle);
    const payloadByRef = new Map(bundle.entries.map((entry) => [entry.ref, entry]));
    for (const entry of manifest.entries) await verifyEntryRecord(entry, payloadByRef.get(entry.ref), profileMasterKey, bundle.header.profileId);
    return manifest;
  } catch (error) {
    if (error?.code?.startsWith?.("PROFILE_BACKUP_") || error?.code === "INVALID_PROFILE_BACKUP") throw error;
    fail("PROFILE_BACKUP_TAMPERED", "Profile backup authentication or integrity verification failed.", error);
  } finally {
    manifestBytes?.fill(0);
  }
}

export async function verifyProfileBackupBundle(value, secret) {
  const bundle = parseProfileBackupBundle(value);
  const pmk = await unwrapBackupPmk(bundle, secret);
  try {
    const manifest = await verifyWithPmk(bundle, pmk);
    return Object.freeze({
      profileId: bundle.header.profileId,
      displayName: manifest.profile.displayName,
      createdAt: bundle.header.createdAt,
      objectCount: manifest.entries.length,
      includesNetworkIdentity: manifest.includeNetworkIdentity,
    });
  } finally {
    pmk.fill(0);
  }
}

async function listProfileFiles(profileRoot, includeNetworkIdentity) {
  const domains = [...INCLUDED_DOMAINS, ...(includeNetworkIdentity ? [OPTIONAL_NETWORK_DOMAIN] : [])];
  const items = [];
  for (const domain of domains) {
    const directory = path.join(profileRoot, domain);
    let directoryInfo;
    try {
      directoryInfo = await lstat(directory);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) fail("PROFILE_BACKUP_PATH_REJECTED", "Profile backup directory must be a real directory.");
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.isSymbolicLink()) fail("PROFILE_BACKUP_PATH_REJECTED", "Profile backup cannot follow symbolic links.");
      if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name.includes(".previous") || entry.name.includes(".quarantine") || entry.name.startsWith(".")) continue;
      const objectId = entry.name.slice(0, -5);
      if (!OBJECT_ID_PATTERN.test(objectId)) continue;
      const filePath = path.join(directory, entry.name);
      const information = await lstat(filePath);
      if (!information.isFile() || information.isSymbolicLink() || information.size > MAX_ENTRY_BYTES) fail("PROFILE_BACKUP_PATH_REJECTED", "Profile backup object is not a supported regular file.");
      items.push({ domain, objectId, relativePath: `${domain}/${entry.name}`, filePath, bytes: information.size });
    }
  }
  return items;
}

export async function createProfileBackupBundle(options) {
  const root = requireAbsolutePath(options?.root, "PlotPickle profile root");
  const authService = options?.authService;
  const stateStore = options?.stateStore;
  const authContext = options?.authContext;
  const includeNetworkIdentity = options?.includeNetworkIdentity === true;
  if (!authService || typeof authService.requireRecentReauthentication !== "function" || typeof authService.createProfileVaultCapability !== "function") {
    fail("INVALID_PROFILE_BACKUP", "Profile backup requires the canonical Auth service.");
  }
  if (!stateStore || typeof stateStore.read !== "function") fail("INVALID_PROFILE_BACKUP", "Profile backup requires the canonical Auth state store.");
  const recent = authService.requireRecentReauthentication(authContext);
  const normalizedProfileId = profileId(recent.profileId);
  const state = await stateStore.read();
  const profile = state?.registry?.profiles?.[normalizedProfileId];
  const credential = state?.credentials?.[normalizedProfileId];
  if (!profile || !credential) fail("PROFILE_BACKUP_UNAVAILABLE", "Authenticated profile backup source is unavailable.");
  const capability = authService.createProfileVaultCapability(recent);
  const locations = profileStoragePaths(root, normalizedProfileId);
  const inventory = await listProfileFiles(locations.profileRoot, includeNetworkIdentity);
  let total = 0;
  const payloadEntries = [];
  const manifestEntries = [];
  for (const [index, item] of inventory.entries()) {
    const bytes = await readFile(item.filePath);
    total += bytes.byteLength;
    if (total > MAX_TOTAL_BYTES) fail("PROFILE_BACKUP_TOO_LARGE", "Profile backup exceeds the supported size boundary.");
    const ref = `object-${String(index + 1).padStart(6, "0")}`;
    const digest = sha256Bytes(bytes);
    let record;
    try {
      record = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      fail("PROFILE_BACKUP_SOURCE_CORRUPT", "Profile backup source object is not valid JSON.", error);
    }
    if (!isRecord(record)
      || record.format !== PROFILE_OBJECT_FORMAT
      || record.version !== PROFILE_OBJECT_VERSION
      || record.profileId !== normalizedProfileId
      || record.domain !== item.domain
      || record.objectId !== item.objectId
      || !isRecord(record.envelope)) {
      fail("PROFILE_BACKUP_SOURCE_CORRUPT", "Profile backup source object ownership metadata is invalid.");
    }
    let clear;
    try {
      clear = await capability.unwrapSecret({ envelope: record.envelope, secretId: profileObjectSecretId(item.domain, item.objectId) });
      JSON.parse(textDecoder.decode(clear));
    } catch (error) {
      fail("PROFILE_BACKUP_SOURCE_CORRUPT", "Profile backup source object could not be authenticated.", error);
    } finally {
      clear?.fill(0);
    }
    payloadEntries.push(Object.freeze({ ref, sha256: digest, bytes: bytes.byteLength, data: bytes.toString("base64") }));
    manifestEntries.push(Object.freeze({ ref, relativePath: item.relativePath, sha256: digest, bytes: bytes.byteLength }));
  }
  const generated = options?.randomBytes ? options.randomBytes(18) : randomBytes(18);
  if (!(generated instanceof Uint8Array) || generated.byteLength !== 18) fail("PROFILE_BACKUP_RANDOM_UNAVAILABLE", "Backup id generation failed closed.");
  const id = `backup_${Buffer.from(generated).toString("base64url")}`;
  const createdAt = new Date(typeof options?.now === "function" ? options.now() : Date.now()).toISOString();
  const manifest = {
    format: PROFILE_BACKUP_MANIFEST_FORMAT,
    version: PROFILE_BACKUP_VERSION,
    backupId: id,
    createdAt,
    profile: structuredClone(profile),
    includeNetworkIdentity,
    credentialSha256: sha256Text(JSON.stringify(credential)),
    entries: manifestEntries,
  };
  const manifestBytes = textEncoder.encode(JSON.stringify(manifest));
  let manifestEnvelope;
  try {
    manifestEnvelope = await capability.wrapSecret({ secretId: manifestSecretId(id), secret: manifestBytes });
    const verified = await capability.unwrapSecret({ envelope: manifestEnvelope, secretId: manifestSecretId(id) });
    try {
      if (JSON.stringify(JSON.parse(textDecoder.decode(verified))) !== JSON.stringify(manifest)) fail("PROFILE_BACKUP_VERIFY_FAILED", "Backup manifest verification failed.");
    } finally {
      verified.fill(0);
    }
  } finally {
    manifestBytes.fill(0);
  }
  return parseProfileBackupBundle({
    format: PROFILE_BACKUP_FORMAT,
    version: PROFILE_BACKUP_VERSION,
    header: { profileId: normalizedProfileId, backupId: id, createdAt },
    credential: structuredClone(credential),
    manifestEnvelope,
    entries: payloadEntries,
  });
}

export function serializeProfileBackupBundle(value) {
  return `${JSON.stringify(parseProfileBackupBundle(value), null, 2)}\n`;
}

export async function writeProfileBackupFile(value, destination) {
  const target = requireAbsolutePath(destination, "Profile backup destination");
  if (!target.toLowerCase().endsWith(".ppbackup")) fail("INVALID_PROFILE_BACKUP_PATH", "Profile backup destination must use the .ppbackup extension.");
  const directory = path.dirname(target);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const serialized = serializeProfileBackupBundle(value);
  const temporary = path.join(directory, `.${path.basename(target)}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`);
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(serialized, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    parseProfileBackupBundle(JSON.parse(await readFile(temporary, "utf8")));
    await rename(temporary, target);
    try { await chmod(target, 0o600); } catch (error) {
      if (!new Set(["EACCES", "EPERM", "EINVAL", "ENOSYS", "ENOTSUP"]).has(error?.code || "")) throw error;
    }
    return target;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readProfileBackupFile(source) {
  const filePath = requireAbsolutePath(source, "Profile backup source");
  const information = await lstat(filePath);
  if (!information.isFile() || information.isSymbolicLink() || information.size > MAX_TOTAL_BYTES * 2) fail("INVALID_PROFILE_BACKUP_PATH", "Profile backup source must be a supported regular file.");
  return parseProfileBackupBundle(JSON.parse(await readFile(filePath, "utf8")));
}

async function writeStagedProfile(root, manifest, bundle) {
  const profilesRoot = path.join(root, "profiles");
  await mkdir(profilesRoot, { recursive: true, mode: 0o700 });
  const staging = path.join(profilesRoot, `.restore-${manifest.backupId}`);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { mode: 0o700 });
  const payloadByRef = new Map(bundle.entries.map((entry) => [entry.ref, entry]));
  try {
    for (const entry of manifest.entries) {
      const normalized = relativeProfilePath(entry.relativePath);
      const destination = path.resolve(staging, ...normalized.relativePath.split("/"));
      if (!contained(staging, destination)) fail("PROFILE_BACKUP_PATH_REJECTED", "Restored object escaped the staging profile root.");
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      const payload = payloadByRef.get(entry.ref);
      const bytes = Buffer.from(payload.data, "base64");
      const handle = await open(destination, "wx", 0o600);
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      const written = await readFile(destination);
      if (sha256Bytes(written) !== entry.sha256) fail("PROFILE_BACKUP_RESTORE_FAILED", "Restored profile object failed staging verification.");
    }
    return staging;
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

function validateRestorePassword(value) {
  const candidate = typeof value === "string" ? value : value instanceof Uint8Array ? textDecoder.decode(value) : "";
  if (candidate.length < 12 || candidate.length > 1024 || candidate.trim() !== candidate || /^\d+$/u.test(candidate)) {
    fail("INVALID_PROFILE_PASSWORD", "Restored profile password must be a strong passphrase of at least 12 characters.");
  }
  return true;
}

function verifyBootstrapProof(bootstrap, proof) {
  if (!bootstrap || bootstrap.consumedAt !== null || typeof proof !== "string") fail("RESTORE_BOOTSTRAP_REQUIRED", "Server restore requires the current one-time bootstrap proof.");
  const suppliedBytes = Buffer.from(proof, "base64url");
  if (suppliedBytes.byteLength !== 32 || suppliedBytes.toString("base64url") !== proof) fail("RESTORE_BOOTSTRAP_REQUIRED", "Server restore requires the current one-time bootstrap proof.");
  const suppliedDigest = createHash("sha256").update(suppliedBytes).digest();
  const storedDigest = Buffer.from(bootstrap.proofDigest || "", "base64url");
  suppliedBytes.fill(0);
  try {
    if (storedDigest.byteLength !== 32 || !timingSafeEqual(suppliedDigest, storedDigest)) fail("RESTORE_BOOTSTRAP_REQUIRED", "Server restore requires the current one-time bootstrap proof.");
  } finally {
    suppliedDigest.fill(0);
    storedDigest.fill(0);
  }
}

export async function restoreProfileBackupToStateStore(options) {
  const root = requireAbsolutePath(options?.root, "PlotPickle profile root");
  const stateStore = options?.stateStore;
  if (!stateStore || typeof stateStore.read !== "function" || typeof stateStore.write !== "function") fail("INVALID_PROFILE_BACKUP", "Profile restore requires the canonical Auth state store.");
  const bundle = parseProfileBackupBundle(options?.bundle);
  const secret = options?.recoverySecret !== undefined ? { recoverySecret: options.recoverySecret } : { password: options?.password };
  const pmk = await unwrapBackupPmk(bundle, secret);
  let replacementRecoverySecret;
  try {
    const manifest = await verifyWithPmk(bundle, pmk);
    const stored = await stateStore.read();
    if (!stored) fail("PROFILE_BACKUP_RESTORE_FAILED", "Destination Auth state is unavailable.");
    const current = parseAuthPersistentState(stored);
    const destinationNodeId = options?.nodeId || current.registry.nodeId;
    const destinationAccessMode = options?.accessMode || current.accessMode;
    const normalizedCurrent = parseAuthPersistentState(current, { nodeId: destinationNodeId, accessMode: destinationAccessMode });
    if (normalizedCurrent.registry.profiles[bundle.header.profileId]) fail("PROFILE_RESTORE_CONFLICT", "This Human profile already exists on the destination Node.");
    let restoredProfile = structuredClone(manifest.profile);
    let restoredCredential = structuredClone(bundle.credential);
    let recoverySecret = null;
    if (options?.recoverySecret !== undefined) {
      validateRestorePassword(options?.newPassword);
      replacementRecoverySecret = await generateRecoverySecret();
      const passwordEnvelope = await wrapProfileMasterKeyWithPassword({
        profileId: bundle.header.profileId,
        password: options.newPassword,
        profileMasterKey: pmk,
        parameters: ARGON2ID_DEFAULTS,
      });
      const recoveryEnvelope = await wrapProfileMasterKeyWithRecovery({
        profileId: bundle.header.profileId,
        recoverySecret: replacementRecoverySecret,
        profileMasterKey: pmk,
      });
      restoredCredential = { profileId: bundle.header.profileId, passwordEnvelope, recoveryEnvelope };
      restoredProfile = { ...restoredProfile, vaultVersion: restoredProfile.vaultVersion + 1, updatedAt: new Date(typeof options?.now === "function" ? options.now() : Date.now()).toISOString(), status: "active" };
      recoverySecret = encodeRecoverySecret(replacementRecoverySecret);
    }
    let bootstrap = normalizedCurrent.bootstrap;
    if (destinationAccessMode === "server-network" && !Object.keys(normalizedCurrent.registry.profiles).length && bootstrap?.consumedAt === null) {
      verifyBootstrapProof(bootstrap, options?.bootstrapProof);
      bootstrap = { ...bootstrap, proofDigest: null, consumedAt: new Date(typeof options?.now === "function" ? options.now() : Date.now()).toISOString() };
    }
    const profilesRoot = path.join(root, "profiles");
    const finalRoot = path.join(profilesRoot, bundle.header.profileId);
    let finalExists = false;
    try {
      const info = await lstat(finalRoot);
      finalExists = true;
      if (!info.isDirectory() || info.isSymbolicLink()) fail("PROFILE_RESTORE_CONFLICT", "Destination profile path is not a valid profile directory.");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const staging = await writeStagedProfile(root, manifest, bundle);
    if (finalExists) {
      const existingFiles = await listProfileFiles(finalRoot, true);
      const expected = new Map(manifest.entries.map((entry) => [entry.relativePath, entry.sha256]));
      const matches = existingFiles.length === expected.size && (await Promise.all(existingFiles.map(async (item) => expected.get(item.relativePath) === sha256Bytes(await readFile(item.filePath))))).every(Boolean);
      if (!matches) {
        await rm(staging, { recursive: true, force: true });
        fail("PROFILE_RESTORE_CONFLICT", "An unrelated orphan profile directory occupies the restored profile id.");
      }
      await rm(staging, { recursive: true, force: true });
    } else {
      await rename(staging, finalRoot);
    }
    const nextState = parseAuthPersistentState({
      ...normalizedCurrent,
      registry: {
        ...normalizedCurrent.registry,
        nodeId: destinationNodeId,
        profiles: { ...normalizedCurrent.registry.profiles, [bundle.header.profileId]: restoredProfile },
      },
      credentials: { ...normalizedCurrent.credentials, [bundle.header.profileId]: restoredCredential },
      bootstrap,
    }, { nodeId: destinationNodeId, accessMode: destinationAccessMode });
    try {
      await stateStore.write(nextState);
    } catch (error) {
      if (!finalExists) await rm(finalRoot, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
    return Object.freeze({
      profileId: bundle.header.profileId,
      displayName: restoredProfile.displayName,
      includesNetworkIdentity: manifest.includeNetworkIdentity,
      recoverySecret,
    });
  } finally {
    pmk.fill(0);
    replacementRecoverySecret?.fill(0);
  }
}
