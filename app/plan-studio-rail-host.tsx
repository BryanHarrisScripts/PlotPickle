"use client";

import { useEffect } from "react";

type PlanItem = {
  id: string;
  label: string;
  legacyLabel?: string;
};

const PLAN_ITEMS: PlanItem[] = [
  { id: "simpleStart", label: "Simple Start" },
  { id: "overview", label: "Project Overview" },
  { id: "storySetup", label: "Story Setup" },
  { id: "concept", label: "Concept Canvas" },
  { id: "pitch", label: "Pitch & Vision" },
  { id: "references", label: "Visual References" },
  { id: "world", label: "World" },
  { id: "characters", label: "Characters" },
  { id: "ghost", label: "Ghost" },
  { id: "catalyst", label: "Catalyst" },
  { id: "foundations", label: "Foundations" },
  { id: "pickle", label: "The Pickle" },
  { id: "dialogue", label: "Dialogue" },
  { id: "structureMap", label: "Structure Map" },
  { id: "blocks", label: "24 Blocks" },
  { id: "storyboard", label: "Storyboard Handoff", legacyLabel: "Storyboard" },
  { id: "coreModel", label: "Core Model" },
  { id: "notes", label: "Notes" },
];

function normalized(text: string | null | undefined) {
  return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function buttons(root: ParentNode) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>(".story-rail nav button"));
}

function itemForButton(button: HTMLButtonElement | null) {
  if (!button) return null;
  const text = normalized(button.textContent);
  return PLAN_ITEMS.find((item) => text.includes(normalized(item.legacyLabel || item.label))) ?? null;
}

function requestedItem() {
  const requested = new URLSearchParams(window.location.search).get("section");
  return requested ? PLAN_ITEMS.find((item) => item.id === requested) ?? null : null;
}

function applyRequestedSection(root: ParentNode) {
  const requested = requestedItem();
  if (!requested) return;
  const target = normalized(requested.legacyLabel || requested.label);
  const button = buttons(root).find((candidate) => normalized(candidate.textContent).includes(target));
  if (button && button.getAttribute("aria-current") !== "page") button.click();
}

function syncSectionUrl(root: ParentNode) {
  const active = root.querySelector<HTMLButtonElement>(
    '.story-rail nav button.active, .story-rail nav button[aria-current="page"]',
  );
  const item = itemForButton(active);
  if (!item) return;
  const url = new URL(window.location.href);
  if (url.searchParams.get("workspace") !== "plan") return;
  if (url.searchParams.get("section") === item.id) return;
  url.searchParams.set("section", item.id);
  window.history.replaceState({}, "", url);
}

export default function PlanStudioRailHost() {
  useEffect(() => {
    let activeRail: HTMLElement | null = null;
    let activeObserver: MutationObserver | null = null;
    let requestedSectionApplied = false;

    const sync = () => {
      const plannerContent = document.querySelector<HTMLElement>(".planner-content");
      const studioLayout = plannerContent?.closest<HTMLElement>(".studio-layout") || null;
      const rail = studioLayout?.querySelector<HTMLElement>(".story-rail") || null;

      if (!plannerContent || !studioLayout || !rail) {
        activeObserver?.disconnect();
        activeObserver = null;
        activeRail = null;
        requestedSectionApplied = false;
        return;
      }

      if (!requestedSectionApplied) {
        requestedSectionApplied = true;
        window.setTimeout(() => {
          applyRequestedSection(studioLayout);
          syncSectionUrl(studioLayout);
        }, 0);
      }

      if (activeRail !== rail) {
        activeObserver?.disconnect();
        activeRail = rail;
        activeObserver = new MutationObserver(() => syncSectionUrl(studioLayout));
        activeObserver.observe(rail, {
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "aria-current"],
        });
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", sync);

    return () => {
      observer.disconnect();
      activeObserver?.disconnect();
      window.removeEventListener("popstate", sync);
    };
  }, []);

  return null;
}
