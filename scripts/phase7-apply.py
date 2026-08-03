from pathlib import Path
import json

ROOT = Path('.')


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.strip() + "\n", encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    content = target.read_text(encoding="utf-8")
    if old not in content:
        raise SystemExit(f"Expected source contract not found in {path}: {old[:120]!r}")
    target.write_text(content.replace(old, new, 1), encoding="utf-8")


write("lib/graphic-novel-dialogue.ts", r'''
import {
  cloneProject,
  type ComicPitchDeck,
  type ComicPitchDialogue,
  type ComicPitchPanel,
  type PlotPickleProject,
} from "./project";

export const GRAPHIC_NOVEL_DIALOGUE_EXTENSION_KEY = "plotpickle.graphicNovelDialogue.v1";

export const GRAPHIC_NOVEL_BALLOON_KINDS = ["speech", "thought", "whisper", "shout"] as const;
export const GRAPHIC_NOVEL_BALLOON_PLACEMENTS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export const GRAPHIC_NOVEL_CAPTION_PLACEMENTS = ["below", "top-left", "top-right", "bottom-overlay"] as const;

export type GraphicNovelBalloonKind = typeof GRAPHIC_NOVEL_BALLOON_KINDS[number];
export type GraphicNovelBalloonPlacement = typeof GRAPHIC_NOVEL_BALLOON_PLACEMENTS[number];
export type GraphicNovelCaptionPlacement = typeof GRAPHIC_NOVEL_CAPTION_PLACEMENTS[number];

export type GraphicNovelBalloonDirection = {
  panelId: string;
  dialogueId: string;
  kind: GraphicNovelBalloonKind;
  emotionalDelivery: string;
  placement: GraphicNovelBalloonPlacement;
  readingOrder: number;
  maxCharacters: number;
  originalText: string;
};

export type GraphicNovelCaptionDirection = {
  panelId: string;
  placement: GraphicNovelCaptionPlacement;
  readingOrder: number;
  maxCharacters: number;
  originalText: string;
};

export type GraphicNovelDialogueState = {
  version: 1;
  balloons: Record<string, GraphicNovelBalloonDirection>;
  captions: Record<string, GraphicNovelCaptionDirection>;
  updatedAt: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function integer(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function oneOf<T extends readonly string[]>(value: unknown, values: T, fallback: T[number]): T[number] {
  return values.includes(value as T[number]) ? value as T[number] : fallback;
}

export function createGraphicNovelDialogueState(now = new Date().toISOString()): GraphicNovelDialogueState {
  return { version: 1, balloons: {}, captions: {}, updatedAt: now };
}

export function getGraphicNovelDialogueState(project: PlotPickleProject): GraphicNovelDialogueState {
  const candidate = record(project.extensions?.[GRAPHIC_NOVEL_DIALOGUE_EXTENSION_KEY]);
  if (!candidate) return createGraphicNovelDialogueState(project.metadata.updatedAt);
  const balloonsSource = record(candidate.balloons) ?? {};
  const captionsSource = record(candidate.captions) ?? {};
  const balloons = Object.fromEntries(Object.entries(balloonsSource).flatMap(([key, value]) => {
    const item = record(value);
    if (!item) return [];
    const dialogueId = text(item.dialogueId, key);
    if (!dialogueId) return [];
    return [[dialogueId, {
      panelId: text(item.panelId),
      dialogueId,
      kind: oneOf(item.kind, GRAPHIC_NOVEL_BALLOON_KINDS, "speech"),
      emotionalDelivery: text(item.emotionalDelivery),
      placement: oneOf(item.placement, GRAPHIC_NOVEL_BALLOON_PLACEMENTS, "top-left"),
      readingOrder: integer(item.readingOrder, 1, 1, 20),
      maxCharacters: integer(item.maxCharacters, 120, 20, 280),
      originalText: text(item.originalText),
    } satisfies GraphicNovelBalloonDirection]];
  }));
  const captions = Object.fromEntries(Object.entries(captionsSource).flatMap(([key, value]) => {
    const item = record(value);
    if (!item) return [];
    const panelId = text(item.panelId, key);
    if (!panelId) return [];
    return [[panelId, {
      panelId,
      placement: oneOf(item.placement, GRAPHIC_NOVEL_CAPTION_PLACEMENTS, "below"),
      readingOrder: integer(item.readingOrder, 4, 1, 20),
      maxCharacters: integer(item.maxCharacters, 180, 40, 500),
      originalText: text(item.originalText),
    } satisfies GraphicNovelCaptionDirection]];
  }));
  return {
    version: 1,
    balloons,
    captions,
    updatedAt: text(candidate.updatedAt, project.metadata.updatedAt),
  };
}

export function withGraphicNovelDialogueState(
  project: PlotPickleProject,
  state: GraphicNovelDialogueState,
): PlotPickleProject {
  const next = cloneProject(project);
  next.extensions = {
    ...(next.extensions ?? {}),
    [GRAPHIC_NOVEL_DIALOGUE_EXTENSION_KEY]: {
      ...state,
      version: 1,
      updatedAt: state.updatedAt || new Date().toISOString(),
    },
  };
  return next;
}

function sourceDialogue(project: PlotPickleProject, dialogue: ComicPitchDialogue) {
  if (!dialogue.sourceElementId) return "";
  return project.screenplay.draftElements.find((item) => item.id === dialogue.sourceElementId)?.text.trim() ?? "";
}

const DEFAULT_PLACEMENTS: GraphicNovelBalloonPlacement[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

export function graphicNovelBalloon(
  project: PlotPickleProject,
  panel: ComicPitchPanel,
  dialogue: ComicPitchDialogue,
  index: number,
): GraphicNovelBalloonDirection {
  const stored = getGraphicNovelDialogueState(project).balloons[dialogue.id];
  const originalText = stored?.originalText || sourceDialogue(project, dialogue) || dialogue.text;
  return {
    panelId: panel.id,
    dialogueId: dialogue.id,
    kind: stored?.kind ?? "speech",
    emotionalDelivery: stored?.emotionalDelivery ?? "",
    placement: stored?.placement ?? DEFAULT_PLACEMENTS[index % DEFAULT_PLACEMENTS.length],
    readingOrder: stored?.readingOrder ?? index + 1,
    maxCharacters: stored?.maxCharacters ?? 120,
    originalText,
  };
}

export function graphicNovelCaption(project: PlotPickleProject, panel: ComicPitchPanel): GraphicNovelCaptionDirection {
  const stored = getGraphicNovelDialogueState(project).captions[panel.id];
  return {
    panelId: panel.id,
    placement: stored?.placement ?? "below",
    readingOrder: stored?.readingOrder ?? panel.dialogue.length + 1,
    maxCharacters: stored?.maxCharacters ?? 180,
    originalText: stored?.originalText || panel.narration,
  };
}

export function updateGraphicNovelBalloon(
  project: PlotPickleProject,
  direction: GraphicNovelBalloonDirection,
): PlotPickleProject {
  const state = getGraphicNovelDialogueState(project);
  return withGraphicNovelDialogueState(project, {
    ...state,
    balloons: { ...state.balloons, [direction.dialogueId]: direction },
    updatedAt: new Date().toISOString(),
  });
}

export function removeGraphicNovelBalloon(project: PlotPickleProject, dialogueId: string): PlotPickleProject {
  const state = getGraphicNovelDialogueState(project);
  const balloons = { ...state.balloons };
  delete balloons[dialogueId];
  return withGraphicNovelDialogueState(project, { ...state, balloons, updatedAt: new Date().toISOString() });
}

export function updateGraphicNovelCaption(
  project: PlotPickleProject,
  direction: GraphicNovelCaptionDirection,
): PlotPickleProject {
  const state = getGraphicNovelDialogueState(project);
  return withGraphicNovelDialogueState(project, {
    ...state,
    captions: { ...state.captions, [direction.panelId]: direction },
    updatedAt: new Date().toISOString(),
  });
}

export function shortenGraphicNovelDialogue(value: string, maximum: number) {
  const normalized = value.trim().replace(/\s+/g, " ");
  const safeMaximum = Math.min(500, Math.max(20, Math.round(maximum) || 120));
  if (normalized.length <= safeMaximum) return normalized;
  const window = normalized.slice(0, safeMaximum - 1);
  const punctuation = Math.max(window.lastIndexOf("."), window.lastIndexOf("!"), window.lastIndexOf("?"), window.lastIndexOf(";"));
  const word = window.lastIndexOf(" ");
  const cut = punctuation >= Math.floor(safeMaximum * 0.55) ? punctuation + 1 : word >= Math.floor(safeMaximum * 0.55) ? word : safeMaximum - 1;
  return `${window.slice(0, cut).trim().replace(/[,:;-]+$/, "")}…`;
}

export function graphicNovelDialogueIssues(project: PlotPickleProject, panel: ComicPitchPanel) {
  const issues: string[] = [];
  if (!panel.imageSrc) issues.push("Image unresolved");
  panel.dialogue.forEach((dialogue, index) => {
    const direction = graphicNovelBalloon(project, panel, dialogue, index);
    if (!dialogue.text.trim()) issues.push(`Balloon ${index + 1} is empty`);
    else if (dialogue.text.trim().length > direction.maxCharacters) issues.push(`Balloon ${index + 1} is ${dialogue.text.trim().length - direction.maxCharacters} characters over`);
  });
  const caption = graphicNovelCaption(project, panel);
  if (!panel.narration.trim()) issues.push("Narration is empty");
  else if (panel.narration.trim().length > caption.maxCharacters) issues.push(`Narration is ${panel.narration.trim().length - caption.maxCharacters} characters over`);
  return issues;
}

export function graphicNovelDialogueSummary(project: PlotPickleProject, deck: ComicPitchDeck) {
  const unresolvedPanels = deck.panels.filter((panel) => graphicNovelDialogueIssues(project, panel).length).length;
  return {
    panelCount: deck.panels.length,
    balloonCount: deck.panels.reduce((total, panel) => total + panel.dialogue.length, 0),
    unresolvedPanels,
    readyPanels: deck.panels.length - unresolvedPanels,
  };
}
''')

