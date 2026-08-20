import * as core from "./profile-crypto-contract-core.mjs";

export type Argon2idParameters = {
  readonly algorithm: "argon2id";
  readonly version: 19;
  readonly memoryKiB: number;
  readonly iterations: number;
  readonly parallelism: 1;
};

export type XChaCha20Poly1305Envelope = {
  readonly algorithm: "xchacha20-poly1305";
  readonly nonce: string;
  readonly ciphertext: string;
};

export type PasswordWrappedProfileKey = {
  readonly format: "plotpickle-profile-key";
  readonly version: 1;
  readonly purpose: "password-wrap";
  readonly profileId: string;
  readonly kdf: Argon2idParameters & { readonly salt: string };
  readonly aead: XChaCha20Poly1305Envelope;
};

export type HkdfDerivation = {
  readonly algorithm: "hkdf-sha256";
  readonly version: 1;
  readonly salt: string;
  readonly info: string;
  readonly outputBytes: 32;
};

export type RecoveryWrappedProfileKey = {
  readonly format: "plotpickle-profile-key";
  readonly version: 1;
  readonly purpose: "recovery-wrap";
  readonly profileId: string;
  readonly derivation: HkdfDerivation;
  readonly aead: XChaCha20Poly1305Envelope;
};

export type ProfileSecretEnvelope = {
  readonly format: "plotpickle-profile-secret";
  readonly version: 1;
  readonly purpose: "profile-secret";
  readonly profileId: string;
  readonly secretId: string;
  readonly derivation: HkdfDerivation;
  readonly aead: XChaCha20Poly1305Envelope;
};

export type ProfileCryptoErrorCode =
  | "INVALID_ENVELOPE"
  | "UNSUPPORTED_ENVELOPE_VERSION"
  | "INVALID_KDF"
  | "INVALID_PASSWORD"
  | "INVALID_SECRET"
  | "KDF_BELOW_FLOOR"
  | "KDF_OUT_OF_RANGE"
  | "KDF_UNAVAILABLE"
  | "ENCRYPTION_FAILED"
  | "AUTHENTICATION_FAILED";

export type ProfileCryptoContractErrorInstance = Error & {
  readonly name: "ProfileCryptoContractError";
  readonly code: ProfileCryptoErrorCode;
};

export const PROFILE_CRYPTO_FORMAT_VERSION = 1 as const;
export const ARGON2ID_VERSION = 19 as const;
export const PROFILE_MASTER_KEY_BYTES = 32 as const;
export const RECOVERY_SECRET_BYTES = 32 as const;
export const ARGON2ID_SECURITY_FLOOR = core.ARGON2ID_SECURITY_FLOOR as Argon2idParameters;
export const ARGON2ID_DEFAULTS = core.ARGON2ID_DEFAULTS as Argon2idParameters;
export const ARGON2ID_LIMITS = core.ARGON2ID_LIMITS as Readonly<{ maximumMemoryKiB: number; maximumIterations: number; parallelism: 1 }>;
export const ProfileCryptoContractError = core.ProfileCryptoContractError as unknown as {
  new(code: ProfileCryptoErrorCode, message: string, options?: { cause?: unknown }): ProfileCryptoContractErrorInstance;
};
export const assertPasswordCandidate = core.assertPasswordCandidate as (password: string | Uint8Array) => true;
export const normalizeArgon2idParameters = core.normalizeArgon2idParameters as (value?: unknown) => Argon2idParameters;
export const parsePasswordWrappedProfileKey = core.parsePasswordWrappedProfileKey as (value: unknown) => PasswordWrappedProfileKey;
export const parseRecoveryWrappedProfileKey = core.parseRecoveryWrappedProfileKey as (value: unknown) => RecoveryWrappedProfileKey;
export const parseProfileSecretEnvelope = core.parseProfileSecretEnvelope as (value: unknown) => ProfileSecretEnvelope;
export const encodeProfileEnvelopeAad = core.encodeProfileEnvelopeAad as (input: { profileId: string; version?: 1; purpose: "password-wrap" | "recovery-wrap" | "profile-secret"; secretId?: string | null }) => Uint8Array;
export const generateProfileMasterKey = core.generateProfileMasterKey as () => Promise<Uint8Array>;
export const generateRecoverySecret = core.generateRecoverySecret as () => Promise<Uint8Array>;
export const wrapProfileMasterKeyWithPassword = core.wrapProfileMasterKeyWithPassword as (input: { profileId: string; password: string | Uint8Array; profileMasterKey: Uint8Array; parameters?: Argon2idParameters }) => Promise<PasswordWrappedProfileKey>;
export const unwrapProfileMasterKeyWithPassword = core.unwrapProfileMasterKeyWithPassword as (envelope: unknown, password: string | Uint8Array, expectedProfileId?: string) => Promise<Uint8Array>;
export const wrapProfileMasterKeyWithRecovery = core.wrapProfileMasterKeyWithRecovery as (input: { profileId: string; recoverySecret: Uint8Array; profileMasterKey: Uint8Array }) => Promise<RecoveryWrappedProfileKey>;
export const unwrapProfileMasterKeyWithRecovery = core.unwrapProfileMasterKeyWithRecovery as (envelope: unknown, recoverySecret: Uint8Array, expectedProfileId?: string) => Promise<Uint8Array>;
export const wrapProfileSecret = core.wrapProfileSecret as (input: { profileId: string; secretId: string; profileMasterKey: Uint8Array; secret: string | Uint8Array }) => Promise<ProfileSecretEnvelope>;
export const unwrapProfileSecret = core.unwrapProfileSecret as (envelope: unknown, profileMasterKey: Uint8Array, expected?: { profileId?: string; secretId?: string }) => Promise<Uint8Array>;
export const deriveArgon2idPortabilityFixture = core.deriveArgon2idPortabilityFixture as (input: { password: string | Uint8Array; salt: Uint8Array; parameters?: Argon2idParameters }) => Promise<Uint8Array>;
export const benchmarkArgon2id = core.benchmarkArgon2id as (parameters?: Argon2idParameters) => Promise<Argon2idParameters & { durationMs: number; outputBytes: number }>;
