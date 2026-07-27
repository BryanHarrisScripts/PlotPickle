import { cloneProject, type PlotPickleProject } from "./project";

export const STORY_PROPOSAL_GROUPS = [
  { id: "story", label: "Story and development", description: "Premise, theme, logline, project identity and development decisions." },
  { id: "dialogue", label: "Dialogue and screenplay", description: "Screenplay draft elements, dialogue, action and screenplay document settings." },
  { id: "characters", label: "Characters and voices", description: "Character records, arcs, relationships and voiceprints." },
  { id: "scenes", label: "Scenes and structure", description: "24 Blocks, Mini-Blocks, scenes, structure and Story Threads." },
  { id: "world", label: "World and canon", description: "World rules, locations, timeline, continuity and canon-derived material." },
  { id: "production", label: "Production", description: "Storyboard, shots, cues, breakdowns, schedule and distribution planning." },
  { id: "review", label: "Review and revisions", description: "Review threads, pitch work and revision snapshots." },
  { id: "rights", label: "Rights and provenance", description: "Ownership, attribution, licences and AI provenance records." },
] as const;

export type StoryProposalGroupId = typeof STORY_PROPOSAL_GROUPS[number]["id"];

export type StoryProposalSemanticGroup = {
  id: StoryProposalGroupId;
  label: string;
  description: string;
  changed: boolean;
  summary: string;
  filePaths: string[];
};

const GROUP_ORDER = new Map(STORY_PROPOSAL_GROUPS.map((group, index) => [group.id, index]));

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function differs(left: unknown, right: unknown) {
  return stable(left) !== stable(right);
}

function changedCount(left: unknown[], right: unknown[], key = "id") {
  const leftMap = new Map(left.map((item) => [String((item as Record<string, unknown>)?.[key] ?? stable(item)), item]));
  const rightMap = new Map(right.map((item) => [String((item as Record<string, unknown>)?.[key] ?? stable(item)), item]));
  const ids = new Set([...leftMap.keys(), ...rightMap.keys()]);
  return [...ids].filter((id) => differs(leftMap.get(id), rightMap.get(id))).length;
}

