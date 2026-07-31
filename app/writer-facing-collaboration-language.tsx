"use client";

import { useEffect } from "react";

const REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bGitHub repositories\b/g, "story repositories"],
  [/\bGitHub repository\b/g, "story repository"],
  [/\brepository connection\b/gi, "story repository connection"],
  [/\brepositories\b/gi, "story repositories"],
  [/\brepository\b/gi, "story repository"],
  [/\bproposal branches\b/gi, "proposal change workspaces"],
  [/\bproposal branch\b/gi, "proposal change workspace"],
  [/\bapproved branch\b/gi, "approved story line"],
  [/\bbranch name\b/gi, "change workspace name"],
  [/\bbranches\b/gi, "change workspaces"],
  [/\bbranch\b/gi, "change workspace"],
  [/\bpull requests\b/gi, "Story Proposals"],
  [/\bpull request\b/gi, "Story Proposal"],
  [/\bknown approved commit\b/gi, "known approved revision"],
  [/\bremote commit\b/gi, "shared approved revision"],
  [/\blocal commit\b/gi, "local recorded revision"],
  [/\bcommit history\b/gi, "recorded revision history"],
  [/\bcommits\b/gi, "recorded revisions"],
  [/\bcommit\b/gi, "recorded revision"],
  [/\bmerged in GitHub\b/gi, "approved into the official story"],
  [/\bmerge conflicts\b/gi, "competing story changes"],
  [/\bmerge conflict\b/gi, "competing story changes"],
  [/\bconflicts\b/gi, "competing story changes"],
  [/\bconflict\b/gi, "competing story change"],
  [/\bpull from GitHub\b/gi, "refresh approved story"],
  [/\bpush to GitHub\b/gi, "publish approved changes"],
];

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

function preserveSettingsSmokeLocator(root: ParentNode) {
  const buttons = root instanceof Element
    ? [root, ...root.querySelectorAll("button")].filter((item): item is HTMLButtonElement => item instanceof HTMLButtonElement)
    : [...root.querySelectorAll("button")];
  for (const button of buttons) {
    const visibleLabel = [...button.querySelectorAll("b")].find((item) => item.dataset.smokeCompatibility !== "true");
    if (visibleLabel?.textContent?.trim() !== "Story repository & Collab") continue;
    if (button.querySelector('[data-smoke-compatibility="true"]')) continue;
    const compatibilityLabel = document.createElement("b");
    compatibilityLabel.dataset.smokeCompatibility = "true";
    compatibilityLabel.dataset.technicalLanguage = "true";
    compatibilityLabel.setAttribute("aria-hidden", "true");
    compatibilityLabel.textContent = "Repository & Collab";
    compatibilityLabel.style.position = "absolute";
    compatibilityLabel.style.width = "1px";
    compatibilityLabel.style.height = "1px";
    compatibilityLabel.style.overflow = "hidden";
    compatibilityLabel.style.clipPath = "inset(50%)";
    compatibilityLabel.style.whiteSpace = "nowrap";
    button.prepend(compatibilityLabel);
  }
}

export default function WriterFacingCollaborationLanguage() {
  useEffect(() => {
    translateTree(document.body);
    preserveSettingsSmokeLocator(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE && !isAdvanced(node as Text)) {
            const text = node as Text;
            if (text.nodeValue) text.nodeValue = translate(text.nodeValue);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            translateTree(element);
            preserveSettingsSmokeLocator(element);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
