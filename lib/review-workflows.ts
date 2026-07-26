import { createHash } from "node:crypto";
import type { PlotPickleProject, ReviewPriority } from "./project";
import {
  createFeedback,
  createStoredFeedbackModel,
  type CreateFeedbackInput,
} from "./unified-feedback-store";
import type {
  FeedbackAuthorRole,
  FeedbackCategory,
  FeedbackStatus,
  FeedbackTargetReference,
  UnifiedFeedbackRecord,
} from "./unified-feedback";

export type AiReviewScope =
  | "project"
  | "act"
  | "sequence"
  | "selected-blocks"
  | "all-blocks"
  | "selected-mini-blocks"
  | "all-mini-blocks"
  | "character-arc"
  | "treatment"
  | "screenplay"
  | "scenes"
  | "storyboard-continuity";

export type AiReviewLens =
  | "story-editor"
  | "instructor"
  | "director"
  | "producer"
  | "actor"
  | "dialogue-specialist"
  | "continuity-reviewer"
  | "visual-continuity-reviewer"
  | "audience-reader"
  | "pacing-analyst"
  | "structure-analyst";

export type ReviewPriorityBand = ReviewPriority;
export type HumanReviewStatus = "draft" | "requested" | "in-progress" | "submitted" | "resolved" | "cancelled";
export type RevisionProposalStatus = "proposed" | "approved" | "rejected" | "superseded";

export const AI_REVIEW_SCOPES: Array<{ id: AiReviewScope; label: string; description: string }> = [
  { id: "project", label: "Whole project", description: "Premise, characters, structure, screenplay and visuals at summary level." },
  { id: "act", label: "Selected act", description: "One act and its sequences, Blocks, scenes and mini-blocks." },
  { id: "sequence", label: "Selected sequence", description: "One sequence and its two canonical Blocks." },
  { id: "selected-blocks", label: "Selected Blocks", description: "A writer-chosen set of stable Block IDs." },
  { id: "all-blocks", label: "All 24 Blocks", description: "The complete Block spine in canonical story order." },
  { id: "selected-mini-blocks", label: "Selected mini-blocks", description: "A writer-chosen set of stable mini-block IDs." },
  { id: "all-mini-blocks", label: "All 96 mini-blocks", description: "The complete movement wall in canonical order." },
  { id: "character-arc", label: "Character arc", description: "One character, arc checkpoints and linked story evidence." },
  { id: "treatment", label: "Treatment", description: "Treatment text and the story records that support it." },
  { id: "screenplay", label: "Screenplay", description: "Current screenplay elements with stable scene and Block links." },
  { id: "scenes", label: "Selected scenes", description: "Writer-selected scenes and their mini-block movements." },
  { id: "storyboard-continuity", label: "Storyboard continuity", description: "Frames, visual directions, continuity notes and linked movements." },
];

export const AI_REVIEW_LENSES: Array<{ id: AiReviewLens; label: string; instruction: string }> = [
  { id: "story-editor", label: "Story editor", instruction: "Evaluate causality, dramatic clarity, character pressure, setup and payoff." },
  { id: "instructor", label: "Instructor", instruction: "Explain craft strengths and problems in teachable language with practical next steps." },
  { id: "director", label: "Director", instruction: "Evaluate playable action, scene intention, visual storytelling, coverage and performance opportunity." },
  { id: "producer", label: "Producer", instruction: "Evaluate audience promise, scope, producibility, priorities, risk and decision readiness." },
  { id: "actor", label: "Actor", instruction: "Evaluate objectives, tactics, relationships, playable turns, subtext and character continuity." },
  { id: "dialogue-specialist", label: "Dialogue specialist", instruction: "Evaluate voice distinction, subtext, exposition, rhythm, intention and speakability." },
  { id: "continuity-reviewer", label: "Continuity reviewer", instruction: "Identify contradictions, missing transitions, state changes, chronology and unresolved dependencies." },
  { id: "visual-continuity-reviewer", label: "Visual continuity reviewer", instruction: "Evaluate frame-to-frame identity, geography, props, wardrobe, lighting and visual progression." },
  { id: "audience-reader", label: "Audience reader", instruction: "Report likely comprehension, expectation, emotion, confusion, momentum and payoff." },
  { id: "pacing-analyst", label: "Pacing analyst", instruction: "Evaluate runtime distribution, escalation, repetition, scene weight, compression and breathing room." },
  { id: "structure-analyst", label: "Structure analyst", instruction: "Evaluate act, sequence, Block and mini-block architecture against the project’s own story promise." },
];

