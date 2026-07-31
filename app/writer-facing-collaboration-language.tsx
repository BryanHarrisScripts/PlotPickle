"use client";

import { useEffect } from "react";
import collaborationCopy from "@/config/collaboration-copy.json";

const REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = collaborationCopy.replacements.map((item) => [
  new RegExp(item.pattern, item.flags),
  item.replacement,
] as const);

function isAdvanced(node: Text) {
  const element = node.parentElement;
  if (!element) return false;
  return Boolean(element.closest("details, code, pre, input, textarea, select, [data-technical-language], [aria-label*='Advanced']"));
}

function translate(value: string) {
  return REPLACEMENTS.reduce((copy, [pattern, replacement]) => copy.replace(pattern, replacement), value);
}

function translateTree(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (isAdvanced(node) || !node.nodeValue?.trim()) continue;
    const next = translate(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }
}

function markStableCopyKeys(root: ParentNode) {
  const buttons = root instanceof Element
    ? [root, ...root.querySelectorAll("button")].filter((item): item is HTMLButtonElement => item instanceof HTMLButtonElement)
    : [...root.querySelectorAll("button")];
  for (const button of buttons) {
    const label = button.querySelector("b")?.textContent?.trim();
    if (label === collaborationCopy.settings.repository.label) {
      button.dataset.uiCopyKey = collaborationCopy.settings.repository.key;
    }
  }
}

export default function WriterFacingCollaborationLanguage() {
  useEffect(() => {
    markStableCopyKeys(document.body);
    translateTree(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE && !isAdvanced(node as Text)) {
            const text = node as Text;
            if (text.nodeValue) text.nodeValue = translate(text.nodeValue);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            markStableCopyKeys(element);
            translateTree(element);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
