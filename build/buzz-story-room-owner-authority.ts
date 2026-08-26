import { spawn } from "node:child_process";
import { publicKeyFromPrivateKey } from "./buzz-key-identity";
import { redactBuzzDiagnostic } from "./buzz-cli-failure";
import { resolveBuzzCliExecutable } from "./buzz-desktop-discovery";
import { readCredentialJson } from "./local-credentials";

const CONNECTION_FILE = "buzz-connection.json";
const MAX_OUTPUT = 1024 * 1024;

type BuzzConnection = {
  verificationVersion?: number;
  verifiedAt?: string;
  relayUrl?: string;
  cliPath?: string;
  privateKey?: string;
  identityPubkey?: string;
  identityRole?: "human";
};

type CommandResult = { stdout: string; stderr: string; code: number };

type ChannelMember = {
  pubkey: string;
  role: string;
};

function validChannelId(value: string) {
  if (!/^[A-Za-z0-9-]{8,128}$/.test(value)) throw new Error("The mapped BUZZ Story Room identifier is invalid.");
  return value;
}

function validPubkey(value: string) {
  const pubkey = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(pubkey)) throw new Error("The verified Human BUZZ public identity is invalid.");
  return pubkey;
}

function connectionFrom(value: unknown): BuzzConnection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as BuzzConnection;
}

function relayHttpUrl(value: string) {
  const url = new URL(value);
  if (url.protocol === "ws:") url.protocol = "http:";
  if (url.protocol === "wss:") url.protocol = "https:";
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("The saved BUZZ relay address is invalid.");
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function rows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  for (const key of ["members", "items", "data", "results"]) {
    if (Array.isArray(item[key])) return item[key] as unknown[];
  }
  return [];
}

function channelMembers(value: unknown): ChannelMember[] {
  return rows(value).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const pubkey = typeof item.pubkey === "string" ? item.pubkey.trim().toLowerCase() : "";
    const role = typeof item.role === "string" ? item.role.trim().toLowerCase() : "";
    if (!/^[a-f0-9]{64}$/.test(pubkey) || !["owner", "admin", "member", "guest", "bot"].includes(role)) return [];
    return [{ pubkey, role }];
  });
}

function command(executable: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(executable, args, {
      env: { ...process.env, ...env },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error("BUZZ did not finish the Story Room owner check within 20 seconds."));
    }, 20_000);
    const collect = (target: Buffer[], chunk: Buffer) => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT) {
        settled = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        reject(new Error("BUZZ returned too much Story Room owner data."));
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.once("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("BUZZ CLI could not start for the Story Room owner check."));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8").trim(),
        stderr: Buffer.concat(stderr).toString("utf8").trim(),
        code: code ?? 1,
      };
      if (result.code !== 0) {
        reject(new Error(redactBuzzDiagnostic(result.stderr || result.stdout || `BUZZ CLI exited with code ${result.code}.`)));
      } else resolve(result);
    });
  });
}

export async function assertBuzzStoryRoomOwner(channelValue: string, expectedPubkeyValue: string) {
  const channelId = validChannelId(channelValue);
  const expectedPubkey = validPubkey(expectedPubkeyValue);
  const connection = connectionFrom(await readCredentialJson<unknown>(CONNECTION_FILE));
  const privateKey = typeof connection?.privateKey === "string" ? connection.privateKey : "";
  const signerPubkey = publicKeyFromPrivateKey(privateKey);
  const boundPubkey = typeof connection?.identityPubkey === "string" ? connection.identityPubkey.trim().toLowerCase() : "";
  if (!connection
    || connection.verificationVersion !== 2
    || !connection.verifiedAt
    || connection.identityRole !== "human"
    || signerPubkey !== expectedPubkey
    || boundPubkey !== expectedPubkey
    || typeof connection.relayUrl !== "string"
    || typeof connection.cliPath !== "string") {
    throw new Error("Re-verify the intended Human BUZZ identity before changing Story Room publication.");
  }

  const resolution = await resolveBuzzCliExecutable(connection.cliPath);
  const result = await command(resolution.executable, ["channels", "members", "--channel", channelId], {
    BUZZ_RELAY_URL: relayHttpUrl(connection.relayUrl),
    BUZZ_PRIVATE_KEY: privateKey,
  });
  let decoded: unknown;
  try {
    decoded = JSON.parse(result.stdout || "null") as unknown;
  } catch {
    throw new Error("BUZZ returned invalid Story Room membership data.");
  }
  const membership = channelMembers(decoded).find((member) => member.pubkey === expectedPubkey);
  if (!membership || membership.role !== "owner") {
    throw new Error("Only the verified BUZZ Story Room owner can change its directory listing. PlotPickle did not publish anything.");
  }
  return { pubkey: expectedPubkey, role: "owner" as const };
}
