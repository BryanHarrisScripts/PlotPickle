"use client";

/* eslint-disable @next/next/no-img-element -- Graphic Novel panels are user-generated local assets. */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { updateComicPitchPanel, withComicPitchDeck } from "@/lib/ai-pitch-deck";
import {
  graphicNovelBubblePlacement,
  resetGraphicNovelPanelBubbleLayout,
  withGraphicNovelBubblePlacement,
  type GraphicNovelBubblePlacement,
  type GraphicNovelBubbleStyle,
  type GraphicNovelBubbleTail,
} from "@/lib/graphic-novel-bubbles";
import {
  GRAPHIC_NOVEL_BALLOON_KINDS,
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
  type GraphicNovelBalloonKind,
  type GraphicNovelCaptionPlacement,
} from "@/lib/graphic-novel-dialogue";
import type {
  ComicPitchDeck,
  ComicPitchDialogue,
  ComicPitchPanel,
  PlotPickleProject,
} from "@/lib/project";
import styles from "./graphic-novel-viewer.module.css";

type Props = {
  project: PlotPickleProject;
  deck: ComicPitchDeck;
  working: boolean;
  aiReady: boolean;
  acknowledged: boolean;
  onProjectChange: (project: PlotPickleProject) => void;
  onRegenerate: (panelId: string) => void;
  onOpenPanelEditor: (panelId: string) => void;
  onDownloadImages: () => void;
};

type ViewMode = "page" | "spread" | "panel";

type DragState = {
  panelId: string;
  dialogueId: string;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  width: number;
  canvasWidth: number;
  canvasHeight: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.round(value * 10) / 10));
}

function panelLabel(panel: ComicPitchPanel) {
  return `Page ${panel.pageNumber}, panel ${panel.panelNumber}`;
}

