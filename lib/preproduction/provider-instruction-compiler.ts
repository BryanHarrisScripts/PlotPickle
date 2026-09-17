import type {
  DirectorSpecification,
  DirectorSpecificationDirectionLevel,
  DirectorSpecificationShot,
} from "./director-specification";
import type {
  ProviderCapabilityAssessment,
  ProviderCapabilityClassification,
  ProviderCompilationStrategy,
} from "./provider-capability-contract";

export type ProviderInstructionGenerationRequirement = Pick<
  ProviderCapabilityClassification,
  "property" | "strength" | "treatment" | "note" | "sourceRef"
>;

export type ProviderInstructionScenePayload = {
  readonly sceneId: string;
  readonly title: string;
  readonly purpose: string;
  readonly objective: string;
  readonly opposition: string;
  readonly action: string;
  readonly turn: string;
  readonly outcome: string;
  readonly assetRefs: DirectorSpecification["scene"]["assetRefs"];
};

export type ProviderInstructionShotPayload = {
  readonly editorialShotId: string;
  readonly productionShotId: string;
  readonly order: number;
  readonly narrativePurpose: string;
  readonly durationSeconds: number;
  readonly continuityLockReferences: DirectorSpecificationShot["continuityLockReferences"];
  readonly informationDirectives: DirectorSpecificationShot["informationDirectives"];
  readonly frameRefs: DirectorSpecificationShot["frameRefs"];
  readonly assetRefs: DirectorSpecificationShot["assetRefs"];
  readonly sourceRefs: DirectorSpecificationShot["sourceRefs"];
  readonly camera?: DirectorSpecificationShot["camera"];
  readonly blocking?: DirectorSpecificationShot["blocking"];
  readonly audioIntents?: DirectorSpecificationShot["audioIntents"];
  readonly transitionIn?: string;
  readonly transitionOut?: string;
};

export type ProviderInstructionPayload = {
  readonly version: 1;
  readonly projectId: string;
  readonly canonicalRevision: number;
  readonly directionLevel: DirectorSpecificationDirectionLevel;
  readonly scene: ProviderInstructionScenePayload;
  readonly sequenceDurationSeconds: number;
  readonly shots: readonly ProviderInstructionShotPayload[];
  readonly generationRequirements: readonly ProviderInstructionGenerationRequirement[];
};

export type ProviderInstructionShotAdapterPayload = Omit<ProviderInstructionPayload, "shots"> & {
  readonly shot: ProviderInstructionShotPayload;
  readonly shotIndex: number;
  readonly shotCount: number;
};

/**
 * One already-selected provider adapter. #2064 does not choose this adapter.
 * The adapter only translates structured, capability-filtered production intent
 * into disposable provider-facing instruction text.
 */
export type ProviderInstructionAdapter = {
  readonly version: 1;
  readonly providerId: string;
  readonly compileMaster?: (payload: ProviderInstructionPayload) => string;
  readonly compileShot?: (payload: ProviderInstructionShotAdapterPayload) => string;
};

export type ProviderInstruction = {
  readonly id: string;
  readonly scope: "master" | "shot";
  readonly editorialShotId?: string;
  readonly productionShotId?: string;
  readonly text: string;
  readonly sourceRefs: readonly string[];
};

export type ProviderInstructionBundle = {
  readonly version: 1;
  readonly disposable: true;
  readonly providerId: string;
  readonly capability: ProviderCapabilityAssessment["capability"];
  readonly strategy: ProviderCompilationStrategy;
  readonly projectId: string;
  readonly canonicalRevision: number;
  readonly directionLevel: DirectorSpecificationDirectionLevel;
  readonly instructions: readonly ProviderInstruction[];
  readonly finishingRequirements: readonly ProviderCapabilityClassification[];
  readonly unsupportedPreferences: readonly ProviderCapabilityClassification[];
  readonly warnings: readonly string[];
  readonly sourceRefs: readonly string[];
};

export type CompileProviderInstructionsInput = {
  readonly specification: DirectorSpecification;
  readonly assessment: ProviderCapabilityAssessment;
  readonly strategy: ProviderCompilationStrategy;
  readonly adapter: ProviderInstructionAdapter;
};

function cleanText(value: string) {
  return value.trim();
}

