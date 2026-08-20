import { hkdfSync } from "node:crypto";
import { performance } from "node:perf_hooks";
import sodium from "libsodium-wrappers-sumo";

export const PROFILE_CRYPTO_FORMAT_VERSION = 1;
export const ARGON2ID_VERSION = 0x13;
export const PROFILE_MASTER_KEY_BYTES = 32;
export const RECOVERY_SECRET_BYTES = 32;
export const ARGON2ID_SECURITY_FLOOR = Object.freeze({
  algorithm: "argon2id",
  version: ARGON2ID_VERSION,
  memoryKiB: 19_456,
  iterations: 2,
  parallelism: 1,
});
export const ARGON2ID_DEFAULTS = Object.freeze({
  algorithm: "argon2id",
  version: ARGON2ID_VERSION,
  memoryKiB: 65_536,
  iterations: 3,
  parallelism: 1,
});
export const ARGON2ID_LIMITS = Object.freeze({
  maximumMemoryKiB: 262_144,
  maximumIterations: 10,
  parallelism: 1,
});

const PASSWORD_FORMAT = "plotpickle-profile-key";
const PROFILE_SECRET_FORMAT = "plotpickle-profile-secret";
const AAD_FORMAT = "plotpickle-envelope-aad";
const AEAD_ALGORITHM = "xchacha20-poly1305";
const HKDF_ALGORITHM = "hkdf-sha256";
const RECOVERY_INFO = "plotpickle:profile-key:recovery-wrap:v1";
const PROFILE_SECRET_INFO = "plotpickle:profile-secret:v1";
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export class ProfileCryptoContractError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "ProfileCryptoContractError";
    this.code = code;
  }
}

function fail(code, message, cause) {
  throw new ProfileCryptoContractError(code, message, cause ? { cause } : undefined);
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertExactFields(value, allowed, label) {
  if (!isRecord(value)) fail("INVALID_ENVELOPE", `${label} must be an object.`);
  const unexpected = Object.keys(value).filter((field) => !allowed.includes(field));
  if (unexpected.length) fail("INVALID_ENVELOPE", `${label} contains unsupported fields: ${unexpected.join(", ")}.`);
}

function contractId(value, label, maximumLength = 200) {
  if (typeof value !== "string" || value.length < 1 || value.length > maximumLength || value.trim() !== value || /[\u0000-\u001f\u007f]/u.test(value)) {
    fail("INVALID_ENVELOPE", `${label} must be a non-empty opaque identifier without control characters.`);
  }
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) fail("INVALID_ENVELOPE", `${label} must be a positive integer.`);
  return value;
}

function decodeBase64Url(value, label, expectedBytes, minimumBytes = expectedBytes) {
  if (typeof value !== "string" || !BASE64URL_PATTERN.test(value)) fail("INVALID_ENVELOPE", `${label} must use unpadded base64url encoding.`);
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) fail("INVALID_ENVELOPE", `${label} is not canonical base64url.`);
  if (expectedBytes !== undefined && decoded.byteLength !== expectedBytes) fail("INVALID_ENVELOPE", `${label} must contain exactly ${expectedBytes} bytes.`);
  if (minimumBytes !== undefined && decoded.byteLength < minimumBytes) fail("INVALID_ENVELOPE", `${label} must contain at least ${minimumBytes} bytes.`);
  return new Uint8Array(decoded);
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function copyBytes(value, label, expectedBytes) {
  if (!(value instanceof Uint8Array)) fail("INVALID_SECRET", `${label} must be a Uint8Array.`);
  if (expectedBytes !== undefined && value.byteLength !== expectedBytes) fail("INVALID_SECRET", `${label} must contain exactly ${expectedBytes} bytes.`);
  return new Uint8Array(value);
}

function secretBytes(value, label) {
  if (typeof value === "string") return textEncoder.encode(value);
  if (value instanceof Uint8Array) return new Uint8Array(value);
  fail("INVALID_SECRET", `${label} must be a string or Uint8Array.`);
}

