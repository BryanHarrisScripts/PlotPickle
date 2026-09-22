export type StoryMapStage = "map" | "plan" | "build" | "outline" | "storyboard" | "previs" | "timeline" | "production";

export type StoryMapContext = Readonly<{
  blockNumber: number;
  miniBlockNumber: number;
  stage: StoryMapStage;
  passageId?: string;
}>;

export type StoryMapContextRegistry = Readonly<Record<string, StoryMapContext>>;

const MAX_STORED_PROJECT_CONTEXTS = 100;

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.trunc(value)))
    : fallback;
}

function normalizeStage(value: unknown): StoryMapStage {
  return value === "plan"
    || value === "build"
    || value === "outline"
    || value === "storyboard"
    || value === "previs"
    || value === "timeline"
    || value === "production"
    ? value
    : "map";
}

function normalizePassageId(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 320)
    : undefined;
}

export function normalizeStoryMapContext(value: unknown): StoryMapContext {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
  return {
    blockNumber: boundedInteger(source.blockNumber, 1, 24, 1),
    miniBlockNumber: boundedInteger(source.miniBlockNumber, 1, 4, 1),
    stage: normalizeStage(source.stage),
    ...(normalizePassageId(source.passageId) ? { passageId: normalizePassageId(source.passageId) } : {}),
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
