"use client";

import { useEffect } from "react";

const replacements = new Map([
  ["App setup required", "Release setup incomplete"],
  ["The PlotPickle GitHub App is not configured in this build.", "GitHub connection is unavailable in this download."],
]);

function replaceDeveloperGuidance() {
  for (const element of document.querySelectorAll("strong, span")) {
    const current = element.textContent?.trim() || "";
    const replacement = replacements.get(current);
    if (replacement) element.textContent = replacement;
  }
  for (const code of document.querySelectorAll("code")) {
    if (code.textContent?.trim() !== "PLOTPICKLE_GITHUB_APP_CLIENT_ID") continue;
    const paragraph = code.closest("p");
    if (paragraph) paragraph.textContent = "This download was published before the official PlotPickle GitHub connection was added. You can keep working locally or use Advanced Setup until an updated PlotPickle release is installed.";
  }
}

export default function GitHubAppReleaseGuidance() {
  useEffect(() => {
    replaceDeveloperGuidance();
    const observer = new MutationObserver(replaceDeveloperGuidance);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
