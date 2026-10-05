export const PLOTPICKLE_MEDIA_ENGINE_SCHEMA_VERSION = 1 as const;

export type PlotPickleMediaEngineCapabilityState = "ready" | "unavailable" | "degraded";

export type PlotPickleMediaEngineCapability = {
  readonly engineId: string;
  readonly engineVersion: string;
  readonly state: PlotPickleMediaEngineCapabilityState;
  readonly reason: string;
  readonly localOnly: true;
  readonly automaticInstall: false;
  readonly cloudFallback: false;
  readonly supports: {
    readonly miniBlockFrames: boolean;
    readonly frameInspection: boolean;
    readonly contactSheet: boolean;
    readonly videoRender: boolean;
    readonly audioInspection: boolean;
  };
};

export type PlotPickleMediaFrameInput = {
  readonly position: number;
  readonly assetId: string;
  readonly assetUrl: string;
  readonly localFilePath: string;
  readonly authoritative: true;
  readonly durationMs: number;
  readonly sourceRefs: readonly string[];
  readonly caption?: string;
  readonly narration?: string;
};

export type PlotPickleMiniBlockMediaRequest = {
  readonly schemaVersion: typeof PLOTPICKLE_MEDIA_ENGINE_SCHEMA_VERSION;
  readonly requestId: string;
  readonly projectId: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly fps: 24;
  readonly width: 1280;
  readonly height: 720;
  readonly frames: readonly PlotPickleMediaFrameInput[];
};

export type PlotPickleTimelineRangeMediaRequest = {
  readonly schemaVersion: typeof PLOTPICKLE_MEDIA_ENGINE_SCHEMA_VERSION;
  readonly requestId: string;
  readonly projectId: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly fps: 24;
  readonly width: 1280;
  readonly height: 720;
  readonly frames: readonly PlotPickleMediaFrameInput[];
};

export type PlotPickleMediaSourceEvidence = {
  readonly position: number;
  readonly assetId: string;
  readonly assetUrl: string;
  readonly sha256: string;
  readonly durationMs: number;
  readonly sourceRefs: readonly string[];
};

export type PlotPickleMediaEngineEvidence = {
  readonly schemaVersion: typeof PLOTPICKLE_MEDIA_ENGINE_SCHEMA_VERSION;
  readonly requestId: string;
  readonly engineId: string;
  readonly engineVersion: string;
  readonly state: "succeeded" | "failed" | "cancelled" | "unavailable";
  readonly startedAt: string;
  readonly completedAt: string;
  readonly sourceAssets: readonly PlotPickleMediaSourceEvidence[];
  readonly artifacts: {
    readonly contactSheetPath: string;
    readonly frameDirectory: string;
    readonly videoPath: string;
  };
  readonly inspection: unknown;
  readonly timeline: unknown;
  readonly diagnostics: readonly string[];
  readonly reason: string;
};

export type PlotPickleMediaEngineRunOptions = {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly evidenceDirectory?: string;
};

export interface PlotPickleMediaEngine {
  readonly id: string;
  capabilities(): Promise<PlotPickleMediaEngineCapability>;
  renderMiniBlock(
    request: PlotPickleMiniBlockMediaRequest,
    options?: PlotPickleMediaEngineRunOptions,
  ): Promise<PlotPickleMediaEngineEvidence>;
}

type MiniBlockRequestInput = {
  readonly requestId: string;
  readonly projectId: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly frames: readonly PlotPickleMediaFrameInput[];
};

type TimelineRangeRequestInput = MiniBlockRequestInput;