export type AiProviderSnapshot = {
  connected: boolean;
  provider: string;
  model: string;
  checkedAt: string;
};

export type AiReviewNotice = {
  privacy: string;
  context: string;
  cost: string;
  writerControl: string;
  requiresOnlineProvider: boolean;
};

export type AiReviewContextItem = {
  target: FeedbackTargetReference;
  heading: string;
  content: string;
};

export type AiReviewRequest = {
  id: string;
  scope: AiReviewScope;
  lens: AiReviewLens;
  targetIds: string[];
  customQuestions: string[];
  provider: string;
  model: string;
  requestedAt: string;
  notice: AiReviewNotice;
  contextItems: AiReviewContextItem[];
  contextCharacters: number;
  estimatedInputTokens: number;
  instructions: string;
  prompt: string;
  promptHash: string;
};

export type AiReviewFinding = {
  id: string;
  target: FeedbackTargetReference;
  title: string;
  body: string;
  priority: ReviewPriorityBand;
  category: FeedbackCategory;
  proposedChange: string;
  evidence: string;
};

export type AiReviewResult = {
  id: string;
  requestId: string;
  provider: string;
  model: string;
  completedAt: string;
  promptHash: string;
  projectSummary: string;
  findings: AiReviewFinding[];
  recurringPatterns: string[];
  priorities: string[];
  rawOutput: string;
};

export type HumanReviewerIdentity = {
  name: string;
  role: FeedbackAuthorRole;
  organisation: string;
  contact: string;
};

export type HumanReviewRequest = {
  id: string;
  title: string;
  reviewer: HumanReviewerIdentity;
  target: FeedbackTargetReference;
  questions: string[];
  requestedAt: string;
  dueAt: string;
  status: HumanReviewStatus;
  githubProposalUrl: string;
  githubProposalNumber: number | null;
};

export type ReviewRevisionProposal = {
  id: string;
  feedbackId: string;
  target: FeedbackTargetReference;
  title: string;
  rationale: string;
  proposedChange: string;
  status: RevisionProposalStatus;
  createdAt: string;
  approvedAt: string;
  approvedBy: string;
  githubProposalUrl: string;
  githubProposalNumber: number | null;
};

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function now() {
  return new Date().toISOString();
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values: string[]) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function promptHash(value: string) {
  return `sha256-${createHash("sha256").update(value).digest("hex").slice(0, 20)}`;
}

function projectTarget(project: PlotPickleProject): FeedbackTargetReference {
  return {
    kind: "project",
    targetId: project.id,
    label: project.metadata.title,
    workspace: "feedback",
    blockId: "",
    miniBlockId: "",
    sceneId: "",
    characterId: "",
    frameId: "",
    screenplayElementId: "",
    productionItemId: "",
  };
}

function blockTarget(project: PlotPickleProject, blockId: string): FeedbackTargetReference | null {
  const block = project.blocks.find((candidate) => candidate.id === blockId);
  if (!block) return null;
  return {
    kind: "block",
    targetId: block.id,
    label: `Block ${block.number} · ${block.title}`,
    workspace: "build",
    blockId: block.id,
    miniBlockId: "",
    sceneId: "",
    characterId: "",
    frameId: "",
    screenplayElementId: "",
    productionItemId: "",
  };
}

function miniBlockTarget(project: PlotPickleProject, miniBlockId: string): FeedbackTargetReference | null {
  for (const block of project.blocks) {
    for (const scene of block.scenes) {
      const mini = scene.miniBlocks.find((candidate) => candidate.id === miniBlockId);
      if (!mini) continue;
      return {
        kind: "mini-block",
        targetId: mini.id,
        label: `Block ${block.number} · ${mini.label || `Mini-block ${mini.number}`}`,
        workspace: "build",
        blockId: block.id,
        miniBlockId: mini.id,
        sceneId: scene.id,
        characterId: mini.characterId,
        frameId: "",
        screenplayElementId: "",
        productionItemId: "",
      };
    }
  }
  return null;
}

