import { spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, open, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PROTECTED_FORMAT = "plotpickle-protected-credential";
const DPAPI_ENTROPY = "PlotPickle local credential v1";
const KEYCHAIN_SERVICE = "org.plotpickle.credentials";
const MAX_CREDENTIAL_BYTES = 2 * 1024 * 1024;
const MAX_COMMAND_OUTPUT_BYTES = MAX_CREDENTIAL_BYTES * 2;

export type CredentialProtection =
  | "windows-dpapi-current-user"
  | "macos-keychain-current-user"
  | "linux-secret-service-current-user"
  | "linux-systemd-creds-current-user"
  | "legacy-plaintext"
  | "unsupported-platform";

type WindowsProtectedCredentialEnvelope = {
  format: typeof PROTECTED_FORMAT;
  version: 1;
  protection: "windows-dpapi-current-user";
  ciphertext: string;
};

type KeyringProtectedCredentialEnvelope = {
  format: typeof PROTECTED_FORMAT;
  version: 2;
  protection: "macos-keychain-current-user" | "linux-secret-service-current-user";
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
};

type SystemdProtectedCredentialEnvelope = {
  format: typeof PROTECTED_FORMAT;
  version: 3;
  protection: "linux-systemd-creds-current-user";
  ciphertext: string;
};

type ProtectedCredentialEnvelope = WindowsProtectedCredentialEnvelope | KeyringProtectedCredentialEnvelope | SystemdProtectedCredentialEnvelope;

export type CredentialFileSummary = {
  name: string;
  bytes: number;
  protection: CredentialProtection;
};

export function persistentHome() {
  if (process.env.PLOTPICKLE_HOME) return path.resolve(process.env.PLOTPICKLE_HOME);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle");
  return path.join(os.homedir(), ".plotpickle");
}

export function credentialsDirectory() {
  return path.join(persistentHome(), "secrets");
}

function safeCredentialName(name: string) {
  if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(name)) throw new Error("Invalid local credential file name.");
  return name;
}

export function credentialFilePath(name: string) {
  return path.join(credentialsDirectory(), safeCredentialName(name));
}

function isWindowsEnvelope(value: unknown): value is WindowsProtectedCredentialEnvelope {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WindowsProtectedCredentialEnvelope>;
  return item.format === PROTECTED_FORMAT
    && item.version === 1
    && item.protection === "windows-dpapi-current-user"
    && typeof item.ciphertext === "string"
    && item.ciphertext.length > 0;
}

function isKeyringEnvelope(value: unknown): value is KeyringProtectedCredentialEnvelope {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<KeyringProtectedCredentialEnvelope>;
  return item.format === PROTECTED_FORMAT
    && item.version === 2
    && (item.protection === "macos-keychain-current-user" || item.protection === "linux-secret-service-current-user")
    && item.algorithm === "aes-256-gcm"
    && typeof item.iv === "string"
    && typeof item.authTag === "string"
    && typeof item.ciphertext === "string"
    && item.iv.length > 0
    && item.authTag.length > 0
    && item.ciphertext.length > 0;
}

function isSystemdEnvelope(value: unknown): value is SystemdProtectedCredentialEnvelope {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SystemdProtectedCredentialEnvelope>;
  return item.format === PROTECTED_FORMAT
    && item.version === 3
    && item.protection === "linux-systemd-creds-current-user"
    && typeof item.ciphertext === "string"
    && item.ciphertext.length > 0;
}

function isProtectedEnvelope(value: unknown): value is ProtectedCredentialEnvelope {
  return isWindowsEnvelope(value) || isKeyringEnvelope(value) || isSystemdEnvelope(value);
}

function expectedProtectionForPlatform(): Exclude<CredentialProtection, "legacy-plaintext" | "unsupported-platform"> | null {
  if (process.platform === "win32") return "windows-dpapi-current-user";
  if (process.platform === "darwin") return "macos-keychain-current-user";
  if (process.platform === "linux") return "linux-secret-service-current-user";
  return null;
}

