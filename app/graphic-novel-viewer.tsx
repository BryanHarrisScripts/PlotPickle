"use client";

/* eslint-disable @next/next/no-img-element -- Graphic Novel panels are local generated assets stored outside the application bundle. */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GRAPHIC_NOVEL_BALLOON_KINDS,
  GRAPHIC_NOVEL_BALLOON_PLACEMENTS,
  GRAPHIC_NOVEL_CAPTION_PLACEMENTS,
  graphicNovelBalloon,
  graphicNovelCaption,
  graphicNovelDialogueIssues,
  graphicNovelDialogueSummary,
  removeGraphicNovelBalloon,
  shortenGraphicNovelDialogue,
  updateGraphicNovelBalloon,
  updateGraphicNovelCaption,
  type GraphicNovelBalloonDirection,
  type GraphicNovelCaptionDirection,
} from "@/lib/graphic-novel-dialogue";
import { updateComicPitchPanel, withComicPitchDeck } from "@/lib/ai-pitch-deck";
import type { ComicPitchDeck, ComicPitchDialogue, ComicPitchPanel, PlotPickleProject } from "@/lib/project";
import styles from "./graphic-novel-viewer.module.css";

type ViewMode = "single" | "spread" | "panel";

type Props = {
  project: PlotPickleProject;
  deck: ComicPitchDeck;
  working: boolean;
  aiReady: boolean;
  acknowledged: boolean;
  onProjectChange: (project: PlotPickleProject) => void;
  onRegenerate: (panelId: string) => void;
  onOpenPanelEditor: (panelId: string) => void;
  onExportHtml: () => void;
  onPrint: () => void;
  onDownloadImages: () => void;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function nextDialogue(panel: ComicPitchPanel): ComicPitchDialogue {
  return {
    id: `graphic-novel-dialogue-${panel.id}-${Date.now()}`,
    characterId: "",
    characterName: "Speaker",
    text: "",
    sourceElementId: "",
  };
}

export default function GraphicNovelViewer({
  project,
  deck,
  working,
  aiReady,
  acknowledged,
  onProjectChange,
  onRegenerate,
  onOpenPanelEditor,
  onExportHtml,
  onPrint,
  onDownloadImages,
}: Props) {
  const viewerRef = useRef<HTMLElement>(null);
  const [pageNumber, setPageNumber] = useState(0);
  const [panelNumber, setPanelNumber] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [zoom, setZoom] = useState(100);
  const [showDialogue, setShowDialogue] = useState(true);
  const summary = useMemo(() => graphicNovelDialogueSummary(project, deck), [project, deck]);

  const visiblePages = useMemo(() => {
    if (pageNumber === 0) return [];
    if (viewMode !== "spread") return [pageNumber];
    return pageNumber < 24 ? [pageNumber, pageNumber + 1] : [pageNumber];
  }, [pageNumber, viewMode]);

  const currentPanel = useMemo(() => {
    if (pageNumber === 0) return undefined;
    return deck.panels.find((panel) => panel.pageNumber === pageNumber && panel.panelNumber === panelNumber)
      ?? deck.panels.find((panel) => panel.pageNumber === pageNumber);
  }, [deck.panels, pageNumber, panelNumber]);

  function move(delta: number) {
    if (viewMode === "panel" && pageNumber > 0) {
      const nextPanel = panelNumber + delta;
      if (nextPanel > 4) {
        setPanelNumber(1);
        setPageNumber((value) => clamp(value + 1, 0, 24));
      } else if (nextPanel < 1) {
        setPanelNumber(4);
        setPageNumber((value) => clamp(value - 1, 0, 24));
      } else {
        setPanelNumber(nextPanel);
      }
      return;
    }
    setPageNumber((value) => clamp(value + delta, 0, 24));
  }

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") move(1);
      if (event.key === "ArrowLeft" || event.key === "PageUp") move(-1);
      if (event.key.toLowerCase() === "d") setShowDialogue((value) => !value);
      if (event.key === "+" || event.key === "=") setZoom((value) => clamp(value + 10, 60, 150));
      if (event.key === "-") setZoom((value) => clamp(value - 10, 60, 150));
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  });

  function persistPanel(panelId: string, patch: Partial<ComicPitchPanel>) {
    const nextDeck = updateComicPitchPanel(deck, panelId, patch);
    onProjectChange(withComicPitchDeck(project, nextDeck));
  }

  function updateDialogue(panel: ComicPitchPanel, dialogueId: string, patch: Partial<ComicPitchDialogue>) {
    persistPanel(panel.id, {
      dialogue: panel.dialogue.map((dialogue) => dialogue.id === dialogueId ? { ...dialogue, ...patch } : dialogue),
    });
  }

  function updateBalloon(panel: ComicPitchPanel, dialogue: ComicPitchDialogue, index: number, patch: Partial<GraphicNovelBalloonDirection>) {
    const current = graphicNovelBalloon(project, panel, dialogue, index);
    onProjectChange(updateGraphicNovelBalloon(project, { ...current, ...patch }));
  }

  function updateCaption(panel: ComicPitchPanel, patch: Partial<GraphicNovelCaptionDirection>) {
    onProjectChange(updateGraphicNovelCaption(project, { ...graphicNovelCaption(project, panel), ...patch }));
  }

  function removeDialogue(panel: ComicPitchPanel, dialogueId: string) {
    const nextDeck = updateComicPitchPanel(deck, panel.id, { dialogue: panel.dialogue.filter((dialogue) => dialogue.id !== dialogueId) });
    onProjectChange(removeGraphicNovelBalloon(withComicPitchDeck(project, nextDeck), dialogueId));
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) await viewerRef.current?.requestFullscreen();
    else await document.exitFullscreen();
  }

  function renderPanel(panel: ComicPitchPanel) {
    const issues = graphicNovelDialogueIssues(project, panel);
    const caption = graphicNovelCaption(project, panel);
    const balloons = panel.dialogue
      .map((dialogue, index) => ({ dialogue, direction: graphicNovelBalloon(project, panel, dialogue, index) }))
      .sort((left, right) => left.direction.readingOrder - right.direction.readingOrder);
    return (
      <article
        className={styles.panel}
        key={panel.id}
        data-selected={currentPanel?.id === panel.id || undefined}
        onClick={() => setPanelNumber(panel.panelNumber)}
      >
        <div className={styles.panelImage}>
          {panel.imageSrc ? <img src={panel.imageSrc} alt={`${panel.title}: ${panel.narration}`} /> : <div className={styles.placeholder}>Image unresolved</div>}
          {showDialogue ? <div className={styles.balloons}>{balloons.map(({ dialogue, direction }) => (
            <blockquote
              key={dialogue.id}
              className={styles.balloon}
              data-kind={direction.kind}
              data-placement={direction.placement}
              style={{ zIndex: direction.readingOrder + 2 }}
            >
              <strong>{dialogue.characterName}</strong>
              <p>{dialogue.text || "…"}</p>
              {direction.emotionalDelivery ? <small>{direction.emotionalDelivery}</small> : null}
            </blockquote>
          ))}</div> : null}
          {issues.length ? <span className={styles.unresolved} title={issues.join("; ")}>{issues.length}</span> : null}
        </div>
        {showDialogue ? <div className={styles.caption} data-placement={caption.placement} style={{ zIndex: caption.readingOrder + 2 }}>
          <strong>{panel.title}</strong>
          <p>{panel.narration}</p>
        </div> : null}
      </article>
    );
  }

  const editorPanel = currentPanel;
  const editorIssues = editorPanel ? graphicNovelDialogueIssues(project, editorPanel) : [];

  return (
    <section ref={viewerRef} className={styles.viewer} aria-labelledby="graphic-novel-viewer-title">
      <header className={styles.heading}>
        <div>
          <span>Phase 7 · Read, edit and export</span>
          <h2 id="graphic-novel-viewer-title">Complete Graphic Novel Viewer</h2>
          <p>Read the cover and all 24 pages, edit balloons in context, inspect unresolved panels and carry the finished work into an interactive HTML reader, PDF or ordered image sequence.</p>
        </div>
        <strong>{summary.readyPanels}/{summary.panelCount} panels resolved</strong>
      </header>

      <nav className={styles.toolbar} aria-label="Graphic Novel viewer controls">
        <button type="button" onClick={() => { setPageNumber(0); setPanelNumber(1); }}>Cover</button>
        <button type="button" onClick={() => move(-1)} disabled={pageNumber === 0}>Previous</button>
        <output>{pageNumber === 0 ? "Cover" : `Page ${pageNumber}${viewMode === "panel" ? ` · Panel ${panelNumber}` : ""}`}</output>
        <button type="button" onClick={() => move(1)} disabled={pageNumber === 24 && (viewMode !== "panel" || panelNumber === 4)}>Next</button>
        <label><span>View</span><select value={viewMode} onChange={(event) => setViewMode(event.target.value as ViewMode)}><option value="single">Single page</option><option value="spread">Two-page spread</option><option value="panel">Panel-by-panel</option></select></label>
        <button type="button" onClick={() => setShowDialogue((value) => !value)}>{showDialogue ? "Hide dialogue" : "Show dialogue"}</button>
        <label><span>Zoom {zoom}%</span><input type="range" min="60" max="150" step="10" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
        <button type="button" onClick={() => void toggleFullscreen()}>Full screen</button>
      </nav>

      <div className={styles.stage} data-view={viewMode} style={{ "--viewer-zoom": zoom / 100 } as React.CSSProperties}>
        {pageNumber === 0 ? (
          <section className={styles.cover}>
            <span>PlotPickle Graphic Novel</span>
            <h3>{project.review.pitchPackage.title || project.metadata.title}</h3>
            <p>{project.review.pitchPackage.logline || project.story.logline}</p>
            <small>{project.rights.copyrightNotice}</small>
          </section>
        ) : visiblePages.map((visiblePage) => {
          const panels = deck.panels.filter((panel) => panel.pageNumber === visiblePage).sort((left, right) => left.panelNumber - right.panelNumber);
          const shown = viewMode === "panel" ? panels.filter((panel) => panel.panelNumber === panelNumber) : panels;
          return (
            <section className={styles.page} key={visiblePage} aria-label={`Graphic Novel page ${visiblePage}`}>
              <header><span>Page {visiblePage} of 24</span><h3>{project.blocks.find((block) => block.number === visiblePage)?.title || `Block ${visiblePage}`}</h3></header>
              <div className={styles.panelGrid}>{shown.map(renderPanel)}</div>
            </section>
          );
        })}
      </div>

      {editorPanel ? (
        <section className={styles.editor} aria-labelledby="graphic-novel-context-editor-title">
          <div className={styles.editorHeading}>
            <div><span>Page {editorPanel.pageNumber} · Panel {editorPanel.panelNumber}</span><h3 id="graphic-novel-context-editor-title">Bubble and caption editor</h3><p>{editorPanel.title}</p></div>
            <strong data-state={editorIssues.length ? "unresolved" : "ready"}>{editorIssues.length ? `${editorIssues.length} item${editorIssues.length === 1 ? "" : "s"} to review` : "Ready"}</strong>
          </div>

          <div className={styles.balloonEditors}>
            {editorPanel.dialogue.map((dialogue, index) => {
              const direction = graphicNovelBalloon(project, editorPanel, dialogue, index);
              const over = Math.max(0, dialogue.text.length - direction.maxCharacters);
              return (
                <fieldset key={dialogue.id}>
                  <legend>Reading order {direction.readingOrder}</legend>
                  <div className={styles.editorGrid}>
                    <label><span>Speaker</span><input value={dialogue.characterName} onChange={(event) => updateDialogue(editorPanel, dialogue.id, { characterName: event.target.value })} /></label>
                    <label><span>Balloon type</span><select value={direction.kind} onChange={(event) => updateBalloon(editorPanel, dialogue, index, { kind: event.target.value as GraphicNovelBalloonDirection["kind"] })}>{GRAPHIC_NOVEL_BALLOON_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
                    <label><span>Emotional delivery</span><input value={direction.emotionalDelivery} placeholder="guarded, breathless, furious…" onChange={(event) => updateBalloon(editorPanel, dialogue, index, { emotionalDelivery: event.target.value })} /></label>
                    <label><span>Placement</span><select value={direction.placement} onChange={(event) => updateBalloon(editorPanel, dialogue, index, { placement: event.target.value as GraphicNovelBalloonDirection["placement"] })}>{GRAPHIC_NOVEL_BALLOON_PLACEMENTS.map((placement) => <option key={placement} value={placement}>{placement.replaceAll("-", " ")}</option>)}</select></label>
                    <label><span>Reading order</span><input type="number" min="1" max="20" value={direction.readingOrder} onChange={(event) => updateBalloon(editorPanel, dialogue, index, { readingOrder: Number(event.target.value) })} /></label>
                    <label><span>Maximum suggested length</span><input type="number" min="20" max="280" value={direction.maxCharacters} onChange={(event) => updateBalloon(editorPanel, dialogue, index, { maxCharacters: Number(event.target.value) })} /></label>
                  </div>
                  <label className={styles.fullField}><span>{direction.kind === "thought" ? "Thought text" : "Spoken text"}</span><textarea value={dialogue.text} onChange={(event) => updateDialogue(editorPanel, dialogue.id, { text: event.target.value })} /></label>
                  <div className={styles.textActions}><small data-over={over > 0 || undefined}>{dialogue.text.length}/{direction.maxCharacters}{over ? ` · ${over} over` : ""}</small><button type="button" onClick={() => updateDialogue(editorPanel, dialogue.id, { text: shortenGraphicNovelDialogue(dialogue.text, direction.maxCharacters) })}>Automatic shortening</button><button type="button" onClick={() => updateDialogue(editorPanel, dialogue.id, { text: direction.originalText })}>Restore original line</button><button type="button" onClick={() => removeDialogue(editorPanel, dialogue.id)}>Remove balloon</button></div>
                  <blockquote className={styles.sourceLine}><strong>Source screenplay line</strong><p>{direction.originalText || "No linked screenplay line. This balloon was added in the Graphic Novel."}</p></blockquote>
                </fieldset>
              );
            })}
            <button type="button" className={styles.addBalloon} onClick={() => persistPanel(editorPanel.id, { dialogue: [...editorPanel.dialogue, nextDialogue(editorPanel)] })}>Add balloon</button>
          </div>

          {(() => {
            const caption = graphicNovelCaption(project, editorPanel);
            const over = Math.max(0, editorPanel.narration.length - caption.maxCharacters);
            return (
              <fieldset className={styles.captionEditor}>
                <legend>Narration / caption</legend>
                <div className={styles.editorGrid}>
                  <label><span>Placement</span><select value={caption.placement} onChange={(event) => updateCaption(editorPanel, { placement: event.target.value as GraphicNovelCaptionDirection["placement"] })}>{GRAPHIC_NOVEL_CAPTION_PLACEMENTS.map((placement) => <option key={placement} value={placement}>{placement.replaceAll("-", " ")}</option>)}</select></label>
                  <label><span>Reading order</span><input type="number" min="1" max="20" value={caption.readingOrder} onChange={(event) => updateCaption(editorPanel, { readingOrder: Number(event.target.value) })} /></label>
                  <label><span>Maximum suggested length</span><input type="number" min="40" max="500" value={caption.maxCharacters} onChange={(event) => updateCaption(editorPanel, { maxCharacters: Number(event.target.value) })} /></label>
                </div>
                <label className={styles.fullField}><span>Narration</span><textarea value={editorPanel.narration} onChange={(event) => persistPanel(editorPanel.id, { narration: event.target.value, narrationSource: "derived" })} /></label>
                <div className={styles.textActions}><small data-over={over > 0 || undefined}>{editorPanel.narration.length}/{caption.maxCharacters}{over ? ` · ${over} over` : ""}</small><button type="button" onClick={() => persistPanel(editorPanel.id, { narration: shortenGraphicNovelDialogue(editorPanel.narration, caption.maxCharacters), narrationSource: "derived" })}>Automatic shortening</button><button type="button" onClick={() => persistPanel(editorPanel.id, { narration: caption.originalText, narrationSource: "canonical" })}>Restore original narration</button></div>
                <blockquote className={styles.sourceLine}><strong>Original narration</strong><p>{caption.originalText}</p></blockquote>
              </fieldset>
            );
          })()}

          <div className={styles.panelActions}>
            <button type="button" disabled={working || !aiReady || !acknowledged} onClick={() => onRegenerate(editorPanel.id)}>Regenerate current panel</button>
            <button type="button" onClick={() => onOpenPanelEditor(editorPanel.id)}>Replace image / open versions</button>
          </div>
        </section>
      ) : null}

      <footer className={styles.exports}>
        <div><strong>Portable exports</strong><span>Dialogue stays editable text in HTML and PDF. Image sequence downloads only completed panel art in reading order.</span></div>
        <div><button type="button" onClick={onExportHtml}>Download interactive HTML</button><button type="button" onClick={onPrint}>Print / Save PDF</button><button type="button" onClick={onDownloadImages}>Download image sequence</button></div>
      </footer>
    </section>
  );
}