function sceneTarget(project: PlotPickleProject, sceneId: string): FeedbackTargetReference | null {
  for (const block of project.blocks) {
    const scene = block.scenes.find((candidate) => candidate.id === sceneId);
    if (!scene) continue;
    return {
      kind: "scene",
      targetId: scene.id,
      label: `Block ${block.number} · ${scene.title}`,
      workspace: "write",
      blockId: block.id,
      miniBlockId: "",
      sceneId: scene.id,
      characterId: "",
      frameId: "",
      screenplayElementId: "",
      productionItemId: "",
    };
  }
  return null;
}

function characterTarget(project: PlotPickleProject, characterId: string): FeedbackTargetReference | null {
  const character = project.characters.find((candidate) => candidate.id === characterId);
  if (!character) return null;
  return {
    kind: "character",
    targetId: character.id,
    label: character.name || "Character",
    workspace: "plan",
    blockId: "",
    miniBlockId: "",
    sceneId: "",
    characterId: character.id,
    frameId: "",
    screenplayElementId: "",
    productionItemId: "",
  };
}

function blockContent(project: PlotPickleProject, blockId: string) {
  const block = project.blocks.find((candidate) => candidate.id === blockId);
  if (!block) return "";
  return [
    `Block ${block.number}: ${block.title}`,
    `Purpose: ${block.purpose}`,
    `Summary: ${block.summary}`,
    `Goal: ${block.goal}`,
    `Conflict: ${block.conflict}`,
    `Choice: ${block.choice}`,
    `Consequence: ${block.consequence}`,
    `Emotional turn: ${block.emotionalTurn}`,
    `Setup: ${block.setup}`,
    `Payoff: ${block.payoff}`,
    ...block.scenes.map((scene) => `Scene ${scene.number}: ${scene.title}\nPurpose: ${scene.purpose}\nTurn: ${scene.turn || scene.reversal}\nOutcome: ${scene.outcome}`),
  ].filter(Boolean).join("\n");
}

function miniBlockContent(project: PlotPickleProject, miniBlockId: string) {
  for (const block of project.blocks) {
    for (const scene of block.scenes) {
      const mini = scene.miniBlocks.find((candidate) => candidate.id === miniBlockId);
      if (!mini) continue;
      return [
        `Block ${block.number} · Scene ${scene.number} · Mini-block ${mini.number}: ${mini.label}`,
        `Function: ${mini.function}`,
        `Purpose: ${mini.purpose}`,
        `Objective: ${mini.objective}`,
        `Resistance: ${mini.resistance}`,
        `Action: ${mini.action}`,
        `Revelation: ${mini.revelation}`,
        `Turn: ${mini.turn}`,
        `Entry state: ${mini.entryState}`,
        `Exit state: ${mini.exitState}`,
        `Setup: ${mini.setup}`,
        `Payoff: ${mini.payoff}`,
      ].filter(Boolean).join("\n");
    }
  }
  return "";
}

function sceneContent(project: PlotPickleProject, sceneId: string) {
  for (const block of project.blocks) {
    const scene = block.scenes.find((candidate) => candidate.id === sceneId);
    if (!scene) continue;
    return [
      `Block ${block.number} · Scene ${scene.number}: ${scene.title}`,
      `Purpose: ${scene.purpose}`,
      `Objective: ${scene.objective}`,
      `Opposition: ${scene.opposition}`,
      `Action: ${scene.action}`,
      `Reversal: ${scene.reversal}`,
      `Turn: ${scene.turn}`,
      `Outcome: ${scene.outcome}`,
      `Entry condition: ${scene.entryCondition}`,
      `Exit condition: ${scene.exitCondition}`,
    ].filter(Boolean).join("\n");
  }
  return "";
}

