import {
  cloneProject,
  type AiProvenanceRecord,
  type PlotPickleProject,
  type RevisionSnapshot,
  type SourceAttribution,
} from "./project";

export type SpecialistLabKind = "prompt" | "dialogue" | "research" | "visual" | "provenance";

export type SpecialistSuggestion = {
  id: string;
  lab: SpecialistLabKind;
  title: string;
  summary: string;
  target: string;
  before: string;
  after: string;
  prompt: string;
  generated: boolean;
  createdAt: string;
  metadata: Record<string, string>;
};

export type SpecialistPassRecord = {
  id: string;
  lab: SpecialistLabKind;
  title: string;
  summary: string;
  target: string;
  before: string;
  after: string;
  prompt: string;
  generated: boolean;
  approvedAt: string;
  provenanceId: string;
};

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function timestamp() {
  return new Date().toISOString();
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function contentHash(value: unknown) {
  const source = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function appendParagraph(current: string, next: string) {
  return [current.trim(), next.trim()].filter(Boolean).join("\n\n");
}

export function createSpecialistSuggestion(input: Omit<SpecialistSuggestion, "id" | "createdAt">): SpecialistSuggestion {
  return { ...input, id: makeId("lab-suggestion"), createdAt: timestamp() };
}

export function buildSpecialistProjectContext(project: PlotPickleProject) {
  const characterContext = project.characters
    .map((character) => `${character.name}: role ${character.role}; want ${character.want}; need ${character.need}; voice ${character.voice}`)
    .join(" | ");
  const blockContext = project.blocks
    .map((block) => `Block ${block.number} ${block.title}: ${block.summary}; goal ${block.goal}; conflict ${block.conflict}; turn ${block.choice || block.emotionalTurn}`)
    .join("\n");
  return [
    `Project: ${project.metadata.title}`,
    `Format: ${project.metadata.format}; genre: ${project.metadata.genre}; tone: ${project.metadata.tone}`,
    `Premise: ${project.story.premise}`,
    `Logline: ${project.story.logline}`,
    `Theme: ${project.story.theme}; anti-theme: ${project.story.antiTheme}`,
    `Dramatic question: ${project.story.dramaticQuestion}`,
    `World rules: ${project.world.rules}`,
    `Visual language: ${project.world.visualLanguage}`,
    `Characters: ${characterContext}`,
    blockContext,
  ].filter(Boolean).join("\n");
}

function createAiRecord(suggestion: SpecialistSuggestion): AiProvenanceRecord {
  const operation: AiProvenanceRecord["operation"] = suggestion.lab === "dialogue"
    ? "dialogue"
    : suggestion.lab === "visual"
      ? "image"
      : suggestion.lab === "research"
        ? "analysis"
        : suggestion.metadata.operation === "rewrite"
          ? "rewrite"
          : suggestion.metadata.operation === "image"
            ? "image"
            : "brainstorm";
  return {
    id: makeId("ai-provenance"),
    provider: suggestion.metadata.provider || "Connected provider",
    model: suggestion.metadata.model || "Configured model",
    operation,
    promptSummary: suggestion.prompt || suggestion.title,
    outputSummary: suggestion.after,
    humanContribution: suggestion.metadata.humanContribution || "The writer supplied the story context, direction and approval decision.",
    humanDecision: suggestion.metadata.humanDecision || `Approved in the ${suggestion.lab} specialist lab.`,
    retained: true,
    attachedTo: [suggestion.target, suggestion.metadata.assetUrl].filter(Boolean),
    createdAt: timestamp(),
  };
}

function capturePayload(project: PlotPickleProject, pass: SpecialistPassRecord): Record<string, unknown> {
  return {
    projectTitle: project.metadata.title,
    story: structuredClone(project.story),
    blocks: project.blocks.map((block) => ({
      id: block.id,
      number: block.number,
      title: block.title,
      summary: block.summary,
      goal: block.goal,
      conflict: block.conflict,
      choice: block.choice,
      action: block.action,
      consequence: block.consequence,
    })),
    scenes: project.blocks.flatMap((block) => block.scenes.map((scene, order) => ({
      id: scene.id,
      blockNumber: block.number,
      order,
      title: scene.title,
      sceneType: scene.sceneType,
      purpose: scene.purpose,
      entryCondition: scene.entryCondition,
      exitCondition: scene.exitCondition,
      objective: scene.objective,
      opposition: scene.opposition,
      action: scene.action,
      reversal: scene.reversal,
      outcome: scene.outcome,
      charactersEntering: scene.charactersEntering,
      charactersLeaving: scene.charactersLeaving,
      estimatedSeconds: scene.estimatedSeconds,
      pageEstimate: scene.pageEstimate,
      threadIds: scene.threadIds,
      miniBlockIds: scene.miniBlocks.map((mini) => mini.id),
      shortScenes: scene.miniBlocks.flatMap((mini) => mini.shortScenes),
    }))),
    screenplayElements: structuredClone(project.screenplay.draftElements),
    characterArcs: project.characters.map((character) => ({ characterId: character.id, name: character.name, arcMatrix: structuredClone(character.arcMatrix) })),
    storyThreads: structuredClone(project.storyThreads),
    _specialistPass: pass,
  };
}

function appendPass(project: PlotPickleProject, suggestion: SpecialistSuggestion, provenanceId: string) {
  const pass: SpecialistPassRecord = {
    id: suggestion.id,
    lab: suggestion.lab,
    title: suggestion.title,
    summary: suggestion.summary,
    target: suggestion.target,
    before: suggestion.before,
    after: suggestion.after,
    prompt: suggestion.prompt,
    generated: suggestion.generated,
    approvedAt: timestamp(),
    provenanceId,
  };
  const payload = capturePayload(project, pass);
  const snapshot: RevisionSnapshot = {
    id: makeId("revision"),
    label: `${suggestion.lab.toUpperCase()} Lab · ${suggestion.title}`,
    notes: `Approved specialist pass for ${suggestion.target}. Before and after evidence is stored in the canonical revision payload.`,
    createdAt: pass.approvedAt,
    schemaVersion: "1.7.0",
    contentHash: contentHash(payload),
    payload,
  };
  return { ...project, revisions: [...project.revisions, snapshot] };
}

export function applySpecialistSuggestion(project: PlotPickleProject, suggestion: SpecialistSuggestion): PlotPickleProject {
  let next = cloneProject(project);
  let provenanceId = "";

  if (suggestion.lab === "dialogue") {
    next.screenplay = {
      ...next.screenplay,
      draftElements: next.screenplay.draftElements.map((element) => element.id === suggestion.target
        ? { ...element, text: suggestion.after, updatedAt: timestamp() }
        : element),
    };
  }

  if (suggestion.lab === "research") {
    const attribution: SourceAttribution = {
      id: makeId("attribution"),
      title: suggestion.metadata.sourceTitle || suggestion.title,
      creator: suggestion.metadata.creator || "Unknown creator",
      sourceType: "research",
      sourceUrl: suggestion.metadata.sourceUrl || "",
      licence: suggestion.metadata.licence || "Research reference only",
      permissionReference: suggestion.metadata.permissionReference || "",
      notes: suggestion.after,
      attachedTo: [suggestion.target || "canon-binder"],
      createdAt: timestamp(),
    };
    next.rights = { ...next.rights, attributions: [...next.rights.attributions, attribution] };
    next.development = {
      ...next.development,
      notes: {
        ...next.development.notes,
        research: appendParagraph(next.development.notes.research, `CANON · ${attribution.title}\n${suggestion.after}`),
        sources: appendParagraph(next.development.notes.sources, [attribution.creator, attribution.sourceUrl, attribution.licence].filter(Boolean).join(" · ")),
      },
    };
  }

  if (suggestion.lab === "visual") {
    next.world = { ...next.world, visualLanguage: suggestion.after };
  }

  if (suggestion.generated || suggestion.lab === "provenance") {
    const record = createAiRecord(suggestion);
    provenanceId = record.id;
    next.rights = { ...next.rights, aiProvenance: [...next.rights.aiProvenance, record] };
  }

  next.metadata = { ...next.metadata, updatedAt: timestamp() };
  return appendPass(next, suggestion, provenanceId);
}

export function savedSpecialistPasses(project: PlotPickleProject): SpecialistPassRecord[] {
  return project.revisions.flatMap((revision) => {
    const pass = revision.payload?._specialistPass;
    if (!pass || typeof pass !== "object") return [];
    const candidate = pass as Partial<SpecialistPassRecord>;
    if (!candidate.id || !candidate.lab || !candidate.title) return [];
    return [candidate as SpecialistPassRecord];
  }).sort((left, right) => right.approvedAt.localeCompare(left.approvedAt));
}

export function projectGeneratedAssets(project: PlotPickleProject) {
  return [
    ...project.characters.filter((character) => text(character.image)).map((character) => ({ id: character.id, label: character.name, kind: "Character", src: character.image, prompt: "" })),
    ...project.world.locations.filter((location) => text(location.image)).map((location) => ({ id: location.id, label: location.name, kind: "Location", src: location.image, prompt: "" })),
    ...project.blocks.flatMap((block) => block.visuals.filter((visual) => text(visual.src)).map((visual) => ({ id: visual.id, label: `Block ${block.number}.${visual.miniBlockNumber}`, kind: "Storyboard", src: visual.src, prompt: visual.prompt }))),
  ];
}
