import { agentProfileById, type AgentProfileCapabilityRole } from "./agent-profiles";
import type { ConnectorPolicyScope } from "./connector-trust-policy";
import {
  createResponsibilityRun,
  type ResponsibilityRun,
  type ResponsibilityRunLimits,
  type ResponsibilityVerificationMode,
} from "./responsibility-runs";

export const GRAPH_OUTCOME_ROUTES = ["pass", "retry", "reroute", "escalate", "stop"] as const;
export type GraphOutcomeRoute = (typeof GRAPH_OUTCOME_ROUTES)[number];
export type GraphNodeStatus = "queued" | "running" | "passed" | "failed" | "rerouted" | "escalated" | "stopped" | "cancelled";
export type GraphVerificationMode = "deterministic" | "fresh-verifier" | "writer";

export type StructuredObjectSchema = {
  type: "object";
  required: string[];
  allowed: string[];
  maxBytes: number;
};

export type GraphDependency = {
  sourceNodeId: string;
  outputFields: string[];
  inputKeys: string[];
  reason: string;
};

export type GraphNodeIsolation = {
  mode: "none" | "git-worktree" | "proposal-revision";
  workspaceId: string;
};

export type GraphNodeVerification = {
  mode: GraphVerificationMode;
  verifierProfileId: string;
  evidenceRequired: boolean;
};

export type GraphNodeContract = {
  id: string;
  job: string;
  profileId: string;
  workerType: "product-agent" | "developer-worker" | "deterministic";
  capabilityRole: AgentProfileCapabilityRole | null;
  allowedScopes: ConnectorPolicyScope[];
  allowedConnectorIds: string[];
  inputSchema: StructuredObjectSchema;
  outputSchema: StructuredObjectSchema;
  dependencies: GraphDependency[];
  exclusiveResources: string[];
  isolation: GraphNodeIsolation;
  timeoutMs: number;
  tokenBudget: number;
  cloudCostBudgetUsd: number;
  maxRetries: number;
  failureRoutes: Record<GraphOutcomeRoute, "continue" | "retry" | "reroute" | "human" | "stop">;
  verification: GraphNodeVerification;
};

export type ResponsibilityGraphLimits = {
  maxNodes: number;
  maxParallelism: number;
  maxRounds: number;
  maxTokens: number;
  maxContextCharacters: number;
  maxCloudCostUsd: number;
  maxRawFanInBytes: number;
};

export type ResponsibilityGraphDefinition = {
  version: 1;
  graphId: string;
  parentRunId: string;
  goal: string;
  nodes: GraphNodeContract[];
  limits: ResponsibilityGraphLimits;
};

export type GraphNodeEvidence = {
  rule: string;
  target: string;
  evidenceRef: string;
  summary: string;
};

export type GraphNodeResult = {
  nodeId: string;
  route: GraphOutcomeRoute;
  output: Record<string, unknown>;
  evidence: GraphNodeEvidence[];
  failedRule: string;
  target: string;
  summary: string;
  producedByProfileId: string;
  verifiedByProfileId: string;
  generatedAt: string;
};

export type GraphNodeExecution = {
  nodeId: string;
  status: GraphNodeStatus;
  retryCount: number;
  startedAt: string;
  completedAt: string;
  lastRoute: GraphOutcomeRoute | "";
  result: GraphNodeResult | null;
};

export type ResponsibilityGraphState = {
  version: 1;
  graphId: string;
  parentRunId: string;
  round: number;
  noNewFindingRounds: number;
  state: "queued" | "working" | "waiting" | "completed" | "failed" | "stopped";
  executions: GraphNodeExecution[];
  tokensUsed: number;
  contextCharactersUsed: number;
  cloudCostUsd: number;
  stopReason: string;
  updatedAt: string;
};

export type GraphFanInResult = {
  complete: boolean;
  partial: boolean;
  expectedCount: number;
  receivedCount: number;
  missingNodeIds: string[];
  failedNodeIds: string[];
  records: Array<{ nodeId: string; output: Record<string, unknown>; evidence: GraphNodeEvidence[] }>;
};

