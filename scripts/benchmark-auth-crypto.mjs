import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARGON2ID_DEFAULTS,
  ARGON2ID_LIMITS,
  ARGON2ID_SECURITY_FLOOR,
  benchmarkArgon2id,
  normalizeArgon2idParameters,
} from "../core/auth/profile-crypto-contract-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageLock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
const dependency = packageLock.packages?.["node_modules/libsodium-wrappers-sumo"];
if (!dependency?.version || !dependency.integrity) throw new Error("The locked libsodium-wrappers-sumo dependency is unavailable.");

let oversizedParametersRejectedBeforeAllocation = false;
try {
  normalizeArgon2idParameters({ ...ARGON2ID_DEFAULTS, memoryKiB: ARGON2ID_LIMITS.maximumMemoryKiB + 1 });
} catch (error) {
  oversizedParametersRejectedBeforeAllocation = error?.code === "KDF_OUT_OF_RANGE";
}
if (!oversizedParametersRejectedBeforeAllocation) throw new Error("Oversized Argon2id parameters did not fail before allocation.");

const results = [];
for (const parameters of [ARGON2ID_SECURITY_FLOOR, ARGON2ID_DEFAULTS]) {
  results.push(await benchmarkArgon2id(parameters));
}

const evidence = {
  schemaVersion: 1,
  recordedAt: new Date().toISOString(),
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  dependency: {
    package: "libsodium-wrappers-sumo",
    version: dependency.version,
    license: dependency.license,
    integrity: dependency.integrity,
    nativeBinary: false,
    wasm: true,
    lifecycleInstallScript: dependency.hasInstallScript === true,
  },
  contract: {
    floor: ARGON2ID_SECURITY_FLOOR,
    default: ARGON2ID_DEFAULTS,
    oversizedParametersRejectedBeforeAllocation,
    allocationFailureBehavior: "fail-closed; no PBKDF2, bcrypt, scrypt, SHA-256, or reduced-memory fallback",
  },
  results,
};

process.stdout.write(`${JSON.stringify(evidence, null, process.argv.includes("--json") ? 0 : 2)}\n`);
