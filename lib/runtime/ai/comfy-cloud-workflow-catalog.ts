// Compatibility facade for the #1879 Comfy Cloud surface.
// The canonical lane/workflow authority now lives in visual-compute-lanes.ts so
// Local and Cloud visual compute share one horizontally extensible registry.
export {
  VISUAL_COMPUTE_LANES as COMFY_WORKFLOW_LANES,
  VISUAL_WORKFLOW_CATALOG as COMFY_CLOUD_WORKFLOW_CATALOG,
} from "./visual-compute-lanes";

export type {
  VisualComputeLaneId as ComfyWorkflowLane,
  VisualWorkflowCatalogEntry as ComfyWorkflowCatalogEntry,
} from "./visual-compute-lanes";