export type GraphDiscoveryState = {
  round: number;
  noNewRounds: number;
  uniqueFindingIds: string[];
  stop: boolean;
  stopReason: string;
};

function text(value: unknown, max = 600) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function strings(values: readonly string[] | undefined, max = 128, itemMax = 180) {
  return [...new Set((values || []).map((value) => text(value, itemMax)).filter(Boolean))].slice(0, max);
}

function bytes(value: unknown) {
  try { return new TextEncoder().encode(JSON.stringify(value)).length; } catch { return Number.MAX_SAFE_INTEGER; }
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.floor(number))) : fallback;
}

export function normalizeResponsibilityGraphLimits(input: Partial<ResponsibilityGraphLimits> = {}): ResponsibilityGraphLimits {
  const cost = Number(input.maxCloudCostUsd);
  return {
    maxNodes: boundedInteger(input.maxNodes, 24, 1, 256),
    maxParallelism: boundedInteger(input.maxParallelism, 4, 1, 32),
    maxRounds: boundedInteger(input.maxRounds, 4, 1, 32),
    maxTokens: boundedInteger(input.maxTokens, 64_000, 1_000, 4_000_000),
    maxContextCharacters: boundedInteger(input.maxContextCharacters, 96_000, 2_000, 1_000_000),
    maxCloudCostUsd: Number.isFinite(cost) ? Math.max(0, Math.min(5_000, Number(cost.toFixed(4)))) : 0,
    maxRawFanInBytes: boundedInteger(input.maxRawFanInBytes, 64 * 1024, 2_000, 2 * 1024 * 1024),
  };
}

export function validateStructuredObject(schema: StructuredObjectSchema, value: unknown) {
  if (!object(value)) return { ok: false, error: "Expected a structured object." };
  const keys = Object.keys(value);
  const allowed = new Set(schema.allowed);
  if (keys.some((key) => !allowed.has(key))) return { ok: false, error: "Structured result contains an undeclared field." };
  if (schema.required.some((key) => !Object.hasOwn(value, key))) return { ok: false, error: "Structured result is missing a required field." };
  if (bytes(value) > schema.maxBytes) return { ok: false, error: "Structured result exceeds its node byte budget." };
  return { ok: true, error: "" };
}

function normalizeSchema(schema: StructuredObjectSchema): StructuredObjectSchema {
  const allowed = strings(schema.allowed, 128, 120);
  const required = strings(schema.required, 128, 120).filter((key) => allowed.includes(key));
  return { type: "object", required, allowed, maxBytes: boundedInteger(schema.maxBytes, 16_384, 256, 512 * 1024) };
}

export function normalizeGraphNode(node: GraphNodeContract): GraphNodeContract {
  return {
    ...node,
    id: text(node.id, 160),
    job: text(node.job, 1_000),
    allowedScopes: [...new Set(node.allowedScopes || [])],
    allowedConnectorIds: strings(node.allowedConnectorIds, 128, 180),
    inputSchema: normalizeSchema(node.inputSchema),
    outputSchema: normalizeSchema(node.outputSchema),
    dependencies: (node.dependencies || []).map((dependency) => ({
      sourceNodeId: text(dependency.sourceNodeId, 160),
      outputFields: strings(dependency.outputFields, 64, 120),
      inputKeys: strings(dependency.inputKeys, 64, 120),
      reason: text(dependency.reason, 400),
    })),
    exclusiveResources: strings(node.exclusiveResources, 64, 180),
    isolation: { mode: node.isolation?.mode || "none", workspaceId: text(node.isolation?.workspaceId, 240) },
    timeoutMs: boundedInteger(node.timeoutMs, 10 * 60_000, 10_000, 12 * 60 * 60_000),
    tokenBudget: boundedInteger(node.tokenBudget, 12_000, 500, 1_000_000),
    cloudCostBudgetUsd: Math.max(0, Math.min(1_000, Number(node.cloudCostBudgetUsd) || 0)),
    maxRetries: boundedInteger(node.maxRetries, 1, 0, 8),
    verification: {
      mode: node.verification?.mode || "deterministic",
      verifierProfileId: text(node.verification?.verifierProfileId, 160),
      evidenceRequired: node.verification?.evidenceRequired !== false,
    },
  };
}