function command(
  executable: string,
  args: string[],
  input = "",
  options: { allowFailure?: boolean; unavailableMessage: string; failureMessage: string },
) {
  return new Promise<string | null>((resolve, reject) => {
    const child = spawn(executable, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "ignore"],
    });
    const stdout: Buffer[] = [];
    let stdoutBytes = 0;
    let settled = false;
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes <= MAX_COMMAND_OUTPUT_BYTES) stdout.push(chunk);
    });
    child.once("error", () => {
      if (settled) return;
      settled = true;
      reject(new Error(options.unavailableMessage));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      if (stdoutBytes > MAX_COMMAND_OUTPUT_BYTES) {
        reject(new Error(options.failureMessage));
        return;
      }
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString("utf8").trim());
        return;
      }
      if (options.allowFailure) {
        resolve(null);
        return;
      }
      reject(new Error(options.failureMessage));
    });
    child.stdin.on("error", () => { /* The process error or exit handler reports the failure. */ });
    child.stdin.end(input, "utf8");
  });
}

function powerShell(script: string, input: string) {
  return command("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], input, {
    unavailableMessage: "Windows credential encryption could not start.",
    failureMessage: "Windows credential encryption failed.",
  }).then((value) => value || "");
}

async function protectForCurrentWindowsUser(source: string) {
  const encoded = Buffer.from(source, "utf8").toString("base64");
  const script = [
    "$ErrorActionPreference='Stop'",
    "Add-Type -AssemblyName System.Security",
    "$source=[Console]::In.ReadToEnd().Trim()",
    "$bytes=[Convert]::FromBase64String($source)",
    `$entropy=[Text.Encoding]::UTF8.GetBytes('${DPAPI_ENTROPY}')`,
    "$protected=[System.Security.Cryptography.ProtectedData]::Protect($bytes,$entropy,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "[Console]::Out.Write([Convert]::ToBase64String($protected))",
  ].join(";");
  const ciphertext = await powerShell(script, encoded);
  if (!ciphertext) throw new Error("Windows credential encryption returned no protected data.");
  return ciphertext;
}

async function unprotectForCurrentWindowsUser(ciphertext: string) {
  const script = [
    "$ErrorActionPreference='Stop'",
    "Add-Type -AssemblyName System.Security",
    "$source=[Console]::In.ReadToEnd().Trim()",
    "$bytes=[Convert]::FromBase64String($source)",
    `$entropy=[Text.Encoding]::UTF8.GetBytes('${DPAPI_ENTROPY}')`,
    "$clear=[System.Security.Cryptography.ProtectedData]::Unprotect($bytes,$entropy,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "[Console]::Out.Write([Convert]::ToBase64String($clear))",
  ].join(";");
  const encoded = await powerShell(script, ciphertext);
  return Buffer.from(encoded, "base64").toString("utf8");
}

function masterKeyAccount() {
  const homeId = createHash("sha256").update(persistentHome()).digest("hex").slice(0, 20);
  return `${os.userInfo().username}:credential-key-v2:${homeId}`;
}

function parseMasterKey(value: string | null, provider: string) {
  if (!value) return null;
  let key: Buffer;
  try { key = Buffer.from(value, "base64"); } catch { throw new Error(`${provider} returned an invalid PlotPickle credential key.`); }
  if (key.length !== 32) throw new Error(`${provider} returned an invalid PlotPickle credential key.`);
  return key;
}

let cachedMasterKey: Buffer | null = null;
let masterKeyRequest: Promise<Buffer> | null = null;

