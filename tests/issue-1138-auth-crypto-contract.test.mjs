import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  ARGON2ID_DEFAULTS,
  ARGON2ID_LIMITS,
  ARGON2ID_SECURITY_FLOOR,
  deriveArgon2idPortabilityFixture,
  generateProfileMasterKey,
  generateRecoverySecret,
  normalizeArgon2idParameters,
  parsePasswordWrappedProfileKey,
  parseProfileSecretEnvelope,
  unwrapProfileMasterKeyWithPassword,
  unwrapProfileMasterKeyWithRecovery,
  unwrapProfileSecret,
  wrapProfileMasterKeyWithPassword,
  wrapProfileMasterKeyWithRecovery,
  wrapProfileSecret,
} from "../core/auth/profile-crypto-contract-core.mjs";

const root = path.resolve(import.meta.dirname, "..");
const fixturePassword = "PlotPickle synthetic passphrase for #1138";

function mutateBase64Url(value, index) {
  const bytes = Buffer.from(value, "base64url");
  bytes[index < 0 ? bytes.length + index : index] ^= 1;
  return bytes.toString("base64url");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertCode(code) {
  return (error) => error?.code === code;
}

test("password wrapping uses a self-describing Argon2id envelope and unwraps the exact PMK", async () => {
  const pmk = await generateProfileMasterKey();
  const envelope = await wrapProfileMasterKeyWithPassword({
    profileId: "profile-contract-a",
    password: fixturePassword,
    profileMasterKey: pmk,
    parameters: ARGON2ID_SECURITY_FLOOR,
  });
  const parsed = parsePasswordWrappedProfileKey(envelope);
  assert.deepEqual(
    { algorithm: parsed.kdf.algorithm, version: parsed.kdf.version, memoryKiB: parsed.kdf.memoryKiB, iterations: parsed.kdf.iterations, parallelism: parsed.kdf.parallelism },
    ARGON2ID_SECURITY_FLOOR,
  );
  assert.deepEqual(await unwrapProfileMasterKeyWithPassword(envelope, fixturePassword, "profile-contract-a"), pmk);
  await assert.rejects(unwrapProfileMasterKeyWithPassword(envelope, "wrong synthetic password", "profile-contract-a"), assertCode("AUTHENTICATION_FAILED"));
});

test("one-bit ciphertext, tag, nonce, and AAD tampering all fail closed", async () => {
  const pmk = await generateProfileMasterKey();
  const envelope = await wrapProfileMasterKeyWithPassword({ profileId: "profile-tamper-a", password: fixturePassword, profileMasterKey: pmk, parameters: ARGON2ID_SECURITY_FLOOR });
  const variants = [];
  for (const position of [0, -1]) {
    const altered = clone(envelope);
    altered.aead.ciphertext = mutateBase64Url(altered.aead.ciphertext, position);
    variants.push(altered);
  }
  const nonce = clone(envelope);
  nonce.aead.nonce = mutateBase64Url(nonce.aead.nonce, 0);
  variants.push(nonce);
  const aad = clone(envelope);
  aad.profileId = "profile-tamper-b";
  variants.push(aad);
  for (const altered of variants) {
    await assert.rejects(unwrapProfileMasterKeyWithPassword(altered, fixturePassword, altered.profileId), assertCode("AUTHENTICATION_FAILED"));
  }
  await assert.rejects(unwrapProfileMasterKeyWithPassword(envelope, fixturePassword, "profile-tamper-b"), assertCode("AUTHENTICATION_FAILED"));
});

test("password and recovery purposes cannot be substituted", async () => {
  const pmk = await generateProfileMasterKey();
  const recoverySecret = await generateRecoverySecret();
  const passwordEnvelope = await wrapProfileMasterKeyWithPassword({ profileId: "profile-purpose", password: fixturePassword, profileMasterKey: pmk, parameters: ARGON2ID_SECURITY_FLOOR });
  const recoveryEnvelope = await wrapProfileMasterKeyWithRecovery({ profileId: "profile-purpose", recoverySecret, profileMasterKey: pmk });
  assert.deepEqual(await unwrapProfileMasterKeyWithRecovery(recoveryEnvelope, recoverySecret, "profile-purpose"), pmk);
  await assert.rejects(unwrapProfileMasterKeyWithPassword(recoveryEnvelope, fixturePassword), assertCode("INVALID_ENVELOPE"));
  await assert.rejects(unwrapProfileMasterKeyWithRecovery(passwordEnvelope, recoverySecret), assertCode("INVALID_ENVELOPE"));
  const wrongRecoverySecret = await generateRecoverySecret();
  await assert.rejects(unwrapProfileMasterKeyWithRecovery(recoveryEnvelope, wrongRecoverySecret), assertCode("AUTHENTICATION_FAILED"));
});

test("profile-secret envelopes bind profile and logical secret identifiers", async () => {
  const pmk = await generateProfileMasterKey();
  const plaintext = "synthetic BUZZ signing fixture";
  const envelope = await wrapProfileSecret({ profileId: "profile-secret-a", secretId: "buzz-human-signer", profileMasterKey: pmk, secret: plaintext });
  assert.equal(new TextDecoder().decode(await unwrapProfileSecret(envelope, pmk, { profileId: "profile-secret-a", secretId: "buzz-human-signer" })), plaintext);
  const parsed = parseProfileSecretEnvelope(envelope);
  assert.equal(parsed.derivation.info, "plotpickle:profile-secret:v1");
  await assert.rejects(unwrapProfileSecret(envelope, pmk, { profileId: "profile-secret-b" }), assertCode("AUTHENTICATION_FAILED"));
  await assert.rejects(unwrapProfileSecret(envelope, pmk, { secretId: "provider-api-key" }), assertCode("AUTHENTICATION_FAILED"));
  const changedId = clone(envelope);
  changedId.secretId = "provider-api-key";
  await assert.rejects(unwrapProfileSecret(changedId, pmk), assertCode("AUTHENTICATION_FAILED"));
});

test("KDF floor, resource ceiling, and short numeric PIN policy reject unsafe inputs without fallback", async () => {
  assert.throws(() => normalizeArgon2idParameters({ ...ARGON2ID_SECURITY_FLOOR, memoryKiB: 19_455 }), assertCode("KDF_BELOW_FLOOR"));
  assert.throws(() => normalizeArgon2idParameters({ ...ARGON2ID_SECURITY_FLOOR, iterations: 1 }), assertCode("KDF_BELOW_FLOOR"));
  assert.throws(() => normalizeArgon2idParameters({ ...ARGON2ID_DEFAULTS, memoryKiB: ARGON2ID_LIMITS.maximumMemoryKiB + 1 }), assertCode("KDF_OUT_OF_RANGE"));
  const pmk = await generateProfileMasterKey();
  await assert.rejects(wrapProfileMasterKeyWithPassword({ profileId: "profile-pin", password: "123456", profileMasterKey: pmk }), assertCode("INVALID_PASSWORD"));
  await assert.rejects(wrapProfileMasterKeyWithPassword({ profileId: "profile-blank", password: "   ", profileMasterKey: pmk }), assertCode("INVALID_PASSWORD"));
});

test("runtime schemas reject unknown fields and non-canonical binary encodings", async () => {
  const pmk = await generateProfileMasterKey();
  const envelope = await wrapProfileMasterKeyWithPassword({ profileId: "profile-schema", password: fixturePassword, profileMasterKey: pmk, parameters: ARGON2ID_SECURITY_FLOOR });
  assert.throws(() => parsePasswordWrappedProfileKey({ ...envelope, unsupported: true }), assertCode("INVALID_ENVELOPE"));
  const paddedSalt = clone(envelope);
  paddedSalt.kdf.salt = `${paddedSalt.kdf.salt}=`;
  assert.throws(() => parsePasswordWrappedProfileKey(paddedSalt), assertCode("INVALID_ENVELOPE"));
});

test("random PMKs, salts, and nonces differ across profile creation", async () => {
  const firstPmk = await generateProfileMasterKey();
  const secondPmk = await generateProfileMasterKey();
  assert.notDeepEqual(firstPmk, secondPmk);
  const first = await wrapProfileMasterKeyWithPassword({ profileId: "profile-random", password: fixturePassword, profileMasterKey: firstPmk, parameters: ARGON2ID_SECURITY_FLOOR });
  const second = await wrapProfileMasterKeyWithPassword({ profileId: "profile-random", password: fixturePassword, profileMasterKey: secondPmk, parameters: ARGON2ID_SECURITY_FLOOR });
  assert.notEqual(first.kdf.salt, second.kdf.salt);
  assert.notEqual(first.aead.nonce, second.aead.nonce);
  assert.notEqual(first.aead.ciphertext, second.aead.ciphertext);
});

test("Argon2id stored parameters are portable through a locked synthetic vector", async () => {
  const key = await deriveArgon2idPortabilityFixture({
    password: "PlotPickle Argon2id portability fixture v1",
    salt: Buffer.from("000102030405060708090a0b0c0d0e0f", "hex"),
    parameters: ARGON2ID_SECURITY_FLOOR,
  });
  assert.equal(Buffer.from(key).toString("hex"), "ef73eb59d9e44cef62acf45bcadc31b2d0cc8e1fde478cef5b919b212564e4a0");
});

test("serialized envelopes contain no plaintext password, PMK, or profile secret", async () => {
  const pmk = await generateProfileMasterKey();
  const passwordEnvelope = await wrapProfileMasterKeyWithPassword({ profileId: "profile-redaction", password: fixturePassword, profileMasterKey: pmk, parameters: ARGON2ID_SECURITY_FLOOR });
  const profileSecret = "synthetic provider credential fixture";
  const secretEnvelope = await wrapProfileSecret({ profileId: "profile-redaction", secretId: "provider", profileMasterKey: pmk, secret: profileSecret });
  const serialized = JSON.stringify({ passwordEnvelope, secretEnvelope });
  assert.doesNotMatch(serialized, new RegExp(fixturePassword, "u"));
  assert.doesNotMatch(serialized, new RegExp(profileSecret, "u"));
  assert.doesNotMatch(serialized, new RegExp(Buffer.from(pmk).toString("hex"), "u"));
  assert.doesNotMatch(serialized, new RegExp(Buffer.from(pmk).toString("base64url"), "u"));
});

test("benchmark evidence records metadata and timings without synthetic secrets or key output", () => {
  const output = execFileSync(process.execPath, ["scripts/benchmark-auth-crypto.mjs", "--json"], { cwd: root, encoding: "utf8" });
  const evidence = JSON.parse(output);
  assert.equal(evidence.results.length, 2);
  assert.equal(evidence.results.every((result) => result.outputBytes === 32 && result.durationMs > 0), true);
  assert.doesNotMatch(output, /PlotPickle synthetic Argon2id benchmark fixture/u);
  assert.doesNotMatch(output, /ef73eb59d9e44cef62acf45bcadc31b2d0cc8e1fde478cef5b919b212564e4a0/u);
  assert.equal("password" in evidence, false);
  assert.equal("key" in evidence, false);
});

test("dependency, documentation, CI, and packaging contracts remain pinned and discoverable", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  const locked = packageLock.packages["node_modules/libsodium-wrappers-sumo"];
  assert.equal(packageJson.dependencies["libsodium-wrappers-sumo"], "0.8.4");
  assert.equal(locked.version, "0.8.4");
  assert.equal(locked.license, "ISC");
  assert.notEqual(locked.integrity, undefined);
  assert.notEqual(locked.hasInstallScript, true);
  assert.equal(packageJson.scripts["test:auth-crypto"], "node --test tests/issue-1138-auth-crypto-contract.test.mjs");
  assert.equal(packageJson.scripts["benchmark:auth-crypto"], "node scripts/benchmark-auth-crypto.mjs");
  const threatModel = fs.readFileSync(path.join(root, "docs", "architecture", "PLOTPICKLE-AUTH-THREAT-MODEL.md"), "utf8");
  const evidence = fs.readFileSync(path.join(root, "docs", "architecture", "PLOTPICKLE-AUTH-CRYPTO-SELECTION.md"), "utf8");
  const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "auth-crypto-contract.yml"), "utf8");
  assert.match(threatModel, /malicious root\/Administrator.*out of scope/is);
  assert.match(threatModel, /client-side.*end-to-end encryption/is);
  assert.match(evidence, /libsodium-wrappers-sumo.*0\.8\.4/is);
  assert.match(evidence, /Initial default\s*\|\s*65,536 KiB\s*\|\s*3\s*\|\s*1/is);
  assert.match(workflow, /ubuntu-latest[\s\S]*windows-latest[\s\S]*macos-latest/);
  assert.match(workflow, /npm ci[^\n]*--ignore-scripts/);
  assert.match(fs.readFileSync(path.join(root, "scripts", "package-platform.mjs"), "utf8"), /runtimeDirectories[\s\S]*"core"/);
});
