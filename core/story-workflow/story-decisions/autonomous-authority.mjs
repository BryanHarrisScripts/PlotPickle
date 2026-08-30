export const STORY_DECISION_AUTHORITY_CLASSES = Object.freeze([
  "authenticated-human",
  "delegated-autonomous-operator",
]);

const AUTHORITY_SET = new Set(STORY_DECISION_AUTHORITY_CLASSES);

function authorityString(value, maximum = 240) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function requireAuthorityString(input, field, label, maximum = 240) {
  const value = authorityString(input?.[field], maximum);
  if (!value) throw new Error(`Story Decision ${label} is required.`);
  return value;
}

export function normalizeStoryDecisionAuthority(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Story Decision authority must be an object.");
  }

  const authorityClass = authorityString(input.authorityClass, 80);
  if (!AUTHORITY_SET.has(authorityClass)) {
    throw new Error("Story Decision authority class is invalid.");
  }

  if (authorityClass === "authenticated-human") {
    const humanProfileId = requireAuthorityString(input, "humanProfileId", "Human profile authority", 180);
    if (authorityString(input.autonomousRunId, 180) || authorityString(input.operatorId, 180)) {
      throw new Error("Authenticated Human authority cannot carry autonomous operator identity.");
    }
    return {
      authorityClass,
      humanProfileId,
      delegated: false,
      autonomousRunId: "",
      operatorId: "",
      modelRole: "",
      modelId: "",
      provider: "",
      runtime: "",
    };
  }

  if (input.delegated !== true) {
    throw new Error("Delegated autonomous Story Decision authority must be explicitly enabled.");
  }
  if (authorityString(input.humanProfileId, 180)) {
    throw new Error("Delegated autonomous Story Decision authority cannot impersonate an authenticated Human.");
  }

  return {
    authorityClass,
    humanProfileId: "",
    delegated: true,
    autonomousRunId: requireAuthorityString(input, "autonomousRunId", "autonomous run ID", 180),
    operatorId: requireAuthorityString(input, "operatorId", "autonomous operator ID", 180),
    modelRole: authorityString(input.modelRole, 120),
    modelId: requireAuthorityString(input, "modelId", "autonomous model ID", 240),
    provider: requireAuthorityString(input, "provider", "autonomous provider", 120),
    runtime: requireAuthorityString(input, "runtime", "autonomous runtime", 180),
  };
}

export function storyDecisionAuthorityAudit(input) {
  const authority = normalizeStoryDecisionAuthority(input);
  return {
    authorityClass: authority.authorityClass,
    delegated: authority.delegated,
    humanProfileId: authority.humanProfileId,
    autonomousRunId: authority.autonomousRunId,
    operatorId: authority.operatorId,
    modelRole: authority.modelRole,
    modelId: authority.modelId,
    provider: authority.provider,
    runtime: authority.runtime,
    writesCanon: false,
    requiresWorkbenchValidation: true,
  };
}
