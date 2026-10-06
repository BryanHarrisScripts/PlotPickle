"use client";

import snapshotContract from "../../../config/openpencil-design-snapshot.json";

export type OpenPencilDesignSnapshot = Readonly<{
  version: 1;
  surface: "Timeline";
  rootSelector: string;
  readySelector: string;
  capturedAt: string;
  nodeCount: number;
  width: number;
  height: number;
  html: string;
  css: string;
}>;

const TIMELINE = snapshotContract.timeline;
const SKIP_TAGS = new Set(["script", "style", "link", "meta", "noscript", "template"]);
const SAFE_ATTRIBUTES = new Set([
  "alt",
  "aria-label",
  "aria-pressed",
  "aria-selected",
  "class",
  "id",
  "placeholder",
  "role",
  "src",
  "title",
  "type",
  "value",
]);

function nextFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function visibleElement(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element || !element.isConnected) return null;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return null;
  return element;
}

async function waitForVisible(selector: string, timeoutMs = 10_000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    const element = visibleElement(selector);
    if (element) return element;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
  }
  throw new Error("OPENPENCIL_TIMELINE_CAPTURE_TIMEOUT");
}

function copySafeAttributes(source: Element, target: HTMLElement) {
  for (const attribute of Array.from(source.attributes)) {
    const name = attribute.name.toLowerCase();
    if (!SAFE_ATTRIBUTES.has(name) && !name.startsWith("data-")) continue;
    if (name.startsWith("on")) continue;
    if (name === "src" && source instanceof HTMLImageElement) {
      const value = source.currentSrc || source.src;
      if (value) target.setAttribute("src", value);
      continue;
    }
    target.setAttribute(attribute.name, attribute.value);
  }
}

function numberPx(value: number) {
  return `${Math.max(0, Math.round(value * 100) / 100)}px`;
}

function renderedStyle(
  source: HTMLElement,
  rect: DOMRect,
  parentRect: DOMRect | null,
  isRoot: boolean,
) {
  const style = window.getComputedStyle(source);
  const declarations: string[] = [
    "box-sizing:border-box",
    isRoot ? "position:relative" : "position:absolute",
    `left:${isRoot ? "0px" : numberPx(rect.left - (parentRect?.left ?? rect.left))}`,
    `top:${isRoot ? "0px" : numberPx(rect.top - (parentRect?.top ?? rect.top))}`,
    `width:${numberPx(rect.width)}`,
    `height:${numberPx(rect.height)}`,
  ];

  for (const property of TIMELINE.styleProperties) {
    const value = style.getPropertyValue(property).trim();
    if (!value) continue;
    declarations.push(`${property}:${value}`);
  }
  return declarations.join(";");
}

function cloneRenderedElement(
  source: HTMLElement,
  parentRect: DOMRect | null,
  state: { count: number; truncated: boolean },
  isRoot = false,
): HTMLElement | null {
  if (state.count >= TIMELINE.maxNodes) {
    state.truncated = true;
    return null;
  }

  const tag = source.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) return null;

  const computed = window.getComputedStyle(source);
  if (computed.display === "none" || computed.visibility === "hidden") return null;

  const rect = source.getBoundingClientRect();
  const supportedTag = /^[a-z][a-z0-9-]*$/u.test(tag) ? tag : "div";
  const clone = document.createElement(supportedTag);
  state.count += 1;

  copySafeAttributes(source, clone);
  clone.setAttribute("style", renderedStyle(source, rect, parentRect, isRoot));
  clone.removeAttribute("href");
  clone.removeAttribute("contenteditable");
  clone.removeAttribute("tabindex");

  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const value = child.textContent || "";
      if (value) clone.append(document.createTextNode(value));
      continue;
    }
    if (!(child instanceof HTMLElement)) continue;
    const renderedChild = cloneRenderedElement(child, rect, state);
    if (renderedChild) clone.append(renderedChild);
  }

  return clone;
}

export function serializeOpenPencilTimelineSnapshot(root: HTMLElement): OpenPencilDesignSnapshot {
  const state = { count: 0, truncated: false };
  const rootRect = root.getBoundingClientRect();
  const clone = cloneRenderedElement(root, null, state, true);
  if (!clone) throw new Error("OPENPENCIL_TIMELINE_CAPTURE_EMPTY");

  clone.setAttribute("data-openpencil-design-snapshot", "timeline");
  if (state.truncated) clone.setAttribute("data-openpencil-design-snapshot-truncated", "true");

  const css = [
    "html,body{margin:0;padding:0;background:#000;}",
    `body{position:relative;width:${numberPx(rootRect.width)};height:${numberPx(rootRect.height)};overflow:hidden;}`,
    "*,*::before,*::after{box-sizing:border-box;}",
  ].join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${clone.outerHTML}</body></html>`;

  if (html.length > TIMELINE.maxHtmlChars || css.length > TIMELINE.maxCssChars) {
    throw new Error("OPENPENCIL_TIMELINE_CAPTURE_TOO_LARGE");
  }

  return Object.freeze({
    version: 1,
    surface: "Timeline",
    rootSelector: TIMELINE.rootSelector,
    readySelector: TIMELINE.readySelector,
    capturedAt: new Date().toISOString(),
    nodeCount: state.count,
    width: Math.max(1, Math.round(rootRect.width)),
    height: Math.max(1, Math.round(rootRect.height)),
    html,
    css,
  });
}

export async function captureOpenPencilTimelineSnapshot(): Promise<OpenPencilDesignSnapshot> {
  window.dispatchEvent(new CustomEvent(TIMELINE.captureEvent, {
    detail: { surfaceName: TIMELINE.surface },
  }));

  await waitForVisible(TIMELINE.readySelector);
  const root = await waitForVisible(TIMELINE.rootSelector);
  await document.fonts?.ready?.catch(() => undefined);
  await nextFrame();
  await nextFrame();
  return serializeOpenPencilTimelineSnapshot(root);
}