export function validateResponsibilityGraph(definition: ResponsibilityGraphDefinition, parentRun?: ResponsibilityRun) {
  const errors: string[] = [];
  const limits = normalizeResponsibilityGraphLimits(definition.limits);
  if (!text(definition.graphId, 160)) errors.push("Graph ID is required.");
  if (!text(definition.parentRunId, 180)) errors.push("Parent Responsibility Run ID is required.");
  if (!text(definition.goal, 1_000)) errors.push("Graph goal is required.");
  if (!Array.isArray(definition.nodes) || definition.nodes.length === 0) errors.push("Graph requires at least one node.");
  if (definition.nodes.length > limits.maxNodes) errors.push("Graph node count exceeds the host cap.");
  const nodes = definition.nodes.map(normalizeGraphNode);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (byId.size !== nodes.length) errors.push("Graph node IDs must be unique.");

  for (const node of nodes) {
    if (!node.id || !node.job) errors.push("Every graph node requires an ID and one bounded job.");
    if (!agentProfileById(node.profileId)) errors.push(`Graph node ${node.id} has an unknown Agent Profile.`);
    if (!node.inputSchema.allowed.length && node.inputSchema.required.length) errors.push(`Graph node ${node.id} has an invalid input schema.`);
    if (!node.outputSchema.allowed.length && node.outputSchema.required.length) errors.push(`Graph node ${node.id} has an invalid output schema.`);
    if (node.workerType === "developer-worker" && node.isolation.mode !== "git-worktree") errors.push(`Developer node ${node.id} requires isolated git-worktree execution.`);
    if (node.workerType === "product-agent" && node.isolation.mode === "git-worktree") errors.push(`Product node ${node.id} cannot inherit a developer worktree.`);
    if (node.verification.mode === "fresh-verifier" && (!node.verification.verifierProfileId || node.verification.verifierProfileId === node.profileId)) {
      errors.push(`Graph node ${node.id} requires a different fresh verifier profile.`);
    }
    if (node.cloudCostBudgetUsd > 0 && limits.maxCloudCostUsd <= 0) errors.push(`Graph node ${node.id} cannot silently enable paid cloud usage.`);
    for (const dependency of node.dependencies) {
      const source = byId.get(dependency.sourceNodeId);
      if (!source) { errors.push(`Graph node ${node.id} depends on missing node ${dependency.sourceNodeId}.`); continue; }
      if (!dependency.reason || !dependency.outputFields.length || dependency.outputFields.length !== dependency.inputKeys.length) {
        errors.push(`Graph edge ${dependency.sourceNodeId} -> ${node.id} must represent a real structured data dependency.`);
        continue;
      }
      if (dependency.outputFields.some((field) => !source.outputSchema.allowed.includes(field))) errors.push(`Graph edge ${dependency.sourceNodeId} -> ${node.id} requests undeclared output.`);
      if (dependency.inputKeys.some((field) => !node.inputSchema.allowed.includes(field))) errors.push(`Graph edge ${dependency.sourceNodeId} -> ${node.id} targets undeclared input.`);
    }
  }

  if (parentRun) {
    if (parentRun.runId !== definition.parentRunId) errors.push("Graph parent Run does not match the definition.");
    if (limits.maxParallelism > parentRun.limits.maxParallelChildren) errors.push("Graph parallelism exceeds the parent Responsibility Run child cap.");
    if (limits.maxTokens > parentRun.limits.maxTokens) errors.push("Graph token budget exceeds the parent Responsibility Run budget.");
    if (limits.maxContextCharacters > parentRun.limits.maxContextCharacters) errors.push("Graph context budget exceeds the parent Responsibility Run budget.");
    if (limits.maxCloudCostUsd > parentRun.limits.maxCloudCostUsd) errors.push("Graph cloud budget exceeds the parent Responsibility Run budget.");
  }
  return errors;
}

