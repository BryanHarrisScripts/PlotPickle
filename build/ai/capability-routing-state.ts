import { readCredentialJson, writeCredentialJson } from "../local-credentials";
import { readMediaRoutingStore } from "../media-routing-store";
import { readSynchronizedAssistantStore } from "../writing-assistant-store";
import { readNativeH3Store } from "./h3/comfyui-h3-native-provider";
import { CAPABILITY_ROUTES, routeExecution } from "../../core/contracts/compute/capability-routes.mjs";

export type CapabilityChoice = { version: 1 | 2; text: string; image: string; video: string; updatedAt: string };
export async function readCapabilityChoice(): Promise<CapabilityChoice> {
  const stored = await readCredentialJson<CapabilityChoice>("ai-routing.json");
  if (stored && Object.entries(CAPABILITY_ROUTES).every(([capability, routes]) => routes.includes(stored[capability as "text" | "image" | "video"]))) return stored;
  const [assistant, media, native] = await Promise.all([readSynchronizedAssistantStore(), readMediaRoutingStore(), readNativeH3Store()]);
  // Legacy projections are migration input only. Reading never writes a selection.
  return { version: 2, text: assistant.store.activeProvider === "disabled" ? "off" : assistant.store.activeProvider, image: media.imageRoute, video: native.active ? "comfyui-native" : media.videoRoute === "none" ? "off" : media.videoRoute === "minimax-comfyui" ? "minimax-comfyui" : "minimax", updatedAt: "" };
}
type Consent = { billing: boolean; dataSharing: boolean; acknowledgedAt: string };
export async function readProviderConsent() {
  return await readCredentialJson<Record<string, Consent>>("provider-consent.json") || {};
}
export async function saveProviderConsent(provider: string, billing: boolean, dataSharing: boolean) {
  if (!["openai", "minimax", "gemini", "comfy-cloud"].includes(provider)) throw new Error("Choose a supported provider.");
  const stored = await readProviderConsent();
  stored[provider] = { billing, dataSharing, acknowledgedAt: new Date().toISOString() };
  await writeCredentialJson("provider-consent.json", stored);
  return stored;
}
export async function requireRouteConsent(capability: string, route: string) {
  const execution = routeExecution(capability, route);
  if (!execution.paid) return;
  const consent = (await readProviderConsent())[execution.provider];
  if (!consent?.billing || (execution.dataSharing && !consent.dataSharing)) throw new Error(`Complete the saved billing${execution.dataSharing ? " and video data-sharing" : ""} acknowledgment in ${execution.provider} Setup before selecting or using this route.`);
}
