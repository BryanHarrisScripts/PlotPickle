"use client";

/* eslint-disable @next/next/no-img-element -- Comic panels are local generated assets stored outside the application bundle. */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildComicPitchDeckHtml,
  comicPitchDeckFileName,
  comicPitchDeckPreflight,
  comicPitchIdentityLocks,
  comicPitchReferenceImages,
  createComicPitchDeckPlan,
  finalizeComicPitchDeck,
  recordComicPitchDeckProvenance,
  resetFailedComicPitchPanels,
  updateComicPitchPanel,
  withComicPitchDeck,
} from "@/lib/ai-pitch-deck";
import {
  createBlankComicPitchDeck,
  type ComicPitchDeck,
  type ComicPitchDialogue,
  type ComicPitchPanel,
  type PlotPickleProject,
} from "@/lib/project";
import type { PublicConnectionStatus } from "@/lib/connection-status";
import {
  discoverLocalGraphicNovelVersions,
  graphicNovelAssetVersions,
  normalizeLocalGraphicNovelAssets,
  prepareGraphicNovelRepositoryVersion,
  selectGraphicNovelAssetVersion,
} from "@/lib/graphic-novel-asset-versions";
import type { ProjectAssetReference } from "@/lib/project-assets";
import styles from "./ai-pitch-deck-workspace.module.css";

type ImageQuality = "low" | "medium" | "high";

type ImageGenerationResponse = {
  ok?: boolean;
  assetUrl?: string;
  revisedPrompt?: string;
  provider?: string;
  model?: string;
  referenceImagesUsed?: number;
  message?: string;
};

type Props = {
  project: PlotPickleProject;
  aiStatus: PublicConnectionStatus;
  imageModel: string;
  onProjectChange: (project: PlotPickleProject) => void;
  onOpenAiSettings: () => void;
  onOpenCharacters: () => void;
};

function downloadText(fileName: string, value: string) {
  const url = URL.createObjectURL(new Blob([value], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function blobDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("The generated image could not be embedded."));
    reader.readAsDataURL(blob);
  });
}

async function embeddedPanelImages(deck: ComicPitchDeck) {
  const values = await Promise.all(deck.panels.filter((panel) => panel.imageSrc).map(async (panel) => {
    const response = await fetch(panel.imageSrc);
    if (!response.ok) throw new Error(`Panel ${panel.pageNumber}.${panel.panelNumber} could not be embedded.`);
    return [panel.id, await blobDataUrl(await response.blob())] as const;
  }));
  return Object.fromEntries(values);
}

function panelLabel(panel: ComicPitchPanel) {
  return `${panel.pageNumber}.${panel.panelNumber}`;
}

function nextDialogue(panel: ComicPitchPanel): ComicPitchDialogue {
  return {
    id: `comic-dialogue-${panel.pageNumber}-${panel.panelNumber}-${Date.now()}`,
    characterId: "",
    characterName: "Speaker",
    text: "",
    sourceElementId: "",
  };
}

