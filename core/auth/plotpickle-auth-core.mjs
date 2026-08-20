import { createHash, randomBytes as systemRandomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import {
  ARGON2ID_DEFAULTS,
  generateProfileMasterKey,
  generateRecoverySecret,
  normalizeArgon2idParameters,
  parsePasswordWrappedProfileKey,
  parseRecoveryWrappedProfileKey,
  unwrapProfileMasterKeyWithPassword,
  unwrapProfileMasterKeyWithRecovery,
  unwrapProfileSecret,
  wrapProfileMasterKeyWithPassword,
  wrapProfileMasterKeyWithRecovery,
  wrapProfileSecret,
} from "./profile-crypto-contract-core.mjs";

export const AUTH_STATE_FORMAT = "plotpickle-auth-state";
export const AUTH_STATE_VERSION = 1;
export const AUTH_ACCESS_MODES = Object.freeze(["desktop-loopback", "server-network"]);
export const PROFILE_STATUSES = Object.freeze(["active", "disabled"]);
export const PROFILE_AUTH_METHODS = Object.freeze(["password", "recovery", "webauthn"]);
export const AUTH_STRENGTHS = Object.freeze(["password", "password+webauthn", "recovery"]);
export const PROFILE_VAULT_STATES = Object.freeze([
  "uninitialized", "locked", "unlocking", "unlocked", "locking", "recovery-required", "corrupt",
]);
export const PROFILE_VAULT_KDF_MAINTENANCE = Object.freeze(["current", "upgrade-pending", "upgraded", "upgrade-deferred", "not-applicable"]);
export const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1_000;
export const DEFAULT_SESSION_IDLE_TTL_MS = 30 * 60 * 1_000;
export const DEFAULT_RECENT_REAUTHENTICATION_MS = 10 * 60 * 1_000;
export const DEFAULT_BOOTSTRAP_TTL_MS = 15 * 60 * 1_000;

const STATE_FIELDS = Object.freeze(["format", "version", "accessMode", "registry", "credentials", "bootstrap"]);
const REGISTRY_FIELDS = Object.freeze(["version", "nodeId", "profiles"]);
const PROFILE_FIELDS = Object.freeze([
  "profileId", "displayName", "createdAt", "updatedAt", "status", "vaultVersion", "authMethods", "avatarRef",
]);
const CREDENTIAL_FIELDS = Object.freeze(["profileId", "passwordEnvelope", "recoveryEnvelope"]);
const BOOTSTRAP_FIELDS = Object.freeze(["version", "proofDigest", "createdAt", "expiresAt", "consumedAt"]);
const AUTH_CONTEXT_FIELDS = Object.freeze([
  "sessionId", "profileId", "nodeId", "authStrength", "issuedAt", "expiresAt", "roles",
]);
const PROFILE_SUMMARY_FIELDS = Object.freeze(["profileId", "displayName", "avatarRef", "status"]);
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const RECOVERY_SECRET_PREFIX = "pprec1";
const RECOVERY_CHECKSUM_BYTES = 5;
const SESSION_ID_BYTES = 32;
const SESSION_MANAGEMENT_ID_BYTES = 16;
const CSRF_TOKEN_BYTES = 32;
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const KNOWN_WEAK_PASSWORDS = Object.freeze(new Set([
  "admin", "admin/admin", "changeme", "letmein", "localhost", "password", "password123", "plotpickle", "qwerty123",
]));

export class PlotPickleAuthError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "PlotPickleAuthError";
    this.code = code;
    this.publicCode = options.publicCode || code;
    this.publicMessage = options.publicMessage || message;
  }
}

function fail(code, message, options) {
  throw new PlotPickleAuthError(code, message, options);
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertExactFields(value, allowed, label) {
  if (!isRecord(value)) fail("INVALID_AUTH_CONTRACT", `${label} must be an object.`);
  const unexpected = Object.keys(value).filter((field) => !allowed.includes(field));
  if (unexpected.length) fail("INVALID_AUTH_CONTRACT", `${label} contains unsupported fields: ${unexpected.join(", ")}.`);
}

function exactString(value, label, { maximumLength = 200, pattern } = {}) {
  if (typeof value !== "string" || value.length < 1 || value.length > maximumLength || value.trim() !== value || /[\u0000-\u001f\u007f]/u.test(value)) {
    fail("INVALID_AUTH_CONTRACT", `${label} must be a non-empty string without control characters.`);
  }
  if (pattern && !pattern.test(value)) fail("INVALID_AUTH_CONTRACT", `${label} uses an unsupported format.`);
  return value;
}

function opaqueId(value, label) {
  return exactString(value, label, { maximumLength: 200, pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u });
}

function profileId(value) {
  const normalized = exactString(value, "Profile id", { maximumLength: 80, pattern: /^profile_[A-Za-z0-9_-]+$/u });
  const encoded = normalized.slice("profile_".length);
  const decoded = Buffer.from(encoded, "base64url");
  if (!BASE64URL_PATTERN.test(encoded) || decoded.toString("base64url") !== encoded || decoded.byteLength < 16) {
    fail("INVALID_AUTH_CONTRACT", "Profile ids must carry at least 128 bits of opaque random material.");
  }
  return normalized;
}

function displayName(value) {
  if (typeof value !== "string") fail("INVALID_AUTH_CONTRACT", "Profile display name must be a string.");
  const normalized = value.trim();
  if (!normalized || normalized.length > 120 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    fail("INVALID_AUTH_CONTRACT", "Profile display name must be 1-120 characters without control characters.");
  }
  return normalized;
}

function assertStrongProfilePassword(value, identityHints) {
  let candidate;
  try {
    candidate = typeof value === "string" ? value : value instanceof Uint8Array ? textDecoder.decode(value) : null;
  } catch (error) {
    fail("INVALID_PROFILE_PASSWORD", "Profile password bytes must be valid UTF-8.", { cause: error });
  }
  if (candidate === null || candidate.length < 12 || candidate.length > 1_024 || candidate.trim() !== candidate) {
    fail("INVALID_PROFILE_PASSWORD", "Profile password or passphrase must contain 12-1024 non-padding characters.");
  }
  const folded = candidate.toLocaleLowerCase("en-US");
  if (/^\d+$/u.test(candidate) || /^(.)\1+$/u.test(candidate) || KNOWN_WEAK_PASSWORDS.has(folded) || identityHints.some((hint) => folded === hint.toLocaleLowerCase("en-US"))) {
    fail("INVALID_PROFILE_PASSWORD", "Profile password or passphrase is predictable from public setup information.");
  }
  return true;
}

function avatarRef(value) {
  if (value === null || value === undefined || value === "") return null;
  return exactString(value, "Avatar reference", { maximumLength: 200, pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u });
}

function isoDate(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    fail("INVALID_AUTH_CONTRACT", `${label} must be a canonical ISO-8601 timestamp.`);
  }
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) fail("INVALID_AUTH_CONTRACT", `${label} must be a positive integer.`);
  return value;
}

function boundedDuration(value, label, maximum) {
  const duration = positiveInteger(value, label);
  if (duration > maximum) fail("INVALID_AUTH_CONTRACT", `${label} exceeds the supported security boundary.`);
  return duration;
}

