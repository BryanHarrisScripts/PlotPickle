import { createHash } from "node:crypto";

export const AUTONOMOUS_GUEST_AUTHORITY_CLASS = "delegated-guest-autonomous-operator" as const;

export type AutonomousGuestAuthority = Readonly<{
  active: true;
  authorityClass: typeof AUTONOMOUS_GUEST_AUTHORITY_CLASS;
  delegated: true;
  humanProfileId: "";
  workspaceId: string;
  autonomousRunId: string;
  operatorId: string;
  accessMode: "desktop-loopback";
}>;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{2,179}$/i;

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function requiredId(value: string | undefined, label: string) {
  const normalized = String(value || "").trim();
  if (!SAFE_ID.test(normalized)) throw new Error(`Autonomous Guest ${label} is missing or invalid.`);
  return normalized;
}

function workspaceId(runId: string, operatorId: string) {
  const digest = createHash("sha256").update(`${runId}\n${operatorId}`).digest("hex").slice(0, 24);
  return `guest-auto-${digest}`;
}

export function getAutonomousGuestAuthority(origin: string, accessMode: "desktop-loopback" | "server-network"): AutonomousGuestAuthority | null {
  if (!enabled(process.env.PLOTPICKLE_AUTONOMOUS_GUEST_ENABLED)) return null;
  if (accessMode !== "desktop-loopback") {
    throw new Error("Autonomous Guest authority is available only on a desktop-loopback PlotPickle process.");
  }
  const target = new URL(origin);
  if (target.protocol !== "http:" || !LOOPBACK_HOSTS.has(target.hostname)) {
    throw new Error("Autonomous Guest authority requires a local loopback origin.");
  }
  const autonomousRunId = requiredId(process.env.PLOTPICKLE_AUTONOMOUS_RUN_ID, "run ID");
  const operatorId = requiredId(process.env.PLOTPICKLE_AUTONOMOUS_OPERATOR_ID, "operator ID");
  return Object.freeze({
    active: true,
    authorityClass: AUTONOMOUS_GUEST_AUTHORITY_CLASS,
    delegated: true,
    humanProfileId: "",
    workspaceId: workspaceId(autonomousRunId, operatorId),
    autonomousRunId,
    operatorId,
    accessMode: "desktop-loopback",
  });
}