write("lib/graphic-novel-viewer.ts", r'''
import {
  graphicNovelBalloon,
  graphicNovelCaption,
  graphicNovelDialogueIssues,
} from "./graphic-novel-dialogue";
import type { ComicPitchPanel, PlotPickleProject } from "./project";
import { resolveProjectAssetSource } from "./project-assets";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function graphicNovelImageFileName(panel: Pick<ComicPitchPanel, "pageNumber" | "panelNumber">, extension = "png") {
  return `graphic-novel-page-${String(panel.pageNumber).padStart(2, "0")}-panel-${panel.panelNumber}.${extension.replace(/^\./, "") || "png"}`;
}

export function buildGraphicNovelViewerHtml(
  project: PlotPickleProject,
  imageDataByPanel: Record<string, string> = {},
) {
  const deck = project.review.pitchPackage.comicDeck;
  const title = project.review.pitchPackage.title || project.metadata.title;
  const pages = Array.from({ length: 24 }, (_, index) => {
    const pageNumber = index + 1;
    const panels = (deck?.panels ?? [])
      .filter((panel) => panel.pageNumber === pageNumber)
      .sort((left, right) => left.panelNumber - right.panelNumber);
    return `<section class="graphic-page" data-page="${pageNumber}" aria-label="Page ${pageNumber}"><header><span>Page ${pageNumber} of 24</span><h2>${escapeHtml(project.blocks.find((block) => block.number === pageNumber)?.title || `Block ${pageNumber}`)}</h2></header><div class="panel-grid">${panels.map((panel) => {
      const image = imageDataByPanel[panel.id] || resolveProjectAssetSource(project.assets, panel.assetRef, panel.imageSrc);
      const issues = graphicNovelDialogueIssues(project, panel);
      const balloons = panel.dialogue
        .map((dialogue, dialogueIndex) => ({ dialogue, direction: graphicNovelBalloon(project, panel, dialogue, dialogueIndex) }))
        .sort((left, right) => left.direction.readingOrder - right.direction.readingOrder)
        .map(({ dialogue, direction }) => `<blockquote class="balloon" data-kind="${direction.kind}" data-placement="${direction.placement}" style="--reading-order:${direction.readingOrder}"><strong>${escapeHtml(dialogue.characterName)}</strong><p>${escapeHtml(dialogue.text)}</p>${direction.emotionalDelivery ? `<small>${escapeHtml(direction.emotionalDelivery)}</small>` : ""}</blockquote>`)
        .join("");
      const caption = graphicNovelCaption(project, panel);
      return `<article class="graphic-panel" data-panel="${panel.panelNumber}" data-unresolved="${issues.length ? "true" : "false"}"><div class="panel-image">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(`${panel.title}: ${panel.narration}`)}">` : `<div class="placeholder">Panel ${panel.panelNumber}<br>Image unresolved</div>`}<div class="balloons">${balloons}</div>${issues.length ? `<span class="unresolved" title="${escapeHtml(issues.join("; "))}">${issues.length}</span>` : ""}</div><div class="caption" data-placement="${caption.placement}" style="--reading-order:${caption.readingOrder}"><span>${escapeHtml(panel.title)}</span><p>${escapeHtml(panel.narration)}</p></div></article>`;
    }).join("")}</div></section>`;
  }).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — Graphic Novel</title><style>
*{box-sizing:border-box}html{background:#101715}body{margin:0;color:#111;font-family:Arial,sans-serif;background:#101715}.reader-bar{position:sticky;top:0;z-index:50;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;padding:10px;background:#13231f;color:#fff;box-shadow:0 5px 20px #0007}.reader-bar button,.reader-bar select{border:1px solid #ffffff42;border-radius:8px;padding:8px 11px;background:#fff;color:#173f35;font:inherit;font-weight:700}.reader-bar output{min-width:100px;text-align:center}.reader{--zoom:1;transform-origin:top center}.cover,.graphic-page{width:min(11in,calc(100% - 24px));min-height:8.5in;margin:24px auto;padding:.45in;background:#fff;box-shadow:0 8px 30px #0007;transform:scale(var(--zoom));transform-origin:top center}.cover{display:grid;place-content:center;text-align:center}.cover h1{margin:0;font-family:Georgia,serif;font-size:52px}.cover p{max-width:760px;font-size:20px;line-height:1.5}.graphic-page{display:none}.graphic-page.active{display:block}.graphic-page>header{display:flex;align-items:end;justify-content:space-between;border-bottom:3px solid #111;margin-bottom:14px}.graphic-page h2{margin:0 0 7px;font-family:Georgia,serif}.graphic-page header span{order:2;margin-bottom:8px;font-size:12px;font-weight:700}.panel-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.graphic-panel{overflow:hidden;border:3px solid #111;background:#fff}.panel-image{position:relative;aspect-ratio:3/2;overflow:hidden;background:#eee}.panel-image img{width:100%;height:100%;object-fit:cover;filter:grayscale(1)}.placeholder{display:grid;place-content:center;height:100%;color:#555;text-align:center}.balloons{position:absolute;inset:8px;pointer-events:none}.balloon{position:absolute;max-width:48%;margin:0;padding:8px 11px;border:2px solid #111;border-radius:46%;background:#fff;color:#111;text-align:center;box-shadow:2px 2px 0 #111}.balloon[data-kind=thought]{border-style:dashed;border-radius:50%}.balloon[data-kind=whisper]{border-width:1px;color:#444}.balloon[data-kind=shout]{border-radius:12px;text-transform:uppercase}.balloon[data-placement=top-left]{top:0;left:0}.balloon[data-placement=top-right]{top:0;right:0}.balloon[data-placement=bottom-left]{bottom:0;left:0}.balloon[data-placement=bottom-right]{right:0;bottom:0}.balloon strong{font-size:10px;text-transform:uppercase}.balloon p{margin:3px 0;font-size:12px;line-height:1.25}.balloon small{display:block;font-size:9px;font-style:italic}.unresolved{position:absolute;right:8px;bottom:8px;display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:#b32727;color:#fff;font-weight:800}.caption{min-height:88px;padding:10px;border-top:3px solid #111}.caption[data-placement=top-left],.caption[data-placement=top-right],.caption[data-placement=bottom-overlay]{position:absolute;z-index:6;max-width:56%;min-height:0;border:2px solid #111;background:#fff}.caption[data-placement=top-left]{top:8px;left:8px}.caption[data-placement=top-right]{top:8px;right:8px}.caption[data-placement=bottom-overlay]{right:8px;bottom:8px;left:8px;max-width:none}.caption span{font-size:11px;font-weight:800;text-transform:uppercase}.caption p{margin:5px 0;font-family:Georgia,serif;font-size:14px;line-height:1.35}.hide-dialogue .balloons,.hide-dialogue .caption{display:none}.panel-mode .graphic-page.active .panel-grid{display:block}.panel-mode .graphic-page.active .graphic-panel{display:none}.panel-mode .graphic-page.active .graphic-panel.active-panel{display:block;max-width:9in;margin:auto}.spread-mode{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding:16px}.spread-mode .graphic-page.active{width:100%;min-height:0;margin:0;transform:none}.rights{font-size:13px}.rights p{margin:4px 0}@page{size:landscape;margin:0}@media print{.reader-bar{display:none}body{background:#fff}.reader{display:block!important;transform:none}.cover,.graphic-page{display:block!important;width:11in;height:8.5in;min-height:0;margin:0;box-shadow:none;transform:none;break-after:page;page-break-after:always}.graphic-page:last-child{break-after:auto;page-break-after:auto}}@media(max-width:900px){.spread-mode{display:block}.cover,.graphic-page{min-height:0;margin:12px auto;padding:18px;transform:none}.panel-grid{grid-template-columns:1fr}.balloon{max-width:62%}}
</style></head><body><nav class="reader-bar" aria-label="Graphic Novel reader controls"><button type="button" id="previous">Previous</button><output id="position">Cover</output><button type="button" id="next">Next</button><select id="mode" aria-label="View mode"><option value="single">Single page</option><option value="spread">Two-page spread</option><option value="panel">Panel-by-panel</option></select><button type="button" id="dialogue">Hide dialogue</button><button type="button" id="zoom-out">Zoom −</button><button type="button" id="zoom-in">Zoom +</button><button type="button" id="print">Print / Save PDF</button></nav><main class="reader" id="reader"><section class="cover active"><p>PlotPickle Graphic Novel</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(project.review.pitchPackage.logline || project.story.logline)}</p><div class="rights"><p>${escapeHtml(project.rights.copyrightNotice)}</p><p>Images and editable dialogue assembled through an explicit, writer-controlled workflow.</p></div></section>${pages}</main><script>
(function(){var page=0,panel=1,mode='single',zoom=1,dialogue=true;var reader=document.getElementById('reader'),cover=document.querySelector('.cover'),pages=Array.from(document.querySelectorAll('.graphic-page')),position=document.getElementById('position');function clamp(v,min,max){return Math.min(max,Math.max(min,v))}function render(){cover.classList.toggle('active',page===0);pages.forEach(function(item){var number=Number(item.dataset.page);var active=page>0&&(number===page||(mode==='spread'&&number===page+1));item.classList.toggle('active',active);item.querySelectorAll('.graphic-panel').forEach(function(panelNode){panelNode.classList.toggle('active-panel',Number(panelNode.dataset.panel)===panel)});});reader.classList.toggle('spread-mode',mode==='spread');reader.classList.toggle('panel-mode',mode==='panel');reader.classList.toggle('hide-dialogue',!dialogue);reader.style.setProperty('--zoom',String(zoom));position.textContent=page===0?'Cover':'Page '+page+(mode==='panel'?' · Panel '+panel:'');document.getElementById('dialogue').textContent=dialogue?'Hide dialogue':'Show dialogue'}function move(delta){if(mode==='panel'&&page>0){panel+=delta;if(panel>4){panel=1;page=clamp(page+1,0,24)}else if(panel<1){panel=4;page=clamp(page-1,0,24)}}else{page=clamp(page+delta,0,24)}render()}document.getElementById('previous').onclick=function(){move(-1)};document.getElementById('next').onclick=function(){move(1)};document.getElementById('mode').onchange=function(event){mode=event.target.value;render()};document.getElementById('dialogue').onclick=function(){dialogue=!dialogue;render()};document.getElementById('zoom-out').onclick=function(){zoom=clamp(zoom-.1,.6,1.5);render()};document.getElementById('zoom-in').onclick=function(){zoom=clamp(zoom+.1,.6,1.5);render()};document.getElementById('print').onclick=function(){window.print()};document.addEventListener('keydown',function(event){if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;if(event.key==='ArrowRight'||event.key==='PageDown')move(1);if(event.key==='ArrowLeft'||event.key==='PageUp')move(-1);if(event.key.toLowerCase()==='d'){dialogue=!dialogue;render()}if(event.key==='+'||event.key==='='){zoom=clamp(zoom+.1,.6,1.5);render()}if(event.key==='-'){zoom=clamp(zoom-.1,.6,1.5);render()}});render()})();
</script></body></html>`;
}
''')

