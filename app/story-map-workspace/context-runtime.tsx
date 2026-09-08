"use client";

import { useEffect } from "react";
import type { StoryMapStage } from "@/core/storage/story-map-context";
import { loadFoundationProject } from "@/core/storage/foundation-project-browser";
import { persistStoryMapContext } from "@/core/storage/profile-private-browser";

function boundedLocation(search: URLSearchParams, name: "block" | "mini", maximum: number) {
  const value = Number(search.get(name) || 1);
  return Number.isFinite(value) ? Math.min(maximum, Math.max(1, Math.trunc(value))) : 1;
}

function currentStage(location: URL): StoryMapStage | null {
  if (location.pathname === "/storyboard") return "storyboard";
  const workspace = location.searchParams.get("workspace");
  return workspace === "plan" || workspace === "build" ? workspace : null;
}

export default function StoryMapContextRuntime() {
  useEffect(() => {
    const location = new URL(window.location.href);
    const stage = currentStage(location);
    if (!stage || !location.searchParams.has("block")) return;
    const project = loadFoundationProject();
    void persistStoryMapContext(project.id, {
      blockNumber: boundedLocation(location.searchParams, "block", 24),
      miniBlockNumber: boundedLocation(location.searchParams, "mini", 4),
      stage,
    }).catch(() => undefined);
  }, []);

  return null;
}
