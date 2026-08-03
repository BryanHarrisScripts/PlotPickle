"use client";

/* eslint-disable @next/next/no-img-element -- Graphic Novel panels are local generated assets stored outside the application bundle. */

import { useState } from "react";
import { buildGraphicNovelHtml, graphicNovelFileName, withComicPitchDeck } from "@/lib/ai-pitch-deck";
import type { PlotPickleProject } from "@/lib/project";
import type { PublicConnectionStatus } from "@/lib/connection-status";
import AiPitchDeckWorkspaceBase from "./ai-pitch-deck-workspace-base";
import RefreshAction from "./refresh-action";
import GraphicNovelStoryBriefEditor from "./graphic-novel-story-brief";
import GraphicNovelViewer from "./graphic-novel-viewer";
import { useCastIdentityQueue } from "./use-cast-identity-queue";
import { useGraphicNovelQueue } from "./use-graphic-novel-queue";
import castStyles from "./cast-identity-queue.module.css";
import styles from "./graphic-novel-queue.module.css";

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

async function embeddedImages(project: PlotPickleProject) {
  const panels = project.review.pitchPackage.comicDeck?.panels ?? [];
  const entries = await Promise.all(panels.filter((panel) => panel.imageSrc).map(async (panel) => {
    const response = await fetch(panel.imageSrc);
    if (!response.ok) throw new Error(`Page ${panel.pageNumber}, panel ${panel.panelNumber} could not be embedded.`);
    return [panel.id, await blobDataUrl(await response.blob())] as const;
  }));
  return Object.fromEntries(entries);
}