function characterContent(project: PlotPickleProject, characterId: string) {
  const character = project.characters.find((candidate) => candidate.id === characterId);
  if (!character) return "";
  return [
    `Character: ${character.name}`,
    `Role: ${character.role}`,
    `Description: ${character.description}`,
    `Want: ${character.want}`,
    `Need: ${character.need}`,
    `Ghost: ${character.ghost}`,
    `Flaw: ${character.fatalFlaw}`,
    `Strengths: ${character.strengths}`,
    `Arc: ${character.arc}`,
    `Voice: ${character.voice}`,
    `Starting state: ${character.arcMatrix.startingState}`,
    `Midpoint shift: ${character.arcMatrix.midpointShift}`,
    `Crisis choice: ${character.arcMatrix.crisisChoice}`,
    `Climax choice: ${character.arcMatrix.climaxChoice}`,
    `Ending state: ${character.arcMatrix.endingState}`,
  ].filter(Boolean).join("\n");
}

function screenplayContent(project: PlotPickleProject) {
  if (project.screenplay.draftElements.length) {
    return project.screenplay.draftElements.map((element) => `${element.type.toUpperCase()} [${element.id}]\n${element.text}`).join("\n\n");
  }
  return project.screenplay.sourceText;
}

function treatmentContent(project: PlotPickleProject) {
  return project.blocks.map((block) => `Block ${block.number}: ${block.title}\n${block.summary || block.scriptExcerpt}`).join("\n\n");
}

function storyboardContent(project: PlotPickleProject) {
  return project.blocks.map((block) => [
    `Block ${block.number}: ${block.title}`,
    `Direction: ${block.storyboardDirection}`,
    ...block.visuals.map((frame) => `Frame ${frame.id} · Mini ${frame.miniBlockNumber}\nCaption: ${frame.caption}\nShot: ${frame.shot}\nContinuity: ${frame.continuity}\nPrompt: ${frame.prompt}`),
  ].join("\n")).join("\n\n");
}

export function buildAiReviewContext(
  project: PlotPickleProject,
  scope: AiReviewScope,
  targetIds: string[] = [],
): AiReviewContextItem[] {
  const ids = unique(targetIds);
  if (scope === "selected-blocks") return ids.flatMap((id) => {
    const target = blockTarget(project, id);
    return target ? [{ target, heading: target.label, content: blockContent(project, id) }] : [];
  });
  if (scope === "all-blocks") return project.blocks.map((block) => ({ target: blockTarget(project, block.id)!, heading: `Block ${block.number}`, content: blockContent(project, block.id) }));
  if (scope === "selected-mini-blocks") return ids.flatMap((id) => {
    const target = miniBlockTarget(project, id);
    return target ? [{ target, heading: target.label, content: miniBlockContent(project, id) }] : [];
  });
  if (scope === "all-mini-blocks") return project.blocks.flatMap((block) => block.scenes.flatMap((scene) => scene.miniBlocks.map((mini) => ({ target: miniBlockTarget(project, mini.id)!, heading: `Mini-block ${mini.id}`, content: miniBlockContent(project, mini.id) }))));
  if (scope === "scenes") return ids.flatMap((id) => {
    const target = sceneTarget(project, id);
    return target ? [{ target, heading: target.label, content: sceneContent(project, id) }] : [];
  });
  if (scope === "character-arc") return ids.slice(0, 1).flatMap((id) => {
    const target = characterTarget(project, id);
    return target ? [{ target, heading: target.label, content: characterContent(project, id) }] : [];
  });
  if (scope === "act") {
    const act = Number(ids[0]);
    return project.blocks.filter((block) => block.act === act).map((block) => ({ target: blockTarget(project, block.id)!, heading: `Act ${act} · Block ${block.number}`, content: blockContent(project, block.id) }));
  }
  if (scope === "sequence") {
    const sequence = Number(ids[0]);
    return project.blocks.filter((block) => block.sequenceNumber === sequence).map((block) => ({ target: blockTarget(project, block.id)!, heading: `Sequence ${sequence} · Block ${block.number}`, content: blockContent(project, block.id) }));
  }
  if (scope === "treatment") return [{ target: { ...projectTarget(project), kind: "treatment", targetId: "treatment", label: `${project.metadata.title} · Treatment`, workspace: "plan" }, heading: "Treatment", content: treatmentContent(project) }];
  if (scope === "screenplay") return [{ target: { ...projectTarget(project), kind: "screenplay", targetId: "screenplay", label: `${project.metadata.title} · Screenplay`, workspace: "write", screenplayElementId: "screenplay" }, heading: "Screenplay", content: screenplayContent(project) }];
  if (scope === "storyboard-continuity") return [{ target: { ...projectTarget(project), kind: "visual-identity", targetId: "storyboard-continuity", label: `${project.metadata.title} · Storyboard continuity`, workspace: "storyboard" }, heading: "Storyboard continuity", content: storyboardContent(project) }];
  return [{
    target: projectTarget(project),
    heading: project.metadata.title,
    content: [
      `Premise: ${project.story.premise}`,
      `Logline: ${project.story.logline}`,
      `Theme: ${project.story.theme}`,
      `Dramatic question: ${project.story.dramaticQuestion}`,
      `World rules: ${project.world.rules}`,
      `Characters:\n${project.characters.map((character) => `${character.name}: ${character.role}; want ${character.want}; need ${character.need}; arc ${character.arc}`).join("\n")}`,
      `Blocks:\n${project.blocks.map((block) => `Block ${block.number}: ${block.title} — ${block.summary}`).join("\n")}`,
    ].filter(Boolean).join("\n\n"),
  }];
}

