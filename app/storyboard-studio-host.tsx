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
    let focused = false;
    let timer = 0;

    const focusRequestedMoment = () => {
      if (focused) return;
      const params = new URLSearchParams(window.location.search);
      if (params.get("workspace") !== "storyboard") return;
      const requestedSection = params.get("visualSection");
      if (!requestedSection || !STORYBOARD_SECTIONS.has(requestedSection)) return;
      const target = document.getElementById(`visual-${requestedSection}`);
      if (!target) return;

      focused = true;
      timer = window.setTimeout(() => {
        target.scrollIntoView({ block: "start" });
      }, 80);
    };

    focusRequestedMoment();
    const observer = new MutationObserver(focusRequestedMoment);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