export function createResponsibilityGraph(definition: ResponsibilityGraphDefinition, parentRun?: ResponsibilityRun) {
  const normalized: ResponsibilityGraphDefinition = {
    version: 1,
    graphId: text(definition.graphId, 160),
    parentRunId: text(definition.parentRunId, 180),
    goal: text(definition.goal, 1_000),
    nodes: definition.nodes.map(normalizeGraphNode),
    limits: normalizeResponsibilityGraphLimits(definition.limits),
  };
  const errors = validateResponsibilityGraph(normalized, parentRun);
  if (errors.length) throw new Error(`Responsibility Graph is invalid:\n- ${errors.join("\n- ")}`);
  return normalized;
}

export function createResponsibilityGraphState(definition: ResponsibilityGraphDefinition, now = new Date().toISOString()): ResponsibilityGraphState {
  return {
    version: 1,
    graphId: definition.graphId,
    parentRunId: definition.parentRunId,
    round: 1,
    noNewFindingRounds: 0,
    state: "queued",
    executions: definition.nodes.map((node) => ({ nodeId: node.id, status: "queued", retryCount: 0, startedAt: "", completedAt: "", lastRoute: "", result: null })),
    tokensUsed: 0,
    contextCharactersUsed: 0,
    cloudCostUsd: 0,
    stopReason: "",
    updatedAt: now,
  };
}

function execution(state: ResponsibilityGraphState, nodeId: string) {
  return state.executions.find((item) => item.nodeId === nodeId) || null;
}

function runningResourceIds(definition: ResponsibilityGraphDefinition, state: ResponsibilityGraphState) {
  const resources = new Set<string>();
  for (const item of state.executions.filter((entry) => entry.status === "running")) {
    const node = definition.nodes.find((candidate) => candidate.id === item.nodeId);
    for (const resource of node?.exclusiveResources || []) resources.add(resource);
  }
  return resources;
}

function dependencyPassed(state: ResponsibilityGraphState, dependency: GraphDependency) {
  return execution(state, dependency.sourceNodeId)?.status === "passed";
}

export function readyGraphNodeIds(definition: ResponsibilityGraphDefinition, state: ResponsibilityGraphState) {
  if (["completed", "failed", "stopped"].includes(state.state)) return [];
  const running = state.executions.filter((item) => item.status === "running").length;
  const slots = Math.max(0, definition.limits.maxParallelism - running);
  if (!slots) return [];
  const busyResources = runningResourceIds(definition, state);
  const selectedResources = new Set<string>();
  return definition.nodes.filter((node) => {
    const item = execution(state, node.id);
    if (!item || item.status !== "queued") return false;
    if (!node.dependencies.every((dependency) => dependencyPassed(state, dependency))) return false;
    if (node.exclusiveResources.some((resource) => busyResources.has(resource) || selectedResources.has(resource))) return false;
    node.exclusiveResources.forEach((resource) => selectedResources.add(resource));
    return true;
  }).slice(0, slots).map((node) => node.id);
}

export function blockedGraphNodeIds(definition: ResponsibilityGraphDefinition, state: ResponsibilityGraphState) {
  return definition.nodes.filter((node) => {
    const item = execution(state, node.id);
    if (!item || item.status !== "queued" || !node.dependencies.length) return false;
    return node.dependencies.some((dependency) => {
      const upstream = execution(state, dependency.sourceNodeId);
      return upstream && ["failed", "rerouted", "escalated", "stopped", "cancelled"].includes(upstream.status);
    });
  }).map((node) => node.id);
}

export function startReadyGraphNodes(definition: ResponsibilityGraphDefinition, state: ResponsibilityGraphState, now = new Date().toISOString()) {
  const ready = new Set(readyGraphNodeIds(definition, state));
  if (!ready.size) return state;
  return {
    ...state,
    state: "working" as const,
    executions: state.executions.map((item) => ready.has(item.nodeId) ? { ...item, status: "running" as const, startedAt: now } : item),
    updatedAt: now,
  };
}

