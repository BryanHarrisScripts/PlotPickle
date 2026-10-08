// Runtime location and remote inference are independent facts.
export const CAPABILITY_ROUTES = Object.freeze({
  text: ["local", "ollama", "openai", "minimax", "gemini", "off"],
  image: ["comfyui", "ollama-comfyui", "openai", "minimax", "manual"],
  video: ["comfyui-native", "minimax", "minimax-comfyui", "openai", "off"],
});
export function routeExecution(capability, route) {
  const disabled = route === "off" || route === "manual";
  const provider = route === "minimax-comfyui" ? "minimax" : route;
  const remote = ["openai", "minimax", "gemini", "comfy-cloud"].includes(provider);
  return { disabled, provider, runtimeLocation: route === "minimax-comfyui" || ["local", "ollama", "comfyui", "ollama-comfyui", "comfyui-native"].includes(route) ? "local" : remote ? "cloud" : "off", inferenceLocation: remote ? "cloud" : disabled ? "off" : "local", paid: remote, dataSharing: remote && capability === "video" };
}
export function requireSelectedCapability(status, capability, route) {
  if (!CAPABILITY_ROUTES[capability]?.includes(route)) throw new Error("Choose a supported capability route.");
  if (!routeExecution(capability, route).disabled && !status?.[capability]?.options?.[route]?.ready) {
    throw new Error(status?.[capability]?.options?.[route]?.error || "The selected route needs setup and a successful capability test.");
  }
}
export function selectedImageExecution(mode, candidates) {
  const selected = candidates.find((item) => item.selected);
  if (!selected?.ready) throw new Error("The selected Images route is not ready. Complete its Setup and capability test in Settings.");
  if (mode !== "hybrid" && selected.locality !== mode) throw new Error(`The selected Images route is ${selected.locality}. Switch Story Mode or choose a compatible route in Hybrid.`);
  return selected;
}