async function macosMasterKey(createIfMissing: boolean) {
  const account = masterKeyAccount();
  const lookup = await command("security", ["find-generic-password", "-a", account, "-s", KEYCHAIN_SERVICE, "-w"], "", {
    allowFailure: true,
    unavailableMessage: "macOS Keychain is unavailable. PlotPickle will not save credentials without encryption.",
    failureMessage: "macOS Keychain could not read the PlotPickle credential key.",
  });
  const existing = parseMasterKey(lookup, "macOS Keychain");
  if (existing) return existing;
  if (!createIfMissing) throw new Error("The PlotPickle credential key is missing from this user's macOS Keychain.");
  const created = randomBytes(32);
  const encoded = created.toString("base64");
  await command("/bin/sh", [
    "-c",
    'IFS= read -r secret; exec /usr/bin/security add-generic-password -U -a "$1" -s "$2" -w "$secret"',
    "plotpickle-keychain",
    account,
    KEYCHAIN_SERVICE,
  ], `${encoded}\n`, {
    unavailableMessage: "macOS Keychain is unavailable. PlotPickle will not save credentials without encryption.",
    failureMessage: "macOS Keychain could not store the PlotPickle credential key.",
  });
  const verified = parseMasterKey(await command("security", ["find-generic-password", "-a", account, "-s", KEYCHAIN_SERVICE, "-w"], "", {
    unavailableMessage: "macOS Keychain is unavailable. PlotPickle will not save credentials without encryption.",
    failureMessage: "macOS Keychain could not verify the PlotPickle credential key.",
  }), "macOS Keychain");
  if (!verified || !verified.equals(created)) throw new Error("macOS Keychain did not verify the PlotPickle credential key.");
  return verified;
}

async function linuxSecretServiceMasterKey(createIfMissing: boolean) {
  const account = masterKeyAccount();
  const lookup = await command("secret-tool", ["lookup", "service", KEYCHAIN_SERVICE, "account", account], "", {
    allowFailure: true,
    unavailableMessage: "Linux Secret Service is unavailable.",
    failureMessage: "Linux Secret Service could not read the PlotPickle credential key.",
  });
  const existing = parseMasterKey(lookup, "Linux Secret Service");
  if (existing) return existing;
  if (!createIfMissing) throw new Error("The PlotPickle credential key is missing from this user's Linux Secret Service.");
  const created = randomBytes(32);
  const encoded = created.toString("base64");
  await command("secret-tool", ["store", "--label=PlotPickle credential encryption key", "service", KEYCHAIN_SERVICE, "account", account], `${encoded}\n`, {
    unavailableMessage: "Linux Secret Service is unavailable.",
    failureMessage: "Linux Secret Service could not store the PlotPickle credential key.",
  });
  const verified = parseMasterKey(await command("secret-tool", ["lookup", "service", KEYCHAIN_SERVICE, "account", account], "", {
    unavailableMessage: "Linux Secret Service is unavailable.",
    failureMessage: "Linux Secret Service could not verify the PlotPickle credential key.",
  }), "Linux Secret Service");
  if (!verified || !verified.equals(created)) throw new Error("Linux Secret Service did not verify the PlotPickle credential key.");
  return verified;
}

async function platformMasterKey(createIfMissing: boolean) {
  if (cachedMasterKey) return cachedMasterKey;
  if (masterKeyRequest) return masterKeyRequest;
  const request = (process.platform === "darwin"
    ? macosMasterKey(createIfMissing)
    : process.platform === "linux"
      ? linuxSecretServiceMasterKey(createIfMissing)
      : Promise.reject(new Error("This operating system does not provide a supported PlotPickle credential key store.")))
    .then((key) => {
      cachedMasterKey = key;
      return key;
    });
  masterKeyRequest = request;
  try {
    return await request;
  } finally {
    if (masterKeyRequest === request) masterKeyRequest = null;
  }
}

async function removePlatformMasterKey() {
  cachedMasterKey = null;
  masterKeyRequest = null;
  const account = masterKeyAccount();
  if (process.platform === "darwin") {
    await command("security", ["delete-generic-password", "-a", account, "-s", KEYCHAIN_SERVICE], "", {
      allowFailure: true,
      unavailableMessage: "macOS Keychain is unavailable.",
      failureMessage: "macOS Keychain could not remove the PlotPickle credential key.",
    });
  } else if (process.platform === "linux") {
    await command("secret-tool", ["clear", "service", KEYCHAIN_SERVICE, "account", account], "", {
      allowFailure: true,
      unavailableMessage: "Linux Secret Service is unavailable.",
      failureMessage: "Linux Secret Service could not remove the PlotPickle credential key.",
    });
  }
}

