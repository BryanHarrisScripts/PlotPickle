export type ProviderCompilationStrategy = "master" | "per-shot";
export type ProviderCapabilityTreatment = "enforceable" | "best-effort" | "finishing" | "unsupported";
export type ProviderCapabilityRequirementStrength = "required" | "preferred";
export type ProviderMediaCapability = "image" | "video";

export type DirectorSpecificationProperty =
  | "scene.intent"
  | "sequence.duration"
  | "shot.order"
  | "shot.duration"
  | "camera.framing"
  | "camera.lens"
  | "camera.movement"
  | "blocking"
  | "lighting"
  | "references"
  | "continuity"
  | "information-boundary"
  | "audio"
  | "transitions"
  | "delivery.aspect-ratio"
  | "delivery.frame-rate"
  | "delivery.resolution"
  | "delivery.frame-count";

export type ProviderCapabilityRule = {
  readonly property: DirectorSpecificationProperty;
  readonly treatment: ProviderCapabilityTreatment;
  readonly note?: string;
};

export type ProviderCapabilityContract = {
  readonly version: 1;
  readonly providerId: string;
  readonly capability: ProviderMediaCapability;
  readonly compilationStrategies: readonly ProviderCompilationStrategy[];
  readonly rules: readonly ProviderCapabilityRule[];
};

export type DirectorSpecificationRequirement = {
  readonly property: DirectorSpecificationProperty;
  readonly strength: ProviderCapabilityRequirementStrength;
  readonly sourceRef?: string;
};

export type ProviderCapabilityClassification = DirectorSpecificationRequirement & {
  readonly treatment: ProviderCapabilityTreatment;
  readonly note: string;
  readonly userVisibleAdaptationRequired: boolean;
};

export type ProviderCapabilityAssessment = {
  readonly version: 1;
  readonly providerId: string;
  readonly capability: ProviderMediaCapability;
  readonly compilationStrategies: readonly ProviderCompilationStrategy[];
  readonly classifications: readonly ProviderCapabilityClassification[];
  readonly blockingRequiredProperties: readonly DirectorSpecificationProperty[];
};

const TREATMENTS: readonly ProviderCapabilityTreatment[] = [
  "enforceable",
  "best-effort",
  "finishing",
  "unsupported",
];

const STRATEGIES: readonly ProviderCompilationStrategy[] = ["master", "per-shot"];

function cleanId(value: string) {
  return value.trim();
}

function cleanNote(value: string | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validate one adapter-declared Provider Capability Contract.
 *
 * This does not select a provider or route. It only verifies that a provider
 * adapter has made an explicit, truthful capability declaration for #2064.
 */
export function validateProviderCapabilityContract(contract: ProviderCapabilityContract) {
  if (contract.version !== 1) throw new Error("Unsupported Provider Capability Contract version.");
  if (!cleanId(contract.providerId)) throw new Error("Provider Capability Contract requires a providerId.");
  if (contract.capability !== "image" && contract.capability !== "video") {
    throw new Error("Provider Capability Contract requires an image or video capability.");
  }
  if (!contract.compilationStrategies.length) {
    throw new Error("Provider Capability Contract requires at least one compilation strategy.");
  }
  const strategySet = new Set<ProviderCompilationStrategy>();
  for (const strategy of contract.compilationStrategies) {
    if (!STRATEGIES.includes(strategy)) throw new Error(`Unknown provider compilation strategy: ${strategy}.`);
    if (strategySet.has(strategy)) throw new Error(`Duplicate provider compilation strategy: ${strategy}.`);
    strategySet.add(strategy);
  }

  const propertySet = new Set<DirectorSpecificationProperty>();
  for (const rule of contract.rules) {
    if (!TREATMENTS.includes(rule.treatment)) {
      throw new Error(`Unknown capability treatment for ${rule.property}.`);
    }
    if (propertySet.has(rule.property)) {
      throw new Error(`Duplicate provider capability rule: ${rule.property}.`);
    }
    propertySet.add(rule.property);
  }
}

/**
 * Look up one production property. An omitted rule is deliberately treated as
 * unsupported so PlotPickle never upgrades an undeclared provider ability into
 * an implied guarantee.
 */
export function classifyProviderProperty(
  contract: ProviderCapabilityContract,
  property: DirectorSpecificationProperty,
): ProviderCapabilityRule {
  validateProviderCapabilityContract(contract);
  const explicit = contract.rules.find((rule) => rule.property === property);
  if (explicit) {
    return {
      property,
      treatment: explicit.treatment,
      note: cleanNote(explicit.note),
    };
  }
  return {
    property,
    treatment: "unsupported",
    note: "Provider capability is not declared for this property.",
  };
}

/**
 * Truthfully classify requested Director Specification properties against one
 * already-selected adapter contract. Routing/selection stays outside #2064.
 */
export function assessProviderCapabilities(
  contract: ProviderCapabilityContract,
  requirements: readonly DirectorSpecificationRequirement[],
): ProviderCapabilityAssessment {
  validateProviderCapabilityContract(contract);

  const seen = new Set<DirectorSpecificationProperty>();
  const classifications = requirements.map((requirement): ProviderCapabilityClassification => {
    if (seen.has(requirement.property)) {
      throw new Error(`Duplicate Director Specification requirement: ${requirement.property}.`);
    }
    seen.add(requirement.property);
    const rule = classifyProviderProperty(contract, requirement.property);
    const userVisibleAdaptationRequired = requirement.strength === "required"
      && rule.treatment === "unsupported";

    return {
      property: requirement.property,
      strength: requirement.strength,
      sourceRef: requirement.sourceRef,
      treatment: rule.treatment,
      note: cleanNote(rule.note),
      userVisibleAdaptationRequired,
    };
  });

  return {
    version: 1,
    providerId: cleanId(contract.providerId),
    capability: contract.capability,
    compilationStrategies: [...contract.compilationStrategies],
    classifications,
    blockingRequiredProperties: classifications
      .filter((item) => item.userVisibleAdaptationRequired)
      .map((item) => item.property),
  };
}
