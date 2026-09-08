export type StoryMapStage = "map" | "plan" | "build" | "storyboard";

export type StoryMapContext = Readonly<{
  blockNumber: number;
  miniBlockNumber: number;
  stage: StoryMapStage;
}>;

export type StoryMapContextRegistry = Readonly<Record<string, StoryMapContext>>;

const MAX_STORED_PROJECT_CONTEXTS = 100;

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.trunc(value)))
    : fallback;
}

function normalizeStage(value: unknown): StoryMapStage {
  return value === "plan" || value === "build" || value === "storyboard" ? value : "map";
}

export function normalizeStoryMapContext(value: unknown): StoryMapContext {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
  return {
    blockNumber: boundedInteger(source.blockNumber, 1, 24, 1),
    miniBlockNumber: boundedInteger(source.miniBlockNumber, 1, 4, 1),
    stage: normalizeStage(source.stage),
  };
}

export function normalizeStoryMapContextRegistry(value: unknown): StoryMapContextRegistry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([projectId]) => Boolean(projectId.trim()) && projectId.length <= 240)
      .slice(-MAX_STORED_PROJECT_CONTEXTS)
      .map(([projectId, context]) => [projectId, normalizeStoryMapContext(context)]),
  );
}
