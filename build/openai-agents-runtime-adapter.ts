import {
  AGENT_RUNTIME_CAPABILITIES,
  OPENAI_AGENTS_RUNTIME,
  type AgentRuntimeAdapter,
  type AgentRuntimeEvidence,
  type AgentRuntimeExecutionRequest,
  type AgentRuntimeExecutionResult,
  type AgentRuntimeUsage,
} from "./agent-runtime-contract";

/**
 * Phase 1 transport port only.
 *
 * Beta request/response schemas remain private to this adapter module. The
 * caller supplies a mocked transport that accepts/returns unknown values so
 * OpenAI public-beta types do not leak into PlotPickle contracts.
 */
export interface OpenAIAgentsRuntimeTransport {
  runSession(request: unknown): Promise<readonly unknown[]>;
}

type BetaSessionCreateRequest = {
  environment: { type: "none" };
  agent: {
    model: string;
    instructions: string;
    tools: readonly [];
  };
  input: string;
  metadata: Record<string, string>;
  stream: true;
};

type BetaUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

type BetaSession = {
  id?: string;
  environment?: { type?: string };
};

type BetaTurn = {
  status?: string;
  error?: { message?: string } | string | null;
};

type BetaEvent = {
  type?: string;
  session_id?: string;
  text?: string;
  error?: { message?: string } | string | null;
  session?: BetaSession;
  turn?: BetaTurn;
  usage?: BetaUsage | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function betaEvent(value: unknown): BetaEvent {
  const item = record(value);
  if (!item) return {};
  return {
    type: typeof item.type === "string" ? item.type : undefined,
    session_id: typeof item.session_id === "string" ? item.session_id : undefined,
    text: typeof item.text === "string" ? item.text : undefined,
    error: typeof item.error === "string" || record(item.error) ? item.error as BetaEvent["error"] : undefined,
    session: record(item.session) as BetaSession | undefined,
    turn: record(item.turn) as BetaTurn | undefined,
    usage: record(item.usage) as BetaUsage | undefined,
  };
}

function positiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function usageFrom(value: BetaUsage | null | undefined): AgentRuntimeUsage | undefined {
  if (!value) return undefined;
  const inputTokens = positiveNumber(value.input_tokens);
  const outputTokens = positiveNumber(value.output_tokens);
  const totalTokens = positiveNumber(value.total_tokens);
  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) return undefined;
  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

function failureMessage(value: BetaEvent["error"] | BetaTurn["error"]) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && typeof value.message === "string" && value.message.trim()) {
    return value.message.trim();
  }
  return "The OpenAI Agents runtime fixture reported a failure.";
}

function buildBetaRequest(request: AgentRuntimeExecutionRequest): BetaSessionCreateRequest {
  const metadata: Record<string, string> = {
    request_id: request.requestId,
    plotpickle_agent_id: request.agentId,
  };
  if (request.profileId) metadata.plotpickle_profile_id = request.profileId;
  if (request.projectId) metadata.plotpickle_project_id = request.projectId;

  return {
    environment: { type: "none" },
    agent: {
      model: request.model,
      instructions: request.instructions,
      tools: [],
    },
    input: request.input,
    metadata,
    stream: true,
  };
}

function baseEvidence(request: AgentRuntimeExecutionRequest, elapsedMs: number): AgentRuntimeEvidence {
  return {
    agentId: request.agentId,
    provider: request.provider,
    model: request.model,
    runtime: OPENAI_AGENTS_RUNTIME,
    sessionEvent: "none",
    toolsUsed: [],
    subagentRoles: [],
    elapsedMs,
    environment: "none",
    finalState: "failure",
    deterministicEvaluation: "not-run",
  };
}

function failureResult(
  request: AgentRuntimeExecutionRequest,
  message: string,
  startedAt: number,
  extras: Partial<AgentRuntimeEvidence> = {},
): AgentRuntimeExecutionResult {
  const evidence = {
    ...baseEvidence(request, Date.now() - startedAt),
    ...extras,
    finalState: "failure" as const,
  };
  return {
    status: "failure",
    text: "",
    runtime: OPENAI_AGENTS_RUNTIME,
    evidence,
    error: message,
  };
}