function wipe(...values) {
  for (const value of values) {
    if (value instanceof Uint8Array && value.byteLength) sodium.memzero(value);
  }
}

export function assertPasswordCandidate(password) {
  let candidate;
  try {
    candidate = typeof password === "string" ? password : textDecoder.decode(password);
  } catch (error) {
    fail("INVALID_PASSWORD", "Profile password bytes must be valid UTF-8.", error);
  }
  if (!candidate || !candidate.trim()) fail("INVALID_PASSWORD", "A profile password or passphrase is required.");
  if (/^\d{1,11}$/u.test(candidate)) fail("INVALID_PASSWORD", "A short numeric PIN cannot be the only offline profile secret.");
  return true;
}

export function normalizeArgon2idParameters(value = ARGON2ID_DEFAULTS) {
  assertExactFields(value, ["algorithm", "version", "memoryKiB", "iterations", "parallelism"], "Argon2id parameters");
  if (value.algorithm !== "argon2id") fail("INVALID_KDF", "Profile password envelopes require Argon2id.");
  if (value.version !== ARGON2ID_VERSION) fail("INVALID_KDF", `Argon2id version must be ${ARGON2ID_VERSION}.`);
  const memoryKiB = positiveInteger(value.memoryKiB, "Argon2id memoryKiB");
  const iterations = positiveInteger(value.iterations, "Argon2id iterations");
  const parallelism = positiveInteger(value.parallelism, "Argon2id parallelism");
  if (memoryKiB < ARGON2ID_SECURITY_FLOOR.memoryKiB || iterations < ARGON2ID_SECURITY_FLOOR.iterations || parallelism < ARGON2ID_SECURITY_FLOOR.parallelism) {
    fail("KDF_BELOW_FLOOR", "Argon2id parameters are below the supported security floor.");
  }
  if (memoryKiB > ARGON2ID_LIMITS.maximumMemoryKiB || iterations > ARGON2ID_LIMITS.maximumIterations || parallelism !== ARGON2ID_LIMITS.parallelism) {
    fail("KDF_OUT_OF_RANGE", "Argon2id parameters exceed the supported resource envelope.");
  }
  return Object.freeze({ algorithm: "argon2id", version: ARGON2ID_VERSION, memoryKiB, iterations, parallelism });
}

function parseAead(value, minimumCiphertextBytes) {
  assertExactFields(value, ["algorithm", "nonce", "ciphertext"], "AEAD envelope");
  if (value.algorithm !== AEAD_ALGORITHM) fail("INVALID_ENVELOPE", `AEAD algorithm must be ${AEAD_ALGORITHM}.`);
  decodeBase64Url(value.nonce, "AEAD nonce", 24);
  decodeBase64Url(value.ciphertext, "AEAD ciphertext", undefined, minimumCiphertextBytes);
  return Object.freeze({ algorithm: AEAD_ALGORITHM, nonce: value.nonce, ciphertext: value.ciphertext });
}

function parseKdf(value) {
  assertExactFields(value, ["algorithm", "version", "salt", "memoryKiB", "iterations", "parallelism"], "Password KDF");
  decodeBase64Url(value.salt, "Argon2id salt", 16);
  const parameters = normalizeArgon2idParameters({
    algorithm: value.algorithm,
    version: value.version,
    memoryKiB: value.memoryKiB,
    iterations: value.iterations,
    parallelism: value.parallelism,
  });
  return Object.freeze({ ...parameters, salt: value.salt });
}

function parseHkdf(value, expectedInfo) {
  assertExactFields(value, ["algorithm", "version", "salt", "info", "outputBytes"], "HKDF derivation");
  if (value.algorithm !== HKDF_ALGORITHM || value.version !== 1 || value.info !== expectedInfo || value.outputBytes !== 32) {
    fail("INVALID_ENVELOPE", "HKDF derivation contract does not match the envelope purpose.");
  }
  decodeBase64Url(value.salt, "HKDF salt", 32);
  return Object.freeze({ algorithm: HKDF_ALGORITHM, version: 1, salt: value.salt, info: expectedInfo, outputBytes: 32 });
}