export default function AiPitchDeckWorkspace(props: Props) {
  const queue = useGraphicNovelQueue(props);
  const cast = useCastIdentityQueue(props);
  const [exportMessage, setExportMessage] = useState("");
  const editorAiStatus = queue.working || cast.working
    ? { ...props.aiStatus, state: "disconnected" as const }
    : props.aiStatus;

  async function exportGraphicNovel(print = false) {
    const printWindow = print ? window.open("", "_blank") : null;
    setExportMessage("Embedding completed Graphic Novel images into the export…");
    try {
      const prepared = withComicPitchDeck(props.project, queue.deck);
      const html = buildGraphicNovelHtml(prepared, await embeddedImages(prepared));
      if (print) {
        if (!printWindow) throw new Error("The print window was blocked. Allow pop-ups for this local PlotPickle page.");
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        window.setTimeout(() => printWindow.print(), 250);
      } else {
        downloadText(graphicNovelFileName(prepared), html);
      }
      setExportMessage(print ? "The print-ready Graphic Novel opened." : "The self-contained Graphic Novel was downloaded.");
    } catch (error) {
      printWindow?.close();
      setExportMessage(error instanceof Error ? error.message : "The Graphic Novel could not be exported.");
    }
  }

  return (
    <section className={styles.workspace} aria-labelledby="graphic-novel-title">
      <header className={styles.hero}>
        <div>
          <span>Pitch · Automatic visual story</span>
          <h1 id="graphic-novel-title">Complete Graphic Novel</h1>
          <p>Prepare and review a 24-page, 96-panel Graphic Novel from the canonical story. Character identities are prepared separately first; the panel queue then sends exactly one provider request at a time and can stop or resume at any point.</p>
        </div>
        <div className={styles.heroBadge}><strong>{queue.progress}%</strong><span>{queue.counts.completed} completed · {queue.counts.remaining} remaining</span></div>
      </header>

      <div className={styles.progress} aria-label={`${queue.progress}% of Graphic Novel queue completed`}><i style={{ width: `${queue.progress}%` }} /></div>

      <GraphicNovelStoryBriefEditor
        brief={queue.brief}
        working={queue.working || cast.working}
        onSave={queue.applyStoryBrief}
        onReset={queue.resetStoryBrief}
      />

      <section className={styles.controlPanel} aria-labelledby="graphic-novel-preflight">
        <div className={styles.heading}>
          <div><span>One-at-a-time queue</span><h2 id="graphic-novel-preflight">See every image, stop at any time</h2></div>
          <strong data-state={queue.aiReady ? "ready" : "blocked"}>{queue.aiReady ? "Image provider ready" : "Image provider required"}</strong>
        </div>
        <div className={styles.stats}>
          <article><strong>24</strong><span>Graphic Novel pages</span></article>
          <article><strong>{queue.counts.total || 96}</strong><span>ordered panels</span></article>
          <article><strong>{queue.counts.completed}</strong><span>completed</span></article>
          <article><strong>{queue.counts.remaining}</strong><span>remaining</span></article>
          <article><strong>{queue.counts.failed}</strong><span>failed</span></article>
          <article><strong>{queue.counts.skipped}</strong><span>skipped</span></article>
        </div>

        <section className={castStyles.panel} aria-labelledby="entire-cast-title">
          <div className={castStyles.heading}>
            <div>
              <span>Character Visual Identity</span>
              <h3 id="entire-cast-title">Prepare or regenerate the entire cast</h3>
              <p>Every named character receives one sequential master-reference request. Existing locked identities remain active while replacements wait for individual review and approval.</p>
            </div>
            <strong>{cast.counts.locked} of {cast.counts.total} locked</strong>
          </div>
          <div className={castStyles.metrics}>
            <div><strong>{cast.counts.total}</strong><span>named characters</span></div>
            <div><strong>{cast.counts.locked}</strong><span>approved identities</span></div>
            <div><strong>{cast.counts.pendingReview}</strong><span>replacements to review</span></div>
            <div><strong>{cast.counts.failed}</strong><span>failed requests</span></div>
          </div>
          <label className={castStyles.confirmation}>
            <input type="checkbox" checked={cast.acknowledged} onChange={(event) => cast.setAcknowledged(event.target.checked)} disabled={cast.working} />
            <span><strong>I understand this can make up to {cast.counts.remaining} paid image API calls.</strong> PlotPickle runs one character at a time. No replacement becomes approved automatically.</span>
          </label>
          <div className={castStyles.actions}>
            <button type="button" onClick={props.onOpenCharacters}>Open Character Visual Identity</button>
            <RefreshAction label="Refresh cast plan" onClick={cast.refresh} disabled={cast.working} />
            {cast.working
              ? <button type="button" className={castStyles.stop} onClick={cast.stop}>Stop cast regeneration</button>
              : <button type="button" className={castStyles.primary} onClick={() => void cast.start()} disabled={!cast.aiReady || !cast.acknowledged || cast.counts.remaining === 0}>Regenerate Entire Cast</button>}
          </div>
          {cast.items.some((item) => item.state !== "pending") ? (
            <ul className={castStyles.queue} aria-label="Entire cast regeneration progress">
              {cast.items.map((item) => (
                <li key={item.id}>
                  <strong>{item.label}</strong><span>{item.state}</span>
                  {item.error ? <small>{item.error} <button type="button" disabled={cast.working} onClick={() => cast.skip(item.id)}>Skip</button></small> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {cast.message ? <p className={castStyles.notice} role="status" aria-live="polite">{cast.message}</p> : null}
        </section>

        {!queue.aiReady ? <div className={styles.warning}><div><strong>Connect and verify an image-capable provider.</strong><p>The Graphic Novel queue is optional. Every other PlotPickle workspace remains available without AI.</p></div><button type="button" onClick={props.onOpenAiSettings}>Open Story &amp; Art</button></div> : null}
        {queue.preflight.missingCharacterLocks.length ? <div className={styles.warning}><div><strong>Lock recurring character identities first.</strong><p>{queue.preflight.missingCharacterLocks.join(", ")} {queue.preflight.missingCharacterLocks.length === 1 ? "needs" : "need"} an approved visual identity before the complete Graphic Novel queue can run.</p></div><button type="button" onClick={props.onOpenCharacters}>Open Character Visual Identity</button></div> : null}
        <div className={styles.costNotice}>
          <label><input type="checkbox" checked={queue.acknowledged} onChange={(event) => queue.setAcknowledged(event.target.checked)} /><span><strong>I understand this run can make up to {queue.preflight.remainingImages} paid image API calls.</strong> PlotPickle sends one image request at a time. Stopping prevents the next request, while the provider may still finish or charge for the active request.</span></label>
          <label><span>Image quality</span><select value={queue.quality} onChange={(event) => queue.setQuality(event.target.value as "low" | "medium" | "high")} disabled={queue.working}><option value="low">Draft · low cost and faster</option><option value="medium">Presentation · medium</option><option value="high">Final · high cost and slower</option></select></label>
        </div>
        <div className={styles.actions}>
          <RefreshAction label="Refresh plan, keep completed art" onClick={() => queue.refresh(true)} disabled={queue.working} />
          <button type="button" onClick={() => queue.refresh(false)} disabled={queue.working}>Rebuild all 96 panels</button>
          {queue.working
            ? <button type="button" className={styles.stop} onClick={queue.stop}>Stop generation</button>
            : <button type="button" className={styles.primary} disabled={!queue.aiReady || !queue.preflight.ready || !queue.acknowledged || queue.counts.remaining === 0} onClick={queue.start}>{queue.counts.completed ? "Resume remaining images" : "Generate all Graphic Novel images"}</button>}
        </div>
        {queue.message ? <p className={styles.status} role="status">{queue.message}</p> : null}
      </section>

      {queue.queue ? (
        <section className={styles.queuePanel} aria-labelledby="graphic-novel-queue-title">
          <div className={styles.heading}>
            <div><span>Queue progress</span><h2 id="graphic-novel-queue-title">{queue.currentItem?.label || "No image is currently active"}</h2></div>
            <strong data-state={queue.queue.status}>{queue.queue.status.replaceAll("-", " ")}</strong>
          </div>
          <div className={styles.currentItem}>
            <div className={styles.currentPreview}>{queue.currentPanel?.imageSrc ? <img src={queue.currentPanel.imageSrc} alt={`${queue.currentPanel.title}: ${queue.currentPanel.narration}`} /> : <div><strong>{queue.currentItem?.label || "Queue ready"}</strong><span>{queue.currentItem?.state || "idle"}</span></div>}</div>
            <div><strong>{queue.currentPanel?.title || "The next panel will appear here."}</strong><p>{queue.currentPanel?.narration || "Start or resume the queue to generate one panel at a time."}</p>{queue.currentItem ? <dl><div><dt>Status</dt><dd>{queue.currentItem.state}</dd></div><div><dt>Attempts</dt><dd>{queue.currentItem.attempts}</dd></div><div><dt>Position</dt><dd>{queue.currentItem.order + 1} of {queue.counts.total}</dd></div></dl> : null}</div>
          </div>
          {queue.queue.items.some((item) => item.state === "failed") ? <div className={styles.failures}>{queue.queue.items.filter((item) => item.state === "failed").map((item) => <article key={item.id}><div><strong>{item.label}</strong><span>{item.error}</span></div><div><button type="button" disabled={queue.working} onClick={() => queue.retry(item.id)}>Retry</button><button type="button" disabled={queue.working} onClick={() => queue.skip(item.id)}>Skip</button></div></article>)}</div> : null}
        </section>
      ) : null}

      <GraphicNovelViewer
        project={props.project}
        working={queue.working || cast.working}
        onProjectChange={props.onProjectChange}
      />

      <div className={styles.legacyEditor}>
        <AiPitchDeckWorkspaceBase {...props} aiStatus={editorAiStatus} />
      </div>

      <section className={styles.exports} aria-labelledby="graphic-novel-export-title">
        <div><span>Export</span><h2 id="graphic-novel-export-title">Carry the Graphic Novel into the room</h2><p>Completed images are embedded into one portable HTML file. Dialogue balloons remain real text, and saved Phase 7 placement carries into HTML and PDF output.</p>{exportMessage ? <small>{exportMessage}</small> : null}</div>
        <div><button type="button" disabled={!queue.counts.completed || queue.working || cast.working} onClick={() => void exportGraphicNovel(false)}>Download self-contained HTML</button><button type="button" disabled={!queue.counts.completed || queue.working || cast.working} onClick={() => void exportGraphicNovel(true)}>Print / Save as PDF</button></div>
      </section>
    </section>
  );
}