write("app/graphic-novel-viewer.tsx", r'''
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
''')

write("app/graphic-novel-viewer.module.css", r'''
.viewer{display:grid;gap:18px;padding:22px;border:1px solid rgba(25,74,61,.18);border-radius:20px;background:linear-gradient(145deg,rgba(246,251,249,.98),rgba(238,246,251,.98));box-shadow:0 18px 48px rgba(18,54,45,.08)}.viewer:fullscreen{overflow:auto;padding:24px;background:#10201c}.heading{display:flex;justify-content:space-between;gap:24px;align-items:start}.heading>div{display:grid;gap:6px}.heading span,.heading h2,.heading p{margin:0}.heading span{color:#39705f;font-size:.72rem;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.heading h2{color:#153e34;font-size:clamp(1.35rem,2vw,1.9rem)}.heading p{max-width:84ch;color:#526b63;line-height:1.55}.heading>strong{flex:0 0 auto;padding:8px 11px;border-radius:999px;background:#183f35;color:#fff;font-size:.76rem}.toolbar{display:flex;flex-wrap:wrap;align-items:end;gap:8px;padding:12px;border-radius:14px;background:#173f35;color:#fff}.toolbar button,.toolbar select,.toolbar input{font:inherit}.toolbar button,.toolbar select{min-height:38px;border:1px solid rgba(255,255,255,.32);border-radius:9px;padding:8px 11px;background:#fff;color:#173f35;font-weight:800;cursor:pointer}.toolbar button:disabled{cursor:not-allowed;opacity:.5}.toolbar output{min-width:118px;padding:8px 10px;text-align:center;font-weight:850}.toolbar label{display:grid;gap:4px}.toolbar label span{font-size:.7rem;font-weight:800;text-transform:uppercase}.toolbar input[type=range]{width:120px}.stage{--viewer-zoom:1;display:flex;justify-content:center;align-items:flex-start;gap:18px;overflow:auto;padding:18px;border-radius:16px;background:#16211e;min-height:440px}.cover,.page{width:min(100%,960px);min-width:0;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.35);transform:scale(var(--viewer-zoom));transform-origin:top center}.cover{display:grid;place-content:center;min-height:620px;padding:50px;text-align:center}.cover span{font-size:.78rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.cover h3{margin:12px 0;font-family:Georgia,serif;font-size:clamp(2.4rem,6vw,5rem)}.cover p{max-width:760px;font-size:1.15rem;line-height:1.6}.cover small{margin-top:28px}.page{padding:26px}.page>header{display:flex;align-items:end;justify-content:space-between;border-bottom:3px solid #111;margin-bottom:14px}.page h3{margin:0 0 7px;font-family:Georgia,serif}.page header span{order:2;margin-bottom:8px;font-size:.75rem;font-weight:800}.panelGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.stage[data-view=spread] .page{width:min(50%,760px)}.stage[data-view=panel] .page{width:min(100%,980px)}.stage[data-view=panel] .panelGrid{display:block}.panel{position:relative;overflow:hidden;border:3px solid #111;background:#fff;cursor:pointer}.panel[data-selected=true]{outline:5px solid #61c8a8;outline-offset:3px}.panelImage{position:relative;aspect-ratio:3/2;overflow:hidden;background:#e8ecea}.panelImage img{width:100%;height:100%;object-fit:cover;filter:grayscale(1)}.placeholder{display:grid;place-content:center;height:100%;color:#53635d;font-weight:800}.balloons{position:absolute;inset:8px;pointer-events:none}.balloon{position:absolute;max-width:48%;margin:0;padding:8px 11px;border:2px solid #111;border-radius:46%;background:#fff;color:#111;text-align:center;box-shadow:2px 2px 0 #111}.balloon[data-kind=thought]{border-style:dashed;border-radius:50%}.balloon[data-kind=whisper]{border-width:1px;color:#444}.balloon[data-kind=shout]{border-radius:12px;text-transform:uppercase}.balloon[data-placement=top-left]{top:0;left:0}.balloon[data-placement=top-right]{top:0;right:0}.balloon[data-placement=bottom-left]{bottom:0;left:0}.balloon[data-placement=bottom-right]{right:0;bottom:0}.balloon strong{font-size:.62rem;text-transform:uppercase}.balloon p{margin:3px 0;font-size:.76rem;line-height:1.25}.balloon small{display:block;font-size:.58rem;font-style:italic}.unresolved{position:absolute;right:8px;bottom:8px;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#b32727;color:#fff;font-weight:900}.caption{min-height:86px;padding:10px;border-top:3px solid #111;background:#fff}.caption[data-placement=top-left],.caption[data-placement=top-right],.caption[data-placement=bottom-overlay]{position:absolute;max-width:58%;min-height:0;border:2px solid #111}.caption[data-placement=top-left]{top:8px;left:8px}.caption[data-placement=top-right]{top:8px;right:8px}.caption[data-placement=bottom-overlay]{right:8px;bottom:8px;left:8px;max-width:none}.caption strong{font-size:.68rem;text-transform:uppercase}.caption p{margin:5px 0;font-family:Georgia,serif;font-size:.86rem;line-height:1.35}.editor{display:grid;gap:16px;padding:18px;border:1px solid rgba(23,63,53,.18);border-radius:16px;background:#fff}.editorHeading{display:flex;justify-content:space-between;gap:20px}.editorHeading>div{display:grid;gap:4px}.editorHeading span,.editorHeading h3,.editorHeading p{margin:0}.editorHeading span{color:#39705f;font-size:.72rem;font-weight:850;text-transform:uppercase}.editorHeading>strong{align-self:start;padding:7px 10px;border-radius:999px;font-size:.75rem}.editorHeading>strong[data-state=ready]{background:#dff6eb;color:#12523f}.editorHeading>strong[data-state=unresolved]{background:#fee7e4;color:#8c2620}.balloonEditors{display:grid;gap:12px}.balloonEditors fieldset,.captionEditor{display:grid;gap:12px;margin:0;padding:15px;border:1px solid rgba(23,63,53,.16);border-radius:13px}.balloonEditors legend,.captionEditor legend{padding:0 6px;color:#173f35;font-weight:850}.editorGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.editor label{display:grid;gap:5px}.editor label>span{color:#2d5147;font-size:.75rem;font-weight:800}.editor input,.editor select,.editor textarea{width:100%;border:1px solid rgba(23,63,53,.22);border-radius:9px;padding:9px 10px;background:#fff;color:#173f35;font:inherit}.editor textarea{min-height:94px;resize:vertical}.fullField{grid-column:1/-1}.textActions{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:7px}.textActions small{margin-right:auto;color:#61736d}.textActions small[data-over=true]{color:#a12d25;font-weight:850}.textActions button,.addBalloon,.panelActions button,.exports button{border:1px solid rgba(23,63,53,.22);border-radius:9px;padding:8px 11px;background:#fff;color:#173f35;font:inherit;font-weight:800;cursor:pointer}.sourceLine{margin:0;padding:10px 12px;border-left:4px solid #78bda8;background:#f1f8f5}.sourceLine strong{font-size:.7rem;text-transform:uppercase}.sourceLine p{margin:5px 0 0;line-height:1.45}.addBalloon{justify-self:start}.panelActions{display:flex;justify-content:flex-end;gap:8px}.panelActions button:first-child{background:#173f35;color:#fff}.panelActions button:disabled{cursor:not-allowed;opacity:.55}.exports{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:16px;border-radius:14px;background:#173f35;color:#fff}.exports>div:first-child{display:grid;gap:4px}.exports>div:last-child{display:flex;flex-wrap:wrap;gap:8px}.exports span{max-width:68ch;color:#d9ebe5;font-size:.82rem;line-height:1.45}@media(max-width:980px){.stage[data-view=spread]{display:block}.stage[data-view=spread] .page{width:100%;margin-bottom:18px}.editorGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:720px){.viewer{padding:15px}.heading,.editorHeading,.exports{align-items:stretch;flex-direction:column}.toolbar{align-items:stretch}.toolbar output{order:-1;width:100%}.panelGrid,.editorGrid{grid-template-columns:1fr}.stage{padding:8px}.page{padding:14px}.balloon{max-width:64%}.panelActions,.exports>div:last-child{align-items:stretch;flex-direction:column}.panelActions button,.exports button{width:100%}}
''')

