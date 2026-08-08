"use client";

import { useEffect } from "react";
import { buildGlobalSceneIndex } from "@/lib/scene-management";
import { createBlankProject, normalizePlotPickleProject, type PlotPickleProject } from "@/lib/project";

const STORAGE_KEY = "plotpickle.project.v1";

type BuildSourceKind = "screenplay" | "storyboard" | "graphic-novel" | "shot" | "audio";
type BuildSourceItem = { id: string; kind: BuildSourceKind; title: string; detail: string; sourceId: string };
type BuildReviewState = { order: string[] };

type BuildApprovalRecord = {
  id: string;
  blockNumber: number;
  miniBlockNumber: number;
  sceneId: string;
  sourceIds: string[];
  approvedAt: string;
};

function requestedNumber(name: string, fallback: number, minimum: number, maximum: number) {
  const value = Number(new URLSearchParams(window.location.search).get(name));
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function loadProject() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return createBlankProject();
    return normalizePlotPickleProject(JSON.parse(stored)) ?? createBlankProject();
  } catch {
    return createBlankProject();
  }
}

function addText(parent: HTMLElement, tag: keyof HTMLElementTagNameMap, text: string, className?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function approvedVariation(project: PlotPickleProject, assetRef: { assetId: string; variationId: string } | undefined) {
  if (!assetRef) return false;
  const asset = project.assets.assets.find((item) => item.id === assetRef.assetId);
  return asset?.approvedVariationId === assetRef.variationId;
}

function sourceItems(project: PlotPickleProject, blockNumber: number, miniBlockNumber: number, sceneId: string) {
  const block = project.blocks[blockNumber - 1] ?? project.blocks[0];
  const items: BuildSourceItem[] = [];
  const screenplay = project.screenplay.draftElements.filter((element) => element.blockNumber === blockNumber && element.miniBlockNumber === miniBlockNumber && !element.omitted);
  if (screenplay.length) {
    items.push({
      id: `screenplay:${blockNumber}:${miniBlockNumber}`,
      kind: "screenplay",
      title: "Canonical screenplay",
      detail: `${screenplay.length} screenplay element${screenplay.length === 1 ? "" : "s"} from this exact story moment`,
      sourceId: screenplay.map((item) => item.id).join(","),
    });
  }

  for (const frame of block?.visuals.filter((item) => item.miniBlockNumber === miniBlockNumber && item.approvedImageVersionId) ?? []) {
    items.push({ id: `storyboard:${frame.id}`, kind: "storyboard", title: frame.caption || frame.alt || "Approved Storyboard visual", detail: frame.shot || frame.continuity || "Approved visual direction", sourceId: frame.id });
  }

  for (const panel of project.review.pitchPackage.comicDeck?.panels.filter((item) => item.blockNumber === blockNumber && item.miniBlockNumber === miniBlockNumber && approvedVariation(project, item.assetRef)) ?? []) {
    items.push({ id: `graphic-novel:${panel.id}`, kind: "graphic-novel", title: panel.title || `Graphic Novel panel ${panel.pageNumber}.${panel.panelNumber}`, detail: panel.shotDirection || panel.narration || "Approved Graphic Novel composition", sourceId: panel.id });
  }

  for (const shot of project.production.shots.filter((item) => item.blockNumber === blockNumber && item.miniBlockNumber === miniBlockNumber && item.status !== "omitted")) {
    items.push({ id: `shot:${shot.id}`, kind: "shot", title: `Shot ${shot.shotNumber} · ${shot.shotSize || "Planned shot"}`, detail: `${shot.durationSeconds || 0}s · ${shot.purpose || shot.composition || "Production shot"}`, sourceId: shot.id });
  }

  for (const cue of project.production.cues.filter((item) => item.blockNumber === blockNumber && (!sceneId || item.sceneId === sceneId))) {
    items.push({ id: `audio:${cue.id}`, kind: "audio", title: cue.title || `Audio cue ${cue.cueNumber}`, detail: `${cue.type} · ${cue.durationSeconds || 0}s · ${cue.purpose || cue.motif || "Audio cue"}`, sourceId: cue.id });
  }
  return items;
}

function returnUrl(item: BuildSourceItem, blockNumber: number, miniBlockNumber: number) {
  if (item.kind === "screenplay") return `/edit?block=${blockNumber}&mini=${miniBlockNumber}`;
  if (item.kind === "storyboard") return `/?workspace=storyboard&block=${blockNumber}&mini=${miniBlockNumber}`;
  if (item.kind === "graphic-novel") return `/?workspace=pitch&block=${blockNumber}&mini=${miniBlockNumber}`;
  return `/?workspace=build&block=${blockNumber}&mini=${miniBlockNumber}`;
}

function approvalRecords(project: PlotPickleProject) {
  const value = project.extensions?.buildSequenceApprovals;
  return Array.isArray(value) ? value.filter((item): item is BuildApprovalRecord => Boolean(item && typeof item === "object")) : [];
}

function approveSequence(project: PlotPickleProject, blockNumber: number, miniBlockNumber: number, sceneId: string, ordered: BuildSourceItem[]) {
  const approvedAt = new Date().toISOString();
  const approval: BuildApprovalRecord = {
    id: `build-${blockNumber}-${miniBlockNumber}-${Date.now()}`,
    blockNumber,
    miniBlockNumber,
    sceneId,
    sourceIds: ordered.map((item) => item.sourceId).filter(Boolean),
    approvedAt,
  };
  return {
    ...project,
    metadata: { ...project.metadata, updatedAt: approvedAt },
    production: {
      ...project.production,
      shots: project.production.shots.map((shot) => shot.blockNumber === blockNumber && shot.miniBlockNumber === miniBlockNumber && shot.status === "planned"
        ? { ...shot, status: "approved" as const, updatedAt: approvedAt }
        : shot),
    },
    extensions: {
      ...project.extensions,
      buildSequenceApprovals: [...approvalRecords(project), approval],
    },
  } satisfies PlotPickleProject;
}

function buildAssembly(root: HTMLElement) {
  const existing = root.querySelector<HTMLElement>("[data-build-assembly-studio]");
  if (existing) return;
  const project = loadProject();
  const blockNumber = requestedNumber("block", 1, 1, 24);
  const miniBlockNumber = requestedNumber("mini", 1, 1, 4);
  const sceneIndex = buildGlobalSceneIndex(project.blocks);
  const sceneEntry = sceneIndex.find((entry) => entry.blockNumber === blockNumber && entry.miniBlockNumbers.includes(miniBlockNumber))
    ?? sceneIndex.find((entry) => entry.blockNumber === blockNumber);
  const sceneId = sceneEntry?.sceneId || "";
  const items = sourceItems(project, blockNumber, miniBlockNumber, sceneId);
  const reviewKey = `plotpickle.buildReview.${project.id}.${blockNumber}.${miniBlockNumber}`;
  let review: BuildReviewState = { order: [] };
  try { review = JSON.parse(window.sessionStorage.getItem(reviewKey) || "{\"order\":[]}"); } catch { review = { order: [] }; }
  const availableIds = new Set(items.map((item) => item.id));
  let order = [...review.order.filter((id) => availableIds.has(id)), ...items.map((item) => item.id).filter((id) => !review.order.includes(id))];

  const assembly = document.createElement("section");
  assembly.dataset.buildAssemblyStudio = "true";
  assembly.className = "build-assembly-studio";

  const header = document.createElement("div");
  header.className = "build-assembly-heading";
  addText(header, "span", "Build sequence · Candidate until approved", "build-studio-eyebrow");
  addText(header, "h2", `Assemble Block ${blockNumber} · Mini ${blockNumber}.${miniBlockNumber}`);
  addText(header, "p", "Arrange approved source material, preview the sequence, then approve it explicitly. Source screenplay and visual canon remain unchanged.");
  assembly.appendChild(header);

  const body = document.createElement("div");
  body.className = "build-assembly-body";
  const sourceColumn = document.createElement("div");
  sourceColumn.className = "build-source-stack";
  addText(sourceColumn, "h3", "Approved source material");
  const preview = document.createElement("div");
  preview.className = "build-sequence-preview";
  addText(preview, "h3", "Sequence preview");
  const previewList = document.createElement("ol");
  preview.appendChild(previewList);
  const status = addText(preview, "p", "Sequence is a candidate. Canon has not changed.", "build-assembly-status");

  function orderedItems() {
    return order.flatMap((id) => items.find((item) => item.id === id) ?? []);
  }

  function saveOrder() {
    window.sessionStorage.setItem(reviewKey, JSON.stringify({ order } satisfies BuildReviewState));
  }

  function render() {
    sourceColumn.querySelectorAll("article").forEach((node) => node.remove());
    previewList.replaceChildren();
    const ordered = orderedItems();
    ordered.forEach((item, index) => {
      const card = document.createElement("article");
      card.dataset.sourceKind = item.kind;
      const copy = document.createElement("div");
      addText(copy, "strong", item.title);
      addText(copy, "span", item.detail);
      addText(copy, "small", `${item.kind} · source ${item.sourceId}`);
      card.appendChild(copy);
      const controls = document.createElement("div");
      for (const [label, delta] of [["Up", -1], ["Down", 1]] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.disabled = index + delta < 0 || index + delta >= ordered.length;
        button.addEventListener("click", () => {
          const target = index + delta;
          const next = [...order];
          [next[index], next[target]] = [next[target], next[index]];
          order = next;
          saveOrder();
          status.textContent = "Sequence order changed. Canon remains unchanged until Approve sequence.";
          render();
        });
        controls.appendChild(button);
      }
      const sendBack = document.createElement("button");
      sendBack.type = "button";
      sendBack.textContent = "Send back";
      sendBack.addEventListener("click", () => window.location.assign(returnUrl(item, blockNumber, miniBlockNumber)));
      controls.appendChild(sendBack);
      card.appendChild(controls);
      sourceColumn.appendChild(card);

      const line = document.createElement("li");
      addText(line, "strong", `${index + 1}. ${item.title}`);
      addText(line, "span", item.detail);
      previewList.appendChild(line);
    });
    if (!ordered.length) {
      addText(sourceColumn, "p", "No approved source material is attached to this exact story moment yet.", "build-assembly-empty");
      addText(previewList, "li", "Return to Write, Storyboard or Graphic Novel to approve source material first.");
    }
  }

  body.appendChild(sourceColumn);
  body.appendChild(preview);
  assembly.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "build-assembly-actions";
  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Reset arrangement";
  reset.addEventListener("click", () => {
    order = items.map((item) => item.id);
    saveOrder();
    status.textContent = "Arrangement reset to source order. Canon remains unchanged.";
    render();
  });
  actions.appendChild(reset);
  const approve = document.createElement("button");
  approve.type = "button";
  approve.className = "primary";
  approve.textContent = "Approve sequence";
  approve.disabled = items.length === 0;
  approve.addEventListener("click", () => {
    const next = approveSequence(project, blockNumber, miniBlockNumber, sceneId, orderedItems());
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.sessionStorage.removeItem(reviewKey);
    status.textContent = "Sequence approved. Source lineage and story position were recorded in the canonical project.";
    window.setTimeout(() => window.location.reload(), 260);
  });
  actions.appendChild(approve);
  assembly.appendChild(actions);

  const anchor = root.querySelector("[data-build-studio-context]");
  if (anchor) anchor.insertAdjacentElement("afterend", assembly);
  else root.prepend(assembly);
  render();
}

export default function BuildAssemblyStudio() {
  useEffect(() => {
    const apply = () => {
      if (new URLSearchParams(window.location.search).get("workspace") !== "build") return;
      const buildNav = document.querySelector<HTMLElement>('aside[aria-label="Build sections"]');
      const root = buildNav?.parentElement;
      if (root) buildAssembly(root);
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", apply);
    };
  }, []);
  return null;
}