function validatePhase1Request(request: AgentRuntimeExecutionRequest) {
  if (request.runtime !== OPENAI_AGENTS_RUNTIME) {
    return `OpenAI Agents adapter received runtime ${request.runtime}; no fallback runtime was used.`;
  }
  if (request.provider !== "openai") {
    return `OpenAI Agents runtime requires the OpenAI provider in Phase 1; received ${request.provider}. No fallback provider was used.`;
  }
  if (!request.outbound.cloudDisclosureAccepted) {
    return "OpenAI Agents runtime requires explicit cloud disclosure acceptance before bounded project material can leave the computer.";
  }
  if (request.outbound.capabilityGrants.length > 0) {
    return "OpenAI Agents Phase 1 does not expose tools, MCP, or other runtime capabilities.";
  }
  if (request.session && request.session.action !== "none") {
    return "OpenAI Agents Phase 1 does not resume or reset durable sessions; session durability is deferred to Phase 3.";
  }
  return "";
}

export function createOpenAIAgentsRuntimeAdapter(
  transport: OpenAIAgentsRuntimeTransport,
): AgentRuntimeAdapter {
  return {
    id: OPENAI_AGENTS_RUNTIME,
    capability: AGENT_RUNTIME_CAPABILITIES[OPENAI_AGENTS_RUNTIME],
    async execute(request) {
      const startedAt = Date.now();
      const invalid = validatePhase1Request(request);
      if (invalid) return failureResult(request, invalid, startedAt);

      try {
        const events = await transport.runSession(buildBetaRequest(request));
        let sessionId = "";
        let text = "";
        let usage: AgentRuntimeUsage | undefined;
        let environment = "none";

        for (const raw of events) {
          const event = betaEvent(raw);
          const type = event.type || "";
          const createdSessionId = typeof event.session?.id === "string" ? event.session.id : "";
          if (createdSessionId) sessionId = createdSessionId;
          if (!sessionId && event.session_id) sessionId = event.session_id;
          if (typeof event.session?.environment?.type === "string") environment = event.session.environment.type;

          if (type === "agent.session.turn.output_text.done" && typeof event.text === "string") {
            text += event.text;
          }
          if (type === "agent.session.turn.completed") {
            usage = usageFrom(event.usage) || usage;
          }
          if (type === "agent.session.turn.failed" || type === "agent.session.failed" || type === "agent.session.error") {
            return failureResult(request, failureMessage(event.error || event.turn?.error), startedAt, {
              sessionEvent: sessionId ? "created" : "none",
              usage,
              environment,
            });
          }
          if (type === "agent.session.turn.cancelled") {
            return {
              status: "cancelled",
              text: "",
              runtime: OPENAI_AGENTS_RUNTIME,
              evidence: {
                ...baseEvidence(request, Date.now() - startedAt),
                sessionEvent: sessionId ? "created" : "none",
                usage,
                environment,
                finalState: "cancelled",
              },
            };
          }
        }

        const finalText = text.trim();
        if (!finalText) {
          return failureResult(request, "The OpenAI Agents runtime fixture returned no final output text.", startedAt, {
            sessionEvent: sessionId ? "created" : "none",
            usage,
            environment,
          });
        }

        return {
          status: "success",
          text: finalText,
          runtime: OPENAI_AGENTS_RUNTIME,
          evidence: {
            ...baseEvidence(request, Date.now() - startedAt),
            sessionEvent: sessionId ? "created" : "none",
            usage,
            environment,
            finalState: "success",
          },
        };
      } catch (error) {
        return failureResult(
          request,
          error instanceof Error ? error.message : "The OpenAI Agents runtime fixture failed.",
          startedAt,
        );
      }
    },
  };
}