export function parsePasswordWrappedProfileKey(value) {
  assertExactFields(value, ["format", "version", "purpose", "profileId", "kdf", "aead"], "Password-wrapped profile key");
  if (value.format !== PASSWORD_FORMAT || value.version !== PROFILE_CRYPTO_FORMAT_VERSION || value.purpose !== "password-wrap") {
    fail("INVALID_ENVELOPE", "Password-wrapped profile key format, version, or purpose is unsupported.");
  }
  return Object.freeze({
    format: PASSWORD_FORMAT,
    version: PROFILE_CRYPTO_FORMAT_VERSION,
    purpose: "password-wrap",
    profileId: contractId(value.profileId, "Profile id"),
    kdf: parseKdf(value.kdf),
    aead: parseAead(value.aead, PROFILE_MASTER_KEY_BYTES + 16),
  });
}

export function parseRecoveryWrappedProfileKey(value) {
  assertExactFields(value, ["format", "version", "purpose", "profileId", "derivation", "aead"], "Recovery-wrapped profile key");
  if (value.format !== PASSWORD_FORMAT || value.version !== PROFILE_CRYPTO_FORMAT_VERSION || value.purpose !== "recovery-wrap") {
    fail("INVALID_ENVELOPE", "Recovery-wrapped profile key format, version, or purpose is unsupported.");
  }
  return Object.freeze({
    format: PASSWORD_FORMAT,
    version: PROFILE_CRYPTO_FORMAT_VERSION,
    purpose: "recovery-wrap",
    profileId: contractId(value.profileId, "Profile id"),
    derivation: parseHkdf(value.derivation, RECOVERY_INFO),
    aead: parseAead(value.aead, PROFILE_MASTER_KEY_BYTES + 16),
  });
}

export function parseProfileSecretEnvelope(value) {
  assertExactFields(value, ["format", "version", "purpose", "profileId", "secretId", "derivation", "aead"], "Profile-secret envelope");
  if (value.format !== PROFILE_SECRET_FORMAT || value.version !== PROFILE_CRYPTO_FORMAT_VERSION || value.purpose !== "profile-secret") {
    fail("INVALID_ENVELOPE", "Profile-secret envelope format, version, or purpose is unsupported.");
  }
  return Object.freeze({
    format: PROFILE_SECRET_FORMAT,
    version: PROFILE_CRYPTO_FORMAT_VERSION,
    purpose: "profile-secret",
    profileId: contractId(value.profileId, "Profile id"),
    secretId: contractId(value.secretId, "Secret id", 256),
    derivation: parseHkdf(value.derivation, PROFILE_SECRET_INFO),
    aead: parseAead(value.aead, 17),
  });
}

export function encodeProfileEnvelopeAad({ profileId, version = PROFILE_CRYPTO_FORMAT_VERSION, purpose, secretId = null }) {
  const normalizedProfileId = contractId(profileId, "Profile id");
  if (version !== PROFILE_CRYPTO_FORMAT_VERSION) fail("INVALID_ENVELOPE", "AAD envelope version is unsupported.");
  if (!["password-wrap", "recovery-wrap", "profile-secret"].includes(purpose)) fail("INVALID_ENVELOPE", "AAD envelope purpose is unsupported.");
  const normalizedSecretId = purpose === "profile-secret" ? contractId(secretId, "Secret id", 256) : null;
  return textEncoder.encode(JSON.stringify({
    format: AAD_FORMAT,
    version: PROFILE_CRYPTO_FORMAT_VERSION,
    profileId: normalizedProfileId,
    purpose,
    secretId: normalizedSecretId,
  }));
}

async function readySodium() {
  await sodium.ready;
  return sodium;
}