export function storyProposalGroupForPath(filePath: string): StoryProposalGroupId {
  const path = filePath.replace(/^project\//, "");
  if (path.startsWith("screenplay/")) return "dialogue";
  if (path.startsWith("characters/") || path.startsWith("voiceprints/") || path.startsWith("canon/characters/") || path.startsWith("canon/voiceprints/")) return "characters";
  if (path.startsWith("24-blocks/") || path.startsWith("96-blocks/") || path === "story/threads.json") return "scenes";
  if (path.startsWith("production/") || path.startsWith("storyboard/") || path.startsWith("canon/producer-notes/") || path.startsWith("canon/director-notes/") || path.startsWith("canon/actor-notes/")) return "production";
  if (path.startsWith("world/") || path.startsWith("canon/world/") || path.startsWith("canon/timeline/") || path.startsWith("canon/locations/") || path === "canon/rules.json" || path === "canon/continuity.json" || path === "canon/timeline.json") return "world";
  if (path.startsWith("review/") || path.startsWith("reports/revisions")) return "review";
  if (path.startsWith("canon/legal/") || path === "canon/rights.json") return "rights";
  return "story";
}

export function storyProposalFileGroups(filePaths: string[]) {
  const grouped = new Map<StoryProposalGroupId, string[]>();
  for (const filePath of filePaths) {
    const id = storyProposalGroupForPath(filePath);
    grouped.set(id, [...(grouped.get(id) ?? []), filePath]);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => (GROUP_ORDER.get(left) ?? 99) - (GROUP_ORDER.get(right) ?? 99))
    .map(([id, paths]) => ({ id, paths: [...paths].sort() }));
}

export function compareStoryProposalProjects(
  approved: PlotPickleProject,
  proposed: PlotPickleProject,
  changedPaths: string[] = [],
): StoryProposalSemanticGroup[] {
  const paths = new Map(storyProposalFileGroups(changedPaths).map((group) => [group.id, group.paths]));
  const characterChanges = changedCount(approved.characters, proposed.characters);
  const approvedScenes = approved.blocks.flatMap((block) => block.scenes);
  const proposedScenes = proposed.blocks.flatMap((block) => block.scenes);
  const sceneChanges = changedCount(approvedScenes, proposedScenes);
  const blockChanges = changedCount(approved.blocks, proposed.blocks);
  const threadChanges = changedCount(approved.storyThreads, proposed.storyThreads);
  const screenplayChanges = changedCount(approved.screenplay.draftElements, proposed.screenplay.draftElements);

  const states: Record<StoryProposalGroupId, { changed: boolean; summary: string }> = {
    story: {
      changed: differs(approved.metadata, proposed.metadata) || differs(approved.story, proposed.story) || differs(approved.development, proposed.development),
      summary: "Project identity, story foundations or development notes changed.",
    },
    dialogue: {
      changed: differs(approved.screenplay, proposed.screenplay),
      summary: `${screenplayChanges} screenplay element${screenplayChanges === 1 ? "" : "s"} changed.`,
    },
    characters: {
      changed: differs(approved.characters, proposed.characters),
      summary: `${characterChanges} character record${characterChanges === 1 ? "" : "s"} changed.`,
    },
    scenes: {
      changed: differs(approved.structure, proposed.structure) || differs(approved.blocks, proposed.blocks) || differs(approved.storyThreads, proposed.storyThreads),
      summary: `${blockChanges} Block${blockChanges === 1 ? "" : "s"}, ${sceneChanges} scene${sceneChanges === 1 ? "" : "s"} and ${threadChanges} Story Thread${threadChanges === 1 ? "" : "s"} changed.`,
    },
    world: {
      changed: differs(approved.world, proposed.world),
      summary: "World, location, timeline or canon inputs changed.",
    },
    production: {
      changed: differs(approved.production, proposed.production),
      summary: "Storyboard, shot, sound, schedule or distribution planning changed.",
    },
    review: {
      changed: differs(approved.review, proposed.review) || differs(approved.revisions, proposed.revisions),
      summary: "Review threads, pitch material or revision history changed.",
    },
    rights: {
      changed: differs(approved.rights, proposed.rights),
      summary: "Rights, attribution, licence or provenance records changed.",
    },
  };

  return STORY_PROPOSAL_GROUPS.map((definition) => ({
    ...definition,
    changed: states[definition.id].changed,
    summary: states[definition.id].summary,
    filePaths: paths.get(definition.id) ?? [],
  })).filter((group) => group.changed || group.filePaths.length > 0);
}

export function applyStoryProposalGroups(
  approved: PlotPickleProject,
  proposed: PlotPickleProject,
  selectedGroups: StoryProposalGroupId[],
): PlotPickleProject {
  const selected = new Set(selectedGroups);
  const next = cloneProject(approved);
  const source = cloneProject(proposed);

  if (selected.has("story")) {
    next.metadata = source.metadata;
    next.story = source.story;
    next.development = source.development;
  }
  if (selected.has("dialogue")) next.screenplay = source.screenplay;
  if (selected.has("characters")) next.characters = source.characters;
  if (selected.has("scenes")) {
    next.structure = source.structure;
    next.blocks = source.blocks;
    next.storyThreads = source.storyThreads;
  }
  if (selected.has("world")) next.world = source.world;
  if (selected.has("production")) next.production = source.production;
  if (selected.has("review")) {
    next.review = source.review;
    next.revisions = source.revisions;
  }
  if (selected.has("rights")) next.rights = source.rights;

  next.collaboration = cloneProject(approved).collaboration;
  next.metadata = { ...next.metadata, updatedAt: new Date().toISOString() };
  return next;
}

export function validStoryProposalGroups(value: unknown): StoryProposalGroupId[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<StoryProposalGroupId>(STORY_PROPOSAL_GROUPS.map((group) => group.id));
  return [...new Set(value.filter((item): item is StoryProposalGroupId => typeof item === "string" && allowed.has(item as StoryProposalGroupId)))];
}

export type StoryProposalDecision = "open" | "approved" | "declined";
const DECISION_MARKER = /<!--\s*plotpickle-decision:\s*(open|approved|declined)\s*-->/i;

export function storyProposalDecision(body: string): StoryProposalDecision {
  const match = body.match(DECISION_MARKER);
  return match?.[1]?.toLowerCase() === "approved" ? "approved" : match?.[1]?.toLowerCase() === "declined" ? "declined" : "open";
}

export function withStoryProposalDecision(body: string, decision: StoryProposalDecision) {
  const marker = `<!-- plotpickle-decision: ${decision} -->`;
  return DECISION_MARKER.test(body) ? body.replace(DECISION_MARKER, marker) : `${body.trim()}\n\n${marker}\n`;
}