export default function AiPitchDeckWorkspace({
  project,
  aiStatus,
  imageModel,
  onProjectChange,
  onOpenAiSettings,
  onOpenCharacters,
}: Props) {
  const canonicalDeck = useMemo(
    () => project.review.pitchPackage.comicDeck ?? createBlankComicPitchDeck(project.review.pitchPackage.updatedAt),
    [project.review.pitchPackage.comicDeck, project.review.pitchPackage.updatedAt],
  );
  const [deck, setDeck] = useState<ComicPitchDeck>(() => canonicalDeck.panels.length ? canonicalDeck : createComicPitchDeckPlan(project));
  const [quality, setQuality] = useState<ImageQuality>("low");
  const [acknowledged, setAcknowledged] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [assetDirectory, setAssetDirectory] = useState("");
  const [assetMessage, setAssetMessage] = useState("");
  const [assetBusy, setAssetBusy] = useState(false);
  const [publishingPanelId, setPublishingPanelId] = useState("");
  const [selectedPage, setSelectedPage] = useState(1);
  const controllerRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (runningRef.current) return;
    setDeck(canonicalDeck.panels.length ? canonicalDeck : createComicPitchDeckPlan(project));
  }, [canonicalDeck, project]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const preflight = useMemo(() => comicPitchDeckPreflight(project, deck), [project, deck]);
  const selectedPanels = useMemo(
    () => deck.panels.filter((panel) => panel.pageNumber === selectedPage).sort((left, right) => left.panelNumber - right.panelNumber),
    [deck.panels, selectedPage],
  );
  const aiReady = aiStatus.state === "connected" && Boolean(imageModel);
  const completionPercent = deck.panels.length ? Math.round((preflight.completePanels / deck.panels.length) * 100) : 0;

  function persist(nextDeck: ComicPitchDeck, provenance = false) {
    setDeck(nextDeck);
    onProjectChange(provenance
      ? recordComicPitchDeckProvenance(project, nextDeck)
      : withComicPitchDeck(project, nextDeck));
  }

  function rebuildPlan(preserveCompleted: boolean) {
    const next = createComicPitchDeckPlan(project, deck, preserveCompleted);
    persist(next);
    setMessage(preserveCompleted
      ? "The 96-panel plan was refreshed from the canonical story. Completed images were preserved."
      : "The deck was rebuilt from the canonical story. Every panel is ready for a new image.");
  }

  async function requestPanel(panel: ComicPitchPanel, signal: AbortSignal) {
    const response = await fetch("/api/local-ai/generate/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        prompt: panel.prompt,
        assetId: panel.id,
        aspect: "landscape",
        quality,
        referenceImages: comicPitchReferenceImages(project, panel),
        identityLocks: comicPitchIdentityLocks(project, panel),
        requestCount: 1,
        billingAcknowledged: acknowledged,
      }),
    });
    const result = await response.json() as ImageGenerationResponse;
    if (!response.ok || !result.assetUrl) throw new Error(result.message || "The image provider returned no image.");
    return result;
  }

  async function generate(inputDeck: ComicPitchDeck, onlyPanelIds: string[] = []) {
    if (runningRef.current || !aiReady) return;
    const readiness = comicPitchDeckPreflight(project, inputDeck);
    const targetedPanelIds = new Set(onlyPanelIds);
    const targetedPanels = inputDeck.panels.filter((panel) => targetedPanelIds.has(panel.id));
    const hasUnlockedTarget = targetedPanels.some(
      (panel) => comicPitchIdentityLocks(project, panel).length !== panel.characterIds.length,
    );
    if (hasUnlockedTarget) {
      setMessage("Lock every recurring character in this panel before generating it.");
      return;
    }
    if (!targetedPanelIds.size && !readiness.ready) {
      setMessage(readiness.missingCharacterLocks.length
        ? `Lock the visual identity for ${readiness.missingCharacterLocks.join(", ")} before generating the complete deck.`
        : "The deck plan must contain all 96 panels before generation.");
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    runningRef.current = true;
    setWorking(true);
    setMessage("Generation started. Completed panels are saved as the run progresses.");

    let current: ComicPitchDeck = { ...inputDeck, status: "generating", updatedAt: new Date().toISOString() };
    persist(current);
    const targets = current.panels.filter((panel) => targetedPanelIds.size
      ? targetedPanelIds.has(panel.id)
      : panel.status !== "complete" || !panel.imageSrc);
    let consecutiveErrors = 0;
    let stoppedAfterErrors = false;

    for (const target of targets) {
      if (controller.signal.aborted) break;
      current = updateComicPitchPanel(current, target.id, { status: "generating", error: "" }, "generating");
      persist(current);
      try {
        const latestPanel = current.panels.find((panel) => panel.id === target.id) ?? target;
        const result = await requestPanel(latestPanel, controller.signal);
        const generatedAt = new Date().toISOString();
        current = updateComicPitchPanel(current, target.id, {
          imageSrc: result.assetUrl,
          revisedPrompt: result.revisedPrompt || latestPanel.prompt,
          status: "complete",
          error: "",
          provider: result.provider || aiStatus.identity,
          model: result.model || imageModel,
          generatedAt,
        }, "generating");
        consecutiveErrors = 0;
        persist(current);
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          current = updateComicPitchPanel(current, target.id, { status: "pending", error: "" }, "paused");
          break;
        }
        const errorMessage = error instanceof Error ? error.message : "Image generation failed.";
        current = updateComicPitchPanel(current, target.id, { status: "error", error: errorMessage }, "generating");
        consecutiveErrors += 1;
        persist(current);
        if (consecutiveErrors >= 3) {
          stoppedAfterErrors = true;
          break;
        }
      }
    }

    const paused = controller.signal.aborted || stoppedAfterErrors;
    current = finalizeComicPitchDeck(current, paused);
    const remainingErrors = current.panels.filter((panel) => panel.status === "error").length;
    persist(current, true);
    setWorking(false);
    runningRef.current = false;
    controllerRef.current = null;
    setMessage(controller.signal.aborted
      ? "Generation paused. Completed panels were kept; select Resume remaining panels when ready."
      : stoppedAfterErrors
        ? "Generation paused after three consecutive provider errors. Repair the connection, then retry failed panels."
        : current.status === "complete"
          ? "The complete 24-page comic pitch deck is ready."
          : remainingErrors
            ? "The run finished with panel errors. Completed panels were kept; retry only the failed panels."
            : targetedPanelIds.size
              ? `${targets.length} selected panel${targets.length === 1 ? " was" : "s were"} generated. Resume the remaining panels when ready.`
              : "The run finished. Resume any remaining panels when ready.");
  }

  function startCompleteGeneration() {
    const prepared = deck.panels.length === 96 ? deck : createComicPitchDeckPlan(project, deck);
    persist(prepared);
    void generate(prepared);
  }

  function cancelGeneration() {
    controllerRef.current?.abort();
    setMessage("Pausing new requests. The provider may still finish the active request.");
  }

  function retryFailed() {
    const failedPanelIds = deck.panels.filter((panel) => panel.status === "error").map((panel) => panel.id);
    const next = resetFailedComicPitchPanels(deck);
    persist(next);
    void generate(next, failedPanelIds);
  }

  function updatePanel(panelId: string, patch: Partial<ComicPitchPanel>) {
    persist(updateComicPitchPanel(deck, panelId, patch));
  }

  async function scanLocalAssetVersions() {
    setAssetBusy(true);
    setAssetMessage("Scanning the private PlotPickle asset folder…");
    try {
      const response = await fetch("/api/local-ai/assets", { headers: { Accept: "application/json" } });
      const type = response.headers.get("content-type") || "";
      if (!type.includes("application/json")) throw new Error("Local asset discovery is available in the downloaded PlotPickle server.");
      const body = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : "The local asset folder could not be scanned.");
      const files = normalizeLocalGraphicNovelAssets(body.assets);
      const discovered = discoverLocalGraphicNovelVersions(project, files);
      setAssetDirectory(typeof body.directory === "string" ? body.directory : "");
      onProjectChange(discovered.project);
      setDeck(discovered.project.review.pitchPackage.comicDeck ?? deck);
      setAssetMessage(discovered.matched
        ? `${discovered.matched} local image${discovered.matched === 1 ? "" : "s"} matched to Graphic Novel panels. ${discovered.unmatched ? `${discovered.unmatched} other image${discovered.unmatched === 1 ? " was" : "s were"} left untouched.` : "No unrelated images were changed."}`
        : `No files matched these stable panel IDs. ${files.length} local image${files.length === 1 ? " was" : "s were"} left untouched.`);
    } catch (error) {
      setAssetMessage(error instanceof Error ? error.message : "The local asset folder could not be scanned.");
    } finally {
      setAssetBusy(false);
    }
  }

  function selectAssetVersion(panelId: string, reference: ProjectAssetReference) {
    try {
      const next = selectGraphicNovelAssetVersion(project, panelId, reference);
      setDeck(next.review.pitchPackage.comicDeck ?? deck);
      onProjectChange(next);
      setAssetMessage("The preferred panel version changed. Every other version remains available.");
    } catch (error) {
      setAssetMessage(error instanceof Error ? error.message : "The image version could not be selected.");
    }
  }

  async function publishAssetVersion(panel: ComicPitchPanel, reference: ProjectAssetReference) {
    setPublishingPanelId(panel.id);
    setAssetMessage("Preparing an immutable repository alternate and Story Proposal…");
    try {
      const prepared = prepareGraphicNovelRepositoryVersion(project, panel.id, reference);
      const response = await fetch("/api/local-github/submit-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: prepared.project,
          title: `Graphic Novel alternate: ${panel.title}`,
          note: `Publish the selected local image for Page ${panel.pageNumber}, Panel ${panel.panelNumber} as a non-destructive repository alternate.`,
          baseRevision: project.collaboration.lastPulledCommit,
          assetFiles: [prepared.assetFile],
        }),
      });
      const type = response.headers.get("content-type") || "";
      if (!type.includes("application/json")) throw new Error("GitHub asset publishing is available in the downloaded PlotPickle server.");
      const body = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : "The repository alternate could not be proposed.");
      const commitSha = typeof body.commitSha === "string" ? body.commitSha : "";
      const next = {
        ...prepared.project,
        collaboration: {
          ...prepared.project.collaboration,
          provider: "github" as const,
          syncEnabled: true,
          lastPushedCommit: commitSha,
          updatedAt: new Date().toISOString(),
        },
      };
      setDeck(next.review.pitchPackage.comicDeck ?? deck);
      onProjectChange(next);
      const number = Number(body.pullRequestNumber) || 0;
      setAssetMessage(`Story Proposal #${number} contains the repository alternate. The approved story and original image are unchanged until Project Lead approval.`);
      const url = typeof body.pullRequestUrl === "string" ? body.pullRequestUrl : "";
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setAssetMessage(error instanceof Error ? error.message : "The repository alternate could not be proposed.");
    } finally {
      setPublishingPanelId("");
    }
  }

  async function exportHtml(print = false) {
    const printWindow = print ? window.open("", "_blank") : null;
    setMessage("Embedding local panel images into the deck…");
    try {
      const images = await embeddedPanelImages(deck);
      const preparedProject = withComicPitchDeck(project, deck);
      const html = buildComicPitchDeckHtml(preparedProject, images);
      if (print) {
        if (!printWindow) throw new Error("The print window was blocked. Allow pop-ups for this local PlotPickle page.");
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        window.setTimeout(() => printWindow.print(), 250);
      } else {
        downloadText(comicPitchDeckFileName(preparedProject), html);
      }
      setMessage(print ? "The print-ready deck opened. Choose Save as PDF in the print dialog." : "The self-contained comic pitch deck was downloaded.");
    } catch (error) {
      printWindow?.close();
      setMessage(error instanceof Error ? error.message : "The comic deck could not be exported.");
    }
  }

  return (
    <section className={styles.workspace} aria-labelledby="comic-pitch-title">
      <header className={styles.hero}>
        <div>
          <span>Pitch · Automatic visual story</span>
          <h1 id="comic-pitch-title">Complete comic-book pitch deck</h1>
          <p>PlotPickle rebuilds the current canonical story as 24 black-and-white comic pages with four directed panels per page. Character dialogue stays editable and accessible in speech balloons above the generated art.</p>
        </div>
        <div className={styles.heroBadge}><strong>{completionPercent}%</strong><span>{preflight.completePanels} of {preflight.panelCount} panels</span></div>
      </header>

      <div className={styles.progress} aria-label={`${completionPercent}% of comic pitch panels generated`}><i style={{ width: `${completionPercent}%` }} /></div>

      <section className={styles.preflight} aria-labelledby="comic-preflight-title">
        <div className={styles.sectionHeading}>
          <div><span>Preflight</span><h2 id="comic-preflight-title">One explicit run, with every boundary visible</h2></div>
          <strong className={aiReady ? styles.ready : styles.blocked}>{aiReady ? "AI image provider ready" : "AI image provider required"}</strong>
        </div>
        <div className={styles.stats}>
          <article><strong>24</strong><span>comic pages</span></article>
          <article><strong>96</strong><span>landscape image calls</span></article>
          <article><strong>{preflight.lockedCharacterCount}/{preflight.relevantCharacterCount}</strong><span>character identities locked</span></article>
          <article><strong>{preflight.approvedReferenceCount}</strong><span>approved references</span></article>
          <article><strong>{preflight.canonicalDialoguePanels}</strong><span>panels with screenplay dialogue</span></article>
          <article><strong>{preflight.derivedNarrationPanels}</strong><span>fallback captions to review</span></article>
        </div>
        {!aiReady ? <div className={styles.warning}><div><strong>Connect and verify an image-capable provider.</strong><p>Pitch generation is optional. Every other PlotPickle workspace remains available without AI.</p></div><button type="button" onClick={onOpenAiSettings}>Open Story &amp; Art</button></div> : null}
        {preflight.missingCharacterLocks.length ? <div className={styles.warning}><div><strong>Lock recurring character identities first.</strong><p>{preflight.missingCharacterLocks.join(", ")} {preflight.missingCharacterLocks.length === 1 ? "needs" : "need"} an approved visual identity before the full run.</p></div><button type="button" onClick={onOpenCharacters}>Open Character Visual Identity</button></div> : null}
        <div className={styles.costNotice}>
          <label><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span><strong>I understand this run can make up to {preflight.remainingImages} paid image API calls.</strong> Provider charges, reference-image input charges, rate limits and generation time apply. PlotPickle sends only the panel context and approved references shown here. Pausing prevents new calls, but the provider may still finish or charge for the active request.</span></label>
          <label><span>Image quality</span><select value={quality} onChange={(event) => setQuality(event.target.value as ImageQuality)} disabled={working}><option value="low">Draft · low cost and faster</option><option value="medium">Presentation · medium</option><option value="high">Final · high cost and slower</option></select></label>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => rebuildPlan(true)} disabled={working}>Refresh plan, keep completed art</button>
          <button type="button" onClick={() => rebuildPlan(false)} disabled={working}>Rebuild all 96 panels</button>
          {working ? <button type="button" className={styles.stop} onClick={cancelGeneration}>Pause generation</button> : (
            <button type="button" className={styles.primary} disabled={!aiReady || !preflight.ready || !acknowledged || preflight.remainingImages === 0} onClick={startCompleteGeneration}>
              {preflight.completePanels ? "Resume remaining panels" : "Generate complete pitch deck"}
            </button>
          )}
          {!working && preflight.failedPanels ? <button type="button" className={styles.primary} disabled={!aiReady || !acknowledged} onClick={retryFailed}>Retry {preflight.failedPanels} failed panel{preflight.failedPanels === 1 ? "" : "s"}</button> : null}
        </div>
        {message ? <p className={styles.status} role="status">{message}</p> : null}
      </section>

      <section className={styles.assetLibrary} aria-labelledby="graphic-novel-assets-title">
        <div>
          <span>Asset versions</span>
          <h2 id="graphic-novel-assets-title">Originals stay intact. Local alternates stay optional.</h2>
          <p>PlotPickle matches files by stable panel ID, records a SHA-256 hash and adds each match as a version. Scanning never overwrites, deletes or publishes an image.</p>
          <small>{assetDirectory || "Windows default: %LOCALAPPDATA%\\PlotPickle\\assets"}</small>
        </div>
        <div>
          <button type="button" disabled={assetBusy || working} onClick={() => void scanLocalAssetVersions()}>{assetBusy ? "Scanning…" : "Scan local images"}</button>
          <span>Publishing remains a separate per-version Story Proposal.</span>
        </div>
        {assetMessage ? <p className={styles.assetNotice} role="status" aria-live="polite">{assetMessage}</p> : null}
      </section>

      <div className={styles.deckLayout}>
        <nav className={styles.pageRail} aria-label="Comic pitch pages">
          <strong>24-page story</strong>
          {Array.from({ length: 24 }, (_, index) => index + 1).map((pageNumber) => {
            const pagePanels = deck.panels.filter((panel) => panel.pageNumber === pageNumber);
            const complete = pagePanels.filter((panel) => panel.status === "complete").length;
            const errors = pagePanels.filter((panel) => panel.status === "error").length;
            return <button type="button" key={pageNumber} className={selectedPage === pageNumber ? styles.activePage : ""} onClick={() => setSelectedPage(pageNumber)}><span>Page {pageNumber}</span><small>{errors ? `${errors} error${errors === 1 ? "" : "s"}` : `${complete}/4 images`}</small></button>;
          })}
        </nav>

        <section className={styles.comicPage} aria-labelledby={`comic-page-${selectedPage}`}>
          <header><div><span>Page {selectedPage} of 24</span><h2 id={`comic-page-${selectedPage}`}>{project.blocks.find((block) => block.number === selectedPage)?.title || `Block ${selectedPage}`}</h2></div><strong>{selectedPanels.filter((panel) => panel.status === "complete").length}/4 complete</strong></header>
          <div className={styles.panelGrid}>
            {selectedPanels.map((panel) => (
              <article className={styles.panel} key={panel.id}>
                <div className={styles.panelImage}>
                  {panel.imageSrc ? <img src={panel.imageSrc} alt={`${panel.title}: ${panel.narration}`} /> : <div className={styles.placeholder}><strong>{panelLabel(panel)}</strong><span>{panel.status === "generating" ? "Generating…" : panel.status === "error" ? "Generation failed" : "Ready for image"}</span></div>}
                  <div className={styles.bubbles}>
                    {panel.dialogue.map((dialogue) => <blockquote key={dialogue.id}><strong>{dialogue.characterName}</strong><p>{dialogue.text || "…"}</p></blockquote>)}
                  </div>
                  <span className={`${styles.panelState} ${styles[panel.status]}`}>{panel.status}</span>
                </div>
                <div className={styles.caption}><strong>{panel.title}</strong><p>{panel.narration}</p>{panel.narrationSource === "derived" ? <small>Derived fallback narration · review before export</small> : null}</div>
                <details className={styles.editor}>
                  <summary>Edit panel {panelLabel(panel)}</summary>
                  <section className={styles.versionPicker} aria-label={`Image versions for panel ${panelLabel(panel)}`}>
                    <div><strong>Image versions</strong><span>Selecting one changes the preferred panel image, not the stored originals or alternates.</span></div>
                    <div className={styles.versionGrid}>
                      {graphicNovelAssetVersions(project, panel).map((version) => (
                        <article key={`${version.reference.assetId}:${version.reference.variationId}`} data-origin={version.origin} data-selected={version.selected || undefined}>
                          <div>{version.source ? <img src={version.source} alt="" /> : null}</div>
                          <strong>{version.label}</strong>
                          <small>{version.contentHash ? version.contentHash.slice(0, 20) + "…" : "Bundled reference"}</small>
                          <button type="button" disabled={version.selected || working || Boolean(publishingPanelId)} onClick={() => selectAssetVersion(panel.id, version.reference)}>{version.selected ? "Selected" : "Use version"}</button>
                          {version.origin === "local" ? <button type="button" className={styles.publishVersion} disabled={working || Boolean(publishingPanelId)} onClick={() => void publishAssetVersion(panel, version.reference)}>{publishingPanelId === panel.id ? "Preparing proposal…" : "Publish alternate to GitHub"}</button> : null}
                        </article>
                      ))}
                      {!graphicNovelAssetVersions(project, panel).length ? <p>No registered versions yet. Scan local images or generate this panel.</p> : null}
                    </div>
                  </section>
                  <label><span>Narration</span><textarea value={panel.narration} onChange={(event) => updatePanel(panel.id, { narration: event.target.value, narrationSource: "derived" })} /></label>
                  <label><span>Directed shot</span><textarea value={panel.shotDirection} onChange={(event) => updatePanel(panel.id, { shotDirection: event.target.value })} /></label>
                  <label><span>Image prompt</span><textarea value={panel.prompt} onChange={(event) => updatePanel(panel.id, { prompt: event.target.value })} /></label>
                  <div className={styles.dialogueEditor}>
                    <div><strong>Dialogue balloons</strong><button type="button" onClick={() => updatePanel(panel.id, { dialogue: [...panel.dialogue, nextDialogue(panel)] })}>Add balloon</button></div>
                    {panel.dialogue.map((dialogue) => <div key={dialogue.id}><input aria-label="Character name" value={dialogue.characterName} onChange={(event) => updatePanel(panel.id, { dialogue: panel.dialogue.map((item) => item.id === dialogue.id ? { ...item, characterName: event.target.value, sourceElementId: "" } : item) })} /><textarea aria-label={`${dialogue.characterName} dialogue`} value={dialogue.text} onChange={(event) => updatePanel(panel.id, { dialogue: panel.dialogue.map((item) => item.id === dialogue.id ? { ...item, text: event.target.value, sourceElementId: "" } : item) })} /><button type="button" onClick={() => updatePanel(panel.id, { dialogue: panel.dialogue.filter((item) => item.id !== dialogue.id) })}>Remove</button></div>)}
                  </div>
                  <div className={styles.panelActions}><button type="button" className={styles.primary} disabled={working || !aiReady || !acknowledged || comicPitchIdentityLocks(project, panel).length !== panel.characterIds.length} onClick={() => void generate(deck, [panel.id])}>{panel.imageSrc ? "Regenerate this panel" : "Generate this panel"}</button></div>
                  {panel.error ? <p className={styles.panelError}>{panel.error}</p> : null}
                  {panel.generatedAt ? <small>Generated {new Date(panel.generatedAt).toLocaleString()} · {panel.provider} · {panel.model}</small> : null}
                </details>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.exports} aria-labelledby="comic-export-title">
        <div><span>Export</span><h2 id="comic-export-title">Carry the complete visual story into the room</h2><p>Generated images are embedded into one portable HTML file. Dialogue balloons remain real text, and the same layout prints as a landscape PDF.</p></div>
        <div><button type="button" disabled={!preflight.completePanels || working} onClick={() => void exportHtml(false)}>Download self-contained HTML</button><button type="button" disabled={!preflight.completePanels || working} onClick={() => void exportHtml(true)}>Print / Save as PDF</button></div>
      </section>
    </section>
  );
}
