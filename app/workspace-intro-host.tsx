"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import WorkspaceIntro from "./workspace-intro";

type IntroDefinition = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  sideEyebrow: string;
  sideTitle: string;
  sideDescription: string;
};

const introductions: Record<string, IntroDefinition> = {
  Screenplay: {
    id: "screenplay-workspace-title",
    eyebrow: "Screenplay workspace",
    title: "Turn the plan into a complete, scrollable screenplay.",
    description: "Develop the treatment and formatted screenplay in one connected writing flow. Every scene, action line, character cue, and line of dialogue stays linked to the active 24 Blocks and 96 mini-blocks.",
    sideEyebrow: "Write with context",
    sideTitle: "Plan, draft, review, and export without losing your place.",
    sideDescription: "Switch between Treatment and Screenplay, use optional AI only when useful, and export the active draft to Fountain, Final Draft, or PDF.",
  },
  "Visual Board": {
    id: "visual-board-workspace-title",
    eyebrow: "Visual Board workspace",
    title: "See the complete film before every frame is finished.",
    description: "Move from the 24-block overview into all 96 mini-block visuals. Each frame stays connected to the story movement, characters, locations, screenplay evidence, camera direction, and continuity that created it.",
    sideEyebrow: "One continuous film",
    sideTitle: "Keep every image tied to the dramatic turn it must communicate.",
    sideDescription: "Review approved frames, refine prompts, generate new images locally, and return to the matching Block plan whenever the visual story needs clarification.",
  },
  Settings: {
    id: "settings-workspace-title",
    eyebrow: "Settings workspace",
    title: "Control project tools and optional connections.",
    description: "Review screenplay reports and terminology, then choose whether to connect AI, music services, or future plugins. PlotPickle remains fully usable without an external account or creative service.",
    sideEyebrow: "Local by default",
    sideTitle: "Connect only what you choose.",
    sideDescription: "Your project files stay on this device. API keys are handled by the private local server and are never stored in the screenplay or exported project.",
  },
};

export default function WorkspaceIntroHost() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [activeLabel, setActiveLabel] = useState("");

  useEffect(() => {
    let host: HTMLDivElement | null = null;

    function sync() {
      const workspace = document.querySelector<HTMLElement>("main.workspace");
      if (workspace && !host) {
        host = document.createElement("div");
        host.dataset.workspaceIntroHost = "true";
        workspace.prepend(host);
        setTarget(host);
      }

      const activeTab = document.querySelector<HTMLButtonElement>('.main-tabs button[aria-selected="true"]');
      setActiveLabel(activeTab?.querySelector("span")?.textContent?.trim() ?? "");
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-selected"],
    });

    return () => {
      observer.disconnect();
      host?.remove();
    };
  }, []);

  const intro = introductions[activeLabel];
  if (!target || !intro) return null;

  return createPortal(<WorkspaceIntro {...intro} />, target);
}