function exactStringArray(value, allowed, label) {
  if (!Array.isArray(value) || !value.length || new Set(value).size !== value.length || value.some((entry) => !allowed.includes(entry))) {
    fail("INVALID_AUTH_CONTRACT", `${label} is invalid.`);
  }
  return Object.freeze([...value]);
}

function base64UrlBytes(value, label, bytes) {
  if (typeof value !== "string" || !BASE64URL_PATTERN.test(value)) fail("INVALID_AUTH_CONTRACT", `${label} must use unpadded base64url encoding.`);
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value || decoded.byteLength !== bytes) fail("INVALID_AUTH_CONTRACT", `${label} must contain exactly ${bytes} bytes.`);
  return decoded;
}

function encodeRecoverySecret(value) {
  const secret = new Uint8Array(value);
  const checksum = createHash("sha256")
    .update("plotpickle:recovery-secret:v1\0", "utf8")
    .update(secret)
    .digest()
    .subarray(0, RECOVERY_CHECKSUM_BYTES);
  try {
    return `${RECOVERY_SECRET_PREFIX}.${Buffer.from(secret.buffer, secret.byteOffset, secret.byteLength).toString("base64url")}.${checksum.toString("base64url")}`;
  } finally {
    secret.fill(0);
    checksum.fill(0);
  }
}

function decodeRecoverySecret(value) {
  if (typeof value !== "string") fail("INVALID_AUTH_CONTRACT", "Recovery secret must be a string.");
  if (!value.startsWith(`${RECOVERY_SECRET_PREFIX}.`)) return base64UrlBytes(value, "Recovery secret", 32);
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== RECOVERY_SECRET_PREFIX) fail("INVALID_AUTH_CONTRACT", "Recovery secret checksum is invalid.");
  let secret;
  let suppliedChecksum;
  let expectedChecksum;
  try {
    secret = base64UrlBytes(parts[1], "Recovery secret", 32);
    suppliedChecksum = base64UrlBytes(parts[2], "Recovery secret checksum", RECOVERY_CHECKSUM_BYTES);
    expectedChecksum = createHash("sha256")
      .update("plotpickle:recovery-secret:v1\0", "utf8")
      .update(secret)
      .digest()
      .subarray(0, RECOVERY_CHECKSUM_BYTES);
    if (!timingSafeEqual(suppliedChecksum, expectedChecksum)) fail("INVALID_AUTH_CONTRACT", "Recovery secret checksum is invalid.");
    return secret;
  } catch (error) {
    secret?.fill(0);
    throw error;
  } finally {
    suppliedChecksum?.fill(0);
    expectedChecksum?.fill(0);
  }
}

function clone(value) {
  return value === null || value === undefined ? value : structuredClone(value);
}

function freezeProfile(value) {
  assertExactFields(value, PROFILE_FIELDS, "Human profile metadata");
  const createdAt = isoDate(value.createdAt, "Profile creation time");
  const updatedAt = isoDate(value.updatedAt, "Profile update time");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) fail("INVALID_AUTH_CONTRACT", "Profile update time cannot precede profile creation time.");
  return Object.freeze({
    profileId: profileId(value.profileId),
    displayName: displayName(value.displayName),
    createdAt,
    updatedAt,
    status: PROFILE_STATUSES.includes(value.status) ? value.status : fail("INVALID_AUTH_CONTRACT", "Profile status is invalid."),
    vaultVersion: positiveInteger(value.vaultVersion, "Profile vault version"),
    authMethods: exactStringArray(value.authMethods, PROFILE_AUTH_METHODS, "Profile auth methods"),
    avatarRef: avatarRef(value.avatarRef),
  });
}

function freezeCredential(value, expectedProfileId) {
  assertExactFields(value, CREDENTIAL_FIELDS, "Profile credential record");
  const normalizedProfileId = profileId(value.profileId);
  if (normalizedProfileId !== expectedProfileId) fail("INVALID_AUTH_CONTRACT", "Profile credential record id does not match its registry key.");
  const passwordEnvelope = parsePasswordWrappedProfileKey(value.passwordEnvelope);
  const recoveryEnvelope = parseRecoveryWrappedProfileKey(value.recoveryEnvelope);
  if (passwordEnvelope.profileId !== expectedProfileId || recoveryEnvelope.profileId !== expectedProfileId) {
    fail("INVALID_AUTH_CONTRACT", "Profile credential envelopes do not match their owning profile.");
  }
  return Object.freeze({
    profileId: normalizedProfileId,
    passwordEnvelope,
    recoveryEnvelope,
  });
}

function freezeBootstrap(value) {
  if (value === null) return null;
  assertExactFields(value, BOOTSTRAP_FIELDS, "Server bootstrap state");
  if (value.version !== 1) fail("INVALID_AUTH_CONTRACT", "Server bootstrap version is unsupported.");
  const consumedAt = value.consumedAt === null ? null : isoDate(value.consumedAt, "Bootstrap consumption time");
  if (consumedAt === null) base64UrlBytes(value.proofDigest, "Bootstrap proof digest", 32);
  if (consumedAt !== null && value.proofDigest !== null) fail("INVALID_AUTH_CONTRACT", "Consumed bootstrap state cannot retain a proof digest.");
  const createdAt = isoDate(value.createdAt, "Bootstrap creation time");
  const expiresAt = isoDate(value.expiresAt, "Bootstrap expiry time");
  if (Date.parse(expiresAt) <= Date.parse(createdAt)) fail("INVALID_AUTH_CONTRACT", "Bootstrap expiry must follow creation time.");
  if (consumedAt !== null && Date.parse(consumedAt) < Date.parse(createdAt)) fail("INVALID_AUTH_CONTRACT", "Bootstrap consumption cannot precede creation time.");
  return Object.freeze({
    version: 1,
    proofDigest: value.proofDigest,
    createdAt,
    expiresAt,
    consumedAt,
  });
}

export function parseAuthPersistentState(value, expected = {}) {
  assertExactFields(value, STATE_FIELDS, "PlotPickle Auth state");
  if (value.format !== AUTH_STATE_FORMAT || value.version !== AUTH_STATE_VERSION) fail("INVALID_AUTH_CONTRACT", "PlotPickle Auth state format or version is unsupported.");
  if (!AUTH_ACCESS_MODES.includes(value.accessMode)) fail("INVALID_AUTH_CONTRACT", "PlotPickle Auth access mode is unsupported.");
  if (expected.accessMode !== undefined && value.accessMode !== expected.accessMode) fail("AUTH_STATE_MISMATCH", "Stored Auth access mode does not match this service.");
  assertExactFields(value.registry, REGISTRY_FIELDS, "Human profile registry");
  if (value.registry.version !== 1) fail("INVALID_AUTH_CONTRACT", "Human profile registry version is unsupported.");
  const normalizedNodeId = opaqueId(value.registry.nodeId, "Node id");
  if (expected.nodeId !== undefined && normalizedNodeId !== expected.nodeId) fail("AUTH_STATE_MISMATCH", "Stored Auth Node id does not match this service.");
  if (!isRecord(value.registry.profiles) || !isRecord(value.credentials)) fail("INVALID_AUTH_CONTRACT", "Auth profile and credential collections must be objects.");
  const profiles = {};
  const credentials = {};
  for (const [key, candidate] of Object.entries(value.registry.profiles)) {
    const normalizedKey = profileId(key);
    const normalized = freezeProfile(candidate);
    if (normalized.profileId !== normalizedKey) fail("INVALID_AUTH_CONTRACT", "Profile registry key does not match its profile id.");
    profiles[normalizedKey] = normalized;
  }
  for (const [key, candidate] of Object.entries(value.credentials)) {
    const normalizedKey = profileId(key);
    if (!profiles[normalizedKey]) fail("INVALID_AUTH_CONTRACT", "Credential record has no matching Human profile.");
    credentials[normalizedKey] = freezeCredential(candidate, normalizedKey);
  }
  if (Object.keys(profiles).some((key) => !credentials[key])) fail("INVALID_AUTH_CONTRACT", "Every Human profile requires a separate credential record.");
  const bootstrap = freezeBootstrap(value.bootstrap);
  if (value.accessMode === "desktop-loopback" && bootstrap !== null) fail("INVALID_AUTH_CONTRACT", "Desktop-loopback Auth state cannot contain a server bootstrap proof.");
  if (Object.keys(profiles).length && bootstrap && bootstrap.consumedAt === null) fail("INVALID_AUTH_CONTRACT", "A populated registry cannot retain an active server bootstrap proof.");
  return Object.freeze({
    format: AUTH_STATE_FORMAT,
    version: AUTH_STATE_VERSION,
    accessMode: value.accessMode,
    registry: Object.freeze({ version: 1, nodeId: normalizedNodeId, profiles: Object.freeze(profiles) }),
    credentials: Object.freeze(credentials),
    bootstrap,
  });
}

