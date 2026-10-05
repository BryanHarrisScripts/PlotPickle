"use client";

/* eslint-disable @next/next/no-img-element -- Previs keyframes are lazy local PlotPickle assets. */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type PrevisGraphicNovelTextApproval,
  type PrevisGraphicNovelTextBubble,
} from "@/core/contracts/previs";
import type { PPFProject } from "@/core/project/project";
import { saveFoundationProject } from "@/core/storage/foundation-project-browser";
import {
  storyboardAnchorEvidence,
  storyboardPositionProgression,
} from "../storyboard/storyboard-editorial-model";
import {
  derivePrevisProjection,
  type PrevisAnchorProjection,
} from "./previs-projection-model";
import {
  PREVIS_FLIP_BOOK_INTERVAL_MS,
  PREVIS_GRAPHIC_NOVEL_INTERVAL_MS,
  buildPrevisGraphicNovelPanel,
  type PrevisGraphicNovelPanel,
} from "./previs-graphic-novel-presentation";
import styles from "./previs-readiness-workspace.module.css";

const PANEL_WIDTH = 720;
const PANEL_HEIGHT = 405;
const COLUMNS = 2;
const GAP = 20;
const MARGIN = 20;
const HEADER_HEIGHT = 72;
const MAX_PANELS = 25;

function clean(value: string, maximum: number) {
  return value.replace(/\s+/gu, " ").trim().slice(0, maximum);
}

function wrapText(
  context: CanvasRenderingContext2D,
  value: string,
  maximumWidth: number,
  maximumLines: number,
) {
  const words = clean(value, 1200).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maximumWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maximumLines - 1) break;
  }
  if (current && lines.length < maximumLines) lines.push(current);
  return lines.slice(0, maximumLines);
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const bounded = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + bounded, y);
  context.lineTo(x + width - bounded, y);
  context.quadraticCurveTo(x + width, y, x + width, y + bounded);
  context.lineTo(x + width, y + height - bounded);
  context.quadraticCurveTo(x + width, y + height, x + width - bounded, y + height);
  context.lineTo(x + bounded, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - bounded);
  context.lineTo(x, y + bounded);
  context.quadraticCurveTo(x, y, x + bounded, y);
  context.closePath();
}

async function localImage(assetUrl: string) {
  if (!assetUrl.startsWith("/api/local-ai/assets/")) {
    throw new Error("Graphic Novel export accepts saved PlotPickle local images only.");
  }
  const response = await fetch(assetUrl, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(`Graphic Novel source image could not be read (${response.status}).`);
  const blob = await response.blob();
  if (!["image/png", "image/jpeg", "image/webp"].includes(blob.type)) {
    throw new Error("Graphic Novel export received an unsupported source image.");
  }
  return createImageBitmap(blob);
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: ImageBitmap,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = Math.max(0, (image.width - sourceWidth) / 2);
  const sourceY = Math.max(0, (image.height - sourceHeight) / 2);
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawBubble(
  context: CanvasRenderingContext2D,
  panelX: number,
  panelY: number,
  speaker: string,
  text: string,
  index: number,
) {
  const width = 292;
  const height = 112;
  const x = panelX + (index % 2 === 0 ? 26 : PANEL_WIDTH - width - 26);
  const y = panelY + (index % 2 === 0 ? 24 : 76);

  context.save();
  roundedRect(context, x, y, width, height, 42);
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#111111";
  context.lineWidth = 3;
  context.fill();
  context.stroke();

  const tailX = index % 2 === 0 ? x + 62 : x + width - 76;
  context.beginPath();
  context.moveTo(tailX, y + height - 4);
  context.lineTo(tailX + 20, y + height + 24);
  context.lineTo(tailX + 38, y + height - 1);
  context.closePath();
  context.fill();
  context.stroke();

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#111111";
  context.font = "700 13px Arial, sans-serif";
  context.fillText(clean(speaker, 48), x + width / 2, y + 25);

  context.font = "17px Arial, sans-serif";
  const lines = wrapText(context, text, width - 34, 3);
  lines.forEach((line, lineIndex) => {
    context.fillText(line, x + width / 2, y + 51 + lineIndex * 21);
  });
  context.restore();
}

function drawPanelOverlay(
  context: CanvasRenderingContext2D,
  panel: PrevisGraphicNovelPanel,
  x: number,
  y: number,
) {
  if (!panel.caption && !panel.narration && !panel.shotLabel && !panel.shotContext && !panel.bubbles.length) return;
  panel.bubbles.slice(0, 2).forEach((bubble, index) => {
    drawBubble(context, x, y, bubble.speaker, bubble.text, index);
  });

  context.save();
  context.fillStyle = "rgba(5, 8, 7, 0.84)";
  context.fillRect(x, y + 300, PANEL_WIDTH, 105);
  context.fillStyle = "#70d6a1";
  context.fillRect(x, y + 300, PANEL_WIDTH, 2);

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.font = "700 14px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#70d6a1";
  const caption = wrapText(context, panel.caption, PANEL_WIDTH - 48, 1);
  caption.forEach((line, index) => context.fillText(line, x + 24, y + 326 + index * 18));

  context.font = "14px Arial, sans-serif";
  context.fillStyle = "#f2f5f3";
  const narration = wrapText(context, panel.narration, PANEL_WIDTH - 48, 2);
  narration.forEach((line, index) => context.fillText(line, x + 24, y + 350 + index * 20));

  context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#c7d4cc";
  const shot = clean([panel.shotLabel, panel.shotContext].filter(Boolean).join(" · "), 180);
  const shotLine = wrapText(context, shot, PANEL_WIDTH - 48, 1)[0];
  if (shotLine) context.fillText(shotLine, x + 24, y + 397);
  context.restore();
}

function webpBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== "image/webp") {
        reject(new Error("This PlotPickle browser session could not encode a WebP image."));
        return;
      }
      resolve(blob);
    }, "image/webp", 0.86);
  });
}

