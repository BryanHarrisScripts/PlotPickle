// A saved authority and a successful capability test are distinct facts.
export function computeReadiness({ configured = false, verifiedAt = "", available = true, error = "" } = {}) {
  return { configured: Boolean(configured), ready: Boolean(configured && verifiedAt && available && !error), verifiedAt: verifiedAt || "", error: error || "" };
}
export function cloudMediaReadiness(profile, capability) {
  return computeReadiness({ configured: Boolean(profile?.apiKey && profile?.[`${capability}Model`]), verifiedAt: profile?.[`${capability}VerifiedAt`] });
}
export function writingReadiness(profile, available = true) {
  return computeReadiness({ configured: Boolean(profile?.textModel && (["local", "ollama"].includes(profile.provider) || profile.apiKey)), verifiedAt: profile?.assistantVerifiedAt, available, error: profile?.lastError });
}
export function invalidateImageVerification(store, route, message) {
  if (route === "comfyui" || route === "ollama-comfyui") {
    store.comfyui.imageVerifiedAt = "";
    store.comfyui.lastError = message;
    if (store.comfyui.imageProfile === "qwen-image-2.1-experimental") {
      store.comfyui.qwenImage21.lastVerifiedAt = "";
      store.comfyui.qwenImage21.lastError = message;
    }
  } else if (store.profiles[route]) {
    store.profiles[route].imageVerifiedAt = "";
    store.profiles[route].lastError = message;
  }
}
