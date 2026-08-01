"use client";

import { useEffect } from "react";
import collaborationCopy from "@/config/collaboration-copy.json";

const REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = collaborationCopy.replacements.map((item) => [
  new RegExp(item.pattern, item.flags),
  item.replacement,
] as const);

function isProtectedCopy(node: Text) {
  const element = node.parentElement;
  if (!element) return false;
  return Boolean(element.closest("details, code, pre, input, textarea, select, [data-technical-language], [data-ui-copy-key], [aria-label*='Advanced']"));
}

function translate(value: string) {
  return REPLACEMENTS.reduce((copy, [pattern, replacement]) => copy.replace(pattern, replacement), value);
}

function translateTree(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (isProtectedCopy(node) || !node.nodeValue?.trim()) continue;
    const next = translate(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }
}

function normalize(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function markStableCopyKeys(root: ParentNode) {
  const buttons = root instanceof Element
    ? [root, ...root.querySelectorAll("button")].filter((item): item is HTMLButtonElement => item instanceof HTMLButtonElement)
    : [...root.querySelectorAll("button")];
  for (const button of buttons) {
    const boldLabel = normalize(button.querySelector("b")?.textContent);
    const fullLabel = normalize(button.textContent);
    if (
      boldLabel === collaborationCopy.settings.repository.label
      || fullLabel === collaborationCopy.settings.repository.label
      || fullLabel.startsWith(`${collaborationCopy.settings.repository.label} `)
    ) {
      button.dataset.uiCopyKey = collaborationCopy.settings.repository.key;
    }
  }
}

export default function WriterFacingCollaborationLanguage() {
  useEffect(() => {
    const refreshCopy = (root: ParentNode) => {
      markStableCopyKeys(root);
      translateTree(root);
      markStableCopyKeys(root);
    };

    refreshCopy(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") {
          const text = record.target as Text;
          if (!isProtectedCopy(text) && text.nodeValue) {
            const next = translate(text.nodeValue);
            if (next !== text.nodeValue) text.nodeValue = next;
          }
          if (text.parentElement) markStableCopyKeys(text.parentElement);
          continue;
        }
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE && !isProtectedCopy(node as Text)) {
            const text = node as Text;
            if (text.nodeValue) {
              const next = translate(text.nodeValue);
              if (next !== text.nodeValue) text.nodeValue = next;
            }
            if (text.parentElement) markStableCopyKeys(text.parentElement);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            refreshCopy(node as Element);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
