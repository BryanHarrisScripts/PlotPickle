export type ComfyWorkflowLane = "cinematic" | "marketing" | "utility";

export type ComfyWorkflowCatalogEntry = Readonly<{
  id: string;
  title: string;
  lane: ComfyWorkflowLane;
  need: string;
  mediaType: "image" | "video" | "mixed";
  providerHints: readonly string[];
  sourceUrl: string;
  reviewStatus: "reference-reviewed" | "source-library";
  requiresApiWorkflowImport: boolean;
}>;

export const COMFY_WORKFLOW_LANES = Object.freeze([
  { id: "cinematic" as const, label: "CINEMATIC", description: "Storyboards, shots, continuity, motion and finishing." },
  { id: "marketing" as const, label: "MARKETING", description: "Advertising, product, campaign and social production." },
  { id: "utility" as const, label: "UTILITY", description: "Adaptation, enhancement, interpolation and relighting." },
]);

export const COMFY_CLOUD_WORKFLOW_CATALOG: readonly ComfyWorkflowCatalogEntry[] = Object.freeze([
  {
    id: "cinematic-storyboards-styleframes",
    title: "Storyboards & Style Frames",
    lane: "cinematic",
    need: "Turn approved story beats into visual planning frames before production rendering.",
    mediaType: "image",
    providerHints: ["Comfy Cloud", "image generation"],
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
    providerHints: ["Comfy Cloud", "video workflow"],
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
    providerHints: ["Comfy Cloud", "camera motion"],
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
    providerHints: ["Comfy Cloud", "reference conditioning"],
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
    providerHints: ["Comfy Cloud", "finishing"],
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
    providerHints: ["Comfy Cloud", "advertising"],
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
    providerHints: ["Comfy Cloud", "product"],
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
    providerHints: ["Comfy Cloud", "product placement"],
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
    providerHints: ["Comfy Cloud", "commerce video"],
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
    providerHints: ["Comfy Cloud", "moodboard"],
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
    providerHints: ["Comfy Cloud", "upscale", "reframe"],
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
    providerHints: ["Comfy Cloud", "interpolation", "relight"],
    sourceUrl: "https://comfy.org/workflows/comfyui/",
    reviewStatus: "source-library",
    requiresApiWorkflowImport: true,
  },
]);
