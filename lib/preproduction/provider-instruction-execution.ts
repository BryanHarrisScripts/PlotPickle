import type {
  ConcreteProviderInstructionIntegration,
  ProviderInstructionRuntimeTarget,
} from "./provider-instruction-adapters";
import type {
  ProviderInstructionBundle,
  ProviderInstruction,
} from "./provider-instruction-compiler";
import { inspectProviderInstructionBundle } from "./provider-instruction-inspection";

export type ProviderInstructionExecutionRequest = {
  readonly version: 1;
  readonly instructionId: string;
  readonly scope: ProviderInstruction["scope"];
  readonly editorialShotId?: string;
  readonly productionShotId?: string;
  /** Exact provider-facing text shown by Advanced inspection. */
  readonly prompt: string;
  readonly sourceRefs: readonly string[];
};

export type ProviderInstructionExecutionHandoff = {
  readonly version: 1;
  readonly disposable: true;
  readonly canonical: false;
  readonly providerId: string;
  readonly runtimeTarget: ProviderInstructionRuntimeTarget;
  readonly projectId: string;
  readonly canonicalRevision: number;
  readonly directionLevel: ProviderInstructionBundle["directionLevel"];
  readonly strategy: ProviderInstructionBundle["strategy"];
  readonly requests: readonly ProviderInstructionExecutionRequest[];
  readonly finishingRequirements: ProviderInstructionBundle["finishingRequirements"];
  readonly warnings: readonly string[];
  readonly sourceRefs: readonly string[];
};

export type BuildProviderInstructionExecutionHandoffInput = {
  /** Integration already selected by PlotPickle routing/capability resolution. */
  readonly integration: ConcreteProviderInstructionIntegration;
  /** Exact disposable bundle made available to Advanced inspection. */
  readonly bundle: ProviderInstructionBundle;
  readonly editorialShotId?: string | null;
  readonly productionShotId?: string | null;
};

function clean(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Final #2064 execution boundary.
 *
 * PlotPickle routing has already selected the integration before this function
 * runs. This handoff does not read or change routing, call a provider/model,
 * persist generated prose, or grant it canon authority. It only proves that the
 * media runtime receives the exact same disposable instruction text that the
 * Advanced inspection surface exposes to the user.
 */
export function buildProviderInstructionExecutionHandoff(
  input: BuildProviderInstructionExecutionHandoffInput,
): ProviderInstructionExecutionHandoff {
  const { integration, bundle } = input;
  if (integration.version !== 1) throw new Error("Unsupported provider instruction integration version.");
  if (bundle.version !== 1 || !bundle.disposable) {
    throw new Error("Provider instruction execution requires a disposable Provider Instruction Bundle.");
  }

  const providerId = clean(bundle.providerId);
  if (!providerId || providerId !== clean(integration.providerId)) {
    throw new Error("Provider Instruction Bundle does not match the already-selected provider integration.");
  }
  if (integration.capabilityContract.providerId !== providerId || integration.instructionAdapter.providerId !== providerId) {
    throw new Error("Selected provider integration has inconsistent #2064 provider identities.");
  }
  if (bundle.capability !== integration.runtimeTarget.capability || bundle.capability !== integration.capabilityContract.capability) {
    throw new Error("Provider Instruction Bundle capability does not match the selected runtime target.");
  }
  if (!integration.capabilityContract.compilationStrategies.includes(bundle.strategy)) {
    throw new Error(`Selected provider integration does not declare the ${bundle.strategy} compilation strategy.`);
  }

  const inspection = inspectProviderInstructionBundle(bundle, {
    editorialShotId: input.editorialShotId,
    productionShotId: input.productionShotId,
  });
  if (!inspection.instructions.length) {
    throw new Error("No generated provider instruction matches the requested execution scope.");
  }

  return {
    version: 1,
    disposable: true,
    canonical: false,
    providerId,
    runtimeTarget: { ...integration.runtimeTarget },
    projectId: inspection.projectId,
    canonicalRevision: inspection.canonicalRevision,
    directionLevel: inspection.directionLevel,
    strategy: inspection.strategy,
    requests: inspection.instructions.map((instruction) => ({
      version: 1,
      instructionId: instruction.id,
      scope: instruction.scope,
      editorialShotId: instruction.editorialShotId,
      productionShotId: instruction.productionShotId,
      prompt: instruction.text,
      sourceRefs: [...instruction.sourceRefs],
    })),
    finishingRequirements: inspection.finishingRequirements.map((item) => ({ ...item })),
    warnings: [...inspection.warnings],
    sourceRefs: [...inspection.sourceRefs],
  };
}
