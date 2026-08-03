"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  comicPitchDeckPreflight,
  comicPitchIdentityLocks,
  comicPitchReferenceImages,
  createGraphicNovelPlan,
  finalizeComicPitchDeck,
  graphicNovelPanelLabel,
  graphicNovelPrompt,
  recordComicPitchDeckProvenance,
  updateComicPitchPanel,
  withComicPitchDeck,
} from "@/lib/ai-pitch-deck";
import {
  buildGraphicNovelQueue,
  currentQueueItem,
  isStoredQueue,
  queueCounts,
  queuePanel,
  queueStorageKey,
  safeQueueError,
  timestamp,
  type GraphicNovelQueue,
  type ImageQuality,
  type QueueStatus,
} from "@/lib/graphic-novel-queue";
import {
  createBlankComicPitchDeck,
  type ComicPitchDeck,
  type ComicPitchPanel,
  type PlotPickleProject,
} from "@/lib/project";
import type { PublicConnectionStatus } from "@/lib/connection-status";
import {
  deriveGraphicNovelStoryBrief,
  getGraphicNovelStoryBrief,
  withGraphicNovelStoryBrief,
  type GraphicNovelStoryBrief,
} from "@/lib/graphic-novel-story-brief";

type ImageGenerationResponse = {
  assetUrl?: string;
  revisedPrompt?: string;
  provider?: string;
  model?: string;
  message?: string;
};

type Options = {
  project: PlotPickleProject;
  aiStatus: PublicConnectionStatus;
  imageModel: string;
  onProjectChange: (project: PlotPickleProject) => void;
};

