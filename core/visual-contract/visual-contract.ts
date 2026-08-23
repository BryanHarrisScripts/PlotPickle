export type VisualConstraintSource =
  | "human"
  | "project"
  | "locked-identity"
  | "accepted-reference"
  | "derived";

export type VisualReferenceRole =
  | "identity"
  | "face"
  | "body-proportion"
  | "gesture"
  | "pose"
  | "wardrobe"
  | "object"
  | "creature"
  | "environment"
  | "architecture"
  | "composition"
  | "palette"
  | "lighting"
  | "surface"
  | "typography"
  | "visual-language"
  | "complete-content";

export type VisualConstraint = {
  readonly id: string;
  readonly text: string;
  readonly source: VisualConstraintSource;
  readonly priority: number;
};

export type VisualContractReference = {
  readonly id: string;
  readonly assetUrl: string;
  readonly roles: readonly VisualReferenceRole[];
  readonly intention: string;
};

export type VisualContractElement = {
  readonly id: string;
  readonly kind: "subject" | "object" | "setting" | "surface" | "light" | "text";
  readonly description: string;
  readonly ownerId?: string;
};

export type VisualContractRelationship = {
  readonly subjectId: string;
  readonly relation: string;
  readonly objectId: string;
};

export type VisualContractValidation = {
  readonly id: string;
  readonly requirement: string;
  readonly source: "hard" | "derived" | "failure-control";
};

export type VisualContract = {
  readonly schemaVersion: 1;
  readonly request: string;
  readonly hardConstraints: readonly VisualConstraint[];
  readonly derivedConstraints: readonly VisualConstraint[];
  readonly openChoices: readonly string[];
  readonly referenceMap: readonly VisualContractReference[];
  readonly macroScene: readonly string[];
  readonly elementInventory: readonly VisualContractElement[];
  readonly relationships: readonly VisualContractRelationship[];
  readonly geometry: readonly string[];
  readonly composition: readonly string[];
  readonly lighting: readonly string[];
  readonly textRequirements: readonly string[];
  readonly failureConstraints: readonly string[];
  readonly validationChecks: readonly VisualContractValidation[];
};

export type BuildVisualContractInput = {
  readonly request: string;
  readonly hardConstraints?: readonly Omit<VisualConstraint, "priority">[];
  readonly derivedConstraints?: readonly Omit<VisualConstraint, "priority" | "source">[];
  readonly openChoices?: readonly string[];
  readonly references?: readonly VisualContractReference[];
  readonly macroScene?: readonly string[];
  readonly elements?: readonly VisualContractElement[];
  readonly relationships?: readonly VisualContractRelationship[];
  readonly geometry?: readonly string[];
  readonly composition?: readonly string[];
  readonly lighting?: readonly string[];
  readonly textRequirements?: readonly string[];
  readonly failureConstraints?: readonly string[];
};

const compact = (values: readonly string[] = []) => values.map((value) => value.trim()).filter(Boolean);

function dedupe<T>(values: readonly T[], key: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const id = key(value);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function buildVisualContract(input: BuildVisualContractInput): VisualContract {
  const hardConstraints = dedupe(
    (input.hardConstraints || []).map((constraint, index) => ({ ...constraint, priority: index + 1 })),
    (constraint) => constraint.id,
  );
  const derivedConstraints = dedupe(
    (input.derivedConstraints || []).map((constraint, index) => ({ ...constraint, source: "derived" as const, priority: hardConstraints.length + index + 1 })),
    (constraint) => constraint.id,
  );
  const failureConstraints = compact(input.failureConstraints);
  const validationChecks: VisualContractValidation[] = [
    ...hardConstraints.map((constraint) => ({ id: `hard:${constraint.id}`, requirement: constraint.text, source: "hard" as const })),
    ...derivedConstraints.map((constraint) => ({ id: `derived:${constraint.id}`, requirement: constraint.text, source: "derived" as const })),
    ...failureConstraints.map((requirement, index) => ({ id: `failure:${index + 1}`, requirement, source: "failure-control" as const })),
  ];

  return {
    schemaVersion: 1,
    request: input.request.trim(),
    hardConstraints,
    derivedConstraints,
    openChoices: compact(input.openChoices),
    referenceMap: dedupe(input.references || [], (reference) => reference.id),
    macroScene: compact(input.macroScene),
    elementInventory: dedupe(input.elements || [], (element) => element.id),
    relationships: input.relationships || [],
    geometry: compact(input.geometry),
    composition: compact(input.composition),
    lighting: compact(input.lighting),
    textRequirements: compact(input.textRequirements),
    failureConstraints,
    validationChecks,
  };
}

function section(title: string, values: readonly string[]) {
  return values.length ? `${title}:\n${values.map((value) => `- ${value}`).join("\n")}` : "";
}

export function compileVisualContractPrompt(contract: VisualContract) {
  const references = contract.referenceMap.map((reference) => {
    const roles = reference.roles.join(", ");
    return `${reference.id} [${roles}]: ${reference.intention}${reference.assetUrl ? ` (${reference.assetUrl})` : ""}`;
  });
  const elements = contract.elementInventory.map((element) => `${element.id} [${element.kind}]${element.ownerId ? ` owned by ${element.ownerId}` : ""}: ${element.description}`);
  const relationships = contract.relationships.map((relationship) => `${relationship.subjectId} ${relationship.relation} ${relationship.objectId}`);

  return [
    "Create one image from the following provider-neutral PlotPickle Visual Contract.",
    "Preserve constraints in priority order. Open choices may fill unspecified details only when they do not conflict with hard or derived constraints.",
    contract.request ? `Request:\n${contract.request}` : "",
    section("Hard constraints", contract.hardConstraints.map((constraint) => `${constraint.priority}. ${constraint.text}`)),
    section("Derived constraints", contract.derivedConstraints.map((constraint) => `${constraint.priority}. ${constraint.text}`)),
    section("Reference map", references),
    section("Macro scene", contract.macroScene),
    section("Element inventory", elements),
    section("Relationships", relationships),
    section("Geometry", contract.geometry),
    section("Composition", contract.composition),
    section("Lighting", contract.lighting),
    section("Text requirements", contract.textRequirements),
    section("Failure controls", contract.failureConstraints),
    section("Open choices", contract.openChoices),
  ].filter(Boolean).join("\n\n");
}
