"use client";

import { useEffect } from "react";
import { buildGlobalSceneIndex } from "@/lib/scene-management";
import { createBlankProject, normalizePlotPickleProject } from "@/lib/project";

const STORAGE_KEY = "plotpickle.project.v1";

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

function buildContext(root: HTMLElement) {
  const project = loadProject();
  const blockNumber = requestedNumber("block", 1, 1, 24);
  const miniBlockNumber = requestedNumber("mini", 1, 1, 4);
  const contextKey = `${blockNumber}:${miniBlockNumber}:${project.metadata.updatedAt}`;
  const existing = root.querySelector<HTMLElement>("[data-feedback-studio-context]");
  if (existing?.dataset.contextKey === contextKey) return;
  existing?.remove();

  const block = project.blocks[blockNumber - 1] ?? project.blocks[0];
  const minis = block?.scenes.flatMap((scene) => scene.miniBlocks) ?? [];
  const mini = minis.find((item) => item.number === miniBlockNumber) ?? minis[0];
  const sceneIndex = buildGlobalSceneIndex(project.blocks);
  const sceneEntry = sceneIndex.find((entry) => entry.blockNumber === blockNumber && entry.miniBlockNumbers.includes(miniBlockNumber))
    ?? sceneIndex.find((entry) => entry.blockNumber === blockNumber);
  const scene = block?.scenes.find((item) => item.id === sceneEntry?.sceneId) ?? block?.scenes[0];
  const screenplayElements = project.screenplay.draftElements.filter((element) => element.blockNumber === blockNumber && element.miniBlockNumber === miniBlockNumber && !element.omitted);
  const approvedVisuals = block?.visuals.filter((frame) => frame.miniBlockNumber === miniBlockNumber && frame.approvedImageVersionId).length ?? 0;
  const approvedGraphicNovelPanels = project.review.pitchPackage.comicDeck?.panels.filter((panel) => panel.blockNumber === blockNumber && panel.miniBlockNumber === miniBlockNumber && panel.assetRef && project.assets.assets.some((asset) => asset.id === panel.assetRef?.assetId && asset.approvedVariationId === panel.assetRef?.variationId)).length ?? 0;
  const buildApprovals = Array.isArray(project.extensions?.buildSequenceApprovals)
    ? project.extensions.buildSequenceApprovals.filter((value) => Boolean(value && typeof value === "object" && (value as { blockNumber?: number }).blockNumber === blockNumber && (value as { miniBlockNumber?: number }).miniBlockNumber === miniBlockNumber)).length
    : 0;

  const context = document.createElement("section");
  context.dataset.feedbackStudioContext = "true";
  context.dataset.contextKey = contextKey;
  context.className = "feedback-studio-context";

  const heading = document.createElement("div");
  heading.className = "feedback-studio-heading";
  addText(heading, "span", "Feedback · Review the same story moment", "feedback-studio-eyebrow");
  addText(heading, "h1", "Understand what needs attention before changing the story.");
  addText(heading, "p", mini?.function || mini?.purpose || scene?.purpose || block?.purpose || "Feedback stays attached to the canonical story target and never changes it automatically.");
  context.appendChild(heading);

  const identity = document.createElement("div");
  identity.className = "feedback-story-identity";
  addText(identity, "strong", project.metadata.title || "Untitled Story");
  addText(identity, "span", `Act ${block?.act ?? 1} · Block ${blockNumber} · Mini ${blockNumber}.${miniBlockNumber} · Scene ${sceneEntry?.globalNumber ?? scene?.number ?? "—"}`);
  addText(identity, "small", `${screenplayElements.length} screenplay element${screenplayElements.length === 1 ? "" : "s"} · ${approvedVisuals} approved Storyboard visual${approvedVisuals === 1 ? "" : "s"} · ${approvedGraphicNovelPanels} approved Graphic Novel panel${approvedGraphicNovelPanels === 1 ? "" : "s"} · ${buildApprovals} approved Build sequence${buildApprovals === 1 ? "" : "s"}`);
  context.appendChild(identity);

  const source = document.createElement("div");
  source.className = "feedback-source-context";
  const intent = document.createElement("article");
  addText(intent, "span", "Storyteller intent", "feedback-studio-eyebrow");
  addText(intent, "strong", mini?.label || scene?.title || block?.title || `Block ${blockNumber}`);
  addText(intent, "p", mini?.purpose || mini?.function || scene?.purpose || block?.purpose || "Preserve the story purpose while reviewing notes and proposals.");
  source.appendChild(intent);
  const approved = document.createElement("article");
  addText(approved, "span", "Approved source context", "feedback-studio-eyebrow");
  addText(approved, "strong", "One canonical project");
  addText(approved, "p", "Screenplay, visual canon, Graphic Novel and Build approvals stay where they were created. Feedback only points to them.");
  source.appendChild(approved);
  context.appendChild(source);

  const categories = document.createElement("div");
  categories.className = "feedback-category-rail";
  ["Story", "Structure", "Character", "Dialogue", "Visual direction", "Continuity", "Production / Build"].forEach((label) => addText(categories, "span", label));
  context.appendChild(categories);

  const actions = document.createElement("div");
  actions.className = "feedback-studio-actions";
  const build = document.createElement("button");
  build.type = "button";
  build.textContent = `Back to Build ${blockNumber}.${miniBlockNumber}`;
  build.addEventListener("click", () => window.location.assign(`/?workspace=build&block=${blockNumber}&mini=${miniBlockNumber}`));
  actions.appendChild(build);
  const refine = document.createElement("button");
  refine.type = "button";
  refine.className = "primary";
  refine.textContent = "Continue to Refine";
  refine.addEventListener("click", () => window.location.assign(`/?workspace=refine&block=${blockNumber}&mini=${miniBlockNumber}`));
  actions.appendChild(refine);
  context.appendChild(actions);

  root.prepend(context);
}

export default function FeedbackStudioHost() {
  useEffect(() => {
    let activeRoot: HTMLElement | null = null;
    const apply = () => {
      if (new URLSearchParams(window.location.search).get("workspace") !== "feedback") {
        activeRoot?.classList.remove("feedback-studio-shell");
        activeRoot = null;
        return;
      }
      const nav = document.querySelector<HTMLElement>('aside[aria-label="Feedback sections"]');
      const root = nav?.parentElement;
      if (!root) return;
      if (activeRoot && activeRoot !== root) activeRoot.classList.remove("feedback-studio-shell");
      activeRoot = root;
      root.classList.add("feedback-studio-shell");
      buildContext(root);
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", apply);
    window.addEventListener("storage", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", apply);
      window.removeEventListener("storage", apply);
      activeRoot?.classList.remove("feedback-studio-shell");
    };
  }, []);

  return null;
}
