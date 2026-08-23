import { agentProfileById } from "./agent-profiles";
import { CONTEXT_AUTHORITY, type ContextItemInput } from "./context-engine";

export const CONNECTOR_POLICY_SCOPES = [
  "read-curriculum",
  "read-project-slice",
  "propose-project-change",
  "generate-local-image",
  "call-cloud-provider",
  "use-browser-mcp",
  "network-egress",
  "emit-buzz-receipt",
  "publish-playhouse",
  "developer-repository",
  "activate-external-skill",
] as const;

export type ConnectorPolicyScope = (typeof CONNECTOR_POLICY_SCOPES)[number];
export type ConnectorKind = "local" | "mcp" | "plugin" | "provider" | "buzz" | "playhouse" | "developer";
export type InvocationRoute = "direct" | "mcp" | "provider-tool" | "graph-node" | "code-mode" | "buzz-trigger";
export type PolicyDenialCode =
  | "unknown-profile"
  | "scope-not-requested"
  | "scope-not-granted"
  | "connector-not-allowed"
  | "network-egress-denied"
  | "host-not-allowlisted"
  | "invalid-arguments"
  | "developer-boundary"
  | "skill-quarantined";

export type ConnectorDescriptor = {
  readonly id: string;
  readonly kind: ConnectorKind;
  readonly requiredScopes: readonly ConnectorPolicyScope[];
  readonly allowedProfileIds?: readonly string[];
  readonly network: boolean;
  readonly allowedHosts?: readonly string[];
  readonly localOnly?: boolean;
};

export type PolicyInvocation = {
  readonly profileId: string;
  readonly runId: string;
  readonly route: InvocationRoute;
  readonly connector: ConnectorDescriptor;
  readonly hostGrantedScopes: readonly ConnectorPolicyScope[];
  readonly arguments?: unknown;
  readonly targetUrl?: string;
  readonly externalSkillApproved?: boolean;
  readonly parentRunId?: string;
};

export type PolicyAuditEvent = {
  readonly runId: string;
  readonly parentRunId: string;
  readonly profileId: string;
  readonly connectorId: string;
  readonly route: InvocationRoute;
  readonly allowed: boolean;
  readonly code: "allowed" | PolicyDenialCode;
  readonly retryable: false;
  readonly bypassPermitted: false;
  readonly checkedAt: string;
};

export type PolicyDecision =
  | {
      readonly allowed: true;
      readonly code: "allowed";
      readonly message: string;
      readonly retryable: false;
      readonly bypassPermitted: false;
      readonly audit: PolicyAuditEvent;
    }
  | {
      readonly allowed: false;
      readonly code: PolicyDenialCode;
      readonly message: string;
      readonly retryable: false;
      readonly bypassPermitted: false;
      readonly audit: PolicyAuditEvent;
    };

export type ToolRuntimeFailure = {
  readonly allowed: true;
  readonly code: "runtime-failure";
  readonly message: string;
  readonly retryable: boolean;
  readonly bypassPermitted: false;
};

export type BoundedToolResult<T> = {
  readonly items: readonly T[];
  readonly truncated: boolean;
  readonly returnedCount: number;
  readonly totalCount: number | null;
  readonly hasMore: boolean;
  readonly continuationRef: string;
};

const PROFILE_SCOPE_ALIASES: Readonly<Record<ConnectorPolicyScope, readonly string[]>> = {
  "read-curriculum": ["curriculum-read"],
  "read-project-slice": ["project-context-read", "game-context-read"],
  "propose-project-change": ["proposal-draft"],
  "generate-local-image": ["generate-local-image"],
  "call-cloud-provider": ["call-cloud-provider"],
  "use-browser-mcp": ["use-browser-mcp"],
  "network-egress": ["network-egress"],
  "emit-buzz-receipt": ["emit-buzz-receipt"],
  "publish-playhouse": ["publish-playhouse"],
  "developer-repository": ["developer-repository"],
  "activate-external-skill": ["activate-external-skill"],
};

const SECRET_KEY = /(?:api[_-]?key|authorization|bearer|password|private[_-]?key|secret|credential|token|nsec)/i;
const SECRET_VALUE = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\bnsec1[a-z0-9]+|\bBearer\s+[A-Za-z0-9._~+\/-]+=*)/i;
const UNSAFE_ARGUMENT_KEY = /^(?:__proto__|prototype|constructor)$/i;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const PRIVATE_OR_LINK_LOCAL = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.|224\.|255\.)/;