export function createAiReviewNotice(provider: AiProviderSnapshot, contextCharacters: number): AiReviewNotice {
  return {
    privacy: provider.connected
      ? `The selected story context will be sent to ${provider.provider || "the connected provider"}. API credentials remain in PlotPickle’s local secrets store and are not included in the project.`
      : "No AI provider is connected. You can prepare and save the review request locally, but no story content will be submitted.",
    context: `This request contains approximately ${contextCharacters.toLocaleString("en-CA")} characters of selected project context. Review the scope before submitting.`,
    cost: provider.connected
      ? "Provider charges may apply. PlotPickle cannot guarantee the final token count or price; check the provider’s current pricing and usage controls before submission."
      : "No provider cost is incurred while the request remains local and unsubmitted.",
    writerControl: "AI output is feedback only. It cannot change canonical story content automatically. Accepting a finding may create a separate revision proposal that still requires explicit approval.",
    requiresOnlineProvider: provider.connected && provider.provider !== "ollama",
  };
}

export function createAiReviewRequest(
  project: PlotPickleProject,
  input: {
    scope: AiReviewScope;
    lens: AiReviewLens;
    targetIds?: string[];
    customQuestions?: string[];
    provider: AiProviderSnapshot;
  },
): AiReviewRequest {
  const contextItems = buildAiReviewContext(project, input.scope, input.targetIds);
  const context = contextItems.map((item) => `## TARGET ${item.target.kind}:${item.target.targetId}\n${item.heading}\n${item.content}`).join("\n\n");
  const contextCharacters = context.length;
  const lens = AI_REVIEW_LENSES.find((candidate) => candidate.id === input.lens) ?? AI_REVIEW_LENSES[0];
  const questions = unique(input.customQuestions ?? []);
  const instructions = [
    "You are reviewing a writer-controlled PlotPickle project.",
    lens.instruction,
    "Use only the supplied context. Distinguish evidence from inference.",
    "Return valid JSON with projectSummary, recurringPatterns, priorities and findings.",
    "Each finding must include targetKind, targetId, title, body, priority, category, proposedChange and evidence.",
    "Do not claim to edit, approve or change canon.",
  ].join(" ");
  const prompt = [
    `Review lens: ${lens.label}`,
    `Scope: ${AI_REVIEW_SCOPES.find((candidate) => candidate.id === input.scope)?.label ?? input.scope}`,
    questions.length ? `Custom questions:\n${questions.map((question, index) => `${index + 1}. ${question}`).join("\n")}` : "Custom questions: none",
    "Selected project context:",
    context,
  ].join("\n\n");
  return {
    id: makeId("ai-review-request"),
    scope: input.scope,
    lens: input.lens,
    targetIds: unique(input.targetIds ?? []),
    customQuestions: questions,
    provider: input.provider.provider,
    model: input.provider.model,
    requestedAt: now(),
    notice: createAiReviewNotice(input.provider, contextCharacters),
    contextItems,
    contextCharacters,
    estimatedInputTokens: Math.ceil(contextCharacters / 4),
    instructions,
    prompt,
    promptHash: promptHash(`${instructions}\n\n${prompt}`),
  };
}

