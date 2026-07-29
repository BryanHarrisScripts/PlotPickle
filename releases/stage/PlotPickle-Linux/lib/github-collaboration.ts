import { cloneProject, type PlotPickleProject, type ProjectCollaboration } from "./project";

export type ProjectComparisonSummary = {
  changedStoryFields: string[];
  changedBlockNumbers: number[];
  changedSceneIds: string[];
  changedCharacterIds: string[];
  changedThreadIds: string[];
  changedScreenplayElementIds: string[];
  summary: string;
};

function stable(value: unknown) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stable(item)}`)
      .join("|")}}`;
  }
  return JSON.stringify(value);
}

function changedIds<T extends { id: string }>(left: T[], right: T[]) {
  const leftMap = new Map(left.map((item) => [item.id, item]));
  const rightMap = new Map(right.map((item) => [item.id, item]));
  return [...new Set([
    ...left.filter((item) => !rightMap.has(item.id)).map((item) => item.id),
    ...right.filter((item) => !leftMap.has(item.id)).map((item) => item.id),
    ...right.filter((item) => leftMap.has(item.id) && stable(leftMap.get(item.id)) !== stable(item)).map((item) => item.id),
  ])];
}

export function compareCollaborativeProjects(local: PlotPickleProject, incoming: PlotPickleProject): ProjectComparisonSummary {
  const changedStoryFields = Object.keys(incoming.story).filter((key) => {
    const field = key as keyof PlotPickleProject["story"];
    return local.story[field] !== incoming.story[field];
  });
  const changedBlockNumbers = incoming.blocks
    .filter((block) => stable(local.blocks.find((item) => item.id === block.id)) !== stable(block))
    .map((block) => block.number);
  const localScenes = local.blocks.flatMap((block) => block.scenes);
  const incomingScenes = incoming.blocks.flatMap((block) => block.scenes);
  const changedSceneIds = changedIds(localScenes, incomingScenes);
  const changedCharacterIds = changedIds(local.characters, incoming.characters);
  const changedThreadIds = changedIds(local.storyThreads, incoming.storyThreads);
  const changedScreenplayElementIds = changedIds(local.screenplay.draftElements, incoming.screenplay.draftElements);
  const total = changedStoryFields.length + changedBlockNumbers.length + changedSceneIds.length
    + changedCharacterIds.length + changedThreadIds.length + changedScreenplayElementIds.length;
  return {
    changedStoryFields,
    changedBlockNumbers: [...new Set(changedBlockNumbers)].sort((left, right) => left - right),
    changedSceneIds,
    changedCharacterIds,
    changedThreadIds,
    changedScreenplayElementIds,
    summary: total === 0
      ? "The GitHub project matches the active local story."
      : `${total} tracked story areas differ. Review them before replacing the active local project.`,
  };
}

export function applyReviewedGitHubProject(
  local: PlotPickleProject,
  incoming: PlotPickleProject,
  remoteCommit: string,
): PlotPickleProject {
  const next = cloneProject(incoming);
  const collaboration: ProjectCollaboration = {
    ...local.collaboration,
    ...incoming.collaboration,
    provider: "github",
    lastPulledCommit: remoteCommit,
    updatedAt: new Date().toISOString(),
  };
  return {
    ...next,
    collaboration,
    metadata: { ...next.metadata, updatedAt: new Date().toISOString() },
  };
}