async function derivePasswordKey(password, kdf) {
  assertPasswordCandidate(password);
  const library = await readySodium();
  const passwordBuffer = secretBytes(password, "Profile password");
  const salt = decodeBase64Url(kdf.salt, "Argon2id salt", library.crypto_pwhash_SALTBYTES);
  try {
    return library.crypto_pwhash(
      PROFILE_MASTER_KEY_BYTES,
      passwordBuffer,
      salt,
      kdf.iterations,
      kdf.memoryKiB * 1024,
      library.crypto_pwhash_ALG_ARGON2ID13,
    );
  } catch (error) {
    fail("KDF_UNAVAILABLE", "Argon2id could not allocate or complete; no weaker fallback is permitted.", error);
  } finally {
    wipe(passwordBuffer, salt);
  }
}

function deriveHkdfKey(secret, derivation) {
  let input;
  let salt;
  try {
    input = copyBytes(secret, "Key derivation input", PROFILE_MASTER_KEY_BYTES);
    salt = decodeBase64Url(derivation.salt, "HKDF salt", 32);
    return new Uint8Array(hkdfSync("sha256", input, salt, textEncoder.encode(derivation.info), derivation.outputBytes));
  } catch (error) {
    fail("KDF_UNAVAILABLE", "HKDF-SHA-256 could not derive the envelope key.", error);
  } finally {
    wipe(input, salt);
  }
}

async function encryptEnvelope(plaintext, key, nonce, aad) {
  const library = await readySodium();
  try {
    return library.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, aad, null, nonce, key);
  } catch (error) {
    fail("ENCRYPTION_FAILED", "Profile envelope encryption failed closed.", error);
  }
}

async function decryptEnvelope(ciphertext, key, nonce, aad) {
  const library = await readySodium();
  try {
    const plaintext = library.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, aad, nonce, key);
    if (!(plaintext instanceof Uint8Array)) fail("AUTHENTICATION_FAILED", "Profile envelope authentication failed.");
    return plaintext;
  } catch (error) {
    if (error instanceof ProfileCryptoContractError) throw error;
    fail("AUTHENTICATION_FAILED", "Profile envelope authentication failed.", error);
  }
}

