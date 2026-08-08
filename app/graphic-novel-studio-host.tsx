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
  root.querySelector("[data-graphic-novel-studio-context]")?.remove();
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
  const approvedVisuals = block?.visuals.filter((frame) => frame.miniBlockNumber === miniBlockNumber && frame.approvedImageVersionId).length ?? 0;

  const context = document.createElement("section");
  context.dataset.graphicNovelStudioContext = "true";
  context.className = "graphic-novel-studio-context";

  const heading = document.createElement("div");
  heading.className = "graphic-novel-studio-heading";
  addText(heading, "span", "Graphic Novel · Visual storytelling", "graphic-novel-studio-eyebrow");
  addText(heading, "h1", "Compose the story into pages and panels.");
  addText(heading, "p", mini?.function || mini?.purpose || scene?.purpose || "Use the approved story and visual canon for this exact story moment.");
  context.appendChild(heading);

  const identity = document.createElement("div");
  identity.className = "graphic-novel-story-identity";
  addText(identity, "strong", project.metadata.title || "Untitled Story");
  addText(identity, "span", `Act ${block?.act ?? 1} · Block ${blockNumber} · Mini ${blockNumber}.${miniBlockNumber} · Scene ${sceneEntry?.globalNumber ?? scene?.number ?? "—"}`);
  addText(identity, "small", `${screenplayElements.length} screenplay element${screenplayElements.length === 1 ? "" : "s"} · ${approvedVisuals} approved visual${approvedVisuals === 1 ? "" : "s"}`);
  context.appendChild(identity);

  const actions = document.createElement("div");
  actions.className = "graphic-novel-studio-actions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = `Back to Edit ${blockNumber}.${miniBlockNumber}`;
  edit.addEventListener("click", () => window.location.assign(`/edit?block=${blockNumber}&mini=${miniBlockNumber}`));
  actions.appendChild(edit);
  const storyboard = document.createElement("button");
  storyboard.type = "button";
  storyboard.textContent = "Open approved visual source";
  storyboard.addEventListener("click", () => window.location.assign(`/?workspace=storyboard&block=${blockNumber}&mini=${miniBlockNumber}`));
  actions.appendChild(storyboard);
  context.appendChild(actions);

  const actRail = document.createElement("nav");
  actRail.className = "graphic-novel-act-rail";
  actRail.setAttribute("aria-label", "Graphic Novel story position");
  for (let act = 1; act <= 4; act += 1) {
    const group = document.createElement("div");
    group.className = act === (block?.act ?? 1) ? "active" : "";
    addText(group, "span", `Act ${act}`);
    const first = (act - 1) * 6 + 1;
    for (let number = first; number < first + 6; number += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(number).padStart(2, "0");
      if (number === blockNumber) button.setAttribute("aria-current", "page");
      button.addEventListener("click", () => {
        const url = new URL(window.location.href);
        url.searchParams.set("workspace", "pitch");
        url.searchParams.set("block", String(number));
        url.searchParams.set("mini", "1");
        window.history.replaceState({}, "", url);
        buildContext(root);
      });
      group.appendChild(button);
    }
    actRail.appendChild(group);
  }
  context.appendChild(actRail);

  const miniRail = document.createElement("div");
  miniRail.className = "graphic-novel-mini-rail";
  for (let number = 1; number <= 4; number += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = number === miniBlockNumber ? "active" : "";
    const label = minis.find((item) => item.number === number)?.label || `Mini ${number}`;
    button.textContent = `${blockNumber}.${number} · ${label}`;
    button.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.set("workspace", "pitch");
      url.searchParams.set("block", String(blockNumber));
      url.searchParams.set("mini", String(number));
      window.history.replaceState({}, "", url);
      buildContext(root);
    });
    miniRail.appendChild(button);
  }
  context.appendChild(miniRail);

  root.prepend(context);
}

export default function GraphicNovelStudioHost() {
  useEffect(() => {
    let activeRoot: HTMLElement | null = null;

    const apply = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("workspace") !== "pitch") {
        if (activeRoot) activeRoot.classList.remove("graphic-novel-studio-shell");
        activeRoot = null;
        return;
      }
      const root = document.querySelector<HTMLElement>('section[aria-labelledby="graphic-novel-title"]');
      if (!root) return;
      if (activeRoot && activeRoot !== root) activeRoot.classList.remove("graphic-novel-studio-shell");
      activeRoot = root;
      root.classList.add("graphic-novel-studio-shell");
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
      activeRoot?.classList.remove("graphic-novel-studio-shell");
    };
  }, []);

  return null;
}