async function buildBrowserGraphicNovelWebp(input: Readonly<{
  projectTitle: string;
  blockNumber: number;
  miniBlockNumber: number;
  panels: readonly PrevisGraphicNovelPanel[];
}>) {
  const panels = input.panels
    .filter((panel) => panel.authoritative && panel.assetUrl)
    .slice(0, MAX_PANELS)
    .sort((left, right) => left.position - right.position);

  if (!panels.length) throw new Error("Lock at least one Storyboard Image in Storyboard before exporting WebP.");

  const rows = Math.ceil(panels.length / COLUMNS);
  const width = MARGIN * 2 + COLUMNS * PANEL_WIDTH + (COLUMNS - 1) * GAP;
  const height = HEADER_HEIGHT + MARGIN + rows * PANEL_HEIGHT + Math.max(0, rows - 1) * GAP + MARGIN;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser canvas needed for WebP export is unavailable.");

  context.fillStyle = "#050807";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#09100d";
  context.fillRect(0, 0, width, HEADER_HEIGHT);
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.font = "700 18px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#70d6a1";
  context.fillText("PREVIS GRAPHIC NOVEL", MARGIN, 30);
  context.font = "16px Arial, sans-serif";
  context.fillStyle = "#f2f5f3";
  context.fillText(
    `${clean(input.projectTitle || "Untitled Story", 120)} · Block ${String(input.blockNumber).padStart(2, "0")} · Mini-Block ${input.miniBlockNumber}`,
    MARGIN,
    54,
  );

  for (let index = 0; index < panels.length; index += 1) {
    const panel = panels[index];
    const row = Math.floor(index / COLUMNS);
    const column = index % COLUMNS;
    const x = MARGIN + column * (PANEL_WIDTH + GAP);
    const y = HEADER_HEIGHT + MARGIN + row * (PANEL_HEIGHT + GAP);
    const image = await localImage(panel.assetUrl);
    try {
      drawCover(context, image, x, y, PANEL_WIDTH, PANEL_HEIGHT);
      drawPanelOverlay(context, panel, x, y);
    } finally {
      image.close();
    }
  }

  const blob = await webpBlob(canvas);
  return Object.freeze({ blob, panelCount: panels.length, width, height });
}

function requestedAddress() {
  if (typeof window === "undefined") return { blockNumber: 1, miniBlockNumber: 1 };
  const query = new URLSearchParams(window.location.search);
  const blockNumber = Math.min(24, Math.max(1, Number(query.get("block") || 1) || 1));
  const miniBlockNumber = Math.min(4, Math.max(1, Number(query.get("mini") || 1) || 1));
  return { blockNumber, miniBlockNumber };
}

function preservePrevisAddress(blockNumber: number, miniBlockNumber: number) {
  const url = new URL(window.location.href);
  url.searchParams.set("block", String(blockNumber));
  url.searchParams.set("mini", String(miniBlockNumber));
  window.history.replaceState(window.history.state, "", url);
}

const STATE_LABELS = {
  defined: "DEFINED",
  observed: "OBSERVED",
  emerging: "EMERGING",
  missing: "AVAILABLE",
  locked: "BLOCKED",
} as const;

function graphicNovelTextSourceKey(panel: PrevisGraphicNovelPanel, passages: unknown) {
  return JSON.stringify({
    passages,
    assetUrl: panel.assetUrl,
    caption: panel.caption,
    narration: panel.narration,
    shotLabel: panel.shotLabel,
    shotContext: panel.shotContext,
    bubbles: panel.bubbles.map((bubble) => ({ speaker: bubble.speaker, text: bubble.text })),
  });
}