write("tests/issue-283-graphic-novel-viewer.test.mjs", r'''
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dialogue = readFileSync(new URL("../lib/graphic-novel-dialogue.ts", import.meta.url), "utf8");
const html = readFileSync(new URL("../lib/graphic-novel-viewer.ts", import.meta.url), "utf8");
const viewer = readFileSync(new URL("../app/graphic-novel-viewer.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../app/ai-pitch-deck-workspace.tsx", import.meta.url), "utf8");
const queue = readFileSync(new URL("../app/use-graphic-novel-queue.ts", import.meta.url), "utf8");
const baseEditor = readFileSync(new URL("../app/ai-pitch-deck-workspace-base.tsx", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("Phase 7 stores non-destructive balloon and caption direction in a versioned PPF extension", () => {
  assert.match(dialogue, /plotpickle\.graphicNovelDialogue\.v1/);
  assert.match(dialogue, /speech.*thought.*whisper.*shout/s);
  assert.match(dialogue, /top-left.*top-right.*bottom-left.*bottom-right/s);
  assert.match(dialogue, /originalText/);
  assert.match(dialogue, /sourceElementId/);
  assert.match(dialogue, /shortenGraphicNovelDialogue/);
  assert.match(dialogue, /graphicNovelDialogueIssues/);
});

test("Phase 7 viewer supports cover, page, spread and panel reading modes", () => {
  assert.match(viewer, /Complete Graphic Novel Viewer/);
  assert.match(viewer, /Single page/);
  assert.match(viewer, /Two-page spread/);
  assert.match(viewer, /Panel-by-panel/);
  assert.match(viewer, /ArrowRight/);
  assert.match(viewer, /Full screen/);
  assert.match(viewer, /Hide dialogue/);
  assert.match(viewer, /Zoom/);
  assert.match(viewer, /graphicNovelDialogueIssues/);
});

test("Phase 7 edits bubbles in context without drawing text into generated images", () => {
  assert.match(viewer, /Bubble and caption editor/);
  assert.match(viewer, /Balloon type/);
  assert.match(viewer, /Emotional delivery/);
  assert.match(viewer, /Reading order/);
  assert.match(viewer, /Maximum suggested length/);
  assert.match(viewer, /Automatic shortening/);
  assert.match(viewer, /Source screenplay line/);
  assert.match(viewer, /Restore original line/);
  assert.match(viewer, /Thought text/);
  assert.match(viewer, /Narration/);
});

test("Phase 7 provides single-panel recovery, image-version access and portable exports", () => {
  assert.match(queue, /async function regeneratePanel/);
  assert.match(workspace, /buildGraphicNovelViewerHtml/);
  assert.match(workspace, /downloadImageSequence/);
  assert.match(workspace, /graphicNovelImageFileName/);
  assert.match(workspace, /Replace image \/ open versions/);
  assert.match(baseEditor, /graphic-novel-panel-editor-/);
  assert.match(html, /reader-bar/);
  assert.match(html, /spread-mode/);
  assert.match(html, /panel-mode/);
  assert.match(html, /Print \/ Save PDF/);
  assert.match(html, /data-unresolved/);
});

test("Phase 7 focused regression is part of the complete test suite", () => {
  assert.match(packageJson.scripts.test, /issue-283-graphic-novel-viewer\.test\.mjs/);
  assert.equal(packageJson.scripts["test:graphic-novel-viewer"], "node --test tests/issue-283-graphic-novel-viewer.test.mjs");
});
''')

