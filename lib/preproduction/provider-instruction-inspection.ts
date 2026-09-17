import type {
  ProviderInstruction,
  ProviderInstructionBundle,
} from "./provider-instruction-compiler";

export type ProviderInstructionInspection = {
  readonly version: 1;
  readonly disposable: true;
  readonly canonical: false;
  readonly editable: false;
  readonly providerId: string;
  readonly capability: ProviderInstructionBundle["capability"];
  readonly strategy: ProviderInstructionBundle["strategy"];
  readonly projectId: string;
  readonly canonicalRevision: number;
  readonly directionLevel: ProviderInstructionBundle["directionLevel"];
  readonly instructions: readonly ProviderInstruction[];
  readonly warnings: readonly string[];
  readonly finishingRequirements: ProviderInstructionBundle["finishingRequirements"];
  readonly unsupportedPreferences: ProviderInstructionBundle["unsupportedPreferences"];
  readonly sourceRefs: readonly string[];
};

export type InspectProviderInstructionBundleOptions = {
  readonly editorialShotId?: string | null;
  readonly productionShotId?: string | null;
};

function clean(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Read-only Advanced projection over one already-compiled provider instruction
 * bundle. Generated prose stays disposable and never becomes Story/PPF/canon.
 */
export function inspectProviderInstructionBundle(
  bundle: ProviderInstructionBundle,
  options: InspectProviderInstructionBundleOptions = {},
): ProviderInstructionInspection {
  if (bundle.version !== 1) throw new Error("Unsupported Provider Instruction Bundle version.");
  if (!bundle.disposable) throw new Error("Provider instruction inspection accepts disposable output only.");
  if (!clean(bundle.providerId)) throw new Error("Provider instruction inspection requires a providerId.");
  if (!bundle.instructions.length) throw new Error("Provider instruction inspection requires at least one generated instruction.");

  const editorialShotId = clean(options.editorialShotId);
  const productionShotId = clean(options.productionShotId);
  const instructions = bundle.strategy === "per-shot" && (editorialShotId || productionShotId)
    ? bundle.instructions.filter((instruction) => (
      (editorialShotId && instruction.editorialShotId === editorialShotId)
      || (productionShotId && instruction.productionShotId === productionShotId)
    ))
    : [...bundle.instructions];

  return {
    version: 1,
    disposable: true,
    canonical: false,
    editable: false,
    providerId: clean(bundle.providerId),
    capability: bundle.capability,
    strategy: bundle.strategy,
    projectId: bundle.projectId,
    canonicalRevision: bundle.canonicalRevision,
    directionLevel: bundle.directionLevel,
    instructions: instructions.map((instruction) => ({
      ...instruction,
      sourceRefs: [...instruction.sourceRefs],
    })),
    warnings: [...bundle.warnings],
    finishingRequirements: bundle.finishingRequirements.map((item) => ({ ...item })),
    unsupportedPreferences: bundle.unsupportedPreferences.map((item) => ({ ...item })),
    sourceRefs: [...bundle.sourceRefs],
  };
}