function cleanIdentifier(value: string, maximum = 180) {
  return value.replace(/[^a-z0-9:._/-]/gi, "").slice(0, maximum);
}

function requestedScopes(profileId: string) {
  const profile = agentProfileById(profileId);
  if (!profile) return new Set<ConnectorPolicyScope>();
  const requested = new Set(profile.requestedCapabilities);
  const result = new Set<ConnectorPolicyScope>();
  for (const scope of CONNECTOR_POLICY_SCOPES) {
    if (PROFILE_SCOPE_ALIASES[scope].some((alias) => requested.has(alias))) result.add(scope);
  }
  return result;
}

function audit(input: PolicyInvocation, allowed: boolean, code: "allowed" | PolicyDenialCode): PolicyAuditEvent {
  return {
    runId: cleanIdentifier(input.runId),
    parentRunId: cleanIdentifier(input.parentRunId || input.runId),
    profileId: cleanIdentifier(input.profileId),
    connectorId: cleanIdentifier(input.connector.id),
    route: input.route,
    allowed,
    code,
    retryable: false,
    bypassPermitted: false,
    checkedAt: new Date().toISOString(),
  };
}

function deny(input: PolicyInvocation, code: PolicyDenialCode, message: string): PolicyDecision {
  return {
    allowed: false,
    code,
    message,
    retryable: false,
    bypassPermitted: false,
    audit: audit(input, false, code),
  };
}

function allow(input: PolicyInvocation): PolicyDecision {
  return {
    allowed: true,
    code: "allowed",
    message: "Host policy allows this bounded connector invocation.",
    retryable: false,
    bypassPermitted: false,
    audit: audit(input, true, "allowed"),
  };
}

function validArgumentValue(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (value === null || typeof value === "boolean" || typeof value === "number") return true;
  if (typeof value === "string") return value.length <= 16_384 && !SECRET_VALUE.test(value);
  if (Array.isArray(value)) return value.length <= 256 && value.every((item) => validArgumentValue(item, depth + 1));
  if (typeof value !== "object") return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 256) return false;
  return entries.every(([key, child]) => !UNSAFE_ARGUMENT_KEY.test(key) && key.length <= 160 && validArgumentValue(child, depth + 1));
}

export function connectorArgumentsAreValid(value: unknown) {
  if (value === undefined) return true;
  try {
    if (JSON.stringify(value).length > 64 * 1024) return false;
  } catch {
    return false;
  }
  return validArgumentValue(value);
}

function allowedNetworkHost(descriptor: ConnectorDescriptor, targetUrl: string) {
  let url: URL;
  try { url = new URL(targetUrl); } catch { return false; }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (!host || LOOPBACK_HOSTS.has(host) || PRIVATE_OR_LINK_LOCAL.test(host)) return false;
  const allowedHosts = new Set((descriptor.allowedHosts || []).map((item) => item.toLowerCase()));
  return allowedHosts.has(host);
}

