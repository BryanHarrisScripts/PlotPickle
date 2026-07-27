import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, open, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PROTECTED_FORMAT = "plotpickle-protected-credential";
const DPAPI_ENTROPY = "PlotPickle local credential v1";
const MAX_CREDENTIAL_BYTES = 2 * 1024 * 1024;

export type CredentialProtection = "windows-dpapi-current-user" | "account-file-permissions";

type ProtectedCredentialEnvelope = {
  format: typeof PROTECTED_FORMAT;
  version: 1;
  protection: "windows-dpapi-current-user";
  ciphertext: string;
};

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

function isProtectedEnvelope(value: unknown): value is ProtectedCredentialEnvelope {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ProtectedCredentialEnvelope>;
  return item.format === PROTECTED_FORMAT
    && item.version === 1
    && item.protection === "windows-dpapi-current-user"
    && typeof item.ciphertext === "string"
    && item.ciphertext.length > 0;
}

function powerShell(script: string, input: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      script,
    ], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    let stdoutBytes = 0;
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes <= MAX_CREDENTIAL_BYTES * 2) stdout.push(chunk);
    });
    child.on("error", () => reject(new Error("Windows credential encryption could not start.")));
    child.on("close", (code) => {
      if (code === 0 && stdoutBytes <= MAX_CREDENTIAL_BYTES * 2) {
        resolve(Buffer.concat(stdout).toString("utf8").trim());
        return;
      }
      reject(new Error("Windows credential encryption failed."));
    });
    child.stdin.on("error", () => { /* The process error or exit handler reports the failure. */ });
    child.stdin.end(input, "utf8");
  });
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
  try { await chmod(filePath, 0o600); } catch { /* Windows uses current-account ACLs in addition to DPAPI. */ }
}

export async function readCredentialJson<T>(name: string): Promise<T | null> {
  const filePath = credentialFilePath(name);
  try {
    const source = await readFile(filePath, "utf8");
    if (Buffer.byteLength(source, "utf8") > MAX_CREDENTIAL_BYTES) throw new Error("The local credential file is unexpectedly large.");
    const stored: unknown = JSON.parse(source);
    if (!isProtectedEnvelope(stored)) {
      if (process.platform === "win32") await writeCredentialJson(name, stored);
      return stored as T;
    }
    if (process.platform !== "win32") throw new Error("This credential is protected for a Windows user account and cannot be read on this platform.");
    return JSON.parse(await unprotectForCurrentWindowsUser(stored.ciphertext)) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeCredentialJson(name: string, value: unknown) {
  const source = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(source, "utf8") > MAX_CREDENTIAL_BYTES) throw new Error("The local credential is unexpectedly large.");
  if (process.platform === "win32") {
    const envelope: ProtectedCredentialEnvelope = {
      format: PROTECTED_FORMAT,
      version: 1,
      protection: "windows-dpapi-current-user",
      ciphertext: await protectForCurrentWindowsUser(source),
    };
    await atomicWrite(credentialFilePath(name), `${JSON.stringify(envelope, null, 2)}\n`);
    return;
  }
  await atomicWrite(credentialFilePath(name), source);
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
      let protection: CredentialProtection = "account-file-permissions";
      try {
        if (isProtectedEnvelope(JSON.parse(source))) protection = "windows-dpapi-current-user";
      } catch { /* The owning gateway will report malformed JSON without exposing its contents. */ }
      return { name: entry.name, bytes: info.size, protection };
    }));
  return { path: credentialsDirectory(), files: files.sort((left, right) => left.name.localeCompare(right.name)) };
}

export async function eraseAllCredentials() {
  const before = await credentialInventory();
  await rm(credentialsDirectory(), { recursive: true, force: true });
  return { path: before.path, removed: before.files.length };
}

export async function openCredentialsDirectory() {
  const directory = credentialsDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const command = process.platform === "win32" ? "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const child = spawn(command, [directory], {
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
  return process.platform === "win32" ? "windows-dpapi-current-user" : "account-file-permissions";
}
