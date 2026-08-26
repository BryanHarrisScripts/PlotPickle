import { spawn } from "node:child_process";
import { resolveBuzzCliExecutable } from "../buzz-desktop-discovery";
import { readCredentialJson } from "../local-credentials";

const CONNECTION_FILE = "buzz-connection.json";
const MAX_OUTPUT = 2 * 1024 * 1024;
const MEMBERSHIP_CONFIRM_ATTEMPTS = 8;
const MEMBERSHIP_CONFIRM_DELAY_MS = 750;

type BuzzConnection = {
  readonly version: 1;
  readonly relayUrl: string;
  readonly cliPath: string;
  readonly privateKey: string;
};

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "The BUZZ Story Room membership operation failed.")
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/\b[a-f0-9]{64}\b/gi, "[redacted-key]")
    .replace(/(password|secret|private[_ -]?key|token)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 700);
}

function validConnection(value: unknown): value is BuzzConnection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<BuzzConnection>;
  return item.version === 1
    && typeof item.relayUrl === "string"
    && typeof item.cliPath === "string"
    && typeof item.privateKey === "string"
    && Boolean(item.privateKey);
}

function validChannel(value: string) {
  if (!/^[A-Za-z0-9-]{8,128}$/.test(value)) throw new Error("The private BUZZ Story Room identifier is invalid.");
  return value;
}

function validPubkey(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error("The approved BUZZ Agent signer is invalid.");
  return normalized;
}

function runJson(executable: string, args: string[], connection: BuzzConnection) {
  const relay = new URL(connection.relayUrl);
  if (relay.protocol === "ws:") relay.protocol = "http:";
  if (relay.protocol === "wss:") relay.protocol = "https:";
  const relayUrl = relay.toString().replace(/\/$/, "");
  return new Promise<unknown>((resolve, reject) => {
    const child = spawn(executable, args, {
      env: {
        ...process.env,
        BUZZ_RELAY_URL: relayUrl,
        BUZZ_PRIVATE_KEY: connection.privateKey,
      },
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
      reject(new Error("BUZZ did not finish the private Story Room membership check within 30 seconds."));
    }, 30_000);
    const collect = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes <= MAX_OUTPUT) target.push(chunk);
      else if (!settled) {
        settled = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        reject(new Error("BUZZ returned too much Story Room membership data."));
      }
    };
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.once("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("The BUZZ CLI could not start for the private Story Room membership check."));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const output = Buffer.concat(stdout).toString("utf8").trim();
      const errorOutput = Buffer.concat(stderr).toString("utf8").trim();
      if ((code ?? 1) !== 0) {
        reject(new Error(safeError(errorOutput || output || `BUZZ exited with code ${code}.`)));
        return;
      }
      try {
        resolve(JSON.parse(output || "null"));
      } catch {
        reject(new Error("BUZZ returned invalid Story Room membership JSON."));
      }
    });
  });
}

function memberPubkeys(value: unknown) {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { members?: unknown[] }).members)
      ? (value as { members: unknown[] }).members
      : [];
  return rows.flatMap((item) => typeof item === "string" && /^[a-f0-9]{64}$/i.test(item.trim())
    ? [item.trim().toLowerCase()]
    : []);
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForMembership(readMembers: () => Promise<string[]>, agentPubkey: string) {
  for (let attempt = 0; attempt < MEMBERSHIP_CONFIRM_ATTEMPTS; attempt += 1) {
    const members = await readMembers();
    if (members.includes(agentPubkey)) return true;
    if (attempt + 1 < MEMBERSHIP_CONFIRM_ATTEMPTS) await delay(MEMBERSHIP_CONFIRM_DELAY_MS);
  }
  return false;
}

export async function ensurePrivateBuzzAgentMembership(input: {
  readonly channelId: string;
  readonly agentPubkey: string;
}) {
  const channelId = validChannel(input.channelId);
  const agentPubkey = validPubkey(input.agentPubkey);
  const connection = await readCredentialJson<unknown>(CONNECTION_FILE);
  if (!validConnection(connection)) {
    throw new Error("PlotPickle does not have a verified Human BUZZ transport identity for private Story Room membership. Reconnect BUZZ in Settings and test the connection.");
  }
  const resolution = await resolveBuzzCliExecutable(connection.cliPath);
  const readMembers = async () => memberPubkeys(await runJson(
    resolution.executable,
    ["channels", "members", "--channel", channelId],
    connection,
  ));
  const existing = await readMembers();
  if (existing.includes(agentPubkey)) return { added: false, role: "bot" as const };

  await runJson(
    resolution.executable,
    ["channels", "add-member", "--channel", channelId, "--pubkey", agentPubkey, "--role", "bot"],
    connection,
  );
  const confirmed = await waitForMembership(readMembers, agentPubkey);
  if (!confirmed) {
    throw new Error("BUZZ did not confirm the approved Agent as a private Story Room member after bounded membership verification.");
  }
  return { added: true, role: "bot" as const };
}
