"use client";

import { useEffect } from "react";

const REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bGitHub repository\b/g, "story repository"],
  [/\brepository connection\b/gi, "story repository connection"],
  [/\brepository\b/gi, "story repository"],
  [/\bproposal branches\b/gi, "proposal change workspaces"],
  [/\bproposal branch\b/gi, "proposal change workspace"],
  [/\bapproved branch\b/gi, "approved story line"],
  [/\bbranch name\b/gi, "change workspace name"],
  [/\bbranch\b/gi, "change workspace"],
  [/\bpull request\b/gi, "Story Proposal"],
  [/\bpull requests\b/gi, "Story Proposals"],
  [/\bknown approved commit\b/gi, "known approved revision"],
  [/\bremote commit\b/gi, "shared approved revision"],
  [/\blocal commit\b/gi, "local recorded revision"],
  [/\bcommit history\b/gi, "recorded revision history"],
  [/\bcommit\b/gi, "recorded revision"],
  [/\bmerged in GitHub\b/gi, "approved into the official story"],
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

export default function WriterFacingCollaborationLanguage() {
  useEffect(() => {
    translateTree(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE && !isAdvanced(node as Text)) {
            const text = node as Text;
            if (text.nodeValue) text.nodeValue = translate(text.nodeValue);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            translateTree(node as Element);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
