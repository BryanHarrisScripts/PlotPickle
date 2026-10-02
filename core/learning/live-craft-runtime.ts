import { PILOT_CRAFT_CAPABILITIES } from "./pilot-craft-capabilities";
import {
  routeCraftCapability,
  runtimeFailureFallback,
  type CraftInvocationMode,
  type CraftRoute,
} from "./contextual-craft-router";

function normalizedContext(values: readonly string[]) {
  return [...new Set(values.flatMap((value) => String(value || "").toLowerCase().split(/[^a-z-]+/u)).filter(Boolean))];
}

export function liveCraftRoute(input: {
  mode: CraftInvocationMode;
  context: readonly string[];
}): CraftRoute {
  return routeCraftCapability({
    mode: input.mode,
    context: normalizedContext(input.context),
    capabilities: PILOT_CRAFT_CAPABILITIES.map((capability) => ({
      id: capability.id,
      domain: capability.domain,
      available: true,
    })),
  });
}

export function liveCraftInstruction(route: CraftRoute) {
  if (!route.primary) return "";
  const supporting = route.supporting.map((capability) => capability.id).join(", ");
  return [
    `PLOTPICKLE CRAFT CAPABILITY: ${route.primary.id}.`,
    supporting ? `Supporting craft capabilities: ${supporting}.` : "",
    "Use the selected craft capability only as a teaching/advisory lens.",
    "Do not mutate canon. Do not expose capability routing or provider/runtime selection to the learner.",
  ].filter(Boolean).join(" ");
}

export function liveCraftFallback(route: CraftRoute): CraftRoute {
  return runtimeFailureFallback(route);
}

export const LIVE_CRAFT_RUNTIME = Object.freeze({
  capabilityCount: PILOT_CRAFT_CAPABILITIES.length,
  primaryMaximum: 1,
  supportingMaximum: 2,
  canonicalMutationAllowed: false,
  providerPickerVisible: false,
  baselineFallback: "baseline-learn",
});
