const STUDY_TYPES = [
  "reference-board",
  "turnaround",
  "expressions",
  "movement",
  "wardrobe-props",
  "powers-effects",
  "palette-materials",
  "environment-interaction",
];

export const CHARACTER_DEVELOPMENT_STUDY_TYPES = Object.freeze([...STUDY_TYPES]);

function text(value, limit = 500) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function references(value, limit = 128) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => text(item, 320)).filter(Boolean))].slice(0, limit);
}

function identifier(value, fallback) {
  const cleaned = text(value, 160).replace(/[^a-zA-Z0-9:._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function blocked(code, detail) {
  return { status: "blocked", blocker: { code, detail } };
}

function providerPolicy(route) {
  const runtime = text(route?.runtime, 40);
  const costClass = text(route?.costClass, 40);
  const cloud = runtime === "cloud" || costClass.includes("cloud");
  if (cloud && route?.consentState !== "approved") {
    return "Cloud image generation requires explicit current consent.";
  }
  if (costClass === "paid-cloud" && route?.budgetState !== "approved") {
    return "Paid cloud image generation requires explicit current budget approval.";
  }
  return "";
}

function authorityPolicy(authority) {
  const authorityClass = text(authority?.authorityClass, 80);
  if (authorityClass === "authenticated-human") {
    return authority?.authenticatedHuman === true ? "" : "Autonomous or unauthenticated work cannot claim authenticated-Human authority.";
  }
  if (authorityClass === "delegated-autonomous-operator") {
    return text(authority?.autonomousRunId, 160) ? "" : "Delegated autonomous work requires a bounded autonomous run ID.";
  }
  if (authorityClass === "host") return "";
  return "Character visual development requires host, authenticated-Human, or delegated autonomous authority.";
}

function normalizeProviderRoute(route) {
  return {
    provider: text(route?.provider, 100),
    runtime: text(route?.runtime, 40),
    model: text(route?.model, 160),
    costClass: text(route?.costClass, 40),
    consentState: text(route?.consentState, 40),
    budgetState: text(route?.budgetState, 40),
  };
}

function normalizeAuthority(authority) {
  return {
    authorityClass: text(authority?.authorityClass, 80),
    authenticatedHuman: authority?.authorityClass === "authenticated-human" && authority?.authenticatedHuman === true,
    autonomousRunId: authority?.authorityClass === "delegated-autonomous-operator" ? text(authority?.autonomousRunId, 160) : "",
  };
}

export function createCharacterDevelopmentPackage(input) {
  const projectId = identifier(input?.projectId, "");
  const ppfRevision = text(input?.ppfRevision, 120);
  const characterId = identifier(input?.character?.id, "");
  if (!projectId || !ppfRevision || !characterId) {
    return blocked("input-contract", "Project ID, exact PPF revision, and canonical character ID are required.");
  }

  const authorityFailure = authorityPolicy(input?.authority);
  if (authorityFailure) return blocked("authority-policy", authorityFailure);
  const routeFailure = providerPolicy(input?.providerRoute);
  if (routeFailure) return blocked("provider-policy", routeFailure);

  const requested = references(input?.targetStudyTypes, STUDY_TYPES.length)
    .filter((studyType) => STUDY_TYPES.includes(studyType));
  if (!requested.length) return blocked("input-contract", "At least one recognized character-development study is required.");

  const canonicalEvidenceRefs = references(input?.canonicalEvidenceRefs);
  if (!canonicalEvidenceRefs.length) {
    return blocked("input-contract", "Character development requires explicit canonical PPF evidence references.");
  }
  const approvedVisualRefs = references(input?.approvedVisualRefs);
  const observedRefs = references(input?.observedRefs);
  const createdAt = text(input?.createdAt, 80) || new Date().toISOString();
  const packageId = `character-development:${projectId}:${characterId}:${identifier(ppfRevision, "revision")}`;
  const providerRoute = normalizeProviderRoute(input?.providerRoute);

  return {
    status: "ready",
    package: {
      schemaVersion: 1,
      packageId,
      packageVersion: 1,
      projectId,
      ppfBaseRevision: ppfRevision,
      characterId,
      characterName: text(input?.character?.name, 200),
      characterRole: text(input?.character?.role, 300),
      canonicalEvidenceRefs,
      approvedVisualRefs,
      observedRefs,
      providerRoute,
      authority: normalizeAuthority(input?.authority),
      createdAt,
      reviewState: "candidate",
      acceptedArtifactId: "",
      consistencyFindings: [],
      studies: requested.map((type, index) => ({
        id: `${packageId}:study:${index + 1}:${type}`,
        type,
        version: 1,
        sourceEvidenceRefs: [...canonicalEvidenceRefs],
        approvedVisualRefs: [...approvedVisualRefs],
        observedRefs: [...observedRefs],
        dependencyRefs: [...canonicalEvidenceRefs, ...approvedVisualRefs],
        provider: { ...providerRoute },
        specificationFingerprint: text(input?.specificationFingerprint, 200),
        seed: text(input?.seed, 120),
        settings: {},
        parentCandidateId: "",
        generatedCandidateRefs: [],
        consistencyFindings: [],
        reviewState: "candidate",
        stale: false,
        staleReason: "",
        changedEvidenceRefs: [],
        acceptedArtifactId: "",
        createdAt,
      })),
    },
  };
}

export function markCharacterDevelopmentStale(candidatePackage, changedEvidenceRefs, reason) {
  const changed = new Set(references(changedEvidenceRefs));
  const staleReason = text(reason, 600) || "A dependency changed.";
  return {
    ...candidatePackage,
    studies: candidatePackage.studies.map((study) => {
      const affected = references(study.dependencyRefs).filter((reference) => changed.has(reference));
      return affected.length ? {
        ...study,
        stale: true,
        staleReason,
        changedEvidenceRefs: affected,
      } : study;
    }),
  };
}

export function recordConsistencyFindings(candidatePackage, findings) {
  const studyIds = new Set(candidatePackage.studies.map((study) => study.id));
  const normalized = (Array.isArray(findings) ? findings : []).flatMap((finding, index) => {
    const relatedStudies = references(finding?.studyIds, 16).filter((studyId) => studyIds.has(studyId));
    const detail = text(finding?.detail, 800);
    if (!relatedStudies.length || !detail) return [];
    return [{
      id: `${candidatePackage.packageId}:finding:${index + 1}`,
      code: identifier(finding?.code, "consistency-drift"),
      dimension: identifier(finding?.dimension, "cross-study"),
      studyIds: relatedStudies,
      detail,
      severity: finding?.severity === "blocking" ? "blocking" : "warning",
    }];
  });
  return { ...candidatePackage, consistencyFindings: normalized };
}

export function linkAcceptedVisualArtifact(candidatePackage, artifactId, acceptedVisualArtifactIds) {
  const accepted = new Set(references(acceptedVisualArtifactIds));
  const normalizedArtifactId = text(artifactId, 320);
  if (!normalizedArtifactId || !accepted.has(normalizedArtifactId)) {
    throw new Error("Character development can link only through the existing visual artifact acceptance path.");
  }
  return {
    ...candidatePackage,
    reviewState: "accepted",
    acceptedArtifactId: normalizedArtifactId,
  };
}

export function toVisualReadinessEvidence(candidatePackage) {
  const accepted = Boolean(candidatePackage.acceptedArtifactId) && candidatePackage.reviewState === "accepted";
  return {
    id: candidatePackage.packageId,
    kind: "character",
    label: candidatePackage.characterName || candidatePackage.characterId,
    approved: accepted,
    sourceRef: accepted ? candidatePackage.acceptedArtifactId : "",
  };
}