export async function generateProfileMasterKey() {
  const library = await readySodium();
  return library.randombytes_buf(library.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
}

export async function generateRecoverySecret() {
  const library = await readySodium();
  return library.randombytes_buf(RECOVERY_SECRET_BYTES);
}

export async function wrapProfileMasterKeyWithPassword({ profileId, password, profileMasterKey, parameters = ARGON2ID_DEFAULTS }) {
  const library = await readySodium();
  const normalizedProfileId = contractId(profileId, "Profile id");
  const normalizedParameters = normalizeArgon2idParameters(parameters);
  const salt = library.randombytes_buf(library.crypto_pwhash_SALTBYTES);
  const nonce = library.randombytes_buf(library.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const plaintext = copyBytes(profileMasterKey, "Profile master key", PROFILE_MASTER_KEY_BYTES);
  const kdf = Object.freeze({ ...normalizedParameters, salt: encodeBase64Url(salt) });
  const aad = encodeProfileEnvelopeAad({ profileId: normalizedProfileId, purpose: "password-wrap" });
  let key;
  try {
    key = await derivePasswordKey(password, kdf);
    const ciphertext = await encryptEnvelope(plaintext, key, nonce, aad);
    return Object.freeze({
      format: PASSWORD_FORMAT,
      version: PROFILE_CRYPTO_FORMAT_VERSION,
      purpose: "password-wrap",
      profileId: normalizedProfileId,
      kdf,
      aead: Object.freeze({ algorithm: AEAD_ALGORITHM, nonce: encodeBase64Url(nonce), ciphertext: encodeBase64Url(ciphertext) }),
    });
  } finally {
    wipe(salt, nonce, plaintext, aad, key);
  }
}

export async function unwrapProfileMasterKeyWithPassword(envelope, password, expectedProfileId = envelope?.profileId) {
  const parsed = parsePasswordWrappedProfileKey(envelope);
  if (parsed.profileId !== contractId(expectedProfileId, "Expected profile id")) fail("AUTHENTICATION_FAILED", "Profile envelope authentication failed.");
  const nonce = decodeBase64Url(parsed.aead.nonce, "AEAD nonce", 24);
  const ciphertext = decodeBase64Url(parsed.aead.ciphertext, "AEAD ciphertext", undefined, PROFILE_MASTER_KEY_BYTES + 16);
  const aad = encodeProfileEnvelopeAad({ profileId: parsed.profileId, purpose: parsed.purpose });
  let key;
  try {
    key = await derivePasswordKey(password, parsed.kdf);
    return await decryptEnvelope(ciphertext, key, nonce, aad);
  } finally {
    wipe(nonce, ciphertext, aad, key);
  }
}

export async function wrapProfileMasterKeyWithRecovery({ profileId, recoverySecret, profileMasterKey }) {
  const library = await readySodium();
  const normalizedProfileId = contractId(profileId, "Profile id");
  const salt = library.randombytes_buf(32);
  const nonce = library.randombytes_buf(library.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const derivation = Object.freeze({ algorithm: HKDF_ALGORITHM, version: 1, salt: encodeBase64Url(salt), info: RECOVERY_INFO, outputBytes: 32 });
  const aad = encodeProfileEnvelopeAad({ profileId: normalizedProfileId, purpose: "recovery-wrap" });
  let plaintext;
  let secret;
  let key;
  try {
    plaintext = copyBytes(profileMasterKey, "Profile master key", PROFILE_MASTER_KEY_BYTES);
    secret = copyBytes(recoverySecret, "Recovery secret", RECOVERY_SECRET_BYTES);
    key = deriveHkdfKey(secret, derivation);
    const ciphertext = await encryptEnvelope(plaintext, key, nonce, aad);
    return Object.freeze({
      format: PASSWORD_FORMAT,
      version: PROFILE_CRYPTO_FORMAT_VERSION,
      purpose: "recovery-wrap",
      profileId: normalizedProfileId,
      derivation,
      aead: Object.freeze({ algorithm: AEAD_ALGORITHM, nonce: encodeBase64Url(nonce), ciphertext: encodeBase64Url(ciphertext) }),
    });
  } finally {
    wipe(salt, nonce, plaintext, secret, aad, key);
  }
}

export async function unwrapProfileMasterKeyWithRecovery(envelope, recoverySecret, expectedProfileId = envelope?.profileId) {
  const parsed = parseRecoveryWrappedProfileKey(envelope);
  if (parsed.profileId !== contractId(expectedProfileId, "Expected profile id")) fail("AUTHENTICATION_FAILED", "Profile envelope authentication failed.");
  const aad = encodeProfileEnvelopeAad({ profileId: parsed.profileId, purpose: parsed.purpose });
  let secret;
  let nonce;
  let ciphertext;
  let key;
  try {
    secret = copyBytes(recoverySecret, "Recovery secret", RECOVERY_SECRET_BYTES);
    nonce = decodeBase64Url(parsed.aead.nonce, "AEAD nonce", 24);
    ciphertext = decodeBase64Url(parsed.aead.ciphertext, "AEAD ciphertext", undefined, PROFILE_MASTER_KEY_BYTES + 16);
    key = deriveHkdfKey(secret, parsed.derivation);
    return await decryptEnvelope(ciphertext, key, nonce, aad);
  } finally {
    wipe(secret, nonce, ciphertext, aad, key);
  }
}

export async function wrapProfileSecret({ profileId, secretId, profileMasterKey, secret }) {
  const library = await readySodium();
  const normalizedProfileId = contractId(profileId, "Profile id");
  const normalizedSecretId = contractId(secretId, "Secret id", 256);
  const salt = library.randombytes_buf(32);
  const nonce = library.randombytes_buf(library.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const derivation = Object.freeze({ algorithm: HKDF_ALGORITHM, version: 1, salt: encodeBase64Url(salt), info: PROFILE_SECRET_INFO, outputBytes: 32 });
  const aad = encodeProfileEnvelopeAad({ profileId: normalizedProfileId, purpose: "profile-secret", secretId: normalizedSecretId });
  let plaintext;
  let pmk;
  let key;
  try {
    plaintext = secretBytes(secret, "Profile secret");
    if (!plaintext.byteLength) fail("INVALID_SECRET", "Profile secret cannot be empty.");
    pmk = copyBytes(profileMasterKey, "Profile master key", PROFILE_MASTER_KEY_BYTES);
    key = deriveHkdfKey(pmk, derivation);
    const ciphertext = await encryptEnvelope(plaintext, key, nonce, aad);
    return Object.freeze({
      format: PROFILE_SECRET_FORMAT,
      version: PROFILE_CRYPTO_FORMAT_VERSION,
      purpose: "profile-secret",
      profileId: normalizedProfileId,
      secretId: normalizedSecretId,
      derivation,
      aead: Object.freeze({ algorithm: AEAD_ALGORITHM, nonce: encodeBase64Url(nonce), ciphertext: encodeBase64Url(ciphertext) }),
    });
  } finally {
    wipe(salt, nonce, plaintext, pmk, aad, key);
  }
}

export async function unwrapProfileSecret(envelope, profileMasterKey, expected = {}) {
  const parsed = parseProfileSecretEnvelope(envelope);
  if (expected.profileId !== undefined && parsed.profileId !== contractId(expected.profileId, "Expected profile id")) fail("AUTHENTICATION_FAILED", "Profile envelope authentication failed.");
  if (expected.secretId !== undefined && parsed.secretId !== contractId(expected.secretId, "Expected secret id", 256)) fail("AUTHENTICATION_FAILED", "Profile envelope authentication failed.");
  const aad = encodeProfileEnvelopeAad({ profileId: parsed.profileId, purpose: parsed.purpose, secretId: parsed.secretId });
  let pmk;
  let nonce;
  let ciphertext;
  let key;
  try {
    pmk = copyBytes(profileMasterKey, "Profile master key", PROFILE_MASTER_KEY_BYTES);
    nonce = decodeBase64Url(parsed.aead.nonce, "AEAD nonce", 24);
    ciphertext = decodeBase64Url(parsed.aead.ciphertext, "AEAD ciphertext", undefined, 17);
    key = deriveHkdfKey(pmk, parsed.derivation);
    return await decryptEnvelope(ciphertext, key, nonce, aad);
  } finally {
    wipe(pmk, nonce, ciphertext, aad, key);
  }
}

export async function deriveArgon2idPortabilityFixture({ password, salt, parameters = ARGON2ID_SECURITY_FLOOR }) {
  const normalized = normalizeArgon2idParameters(parameters);
  const saltBytes = copyBytes(salt, "Argon2id fixture salt", 16);
  const kdf = { ...normalized, salt: encodeBase64Url(saltBytes) };
  try {
    return await derivePasswordKey(password, kdf);
  } finally {
    wipe(saltBytes);
  }
}

export async function benchmarkArgon2id(parameters = ARGON2ID_DEFAULTS) {
  const normalized = normalizeArgon2idParameters(parameters);
  const library = await readySodium();
  const salt = library.randombytes_buf(library.crypto_pwhash_SALTBYTES);
  const password = textEncoder.encode("PlotPickle synthetic Argon2id benchmark fixture");
  const kdf = { ...normalized, salt: encodeBase64Url(salt) };
  let key;
  const startedAt = performance.now();
  try {
    key = await derivePasswordKey(password, kdf);
    return Object.freeze({ ...normalized, durationMs: Number((performance.now() - startedAt).toFixed(2)), outputBytes: key.byteLength });
  } finally {
    wipe(salt, password, key);
  }
}
