export type VisualComputeMediaType = "image" | "video" | "mixed";
export type VisualComputeLaneId = string;

export type VisualComputeLaneDefinition = Readonly<{
  id: VisualComputeLaneId;
  label: string;
  description: string;
  defaultCloudApprovalRequired: boolean;
  defaultProvenanceRequired: boolean;
}>;

export type VisualWorkflowCatalogEntry = Readonly<{
  id: string;
  title: string;
  lane: VisualComputeLaneId;
  need: string;
  mediaType: VisualComputeMediaType;
  providerHints: readonly string[];
  sourceUrl: string;
  reviewStatus: "reference-reviewed" | "source-library";
  requiresApiWorkflowImport: boolean;
}>;

export const DEFAULT_VISUAL_COMPUTE_LANE = "cinematic";

export const VISUAL_COMPUTE_LANES: readonly VisualComputeLaneDefinition[] = Object.freeze([
  {
    id: "cinematic",
    label: "CINEMATIC",
    description: "Storyboards, shots, continuity, motion and finishing.",
    defaultCloudApprovalRequired: true,
    defaultProvenanceRequired: true,
  },
  {
    id: "marketing",
    label: "MARKETING",
    description: "Advertising, product, campaign and social production.",
    defaultCloudApprovalRequired: true,
    defaultProvenanceRequired: true,
  },
  {
    id: "utility",
    label: "UTILITY",
    description: "Adaptation, enhancement, interpolation and relighting.",
    defaultCloudApprovalRequired: true,
    defaultProvenanceRequired: true,
  },
]);

export function isVisualComputeLaneId(value: unknown): value is VisualComputeLaneId {
  return typeof value === "string" && VISUAL_COMPUTE_LANES.some((lane) => lane.id === value);
}

export function visualComputeLane(value: unknown): VisualComputeLaneDefinition {
  const lane = VISUAL_COMPUTE_LANES.find((item) => item.id === value);
  return lane || VISUAL_COMPUTE_LANES.find((item) => item.id === DEFAULT_VISUAL_COMPUTE_LANE)!;
}

