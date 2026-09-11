import {
  type ComfyVisualAdapter,
  type ComfyVisualJob,
  type VisualComputeTarget,
} from "./comfy-visual-adapter";
import {
  VISUAL_COMPUTE_LANES,
  isVisualComputeLaneId,
  visualComputeLane,
  visualWorkflowById,
  visualWorkflowsForLane,
  type VisualComputeLaneId,
  type VisualComputeMediaType,
} from "./visual-compute-lanes";

export const VISUAL_COMPUTE_CAPABILITIES = Object.freeze([
  "find_visual_workflow",
  "validate_visual_workflow",
  "run_visual_workflow",
  "get_visual_output",
  "cancel_visual_job",
] as const);

export const VISUAL_COMPUTE_LIFECYCLE = Object.freeze([
  "discover",
  "validate",
  "approve",
  "run",
  "retrieve",
  "provenance",
] as const);

export type VisualWorkflowSearch = Readonly<{
  laneId: VisualComputeLaneId;
  mediaType?: VisualComputeMediaType;
  query?: string;
}>;

export type VisualWorkflowExecutionRequest = Readonly<{
  target: VisualComputeTarget;
  workflowId: string;
  workflowReviewed: boolean;
  provenanceHash: string;
  paidExecutionApproved: boolean;
  input?: Record<string, unknown>;
}>;

export type VisualWorkflowValidation = Readonly<{
  ok: boolean;
  target: VisualComputeTarget;
  workflowId: string;
  laneId: VisualComputeLaneId | null;
  transport: "comfy-mcp" | "comfy-cloud-api" | null;
  reasons: readonly string[];
}>;

function normalizedQuery(value: string | undefined) {
  return (value || "").trim().toLocaleLowerCase();
}

function validProvenanceHash(value: string) {
  return /^[a-f0-9]{64}$/u.test(value.trim().toLocaleLowerCase());
}

export function createVisualComputeHarness(adapter: ComfyVisualAdapter) {
  function find_visual_workflow(search: VisualWorkflowSearch) {
    if (!isVisualComputeLaneId(search.laneId)) return [];
    const query = normalizedQuery(search.query);
    return visualWorkflowsForLane(search.laneId).filter((entry) => {
      if (search.mediaType && entry.mediaType !== search.mediaType && entry.mediaType !== "mixed") return false;
      if (!query) return true;
      return `${entry.title} ${entry.need} ${entry.providerHints.join(" ")}`.toLocaleLowerCase().includes(query);
    });
  }

  function validate_visual_workflow(request: VisualWorkflowExecutionRequest): VisualWorkflowValidation {
    const reasons: string[] = [];
    const workflow = visualWorkflowById(request.workflowId);
    const lane = workflow ? visualComputeLane(workflow.lane) : null;
    const plan = adapter.selectTransport(request.target);

    if (!workflow) reasons.push("The requested visual workflow is not in the PlotPickle lane registry.");
    if (!plan) reasons.push(`No approved Comfy transport is available for the explicit ${request.target} target.`);
    if (workflow?.requiresApiWorkflowImport && !request.workflowReviewed) {
      reasons.push("The workflow must be explicitly imported and reviewed before execution.");
    }
    if (lane?.defaultProvenanceRequired && !validProvenanceHash(request.provenanceHash)) {
      reasons.push("A reviewed 64-character SHA-256 provenance hash is required before execution.");
    }
    if (plan?.paidCloudExecution && lane?.defaultCloudApprovalRequired && !request.paidExecutionApproved) {
      reasons.push("Paid Cloud execution requires explicit Human approval.");
    }

    return Object.freeze({
      ok: reasons.length === 0,
      target: request.target,
      workflowId: request.workflowId,
      laneId: workflow?.lane || null,
      transport: plan?.transport || null,
      reasons: Object.freeze(reasons),
    });
  }

  async function run_visual_workflow(request: VisualWorkflowExecutionRequest) {
    const validation = validate_visual_workflow(request);
    if (!validation.ok) throw new Error(validation.reasons.join(" "));
    const plan = adapter.selectTransport(request.target);
    if (!plan) throw new Error(`No approved Comfy transport is available for the explicit ${request.target} target.`);
    return adapter.run(plan, {
      workflowId: request.workflowId,
      provenanceHash: request.provenanceHash.trim().toLocaleLowerCase(),
      ...(request.input || {}),
    });
  }

  async function get_visual_output(job: ComfyVisualJob) {
    return adapter.getOutput(job);
  }

  async function cancel_visual_job(job: ComfyVisualJob) {
    await adapter.cancel(job);
  }

  return Object.freeze({
    capabilities: VISUAL_COMPUTE_CAPABILITIES,
    lifecycle: VISUAL_COMPUTE_LIFECYCLE,
    lanes: () => VISUAL_COMPUTE_LANES,
    find_visual_workflow,
    validate_visual_workflow,
    run_visual_workflow,
    get_visual_output,
    cancel_visual_job,
  });
}

export type VisualComputeHarness = ReturnType<typeof createVisualComputeHarness>;
