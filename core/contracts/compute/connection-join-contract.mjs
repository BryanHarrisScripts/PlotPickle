// PP-CONNECT-001: an advertised model is not proof of an executable route.
// Distinguish a workflow engine from the provider/model that supplies inference.
// Every supported combination must map to an existing, explicit selected route.
export const CONNECTION_ENGINES = Object.freeze([
  { id: "comfy-local", label: "ComfyUI Local", locality: "local" },
  { id: "comfy-cloud", label: "ComfyUI Cloud", locality: "cloud" },
]);

export const CONNECTION_PROVIDERS = Object.freeze({
  text: Object.freeze([
    { id: "local", label: "Local Writing Runtime", locality: "local", routes: { direct: "local" } },
    { id: "ollama", label: "Ollama", locality: "local", routes: { direct: "ollama" } },
    { id: "openai", label: "OpenAI", locality: "cloud", routes: { direct: "openai" } },
    { id: "gemini", label: "Gemini", locality: "cloud", routes: { direct: "gemini" } },
    { id: "minimax", label: "MiniMax", locality: "cloud", routes: { direct: "minimax" } },
  ]),
  image: Object.freeze([
    { id: "sdxl-base", label: "SDXL Base 1.0", locality: "local", routes: { "comfy-local": "comfyui" }, profile: "sdxl-1.0", detail: "Default local ComfyUI image model" },
    { id: "qwen-image-2.1", label: "Qwen-Image-2.1", locality: "local", routes: { "comfy-local": "comfyui" }, profile: "qwen-image-2.1-experimental", detail: "Experimental; user-supplied assets and research-license acknowledgement required" },
    { id: "ollama-prompt", label: "Ollama Prompt Enhancement", locality: "local", routes: { "comfy-local": "ollama-comfyui" }, detail: "Text prompt enhancement; ComfyUI generates the actual image" },
    { id: "openai", label: "OpenAI", locality: "cloud", routes: { direct: "openai" } },
    { id: "minimax", label: "MiniMax", locality: "cloud", routes: { direct: "minimax" } },
  ]),
  video: Object.freeze([
    { id: "ltx-video", label: "LTX-Video", locality: "local", routes: { "comfy-local": "ltx-video" }, detail: "Local reviewed ComfyUI text-to-video workflow" },
    { id: "minimax-h3-local", label: "MiniMax H3 Local", locality: "local", routes: { "comfy-local": "comfyui-native" }, detail: "Native model; requires tested local nodes and workflow" },
    { id: "minimax-h3-api", label: "MiniMax H3 API Workflow", locality: "cloud", routes: { "comfy-local": "minimax-comfyui" }, detail: "ComfyUI Local orchestrates cloud inference; separate from native H3" },
    { id: "minimax", label: "MiniMax Direct API", locality: "cloud", routes: { direct: "minimax" } },
    { id: "openai", label: "OpenAI Video", locality: "cloud", routes: {}, detail: "No executable OpenAI video adapter is registered in current PlotPickle" },
  ]),
});

export function resolveConnectionJoin(capability, engine, provider) {
  const entry = CONNECTION_PROVIDERS[capability]?.find((item) => item.id === provider);
  if (!entry || !["direct", "comfy-local", "comfy-cloud"].includes(engine)) {
    return { capable: false, reason: "This route is not capable: choose a registered capability, engine and provider." };
  }
  const route = entry.routes[engine];
  if (!route) {
    const detail = engine === "comfy-cloud"
      ? "ComfyUI Cloud is configured as a connection, but an executable verified workflow adapter is not available."
      : engine === "direct" && Object.keys(entry.routes).length
        ? `${entry.label} requires its registered ComfyUI workflow.`
        : entry.detail || "There is no reviewed adapter for this engine and provider pairing.";
    return { capable: false, reason: `This route is not capable. ${detail}` };
  }
  return { capable: true, capability, engine, provider, route, profile: entry.profile || null, locality: entry.locality };
}

export function connectionProof(status, joined) {
  if (!joined) return { ready: false, state: "NOT JOINED" };
  const resolved = resolveConnectionJoin(joined.capability, joined.engine, joined.provider);
  if (!resolved.capable || resolved.route !== joined.route) return { ready: false, state: "NOT CAPABLE", reason: resolved.reason || "The saved join no longer matches a supported route." };
  const option = status?.[joined.capability]?.options?.[resolved.route];
  if (!option || option.disabled || option.supported === false) {
    return { ready: false, state: "NOT CAPABLE", reason: option?.error || "The provider adapter is not available." };
  }
  if (resolved.profile && option.imageProfile !== resolved.profile) {
    return { ready: false, state: "SETUP NEEDED", reason: `Activate and verify the ${resolved.profile} image profile in ComfyUI Local Settings before using this join.` };
  }
  if (!option.ready) return { ready: false, state: option.configured ? "TEST NEEDED" : "SETUP NEEDED", reason: option.error || "Run the capability-specific verification test." };
  return { ready: true, state: "VERIFIED", verifiedAt: option.verifiedAt || "" };
}

export function acceptedJoinRecord(capability, engine, provider, now) {
  const result = resolveConnectionJoin(capability, engine, provider);
  if (!result.capable) throw new Error(result.reason);
  return { capability, engine, provider, route: result.route, profile: result.profile, joinedAt: now };
}