export function graphNodeInput(definition: ResponsibilityGraphDefinition, state: ResponsibilityGraphState, nodeId: string, baseInput: Record<string, unknown> = {}) {
  const node = definition.nodes.find((item) => item.id === nodeId);
  if (!node) throw new Error(`Unknown graph node ${nodeId}.`);
  const input: Record<string, unknown> = { ...baseInput };
  for (const dependency of node.dependencies) {
    const upstream = execution(state, dependency.sourceNodeId)?.result;
    if (!upstream || upstream.route !== "pass") throw new Error(`Graph dependency ${dependency.sourceNodeId} is not verified and ready.`);
    dependency.outputFields.forEach((field, index) => { input[dependency.inputKeys[index]] = upstream.output[field]; });
  }
  const checked = validateStructuredObject(node.inputSchema, input);
  if (!checked.ok) throw new Error(`Graph node ${nodeId} input failed validation: ${checked.error}`);
  return input;
}

export function freshVerifierInput(result: GraphNodeResult, sourceIds: readonly string[]) {
  return {
    workerNodeId: result.nodeId,
    structuredOutput: result.output,
    evidence: result.evidence,
    failedRule: result.failedRule,
    target: result.target,
    sourceIds: strings(sourceIds, 128, 240),
    workerSelfAssessmentAuthority: "none" as const,
  };
}

export function recordGraphNodeResult(definition: ResponsibilityGraphDefinition, state: ResponsibilityGraphState, input: GraphNodeResult & { tokensUsed?: number; contextCharactersUsed?: number; cloudCostUsd?: number }, now = new Date().toISOString()) {
  const node = definition.nodes.find((item) => item.id === input.nodeId);
  const current = execution(state, input.nodeId);
  if (!node || !current || current.status !== "running") throw new Error("Graph result belongs to a node that is not running.");
  if (input.producedByProfileId !== node.profileId) throw new Error("Graph result producer does not match the node contract.");
  if (node.verification.mode === "fresh-verifier" && input.verifiedByProfileId !== node.verification.verifierProfileId) throw new Error("Graph result did not come through its contracted fresh verifier.");
  if (node.verification.mode === "fresh-verifier" && input.verifiedByProfileId === input.producedByProfileId) throw new Error("A graph worker cannot be the sole verifier of its own output.");
  if (node.verification.evidenceRequired && !input.evidence.length) throw new Error("Graph node requires verification evidence.");
  const checked = validateStructuredObject(node.outputSchema, input.output);
  if (!checked.ok) throw new Error(`Graph node ${node.id} output failed validation: ${checked.error}`);
  if (!GRAPH_OUTCOME_ROUTES.includes(input.route)) throw new Error("Graph node returned an unsupported route.");

  const result: GraphNodeResult = {
    nodeId: node.id,
    route: input.route,
    output: input.output,
    evidence: input.evidence.map((item) => ({ rule: text(item.rule, 240), target: text(item.target, 240), evidenceRef: text(item.evidenceRef, 500), summary: text(item.summary, 600) })),
    failedRule: text(input.failedRule, 240),
    target: text(input.target, 240),
    summary: text(input.summary, 800),
    producedByProfileId: node.profileId,
    verifiedByProfileId: text(input.verifiedByProfileId, 160),
    generatedAt: now,
  };
  const retryCount = current.retryCount + (input.route === "retry" ? 1 : 0);
  const status: GraphNodeStatus = input.route === "pass" ? "passed"
    : input.route === "retry" && retryCount <= node.maxRetries ? "queued"
      : input.route === "reroute" ? "rerouted"
        : input.route === "escalate" ? "escalated"
          : input.route === "stop" ? "stopped" : "failed";
  const tokensUsed = state.tokensUsed + Math.max(0, Math.floor(Number(input.tokensUsed) || 0));
  const contextCharactersUsed = state.contextCharactersUsed + Math.max(0, Math.floor(Number(input.contextCharactersUsed) || 0));
  const cloudCostUsd = Number((state.cloudCostUsd + Math.max(0, Number(input.cloudCostUsd) || 0)).toFixed(4));
  let next: ResponsibilityGraphState = {
    ...state,
    executions: state.executions.map((item) => item.nodeId === node.id ? { ...item, status, retryCount, completedAt: status === "queued" ? "" : now, lastRoute: input.route, result } : item),
    tokensUsed,
    contextCharactersUsed,
    cloudCostUsd,
    updatedAt: now,
  };
  if (tokensUsed > definition.limits.maxTokens) next = { ...next, state: "failed", stopReason: "limit:tokens" };
  if (contextCharactersUsed > definition.limits.maxContextCharacters) next = { ...next, state: "failed", stopReason: "limit:context" };
  if (cloudCostUsd > definition.limits.maxCloudCostUsd) next = { ...next, state: "failed", stopReason: "limit:cloud-cost" };
  if (input.route === "stop") next = { ...next, state: "stopped", stopReason: result.summary || "node-stop" };
  if (input.route === "escalate") next = { ...next, state: "waiting", stopReason: result.summary || "human-escalation" };
  return finalizeGraphState(definition, next, now);
}