function emptyState(nodeId, accessMode) {
  return parseAuthPersistentState({
    format: AUTH_STATE_FORMAT,
    version: AUTH_STATE_VERSION,
    accessMode,
    registry: { version: 1, nodeId, profiles: {} },
    credentials: {},
    bootstrap: null,
  }, { nodeId, accessMode });
}

export function createInMemoryAuthStateStore(initialState = null) {
  let stored = clone(initialState);
  return Object.freeze({
    async read() {
      return clone(stored);
    },
    async write(value) {
      stored = clone(value);
    },
  });
}

export function createJsonFileAuthStateStore(filePath) {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath)) fail("INVALID_AUTH_CONTRACT", "Auth state file path must be absolute.");
  const resolvedPath = path.resolve(filePath);
  const quarantine = async (serialized) => {
    const digest = createHash("sha256").update(serialized, "utf8").digest("hex").slice(0, 16);
    const quarantinePath = `${resolvedPath}.corrupt-${digest}.json`;
    let handle;
    try {
      handle = await open(quarantinePath, "wx", 0o600);
      await handle.writeFile(serialized, "utf8");
      await handle.sync();
    } catch (error) {
      if (error?.code !== "EEXIST") return false;
    } finally {
      await handle?.close().catch(() => undefined);
    }
    return true;
  };
  return Object.freeze({
    async read() {
      let serialized;
      try {
        serialized = await readFile(resolvedPath, "utf8");
        return JSON.parse(serialized);
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        if (error instanceof SyntaxError) {
          await quarantine(serialized).catch(() => false);
          fail("AUTH_STATE_CORRUPT", "Stored Auth state is not valid JSON and was quarantined without replacement.", { cause: error });
        }
        throw error;
      }
    },
    async write(value) {
      const directory = path.dirname(resolvedPath);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const suffix = systemRandomBytes(12).toString("hex");
      const temporaryPath = path.join(directory, `.${path.basename(resolvedPath)}.${process.pid}.${suffix}.tmp`);
      const previousPath = `${resolvedPath}.previous`;
      const previousTemporaryPath = `${temporaryPath}.previous`;
      let temporaryHandle;
      let previousHandle;
      try {
        const serialized = `${JSON.stringify(value, null, 2)}\n`;
        temporaryHandle = await open(temporaryPath, "wx", 0o600);
        await temporaryHandle.writeFile(serialized, "utf8");
        await temporaryHandle.sync();
        await temporaryHandle.close();
        temporaryHandle = undefined;
        JSON.parse(await readFile(temporaryPath, "utf8"));

        let previousSerialized = null;
        try {
          previousSerialized = await readFile(resolvedPath, "utf8");
          JSON.parse(previousSerialized);
        } catch (error) {
          if (error?.code !== "ENOENT") {
            if (error instanceof SyntaxError) {
              await quarantine(previousSerialized).catch(() => false);
              fail("AUTH_STATE_CORRUPT", "Stored Auth state is not valid JSON; it was quarantined and the verified vault was not replaced.", { cause: error });
            }
            throw error;
          }
        }
        if (previousSerialized !== null) {
          previousHandle = await open(previousTemporaryPath, "wx", 0o600);
          await previousHandle.writeFile(previousSerialized, "utf8");
          await previousHandle.sync();
          await previousHandle.close();
          previousHandle = undefined;
          JSON.parse(await readFile(previousTemporaryPath, "utf8"));
          await rename(previousTemporaryPath, previousPath);
        }
        await rename(temporaryPath, resolvedPath);
      } catch (error) {
        await temporaryHandle?.close().catch(() => undefined);
        await previousHandle?.close().catch(() => undefined);
        await unlink(temporaryPath).catch(() => undefined);
        await unlink(previousTemporaryPath).catch(() => undefined);
        throw error;
      }
    },
  });
}

function profileSummary(profile) {
  return Object.freeze({ profileId: profile.profileId, displayName: profile.displayName, avatarRef: profile.avatarRef, status: profile.status });
}

function assertProfileSummary(value) {
  assertExactFields(value, PROFILE_SUMMARY_FIELDS, "Profile summary");
  return value;
}

function digestProof(proof) {
  const bytes = base64UrlBytes(proof, "Bootstrap proof", 32);
  try {
    return createHash("sha256").update(bytes).digest();
  } finally {
    bytes.fill(0);
  }
}

function digestSessionId(sessionId) {
  const bytes = base64UrlBytes(sessionId, "Session id", SESSION_ID_BYTES);
  try {
    return createHash("sha256").update("plotpickle:server-session:v1\0", "utf8").update(bytes).digest("base64url");
  } finally {
    bytes.fill(0);
  }
}

function publicAuthenticationFailure(cause) {
  return new PlotPickleAuthError("AUTHENTICATION_REJECTED", "Profile authentication failed.", {
    cause,
    publicCode: "AUTHENTICATION_REJECTED",
    publicMessage: "Profile authentication failed.",
  });
}

export function toPublicAuthError(error) {
  if (error instanceof PlotPickleAuthError) return Object.freeze({ code: error.publicCode, message: error.publicMessage });
  return Object.freeze({ code: "AUTH_REQUEST_REJECTED", message: "The authentication request could not be completed." });
}

