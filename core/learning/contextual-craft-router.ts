export type CraftInvocationMode = "learn" | "authoring-proposal";
export type CraftDomain = "theme" | "genre-tropes" | "character" | "scene" | "dialogue" | "reader-response";

export type CraftCapability = Readonly<{
  id: string;
  domain: CraftDomain;
  available: boolean;
}>;

export type CraftRoute = Readonly<{
  mode: CraftInvocationMode;
  primary: CraftCapability | null;
  supporting: readonly CraftCapability[];
  fallback: "baseline-learn" | null;
  canonicalMutationAllowed: false;
  learnerVisibleLabel: "Learn" | "Ask Agent";
}>;

const aliases: Readonly<Record<string, CraftDomain>> = {
  theme: "theme",
  motif: "theme",
  genre: "genre-tropes",
  trope: "genre-tropes",
  tropes: "genre-tropes",
  character: "character",
  scene: "scene",
  dialogue: "dialogue",
  dialog: "dialogue",
  reader: "reader-response",
  "reader-response": "reader-response",
};

function domainFor(value: string): CraftDomain | null {
  const normalized = value.trim().toLowerCase();
  return aliases[normalized] ?? null;
}

export function routeCraftCapability(input: {
  mode: CraftInvocationMode;
  context: readonly string[];
  capabilities: readonly CraftCapability[];
}): CraftRoute {
  const requested = input.context.map(domainFor).filter((value): value is CraftDomain => value !== null);
  const orderedDomains = [...new Set(requested)];
  const matches = orderedDomains
    .map((domain) => input.capabilities.find((capability) => capability.domain === domain && capability.available))
    .filter((capability): capability is CraftCapability => Boolean(capability));
  const primary = matches[0] ?? null;
  const supporting = matches.slice(1, 3);
  return {
    mode: input.mode,
    primary,
    supporting,
    fallback: primary ? null : "baseline-learn",
    canonicalMutationAllowed: false,
    learnerVisibleLabel: input.mode === "learn" ? "Learn" : "Ask Agent",
  };
}

export function runtimeFailureFallback(route: CraftRoute): CraftRoute {
  return { ...route, primary: null, supporting: [], fallback: "baseline-learn", canonicalMutationAllowed: false };
}
