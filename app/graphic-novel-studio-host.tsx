"use client";

import { useEffect } from "react";
import { approveGraphicNovelAssetVersion } from "@/lib/graphic-novel-approval";
import { graphicNovelAssetVersions } from "@/lib/graphic-novel-asset-versions";
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

function addDecisionPanel(context: HTMLElement, project: ReturnType<typeof loadProject>, blockNumber: number, miniBlockNumber: number) {
  const deck = project.review.pitchPackage.comicDeck;
  const panel = deck?.panels.find((item) => item.blockNumber === blockNumber && item.miniBlockNumber === miniBlockNumber);
  const decision = document.createElement("section");
  decision.className = "graphic-novel-decisions";
  decision.dataset.graphicNovelDecisions = "true";

  const header = document.createElement("div");
  addText(header, "span", "Human decision", "graphic-novel-studio-eyebrow");
  addText(header, "h2", "Choose what becomes visual canon.");
  addText(header, "p", "Keep, Change, Try and Compare stay outside canon. Only Approve promotes the selected candidate.");
  decision.appendChild(header);

  if (!panel) {
    addText(decision, "p", "No Graphic Novel panel is attached to this exact story moment yet. Existing planning and generation tools remain available below.", "graphic-novel-decision-empty");
    context.appendChild(decision);
    return;
  }

  const versions = graphicNovelAssetVersions(project, panel);
  if (!versions.length) {
    addText(decision, "p", "This panel has no image candidate yet. Create or import a candidate with the existing Graphic Novel tools below; nothing is approved automatically.", "graphic-novel-decision-empty");
    context.appendChild(decision);
    return;
  }

  const reviewKey = `plotpickle.graphicNovelReview.${panel.id}`;
  let saved: { index?: number; direction?: string; kept?: boolean } = {};
  try { saved = JSON.parse(window.sessionStorage.getItem(reviewKey) || "{}"); } catch { saved = {}; }
  let selectedIndex = Number.isInteger(saved.index) ? Math.max(0, Math.min(versions.length - 1, saved.index ?? 0)) : Math.max(0, versions.findIndex((item) => item.selected));
  let compareOpen = false;

  const candidate = document.createElement("div");
  candidate.className = "graphic-novel-candidate";
  const primary = document.createElement("img");
  primary.alt = `${panel.title} candidate`;
  candidate.appendChild(primary);
  const compare = document.createElement("img");
  compare.alt = `${panel.title} comparison candidate`;
  compare.hidden = true;
  candidate.appendChild(compare);
  const metadata = document.createElement("div");
  const candidateLabel = addText(metadata, "strong", "");
  const candidateState = addText(metadata, "span", "Candidate · not canon");
  candidate.appendChild(metadata);
  decision.appendChild(candidate);

  const direction = document.createElement("textarea");
  direction.rows = 2;
  direction.placeholder = "Describe what should change while preserving the source lineage…";
  direction.value = saved.direction || "";
  direction.setAttribute("aria-label", "Graphic Novel change direction");
  decision.appendChild(direction);

  const controls = document.createElement("div");
  controls.className = "graphic-novel-decision-actions";
  const status = document.createElement("p");
  status.className = "graphic-novel-decision-status";
  status.setAttribute("role", "status");

  function saveReview(kept = saved.kept ?? false) {
    saved = { index: selectedIndex, direction: direction.value.trim(), kept };
    window.sessionStorage.setItem(reviewKey, JSON.stringify(saved));
  }

  function renderCandidate() {
    const version = versions[selectedIndex];
    primary.src = version.source;
    candidateLabel.textContent = `${panel.title} · ${version.label}`;
    const asset = project.assets.assets.find((item) => item.id === version.reference.assetId);
    const approved = asset?.approvedVariationId === version.reference.variationId;
    candidateState.textContent = approved ? "Approved visual canon" : saved.kept ? "Kept candidate · not canon" : "Candidate · not canon";
    candidate.dataset.approved = approved ? "true" : "false";
    if (compareOpen && versions.length > 1) {
      const alternate = versions[(selectedIndex + 1) % versions.length];
      compare.src = alternate.source;
      compare.hidden = false;
    } else {
      compare.hidden = true;
    }
  }

  function button(label: string, action: () => void, primaryAction = false) {
    const control = document.createElement("button");
    control.type = "button";
    control.textContent = label;
    if (primaryAction) control.className = "primary";
    control.addEventListener("click", action);
    controls.appendChild(control);
  }

  button("Keep", () => {
    saveReview(true);
    status.textContent = "Candidate kept for this review. Canon is unchanged until Approve.";
    renderCandidate();
  });
  button("Change", () => {
    saveReview(false);
    status.textContent = direction.value.trim()
      ? "Change direction saved for this review. Approved canon is unchanged."
      : "Describe what should change first. No canon was modified.";
  });
  button("Try", () => {
    if (versions.length < 2) {
      status.textContent = "No alternate candidate exists yet. Use the existing Graphic Novel tools to create one; Try never starts a paid request silently.";
      return;
    }
    selectedIndex = (selectedIndex + 1) % versions.length;
    saved.kept = false;
    saveReview(false);
    status.textContent = `Trying ${versions[selectedIndex].label}. Canon is unchanged.`;
    renderCandidate();
  });
  button("Compare", () => {
    if (versions.length < 2) {
      status.textContent = "A second candidate is required for side-by-side comparison.";
      return;
    }
    compareOpen = !compareOpen;
    status.textContent = compareOpen ? "Comparing two candidates side by side. No canon changed." : "Comparison closed.";
    renderCandidate();
  });
  button("Approve", () => {
    const version = versions[selectedIndex];
    const approved = approveGraphicNovelAssetVersion(project, panel.id, version.reference);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(approved));
    window.sessionStorage.removeItem(reviewKey);
    status.textContent = `${version.label} approved. Updating the canonical Graphic Novel asset…`;
    window.setTimeout(() => window.location.reload(), 260);
  }, true);

  direction.addEventListener("input", () => saveReview(saved.kept ?? false));
  decision.appendChild(controls);
  decision.appendChild(status);
  renderCandidate();
  context.appendChild(decision);
}

