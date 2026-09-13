import type { TextProvider } from "./writing-assistant-store";

export const NATIVE_DIRECT_AGENT_RUNTIME = "native/direct" as const;
export const OPENAI_AGENTS_RUNTIME = "openai-agents" as const;
export const DEFAULT_AGENT_RUNTIME = NATIVE_DIRECT_AGENT_RUNTIME;

export type AgentRuntimeId =
  | typeof NATIVE_DIRECT_AGENT_RUNTIME
  | typeof OPENAI_AGENTS_RUNTIME;

export type AgentRuntimeFeature =
  | "sessions"
  | "tool-search"
  | "mcp"
  | "subagents"
  | "managed-environment";

export type AgentRuntimeCapability = {
  runtime: AgentRuntimeId;
  ready: boolean;
  beta: boolean;
  features: Readonly<Record<AgentRuntimeFeature, boolean>>;
};

export const AGENT_RUNTIME_CAPABILITIES: Readonly<Record<AgentRuntimeId, AgentRuntimeCapability>> = {
  [NATIVE_DIRECT_AGENT_RUNTIME]: {
    runtime: NATIVE_DIRECT_AGENT_RUNTIME,
    ready: true,
    beta: false,
    features: {
      sessions: false,
      "tool-search": false,
      mcp: false,
      subagents: false,
      "managed-environment": false,
    },
  },
  [OPENAI_AGENTS_RUNTIME]: {
    runtime: OPENAI_AGENTS_RUNTIME,
    ready: false,
    beta: true,
    features: {
      sessions: true,
      "tool-search": true,
      mcp: true,
      subagents: true,
      "managed-environment": true,
    },
  },
};

export type AgentRuntimeSessionScope = {
  projectId: string;
  agentId: string;
  profileId?: string;
};

export type AgentRuntimeSessionAction = "none" | "resume" | "reset";

export type AgentRuntimeSessionBinding = {
  runtime: AgentRuntimeId;
  scope: AgentRuntimeSessionScope;
  opaqueSessionId: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Runtime session identifiers are protected local application state only.
 * Implementations must not serialize these bindings into PPF/story canon.
 */
export interface AgentRuntimeSessionStore {
  read(scope: AgentRuntimeSessionScope, runtime: AgentRuntimeId): Promise<AgentRuntimeSessionBinding | null>;
  write(binding: AgentRuntimeSessionBinding): Promise<void>;
  reset(scope: AgentRuntimeSessionScope, runtime: AgentRuntimeId): Promise<void>;
}

export type AgentRuntimeOutboundBoundary = {
  cloudDisclosureAccepted: boolean;
  selectedResourceIds: readonly string[];
  capabilityGrants: readonly string[];
};

export type AgentRuntimeExecutionRequest<TContext = unknown> = {
  requestId: string;
  agentId: string;
  profileId?: string;
  projectId?: string;
  provider: TextProvider;
  model: string;
  runtime: AgentRuntimeId;
  input: string;
  context?: TContext;
  outbound: AgentRuntimeOutboundBoundary;
  session?: {
    scope: AgentRuntimeSessionScope;
    action: AgentRuntimeSessionAction;
  };
};

export type AgentRuntimeUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  currency?: string;
};

export type AgentRuntimeEvidence = {
  agentId: string;
  provider: TextProvider;
  model: string;
  runtime: AgentRuntimeId;
  sessionEvent: "none" | "created" | "resumed" | "reset";
  toolsUsed: readonly string[];
  subagentRoles: readonly string[];
  elapsedMs: number;
  usage?: AgentRuntimeUsage;
  environment?: string;
  finalState: "success" | "failure" | "cancelled";
  deterministicEvaluation?: "pass" | "fail" | "not-run";
};

export type AgentRuntimeExecutionResult = {
  status: "success" | "failure" | "cancelled";
  text: string;
  runtime: AgentRuntimeId;
  session?: AgentRuntimeSessionBinding;
  evidence: AgentRuntimeEvidence;
  error?: string;
};

export interface AgentRuntimeAdapter {
  readonly id: AgentRuntimeId;
  readonly capability: AgentRuntimeCapability;
  execute<TContext = unknown>(request: AgentRuntimeExecutionRequest<TContext>): Promise<AgentRuntimeExecutionResult>;
  resetSession?(scope: AgentRuntimeSessionScope): Promise<void>;
}

export function agentRuntimeCapability(runtime: AgentRuntimeId = DEFAULT_AGENT_RUNTIME) {
  return AGENT_RUNTIME_CAPABILITIES[runtime];
}

/**
 * Fail closed. A requested runtime is never replaced with another runtime.
 * Phase 0 deliberately marks OpenAI Agents as not ready until the adapter is proven.
 */
export function requireReadyAgentRuntime(runtime: AgentRuntimeId = DEFAULT_AGENT_RUNTIME) {
  const capability = agentRuntimeCapability(runtime);
  if (!capability.ready) {
    throw new Error(`Agent runtime ${runtime} is not ready. No fallback runtime was used.`);
  }
  return capability;
}
