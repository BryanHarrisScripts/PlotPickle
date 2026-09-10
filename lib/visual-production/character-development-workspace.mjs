export const CHARACTER_DEVELOPMENT_WORKSPACE_STATES = Object.freeze([
  "defined",
  "observed",
  "emerging",
  "missing",
  "locked",
  "stale",
  "not-applicable",
]);

const STUDIES = Object.freeze([
  { type: "reference-board", label: "Reference Board" },
  { type: "turnaround", label: "Turnaround / Anatomy" },
  { type: "expressions", label: "Expressions" },
  { type: "movement", label: "Pose / Movement" },
  { type: "wardrobe-props", label: "Wardrobe / Props" },
  { type: "powers-effects", label: "Powers / Effects" },
  { type: "palette-materials", label: "Palette / Materials" },
  { type: "environment-interaction", label: "Environment Interaction" },
]);

function text(value, maximum = 900) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function strings(value, maximumItems = 48, maximumCharacters = 600) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => text(item, maximumCharacters))
    .filter(Boolean))].slice(0, maximumItems);
}

function evidence(value) {
  return {
    physical: strings(value?.physical),
    performance: strings(value?.performance),
    wardrobe: strings(value?.wardrobe),
    props: strings(value?.props),
    powersEffects: strings(value?.powersEffects),
    relationships: strings(value?.relationships),
    locationsWorld: strings(value?.locationsWorld),
    visualDo: strings(value?.visualDo, 24),
    visualAvoid: strings(value?.visualAvoid, 24),
  };
}

function generatedMap(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(STUDIES.map(({ type }) => [type, strings(source[type], 24, 500)]));
}

function inputCountFor(type, source, approvedRefs, observedRefs, referenceAngles) {
  if (type === "reference-board") return approvedRefs.length + observedRefs.length + source.visualDo.length + source.visualAvoid.length;
  if (type === "turnaround") return source.physical.length + source.wardrobe.length + referenceAngles.length;
  if (type === "expressions") return source.physical.length + source.performance.length + source.relationships.length;
  if (type === "movement") return source.physical.length + source.performance.length + source.props.length;
  if (type === "wardrobe-props") return source.wardrobe.length + source.props.length + source.locationsWorld.length;
  if (type === "powers-effects") return source.powersEffects.length + source.locationsWorld.length;
  if (type === "palette-materials") return source.wardrobe.length + source.props.length + source.visualDo.length;
  if (type === "environment-interaction") return source.locationsWorld.length + source.props.length + source.relationships.length;
  return 0;
}

function detailFor(type, state, inputCount, candidateCount, referenceAngles) {
  if (state === "stale") return "Upstream evidence changed. Refresh only this affected study before using it.";
  if (state === "emerging") return `${candidateCount} generated candidate ${candidateCount === 1 ? "asset is" : "assets are"} present and still require review.`;
  if (state === "not-applicable") return "No explicit canonical power/effect evidence is present in this character-development input, so PlotPickle will not invent one.";
  if (type === "reference-board" && inputCount) return "Canonical, accepted and observed source material is available for a reference-board study.";
  if (type === "turnaround" && referenceAngles.length) return `Existing identity references cover ${referenceAngles.join(", ")}; the development study remains separate from the locked identity.`;
  if (state === "defined") return `${inputCount} bounded evidence cue${inputCount === 1 ? " is" : "s are"} available to drive this study.`;
  return "No generated development candidate is present yet. Existing canon and visual identity remain unchanged.";
}

export function createCharacterDevelopmentWorkspaceProjection(input = {}) {
  const source = evidence(input.characterEvidence);
  const approvedRefs = strings(input.approvedVisualRefs, 24, 500);
  const observedRefs = strings(input.observedVisualRefs, 24, 500).filter((ref) => !approvedRefs.includes(ref));
  const referenceAngles = strings(input.referenceAngles, 12, 80);
  const generated = generatedMap(input.generatedStudyRefs);
  const stale = new Set(strings(input.staleStudyTypes, STUDIES.length, 80));
  const identityStatus = text(input.identityStatus, 40);
  const canonicalCount = Object.values(source).reduce((total, values) => total + values.length, 0);

  const evidenceLanes = [
    {
      id: "canonical-character",
      label: "Canonical character evidence",
      state: canonicalCount ? "defined" : "missing",
      count: canonicalCount,
      detail: canonicalCount ? "Current PPF character and world evidence is available to shape studies." : "Add canonical character evidence before deriving visual studies.",
    },
    {
      id: "accepted-identity",
      label: "Accepted visual identity",
      state: identityStatus === "locked" ? "locked" : approvedRefs.length ? "defined" : "missing",
      count: approvedRefs.length,
      detail: identityStatus === "locked"
        ? "The current visual identity is locked. Development candidates cannot replace it without the existing approval path."
        : approvedRefs.length
          ? "Approved visual references exist, but the identity is not locked."
          : "No approved visual references are available yet.",
    },
    {
      id: "observed-references",
      label: "Observed references",
      state: observedRefs.length ? "observed" : "missing",
      count: observedRefs.length,
      detail: observedRefs.length ? "These references may inform exploration but are not accepted identity evidence." : "No observed or draft references are currently attached.",
    },
  ];

  const studies = STUDIES.map(({ type, label }) => {
    const candidateCount = generated[type].length;
    const inputCount = inputCountFor(type, source, approvedRefs, observedRefs, referenceAngles);
    let state = "missing";
    if (stale.has(type)) state = "stale";
    else if (candidateCount) state = "emerging";
    else if (type === "powers-effects" && !source.powersEffects.length) state = "not-applicable";
    else if (inputCount) state = "defined";
    return {
      type,
      label,
      state,
      inputCount,
      candidateCount,
      candidateRefs: generated[type],
      detail: detailFor(type, state, inputCount, candidateCount, referenceAngles),
    };
  });

  return {
    projectId: text(input.projectId, 180),
    ppfRevision: text(input.ppfRevision, 180),
    characterId: text(input.characterId, 180),
    characterName: text(input.characterName, 200),
    identityStatus,
    evidenceLanes,
    studies,
    summary: {
      defined: studies.filter((study) => study.state === "defined").length,
      observed: evidenceLanes.filter((lane) => lane.state === "observed").length,
      emerging: studies.filter((study) => study.state === "emerging").length,
      missing: studies.filter((study) => study.state === "missing").length,
      locked: evidenceLanes.filter((lane) => lane.state === "locked").length,
      stale: studies.filter((study) => study.state === "stale").length,
      notApplicable: studies.filter((study) => study.state === "not-applicable").length,
    },
  };
}