function stableStrings(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function shotPayload(
  shot: DirectorSpecificationShot,
  directionLevel: DirectorSpecificationDirectionLevel,
): ProviderInstructionShotPayload {
  const base: ProviderInstructionShotPayload = {
    editorialShotId: shot.editorialShotId,
    productionShotId: shot.productionShotId,
    order: shot.order,
    narrativePurpose: shot.narrativePurpose,
    durationSeconds: shot.durationSeconds,
    continuityLockReferences: [...shot.continuityLockReferences],
    informationDirectives: [...shot.informationDirectives],
    frameRefs: [...shot.frameRefs],
    assetRefs: [...shot.assetRefs],
    sourceRefs: [...shot.sourceRefs],
  };

  if (directionLevel === "automatic") return base;

  const directed: ProviderInstructionShotPayload = {
    ...base,
    camera: { ...shot.camera },
    blocking: [...shot.blocking],
  };

  if (directionLevel === "directed") return directed;

  return {
    ...directed,
    audioIntents: [...shot.audioIntents],
    transitionIn: shot.transitionIn,
    transitionOut: shot.transitionOut,
  };
}

function warningFor(classification: ProviderCapabilityClassification) {
  const note = cleanText(classification.note);
  if (classification.treatment === "best-effort") {
    return note || `${classification.property} is best-effort for this provider.`;
  }
  if (classification.treatment === "finishing") {
    return note || `${classification.property} must be handled in finishing/post.`;
  }
  if (classification.treatment === "unsupported") {
    return note || `${classification.property} is unsupported by this provider.`;
  }
  return "";
}

function validateInput(input: CompileProviderInstructionsInput) {
  const { specification, assessment, strategy, adapter } = input;
  if (!specification.providerNeutral) {
    throw new Error("Provider instruction compilation requires a provider-neutral Director Specification.");
  }
  if (assessment.version !== 1) throw new Error("Unsupported Provider Capability Assessment version.");
  if (adapter.version !== 1) throw new Error("Unsupported Provider Instruction Adapter version.");
  if (!cleanText(adapter.providerId)) throw new Error("Provider Instruction Adapter requires a providerId.");
  if (cleanText(adapter.providerId) !== cleanText(assessment.providerId)) {
    throw new Error("Provider Instruction Adapter does not match the assessed provider.");
  }
  if (!assessment.compilationStrategies.includes(strategy)) {
    throw new Error(`Provider does not declare the ${strategy} compilation strategy.`);
  }
  if (assessment.blockingRequiredProperties.length) {
    throw new Error(
      `Provider instruction compilation is blocked by unsupported required properties: ${assessment.blockingRequiredProperties.join(", ")}.`,
    );
  }
  if (strategy === "master" && typeof adapter.compileMaster !== "function") {
    throw new Error("Provider Instruction Adapter does not implement master compilation.");
  }
  if (strategy === "per-shot" && typeof adapter.compileShot !== "function") {
    throw new Error("Provider Instruction Adapter does not implement per-shot compilation.");
  }
}

function payloadFor(
  specification: DirectorSpecification,
  assessment: ProviderCapabilityAssessment,
): ProviderInstructionPayload {
  return {
    version: 1,
    projectId: specification.projectId,
    canonicalRevision: specification.canonicalRevision,
    directionLevel: specification.directionLevel,
    scene: {
      sceneId: specification.scene.sceneId,
      title: specification.scene.title,
      purpose: specification.scene.purpose,
      objective: specification.scene.objective,
      opposition: specification.scene.opposition,
      action: specification.scene.action,
      turn: specification.scene.turn,
      outcome: specification.scene.outcome,
      assetRefs: [...specification.scene.assetRefs],
    },
    sequenceDurationSeconds: specification.sequenceDurationSeconds,
    shots: specification.shots.map((shot) => shotPayload(shot, specification.directionLevel)),
    generationRequirements: assessment.classifications
      .filter((item) => item.treatment === "enforceable" || item.treatment === "best-effort")
      .map((item) => ({ ...item })),
  };
}

/**
 * Compile one provider-neutral Director Specification into disposable,
 * inspectable provider-facing instructions through an already-selected adapter.
 *
 * This function does not select a provider, route a job, call a model, persist
 * prompt prose, or promote generated instructions into creative/canon state.
 */
export function compileProviderInstructions(
  input: CompileProviderInstructionsInput,
): ProviderInstructionBundle {
  validateInput(input);
  const { specification, assessment, strategy, adapter } = input;
  const payload = payloadFor(specification, assessment);
  const finishingRequirements = assessment.classifications
    .filter((item) => item.treatment === "finishing")
    .map((item) => ({ ...item }));
  const unsupportedPreferences = assessment.classifications
    .filter((item) => item.treatment === "unsupported" && item.strength === "preferred")
    .map((item) => ({ ...item }));
  const warnings = assessment.classifications
    .map(warningFor)
    .filter(Boolean);

  let instructions: ProviderInstruction[];
  if (strategy === "master") {
    const text = cleanText(adapter.compileMaster!(payload));
    if (!text) throw new Error("Provider master compiler returned empty instructions.");
    instructions = [{
      id: `provider-instruction:${cleanText(assessment.providerId)}:master`,
      scope: "master",
      text,
      sourceRefs: [...specification.sourceRefs],
    }];
  } else {
    instructions = payload.shots.map((shot, index) => {
      const text = cleanText(adapter.compileShot!({
        version: payload.version,
        projectId: payload.projectId,
        canonicalRevision: payload.canonicalRevision,
        directionLevel: payload.directionLevel,
        scene: payload.scene,
        sequenceDurationSeconds: payload.sequenceDurationSeconds,
        generationRequirements: payload.generationRequirements,
        shot,
        shotIndex: index,
        shotCount: payload.shots.length,
      }));
      if (!text) throw new Error(`Provider per-shot compiler returned empty instructions for ${shot.editorialShotId}.`);
      return {
        id: `provider-instruction:${cleanText(assessment.providerId)}:shot:${shot.editorialShotId}`,
        scope: "shot" as const,
        editorialShotId: shot.editorialShotId,
        productionShotId: shot.productionShotId,
        text,
        sourceRefs: stableStrings([specification.scene.sceneId, ...shot.sourceRefs]),
      };
    });
  }

  return {
    version: 1,
    disposable: true,
    providerId: cleanText(assessment.providerId),
    capability: assessment.capability,
    strategy,
    projectId: specification.projectId,
    canonicalRevision: specification.canonicalRevision,
    directionLevel: specification.directionLevel,
    instructions,
    finishingRequirements,
    unsupportedPreferences,
    warnings,
    sourceRefs: [...specification.sourceRefs],
  };
}
