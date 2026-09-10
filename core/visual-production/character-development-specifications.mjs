function text(value, maximum = 1_200) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function strings(value, maximumItems = 32, maximumCharacters = 600) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => text(item, maximumCharacters)).filter(Boolean))].slice(0, maximumItems);
}

function sentence(label, values) {
  const list = strings(values);
  return list.length ? `${label}: ${list.join("; ")}.` : "";
}

function commonEvidence(candidatePackage) {
  const evidence = candidatePackage?.characterEvidence || {};
  return {
    physical: strings(evidence.physical),
    performance: strings(evidence.performance),
    wardrobe: strings(evidence.wardrobe),
    props: strings(evidence.props),
    powersEffects: strings(evidence.powersEffects),
    relationships: strings(evidence.relationships),
    locationsWorld: strings(evidence.locationsWorld),
    visualDo: strings(evidence.visualDo, 24),
    visualAvoid: strings(evidence.visualAvoid, 24),
  };
}

function basePrompt(candidatePackage, studyType, lines) {
  const identity = [
    `Character Visual Development candidate for ${text(candidatePackage.characterName, 200) || text(candidatePackage.characterId, 160)}.`,
    text(candidatePackage.characterRole, 300) ? `Canonical role: ${text(candidatePackage.characterRole, 300)}.` : "",
    `Study: ${studyType}.`,
    ...lines,
    "Use only the supplied canonical evidence and approved visual references. Observed references are inspiration only. Do not invent story facts, silently change age/anatomy/wardrobe/props/powers, add text or logos, or treat this generated image as accepted visual identity.",
  ].filter(Boolean);
  return lines.some(Boolean) ? lines.length && baseSanitize(identity.join(" ")) : "";
}

function baseSanitize(value) {
  return text(value, 30_000);
}