export function useGraphicNovelQueue({ project, aiStatus, imageModel, onProjectChange }: Options) {
  const canonical = useMemo(
    () => project.review.pitchPackage.comicDeck ?? createBlankComicPitchDeck(project.review.pitchPackage.updatedAt),
    [project.review.pitchPackage.comicDeck, project.review.pitchPackage.updatedAt],
  );
  const initial = useMemo(() => canonical.panels.length ? canonical : createGraphicNovelPlan(project), [canonical, project]);
  const [deck, setDeck] = useState<ComicPitchDeck>(initial);
  const [queue, setQueue] = useState<GraphicNovelQueue | null>(null);
  const [quality, setQuality] = useState<ImageQuality>("low");
  const [acknowledged, setAcknowledged] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const deckRef = useRef(initial);
  const queueRef = useRef<GraphicNovelQueue | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  const stopRef = useRef(false);
  const projectRef = useRef(project);
  const onChangeRef = useRef(onProjectChange);

  useEffect(() => {
    projectRef.current = project;
    onChangeRef.current = onProjectChange;
  }, [project, onProjectChange]);

  const aiReady = aiStatus.state === "connected" && Boolean(imageModel);
  const preflight = useMemo(() => comicPitchDeckPreflight(project, deck), [project, deck]);
  const brief = useMemo(() => getGraphicNovelStoryBrief(project), [project]);
  const counts = queueCounts(queue);
  const currentItem = currentQueueItem(queue);
  const currentPanel = queuePanel(deck, currentItem);
  const progress = counts.total ? Math.round(((counts.completed + counts.skipped) / counts.total) * 100) : 0;

  useEffect(() => {
    if (runningRef.current) return;
    const active = projectRef.current;
    const source = canonical.panels.length ? canonical : createGraphicNovelPlan(active);
    const migrated = {
      ...source,
      panels: source.panels.map((panel) => ({
        ...panel,
        prompt: graphicNovelPrompt(panel.prompt),
      })),
    };
    deckRef.current = migrated;
    setDeck(migrated);
    let stored: GraphicNovelQueue | undefined;
    const key = queueStorageKey(project.id);
    try {
      const value = JSON.parse(window.localStorage.getItem(key) || "null") as unknown;
      if (isStoredQueue(value) && value.projectId === project.id) stored = value;
      else if (value) window.localStorage.removeItem(key);
    } catch {
      window.localStorage.removeItem(key);
    }
    const next = buildGraphicNovelQueue(project.id, migrated, stored, stored?.quality || "low", active.assets);
    queueRef.current = next;
    setQueue(next);
    setQuality(next.quality);
  }, [canonical, project.id]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function saveQueue(next: GraphicNovelQueue) {
    const saved = { ...next, updatedAt: timestamp() };
    queueRef.current = saved;
    setQueue(saved);
    window.localStorage.setItem(queueStorageKey(projectRef.current.id), JSON.stringify(saved));
    return saved;
  }

  function saveDeck(next: ComicPitchDeck, provenance = false) {
    deckRef.current = next;
    setDeck(next);
    const active = projectRef.current;
    onChangeRef.current(provenance ? recordComicPitchDeckProvenance(active, next) : withComicPitchDeck(active, next));
  }

  async function requestPanel(panel: ComicPitchPanel, queueId: string, queueItemId: string, signal: AbortSignal) {
    const response = await fetch("/api/local-ai/generate/image", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PlotPickle-Image-Mode": "single-request" },
      signal,
      body: JSON.stringify({
        prompt: graphicNovelPrompt(panel.prompt),
        assetId: panel.id,
        aspect: "landscape",
        quality,
        referenceImages: comicPitchReferenceImages(projectRef.current, panel),
        identityLocks: comicPitchIdentityLocks(projectRef.current, panel),
        queueId,
        projectId: projectRef.current.id,
        queueItemId,
        requestCount: 1,
        billingAcknowledged: acknowledged,
      }),
    });
    const result = await response.json() as ImageGenerationResponse;
    if (!response.ok || !result.assetUrl) throw new Error(result.message || "The image provider returned no image.");
    return result;
  }

  async function run(input: GraphicNovelQueue) {
    if (runningRef.current || !aiReady) return;
    const readiness = comicPitchDeckPreflight(projectRef.current, deckRef.current);
    if (!readiness.ready) {
      setMessage(readiness.missingCharacterLocks.length
        ? `Lock the visual identity for ${readiness.missingCharacterLocks.join(", ")} before generating the complete Graphic Novel.`
        : "The Graphic Novel plan must contain all 96 panels before generation.");
      return;
    }

    runningRef.current = true;
    stopRef.current = false;
    setWorking(true);
    setMessage("The queue is running one image request at a time. Every completed image is saved immediately.");
    let activeQueue = saveQueue({
      ...input,
      quality,
      status: "running",
      items: input.items.map((item) => item.state === "stopped" ? { ...item, state: "queued" } : item),
    });
    let activeDeck: ComicPitchDeck = { ...deckRef.current, status: "generating", updatedAt: timestamp() };
    saveDeck(activeDeck);

    while (!stopRef.current) {
      const target = activeQueue.items.find((item) => item.state === "queued" || item.state === "retrying");
      if (!target) break;
      const panel = activeDeck.panels.find((item) => item.id === target.panelId);
      if (!panel) {
        activeQueue = saveQueue({
          ...activeQueue,
          status: "stopped",
          items: activeQueue.items.map((item) => item.id === target.id
            ? { ...item, state: "failed", error: "The queued panel no longer exists in this project.", updatedAt: timestamp() }
            : item),
        });
        break;
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      const startedAt = timestamp();
      activeQueue = saveQueue({
        ...activeQueue,
        items: activeQueue.items.map((item) => item.id === target.id
          ? { ...item, state: "generating", attempts: item.attempts + 1, error: "", startedAt, updatedAt: startedAt }
          : item),
      });
      activeDeck = updateComicPitchPanel(activeDeck, panel.id, { status: "generating", error: "" }, "generating");
      saveDeck(activeDeck);

      try {
        const result = await requestPanel(panel, activeQueue.id, target.id, controller.signal);
        const completedAt = timestamp();
        activeDeck = updateComicPitchPanel(activeDeck, panel.id, {
          imageSrc: result.assetUrl,
          revisedPrompt: result.revisedPrompt || graphicNovelPrompt(panel.prompt),
          prompt: graphicNovelPrompt(panel.prompt),
          status: "complete",
          error: "",
          provider: result.provider || aiStatus.identity,
          model: result.model || imageModel,
          generatedAt: completedAt,
        }, "generating");
        saveDeck(activeDeck);
        activeQueue = saveQueue({
          ...activeQueue,
          items: activeQueue.items.map((item) => item.id === target.id
            ? { ...item, state: "completed", assetUrl: result.assetUrl || "", error: "", completedAt, updatedAt: completedAt }
            : item),
        });
      } catch (error) {
        const aborted = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
        const errorMessage = aborted ? "" : safeQueueError(error);
        activeDeck = updateComicPitchPanel(activeDeck, panel.id, { status: aborted ? "pending" : "error", error: errorMessage }, "paused");
        saveDeck(activeDeck);
        activeQueue = saveQueue({
          ...activeQueue,
          status: "stopped",
          items: activeQueue.items.map((item) => item.id === target.id
            ? { ...item, state: aborted ? "stopped" : "failed", error: errorMessage, updatedAt: timestamp() }
            : item),
        });
        if (!aborted) setMessage(`${graphicNovelPanelLabel(panel)} failed. Retry it, skip it or stop; completed images remain saved.`);
        break;
      } finally {
        controllerRef.current = null;
      }
    }

    const finalCounts = queueCounts(activeQueue);
    const status: QueueStatus = stopRef.current || activeQueue.status === "stopped" ? "stopped"
      : finalCounts.failed || finalCounts.skipped ? "complete-with-errors"
        : finalCounts.remaining ? "stopped" : "complete";
    activeQueue = saveQueue({ ...activeQueue, status });
    activeDeck = finalizeComicPitchDeck(activeDeck, status !== "complete");
    saveDeck(activeDeck, true);
    runningRef.current = false;
    setWorking(false);
    setMessage(stopRef.current ? "Generation stopped. Completed images were kept and the remaining queue can be resumed later."
      : status === "complete" ? "The complete 24-page Graphic Novel is ready."
        : finalCounts.failed ? "The queue is paused on a failed image. Retry it, skip it or stop."
          : finalCounts.skipped ? "The queue finished with skipped panels. Completed images were preserved."
            : "The queue is paused. Resume remaining images when ready.");
  }

  function start() {
    const active = projectRef.current;
    const prepared = deckRef.current.panels.length === 96
      ? { ...deckRef.current, panels: deckRef.current.panels.map((panel) => ({ ...panel, prompt: graphicNovelPrompt(panel.prompt) })) }
      : createGraphicNovelPlan(active, deckRef.current);
    saveDeck(prepared);
    const next = buildGraphicNovelQueue(active.id, prepared, queueRef.current ?? undefined, quality, active.assets);
    saveQueue(next);
    void run(next);
  }

  function stop() {
    stopRef.current = true;
    controllerRef.current?.abort();
    setMessage("Stopping after the active request. No new image will start, and completed work will remain saved.");
  }

  function retry(itemId: string) {
    const active = queueRef.current;
    const item = active?.items.find((candidate) => candidate.id === itemId);
    if (!active || !item) return;
    saveDeck(updateComicPitchPanel(deckRef.current, item.panelId, { status: "pending", error: "" }, "planned"));
    const next = saveQueue({
      ...active,
      status: "idle",
      items: active.items.map((candidate) => candidate.id === itemId
        ? { ...candidate, state: "retrying", error: "", updatedAt: timestamp() }
        : candidate),
    });
    void run(next);
  }

  function skip(itemId: string) {
    const active = queueRef.current;
    const item = active?.items.find((candidate) => candidate.id === itemId);
    if (!active || !item || runningRef.current) return;
    saveDeck(updateComicPitchPanel(deckRef.current, item.panelId, { status: "pending", error: "" }, "paused"));
    saveQueue({
      ...active,
      status: "stopped",
      items: active.items.map((candidate) => candidate.id === itemId
        ? { ...candidate, state: "skipped", error: "", updatedAt: timestamp() }
        : candidate),
    });
    setMessage(`${item.label} was skipped. Resume the queue to continue with the next image.`);
  }

  async function regeneratePanel(panelId: string) {
    if (runningRef.current || !aiReady || !acknowledged) return;
    const panel = deckRef.current.panels.find((item) => item.id === panelId);
    if (!panel) {
      setMessage("The selected Graphic Novel panel no longer exists.");
      return;
    }
    if (comicPitchIdentityLocks(projectRef.current, panel).length !== panel.characterIds.length) {
      setMessage("Lock every recurring character in this panel before regenerating it.");
      return;
    }
    runningRef.current = true;
    setWorking(true);
    setMessage(`${graphicNovelPanelLabel(panel)} is being regenerated. The current image remains available until the replacement succeeds.`);
    const controller = new AbortController();
    controllerRef.current = controller;
    let activeDeck = updateComicPitchPanel(deckRef.current, panel.id, { status: "generating", error: "" }, "generating");
    saveDeck(activeDeck);
    try {
      const result = await requestPanel(panel, `single-${Date.now()}`, `single-${panel.id}`, controller.signal);
      const completedAt = timestamp();
      activeDeck = updateComicPitchPanel(activeDeck, panel.id, {
        imageSrc: result.assetUrl,
        revisedPrompt: result.revisedPrompt || graphicNovelPrompt(panel.prompt),
        prompt: graphicNovelPrompt(panel.prompt),
        status: "complete",
        error: "",
        provider: result.provider || aiStatus.identity,
        model: result.model || imageModel,
        generatedAt: completedAt,
      }, activeDeck.status);
      saveDeck(activeDeck, true);
      setMessage(`${graphicNovelPanelLabel(panel)} was regenerated. The previous image remains available in panel versions when registered.`);
    } catch (error) {
      const aborted = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
      activeDeck = updateComicPitchPanel(activeDeck, panel.id, { status: aborted ? "pending" : "error", error: aborted ? "" : safeQueueError(error) }, "paused");
      saveDeck(activeDeck);
      setMessage(aborted ? "Panel regeneration stopped. The previous completed image was not deleted." : `${graphicNovelPanelLabel(panel)} could not be regenerated. The existing image remains available.`);
    } finally {
      controllerRef.current = null;
      runningRef.current = false;
      setWorking(false);
    }
  }

  function refresh(preserveCompleted: boolean) {
    if (working) return;
    const active = projectRef.current;
    const nextDeck = createGraphicNovelPlan(active, deckRef.current, preserveCompleted);
    saveDeck(nextDeck);
    saveQueue(buildGraphicNovelQueue(active.id, nextDeck, preserveCompleted ? queueRef.current ?? undefined : undefined, quality, active.assets));
    setMessage(preserveCompleted
      ? "The 96-panel Graphic Novel plan was refreshed. Completed images and queue decisions were preserved."
      : "The Graphic Novel was rebuilt. All 96 panels are ready for a new queue.");
  }

  function applyStoryBrief(nextBrief: GraphicNovelStoryBrief) {
    if (working) return;
    const active = withGraphicNovelStoryBrief(projectRef.current, nextBrief);
    projectRef.current = active;
    const nextDeck = createGraphicNovelPlan(active, deckRef.current, true);
    deckRef.current = nextDeck;
    setDeck(nextDeck);
    onChangeRef.current(withComicPitchDeck(active, nextDeck));
    saveQueue(buildGraphicNovelQueue(active.id, nextDeck, queueRef.current ?? undefined, quality, active.assets));
    setMessage("The Story Brief was saved and all 96 prompts were refreshed. Completed artwork and queue decisions were preserved.");
  }

  function resetStoryBrief() {
    applyStoryBrief(deriveGraphicNovelStoryBrief(projectRef.current));
  }

  return {
    deck, queue, quality, setQuality, acknowledged, setAcknowledged, working, message, aiReady, preflight, brief,
    counts, currentItem, currentPanel, progress, start, stop, retry, skip, regeneratePanel, refresh, applyStoryBrief, resetStoryBrief,
  };
}