function cleanText(value: string, label: string, maximum = 2000) {
  const text = String(value ?? "").replace(/\u0000/gu, "").trim().slice(0, maximum);
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function boundedInteger(value: number, minimum: number, maximum: number, label: string) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function normalizeFrame(frame: PlotPickleMediaFrameInput, maximumPosition = 25, label = "Storyboard position"): PlotPickleMediaFrameInput {
  if (frame.authoritative !== true) {
    throw new Error("PlotPickle media requests accept authoritative Keep / Locked Storyboard frames only.");
  }
  const position = boundedInteger(frame.position, 1, maximumPosition, label);
  const durationMs = boundedInteger(frame.durationMs, 250, 60_000, "Frame duration");
  return Object.freeze({
    position,
    assetId: cleanText(frame.assetId, "Storyboard asset id", 500),
    assetUrl: cleanText(frame.assetUrl, "Storyboard asset URL", 3000),
    localFilePath: cleanText(frame.localFilePath, "Local Storyboard asset path", 3000),
    authoritative: true,
    durationMs,
    sourceRefs: Object.freeze(
      [...new Set((frame.sourceRefs ?? []).map((value) => String(value).trim()).filter(Boolean))].slice(0, 64),
    ),
    ...(frame.caption?.trim() ? { caption: frame.caption.trim().slice(0, 2000) } : {}),
    ...(frame.narration?.trim() ? { narration: frame.narration.trim().slice(0, 4000) } : {}),
  });
}

export function createPlotPickleMiniBlockMediaRequest(input: MiniBlockRequestInput): PlotPickleMiniBlockMediaRequest {
  const projectId = cleanText(input.projectId, "Project id", 500);
  const requestId = cleanText(input.requestId, "Media request id", 500);
  const blockNumber = boundedInteger(input.blockNumber, 1, 24, "Block number");
  const miniBlockNumber = boundedInteger(input.miniBlockNumber, 1, 4, "Mini-Block number");
  if (!Array.isArray(input.frames) || input.frames.length === 0) {
    throw new Error("At least one authoritative Storyboard frame is required.");
  }
  if (input.frames.length > 25) {
    throw new Error("A Mini-Block media request cannot exceed 25 Storyboard positions.");
  }
  const frames = input.frames.map((frame) => normalizeFrame(frame)).sort((left, right) => left.position - right.position);
  const positions = new Set<number>();
  for (const frame of frames) {
    if (positions.has(frame.position)) {
      throw new Error(`Storyboard position ${String(frame.position).padStart(2, "0")} appears more than once.`);
    }
    positions.add(frame.position);
  }
  return Object.freeze({
    schemaVersion: PLOTPICKLE_MEDIA_ENGINE_SCHEMA_VERSION,
    requestId,
    projectId,
    blockNumber,
    miniBlockNumber,
    fps: 24,
    width: 1280,
    height: 720,
    frames: Object.freeze(frames),
  });
}


export function createPlotPickleTimelineRangeMediaRequest(input: TimelineRangeRequestInput): PlotPickleTimelineRangeMediaRequest {
  const projectId = cleanText(input.projectId, "Project id", 500);
  const requestId = cleanText(input.requestId, "Media request id", 500);
  const blockNumber = boundedInteger(input.blockNumber, 1, 24, "Opening block number");
  const miniBlockNumber = boundedInteger(input.miniBlockNumber, 1, 4, "Opening Mini-Block number");
  if (!Array.isArray(input.frames) || input.frames.length === 0) {
    throw new Error("At least one authoritative Storyboard frame is required for Timeline range export.");
  }
  if (input.frames.length > 100) {
    throw new Error("An opening Timeline range cannot exceed four Mini-Blocks or 100 Storyboard positions.");
  }
  if (input.frames.length % 25 !== 0) {
    throw new Error("Timeline range export requires complete 25-Shot Mini-Blocks.");
  }
  const frames = input.frames
    .map((frame) => normalizeFrame(frame, 100, "Timeline range position"))
    .sort((left, right) => left.position - right.position);
  const positions = new Set<number>();
  for (const frame of frames) {
    if (frame.durationMs !== 3_000) {
      throw new Error("Timeline range export requires exactly 3,000 ms per Shot.");
    }
    if (positions.has(frame.position)) {
      throw new Error(`Timeline range position ${String(frame.position).padStart(3, "0")} appears more than once.`);
    }
    positions.add(frame.position);
  }
  for (let position = 1; position <= frames.length; position += 1) {
    if (!positions.has(position)) throw new Error(`Timeline range position ${String(position).padStart(3, "0")} is missing.`);
  }
  return Object.freeze({
    schemaVersion: PLOTPICKLE_MEDIA_ENGINE_SCHEMA_VERSION,
    requestId,
    projectId,
    blockNumber,
    miniBlockNumber,
    fps: 24,
    width: 1280,
    height: 720,
    frames: Object.freeze(frames),
  });
}