replace_once(
    "app/ai-pitch-deck-workspace.tsx",
    'import { buildGraphicNovelHtml, graphicNovelFileName, withComicPitchDeck } from "@/lib/ai-pitch-deck";\n',
    'import { graphicNovelFileName, withComicPitchDeck } from "@/lib/ai-pitch-deck";\nimport { buildGraphicNovelViewerHtml, graphicNovelImageFileName } from "@/lib/graphic-novel-viewer";\n',
)
replace_once(
    "app/ai-pitch-deck-workspace.tsx",
    'import GraphicNovelStoryBriefEditor from "./graphic-novel-story-brief";\n',
    'import GraphicNovelStoryBriefEditor from "./graphic-novel-story-brief";\nimport GraphicNovelViewer from "./graphic-novel-viewer";\n',
)
replace_once(
    "app/ai-pitch-deck-workspace.tsx",
    '      const html = buildGraphicNovelHtml(prepared, await embeddedImages(prepared));\n',
    '      const html = buildGraphicNovelViewerHtml(prepared, await embeddedImages(prepared));\n',
)
replace_once(
    "app/ai-pitch-deck-workspace.tsx",
    '''  async function exportGraphicNovel(print = false) {
''',
    '''  function openPanelEditor(panelId: string) {
    const target = document.getElementById(`graphic-novel-panel-editor-${panelId}`);
    if (target instanceof HTMLDetailsElement) target.open = true;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function downloadImageSequence() {
    const completed = queue.deck.panels
      .filter((panel) => panel.imageSrc)
      .sort((left, right) => left.pageNumber - right.pageNumber || left.panelNumber - right.panelNumber);
    setExportMessage(`Preparing ${completed.length} completed panel image${completed.length === 1 ? "" : "s"} in reading order…`);
    try {
      for (const panel of completed) {
        const response = await fetch(panel.imageSrc);
        if (!response.ok) throw new Error(`Page ${panel.pageNumber}, panel ${panel.panelNumber} could not be downloaded.`);
        const blob = await response.blob();
        const extension = blob.type.includes("webp") ? "webp" : blob.type.includes("jpeg") ? "jpg" : "png";
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = graphicNovelImageFileName(panel, extension);
        link.click();
        URL.revokeObjectURL(url);
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      }
      setExportMessage(`${completed.length} panel image${completed.length === 1 ? " was" : "s were"} downloaded in reading order.`);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "The image sequence could not be downloaded.");
    }
  }

  async function exportGraphicNovel(print = false) {
''',
)
replace_once(
    "app/ai-pitch-deck-workspace.tsx",
    '''      <GraphicNovelStoryBriefEditor
        brief={queue.brief}
        working={queue.working || cast.working}
        onSave={queue.applyStoryBrief}
        onReset={queue.resetStoryBrief}
      />

      <section className={styles.controlPanel}''',
    '''      <GraphicNovelStoryBriefEditor
        brief={queue.brief}
        working={queue.working || cast.working}
        onSave={queue.applyStoryBrief}
        onReset={queue.resetStoryBrief}
      />

      <GraphicNovelViewer
        project={withComicPitchDeck(props.project, queue.deck)}
        deck={queue.deck}
        working={queue.working || cast.working}
        aiReady={queue.aiReady}
        acknowledged={queue.acknowledged}
        onProjectChange={props.onProjectChange}
        onRegenerate={(panelId) => void queue.regeneratePanel(panelId)}
        onOpenPanelEditor={openPanelEditor}
        onExportHtml={() => void exportGraphicNovel(false)}
        onPrint={() => void exportGraphicNovel(true)}
        onDownloadImages={() => void downloadImageSequence()}
      />

      <section className={styles.controlPanel}''',
)
replace_once(
    "app/ai-pitch-deck-workspace.tsx",
    '''        <div><button type="button" disabled={!queue.counts.completed || queue.working || cast.working} onClick={() => void exportGraphicNovel(false)}>Download self-contained HTML</button><button type="button" disabled={!queue.counts.completed || queue.working || cast.working} onClick={() => void exportGraphicNovel(true)}>Print / Save as PDF</button></div>
''',
    '''        <div><button type="button" disabled={!queue.counts.completed || queue.working || cast.working} onClick={() => void exportGraphicNovel(false)}>Download interactive HTML</button><button type="button" disabled={!queue.counts.completed || queue.working || cast.working} onClick={() => void exportGraphicNovel(true)}>Print / Save as PDF</button><button type="button" disabled={!queue.counts.completed || queue.working || cast.working} onClick={() => void downloadImageSequence()}>Download image sequence</button></div>
''',
)

