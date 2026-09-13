import {
  AGENT_RUNTIME_CAPABILITIES,
  OPENAI_AGENTS_RUNTIME,
  type AgentRuntimeAdapter,
  type AgentRuntimeExecutionRequest,
  type AgentRuntimeExecutionResult,
  type AgentRuntimeSessionBinding,
} from "./agent-runtime-contract";

/**
 * #1996 beta-isolation boundary.
 *
 * Everything named OpenAIAgentsBeta* below belongs to the public-beta transport
 * shape and must not be imported into canonical PlotPickle Agent, PPF, LEARN,
 * STORY or BUZZ contracts. Phase 1 injects only a mocked transport. There is no
 * OpenAI SDK import, HTTP client or reachable product route in this module.
 */
type OpenAIAgentsBetaSessionCreateParams = Readonly<{
  environment: Readonly<{ type: "none" }>;
  agent: Readonly<{
    model: string;
    instructions: string;
    tools: readonly [];
    multi_agent: Readonly<{
      enabled: false;
      max_concurrent_subagents: 1;
    }>;
  }>;
  input: string;
  metadata: Readonly<Record<string, string>>;
  stream: false;
}>;

type OpenAIAgentsBetaSessionStatus = "idle" | "in_progress" | "requires_action" | "failed";

type OpenAIAgentsBetaTerminalProjection = Readonly<{
  sessionId: string;
  status: OpenAIAgentsBetaSessionStatus;
  error: string | null;
  finalText: string;
  usage?: Readonly<{
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  }>;
  environmentType: string;
}>;

/**
 * Injectable beta transport seam. Phase 1 tests supply fixtures here.
 * A later live phase may implement this seam with the OpenAI SDK, while keeping
 * SDK request/response/event types confined to this adapter module.
 */
export interface OpenAIAgentsBetaTransport {
  createSession(params: OpenAIAgentsBetaSessionCreateParams): Promise<OpenAIAgentsBetaTerminalProjection>;
}

type AdapterOptions = Readonly<{
  transport: OpenAIAgentsBetaTransport;
  now?: () => number;
  timestamp?: () => string;
  serializeContext?: (context: unknown) => string;
}>;

const MAX_CONTEXT_CHARACTERS = 32_000;
const MAX_METADATA_VALUE_CHARACTERS = 512;

function metadataValue(value: string) {
  return value.slice(0, MAX_METADATA_VALUE_CHARACTERS);
}

function boundedInput(request: AgentRuntimeExecutionRequest, serializeContext?: (context: unknown) => string) {
  if (request.context === undefined) return request.input;
  if (!serializeContext) {
    throw new Error("OpenAI Agents Phase 1 requires an explicit bounded context serializer. No fallback runtime was used.");
  }
  const context = serializeContext(request.context);
  if (context.length > MAX_CONTEXT_CHARACTERS) {
    throw new Error("OpenAI Agents Phase 1 bounded context is too large. No fallback runtime was used.");
  }
  return `${request.input}\n\nPLOTPICKLE_BOUNDED_CONTEXT\n${context}`;
}

function validateRequest(request: AgentRuntimeExecutionRequest) {
  if (request.runtime !== OPENAI_AGENTS_RUNTIME) {
    throw new Error(`OpenAI Agents adapter cannot execute runtime ${request.runtime}. No fallback runtime was used.`);
  }
  if (request.provider !== "openai") {
    throw new Error(`OpenAI Agents runtime requires the OpenAI provider; received ${request.provider}. No fallback runtime was used.`);
  }
  if (!request.outbound.cloudDisclosureAccepted) {
    throw new Error("OpenAI Agents cloud disclosure was not accepted. No outbound request was made and no fallback runtime was used.");
  }
  if (request.outbound.capabilityGrants.length) {
    throw new Error("OpenAI Agents Phase 1 exposes no tools or capabilities. No fallback runtime was used.");
  }
  if (request.session && request.session.action !== "none") {
    throw new Error("OpenAI Agents Phase 1 does not resume or reset sessions. No fallback runtime was used.");
  }
  if (!request.requestId.trim() || !request.agentId.trim() || !request.model.trim() || !request.input.trim()) {
    throw new Error("OpenAI Agents Phase 1 requires request, Agent, model and input identity. No fallback runtime was used.");
  }
}

