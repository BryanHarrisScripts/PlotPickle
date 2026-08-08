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

function addGraphicNovelHandoff() {
  const actions = document.querySelector<HTMLElement>(".graphic-novel-studio-actions");
  if (!actions || actions.querySelector("[data-graphic-novel-build-handoff]")) return;
  const block = requestedNumber("block", 1, 1, 24);
  const mini = requestedNumber("mini", 1, 1, 4);
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.graphicNovelBuildHandoff = "true";
  button.className = "graphic-novel-build-handoff-button";
  button.textContent = `Continue to Build ${block}.${mini}`;
  button.addEventListener("click", () => {
    window.location.assign(`/?workspace=build&block=${block}&mini=${mini}&from=graphic-novel`);
  });
  actions.appendChild(button);
}

function addBuildContext() {
  const buildNav = document.querySelector<HTMLElement>('aside[aria-label="Build sections"]');
  const root = buildNav?.parentElement;
  if (!root || root.querySelector("[data-build-studio-context]")) return;

  const project = loadProject();
  const blockNumber = requestedNumber("block", 1, 1, 24);
  const miniBlockNumber = requestedNumber("mini", 1, 1, 4);
  const block = project.blocks[blockNumber - 1] ?? project.blocks[0];
  const minis = block?.scenes.flatMap((scene) => scene.miniBlocks) ?? [];
  const mini = minis.find((item) => item.number === miniBlockNumber) ?? minis[0];
  const sceneIndex = buildGlobalSceneIndex(project.blocks);
  const sceneEntry = sceneIndex.find((entry) => entry.blockNumber === blockNumber && entry.miniBlockNumbers.includes(miniBlockNumber))
    ?? sceneIndex.find((entry) => entry.blockNumber === blockNumber);
  const scene = block?.scenes.find((item) => item.id === sceneEntry?.sceneId) ?? block?.scenes[0];
  const screenplayElements = project.screenplay.draftElements.filter((element) => element.blockNumber === blockNumber && element.miniBlockNumber === miniBlockNumber);
  const graphicPanels = project.review.pitchPackage.comicDeck?.panels.filter((panel) => panel.blockNumber === blockNumber && panel.miniBlockNumber === miniBlockNumber) ?? [];
  const approvedGraphicPanels = graphicPanels.filter((panel) => {
    if (!panel.assetRef) return false;
    const asset = project.assets.assets.find((item) => item.id === panel.assetRef?.assetId);
    return asset?.approvedVariationId === panel.assetRef.variationId;
  });
  const approvedStoryboardVisuals = block?.visuals.filter((frame) => frame.miniBlockNumber === miniBlockNumber && frame.approvedImageVersionId).length ?? 0;

  root.classList.add("build-studio-continuity-shell");
  const context = document.createElement("section");
  context.dataset.buildStudioContext = "true";
  context.className = "build-studio-context";

  const heading = document.createElement("div");
  heading.className = "build-studio-heading";
  addText(heading, "span", "Build · Assemble approved story material", "build-studio-eyebrow");
  addText(heading, "h1", "Build the same story moment into a sequence.");
  addText(heading, "p", mini?.function || mini?.purpose || scene?.purpose || "Arrange approved story material without creating a parallel copy of the scene.");
  context.appendChild(heading);

  const identity = document.createElement("div");
  identity.className = "build-story-identity";
  addText(identity, "strong", project.metadata.title || "Untitled Story");
  addText(identity, "span", `Act ${block?.act ?? 1} · Block ${blockNumber} · Mini ${blockNumber}.${miniBlockNumber} · Scene ${sceneEntry?.globalNumber ?? scene?.number ?? "—"}`);
  addText(identity, "small", `${screenplayElements.length} screenplay element${screenplayElements.length === 1 ? "" : "s"} · ${approvedStoryboardVisuals} approved storyboard visual${approvedStoryboardVisuals === 1 ? "" : "s"} · ${approvedGraphicPanels.length} approved Graphic Novel panel${approvedGraphicPanels.length === 1 ? "" : "s"}`);
  context.appendChild(identity);

  const source = document.createElement("div");
  source.className = "build-source-lineage";
  addText(source, "span", "Source lineage", "build-studio-eyebrow");
  addText(source, "strong", "Canonical project only");
  addText(source, "small", "Screenplay, Storyboard and Graphic Novel assets stay referenced from their approved source records.");
  context.appendChild(source);

  const actions = document.createElement("div");
  actions.className = "build-studio-context-actions";
  const back = document.createElement("button");
  back.type = "button";
  back.textContent = `Back to Graphic Novel ${blockNumber}.${miniBlockNumber}`;
  back.addEventListener("click", () => window.location.assign(`/?workspace=pitch&block=${blockNumber}&mini=${miniBlockNumber}`));
  actions.appendChild(back);
  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "Open screenplay source";
  edit.addEventListener("click", () => window.location.assign(`/edit?block=${blockNumber}&mini=${miniBlockNumber}`));
  actions.appendChild(edit);
  context.appendChild(actions);

  root.prepend(context);

  const selectedBlock = project.blocks.find((item) => item.number === blockNumber);
  if (selectedBlock) {
    for (const delay of [80, 320, 800]) {
      window.setTimeout(() => {
        const target = document.getElementById(`build-block-${selectedBlock.id}`) as HTMLButtonElement | null;
        if (target && target.getAttribute("aria-pressed") !== "true") target.click();
      }, delay);
    }
  }
}

export default function GraphicNovelBuildHandoff() {
  useEffect(() => {
    const apply = () => {
      const workspace = new URLSearchParams(window.location.search).get("workspace");
      if (workspace === "pitch") addGraphicNovelHandoff();
      if (workspace === "build") addBuildContext();
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