replace_once(
    "app/use-graphic-novel-queue.ts",
    '''  function applyStoryBrief(nextBrief: GraphicNovelStoryBrief) {
''',
    '''  async function regeneratePanel(panelId: string) {
    if (runningRef.current || working) return;
    if (!aiReady) {
      setMessage("Connect and verify an image provider before regenerating this panel.");
      return;
    }
    if (!acknowledged) {
      setMessage("Confirm the image-provider cost acknowledgement before regenerating this panel.");
      return;
    }
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
    const controller = new AbortController();
    controllerRef.current = controller;
    let activeDeck = updateComicPitchPanel(deckRef.current, panel.id, { status: "generating", error: "" }, "generating");
    saveDeck(activeDeck);
    setMessage(`${graphicNovelPanelLabel(panel)} is regenerating as one explicit image request.`);
    try {
      const result = await requestPanel(panel, `single-panel-${projectRef.current.id}`, `single-${panel.id}-${Date.now()}`, controller.signal);
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
      }, deckRef.current.status === "complete" ? "complete" : "paused");
      saveDeck(activeDeck, true);
      setMessage(`${graphicNovelPanelLabel(panel)} was regenerated. The previous asset remains available through image versions.`);
    } catch (error) {
      const aborted = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
      activeDeck = updateComicPitchPanel(activeDeck, panel.id, {
        status: aborted ? "pending" : "error",
        error: aborted ? "" : safeQueueError(error),
      }, "paused");
      saveDeck(activeDeck);
      setMessage(aborted ? "Single-panel regeneration stopped." : `${graphicNovelPanelLabel(panel)} could not be regenerated. The previous completed asset was not deleted.`);
    } finally {
      controllerRef.current = null;
      runningRef.current = false;
      setWorking(false);
    }
  }

  function applyStoryBrief(nextBrief: GraphicNovelStoryBrief) {
''',
)
replace_once(
    "app/use-graphic-novel-queue.ts",
    '''    counts, currentItem, currentPanel, progress, start, stop, retry, skip, refresh, applyStoryBrief, resetStoryBrief,
''',
    '''    counts, currentItem, currentPanel, progress, start, stop, retry, skip, refresh, regeneratePanel, applyStoryBrief, resetStoryBrief,
''',
)

replace_once(
    "app/ai-pitch-deck-workspace-base.tsx",
    '<details className={styles.editor}>',
    '<details id={`graphic-novel-panel-editor-${panel.id}`} className={styles.editor}>',
)

package_path = ROOT / "package.json"
package_data = json.loads(package_path.read_text(encoding="utf-8"))
main_test = package_data["scripts"]["test"]
needle = " tests/issue-282-graphic-novel-story-brief.test.mjs"
if "tests/issue-283-graphic-novel-viewer.test.mjs" not in main_test:
    if needle not in main_test:
        raise SystemExit("Phase 6 test marker is missing from package.json")
    package_data["scripts"]["test"] = main_test.replace(needle, needle + " tests/issue-283-graphic-novel-viewer.test.mjs")
package_data["scripts"]["test:graphic-novel-viewer"] = "node --test tests/issue-283-graphic-novel-viewer.test.mjs"
package_path.write_text(json.dumps(package_data, indent=2) + "\n", encoding="utf-8")