function buildContext(root: HTMLElement) {
  const project = loadProject();
  const blockNumber = requestedNumber("block", 1, 1, 24);
  const miniBlockNumber = requestedNumber("mini", 1, 1, 4);
  const contextKey = `${blockNumber}:${miniBlockNumber}:${project.metadata.updatedAt}`;
  const existing = root.querySelector<HTMLElement>("[data-graphic-novel-studio-context]");
  if (existing?.dataset.contextKey === contextKey) return;
  existing?.remove();

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
  context.dataset.contextKey = contextKey;
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
      const control = document.createElement("button");
      control.type = "button";
      control.textContent = String(number).padStart(2, "0");
      if (number === blockNumber) control.setAttribute("aria-current", "page");
      control.addEventListener("click", () => {
        const url = new URL(window.location.href);
        url.searchParams.set("workspace", "pitch");
        url.searchParams.set("block", String(number));
        url.searchParams.set("mini", "1");
        window.history.replaceState({}, "", url);
        buildContext(root);
      });
      group.appendChild(control);
    }
    actRail.appendChild(group);
  }
  context.appendChild(actRail);

  const miniRail = document.createElement("div");
  miniRail.className = "graphic-novel-mini-rail";
  for (let number = 1; number <= 4; number += 1) {
    const control = document.createElement("button");
    control.type = "button";
    control.className = number === miniBlockNumber ? "active" : "";
    const label = minis.find((item) => item.number === number)?.label || `Mini ${number}`;
    control.textContent = `${blockNumber}.${number} · ${label}`;
    control.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.set("workspace", "pitch");
      url.searchParams.set("block", String(blockNumber));
      url.searchParams.set("mini", String(number));
      window.history.replaceState({}, "", url);
      buildContext(root);
    });
    miniRail.appendChild(control);
  }
  context.appendChild(miniRail);

  addDecisionPanel(context, project, blockNumber, miniBlockNumber);
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