export function finalizeGraphState(definition: ResponsibilityGraphDefinition, state: ResponsibilityGraphState, now = new Date().toISOString()) {
  if (["failed", "stopped"].includes(state.state)) return state;
  const blocked = blockedGraphNodeIds(definition, state);
  const running = state.executions.some((item) => item.status === "running");
  const queued = state.executions.some((item) => item.status === "queued");
  if (blocked.length && !running && !readyGraphNodeIds(definition, state).length) return { ...state, state: "failed", stopReason: `blocked-children:${blocked.join(",")}`, updatedAt: now };
  if (state.executions.every((item) => item.status === "passed")) return { ...state, state: "completed", stopReason: "", updatedAt: now };
  if (!running && !queued && state.state !== "waiting") return { ...state, state: "failed", stopReason: "graph-incomplete", updatedAt: now };
  return state;
}

export function fanInGraphResults(state: ResponsibilityGraphState, expectedNodeIds: readonly string[], allowPartial = false): GraphFanInResult {
  const expected = strings(expectedNodeIds, 256, 160);
  const records: GraphFanInResult["records"] = [];
  const missingNodeIds: string[] = [];
  const failedNodeIds: string[] = [];
  for (const nodeId of expected) {
    const item = execution(state, nodeId);
    if (!item?.result) { missingNodeIds.push(nodeId); continue; }
    if (item.status !== "passed" || item.result.route !== "pass") { failedNodeIds.push(nodeId); continue; }
    records.push({ nodeId, output: item.result.output, evidence: item.result.evidence });
  }
  const partial = missingNodeIds.length > 0 || failedNodeIds.length > 0;
  if (partial && !allowPartial) return { complete: false, partial: false, expectedCount: expected.length, receivedCount: records.length, missingNodeIds, failedNodeIds, records: [] };
  return { complete: !partial, partial, expectedCount: expected.length, receivedCount: records.length, missingNodeIds, failedNodeIds, records };
}

export function layeredFanIn<T extends Record<string, unknown>>(records: readonly T[], input: { maxItemsPerLayer?: number; maxBytesPerLayer?: number } = {}) {
  const maxItems = boundedInteger(input.maxItemsPerLayer, 8, 1, 32);
  const maxBytes = boundedInteger(input.maxBytesPerLayer, 32 * 1024, 512, 256 * 1024);
  const layers: T[][] = [];
  let batch: T[] = [];
  let batchBytes = 0;
  for (const record of records) {
    const recordBytes = bytes(record);
    if (recordBytes > maxBytes) throw new Error("A single fan-in record exceeds the layered fan-in byte cap.");
    if (batch.length && (batch.length >= maxItems || batchBytes + recordBytes > maxBytes)) { layers.push(batch); batch = []; batchBytes = 0; }
    batch.push(record);
    batchBytes += recordBytes;
  }
  if (batch.length) layers.push(batch);
  return layers;
}

