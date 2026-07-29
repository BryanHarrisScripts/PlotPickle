import type { ComicPitchDeck, ComicPitchPanel } from "./project";
import { graphicNovelPanelLabel } from "./ai-pitch-deck";

export type ImageQuality = "low" | "medium" | "high";
export type QueueItemState = "queued" | "generating" | "completed" | "failed" | "stopped" | "retrying" | "skipped";
export type QueueStatus = "idle" | "running" | "stopped" | "complete" | "complete-with-errors";

export type GraphicNovelQueueItem = {
  id: string;
  panelId: string;
  label: string;
  order: number;
  state: QueueItemState;
  attempts: number;
  assetUrl: string;
  error: string;
  startedAt: string;
  completedAt: string;
  updatedAt: string;
};

export type GraphicNovelQueue = {
  version: 1;
  id: string;
  projectId: string;
  status: QueueStatus;
  quality: ImageQuality;
  items: GraphicNovelQueueItem[];
  createdAt: string;
  updatedAt: string;
};

export const timestamp = () => new Date().toISOString();
export const queueStorageKey = (projectId: string) => `plotpickle:graphic-novel-queue:${projectId}`;

export function safeQueueError(value: unknown) {
  const message = value instanceof Error ? value.message : "Image generation failed.";
  return message
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/(?:api[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]\s*\S+/gi, "credential=[redacted]")
    .slice(0, 300);
}

export function isStoredQueue(value: unknown): value is GraphicNovelQueue {
  if (!value || typeof value !== "object") return false;
  const queue = value as Partial<GraphicNovelQueue>;
  return queue.version === 1
    && typeof queue.id === "string"
    && typeof queue.projectId === "string"
    && Array.isArray(queue.items)
    && queue.items.every((item) => item && typeof item === "object" && typeof item.panelId === "string");
}

export function buildGraphicNovelQueue(
  projectId: string,
  deck: ComicPitchDeck,
  previous?: GraphicNovelQueue,
  quality: ImageQuality = "low",
): GraphicNovelQueue {
  const now = timestamp();
  const prior = new Map(previous?.items.map((item) => [item.panelId, item]) ?? []);
  const items = deck.panels.map((panel, order): GraphicNovelQueueItem => {
    const existing = prior.get(panel.id);
    const complete = panel.status === "complete" && Boolean(panel.imageSrc);
    const state: QueueItemState = complete ? "completed"
      : existing?.state === "skipped" ? "skipped"
        : existing?.state === "failed" ? "failed" : "queued";
    return {
      id: existing?.id || `${projectId}:${panel.id}`,
      panelId: panel.id,
      label: graphicNovelPanelLabel(panel),
      order,
      state,
      attempts: existing?.attempts || 0,
      assetUrl: complete ? panel.imageSrc : existing?.assetUrl || "",
      error: state === "failed" ? existing?.error || panel.error : "",
      startedAt: existing?.startedAt || "",
      completedAt: complete ? panel.generatedAt || existing?.completedAt || now : existing?.completedAt || "",
      updatedAt: now,
    };
  });
  return {
    version: 1,
    id: previous?.projectId === projectId ? previous.id : `graphic-novel-${projectId}-${Date.now()}`,
    projectId,
    status: "idle",
    quality,
    items,
    createdAt: previous?.projectId === projectId ? previous.createdAt : now,
    updatedAt: now,
  };
}

export function queueCounts(queue: GraphicNovelQueue | null) {
  const items = queue?.items ?? [];
  const completed = items.filter((item) => item.state === "completed").length;
  const failed = items.filter((item) => item.state === "failed").length;
  const skipped = items.filter((item) => item.state === "skipped").length;
  const remaining = items.filter((item) => ["queued", "generating", "stopped", "retrying"].includes(item.state)).length;
  return { total: items.length, completed, failed, skipped, remaining };
}

export function currentQueueItem(queue: GraphicNovelQueue | null) {
  return queue?.items.find((item) => item.state === "generating")
    ?? queue?.items.find((item) => item.state === "failed")
    ?? queue?.items.find((item) => ["queued", "stopped", "retrying"].includes(item.state))
    ?? null;
}

export function queuePanel(deck: ComicPitchDeck, item: GraphicNovelQueueItem | null): ComicPitchPanel | null {
  return item ? deck.panels.find((panel) => panel.id === item.panelId) ?? null : null;
}
