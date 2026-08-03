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
import {
  updateComicPitchPanel,
  withComicPitchDeck,
} from "@/lib/ai-pitch-deck";
import {
  graphicNovelBubblePlacement,
  resetGraphicNovelPanelBubbleLayout,
  withGraphicNovelBubblePlacement,
  type GraphicNovelBubblePlacement,
  type GraphicNovelBubbleStyle,
  type GraphicNovelBubbleTail,
} from "@/lib/graphic-novel-bubbles";
import type {
  ComicPitchDialogue,
  ComicPitchPanel,
  PlotPickleProject,
} from "@/lib/project";
import styles from "./graphic-novel-viewer.module.css";

type Props = {
  project: PlotPickleProject;
  working: boolean;
  onProjectChange: (project: PlotPickleProject) => void;
};

type ViewMode = "page" | "panel";

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

export default function GraphicNovelViewer({ project, working, onProjectChange }: Props) {
  const deck = project.review.pitchPackage.comicDeck;
  const [selectedPage, setSelectedPage] = useState(1);
  const [focusedPanelId, setFocusedPanelId] = useState("");
  const [selectedDialogueId, setSelectedDialogueId] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("page");
  const [editing, setEditing] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [dragPreview, setDragPreview] = useState<{ key: string; x: number; y: number } | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const panels = deck?.panels ?? [];
  const pagePanels = useMemo(
    () => panels.filter((panel) => panel.pageNumber === selectedPage).sort((left, right) => left.panelNumber - right.panelNumber),
    [panels, selectedPage],
  );
  const focusedPanel = pagePanels.find((panel) => panel.id === focusedPanelId) ?? pagePanels[0];
  const selectedDialogue = focusedPanel?.dialogue.find((dialogue) => dialogue.id === selectedDialogueId)
    ?? focusedPanel?.dialogue[0];

  useEffect(() => {
    if (!pagePanels.length) return;
    if (!pagePanels.some((panel) => panel.id === focusedPanelId)) setFocusedPanelId(pagePanels[0].id);
  }, [focusedPanelId, pagePanels]);

  useEffect(() => {
    if (!focusedPanel) return;
    if (!focusedPanel.dialogue.some((dialogue) => dialogue.id === selectedDialogueId)) {
      setSelectedDialogueId(focusedPanel.dialogue[0]?.id ?? "");
    }
  }, [focusedPanel, selectedDialogueId]);

  useEffect(() => {
    if (!viewerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeViewer();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        changePage(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        changePage(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveFocusedPanel(-1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveFocusedPanel(1);
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

  if (!deck || !panels.length) {
    return (
      <section className={styles.empty} aria-labelledby="graphic-novel-viewer-title">
        <span>Phase 7 · Reader and lettering</span>
        <h2 id="graphic-novel-viewer-title">Full-screen Graphic Novel viewer</h2>
        <p>Build the 96-panel Graphic Novel plan first. The reader and bubble editor will appear here without requiring generated artwork.</p>
      </section>
    );
  }

  function persistPanel(panelId: string, patch: Partial<ComicPitchPanel>) {
    if (working || !deck) return;
    onProjectChange(withComicPitchDeck(project, updateComicPitchPanel(deck, panelId, patch)));
  }

  function persistDialogue(panel: ComicPitchPanel, dialogueId: string, patch: Partial<ComicPitchDialogue>) {
    persistPanel(panel.id, {
      dialogue: panel.dialogue.map((dialogue) => dialogue.id === dialogueId
        ? { ...dialogue, ...patch, sourceElementId: "" }
        : dialogue),
    });
  }

  function persistPlacement(panelId: string, dialogueId: string, patch: Partial<GraphicNovelBubblePlacement>) {
    if (working) return;
    onProjectChange(withGraphicNovelBubblePlacement(project, panelId, dialogueId, patch));
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
    persistPanel(panel.id, { dialogue: next });
    setSelectedDialogueId(next[0]?.id ?? "");
  }

  function moveBalloon(panel: ComicPitchPanel, dialogueId: string, direction: -1 | 1) {
    if (working) return;
    const index = panel.dialogue.findIndex((dialogue) => dialogue.id === dialogueId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= panel.dialogue.length) return;
    const dialogue = [...panel.dialogue];
    [dialogue[index], dialogue[target]] = [dialogue[target], dialogue[index]];
    persistPanel(panel.id, { dialogue });
  }

  function selectPanel(panel: ComicPitchPanel) {
    setFocusedPanelId(panel.id);
    setSelectedDialogueId(panel.dialogue[0]?.id ?? "");
  }

  function changePage(delta: number) {
    setSelectedPage((current) => clamp(current + delta, 1, 24));
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

  function startDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    panel: ComicPitchPanel,
    dialogueId: string,
    index: number,
  ) {
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

  function bubbleStyle(
    panel: ComicPitchPanel,
    dialogueId: string,
    index: number,
  ): { placement: GraphicNovelBubblePlacement; style: CSSProperties } {
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
    return (
      <article
        key={panel.id}
        className={`${styles.panel} ${expanded ? styles.expandedPanel : ""}`}
        data-focused={focusedPanel?.id === panel.id || undefined}
      >
        <button type="button" className={styles.panelHeading} onClick={() => selectPanel(panel)}>
          <span>{panelLabel(panel)}</span>
          <strong>{panel.title}</strong>
        </button>
        <div className={styles.canvas} onClick={() => selectPanel(panel)}>
          {panel.imageSrc
            ? <img src={panel.imageSrc} alt={`${panel.title}: ${panel.narration}`} />
            : <div className={styles.placeholder}><strong>{panelLabel(panel)}</strong><span>Artwork not generated</span></div>}
          {panel.dialogue.map((dialogue, index) => {
            const { placement, style } = bubbleStyle(panel, dialogue.id, index);
            if (placement.hidden) return null;
            return (
              <button
                type="button"
                key={dialogue.id}
                className={styles.bubble}
                data-style={placement.style}
                data-tail={placement.tail}
                data-selected={selectedDialogue?.id === dialogue.id && focusedPanel?.id === panel.id || undefined}
                style={style}
                aria-label={`${dialogue.characterName || "Speaker"}: ${dialogue.text || "Empty balloon"}`}
                aria-pressed={selectedDialogue?.id === dialogue.id && focusedPanel?.id === panel.id}
                onClick={(event) => {
                  event.stopPropagation();
                  setFocusedPanelId(panel.id);
                  setSelectedDialogueId(dialogue.id);
                }}
                onDoubleClick={() => setEditing(true)}
                onPointerDown={(event) => startDrag(event, panel, dialogue.id, index)}
                onPointerMove={moveDrag}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
              >
                {dialogue.characterName ? <strong>{dialogue.characterName}</strong> : null}
                <span>{dialogue.text || "…"}</span>
              </button>
            );
          })}
          <span className={styles.panelNumber}>{panel.pageNumber}.{panel.panelNumber}</span>
        </div>
        <div className={styles.caption}>
          <p>{panel.narration}</p>
          <button type="button" onClick={() => openViewer(panel)}>Focus panel</button>
        </div>
      </article>
    );
  }

  function renderInspector() {
    if (!focusedPanel) return <aside className={styles.inspector}><p>Select a panel to edit its balloons.</p></aside>;
    const selectedIndex = focusedPanel.dialogue.findIndex((dialogue) => dialogue.id === selectedDialogue?.id);
    const placement = selectedDialogue
      ? graphicNovelBubblePlacement(project, focusedPanel, selectedDialogue.id, Math.max(0, selectedIndex))
      : null;
    return (
      <aside className={styles.inspector} aria-label="Graphic Novel balloon editor">
        <div className={styles.inspectorHeading}>
          <div><span>{panelLabel(focusedPanel)}</span><strong>Lettering editor</strong></div>
          <button type="button" disabled={working} onClick={() => addBalloon(focusedPanel)}>Add balloon</button>
        </div>
        <div className={styles.balloonList}>
          {focusedPanel.dialogue.map((dialogue) => (
            <button
              type="button"
              key={dialogue.id}
              data-selected={selectedDialogue?.id === dialogue.id || undefined}
              onClick={() => setSelectedDialogueId(dialogue.id)}
            >
              <strong>{dialogue.characterName || "Speaker"}</strong>
              <span>{dialogue.text || "Empty balloon"}</span>
            </button>
          ))}
          {!focusedPanel.dialogue.length ? <p>No dialogue balloons on this panel.</p> : null}
        </div>
        {selectedDialogue && placement ? (
          <div className={styles.controls}>
            <label>
              <span>Character</span>
              <input disabled={working} value={selectedDialogue.characterName} onChange={(event) => persistDialogue(focusedPanel, selectedDialogue.id, { characterName: event.target.value })} />
            </label>
            <label>
              <span>Dialogue</span>
              <textarea disabled={working} value={selectedDialogue.text} onChange={(event) => persistDialogue(focusedPanel, selectedDialogue.id, { text: event.target.value })} />
            </label>
            <div className={styles.controlGrid}>
              <label>
                <span>Balloon style</span>
                <select disabled={working} value={placement.style} onChange={(event) => persistPlacement(focusedPanel.id, selectedDialogue.id, { style: event.target.value as GraphicNovelBubbleStyle })}>
                  <option value="speech">Speech</option>
                  <option value="thought">Thought</option>
                  <option value="caption">Caption</option>
                </select>
              </label>
              <label>
                <span>Tail</span>
                <select disabled={working || placement.style === "caption"} value={placement.tail} onChange={(event) => persistPlacement(focusedPanel.id, selectedDialogue.id, { tail: event.target.value as GraphicNovelBubbleTail })}>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="none">None</option>
                </select>
              </label>
            </div>
            <label className={styles.range}>
              <span>Width <strong>{placement.width}%</strong></span>
              <input type="range" min="18" max="72" step="1" disabled={working} value={placement.width} onChange={(event) => persistPlacement(focusedPanel.id, selectedDialogue.id, { width: Number(event.target.value) })} />
            </label>
            <div className={styles.controlGrid}>
              <label className={styles.range}>
                <span>Horizontal <strong>{placement.x}%</strong></span>
                <input type="range" min="0" max={100 - placement.width} step="1" disabled={working} value={placement.x} onChange={(event) => persistPlacement(focusedPanel.id, selectedDialogue.id, { x: Number(event.target.value) })} />
              </label>
              <label className={styles.range}>
                <span>Vertical <strong>{placement.y}%</strong></span>
                <input type="range" min="0" max="88" step="1" disabled={working} value={placement.y} onChange={(event) => persistPlacement(focusedPanel.id, selectedDialogue.id, { y: Number(event.target.value) })} />
              </label>
            </div>
            <label className={styles.checkbox}>
              <input type="checkbox" disabled={working} checked={placement.hidden} onChange={(event) => persistPlacement(focusedPanel.id, selectedDialogue.id, { hidden: event.target.checked })} />
              <span>Hide this balloon without deleting its text</span>
            </label>
            <div className={styles.editActions}>
              <button type="button" disabled={working || selectedIndex <= 0} onClick={() => moveBalloon(focusedPanel, selectedDialogue.id, -1)}>Move earlier</button>
              <button type="button" disabled={working || selectedIndex >= focusedPanel.dialogue.length - 1} onClick={() => moveBalloon(focusedPanel, selectedDialogue.id, 1)}>Move later</button>
              <button type="button" className={styles.remove} disabled={working} onClick={() => removeBalloon(focusedPanel, selectedDialogue.id)}>Remove</button>
            </div>
          </div>
        ) : null}
        <div className={styles.inspectorFooter}>
          <button type="button" disabled={working} onClick={() => onProjectChange(resetGraphicNovelPanelBubbleLayout(project, focusedPanel.id))}>Reset panel positions</button>
          <p>Drag balloons directly on the artwork. Placement stays editable text in the PPF and carries into HTML/PDF export.</p>
        </div>
      </aside>
    );
  }

  function renderReader(fullscreen = false) {
    const visiblePanels = viewMode === "panel" && focusedPanel ? [focusedPanel] : pagePanels;
    return (
      <div className={`${styles.reader} ${fullscreen ? styles.fullscreenReader : ""}`}>
        <div className={styles.toolbar}>
          <div className={styles.navigation}>
            <button type="button" onClick={() => changePage(-1)} disabled={selectedPage <= 1}>Previous page</button>
            <label><span>Page</span><select value={selectedPage} onChange={(event) => setSelectedPage(Number(event.target.value))}>{Array.from({ length: 24 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select><span>of 24</span></label>
            <button type="button" onClick={() => changePage(1)} disabled={selectedPage >= 24}>Next page</button>
          </div>
          <div className={styles.viewActions}>
            <button type="button" data-active={viewMode === "page" || undefined} onClick={() => setViewMode("page")}>Page view</button>
            <button type="button" data-active={viewMode === "panel" || undefined} onClick={() => setViewMode("panel")} disabled={!focusedPanel}>Panel view</button>
            <button type="button" data-active={editing || undefined} onClick={() => setEditing((value) => !value)}>{editing ? "Editing on" : "Editing off"}</button>
            {fullscreen
              ? <button type="button" className={styles.primary} onClick={closeViewer}>Exit full screen</button>
              : <button type="button" className={styles.primary} onClick={() => openViewer()}>Open full screen</button>}
          </div>
        </div>
        <div className={styles.readerLayout}>
          <main className={`${styles.page} ${viewMode === "panel" ? styles.singlePanelPage : ""}`} aria-label={`Graphic Novel page ${selectedPage}`}>
            <header><div><span>Page {selectedPage} of 24</span><h3>{project.blocks.find((block) => block.number === selectedPage)?.title || `Block ${selectedPage}`}</h3></div><strong>{visiblePanels.filter((panel) => panel.imageSrc).length}/{visiblePanels.length} illustrated</strong></header>
            <div className={styles.pageGrid}>{visiblePanels.map((panel) => renderPanel(panel, viewMode === "panel"))}</div>
          </main>
          {editing ? renderInspector() : null}
        </div>
        {fullscreen ? <p className={styles.shortcuts}>Arrow left/right changes pages. Arrow up/down changes the focused panel. Escape exits.</p> : null}
      </div>
    );
  }

  return (
    <section className={styles.workspace} aria-labelledby="graphic-novel-viewer-title">
      <div className={styles.heading}>
        <div>
          <span>Phase 7 · Reader and lettering</span>
          <h2 id="graphic-novel-viewer-title">Full-screen Graphic Novel viewer and bubble editor</h2>
          <p>Read the full 24-page story, focus one panel at a time and drag editable dialogue balloons into deliberate positions. Text, placement, style and visibility remain outside the generated image pixels.</p>
        </div>
        <button type="button" className={styles.launch} onClick={() => openViewer()}>Open full-screen reader</button>
      </div>
      {renderReader(false)}
      {viewerOpen ? (
        <div ref={viewerRef} className={styles.overlay} role="dialog" aria-modal="true" aria-label="Full-screen Graphic Novel reader">
          {renderReader(true)}
        </div>
      ) : null}
    </section>
  );
}