function approvedGraphicNovelPanel(
  panel: PrevisGraphicNovelPanel,
  approval: PrevisGraphicNovelTextApproval,
): PrevisGraphicNovelPanel {
  if (approval.noText) {
    return { ...panel, caption: "", narration: "", shotLabel: "", shotContext: "", bubbles: [] };
  }
  return {
    ...panel,
    caption: "", shotLabel: "", shotContext: "",
    narration: approval.narration,
    bubbles: approval.bubbles.map((bubble) => ({ ...bubble, style: "speech" as const })),
  };
}

export default function PrevisReadinessWorkspace({
  project,
  onProjectChange,
  onOpenStoryboard,
  address,
  onAddressChange,
  embeddedNavigation = false,
}: {
  readonly project: PPFProject;
  readonly onProjectChange: (project: PPFProject) => void;
  readonly onOpenStoryboard: (anchor?: PrevisAnchorProjection) => void;
  readonly address?: { readonly blockNumber: number; readonly miniBlockNumber: number };
  readonly onAddressChange?: (address: { blockNumber: number; miniBlockNumber: number }) => void;
  readonly embeddedNavigation?: boolean;
}) {
  const projection = useMemo(() => derivePrevisProjection(project), [project]);
  const [selectedBlockNumber, setSelectedBlockNumber] = useState(() => address?.blockNumber ?? requestedAddress().blockNumber);
  const [selectedMiniBlockNumber, setSelectedMiniBlockNumber] = useState(() => address?.miniBlockNumber ?? requestedAddress().miniBlockNumber);
  const [selectedFramePosition, setSelectedFramePosition] = useState(1);
  const [flipBookPlaying, setFlipBookPlaying] = useState(false);
  const [graphicNovelMode, setGraphicNovelMode] = useState(false);
  const [graphicNovelPlaying, setGraphicNovelPlaying] = useState(false);
  const [narrationGenerating, setNarrationGenerating] = useState(false);
  const narrationRequest = useRef<AbortController | null>(null);
  const latestSource = useRef("");
  const latestProject = useRef(project);
  latestProject.current = project;
  useEffect(() => {
    if (!address) return;
    setSelectedBlockNumber(address.blockNumber);
    setSelectedMiniBlockNumber(address.miniBlockNumber);
  }, [address?.blockNumber, address?.miniBlockNumber]);
  const [message, setMessage] = useState("");
  const selectedBlock = projection.blocks.find((block) => block.blockNumber === selectedBlockNumber)
    ?? projection.blocks[0]
    ?? null;
  const selectedAddressAnchor = selectedBlock?.anchors.find((anchor) => anchor.miniBlockNumber === selectedMiniBlockNumber)
    ?? selectedBlock?.anchors[0]
    ?? null;
  const selectedAct = Math.ceil(selectedBlockNumber / 6);
  const actBlocks = projection.blocks.filter((block) => Math.ceil(block.blockNumber / 6) === selectedAct);
  const acceptedVisualIds = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const activeFrameArtifacts = selectedAddressAnchor
    ? project.build.foundations.visualArtifacts
      .filter((artifact) => artifact.workflow === "storyboard-frame-webp-v2"
        && artifact.reviewState !== "rejected"
        && (artifact.sourceDecisionKeys ?? []).includes(selectedAddressAnchor.id))
    : [];
  const flipBookFrames = Array.from({ length: 25 }, (_, index) => {
    const position = index + 1;
    const artifacts = activeFrameArtifacts
      .filter((artifact) => artifact.frameNumber === position)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const locked = artifacts.find((artifact) => acceptedVisualIds.has(artifact.id) && artifact.reviewState === "accepted") ?? null;
    const candidate = artifacts[0] ?? null;
    return {
      position,
      locked,
      candidate,
      visual: locked ?? candidate,
      state: locked ? "locked" as const : candidate ? "review" as const : "empty" as const,
    };
  });
  const selectedFlipBookFrame = flipBookFrames[selectedFramePosition - 1];
  const lockedFrameCount = flipBookFrames.filter((frame) => frame.locked).length;
  const availableStoryboardImageCount = flipBookFrames.filter((frame) => frame.visual).length;
  const selectedFrameEvidence = selectedAddressAnchor
    ? storyboardAnchorEvidence(project, selectedAddressAnchor.targetId, selectedAddressAnchor.miniBlockNumber)
    : null;
  const selectedFrameSceneNumbers = [...new Set((selectedFrameEvidence?.passages ?? []).map((passage) => passage.sceneNumber).filter(Boolean))];
  const selectedFrameProgression = storyboardPositionProgression(selectedFramePosition);

  function graphicNovelPanelFor(position: number): PrevisGraphicNovelPanel {
    const frame = flipBookFrames[position - 1];
    const progression = storyboardPositionProgression(position);
    return buildPrevisGraphicNovelPanel({
      position,
      assetUrl: frame?.locked?.assetUrl ?? "",
      authoritative: Boolean(frame?.locked),
      narrativeIntention: frame?.locked?.narrativeIntention ?? "",
      sceneNumbers: selectedFrameSceneNumbers.map((number) => String(number)),
      beatLabel: progression.label,
      beatDirection: progression.direction,
      shotLabel: `Shot ${String(position).padStart(2, "0")} of 25`,
      shotContext: "~3-second planning target",
      passages: selectedFrameEvidence?.passages ?? [],
    });
  }

  const graphicNovelPanels = flipBookFrames.map((frame) => graphicNovelPanelFor(frame.position));
  const graphicNovelTextApprovals = (project.production.graphicNovelTextApprovals ?? [])
    .filter((approval) => approval.anchorRef === selectedAddressAnchor?.id);
  const currentTextApprovalFor = (panel: PrevisGraphicNovelPanel) => {
    const approval = graphicNovelTextApprovals.find((candidate) => candidate.position === panel.position) ?? null;
    return approval && approval.sourceKey === graphicNovelTextSourceKey(panel, selectedFrameEvidence?.passages) ? approval : null;
  };
  const selectedGraphicNovelPanel = graphicNovelPanels[selectedFramePosition - 1];
  const selectedGraphicNovelApproval = currentTextApprovalFor(selectedGraphicNovelPanel);
  const selectedGraphicNovelDisplayPanel = selectedGraphicNovelApproval
    ? approvedGraphicNovelPanel(selectedGraphicNovelPanel, selectedGraphicNovelApproval)
    : { ...selectedGraphicNovelPanel, caption: "", narration: "", shotLabel: "", shotContext: "", bubbles: [] };
  const selectedGraphicNovelHasText = Boolean(
    selectedGraphicNovelDisplayPanel.caption
    || selectedGraphicNovelDisplayPanel.narration
    || selectedGraphicNovelDisplayPanel.shotLabel
    || selectedGraphicNovelDisplayPanel.shotContext
    || selectedGraphicNovelDisplayPanel.bubbles.length,
  );
  const lockedGraphicNovelPanels = graphicNovelPanels.filter((panel) => panel.authoritative && panel.assetUrl);
  const narrationSource = JSON.stringify({ projectId: project.id, anchor: selectedAddressAnchor?.id,
    passages: selectedFrameEvidence?.passages, panels: lockedGraphicNovelPanels.map((panel) => graphicNovelTextSourceKey(panel, selectedFrameEvidence?.passages)) });
  latestSource.current = narrationSource;

  async function playNarration() {
    if (graphicNovelPlaying) { setGraphicNovelPlaying(false); return; }
    if (!selectedAddressAnchor || !lockedGraphicNovelPanels.length || narrationGenerating) return;
    setFlipBookPlaying(false);
    setGraphicNovelMode(true);
    if (lockedGraphicNovelPanels.every((panel) => currentTextApprovalFor(panel))) {
      setSelectedFramePosition(lockedGraphicNovelPanels[0].position);
      setGraphicNovelPlaying(true);
      return;
    }
    const source = narrationSource;
    const controller = new AbortController();
    narrationRequest.current = controller;
    setNarrationGenerating(true);
    setMessage("Creating story narration for the locked image sequence…");
    try {
      const response = await fetch("/api/previs/narration", {
        method: "POST", credentials: "same-origin", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passages: selectedFrameEvidence?.passages ?? [],
          panels: lockedGraphicNovelPanels.map((panel) => ({ position: panel.position,
            intention: flipBookFrames[panel.position - 1].locked?.narrativeIntention ?? "", sourceKey: graphicNovelTextSourceKey(panel, selectedFrameEvidence?.passages) })) }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Narration generation failed.");
      if (latestSource.current !== source || controller.signal.aborted) return;
      if (latestProject.current !== project) {
        setMessage("The project changed while narration was being created. Play with narration again to use the latest project.");
        return;
      }
      const now = new Date().toISOString();
      const approvals: PrevisGraphicNovelTextApproval[] = result.panels.map((panel: { position: number; narration: string; bubbles: PrevisGraphicNovelTextBubble[] }) => ({
        anchorRef: selectedAddressAnchor.id, position: panel.position,
        sourceKey: graphicNovelTextSourceKey(graphicNovelPanels[panel.position - 1], selectedFrameEvidence?.passages),
        narration: panel.narration, bubbles: panel.bubbles,
        noText: !panel.narration && !panel.bubbles.length, approvedAt: now,
      }));
      const next: PPFProject = { ...project, revision: project.revision + 1, updatedAt: now,
        production: { ...project.production, graphicNovelTextApprovals: [
          ...(project.production.graphicNovelTextApprovals ?? []).filter((item) => item.anchorRef !== selectedAddressAnchor.id), ...approvals,
        ] } };
      saveFoundationProject(next);
      onProjectChange(next);
      setSelectedFramePosition(lockedGraphicNovelPanels[0].position);
      setGraphicNovelPlaying(true);
      setMessage("Story narration saved. Playing locked images with text.");
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Narration generation failed.");
    } finally {
      if (narrationRequest.current === controller) { narrationRequest.current = null; setNarrationGenerating(false); }
    }
  }

  useEffect(() => {
    setSelectedFramePosition(1);
    setFlipBookPlaying(false);
    setGraphicNovelMode(false);
    setGraphicNovelPlaying(false);
    narrationRequest.current?.abort();
    narrationRequest.current = null;
    setNarrationGenerating(false);
  }, [project.id, selectedBlockNumber, selectedMiniBlockNumber]);

  useEffect(() => () => narrationRequest.current?.abort(), []);

  useEffect(() => {
    if (!flipBookPlaying && !graphicNovelPlaying) return;
    const timer = window.setInterval(() => {
      const positions = flipBookFrames.filter((frame) => frame.locked).map((frame) => frame.position);
      if (!positions.length) { setFlipBookPlaying(false); setGraphicNovelPlaying(false); return; }
      setSelectedFramePosition((position) => positions[(positions.indexOf(position) + 1) % positions.length]);
    }, graphicNovelPlaying ? PREVIS_GRAPHIC_NOVEL_INTERVAL_MS : PREVIS_FLIP_BOOK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [flipBookPlaying, graphicNovelPlaying, narrationSource]);

  return (
    <main className={styles.workspace} aria-labelledby="previs-title">
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Previs · 25 planned Shots → Flip Book / Graphic Novel</span>
          <h1 id="previs-title">Previs · {project.title || "Untitled Story"}</h1>
          <p>
            Previs presents the visual story already approved in Storyboard. It plays the same 25 planned Shots for the selected Mini-Block, keeps Scene and Beat evidence visible for context, and does not create a second Shot or image-authoring layer.
          </p>
        </div>
        <dl className={styles.summary}>
          <div><dt>Project</dt><dd>{project.title}</dd></div>
          <div><dt>PPF revision</dt><dd>{projection.projectRevision}</dd></div>
          <div><dt>Structure</dt><dd>4 Acts · 24 Blocks · 96 Mini-Blocks</dd></div>
          <div><dt>Planned Shots</dt><dd>2,400</dd></div>
          <div><dt>Selected Mini-Block</dt><dd>25 Shots · ~75 sec</dd></div>
        </dl>
      </header>

      <section className={styles.notice} aria-label="Previs authority boundary">
        <div>
          <strong>Storyboard owns the 25 planned Shots and their locked Storyboard Images.</strong>
          <span>Previs reads and presents those approved choices. To replace an image, return to Storyboard, generate or choose the replacement there, and lock it there; Previs then reflects the approved result.</span>
        </div>
      </section>

      {!embeddedNavigation ? (
        <>
          <nav aria-label="Previs Acts" className={styles.actRail} role="tablist">
            {[1, 2, 3, 4].map((act) => (
              <button
                aria-selected={selectedAct === act}
                className={styles.actTab}
                key={act}
                onClick={() => {
                  const firstBlock = (act - 1) * 6 + 1;
                  setSelectedBlockNumber(firstBlock);
                  setSelectedMiniBlockNumber(1);
                  preservePrevisAddress(firstBlock, 1);
                  onAddressChange?.({ blockNumber: firstBlock, miniBlockNumber: 1 });
                }}
                role="tab"
                type="button"
              >
                Act {act}
              </button>
            ))}
          </nav>
          <nav aria-label={`Act ${selectedAct} Previs Block tabs`} className={styles.tabRail} role="tablist">
            {actBlocks.map((block) => {
              const selected = block.blockNumber === selectedBlock?.blockNumber;
              return (
                <button
                  aria-controls="previs-block-panel"
                  aria-label={`Block ${String(block.blockNumber).padStart(2, "0")}, ${STATE_LABELS[block.state]}`}
                  aria-selected={selected}
                  className={styles.blockTab}
                  data-state={block.state}
                  key={block.targetId}
                  onClick={() => {
                    setSelectedBlockNumber(block.blockNumber);
                    setSelectedMiniBlockNumber(1);
                    preservePrevisAddress(block.blockNumber, 1);
                    onAddressChange?.({ blockNumber: block.blockNumber, miniBlockNumber: 1 });
                  }}
                  role="tab"
                  type="button"
                >
                  <i aria-hidden="true" className={styles.stateLight} />
                  <span>Block {block.blockNumber - (selectedAct - 1) * 6}</span>
                </button>
              );
            })}
          </nav>
        </>
      ) : null}

      {selectedBlock ? (
        <section
          aria-label={`Block ${String(selectedBlock.blockNumber).padStart(2, "0")} Previs workspace`}
          className={styles.blockWorkspace}
          data-state={selectedBlock.state}
          id="previs-block-panel"
          role="tabpanel"
        >
          <header className={styles.blockHeader}>
            <div>
              <p className={styles.blockKicker}>Block {String(selectedBlock.blockNumber).padStart(2, "0")}</p>
              <h2>{selectedBlock.label.replace(/^Block \d+: /, "")}</h2>
              <p>Four canonical Mini-Blocks preserve story provenance. Each Mini-Block carries exactly 25 planned Storyboard Shots, approximately 3 seconds per Shot, for an approximately 75-second planning target.</p>
            </div>
            <span aria-label={`Status: ${STATE_LABELS[selectedBlock.state]}`} className={styles.blockState} data-state={selectedBlock.state}>
              <i aria-hidden="true" className={styles.stateLight} />
              <strong>{STATE_LABELS[selectedBlock.state]}</strong>
            </span>
          </header>

          <div className={styles.anchorGrid} aria-label={`Block ${selectedBlock.blockNumber} Previs anchors`}>
            {selectedBlock.anchors.map((anchor) => (
              <article
                className={styles.anchorCard}
                data-selected={selectedMiniBlockNumber === anchor.miniBlockNumber ? "true" : undefined}
                data-state={anchor.state}
                key={anchor.id}
              >
                <div className={styles.videoFrame}>
                  {anchor.storyboardAssetUrl
                    ? <img alt={`Storyboard visual anchor for ${selectedBlock.blockNumber}.${anchor.miniBlockNumber}`} decoding="async" loading="lazy" src={anchor.storyboardAssetUrl} />
                    : <span className={styles.emptyVideo}>VIDEO / ANIMATIC</span>}
                  <span className={styles.videoBadge}>{anchor.storyboardCoverage === "kept" ? "STORYBOARD READY" : anchor.storyboardCoverage === "candidate" ? "STORYBOARD CANDIDATE" : "STORYBOARD NEEDED"}</span>
                </div>
                <header className={styles.anchorHeader}>
                  <div>
                    <span>Mini-Block</span>
                    <strong>{selectedBlock.blockNumber}.{anchor.miniBlockNumber}</strong>
                  </div>
                  <button
                    aria-pressed={selectedMiniBlockNumber === anchor.miniBlockNumber}
                    onClick={() => {
                      setSelectedMiniBlockNumber(anchor.miniBlockNumber);
                      preservePrevisAddress(selectedBlock.blockNumber, anchor.miniBlockNumber);
                      onAddressChange?.({ blockNumber: selectedBlock.blockNumber, miniBlockNumber: anchor.miniBlockNumber });
                    }}
                    type="button"
                  >Select</button>
                  <span aria-label={`Status: ${STATE_LABELS[anchor.state]}`} className={styles.anchorState} data-state={anchor.state}>
                    <i aria-hidden="true" className={styles.stateLight} />
                    <b>{STATE_LABELS[anchor.state]}</b>
                  </span>
                </header>
                <p>Select this Mini-Block to review the approved visual sequence and its story evidence.</p>
                <dl className={styles.anchorMeta}>
                  <div><dt>Storyboard anchor</dt><dd>{anchor.storyboardCoverage === "kept" ? "Kept" : anchor.storyboardCoverage === "candidate" ? "Candidate" : "Missing"}</dd></div>
                  <div><dt>Planned Shots</dt><dd>25</dd></div>
                  <div><dt>Planning target</dt><dd>~75 sec · ~3 sec per Shot</dd></div>
                </dl>
              </article>
            ))}
          </div>

          {selectedAddressAnchor ? (
            <section className={styles.flipBook} aria-labelledby="previs-flipbook-title" data-previs-flipbook="25-positions">
              <header className={styles.flipBookHeader}>
                <div>
                  <span className={styles.eyebrow}>Locked Storyboard sequence</span>
                  <h3 id="previs-flipbook-title">Flip Book · Mini-Block {selectedAddressAnchor.blockNumber}.{selectedAddressAnchor.miniBlockNumber}</h3>
                  <p>Play the same 25 planned Shots from Storyboard in order. Locked Storyboard Images are authoritative Previs inputs; unlocked candidates remain visible only as review context.</p>
                </div>
                <strong>{lockedFrameCount}/25 locked Storyboard Images</strong>
              </header>

              <div className={styles.flipBookViewer}>
                <div className={styles.flipBookStage} data-frame-state={selectedFlipBookFrame.locked ? "locked" : selectedFlipBookFrame.candidate ? "review" : "empty"}>
                  {selectedFlipBookFrame.locked ? (
                    <img
                      alt={selectedFlipBookFrame.locked.narrativeIntention || `Locked Storyboard Image for Shot ${selectedFramePosition}`}
                      decoding="async"
                      src={selectedFlipBookFrame.locked.assetUrl}
                    />
                  ) : (
                    <div className={styles.flipBookBlocked}>
                      <strong>Shot {String(selectedFramePosition).padStart(2, "0")} of 25 is not locked for Previs.</strong>
                      <span>{selectedFlipBookFrame.candidate ? "A Storyboard Image candidate exists, but Lock is required in Storyboard before it enters the Flip Book." : "No Storyboard Image is available for this planned Shot yet."}</span>
                    </div>
                  )}
                  {graphicNovelMode && selectedGraphicNovelHasText ? (
                    <>
                      {selectedGraphicNovelDisplayPanel.bubbles.length ? (
                        <div className={styles.graphicNovelBubbles} aria-label="Observed screenplay dialogue">
                          {selectedGraphicNovelDisplayPanel.bubbles.map((bubble, index) => (
                            <blockquote
                              className={styles.graphicNovelBubble}
                              data-bubble-side={index % 2 === 0 ? "left" : "right"}
                              key={`${bubble.speaker}-${index}`}
                            >
                              <strong>{bubble.speaker}</strong>
                              <p>{bubble.text}</p>
                            </blockquote>
                          ))}
                        </div>
                      ) : null}
                      <aside className={styles.graphicNovelCaption} aria-live="polite">
                        <small>{selectedGraphicNovelDisplayPanel.caption}</small>
                        <strong>{selectedGraphicNovelDisplayPanel.narration}</strong>
                        <span>{selectedGraphicNovelDisplayPanel.shotLabel}{selectedGraphicNovelDisplayPanel.shotContext ? ` · ${selectedGraphicNovelDisplayPanel.shotContext}` : ""}</span>

                      </aside>
                    </>
                  ) : null}
                  <span className={styles.flipBookCounter}>Shot {String(selectedFramePosition).padStart(2, "0")} of 25</span>
                </div>

                <div className={styles.flipBookControls} aria-label="Previs presentation playback">
                  <button type="button" onClick={() => {
                    setFlipBookPlaying(false);
                    setGraphicNovelPlaying(false);
                    setSelectedFramePosition((position) => position <= 1 ? 25 : position - 1);
                  }}>Previous</button>
                  <button aria-pressed={flipBookPlaying} disabled={!lockedFrameCount || narrationGenerating} type="button" onClick={() => {
                    setGraphicNovelMode(false);
                    setGraphicNovelPlaying(false);
                    if (!flipBookPlaying) setSelectedFramePosition(flipBookFrames.find((frame) => frame.locked)?.position ?? 1);
                    setFlipBookPlaying((playing) => !playing);
                  }}>{flipBookPlaying ? "Pause Flip Book" : "Play Flip Book"}</button>
                  <button aria-pressed={graphicNovelMode} disabled={!lockedFrameCount || narrationGenerating} type="button" onClick={() => void playNarration()}>{narrationGenerating ? "Creating narration…" : graphicNovelPlaying ? "Pause Narration" : "Play with Narration"}</button>
                  <button type="button" onClick={() => onOpenStoryboard(selectedAddressAnchor)}>Open owning Storyboard Mini-Block</button>
                  <button type="button" onClick={() => {
                    setFlipBookPlaying(false);
                    setGraphicNovelPlaying(false);
                    setSelectedFramePosition((position) => position >= 25 ? 1 : position + 1);
                  }}>Next</button>
                </div>
              </div>

              <div className={styles.flipBookStrip} aria-label="25 planned Previs Shots">
                {flipBookFrames.map((frame) => (
                  <button
                    aria-current={frame.position === selectedFramePosition ? "true" : undefined}
                    aria-label={`Shot ${frame.position} of 25, ${frame.locked ? "locked Storyboard Image" : frame.candidate ? "unlocked Storyboard Image candidate" : "missing Storyboard Image"}`}
                    data-frame-state={frame.state}
                    key={frame.position}
                    onClick={() => {
                      setFlipBookPlaying(false);
                      setGraphicNovelPlaying(false);
                      setSelectedFramePosition(frame.position);
                    }}
                    type="button"
                  >
                    {frame.visual
                      ? <img alt="" aria-hidden="true" decoding="async" loading="lazy" src={frame.visual.assetUrl} />
                      : <span className={styles.flipBookEmpty}>—</span>}
                    <strong>{String(frame.position).padStart(2, "0")}</strong>
                    <small>{frame.locked ? "LOCKED" : frame.candidate ? "REVIEW" : "EMPTY"}</small>
                  </button>
                ))}
              </div>

              <div className={styles.flipBookDetail} aria-label={`Previs detail for Shot ${selectedFramePosition} of 25`}>
                <article>
                  <span>Story evidence</span>
                  <strong>{selectedFrameSceneNumbers.length ? selectedFrameSceneNumbers.map((number) => `Scene ${number}`).join(" · ") : "No mapped Scene"}</strong>
                  <p>{selectedFrameEvidence?.passages.length ? `${selectedFrameEvidence.passages.length} screenplay passage${selectedFrameEvidence.passages.length === 1 ? "" : "s"} support this Mini-Block.` : "Previs will not invent a Scene where screenplay evidence is missing."}</p>
                  <small>Beat context · {selectedFrameProgression.label} · {selectedFrameProgression.direction}</small>
                </article>
                <article>
                  <span>Planned Shot</span>
                  <strong>Shot {String(selectedFramePosition).padStart(2, "0")} of 25 · ~3-second planning target</strong>
                  <p>This is the same Storyboard-owned planned Shot; Previs does not create or renumber it.</p>
                </article>
                <article>
                  <span>Storyboard Image</span>
                  <strong>{selectedFlipBookFrame.locked ? "Locked / approved" : selectedFlipBookFrame.candidate ? "Candidate · lock in Storyboard" : "Missing"}</strong>
                  <p>{selectedFlipBookFrame.locked?.narrativeIntention || selectedFlipBookFrame.candidate?.narrativeIntention || "No Storyboard Image is attached to this planned Shot."}</p>
                </article>
              </div>
            </section>
          ) : null}

          {selectedAddressAnchor ? (
            <section className={styles.evidencePanel} id="previs-selected-evidence" aria-label="Selected Previs anchor source and Storyboard provenance">
              <header>
                <div>
                  <span>Selected story address</span>
                  <h3>Block {String(selectedAddressAnchor.blockNumber).padStart(2, "0")} · Mini-Block {selectedAddressAnchor.miniBlockNumber}</h3>
                </div>
                <strong>{selectedAddressAnchor.storyboardCoverage === "kept" ? "KEPT STORYBOARD" : selectedAddressAnchor.storyboardCoverage === "candidate" ? "CANDIDATE STORYBOARD" : "NO STORYBOARD VISUAL"}</strong>
              </header>
              <div className={styles.evidenceGrid}>
                <div>
                  <b>Written / structural evidence</b>
                  <p>{selectedAddressAnchor.sourcePassageCount} screenplay passage{selectedAddressAnchor.sourcePassageCount === 1 ? "" : "s"} · {selectedAddressAnchor.sourceSceneCount} scene{selectedAddressAnchor.sourceSceneCount === 1 ? "" : "s"}</p>
                  <p>{selectedAddressAnchor.structuralResponsibility || "No structural responsibility is recorded for this address."}</p>
                  <small>Human structural finding: {selectedAddressAnchor.structuralFinding.replaceAll("-", " / ")}</small>
                </div>
                <div>
                  <b>Storyboard provenance</b>
                  <p>{selectedAddressAnchor.storyboardSourceKind
                    ? selectedAddressAnchor.storyboardSourceKind === "historical-storyboard"
                      ? "Historical Storyboard reference candidate"
                      : "PlotPickle replacement concept candidate"
                    : selectedAddressAnchor.storyboardCoverage === "kept"
                      ? "Human-kept PPF visual"
                      : "No visual candidate"}</p>
                  <small>{selectedAddressAnchor.storyboardProvenanceRefs.length} candidate provenance refs · {selectedAddressAnchor.acceptedVisualRefs.length} accepted target-scoped visual refs</small>
                </div>
                <div>
                  <b>Previs coverage</b>
                  <p>{availableStoryboardImageCount}/25 Storyboard Images available · {lockedFrameCount}/25 locked / approved</p>
                  <small>Previs preserves Shot 01–25 exactly as Storyboard defines them.</small>
                </div>
              </div>
              <div className={styles.mappingRefs}>
                {selectedAddressAnchor.sourceMappings.map((mapping) => (
                  <small key={`${mapping.sourceVersion}:${mapping.sourceRef}`}>
                    {mapping.sourceVersion.toUpperCase()} · {mapping.sourceRole.replaceAll("-", " ")} · {mapping.mappingMethod.replaceAll("-", " ")}
                    {mapping.candidateOnly ? " · comparison only" : ""} · {mapping.sourceRef}
                  </small>
                ))}
              </div>
              <p className={styles.evidenceBoundary}>Scene and Beat remain source context. If a Storyboard Image is wrong or missing, correct and lock it in Storyboard; Previs does not generate or approve the replacement.</p>
            </section>
          ) : null}
        </section>
      ) : null}

      <p className={styles.message} role="status">{message}</p>
      <footer className={styles.footer}>
        Canonical planning math: 1 Mini-Block = 25 planned Shots = approximately 75 seconds = approximately 1,800 final video frames at 24 fps. These are planning targets; actual rendered duration and frame count remain downstream.
      </footer>
    </main>
  );
}
