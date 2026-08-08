"use client";

import { useEffect } from "react";

type StoryboardArea = "overview" | "world" | "moments" | "continuity" | "versions";

type SectionConfig = {
  area: Exclude<StoryboardArea, "versions">;
  role: "primary" | "secondary";
  label?: string;
  detail?: string;
};

const SECTION_CONFIG: Record<string, SectionConfig> = {
  "visual overview": { area: "overview", role: "primary", label: "Overview", detail: "Direction & readiness" },
  "characters & identity locks": { area: "world", role: "primary", label: "Story World", detail: "Characters, places & visual rules" },
  "locations & world": { area: "world", role: "secondary" },
  "props, vehicles & wardrobe": { area: "world", role: "secondary" },
  "colour, lighting & language": { area: "world", role: "secondary" },
  "posters, pitch & production": { area: "world", role: "secondary", label: "Presentation references" },
  "24-block storyboard": { area: "moments", role: "primary", label: "Moments", detail: "4 Acts · 24 Blocks · 96 mini-blocks" },
  "96 mini-block frames": { area: "moments", role: "secondary" },
  "continuity & missing assets": { area: "continuity", role: "primary", label: "Continuity", detail: "Identity, geography & missing assets" },
};

function normalized(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function originalLabel(button: HTMLButtonElement) {
  if (button.dataset.storyboardOriginalLabel) return button.dataset.storyboardOriginalLabel;
  const label = normalized(button.querySelector("strong")?.textContent);
  button.dataset.storyboardOriginalLabel = label;
  return label;
}

function applySectionConfig(button: HTMLButtonElement) {
  const config = SECTION_CONFIG[originalLabel(button)];
  if (!config) return;

  button.dataset.storyboardArea = config.area;
  button.dataset.storyboardRole = config.role;
  const label = button.querySelector("strong");
  const detail = button.querySelector("small");
  if (config.label && label && label.textContent !== config.label) label.textContent = config.label;
  if (config.detail && detail && detail.textContent !== config.detail) detail.textContent = config.detail;
}

function makeVersionsButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.storyboardArea = "versions";
  button.dataset.storyboardRole = "primary";
  button.dataset.storyboardVersions = "true";
  button.innerHTML = "<span><strong>Versions</strong><small>Approved and alternate takes</small></span><b>Review</b>";
  return button;
}

export default function StoryboardNavigationGroupsHost() {
  useEffect(() => {
    let activeNav: HTMLElement | null = null;
    let versionsButton: HTMLButtonElement | null = null;
    let versionsActive = false;
    const timers: number[] = [];

    const canonicalButtons = () => activeNav
      ? Array.from(activeNav.querySelectorAll<HTMLButtonElement>(":scope > button:not([data-storyboard-versions])"))
      : [];

    const findCanonical = (label: string) => canonicalButtons().find((button) => originalLabel(button) === label);

    const syncArea = () => {
      if (!activeNav) return;
      if (versionsActive) {
        activeNav.dataset.storyboardArea = "versions";
        activeNav.dataset.storyboardVersionsActive = "true";
        return;
      }

      delete activeNav.dataset.storyboardVersionsActive;
      const current = canonicalButtons().find((button) => button.hasAttribute("aria-current"));
      activeNav.dataset.storyboardArea = current?.dataset.storyboardArea || "overview";
    };

    const openVersions = () => {
      if (!activeNav) return;
      versionsActive = true;
      syncArea();
      findCanonical("96 mini-block frames")?.click();
      versionsActive = true;
      syncArea();

      for (const delay of [80, 360, 900]) {
        timers.push(window.setTimeout(() => {
          const target = document.querySelector<HTMLElement>('[aria-label="Review generated versions"]')
            || document.getElementById("storyboard-decisions")
            || document.getElementById("visual-frames");
          target?.scrollIntoView({ behavior: delay === 80 ? "auto" : "smooth", block: "center" });
        }, delay));
      }
    };

    const configure = () => {
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Visual Board sections"]');
      if (!nav) {
        activeNav = null;
        versionsButton = null;
        versionsActive = false;
        return;
      }

      if (activeNav !== nav) {
        activeNav = nav;
        versionsActive = false;
      }

      for (const button of canonicalButtons()) applySectionConfig(button);

      const heading = nav.querySelector("header strong");
      if (heading && heading.textContent !== "Direct the story") heading.textContent = "Direct the story";

      versionsButton = nav.querySelector<HTMLButtonElement>("button[data-storyboard-versions]");
      if (!versionsButton) {
        versionsButton = makeVersionsButton();
        versionsButton.addEventListener("click", openVersions);
        nav.appendChild(versionsButton);
      }

      syncArea();
    };

    const handleClick = (event: MouseEvent) => {
      if (!activeNav || !event.isTrusted) return;
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button");
      if (!button || !activeNav.contains(button) || button.dataset.storyboardVersions) return;
      versionsActive = false;
      window.setTimeout(syncArea, 0);
    };

    configure();
    const observer = new MutationObserver(() => {
      configure();
      syncArea();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-current"] });
    document.addEventListener("click", handleClick, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
      timers.forEach((timer) => window.clearTimeout(timer));
      if (versionsButton) versionsButton.removeEventListener("click", openVersions);
      versionsButton?.remove();
    };
  }, []);

  return null;
}