function newDialogue(panel: ComicPitchPanel): ComicPitchDialogue {
  return {
    id: `graphic-novel-dialogue-${panel.pageNumber}-${panel.panelNumber}-${Date.now()}`,
    characterId: "",
    characterName: "Speaker",
    text: "New dialogue",
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
  onDownloadImages,
}: Props) {
  const [selectedPage, setSelectedPage] = useState(0);
  const [focusedPanelId, setFocusedPanelId] = useState("");
  const [selectedDialogueId, setSelectedDialogueId] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("page");
  const [editing, setEditing] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [showDialogue, setShowDialogue] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [dragPreview, setDragPreview] = useState<{ key: string; x: number; y: number } | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const panels = useMemo(() => deck.panels ?? [], [deck.panels]);
  const pagePanels = useMemo(
    () => panels.filter((panel) => panel.pageNumber === selectedPage).sort((left, right) => left.panelNumber - right.panelNumber),
    [panels, selectedPage],
  );
  const focusedPanel = panels.find((panel) => panel.id === focusedPanelId) ?? pagePanels[0];
  const selectedDialogue = focusedPanel?.dialogue.find((dialogue) => dialogue.id === selectedDialogueId)
    ?? focusedPanel?.dialogue[0];
  const summary = useMemo(() => graphicNovelDialogueSummary(project, deck), [project, deck]);

  useEffect(() => {
    if (!viewerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeViewer();
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        changePage(-1);
      } else if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        changePage(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveFocusedPanel(-1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveFocusedPanel(1);
      } else if (event.key.toLowerCase() === "d") {
        setShowDialogue((value) => !value);
      } else if (event.key === "+" || event.key === "=") {
        setZoom((value) => clamp(value + 10, 60, 150));
      } else if (event.key === "-") {
        setZoom((value) => clamp(value - 10, 60, 150));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    function onFullscreenChange() {
      if (!document.fullscreenElement && viewerOpen) setViewerOpen(false);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [viewerOpen]);

  if (!panels.length) {
    return (
      <section className={styles.empty} aria-labelledby="graphic-novel-viewer-title">
        <span>Phase 7B · Complete Graphic Novel Viewer</span>
        <h2 id="graphic-novel-viewer-title">Complete Graphic Novel Viewer</h2>
        <p>Build the 96-panel Graphic Novel plan first. The reader and bubble editor will appear here without requiring generated artwork.</p>
      </section>
    );
  }

  function persistPanel(panelId: string, patch: Partial<ComicPitchPanel>, base = project) {
    if (working) return;
    onProjectChange(withComicPitchDeck(base, updateComicPitchPanel(deck, panelId, patch)));
  }

  function persistDialogue(panel: ComicPitchPanel, dialogueId: string, patch: Partial<ComicPitchDialogue>) {
    if (working) return;
    const dialogue = panel.dialogue.find((item) => item.id === dialogueId);
    const index = panel.dialogue.findIndex((item) => item.id === dialogueId);
    const base = dialogue ? updateGraphicNovelBalloon(project, graphicNovelBalloon(project, panel, dialogue, Math.max(0, index))) : project;
    persistPanel(panel.id, {
      dialogue: panel.dialogue.map((item) => item.id === dialogueId ? { ...item, ...patch } : item),
    }, base);
  }

  function persistPlacement(panelId: string, dialogueId: string, patch: Partial<GraphicNovelBubblePlacement>) {
    if (working) return;
    onProjectChange(withGraphicNovelBubblePlacement(project, panelId, dialogueId, patch));
  }

  function persistBalloonDirection(panel: ComicPitchPanel, dialogue: ComicPitchDialogue, index: number, patch: Partial<GraphicNovelBalloonDirection>) {
    if (working) return;
    const current = graphicNovelBalloon(project, panel, dialogue, index);
    onProjectChange(updateGraphicNovelBalloon(project, { ...current, ...patch }));
  }

  function addBalloon(panel: ComicPitchPanel) {
    if (working) return;
    const dialogue = newDialogue(panel);
    persistPanel(panel.id, { dialogue: [...panel.dialogue, dialogue] });
    setSelectedDialogueId(dialogue.id);
    setFocusedPanelId(panel.id);
  }

  function removeBalloon(panel: ComicPitchPanel, dialogueId: string) {
    if (working) return;
    const next = panel.dialogue.filter((dialogue) => dialogue.id !== dialogueId);
    persistPanel(panel.id, { dialogue: next }, removeGraphicNovelBalloon(project, dialogueId));
    setSelectedDialogueId(next[0]?.id ?? "");
  }

  function selectPanel(panel: ComicPitchPanel) {
    setFocusedPanelId(panel.id);
    setSelectedDialogueId(panel.dialogue[0]?.id ?? "");
    if (selectedPage !== panel.pageNumber) setSelectedPage(panel.pageNumber);
  }

  function changePage(delta: number) {
    setSelectedPage((current) => clamp(current + delta, 0, 24));
  }

  function moveFocusedPanel(delta: number) {
    if (!pagePanels.length) return;
    const index = Math.max(0, pagePanels.findIndex((panel) => panel.id === focusedPanel?.id));
    const next = pagePanels[clamp(index + delta, 0, pagePanels.length - 1)];
    if (next) selectPanel(next);
  }

  function openViewer(panel?: ComicPitchPanel) {
    if (panel) {
      setSelectedPage(panel.pageNumber);
      setFocusedPanelId(panel.id);
      setSelectedDialogueId(panel.dialogue[0]?.id ?? "");
      setViewMode("panel");
    }
    setViewerOpen(true);
    window.requestAnimationFrame(() => {
      const target = viewerRef.current;
      if (target?.requestFullscreen && !document.fullscreenElement) void target.requestFullscreen().catch(() => undefined);
    });
  }

  function closeViewer() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setViewerOpen(false);
  }

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, panel: ComicPitchPanel, dialogueId: string, index: number) {
    if (!editing || working) return;
    event.preventDefault();
    event.stopPropagation();
    const canvas = event.currentTarget.closest(`.${styles.canvas}`) as HTMLElement | null;
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return;
    const placement = graphicNovelBubblePlacement(project, panel, dialogueId, index);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      panelId: panel.id,
      dialogueId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: placement.x,
      originY: placement.y,
      currentX: placement.x,
      currentY: placement.y,
      width: placement.width,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
    };
    setSelectedDialogueId(dialogueId);
    setFocusedPanelId(panel.id);
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const x = clamp(drag.originX + ((event.clientX - drag.startX) / drag.canvasWidth) * 100, 0, 100 - drag.width);
    const y = clamp(drag.originY + ((event.clientY - drag.startY) / drag.canvasHeight) * 100, 0, 88);
    drag.currentX = x;
    drag.currentY = y;
    setDragPreview({ key: `${drag.panelId}:${drag.dialogueId}`, x, y });
  }

  function finishDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    persistPlacement(drag.panelId, drag.dialogueId, { x: drag.currentX, y: drag.currentY });
    dragRef.current = null;
    setDragPreview(null);
  }

  function bubbleStyle(panel: ComicPitchPanel, dialogueId: string, index: number): { placement: GraphicNovelBubblePlacement; style: CSSProperties } {
    const stored = graphicNovelBubblePlacement(project, panel, dialogueId, index);
    const preview = dragPreview?.key === `${panel.id}:${dialogueId}` ? dragPreview : null;
    const placement = preview ? { ...stored, x: preview.x, y: preview.y } : stored;
    return {
      placement,
      style: {
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        width: `${placement.width}%`,
      },
    };
  }

  function renderPanel(panel: ComicPitchPanel, expanded = false) {
    const issues = graphicNovelDialogueIssues(project, panel);
    const ordered = panel.dialogue
      .map((dialogue, index) => ({ dialogue, index, direction: graphicNovelBalloon(project, panel, dialogue, index) }))
      .sort((left, right) => left.direction.readingOrder - right.direction.readingOrder);
    return (
      <article key={panel.id} className={`${styles.panel} ${expanded ? styles.expandedPanel : ""}`} data-focused={focusedPanel?.id === panel.id || undefined}>
        <button type="button" className={styles.panelHeading} onClick={() => selectPanel(panel)}>
          <span>{panelLabel(panel)}</span><strong>{panel.title}</strong>
        </button>
        <div className={styles.canvas} onClick={() => selectPanel(panel)}>
          {panel.imageSrc
            ? <img src={panel.imageSrc} alt={`${panel.title}: ${panel.narration}`} />
            : <div className={styles.placeholder}><strong>{panelLabel(panel)}</strong><span>Artwork not generated</span></div>}
          {showDialogue ? ordered.map(({ dialogue, index, direction }) => {
            const { placement, style } = bubbleStyle(panel, dialogue.id, index);
            if (placement.hidden) return null;
            return (
              <button
                type="button"
                key={dialogue.id}
                className={styles.bubble}
                data-style={direction.kind === "thought" ? "thought" : placement.style}
                data-kind={direction.kind}
                data-tail={placement.tail}
                data-selected={selectedDialogue?.id === dialogue.id && focusedPanel?.id === panel.id || undefined}
                style={{ ...style, zIndex: direction.readingOrder + 2 }}
                aria-label={`${dialogue.characterName || "Speaker"}: ${dialogue.text || "Empty balloon"}`}
                aria-pressed={selectedDialogue?.id === dialogue.id && focusedPanel?.id === panel.id}
                onClick={(event) => { event.stopPropagation(); setFocusedPanelId(panel.id); setSelectedDialogueId(dialogue.id); }}
                onDoubleClick={() => setEditing(true)}
                onPointerDown={(event) => startDrag(event, panel, dialogue.id, index)}
                onPointerMove={moveDrag}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
              >
                {dialogue.characterName ? <strong>{dialogue.characterName}</strong> : null}
                <span>{dialogue.text || "…"}</span>
                {direction.emotionalDelivery ? <small>{direction.emotionalDelivery}</small> : null}
              </button>
            );
          }) : null}
          {issues.length ? <span className={styles.unresolved} title={issues.join("; ")}>{issues.length}</span> : null}
          <span className={styles.panelNumber}>{panel.pageNumber}.{panel.panelNumber}</span>
        </div>
        {showDialogue ? <div className={styles.caption}><p>{panel.narration}</p><button type="button" onClick={() => openViewer(panel)}>Focus panel</button></div> : null}
      </article>
    );
  }

  function renderInspector() {
    if (!focusedPanel) return <aside className={styles.inspector}><p>Select a panel to edit its balloons.</p></aside>;
    const selectedIndex = focusedPanel.dialogue.findIndex((dialogue) => dialogue.id === selectedDialogue?.id);
    const placement = selectedDialogue ? graphicNovelBubblePlacement(project, focusedPanel, selectedDialogue.id, Math.max(0, selectedIndex)) : null;
    const direction = selectedDialogue ? graphicNovelBalloon(project, focusedPanel, selectedDialogue, Math.max(0, selectedIndex)) : null;
    const caption = graphicNovelCaption(project, focusedPanel);
    const dialogueOver = selectedDialogue && direction ? Math.max(0, selectedDialogue.text.length - direction.maxCharacters) : 0;
    const captionOver = Math.max(0, focusedPanel.narration.length - caption.maxCharacters);
    return (
      <aside className={styles.inspector} aria-label="Graphic Novel bubble and caption editor">
        <div className={styles.inspectorHeading}>
          <div><span>{panelLabel(focusedPanel)}</span><strong>Bubble and caption editor</strong></div>
          <button type="button" disabled={working} onClick={() => addBalloon(focusedPanel)}>Add balloon</button>
        </div>
        <div className={styles.balloonList}>
          {focusedPanel.dialogue.map((dialogue) => (
            <button type="button" key={dialogue.id} data-selected={selectedDialogue?.id === dialogue.id || undefined} onClick={() => setSelectedDialogueId(dialogue.id)}>
              <strong>{dialogue.characterName || "Speaker"}</strong><span>{dialogue.text || "Empty balloon"}</span>
            </button>
          ))}
          {!focusedPanel.dialogue.length ? <p>No dialogue balloons on this panel.</p> : null}
        </div>
        {selectedDialogue && placement && direction ? (
          <div className={styles.controls}>
            <label><span>Speaker</span><input disabled={working} value={selectedDialogue.characterName} onChange={(event) => persistDialogue(focusedPanel, selectedDialogue.id, { characterName: event.target.value })} /></label>
            <label><span>{direction.kind === "thought" ? "Thought text" : "Spoken text"}</span><textarea disabled={working} value={selectedDialogue.text} onChange={(event) => persistDialogue(focusedPanel, selectedDialogue.id, { text: event.target.value })} /></label>
            <div className={styles.textActions}>
              <small data-over={dialogueOver > 0 || undefined}>{selectedDialogue.text.length}/{direction.maxCharacters}{dialogueOver ? ` · ${dialogueOver} over` : ""}</small>
              <button type="button" disabled={working} onClick={() => persistDialogue(focusedPanel, selectedDialogue.id, { text: shortenGraphicNovelDialogue(selectedDialogue.text, direction.maxCharacters) })}>Automatic shortening</button>
              <button type="button" disabled={working} onClick={() => persistDialogue(focusedPanel, selectedDialogue.id, { text: direction.originalText })}>Restore original line</button>
            </div>
            <blockquote className={styles.sourceLine}><strong>Source screenplay line</strong><p>{direction.originalText || "No linked screenplay line. This balloon was added in the Graphic Novel."}</p></blockquote>
            <div className={styles.controlGrid}>
              <label><span>Balloon type</span><select disabled={working} value={direction.kind} onChange={(event) => persistBalloonDirection(focusedPanel, selectedDialogue, selectedIndex, { kind: event.target.value as GraphicNovelBalloonKind })}>{GRAPHIC_NOVEL_BALLOON_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
              <label><span>Emotional delivery</span><input disabled={working} value={direction.emotionalDelivery} placeholder="guarded, breathless, furious…" onChange={(event) => persistBalloonDirection(focusedPanel, selectedDialogue, selectedIndex, { emotionalDelivery: event.target.value })} /></label>
              <label><span>Reading order</span><input type="number" min="1" max="20" disabled={working} value={direction.readingOrder} onChange={(event) => persistBalloonDirection(focusedPanel, selectedDialogue, selectedIndex, { readingOrder: Number(event.target.value) })} /></label>
              <label><span>Maximum suggested length</span><input type="number" min="20" max="280" disabled={working} value={direction.maxCharacters} onChange={(event) => persistBalloonDirection(focusedPanel, selectedDialogue, selectedIndex, { maxCharacters: Number(event.target.value) })} /></label>
              <label><span>Balloon style</span><select disabled={working} value={placement.style} onChange={(event) => persistPlacement(focusedPanel.id, selectedDialogue.id, { style: event.target.value as GraphicNovelBubbleStyle })}><option value="speech">Speech</option><option value="thought">Thought</option><option value="caption">Caption</option></select></label>
              <label><span>Tail</span><select disabled={working || placement.style === "caption"} value={placement.tail} onChange={(event) => persistPlacement(focusedPanel.id, selectedDialogue.id, { tail: event.target.value as GraphicNovelBubbleTail })}><option value="left">Left</option><option value="right">Right</option><option value="none">None</option></select></label>
            </div>
            <label className={styles.range}><span>Width <strong>{placement.width}%</strong></span><input type="range" min="18" max="72" step="1" disabled={working} value={placement.width} onChange={(event) => persistPlacement(focusedPanel.id, selectedDialogue.id, { width: Number(event.target.value) })} /></label>
            <div className={styles.controlGrid}>
              <label className={styles.range}><span>Horizontal <strong>{placement.x}%</strong></span><input type="range" min="0" max={100 - placement.width} step="1" disabled={working} value={placement.x} onChange={(event) => persistPlacement(focusedPanel.id, selectedDialogue.id, { x: Number(event.target.value) })} /></label>
              <label className={styles.range}><span>Vertical <strong>{placement.y}%</strong></span><input type="range" min="0" max="88" step="1" disabled={working} value={placement.y} onChange={(event) => persistPlacement(focusedPanel.id, selectedDialogue.id, { y: Number(event.target.value) })} /></label>
            </div>
            <label className={styles.checkbox}><input type="checkbox" disabled={working} checked={placement.hidden} onChange={(event) => persistPlacement(focusedPanel.id, selectedDialogue.id, { hidden: event.target.checked })} /><span>Hide this balloon without deleting its text</span></label>
            <button type="button" className={styles.remove} disabled={working} onClick={() => removeBalloon(focusedPanel, selectedDialogue.id)}>Remove balloon</button>
          </div>
        ) : null}
        <fieldset className={styles.captionEditor}>
          <legend>Narration / caption</legend>
          <label><span>Placement</span><select disabled={working} value={caption.placement} onChange={(event) => onProjectChange(updateGraphicNovelCaption(project, { ...caption, placement: event.target.value as GraphicNovelCaptionPlacement }))}>{GRAPHIC_NOVEL_CAPTION_PLACEMENTS.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}</select></label>
          <label><span>Narration</span><textarea disabled={working} value={focusedPanel.narration} onChange={(event) => persistPanel(focusedPanel.id, { narration: event.target.value, narrationSource: "derived" }, updateGraphicNovelCaption(project, caption))} /></label>
          <label><span>Maximum suggested length</span><input type="number" min="40" max="500" disabled={working} value={caption.maxCharacters} onChange={(event) => onProjectChange(updateGraphicNovelCaption(project, { ...caption, maxCharacters: Number(event.target.value) }))} /></label>
          <div className={styles.textActions}><small data-over={captionOver > 0 || undefined}>{focusedPanel.narration.length}/{caption.maxCharacters}{captionOver ? ` · ${captionOver} over` : ""}</small><button type="button" disabled={working} onClick={() => persistPanel(focusedPanel.id, { narration: shortenGraphicNovelDialogue(focusedPanel.narration, caption.maxCharacters), narrationSource: "derived" }, updateGraphicNovelCaption(project, caption))}>Automatic shortening</button><button type="button" disabled={working} onClick={() => persistPanel(focusedPanel.id, { narration: caption.originalText, narrationSource: "canonical" })}>Restore original narration</button></div>
          <blockquote className={styles.sourceLine}><strong>Original narration</strong><p>{caption.originalText}</p></blockquote>
        </fieldset>
        <div className={styles.panelActions}>
          <button type="button" disabled={working || !aiReady || !acknowledged} onClick={() => onRegenerate(focusedPanel.id)}>Regenerate current panel</button>
          <button type="button" disabled={working} onClick={() => onOpenPanelEditor(focusedPanel.id)}>Replace image / open versions</button>
        </div>
        <div className={styles.inspectorFooter}>
          <button type="button" disabled={working} onClick={() => onProjectChange(resetGraphicNovelPanelBubbleLayout(project, focusedPanel.id))}>Reset panel positions</button>
          <p>Drag balloons directly on the artwork. Text and placement remain editable in the PPF and carry into HTML/PDF export.</p>
        </div>
      </aside>
    );
  }

  function renderPage(pageNumber: number, panelOnly = false) {
    const page = panels.filter((panel) => panel.pageNumber === pageNumber).sort((left, right) => left.panelNumber - right.panelNumber);
    const visible = panelOnly && focusedPanel?.pageNumber === pageNumber ? [focusedPanel] : page;
    return (
      <main key={pageNumber} className={`${styles.page} ${panelOnly ? styles.singlePanelPage : ""}`} aria-label={`Graphic Novel page ${pageNumber}`}>
        <header><div><span>Page {pageNumber} of 24</span><h3>{project.blocks.find((block) => block.number === pageNumber)?.title || `Block ${pageNumber}`}</h3></div><strong>{visible.filter((panel) => panel.imageSrc).length}/{visible.length} illustrated</strong></header>
        <div className={styles.pageGrid}>{visible.map((panel) => renderPanel(panel, panelOnly))}</div>
      </main>
    );
  }

  function renderReader(fullscreen = false) {
    const spreadPages = selectedPage > 0 ? [selectedPage, Math.min(24, selectedPage + 1)].filter((value, index, list) => list.indexOf(value) === index) : [];
    return (
      <div className={`${styles.reader} ${fullscreen ? styles.fullscreenReader : ""}`}>
        <div className={styles.toolbar}>
          <div className={styles.navigation}>
            <button type="button" onClick={() => { setSelectedPage(0); setFocusedPanelId(""); }}>Cover</button>
            <button type="button" onClick={() => changePage(-1)} disabled={selectedPage <= 0}>Previous</button>
            <label><span>Page</span><select value={selectedPage} onChange={(event) => setSelectedPage(Number(event.target.value))}><option value="0">Cover</option>{Array.from({ length: 24 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select><span>of 24</span></label>
            <button type="button" onClick={() => changePage(1)} disabled={selectedPage >= 24}>Next</button>
          </div>
          <div className={styles.viewActions}>
            <button type="button" data-active={viewMode === "page" || undefined} onClick={() => setViewMode("page")}>Single page</button>
            <button type="button" data-active={viewMode === "spread" || undefined} onClick={() => setViewMode("spread")}>Two-page spread</button>
            <button type="button" data-active={viewMode === "panel" || undefined} onClick={() => setViewMode("panel")} disabled={!focusedPanel}>Panel-by-panel</button>
            <button type="button" onClick={() => setShowDialogue((value) => !value)}>{showDialogue ? "Hide dialogue" : "Show dialogue"}</button>
            <button type="button" onClick={() => setZoom((value) => clamp(value - 10, 60, 150))}>Zoom −</button>
            <strong className={styles.zoomValue}>{zoom}%</strong>
            <button type="button" onClick={() => setZoom((value) => clamp(value + 10, 60, 150))}>Zoom +</button>
            <button type="button" data-active={editing || undefined} onClick={() => setEditing((value) => !value)}>{editing ? "Editing on" : "Editing off"}</button>
            <button type="button" onClick={onDownloadImages}>Image sequence</button>
            {fullscreen ? <button type="button" className={styles.primary} onClick={closeViewer}>Exit full screen</button> : <button type="button" className={styles.primary} onClick={() => openViewer()}>Open full screen</button>}
          </div>
        </div>
        <div className={styles.readerLayout}>
          <div className={`${styles.stage} ${viewMode === "spread" ? styles.spreadStage : ""}`} style={{ "--viewer-zoom": zoom / 100 } as CSSProperties}>
            {selectedPage === 0 ? (
              <section className={styles.cover}>
                <span>PlotPickle Graphic Novel</span><h3>{project.review.pitchPackage.title || project.metadata.title}</h3><p>{project.review.pitchPackage.logline || project.story.logline}</p><small>{project.rights.copyrightNotice}</small>
              </section>
            ) : viewMode === "spread" ? spreadPages.map((pageNumber) => renderPage(pageNumber)) : renderPage(selectedPage, viewMode === "panel")}
          </div>
          {editing && selectedPage > 0 ? renderInspector() : null}
        </div>
        {fullscreen ? <p className={styles.shortcuts}>Arrow left/right changes pages. Arrow up/down changes the focused panel. D hides dialogue. +/− zooms. Escape exits.</p> : null}
      </div>
    );
  }

  return (
    <section className={styles.workspace} aria-labelledby="graphic-novel-viewer-title">
      <div className={styles.heading}>
        <div><span>Phase 7B · Complete Graphic Novel Viewer</span><h2 id="graphic-novel-viewer-title">Full-screen Graphic Novel viewer and bubble editor</h2><p>Read the cover and all 24 pages, use a two-page spread or panel-by-panel mode, edit balloons in context, inspect unresolved panels, regenerate artwork and export an ordered image sequence.</p></div>
        <div className={styles.summary}><strong>{summary.readyPanels}/{summary.panelCount}</strong><span>panels resolved</span><button type="button" className={styles.launch} onClick={() => openViewer()}>Open full-screen reader</button></div>
      </div>
      {renderReader(false)}
      {viewerOpen ? <div ref={viewerRef} className={styles.overlay} role="dialog" aria-modal="true" aria-label="Full-screen Graphic Novel reader">{renderReader(true)}</div> : null}
    </section>
  );
}