function priority(value: unknown): ReviewPriorityBand {
  return value === "critical" || value === "high" || value === "low" ? value : "normal";
}

function category(value: unknown): FeedbackCategory {
  const categories: FeedbackCategory[] = ["story", "structure", "character", "relationship", "world", "dialogue", "action", "continuity", "visual", "production", "performance", "rights", "technical", "other"];
  return categories.includes(value as FeedbackCategory) ? value as FeedbackCategory : "story";
}

function targetForFinding(request: AiReviewRequest, value: Record<string, unknown>): FeedbackTargetReference {
  const kind = clean(value.targetKind);
  const id = clean(value.targetId);
  return request.contextItems.find((item) => item.target.kind === kind && item.target.targetId === id)?.target
    ?? request.contextItems.find((item) => item.target.targetId === id)?.target
    ?? request.contextItems[0]?.target
    ?? {
      kind: "project",
      targetId: "project",
      label: "Project",
      workspace: "feedback",
      blockId: "",
      miniBlockId: "",
      sceneId: "",
      characterId: "",
      frameId: "",
      screenplayElementId: "",
      productionItemId: "",
    };
}

export function parseAiReviewResult(request: AiReviewRequest, rawOutput: string): AiReviewResult {
  let value: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawOutput) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) value = parsed as Record<string, unknown>;
  } catch {
    value = { projectSummary: rawOutput };
  }
  const findings = Array.isArray(value.findings) ? value.findings : [];
  return {
    id: makeId("ai-review-result"),
    requestId: request.id,
    provider: request.provider,
    model: request.model,
    completedAt: now(),
    promptHash: request.promptHash,
    projectSummary: clean(value.projectSummary) || clean(value.summary) || clean(rawOutput),
    findings: findings.flatMap((finding, index) => {
      if (!finding || typeof finding !== "object") return [];
      const item = finding as Record<string, unknown>;
      const body = clean(item.body) || clean(item.finding);
      if (!body) return [];
      return [{
        id: clean(item.id) || `${request.id}:finding:${index + 1}`,
        target: targetForFinding(request, item),
        title: clean(item.title) || `AI review finding ${index + 1}`,
        body,
        priority: priority(item.priority),
        category: category(item.category),
        proposedChange: clean(item.proposedChange),
        evidence: clean(item.evidence),
      }];
    }),
    recurringPatterns: Array.isArray(value.recurringPatterns) ? unique(value.recurringPatterns.map(String)) : [],
    priorities: Array.isArray(value.priorities) ? unique(value.priorities.map(String)) : [],
    rawOutput,
  };
}

export function saveAiReviewResult(project: PlotPickleProject, result: AiReviewResult): PlotPickleProject {
  let next = project;
  for (const finding of result.findings) {
    const provenance = [
      `AI review provenance: ${result.provider || "configured provider"} · ${result.model || "configured model"}`,
      `Completed: ${result.completedAt}`,
      `Prompt hash: ${result.promptHash}`,
      finding.evidence ? `Evidence: ${finding.evidence}` : "",
    ].filter(Boolean).join("\n");
    const input: CreateFeedbackInput = {
      title: finding.title,
      body: `${finding.body}\n\n${provenance}`,
      author: `${result.provider || "AI"} review`,
      role: "ai-assistant",
      source: "ai",
      status: "under-review",
      priority: finding.priority,
      category: finding.category,
      proposedChange: finding.proposedChange,
      target: finding.target,
    };
    next = createFeedback(next, input);
  }
  return next;
}