export const VISUAL_WORKFLOW_CATALOG: readonly VisualWorkflowCatalogEntry[] = Object.freeze([
  {
    id: "cinematic-storyboards-styleframes",
    title: "Storyboards & Style Frames",
    lane: "cinematic",
    need: "Turn approved story beats into visual planning frames before production rendering.",
    mediaType: "image",
    providerHints: ["ComfyUI", "image generation"],
    sourceUrl: "https://cloud.comfy.org/?share=17db26f20bbd&utm_source=twitter&utm_medium=inhouse_social&utm_campaign=comfy_advertising_storyboards_styleframes&utm_content=tutorial",
    reviewStatus: "reference-reviewed",
    requiresApiWorkflowImport: true,
  },
  {
    id: "cinematic-shot-image-to-video",
    title: "Shot / Image-to-Video",
    lane: "cinematic",
    need: "Animate an approved frame or shot concept while preserving explicit shot intent.",
    mediaType: "video",
    providerHints: ["ComfyUI", "video workflow"],
    sourceUrl: "https://comfy.org/workflows/comfyui/",
    reviewStatus: "source-library",
    requiresApiWorkflowImport: true,
  },
  {
    id: "cinematic-camera-motion",
    title: "Camera Motion & Prompt Translation",
    lane: "cinematic",
    need: "Translate PlotPickle cinematography grammar into camera-aware visual workflow choices.",
    mediaType: "video",
    providerHints: ["ComfyUI", "camera motion"],
    sourceUrl: "https://comfy.org/workflows/cinematic_annotate_video-0136284ecc19/",
    reviewStatus: "reference-reviewed",
    requiresApiWorkflowImport: true,
  },
  {
    id: "cinematic-reference-continuity",
    title: "Character / Reference Continuity",
    lane: "cinematic",
    need: "Carry approved visual references across related frames without making them canon automatically.",
    mediaType: "mixed",
    providerHints: ["ComfyUI", "reference conditioning"],
    sourceUrl: "https://comfy.org/workflows/comfyui/",
    reviewStatus: "source-library",
    requiresApiWorkflowImport: true,
  },
  {
    id: "cinematic-vfx-finishing",
    title: "VFX / Finishing",
    lane: "cinematic",
    need: "Apply reviewed finishing or visual-effects passes after core shot intent is approved.",
    mediaType: "mixed",
    providerHints: ["ComfyUI", "finishing"],
    sourceUrl: "https://comfy.org/workflows/comfyui/",
    reviewStatus: "source-library",
    requiresApiWorkflowImport: true,
  },
  {
    id: "marketing-advertising-storyboard",
    title: "Advertising Storyboard",
    lane: "marketing",
    need: "Explore campaign beats and shot order before committing to expensive generation.",
    mediaType: "image",
    providerHints: ["ComfyUI", "advertising"],
    sourceUrl: "https://comfy.org/workflows/shane/",
    reviewStatus: "reference-reviewed",
    requiresApiWorkflowImport: true,
  },
  {
    id: "marketing-product-photography",
    title: "Product Photography",
    lane: "marketing",
    need: "Create controlled product-oriented still concepts from approved brand inputs.",
    mediaType: "image",
    providerHints: ["ComfyUI", "product"],
    sourceUrl: "https://comfy.org/workflows/shane/",
    reviewStatus: "reference-reviewed",
    requiresApiWorkflowImport: true,
  },
  {
    id: "marketing-product-placement",
    title: "Product Placement",
    lane: "marketing",
    need: "Review placement concepts while preserving explicit product and composition intent.",
    mediaType: "image",
    providerHints: ["ComfyUI", "product placement"],
    sourceUrl: "https://comfy.org/workflows/c3e308dab99b-c3e308dab99b/",
    reviewStatus: "reference-reviewed",
    requiresApiWorkflowImport: true,
  },
  {
    id: "marketing-commerce-hero-video",
    title: "Commerce Hero Video",
    lane: "marketing",
    need: "Turn an approved campaign frame into a short hero-motion concept.",
    mediaType: "video",
    providerHints: ["ComfyUI", "commerce video"],
    sourceUrl: "https://comfy.org/workflows/shane/",
    reviewStatus: "source-library",
    requiresApiWorkflowImport: true,
  },
  {
    id: "marketing-moodboard-casting",
    title: "Moodboard & Talent Exploration",
    lane: "marketing",
    need: "Explore visual direction and casting references without promoting generated material to canon.",
    mediaType: "image",
    providerHints: ["ComfyUI", "moodboard"],
    sourceUrl: "https://comfy.org/workflows/shane/",
    reviewStatus: "source-library",
    requiresApiWorkflowImport: true,
  },
  {
    id: "utility-aspect-upscale",
    title: "Aspect Ratio & Enhancement",
    lane: "utility",
    need: "Adapt approved assets to delivery formats and improve resolution without changing story intent.",
    mediaType: "mixed",
    providerHints: ["ComfyUI", "upscale", "reframe"],
    sourceUrl: "https://comfy.org/workflows/comfyui/",
    reviewStatus: "source-library",
    requiresApiWorkflowImport: true,
  },
  {
    id: "utility-interpolate-relight",
    title: "Frame Interpolation & Relight",
    lane: "utility",
    need: "Test temporal smoothness or lighting alternatives as reversible finishing operations.",
    mediaType: "mixed",
    providerHints: ["ComfyUI", "interpolation", "relight"],
    sourceUrl: "https://comfy.org/workflows/comfyui/",
    reviewStatus: "source-library",
    requiresApiWorkflowImport: true,
  },
]);

export function visualWorkflowsForLane(laneId: VisualComputeLaneId) {
  return VISUAL_WORKFLOW_CATALOG.filter((entry) => entry.lane === laneId);
}

export function visualWorkflowById(workflowId: string) {
  return VISUAL_WORKFLOW_CATALOG.find((entry) => entry.id === workflowId) || null;
}
