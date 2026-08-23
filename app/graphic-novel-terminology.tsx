"use client";

import { useEffect } from "react";
import { graphicNovelText } from "@/lib/ai-pitch-deck";

const ATTRIBUTES = ["aria-label", "title", "alt", "placeholder"] as const;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);

function translateElement(element: Element) {
  for (const attribute of ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (!value) continue;
    const translated = graphicNovelText(value);
    if (translated !== value) element.setAttribute(attribute, translated);
  }
}

function translateNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || SKIP_TAGS.has(parent.tagName)) return;
    const value = node.nodeValue || "";
    const translated = graphicNovelText(value);
    if (translated !== value) node.nodeValue = translated;
    return;
  }
  if (!(node instanceof Element) || SKIP_TAGS.has(node.tagName)) return;
  translateElement(node);
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let current: Node | null = walker.currentNode;
  while (current) {
    if (current !== node) {
      if (current.nodeType === Node.TEXT_NODE) {
        const parent = current.parentElement;
        if (parent && !SKIP_TAGS.has(parent.tagName)) {
          const value = current.nodeValue || "";
          const translated = graphicNovelText(value);
          if (translated !== value) current.nodeValue = translated;
        }
      } else if (current instanceof Element && !SKIP_TAGS.has(current.tagName)) {
        translateElement(current);
      }
    }
    current = walker.nextNode();
  }
}

export default function GraphicNovelTerminology() {
  useEffect(() => {
    translateNode(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") translateNode(mutation.target);
        mutation.addedNodes.forEach(translateNode);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