export function createHumanReviewRequest(
  project: PlotPickleProject,
  input: {
    title: string;
    reviewer: HumanReviewerIdentity;
    target: FeedbackTargetReference;
    questions?: string[];
    dueAt?: string;
    githubProposalUrl?: string;
    githubProposalNumber?: number | null;
  },
): { project: PlotPickleProject; request: HumanReviewRequest } {
  const requestedAt = now();
  const questions = unique(input.questions ?? []);
  const request: HumanReviewRequest = {
    id: makeId("human-review-request"),
    title: clean(input.title) || `Review request · ${input.target.label}`,
    reviewer: {
      name: clean(input.reviewer.name) || "Reviewer",
      role: input.reviewer.role,
      organisation: clean(input.reviewer.organisation),
      contact: clean(input.reviewer.contact),
    },
    target: input.target,
    questions,
    requestedAt,
    dueAt: clean(input.dueAt),
    status: "requested",
    githubProposalUrl: clean(input.githubProposalUrl),
    githubProposalNumber: input.githubProposalNumber ?? null,
  };
  const body = [
    `Review requested from ${request.reviewer.name} (${request.reviewer.role}).`,
    request.reviewer.organisation ? `Organisation: ${request.reviewer.organisation}` : "",
    request.dueAt ? `Requested due date: ${request.dueAt}` : "",
    questions.length ? `Questions:\n${questions.map((question, index) => `${index + 1}. ${question}`).join("\n")}` : "Please review the attached target and record evidence, questions and proposed changes.",
    request.githubProposalUrl ? `GitHub proposal: ${request.githubProposalUrl}` : "",
  ].filter(Boolean).join("\n\n");
  const next = createFeedback(project, {
    title: request.title,
    body,
    author: request.reviewer.name,
    role: request.reviewer.role,
    source: "human",
    status: "under-review",
    priority: "normal",
    category: "story",
    target: request.target,
  });
  return { project: next, request };
}

export function createRevisionProposalFromFeedback(
  project: PlotPickleProject,
  feedbackId: string,
  input: {
    title?: string;
    rationale?: string;
    githubProposalUrl?: string;
    githubProposalNumber?: number | null;
  } = {},
): ReviewRevisionProposal | null {
  const record = createStoredFeedbackModel(project).records.find((candidate) => candidate.id === feedbackId || candidate.originId === feedbackId);
  if (!record || !clean(record.proposedChange)) return null;
  return {
    id: makeId("review-revision-proposal"),
    feedbackId: record.id,
    target: record.target,
    title: clean(input.title) || `Revision proposal · ${record.title}`,
    rationale: clean(input.rationale) || record.body,
    proposedChange: record.proposedChange,
    status: "proposed",
    createdAt: now(),
    approvedAt: "",
    approvedBy: "",
    githubProposalUrl: clean(input.githubProposalUrl),
    githubProposalNumber: input.githubProposalNumber ?? null,
  };
}

export function approveRevisionProposal(proposal: ReviewRevisionProposal, approvedBy: string): ReviewRevisionProposal {
  if (proposal.status !== "proposed") return proposal;
  return { ...proposal, status: "approved", approvedAt: now(), approvedBy: clean(approvedBy) || "Project writer" };
}

export function rejectRevisionProposal(proposal: ReviewRevisionProposal): ReviewRevisionProposal {
  if (proposal.status !== "proposed") return proposal;
  return { ...proposal, status: "rejected", approvedAt: "", approvedBy: "" };
}

export function exportReviewSummary(records: UnifiedFeedbackRecord[], title = "PlotPickle review summary") {
  const sorted = [...records].sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
  return [
    `# ${title}`,
    "",
    `Generated: ${now()}`,
    `Records: ${sorted.length}`,
    "",
    ...sorted.flatMap((record, index) => [
      `## ${index + 1}. ${record.title}`,
      "",
      `- Target: ${record.target.label} (${record.target.kind}:${record.target.targetId})`,
      `- Reviewer: ${record.author} · ${record.role}`,
      `- Source: ${record.source}`,
      `- Status: ${record.status}`,
      `- Priority: ${record.priority}`,
      `- Category: ${record.category}`,
      `- Updated: ${record.updatedAt}`,
      record.linkedRevisionId ? `- Linked revision: ${record.linkedRevisionId}` : "",
      "",
      record.body,
      record.proposedChange ? `\n### Proposed change\n\n${record.proposedChange}` : "",
      record.resolution ? `\n### Resolution\n\n${record.resolution}` : "",
      "",
    ].filter(Boolean)),
  ].join("\n");
}

export function reviewDecisionStatus(status: "accept" | "reject" | "defer"): FeedbackStatus {
  if (status === "accept") return "accepted";
  if (status === "reject") return "rejected";
  return "deferred";
}