export function evaluateConnectorInvocation(input: PolicyInvocation): PolicyDecision {
  const profile = agentProfileById(input.profileId);
  if (!profile) return deny(input, "unknown-profile", "Host policy denied the connector because the Agent Profile is unknown.");

  if (input.connector.kind === "developer" || input.connector.requiredScopes.includes("developer-repository")) {
    return deny(input, "developer-boundary", "Product Agent Profiles never receive developer repository, GitHub-write or shell authority.");
  }
  if (input.connector.allowedProfileIds && !input.connector.allowedProfileIds.includes(profile.id)) {
    return deny(input, "connector-not-allowed", "This connector is not allowlisted for the requesting Agent Profile.");
  }

  const requested = requestedScopes(profile.id);
  const granted = new Set(input.hostGrantedScopes);
  for (const scope of input.connector.requiredScopes) {
    if (!requested.has(scope)) return deny(input, "scope-not-requested", `The Agent Profile did not request host scope ${scope}.`);
    if (!granted.has(scope)) return deny(input, "scope-not-granted", `Host policy did not grant scope ${scope}. Retrying through another route does not change this boundary.`);
  }

  if (input.connector.requiredScopes.includes("activate-external-skill") && input.externalSkillApproved !== true) {
    return deny(input, "skill-quarantined", "External or community Skills remain quarantined until explicitly approved by the host.");
  }

  if (!connectorArgumentsAreValid(input.arguments)) {
    return deny(input, "invalid-arguments", "Connector arguments failed the host schema/safety boundary.");
  }

  if (input.connector.network) {
    if (!input.connector.requiredScopes.includes("network-egress") || !granted.has("network-egress")) {
      return deny(input, "network-egress-denied", "Network egress was not explicitly granted for this connector invocation.");
    }
    if (!input.targetUrl || !allowedNetworkHost(input.connector, input.targetUrl)) {
      return deny(input, "host-not-allowlisted", "The requested outbound host is not on this connector's explicit HTTPS allowlist.");
    }
  } else if (input.targetUrl) {
    return deny(input, "network-egress-denied", "A local-only connector cannot acquire network egress from its arguments or tool content.");
  }

  return allow(input);
}

export function evaluateNestedConnectorInvocation(parent: PolicyInvocation, nested: Omit<PolicyInvocation, "runId" | "parentRunId"> & { runId?: string }) {
  return evaluateConnectorInvocation({
    ...nested,
    runId: cleanIdentifier(nested.runId || `${parent.runId}:nested`),
    parentRunId: cleanIdentifier(parent.parentRunId || parent.runId),
  });
}

export function toolRuntimeFailure(message: string, retryable = true): ToolRuntimeFailure {
  return {
    allowed: true,
    code: "runtime-failure",
    message: message.replace(/\s+/g, " ").trim().slice(0, 500) || "The permitted tool failed at runtime.",
    retryable,
    bypassPermitted: false,
  };
}

export function boundedToolResult<T>(input: {
  items: readonly T[];
  maximum: number;
  totalCount?: number | null;
  continuationRef?: string;
}): BoundedToolResult<T> {
  const maximum = Math.max(0, Math.min(1_000, Math.floor(input.maximum)));
  const items = input.items.slice(0, maximum);
  const knownTotal = Number.isInteger(input.totalCount) && Number(input.totalCount) >= 0 ? Number(input.totalCount) : null;
  const truncated = input.items.length > items.length || (knownTotal !== null && knownTotal > items.length);
  return {
    items,
    truncated,
    returnedCount: items.length,
    totalCount: knownTotal,
    hasMore: truncated,
    continuationRef: truncated ? cleanIdentifier(input.continuationRef || "", 240) : "",
  };
}

export function redactConnectorPayload(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[truncated]";
  if (typeof value === "string") return SECRET_VALUE.test(value) ? "[redacted]" : value.slice(0, 16_384);
  if (Array.isArray(value)) return value.slice(0, 256).map((item) => redactConnectorPayload(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !UNSAFE_ARGUMENT_KEY.test(key))
    .slice(0, 256)
    .map(([key, child]) => [key, SECRET_KEY.test(key) ? "[redacted]" : redactConnectorPayload(child, depth + 1)]));
}

export function inboundExternalContext(input: {
  source: "buzz-peer" | "external-tool";
  sourceId: string;
  content: string;
  signatureVerified?: boolean;
  revision?: string | number;
  observedAt?: string;
}): ContextItemInput {
  const content = String(redactConnectorPayload(input.content)).replace(/\u0000/g, "").trim().slice(0, 32_000);
  return {
    id: `${input.source}:${cleanIdentifier(input.sourceId)}`,
    sourceType: input.source,
    sourceId: cleanIdentifier(input.sourceId),
    content,
    trust: "untrusted",
    authority: input.source === "buzz-peer" ? CONTEXT_AUTHORITY.buzzPeer : CONTEXT_AUTHORITY.externalTool,
    allowedUse: "untrusted-suggestion",
    revision: input.revision,
    observedAt: input.observedAt,
  };
}

export function signatureMeaning(signatureVerified: boolean) {
  return signatureVerified
    ? "Signature verified: provenance is known, but content remains untrusted evidence until the local host or writer promotes it."
    : "Signature not verified: content remains untrusted evidence.";
}