export function reduceUniqueFindings<T extends { id: string }>(findings: readonly T[]) {
  const byId = new Map<string, T>();
  for (const finding of findings) if (text(finding.id, 200) && !byId.has(finding.id)) byId.set(finding.id, finding);
  return [...byId.values()];
}

export function advanceDiscoveryRound(state: GraphDiscoveryState, newFindingIds: readonly string[], limits: Pick<ResponsibilityGraphLimits, "maxRounds" | "maxNodes">): GraphDiscoveryState {
  const previous = new Set(state.uniqueFindingIds);
  const incoming = strings(newFindingIds, limits.maxNodes, 200);
  const unique = [...new Set([...state.uniqueFindingIds, ...incoming])].slice(0, limits.maxNodes);
  const added = unique.filter((id) => !previous.has(id)).length;
  const round = state.round + 1;
  const noNewRounds = added === 0 ? state.noNewRounds + 1 : 0;
  const stop = noNewRounds >= 2 || round > limits.maxRounds || unique.length >= limits.maxNodes;
  return {
    round,
    noNewRounds,
    uniqueFindingIds: unique,
    stop,
    stopReason: noNewRounds >= 2 ? "two-rounds-no-new-findings" : round > limits.maxRounds ? "max-rounds" : unique.length >= limits.maxNodes ? "max-nodes" : "",
  };
}

export function createGraphNodeChildRun(parent: ResponsibilityRun, node: GraphNodeContract) {
  const verificationMode: ResponsibilityVerificationMode = node.verification.mode === "writer" ? "writer-approval" : "deterministic";
  const limits: Partial<ResponsibilityRunLimits> = {
    maxAttempts: node.maxRetries + 1,
    timeoutMs: Math.min(node.timeoutMs, parent.limits.timeoutMs),
    maxParallelChildren: 0,
    maxTokens: Math.min(node.tokenBudget, parent.limits.maxTokens),
    maxContextCharacters: parent.limits.maxContextCharacters,
    maxToolCalls: parent.limits.maxToolCalls,
    maxCloudCostUsd: Math.min(node.cloudCostBudgetUsd, parent.limits.maxCloudCostUsd),
  };
  return createResponsibilityRun({
    kind: node.workerType === "developer-worker" ? "deterministic-verification" : "general",
    goal: node.job,
    profileId: node.profileId,
    skillUris: [],
    allowedScopes: node.allowedScopes,
    allowedConnectorIds: node.allowedConnectorIds,
    verificationMode,
    limits,
    parentRunId: parent.runId,
  });
}

export function graphParallelWidth(definition: ResponsibilityGraphDefinition) {
  const state = createResponsibilityGraphState(definition);
  return readyGraphNodeIds(definition, state).length;
}

