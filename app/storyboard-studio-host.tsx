"use client";

import { useEffect } from "react";

const STORYBOARD_SECTIONS = new Set([
  "overview",
  "characters",
  "locations",
  "assets",
  "language",
  "blocks",
  "frames",
  "pitch",
  "diagnostics",
]);

export default function StoryboardStudioHost() {
  useEffect(() => {
    const timers: number[] = [];
    let focusedRoot: HTMLElement | null = null;

    const clearFocus = () => {
      if (!focusedRoot) return;
      delete focusedRoot.dataset.storyboardFocus;
      focusedRoot = null;
    };

    const focusRequestedMoment = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("workspace") !== "storyboard") {
        clearFocus();
        return;
      }

      const requestedSection = params.get("visualSection");
      if (!requestedSection || !STORYBOARD_SECTIONS.has(requestedSection)) {
        clearFocus();
        return;
      }

      const root = document.querySelector<HTMLElement>(".visual-studio-layout");
      const target = document.getElementById(`visual-${requestedSection}`);
      if (!root || !target) return;

      if (focusedRoot && focusedRoot !== root) delete focusedRoot.dataset.storyboardFocus;
      focusedRoot = root;
      root.dataset.storyboardFocus = requestedSection;

      for (const delay of [80, 420, 1100]) {
        timers.push(window.setTimeout(() => {
          if (document.documentElement.contains(target)) target.scrollIntoView({ block: "start" });
        }, delay));
      }

      if (params.get("decision") === "review") {
        for (const delay of [1350, 1900, 2500]) {
          timers.push(window.setTimeout(() => {
            const decisions = document.getElementById("storyboard-decisions");
            if (decisions) decisions.scrollIntoView({ block: "center" });
          }, delay));
        }
      }
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest('nav[aria-label="Visual Board sections"] button')) return;
      clearFocus();
    };

    focusRequestedMoment();
    const observer = new MutationObserver(focusRequestedMoment);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleClick);
    window.addEventListener("popstate", focusRequestedMoment);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick);
      window.removeEventListener("popstate", focusRequestedMoment);
      timers.forEach((timer) => window.clearTimeout(timer));
      clearFocus();
    };
  }, []);

  return null;
}