function brief(candidatePackage, study, evidence) {
  const common = [
    sentence("Canonical physical evidence", evidence.physical),
    sentence("Visual must-do constraints", evidence.visualDo),
  ];
  const variants = {
    "reference-board": {
      coverageLabels: ["canonical-evidence", "approved-identity", "observed-reference", "visual-do-dont"],
      lines: [...common, sentence("Performance evidence", evidence.performance), sentence("Wardrobe", evidence.wardrobe), sentence("Props", evidence.props), sentence("World/location evidence", evidence.locationsWorld)],
      composition: "Organized character reference board with clear separation between identity, wardrobe/props, performance and environment cues; no written labels inside the generated image.",
    },
    turnaround: {
      coverageLabels: ["front", "three-quarter", "profile", "back", "proportion"],
      lines: [...common, sentence("Wardrobe", evidence.wardrobe), "Keep face, body proportions, age readability, scale and costume identical across front, three-quarter, profile and back views."],
      composition: "Clean full-body turnaround sheet showing front, three-quarter, profile and back views at consistent scale and lighting; no text.",
    },
    expressions: {
      coverageLabels: ["neutral", "major-emotions", "transition", "body-language"],
      lines: [...common, sentence("Canonical performance and emotional evidence", evidence.performance), sentence("Relationship evidence", evidence.relationships), "Show character-specific facial and body-language transitions rather than generic expression icons."],
      composition: "Consistent head-and-shoulders and upper-body expression study with neutral state, major evidence-backed emotions and transitions; no text.",
    },
    movement: {
      coverageLabels: ["resting-posture", "walk-run", "action-silhouette", "gesture-language"],
      lines: [...common, sentence("Performance evidence", evidence.performance), sentence("Props used in movement", evidence.props), "Preserve character-specific posture, gesture vocabulary and physical constraints across poses."],
      composition: "Pose and movement study showing resting posture, walk/run or action silhouette and characteristic gestures at consistent identity and proportions; no text.",
    },
    "wardrobe-props": {
      coverageLabels: ["wardrobe", "hero-props", "carry-wear-use", "continuity"],
      lines: [...common, sentence("Canonical wardrobe", evidence.wardrobe), sentence("Canonical props", evidence.props), sentence("World/location evidence", evidence.locationsWorld), "Show only evidence-backed variants and how important props are carried, worn or used."],
      composition: "Character wardrobe and prop candidate study with consistent identity, material continuity and clear use relationships; no text.",
    },
    "powers-effects": {
      coverageLabels: ["activation", "visual-language", "scale-intensity", "environment-interaction"],
      lines: [...common, sentence("Canonical powers/effects/transformations", evidence.powersEffects), sentence("World/location evidence", evidence.locationsWorld), "Show only canonical capabilities, their activation state and interaction with body, clothing and environment."],
      composition: "Character effects study with consistent identity and evidence-backed activation/intensity variants; no text.",
    },
    "palette-materials": {
      coverageLabels: ["base-palette", "materials", "readability", "lighting-variant"],
      lines: [...common, sentence("Wardrobe/material evidence", evidence.wardrobe), sentence("Prop/material evidence", evidence.props), sentence("World/location evidence", evidence.locationsWorld), "Keep palette and material choices tied to existing evidence rather than implying a new story state."],
      composition: "Character palette and material study showing consistent costume/prop surfaces and readable lighting response; no text or swatch labels.",
    },
    "environment-interaction": {
      coverageLabels: ["scale", "lighting-response", "prop-interaction", "silhouette-readability"],
      lines: [...common, sentence("Canonical world/location evidence", evidence.locationsWorld), sentence("Relationship evidence", evidence.relationships), sentence("Important props", evidence.props), "Preserve character scale, identity and story-supported interaction with the environment."],
      composition: "Character interacting with a canonical environment at production-useful scale and lighting, with clear silhouette and evidence-backed prop interaction; no text.",
    },
  };
  const variant = variants[study.type];
  if (!variant) return null;
  const relevantEvidence = variant.lines.filter((line) => line && !line.startsWith("Keep ") && !line.startsWith("Show ") && !line.startsWith("Preserve "));
  if (!relevantEvidence.length) return null;
  return {
    studyId: study.id,
    ppfRevision: candidatePackage.ppfBaseRevision,
    prompt: basePrompt(candidatePackage, study.type, variant.lines),
    specificationFingerprint: `character-development:${candidatePackage.ppfBaseRevision}:${study.type}:canonical-evidence-v1`,
    coverageLabels: variant.coverageLabels,
    aspect: study.type === "environment-interaction" ? "landscape" : "portrait",
    quality: "medium",
    composition: variant.composition,
    identityLocks: {
      canonicalPhysical: evidence.physical,
      neverChange: evidence.visualDo,
      avoid: evidence.visualAvoid,
    },
    wardrobeLookIds: evidence.wardrobe,
    negativeConstraints: evidence.visualAvoid,
    continuityMetadata: {
      canonicalEvidenceRefs: candidatePackage.canonicalEvidenceRefs,
      performance: evidence.performance,
      props: evidence.props,
      relationships: evidence.relationships,
      locationsWorld: evidence.locationsWorld,
    },
  };
}

export function createCharacterDevelopmentStudySpecifications(candidatePackage) {
  if (!candidatePackage?.packageId || !candidatePackage?.ppfBaseRevision || !Array.isArray(candidatePackage?.studies)) {
    return { status: "blocked", blocker: { code: "package-contract", detail: "A revision-bound Character Visual Development package is required." } };
  }
  const evidence = commonEvidence(candidatePackage);
  const evidenceCount = Object.values(evidence).reduce((total, values) => total + values.length, 0);
  if (!evidenceCount) {
    return { status: "blocked", blocker: { code: "canonical-evidence", detail: "Bounded canonical character evidence is required before PlotPickle can derive generation specifications." } };
  }

  const specifications = [];
  const notApplicable = [];
  for (const study of candidatePackage.studies) {
    if (study.type === "powers-effects" && !evidence.powersEffects.length) {
      notApplicable.push({
        studyId: study.id,
        ppfRevision: candidatePackage.ppfBaseRevision,
        reason: "No canonical power, effect or transformation evidence is present in this revision-bound character package.",
        evidenceRefs: strings(candidatePackage.canonicalEvidenceRefs, 128, 320),
      });
      continue;
    }
    const specification = brief(candidatePackage, study, evidence);
    if (specification?.prompt) specifications.push(specification);
  }
  return { status: "ready", specifications, notApplicable };
}