export function codeSweepGraphFixture(parentRunId: string, targets: readonly string[]): ResponsibilityGraphDefinition {
  const cleanTargets = strings(targets, 8, 160);
  const workers: GraphNodeContract[] = cleanTargets.map((target, index) => ({
    id: `sweep-${index + 1}`,
    job: `Inspect ${target} and return structured findings only.`,
    profileId: "bram-gatewick",
    workerType: "deterministic",
    capabilityRole: null,
    allowedScopes: [],
    allowedConnectorIds: [],
    inputSchema: { type: "object", required: [], allowed: [], maxBytes: 1_024 },
    outputSchema: { type: "object", required: ["findings"], allowed: ["findings"], maxBytes: 16_384 },
    dependencies: [],
    exclusiveResources: [],
    isolation: { mode: "none", workspaceId: target },
    timeoutMs: 5 * 60_000,
    tokenBudget: 4_000,
    cloudCostBudgetUsd: 0,
    maxRetries: 1,
    failureRoutes: { pass: "continue", retry: "retry", reroute: "reroute", escalate: "human", stop: "stop" },
    verification: { mode: "deterministic", verifierProfileId: "", evidenceRequired: true },
  }));
  const reducer: GraphNodeContract = {
    id: "reduce-findings",
    job: "Deterministically combine verified findings and preserve missing-child evidence.",
    profileId: "bram-gatewick",
    workerType: "deterministic",
    capabilityRole: null,
    allowedScopes: [],
    allowedConnectorIds: [],
    inputSchema: { type: "object", required: cleanTargets.map((_, index) => `findings${index + 1}`), allowed: cleanTargets.map((_, index) => `findings${index + 1}`), maxBytes: 64 * 1024 },
    outputSchema: { type: "object", required: ["uniqueFindings"], allowed: ["uniqueFindings"], maxBytes: 32 * 1024 },
    dependencies: workers.map((worker, index) => ({ sourceNodeId: worker.id, outputFields: ["findings"], inputKeys: [`findings${index + 1}`], reason: "Reducer requires this worker's verified structured findings." })),
    exclusiveResources: [],
    isolation: { mode: "none", workspaceId: "reducer" },
    timeoutMs: 60_000,
    tokenBudget: 1_000,
    cloudCostBudgetUsd: 0,
    maxRetries: 0,
    failureRoutes: { pass: "continue", retry: "stop", reroute: "reroute", escalate: "human", stop: "stop" },
    verification: { mode: "deterministic", verifierProfileId: "", evidenceRequired: true },
  };
  return createResponsibilityGraph({
    version: 1,
    graphId: `code-sweep-${Date.now()}`,
    parentRunId,
    goal: "Parallel code/UAT sweep with deterministic reduction.",
    nodes: [...workers, reducer],
    limits: { maxNodes: 12, maxParallelism: Math.max(1, Math.min(4, workers.length)), maxRounds: 2, maxTokens: 32_000, maxContextCharacters: 64_000, maxCloudCostUsd: 0, maxRawFanInBytes: 64 * 1024 },
  });
}

export function sequentialGraphFixture(parentRunId: string): ResponsibilityGraphDefinition {
  const first: GraphNodeContract = {
    id: "draft",
    job: "Produce the one structured draft that the next step actually needs.",
    profileId: "tamsin-hearthquill",
    workerType: "product-agent",
    capabilityRole: "quality",
    allowedScopes: ["read-project-slice", "propose-project-change"],
    allowedConnectorIds: [],
    inputSchema: { type: "object", required: [], allowed: [], maxBytes: 1_024 },
    outputSchema: { type: "object", required: ["proposal"], allowed: ["proposal"], maxBytes: 16_384 },
    dependencies: [], exclusiveResources: ["ppf-proposal-target"], isolation: { mode: "proposal-revision", workspaceId: "proposal-a" },
    timeoutMs: 5 * 60_000, tokenBudget: 6_000, cloudCostBudgetUsd: 0, maxRetries: 1,
    failureRoutes: { pass: "continue", retry: "retry", reroute: "reroute", escalate: "human", stop: "stop" },
    verification: { mode: "writer", verifierProfileId: "", evidenceRequired: true },
  };
  const second: GraphNodeContract = {
    ...first,
    id: "review",
    job: "Review the specific structured draft from the prior node.",
    profileId: "sage-brinewick",
    allowedScopes: ["read-project-slice"],
    inputSchema: { type: "object", required: ["proposal"], allowed: ["proposal"], maxBytes: 16_384 },
    outputSchema: { type: "object", required: ["review"], allowed: ["review"], maxBytes: 8_192 },
    dependencies: [{ sourceNodeId: "draft", outputFields: ["proposal"], inputKeys: ["proposal"], reason: "Review cannot start until the draft it reviews exists." }],
    exclusiveResources: [],
    isolation: { mode: "proposal-revision", workspaceId: "proposal-a-review" },
  };
  return createResponsibilityGraph({ version: 1, graphId: `sequential-${Date.now()}`, parentRunId, goal: "Sequential control fixture with a real data dependency.", nodes: [first, second], limits: { maxNodes: 4, maxParallelism: 2, maxRounds: 2, maxTokens: 16_000, maxContextCharacters: 48_000, maxCloudCostUsd: 0, maxRawFanInBytes: 32 * 1024 } });
}