function toBetaSessionCreateParams(
  request: AgentRuntimeExecutionRequest,
  serializeContext?: (context: unknown) => string,
): OpenAIAgentsBetaSessionCreateParams {
  validateRequest(request);
  const metadata: Record<string, string> = {
    plotpickle_request_id: metadataValue(request.requestId),
    plotpickle_agent_id: metadataValue(request.agentId),
    plotpickle_runtime: OPENAI_AGENTS_RUNTIME,
  };
  if (request.projectId) metadata.plotpickle_project_id = metadataValue(request.projectId);
  if (request.profileId) metadata.plotpickle_profile_id = metadataValue(request.profileId);

  return {
    environment: { type: "none" },
    agent: {
      model: request.model,
      instructions: "Execute only the PlotPickle-owned Agent job supplied in input. PlotPickle remains authoritative for permissions, canon, deterministic evaluation and Human creative decisions.",
      tools: [],
      multi_agent: { enabled: false, max_concurrent_subagents: 1 },
    },
    input: boundedInput(request, serializeContext),
    metadata,
    stream: false,
  };
}

function usageFromBeta(result: OpenAIAgentsBetaTerminalProjection) {
  if (!result.usage) return undefined;
  return {
    inputTokens: result.usage.input_tokens,
    outputTokens: result.usage.output_tokens,
    totalTokens: result.usage.total_tokens,
  };
}

function sessionBinding(
  request: AgentRuntimeExecutionRequest,
  result: OpenAIAgentsBetaTerminalProjection,
  timestamp: () => string,
): AgentRuntimeSessionBinding | undefined {
  if (!request.session?.scope || !result.sessionId.trim()) return undefined;
  const now = timestamp();
  return {
    runtime: OPENAI_AGENTS_RUNTIME,
    scope: request.session.scope,
    opaqueSessionId: result.sessionId,
    createdAt: now,
    updatedAt: now,
  };
}

function failureResult(
  request: AgentRuntimeExecutionRequest,
  startedAt: number,
  now: () => number,
  error: unknown,
  environment = "none",
): AgentRuntimeExecutionResult {
  const message = error instanceof Error ? error.message : String(error || "OpenAI Agents Phase 1 failed.");
  return {
    status: "failure",
    text: "",
    runtime: OPENAI_AGENTS_RUNTIME,
    evidence: {
      agentId: request.agentId,
      provider: request.provider,
      model: request.model,
      runtime: OPENAI_AGENTS_RUNTIME,
      sessionEvent: "none",
      toolsUsed: [],
      subagentRoles: [],
      elapsedMs: Math.max(0, now() - startedAt),
      environment,
      finalState: "failure",
      deterministicEvaluation: "not-run",
    },
    error: message,
  };
}

export function createOpenAIAgentsRuntimeAdapter(options: AdapterOptions): AgentRuntimeAdapter {
  const now = options.now ?? Date.now;
  const timestamp = options.timestamp ?? (() => new Date().toISOString());

  return {
    id: OPENAI_AGENTS_RUNTIME,
    capability: AGENT_RUNTIME_CAPABILITIES[OPENAI_AGENTS_RUNTIME],
    async execute(request) {
      const startedAt = now();
      let environment = "none";
      try {
        const betaRequest = toBetaSessionCreateParams(request, options.serializeContext);
        const betaResult = await options.transport.createSession(betaRequest);
        environment = betaResult.environmentType || "none";

        if (betaResult.status !== "idle") {
          const reason = betaResult.error || `OpenAI Agents Phase 1 returned non-terminal-ready status ${betaResult.status}.`;
          return failureResult(request, startedAt, now, reason, environment);
        }
        if (!betaResult.finalText.trim()) {
          return failureResult(request, startedAt, now, "OpenAI Agents Phase 1 returned no final text.", environment);
        }

        const session = sessionBinding(request, betaResult, timestamp);
        return {
          status: "success",
          text: betaResult.finalText,
          runtime: OPENAI_AGENTS_RUNTIME,
          ...(session ? { session } : {}),
          evidence: {
            agentId: request.agentId,
            provider: request.provider,
            model: request.model,
            runtime: OPENAI_AGENTS_RUNTIME,
            sessionEvent: session ? "created" : "none",
            toolsUsed: [],
            subagentRoles: [],
            elapsedMs: Math.max(0, now() - startedAt),
            usage: usageFromBeta(betaResult),
            environment,
            finalState: "success",
            deterministicEvaluation: "not-run",
          },
        };
      } catch (error) {
        return failureResult(request, startedAt, now, error, environment);
      }
    },
  };
}