async function protectWithKeyring(name: string, source: string): Promise<KeyringProtectedCredentialEnvelope> {
  const protection = expectedProtectionForPlatform();
  if (protection !== "macos-keychain-current-user" && protection !== "linux-secret-service-current-user") {
    throw new Error("This platform cannot create a keyring-protected PlotPickle credential.");
  }
  const key = await platformMasterKey(true);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`PlotPickle credential v2:${name}`, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(source, "utf8"), cipher.final()]);
  return {
    format: PROTECTED_FORMAT,
    version: 2,
    protection,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

async function unprotectWithKeyring(name: string, envelope: KeyringProtectedCredentialEnvelope) {
  const expected = expectedProtectionForPlatform();
  if (envelope.protection !== expected) throw new Error("This credential is protected for a different operating-system user key store.");
  const key = await platformMasterKey(false);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAAD(Buffer.from(`PlotPickle credential v2:${name}`, "utf8"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

async function protectWithSystemdCredentials(name: string, source: string): Promise<SystemdProtectedCredentialEnvelope> {
  const encrypted = await command("systemd-creds", [
    "--user",
    "--with-key=host",
    `--name=${name}`,
    "encrypt",
    "-",
    "-",
  ], source, {
    unavailableMessage: "User-scoped systemd credential encryption is unavailable.",
    failureMessage: "User-scoped systemd credential encryption failed.",
  });
  if (!encrypted) throw new Error("User-scoped systemd credential encryption returned no protected data.");
  return {
    format: PROTECTED_FORMAT,
    version: 3,
    protection: "linux-systemd-creds-current-user",
    ciphertext: Buffer.from(encrypted, "utf8").toString("base64"),
  };
}

async function unprotectWithSystemdCredentials(name: string, envelope: SystemdProtectedCredentialEnvelope) {
  const encrypted = Buffer.from(envelope.ciphertext, "base64").toString("utf8");
  const clear = await command("systemd-creds", [
    "--user",
    `--name=${name}`,
    "decrypt",
    "-",
    "-",
  ], encrypted, {
    unavailableMessage: "User-scoped systemd credential decryption is unavailable.",
    failureMessage: "User-scoped systemd credential decryption failed.",
  });
  if (!clear) throw new Error("User-scoped systemd credential decryption returned no data.");
  return clear;
}

async function atomicWrite(filePath: string, source: string) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, "w", 0o600);
    try {
      await handle.writeFile(source, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, filePath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  try { await chmod(filePath, 0o600); } catch { /* Native user encryption remains the primary protection. */ }
}

export async function readCredentialJson<T>(name: string): Promise<T | null> {
  const safeName = safeCredentialName(name);
  const filePath = credentialFilePath(safeName);
  try {
    const source = await readFile(filePath, "utf8");
    if (Buffer.byteLength(source, "utf8") > MAX_CREDENTIAL_BYTES) throw new Error("The local credential file is unexpectedly large.");
    const stored: unknown = JSON.parse(source);
    if (!isProtectedEnvelope(stored)) {
      await writeCredentialJson(safeName, stored);
      const migrated = JSON.parse(await readFile(filePath, "utf8")) as unknown;
      if (!isProtectedEnvelope(migrated)) throw new Error("The legacy credential could not be migrated to encrypted storage.");
      return stored as T;
    }
    if (isWindowsEnvelope(stored)) {
      if (process.platform !== "win32") throw new Error("This credential is protected for a Windows user account and cannot be read on this platform.");
      return JSON.parse(await unprotectForCurrentWindowsUser(stored.ciphertext)) as T;
    }
    if (isSystemdEnvelope(stored)) return JSON.parse(await unprotectWithSystemdCredentials(safeName, stored)) as T;
    return JSON.parse(await unprotectWithKeyring(safeName, stored)) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeCredentialJson(name: string, value: unknown) {
  const safeName = safeCredentialName(name);
  const source = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(source, "utf8") > MAX_CREDENTIAL_BYTES) throw new Error("The local credential is unexpectedly large.");
  let envelope: ProtectedCredentialEnvelope;
  if (process.platform === "win32") {
    envelope = {
      format: PROTECTED_FORMAT,
      version: 1,
      protection: "windows-dpapi-current-user",
      ciphertext: await protectForCurrentWindowsUser(source),
    };
  } else if (process.platform === "darwin") {
    envelope = await protectWithKeyring(safeName, source);
  } else if (process.platform === "linux") {
    try {
      envelope = await protectWithSystemdCredentials(safeName, source);
    } catch (systemdError) {
      try {
        envelope = await protectWithKeyring(safeName, source);
      } catch (secretServiceError) {
        const systemdMessage = systemdError instanceof Error ? systemdError.message : "systemd credential encryption failed";
        const secretServiceMessage = secretServiceError instanceof Error ? secretServiceError.message : "Secret Service encryption failed";
        throw new Error(`PlotPickle will not save credentials without Linux user encryption. ${systemdMessage} ${secretServiceMessage}`);
      }
    }
  } else {
    throw new Error("PlotPickle will not save credentials because encrypted storage is unsupported on this operating system.");
  }
  await atomicWrite(credentialFilePath(safeName), `${JSON.stringify(envelope, null, 2)}\n`);
}

export async function removeCredentialFile(name: string) {
  await rm(credentialFilePath(name), { force: true });
}

export async function credentialInventory() {
  let entries;
  try {
    entries = await readdir(credentialsDirectory(), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { path: credentialsDirectory(), files: [] as CredentialFileSummary[] };
    }
    throw error;
  }
  const files = await Promise.all(entries
    .filter((entry) => entry.isFile() && /^[a-z0-9][a-z0-9-]*\.json$/.test(entry.name))
    .map(async (entry): Promise<CredentialFileSummary> => {
      const filePath = credentialFilePath(entry.name);
      const [info, source] = await Promise.all([stat(filePath), readFile(filePath, "utf8")]);
      let protection: CredentialProtection = "legacy-plaintext";
      try {
        const value: unknown = JSON.parse(source);
        if (isProtectedEnvelope(value)) protection = value.protection;
      } catch { /* The owning gateway reports malformed JSON without exposing contents. */ }
      return { name: entry.name, bytes: info.size, protection };
    }));
  return { path: credentialsDirectory(), files: files.sort((left, right) => left.name.localeCompare(right.name)) };
}

export async function eraseAllCredentials() {
  const before = await credentialInventory();
  await rm(credentialsDirectory(), { recursive: true, force: true });
  try { await removePlatformMasterKey(); } catch { /* File removal remains complete even when the OS key store is offline. */ }
  return { path: before.path, removed: before.files.length };
}

export async function openCredentialsDirectory() {
  const directory = credentialsDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const executable = process.platform === "win32" ? "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const child = spawn(executable, [directory], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  await new Promise<void>((resolve, reject) => {
    child.once("spawn", () => resolve());
    child.once("error", () => reject(new Error(`No file browser could open ${directory}.`)));
  });
  child.unref();
  return directory;
}

export function defaultCredentialProtection(): CredentialProtection {
  if (process.platform === "linux") return "linux-systemd-creds-current-user";
  return expectedProtectionForPlatform() || "unsupported-platform";
}

export function credentialProtectionLabel(protection: CredentialProtection) {
  if (protection === "windows-dpapi-current-user") return "Encrypted for the current Windows user with DPAPI.";
  if (protection === "macos-keychain-current-user") return "Encrypted with a key held by the current user's macOS Keychain.";
  if (protection === "linux-secret-service-current-user") return "Encrypted with a key held by the current user's Linux Secret Service.";
  if (protection === "linux-systemd-creds-current-user") return "Encrypted with user-scoped systemd credentials on this Linux computer.";
  if (protection === "legacy-plaintext") return "Legacy plaintext credential; it will be migrated before use.";
  return "Encrypted credential storage is unavailable on this platform.";
}