export async function createPlotPickleAuthService(options) {
  if (!isRecord(options)) fail("INVALID_AUTH_CONTRACT", "Auth service options must be an object.");
  const nodeId = opaqueId(options.nodeId, "Node id");
  const accessMode = AUTH_ACCESS_MODES.includes(options.accessMode) ? options.accessMode : fail("INVALID_AUTH_CONTRACT", "Auth accessMode must be desktop-loopback or server-network.");
  const stateStore = options.stateStore;
  if (!stateStore || typeof stateStore.read !== "function" || typeof stateStore.write !== "function") fail("INVALID_AUTH_CONTRACT", "Auth stateStore must provide read and write methods.");
  const now = typeof options.now === "function" ? options.now : Date.now;
  const randomBytes = typeof options.randomBytes === "function" ? options.randomBytes : systemRandomBytes;
  const sessionTtlMs = boundedDuration(options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS, "Session TTL", 30 * 24 * 60 * 60 * 1_000);
  const sessionIdleTtlMs = boundedDuration(
    options.sessionIdleTtlMs ?? Math.min(DEFAULT_SESSION_IDLE_TTL_MS, sessionTtlMs),
    "Session idle TTL",
    sessionTtlMs,
  );
  const recentReauthenticationMs = boundedDuration(
    options.recentReauthenticationMs ?? Math.min(DEFAULT_RECENT_REAUTHENTICATION_MS, sessionTtlMs),
    "Recent reauthentication window",
    sessionTtlMs,
  );
  const bootstrapTtlMs = boundedDuration(options.bootstrapTtlMs ?? DEFAULT_BOOTSTRAP_TTL_MS, "Bootstrap TTL", 24 * 60 * 60 * 1_000);
  const passwordParameters = normalizeArgon2idParameters(options.passwordParameters ?? ARGON2ID_DEFAULTS);
  const storedState = await stateStore.read();
  let state;
  try {
    state = storedState === null ? emptyState(nodeId, accessMode) : parseAuthPersistentState(storedState, { nodeId, accessMode });
  } catch (error) {
    if (error?.code === "UNSUPPORTED_ENVELOPE_VERSION") {
      fail("AUTH_STATE_UNSUPPORTED", "Stored Auth state contains a future profile-vault envelope version.", { cause: error });
    }
    if (error?.name === "ProfileCryptoContractError") {
      fail("AUTH_STATE_CORRUPT", "Stored Auth state contains a malformed profile-vault envelope.", { cause: error });
    }
    throw error;
  }
  if (storedState === null) await stateStore.write(state);
  const sessions = new Map();
  const cleanupHooks = new Set();
  const transientVaultStates = new Map();
  const kdfMaintenance = new Map(Object.values(state.registry.profiles).map((profile) => [profile.profileId, "current"]));
  let mutationTail = Promise.resolve();

  const currentMs = () => {
    const value = now();
    const milliseconds = value instanceof Date ? value.getTime() : Number(value);
    if (!Number.isFinite(milliseconds) || Number.isNaN(new Date(milliseconds).getTime())) fail("INVALID_AUTH_CONTRACT", "Auth clock returned an invalid time.");
    return milliseconds;
  };
  const currentIso = () => new Date(currentMs()).toISOString();
  const randomSecret = (bytes, label) => {
    const value = randomBytes(bytes);
    if (!(value instanceof Uint8Array) || value.byteLength !== bytes) fail("AUTH_RANDOM_UNAVAILABLE", `${label} generation failed closed.`);
    return new Uint8Array(value);
  };
  const persist = async (nextState) => {
    const parsed = parseAuthPersistentState(nextState, { nodeId, accessMode });
    await stateStore.write(parsed);
    state = parsed;
    return parsed;
  };
  const serializeMutation = (operation) => {
    const run = mutationTail.then(operation, operation);
    mutationTail = run.then(() => undefined, () => undefined);
    return run;
  };
  const profileSessionCount = (targetProfileId) => {
    let count = 0;
    for (const session of sessions.values()) {
      if (session.context.profileId === targetProfileId) count += 1;
    }
    return count;
  };
  const steadyVaultState = (targetProfileId) => profileSessionCount(targetProfileId) > 0 ? "unlocked" : "locked";
  const emitCleanup = (targetProfileId, reason, invalidatedSessionCount) => {
    const event = Object.freeze({
      profileId: targetProfileId,
      reason,
      invalidatedSessionCount,
      occurredAt: currentIso(),
    });
    for (const hook of cleanupHooks) {
      try {
        hook(event);
      } catch {
        cleanupHooks.delete(hook);
      }
    }
  };
  const kdfNeedsUpgrade = (storedKdf) => {
    const noPolicyDimensionWouldDowngrade = storedKdf.memoryKiB <= passwordParameters.memoryKiB
      && storedKdf.iterations <= passwordParameters.iterations
      && storedKdf.parallelism <= passwordParameters.parallelism;
    return noPolicyDimensionWouldDowngrade && (
      storedKdf.memoryKiB < passwordParameters.memoryKiB
      || storedKdf.iterations < passwordParameters.iterations
      || storedKdf.parallelism < passwordParameters.parallelism
    );
  };
  for (const [targetProfileId, credential] of Object.entries(state.credentials)) {
    kdfMaintenance.set(targetProfileId, kdfNeedsUpgrade(credential.passwordEnvelope.kdf) ? "upgrade-pending" : "current");
  }
  const invalidateSessionByKey = (sessionKey) => {
    const session = sessions.get(sessionKey);
    if (!session) return false;
    session.profileMasterKey.fill(0);
    session.csrfToken.fill(0);
    sessions.delete(sessionKey);
    return true;
  };
  const invalidateSession = (sessionId) => invalidateSessionByKey(digestSessionId(sessionId));
  const invalidateProfileSessions = (targetProfileId) => {
    let invalidated = 0;
    for (const [sessionKey, session] of sessions) {
      if (session.context.profileId === targetProfileId && invalidateSessionByKey(sessionKey)) invalidated += 1;
    }
    return invalidated;
  };
  const createSession = (targetProfileId, authStrength, profileMasterKey) => {
    const issuedAtMs = currentMs();
    const sessionBytes = randomSecret(SESSION_ID_BYTES, "Session id");
    const csrfToken = randomSecret(CSRF_TOKEN_BYTES, "CSRF token");
    const managementBytes = randomSecret(SESSION_MANAGEMENT_ID_BYTES, "Session management id");
    const sessionId = Buffer.from(sessionBytes).toString("base64url");
    const sessionKey = digestSessionId(sessionId);
    const context = Object.freeze({
      sessionId,
      profileId: targetProfileId,
      nodeId,
      authStrength,
      issuedAt: new Date(issuedAtMs).toISOString(),
      expiresAt: new Date(issuedAtMs + sessionTtlMs).toISOString(),
      roles: Object.freeze(["human"]),
    });
    sessionBytes.fill(0);
    if (sessions.has(sessionKey) || [...sessions.values()].some((session) => session.managementId === Buffer.from(managementBytes).toString("base64url"))) {
      csrfToken.fill(0);
      managementBytes.fill(0);
      fail("AUTH_RANDOM_COLLISION", "Session id generation collided and failed closed.");
    }
    sessions.set(sessionKey, {
      context,
      profileMasterKey: new Uint8Array(profileMasterKey),
      csrfToken,
      managementId: Buffer.from(managementBytes).toString("base64url"),
      issuedAtMs,
      lastSeenAtMs: issuedAtMs,
      idleExpiresAtMs: Math.min(issuedAtMs + sessionIdleTtlMs, issuedAtMs + sessionTtlMs),
      absoluteExpiresAtMs: issuedAtMs + sessionTtlMs,
      reauthenticatedAtMs: issuedAtMs,
      deviceLabel: "Browser session",
      originLabel: accessMode === "desktop-loopback" ? "This computer" : "Network session",
    });
    managementBytes.fill(0);
    return context;
  };
  const requireSession = (candidate, settings = {}) => {
    assertExactFields(candidate, AUTH_CONTEXT_FIELDS, "AuthContext");
    const sessionId = base64UrlBytes(candidate.sessionId, "Session id", SESSION_ID_BYTES).toString("base64url");
    const sessionKey = digestSessionId(sessionId);
    const session = sessions.get(sessionKey);
    if (!session || JSON.stringify(candidate) !== JSON.stringify(session.context)) fail("SESSION_REJECTED", "The Auth session is invalid or expired.");
    const observedAtMs = currentMs();
    if (session.absoluteExpiresAtMs <= observedAtMs || session.idleExpiresAtMs <= observedAtMs) {
      invalidateSessionByKey(sessionKey);
      emitCleanup(session.context.profileId, "session-expired", 1);
      fail("SESSION_REJECTED", "The Auth session is invalid or expired.");
    }
    const profile = state.registry.profiles[session.context.profileId];
    if (!profile || profile.status !== "active") {
      invalidateSession(sessionId);
      emitCleanup(session.context.profileId, "profile-unavailable", 1);
      fail("SESSION_REJECTED", "The Auth session is invalid or expired.");
    }
    if (settings.touch !== false) {
      session.lastSeenAtMs = observedAtMs;
      session.idleExpiresAtMs = Math.min(session.absoluteExpiresAtMs, observedAtMs + sessionIdleTtlMs);
    }
    return session;
  };
  const requireProfileActor = (candidate, targetProfileId) => {
    const session = requireSession(candidate);
    if (session.context.profileId !== targetProfileId) fail("ACCESS_DENIED", "A Human profile may modify only its own Auth record.");
    return session;
  };
  const requireRecentSession = (candidate, maximumAgeMs = recentReauthenticationMs) => {
    const maximumAge = boundedDuration(maximumAgeMs, "Recent reauthentication window", sessionTtlMs);
    const session = requireSession(candidate);
    if (!new Set(["password", "password+webauthn"]).has(session.context.authStrength)
      || currentMs() - session.reauthenticatedAtMs > maximumAge) {
      fail("RECENT_REAUTHENTICATION_REQUIRED", "This action requires recent password or stronger authentication.");
    }
    return session;
  };
  const browserSessionSummary = (session, currentSessionKey) => Object.freeze({
    sessionRef: session.managementId,
    current: digestSessionId(session.context.sessionId) === currentSessionKey,
    issuedAt: new Date(session.issuedAtMs).toISOString(),
    lastSeenAt: new Date(session.lastSeenAtMs).toISOString(),
    idleExpiresAt: new Date(session.idleExpiresAtMs).toISOString(),
    absoluteExpiresAt: new Date(session.absoluteExpiresAtMs).toISOString(),
    authStrength: session.context.authStrength,
    deviceLabel: session.deviceLabel,
    originLabel: session.originLabel,
  });
  const createProfileRecord = async (input, bootstrapProof, authorizingContext) => {
    assertExactFields(input, ["displayName", "password", "avatarRef"], "Human profile creation input");
    if (typeof input.password !== "string" && !(input.password instanceof Uint8Array)) fail("INVALID_AUTH_CONTRACT", "Profile password must be a string or Uint8Array.");
    const normalizedDisplayName = displayName(input.displayName);
    assertStrongProfilePassword(input.password, [normalizedDisplayName, nodeId]);
    const hasProfiles = Object.keys(state.registry.profiles).length > 0;
    if (hasProfiles) requireSession(authorizingContext);
    if (!hasProfiles && accessMode === "server-network") {
      const bootstrap = state.bootstrap;
      let suppliedDigest;
      let storedDigest;
      try {
        if (!bootstrap || bootstrap.consumedAt !== null || Date.parse(bootstrap.expiresAt) <= currentMs()) fail("BOOTSTRAP_PROOF_REJECTED", "The server bootstrap proof is invalid or expired.");
        suppliedDigest = digestProof(bootstrapProof);
        storedDigest = base64UrlBytes(bootstrap.proofDigest, "Bootstrap proof digest", 32);
        if (!timingSafeEqual(suppliedDigest, storedDigest)) fail("BOOTSTRAP_PROOF_REJECTED", "The server bootstrap proof is invalid or expired.");
      } catch (error) {
        if (error instanceof PlotPickleAuthError && error.code === "BOOTSTRAP_PROOF_REJECTED") throw error;
        fail("BOOTSTRAP_PROOF_REJECTED", "The server bootstrap proof is invalid or expired.", { cause: error });
      } finally {
        suppliedDigest?.fill(0);
        storedDigest?.fill(0);
      }
    }
    const idBytes = randomSecret(16, "Profile id");
    const newProfileId = `profile_${Buffer.from(idBytes).toString("base64url")}`;
    idBytes.fill(0);
    if (state.registry.profiles[newProfileId]) fail("AUTH_RANDOM_COLLISION", "Profile id generation collided and failed closed.");
    const createdAt = currentIso();
    const profile = freezeProfile({
      profileId: newProfileId,
      displayName: normalizedDisplayName,
      createdAt,
      updatedAt: createdAt,
      status: "active",
      vaultVersion: 1,
      authMethods: ["password", "recovery"],
      avatarRef: avatarRef(input.avatarRef),
    });
    let pmk;
    let recoverySecret;
    try {
      pmk = await generateProfileMasterKey();
      recoverySecret = await generateRecoverySecret();
      const passwordEnvelope = await wrapProfileMasterKeyWithPassword({ profileId: newProfileId, password: input.password, profileMasterKey: pmk, parameters: passwordParameters });
      const recoveryEnvelope = await wrapProfileMasterKeyWithRecovery({ profileId: newProfileId, recoverySecret, profileMasterKey: pmk });
      const credential = freezeCredential({ profileId: newProfileId, passwordEnvelope, recoveryEnvelope }, newProfileId);
      const bootstrap = !hasProfiles && accessMode === "server-network"
        ? Object.freeze({ ...state.bootstrap, proofDigest: null, consumedAt: currentIso() })
        : state.bootstrap;
      await persist({
        ...state,
        registry: { ...state.registry, profiles: { ...state.registry.profiles, [newProfileId]: profile } },
        credentials: { ...state.credentials, [newProfileId]: credential },
        bootstrap,
      });
      kdfMaintenance.set(newProfileId, "current");
      const authContext = createSession(newProfileId, "password", pmk);
      return Object.freeze({
        profile,
        recoverySecret: encodeRecoverySecret(recoverySecret),
        authContext,
      });
    } finally {
      pmk?.fill(0);
      recoverySecret?.fill(0);
    }
  };

  return Object.freeze({
    accessMode,
    nodeId,
    async createServerBootstrapProof() {
      return serializeMutation(async () => {
        if (accessMode !== "server-network") fail("ACCESS_MODE_REJECTED", "Bootstrap proofs exist only in server-network mode.");
        if (Object.keys(state.registry.profiles).length) fail("BOOTSTRAP_ALREADY_COMPLETED", "Server bootstrap is already complete.");
        if (state.bootstrap?.consumedAt) fail("BOOTSTRAP_ALREADY_COMPLETED", "Server bootstrap is already complete.");
        const proofBytes = randomSecret(32, "Bootstrap proof");
        const proof = Buffer.from(proofBytes).toString("base64url");
        const createdAtMs = currentMs();
        const proofDigest = createHash("sha256").update(proofBytes).digest("base64url");
        proofBytes.fill(0);
        const bootstrap = freezeBootstrap({
          version: 1,
          proofDigest,
          createdAt: new Date(createdAtMs).toISOString(),
          expiresAt: new Date(createdAtMs + bootstrapTtlMs).toISOString(),
          consumedAt: null,
        });
        await persist({ ...state, bootstrap });
        return Object.freeze({ proof, expiresAt: bootstrap.expiresAt });
      });
    },
    async createFirstProfile(input, bootstrapProof) {
      return serializeMutation(async () => {
        if (Object.keys(state.registry.profiles).length) fail("FIRST_PROFILE_EXISTS", "The first Human profile already exists.");
        return createProfileRecord(input, bootstrapProof, null);
      });
    },
    async createProfile(input, authContext) {
      return serializeMutation(() => {
        if (!Object.keys(state.registry.profiles).length) fail("FIRST_PROFILE_REQUIRED", "Use the explicit first-profile bootstrap operation on an empty Node.");
        return createProfileRecord(input, null, authContext);
      });
    },
    async authenticate(input) {
      let targetProfileId = null;
      try {
        assertExactFields(input, ["profileId", "password"], "Password authentication input");
        targetProfileId = profileId(input.profileId);
        transientVaultStates.set(targetProfileId, "unlocking");
        const profile = state.registry.profiles[targetProfileId];
        const credential = state.credentials[targetProfileId];
        const workCredential = credential || Object.values(state.credentials)[0];
        if (!workCredential) throw new Error("Profile is unavailable.");
        const pmk = await unwrapProfileMasterKeyWithPassword(workCredential.passwordEnvelope, input.password, workCredential.profileId);
        try {
          if (!profile || !credential || credential !== workCredential || profile.status !== "active") throw new Error("Profile is unavailable.");
          let authenticatedProfile;
          let maintenance = "current";
          await serializeMutation(async () => {
            authenticatedProfile = state.registry.profiles[targetProfileId];
            const currentCredential = state.credentials[targetProfileId];
            if (!authenticatedProfile || authenticatedProfile.status !== "active" || !currentCredential || JSON.stringify(currentCredential.passwordEnvelope) !== JSON.stringify(credential.passwordEnvelope)) {
              throw new Error("Profile changed while authentication was in progress.");
            }
            if (kdfNeedsUpgrade(currentCredential.passwordEnvelope.kdf)) {
              let verifiedPmk;
              try {
                const upgradedEnvelope = await wrapProfileMasterKeyWithPassword({
                  profileId: targetProfileId,
                  password: input.password,
                  profileMasterKey: pmk,
                  parameters: passwordParameters,
                });
                verifiedPmk = await unwrapProfileMasterKeyWithPassword(upgradedEnvelope, input.password, targetProfileId);
                if (!timingSafeEqual(verifiedPmk, pmk)) throw new Error("Upgraded password envelope did not preserve the PMK.");
                const upgradedProfile = freezeProfile({
                  ...authenticatedProfile,
                  vaultVersion: authenticatedProfile.vaultVersion + 1,
                  updatedAt: currentIso(),
                });
                const upgradedCredential = freezeCredential({ ...currentCredential, passwordEnvelope: upgradedEnvelope }, targetProfileId);
                await persist({
                  ...state,
                  registry: { ...state.registry, profiles: { ...state.registry.profiles, [targetProfileId]: upgradedProfile } },
                  credentials: { ...state.credentials, [targetProfileId]: upgradedCredential },
                });
                authenticatedProfile = upgradedProfile;
                maintenance = "upgraded";
              } catch {
                maintenance = "upgrade-deferred";
              } finally {
                verifiedPmk?.fill(0);
              }
            }
          });
          kdfMaintenance.set(targetProfileId, maintenance);
          return Object.freeze({
            profile: profileSummary(authenticatedProfile),
            authContext: createSession(targetProfileId, "password", pmk),
            vaultMaintenance: maintenance,
          });
        } finally {
          pmk.fill(0);
        }
      } catch (error) {
        throw publicAuthenticationFailure(error);
      } finally {
        if (targetProfileId !== null) transientVaultStates.delete(targetProfileId);
      }
    },
    async changePassword(input, authContext) {
      return serializeMutation(async () => {
        assertExactFields(input, ["currentPassword", "newPassword"], "Password change input");
        if ((typeof input.currentPassword !== "string" && !(input.currentPassword instanceof Uint8Array))
          || (typeof input.newPassword !== "string" && !(input.newPassword instanceof Uint8Array))) {
          fail("INVALID_AUTH_CONTRACT", "Password change values must be strings or Uint8Arrays.");
        }
        const session = requireSession(authContext);
        const targetProfileId = session.context.profileId;
        const profile = state.registry.profiles[targetProfileId];
        const credential = state.credentials[targetProfileId];
        assertStrongProfilePassword(input.newPassword, [profile.displayName, nodeId]);
        transientVaultStates.set(targetProfileId, "locking");
        let currentPmk;
        let verifiedPmk;
        try {
          try {
            currentPmk = await unwrapProfileMasterKeyWithPassword(credential.passwordEnvelope, input.currentPassword, targetProfileId);
            if (!timingSafeEqual(currentPmk, session.profileMasterKey)) throw new Error("Authenticated PMK does not match the active vault capability.");
          } catch (error) {
            throw publicAuthenticationFailure(error);
          }
          const passwordEnvelope = await wrapProfileMasterKeyWithPassword({
            profileId: targetProfileId,
            password: input.newPassword,
            profileMasterKey: currentPmk,
            parameters: passwordParameters,
          });
          verifiedPmk = await unwrapProfileMasterKeyWithPassword(passwordEnvelope, input.newPassword, targetProfileId);
          if (!timingSafeEqual(verifiedPmk, currentPmk)) fail("VAULT_REWRAP_FAILED", "The new password envelope did not preserve the profile vault key.");
          const updatedProfile = freezeProfile({
            ...profile,
            vaultVersion: profile.vaultVersion + 1,
            updatedAt: currentIso(),
          });
          const updatedCredential = freezeCredential({ ...credential, passwordEnvelope }, targetProfileId);
          await persist({
            ...state,
            registry: { ...state.registry, profiles: { ...state.registry.profiles, [targetProfileId]: updatedProfile } },
            credentials: { ...state.credentials, [targetProfileId]: updatedCredential },
          });
          kdfMaintenance.set(targetProfileId, "current");
          const invalidatedSessionCount = invalidateProfileSessions(targetProfileId);
          emitCleanup(targetProfileId, "password-change", invalidatedSessionCount);
          return Object.freeze({
            profile: profileSummary(updatedProfile),
            authContext: createSession(targetProfileId, "password", currentPmk),
          });
        } finally {
          currentPmk?.fill(0);
          verifiedPmk?.fill(0);
          transientVaultStates.delete(targetProfileId);
        }
      });
    },
    async resetPasswordWithRecovery(input) {
      return serializeMutation(async () => {
        assertExactFields(input, ["profileId", "recoverySecret", "newPassword"], "Recovery reset input");
        const targetProfileId = profileId(input.profileId);
        transientVaultStates.set(targetProfileId, "recovery-required");
        let recoverySecret;
        let replacementRecoverySecret;
        let pmk;
        let verifiedPasswordPmk;
        let verifiedRecoveryPmk;
        try {
          const profile = state.registry.profiles[targetProfileId];
          const credential = state.credentials[targetProfileId];
          const workCredential = credential || Object.values(state.credentials)[0];
          if (!workCredential) throw publicAuthenticationFailure(new Error("Profile is unavailable."));
          try {
            recoverySecret = decodeRecoverySecret(input.recoverySecret);
            pmk = await unwrapProfileMasterKeyWithRecovery(workCredential.recoveryEnvelope, recoverySecret, workCredential.profileId);
            if (!profile || !credential || credential !== workCredential || profile.status !== "active") throw new Error("Profile is unavailable.");
          } catch (error) {
            throw publicAuthenticationFailure(error);
          }
          if (typeof input.newPassword !== "string" && !(input.newPassword instanceof Uint8Array)) fail("INVALID_AUTH_CONTRACT", "New profile password must be a string or Uint8Array.");
          assertStrongProfilePassword(input.newPassword, [profile.displayName, nodeId]);
          replacementRecoverySecret = await generateRecoverySecret();
          const passwordEnvelope = await wrapProfileMasterKeyWithPassword({
            profileId: targetProfileId,
            password: input.newPassword,
            profileMasterKey: pmk,
            parameters: passwordParameters,
          });
          const recoveryEnvelope = await wrapProfileMasterKeyWithRecovery({
            profileId: targetProfileId,
            recoverySecret: replacementRecoverySecret,
            profileMasterKey: pmk,
          });
          verifiedPasswordPmk = await unwrapProfileMasterKeyWithPassword(passwordEnvelope, input.newPassword, targetProfileId);
          verifiedRecoveryPmk = await unwrapProfileMasterKeyWithRecovery(recoveryEnvelope, replacementRecoverySecret, targetProfileId);
          if (!timingSafeEqual(verifiedPasswordPmk, pmk) || !timingSafeEqual(verifiedRecoveryPmk, pmk)) {
            fail("VAULT_REWRAP_FAILED", "Recovery reset did not preserve the profile vault key.");
          }
          const updatedProfile = freezeProfile({
            ...profile,
            vaultVersion: profile.vaultVersion + 1,
            updatedAt: currentIso(),
          });
          const updatedCredential = freezeCredential({ profileId: targetProfileId, passwordEnvelope, recoveryEnvelope }, targetProfileId);
          await persist({
            ...state,
            registry: { ...state.registry, profiles: { ...state.registry.profiles, [targetProfileId]: updatedProfile } },
            credentials: { ...state.credentials, [targetProfileId]: updatedCredential },
          });
          kdfMaintenance.set(targetProfileId, "current");
          const invalidatedSessionCount = invalidateProfileSessions(targetProfileId);
          emitCleanup(targetProfileId, "recovery-reset", invalidatedSessionCount);
          return Object.freeze({
            profile: profileSummary(updatedProfile),
            recoverySecret: encodeRecoverySecret(replacementRecoverySecret),
            authContext: createSession(targetProfileId, "recovery", pmk),
          });
        } finally {
          recoverySecret?.fill(0);
          replacementRecoverySecret?.fill(0);
          pmk?.fill(0);
          verifiedPasswordPmk?.fill(0);
          verifiedRecoveryPmk?.fill(0);
          transientVaultStates.delete(targetProfileId);
        }
      });
    },
    getVaultStatus(targetProfileId = null, authContext = null) {
      if (targetProfileId === null && authContext === null) {
        const profiles = Object.values(state.registry.profiles);
        if (!profiles.length) return Object.freeze({ profileId: null, state: "uninitialized", vaultVersion: null, kdfMaintenance: "not-applicable" });
        if (accessMode === "server-network") fail("ACCESS_DENIED", "A valid Human session is required to inspect a server profile vault.");
        if (profiles.length !== 1) fail("INVALID_AUTH_CONTRACT", "A profile id is required when more than one local profile exists.");
        targetProfileId = profiles[0].profileId;
      } else if (targetProfileId === null) {
        targetProfileId = requireSession(authContext).context.profileId;
      }
      const normalizedProfileId = profileId(targetProfileId);
      if (authContext !== null) requireProfileActor(authContext, normalizedProfileId);
      else if (accessMode === "server-network") fail("ACCESS_DENIED", "A valid Human session is required to inspect a server profile vault.");
      const profile = state.registry.profiles[normalizedProfileId];
      if (!profile) fail("PROFILE_NOT_FOUND", "Human profile was not found.");
      return Object.freeze({
        profileId: normalizedProfileId,
        state: transientVaultStates.get(normalizedProfileId) || steadyVaultState(normalizedProfileId),
        vaultVersion: profile.vaultVersion,
        kdfMaintenance: kdfMaintenance.get(normalizedProfileId) || "current",
      });
    },
    createProfileVaultCapability(authContext) {
      const initialSession = requireSession(authContext);
      const targetProfileId = initialSession.context.profileId;
      return Object.freeze({
        profileId: targetProfileId,
        async wrapSecret(input) {
          assertExactFields(input, ["secretId", "secret"], "Profile vault secret wrapping input");
          const session = requireProfileActor(authContext, targetProfileId);
          return wrapProfileSecret({
            profileId: targetProfileId,
            secretId: input.secretId,
            profileMasterKey: session.profileMasterKey,
            secret: input.secret,
          });
        },
        async unwrapSecret(input) {
          assertExactFields(input, ["envelope", "secretId"], "Profile vault secret unwrapping input");
          const session = requireProfileActor(authContext, targetProfileId);
          return unwrapProfileSecret(input.envelope, session.profileMasterKey, { profileId: targetProfileId, secretId: input.secretId });
        },
      });
    },
    resolveSession(sessionId, settings = {}) {
      assertExactFields(settings, ["touch"], "Session resolution settings");
      if (settings.touch !== undefined && typeof settings.touch !== "boolean") fail("INVALID_AUTH_CONTRACT", "Session touch setting must be boolean.");
      const normalizedSessionId = base64UrlBytes(sessionId, "Session id", SESSION_ID_BYTES).toString("base64url");
      const session = sessions.get(digestSessionId(normalizedSessionId));
      if (!session) fail("SESSION_REJECTED", "The Auth session is invalid or expired.");
      return requireSession(session.context, { touch: settings.touch !== false }).context;
    },
    createBrowserSession(authContext, presentation = {}) {
      assertExactFields(presentation, ["deviceLabel", "originLabel"], "Browser session presentation");
      const session = requireSession(authContext);
      if (presentation.deviceLabel !== undefined) session.deviceLabel = exactString(presentation.deviceLabel, "Session device label", { maximumLength: 120 });
      if (presentation.originLabel !== undefined) session.originLabel = exactString(presentation.originLabel, "Session origin label", { maximumLength: 120 });
      return Object.freeze({
        cookieValue: session.context.sessionId,
        csrfToken: Buffer.from(session.csrfToken).toString("base64url"),
        idleExpiresAt: new Date(session.idleExpiresAtMs).toISOString(),
        absoluteExpiresAt: new Date(session.absoluteExpiresAtMs).toISOString(),
      });
    },
    validateCsrfToken(authContext, candidateToken) {
      const session = requireSession(authContext, { touch: false });
      let supplied;
      try {
        supplied = base64UrlBytes(candidateToken, "CSRF token", CSRF_TOKEN_BYTES);
        return timingSafeEqual(supplied, session.csrfToken);
      } finally {
        supplied?.fill(0);
      }
    },
    requireRecentReauthentication(authContext, maximumAgeMs = recentReauthenticationMs) {
      return requireRecentSession(authContext, maximumAgeMs).context;
    },
    listSessions(authContext) {
      const current = requireSession(authContext);
      const currentSessionKey = digestSessionId(current.context.sessionId);
      const observedAtMs = currentMs();
      const summaries = [];
      for (const [sessionKey, session] of sessions) {
        if (session.context.profileId !== current.context.profileId) continue;
        if (session.absoluteExpiresAtMs <= observedAtMs || session.idleExpiresAtMs <= observedAtMs) {
          invalidateSessionByKey(sessionKey);
          continue;
        }
        summaries.push(browserSessionSummary(session, currentSessionKey));
      }
      return Object.freeze(summaries.sort((left, right) => right.issuedAt.localeCompare(left.issuedAt)));
    },
    revokeSession(sessionRef, authContext) {
      const current = requireSession(authContext);
      const normalizedRef = base64UrlBytes(sessionRef, "Session management id", SESSION_MANAGEMENT_ID_BYTES).toString("base64url");
      for (const [sessionKey, session] of sessions) {
        if (session.managementId !== normalizedRef) continue;
        if (session.context.profileId !== current.context.profileId) fail("ACCESS_DENIED", "A Human profile may revoke only its own sessions.");
        if (session.context.sessionId === current.context.sessionId) fail("CURRENT_SESSION_REJECTED", "Use logout to revoke the current session.");
        const invalidated = invalidateSessionByKey(sessionKey);
        if (invalidated) emitCleanup(session.context.profileId, "session-revoked", 1);
        return invalidated;
      }
      fail("SESSION_NOT_FOUND", "The requested session is unavailable.");
    },
    revokeOtherSessions(authContext) {
      const current = requireSession(authContext);
      const currentSessionKey = digestSessionId(current.context.sessionId);
      let invalidatedSessionCount = 0;
      for (const [sessionKey, session] of sessions) {
        if (sessionKey === currentSessionKey || session.context.profileId !== current.context.profileId) continue;
        if (invalidateSessionByKey(sessionKey)) invalidatedSessionCount += 1;
      }
      if (invalidatedSessionCount) emitCleanup(current.context.profileId, "other-sessions-revoked", invalidatedSessionCount);
      return invalidatedSessionCount;
    },
    registerVaultCleanupHook(hook) {
      if (typeof hook !== "function") fail("INVALID_AUTH_CONTRACT", "Vault cleanup hook must be a function.");
      cleanupHooks.add(hook);
      let active = true;
      return () => {
        if (!active) return false;
        active = false;
        return cleanupHooks.delete(hook);
      };
    },
    listProfileSummaries(authContext = null) {
      if (accessMode === "server-network" && authContext === null) return Object.freeze([]);
      if (authContext !== null) requireSession(authContext);
      return Object.freeze(Object.values(state.registry.profiles).map(profileSummary).map(assertProfileSummary));
    },
    getAuthStatus(authContext = null) {
      if (authContext === null) {
        const profileCount = Object.keys(state.registry.profiles).length;
        return Object.freeze({
          configured: profileCount > 0,
          accessMode,
          authenticated: false,
          profileCountVisible: accessMode === "desktop-loopback" ? profileCount : 0,
          bootstrapRequired: profileCount === 0,
        });
      }
      const session = requireSession(authContext);
      const profile = state.registry.profiles[session.context.profileId];
      return Object.freeze({
        configured: true,
        accessMode,
        authenticated: true,
        profileCountVisible: accessMode === "desktop-loopback" ? Object.keys(state.registry.profiles).length : 0,
        bootstrapRequired: false,
        profile: profileSummary(profile),
        authStrength: session.context.authStrength,
        expiresAt: session.context.expiresAt,
      });
    },
    async updateProfilePresentation(input, authContext) {
      return serializeMutation(async () => {
        assertExactFields(input, ["profileId", "displayName", "avatarRef"], "Profile presentation update");
        const targetProfileId = profileId(input.profileId);
        requireProfileActor(authContext, targetProfileId);
        const existing = state.registry.profiles[targetProfileId];
        if (!existing) fail("PROFILE_NOT_FOUND", "Human profile was not found.");
        const updated = freezeProfile({ ...existing, displayName: displayName(input.displayName), avatarRef: avatarRef(input.avatarRef), updatedAt: currentIso() });
        await persist({ ...state, registry: { ...state.registry, profiles: { ...state.registry.profiles, [targetProfileId]: updated } } });
        return updated;
      });
    },
    async disableProfile(targetProfileId, authContext) {
      return serializeMutation(async () => {
        const normalizedProfileId = profileId(targetProfileId);
        const authorizingSession = requireRecentSession(authContext);
        if (authorizingSession.context.profileId !== normalizedProfileId) fail("ACCESS_DENIED", "A Human profile may modify only its own Auth record.");
        const existing = state.registry.profiles[normalizedProfileId];
        if (!existing) fail("PROFILE_NOT_FOUND", "Human profile was not found.");
        const disabled = freezeProfile({ ...existing, status: "disabled", updatedAt: currentIso() });
        await persist({ ...state, registry: { ...state.registry, profiles: { ...state.registry.profiles, [normalizedProfileId]: disabled } } });
        transientVaultStates.set(normalizedProfileId, "locking");
        const invalidatedSessionCount = invalidateProfileSessions(normalizedProfileId);
        transientVaultStates.delete(normalizedProfileId);
        emitCleanup(normalizedProfileId, "profile-disabled", invalidatedSessionCount);
        return profileSummary(disabled);
      });
    },
    lock(authContext) {
      const session = requireSession(authContext);
      transientVaultStates.set(session.context.profileId, "locking");
      const invalidated = invalidateSession(session.context.sessionId);
      transientVaultStates.delete(session.context.profileId);
      if (invalidated) emitCleanup(session.context.profileId, "lock", 1);
      return invalidated;
    },
    lockProfile(targetProfileId, authContext) {
      const normalizedProfileId = profileId(targetProfileId);
      requireProfileActor(authContext, normalizedProfileId);
      if (!state.registry.profiles[normalizedProfileId]) fail("PROFILE_NOT_FOUND", "Human profile was not found.");
      transientVaultStates.set(normalizedProfileId, "locking");
      const invalidatedSessionCount = invalidateProfileSessions(normalizedProfileId);
      transientVaultStates.delete(normalizedProfileId);
      emitCleanup(normalizedProfileId, "lock-profile", invalidatedSessionCount);
      return true;
    },
    readRegistrySnapshot(authContext = null) {
      if (accessMode === "server-network" && authContext === null) return null;
      if (authContext !== null) requireSession(authContext);
      return clone(state.registry);
    },
    close() {
      const profiles = new Map();
      for (const session of sessions.values()) profiles.set(session.context.profileId, (profiles.get(session.context.profileId) || 0) + 1);
      for (const [targetProfileId, count] of profiles) {
        transientVaultStates.set(targetProfileId, "locking");
        invalidateProfileSessions(targetProfileId);
        transientVaultStates.delete(targetProfileId);
        emitCleanup(targetProfileId, "service-close", count);
      }
      cleanupHooks.clear();
    },
  });
}
