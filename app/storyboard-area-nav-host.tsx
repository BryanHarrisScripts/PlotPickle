"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./storyboard-area-nav-host.module.css";

type Tool = {
  label: string;
  legacyLabel?: string;
  virtual?: "versions";
};

type Area = {
  label: string;
  description: string;
  tools: Tool[];
};

const AREAS: Area[] = [
  {
    label: "Overview",
    description: "Visual readiness across the whole film.",
    tools: [{ label: "Visual overview" }],
  },
  {
    label: "Story World",
    description: "Identity, places, recurring assets and visual language.",
    tools: [
      { label: "Characters", legacyLabel: "Characters & identity locks" },
      { label: "Locations", legacyLabel: "Locations & world" },
      { label: "Props · vehicles · wardrobe", legacyLabel: "Props, vehicles & wardrobe" },
      { label: "Colour · lighting · language", legacyLabel: "Colour, lighting & language" },
    ],
  },
  {
    label: "Moments",
    description: "Direct the same 24 Blocks and 96 mini-block story moments.",
    tools: [
      { label: "24 Blocks", legacyLabel: "24-block storyboard" },
      { label: "96 Mini-blocks", legacyLabel: "96 mini-block frames" },
    ],
  },
  {
    label: "Continuity",
    description: "Find visual drift, missing references and unresolved locks.",
    tools: [{ label: "Review continuity", legacyLabel: "Continuity & missing assets" }],
  },
  {
    label: "Versions",
    description: "Review candidates, approved visuals and presentation references.",
    tools: [
      { label: "Selected moment versions", virtual: "versions" },
      { label: "Pitch & production references", legacyLabel: "Posters, pitch & production" },
    ],
  },
];

function normalized(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function legacyButtons(root: ParentNode) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('nav[aria-label="Visual Board sections"] button'));
}

function legacyLabel(button: HTMLButtonElement | null) {
  return normalized(button?.querySelector("strong")?.textContent || button?.textContent);
}

function activeLegacyButton(root: ParentNode) {
  return root.querySelector<HTMLButtonElement>('nav[aria-label="Visual Board sections"] button[aria-current]');
}

function areaFor(root: ParentNode) {
  const params = new URLSearchParams(window.location.search);
  if (params.get("decision") === "review") return "Versions";
  const active = legacyLabel(activeLegacyButton(root));
  for (const area of AREAS) {
    for (const tool of area.tools) {
      if (tool.virtual) continue;
      const target = normalized(tool.legacyLabel || tool.label);
      if (active.includes(target)) return area.label;
    }
  }
  return "Overview";
}

function activeToolFor(root: ParentNode, area: Area) {
  const params = new URLSearchParams(window.location.search);
  if (area.label === "Versions" && params.get("decision") === "review") return "Selected moment versions";
  const active = legacyLabel(activeLegacyButton(root));
  const match = area.tools.find((tool) => !tool.virtual && active.includes(normalized(tool.legacyLabel || tool.label)));
  return match?.label || "";
}

function clearDecisionFlag() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("decision")) return;
  url.searchParams.delete("decision");
  window.history.replaceState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function clickLegacy(root: ParentNode, tool: Tool) {
  const target = normalized(tool.legacyLabel || tool.label);
  const button = legacyButtons(root).find((candidate) => legacyLabel(candidate).includes(target));
  button?.click();
}

function openVersions(root: ParentNode) {
  clearDecisionFlag();
  clickLegacy(root, { label: "96 Mini-blocks", legacyLabel: "96 mini-block frames" });
  const url = new URL(window.location.href);
  url.searchParams.set("visualSection", "frames");
  url.searchParams.set("decision", "review");
  window.history.replaceState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function StoryboardAreaNavHost() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [areaLabel, setAreaLabel] = useState("Overview");
  const [activeTool, setActiveTool] = useState("");

  useEffect(() => {
    let host: HTMLElement | null = null;
    let legacyNav: HTMLElement | null = null;
    let stateObserver: MutationObserver | null = null;

    const sync = () => {
      const studio = document.querySelector<HTMLElement>(".visual-studio-layout");
      const nav = studio?.querySelector<HTMLElement>('nav[aria-label="Visual Board sections"]') || null;
      const parent = nav?.parentElement || null;

      if (!studio || !nav || !parent) {
        if (legacyNav) legacyNav.hidden = false;
        legacyNav = null;
        host?.remove();
        host = null;
        stateObserver?.disconnect();
        stateObserver = null;
        setTarget(null);
        setRoot(null);
        return;
      }

      if (!host || !host.isConnected || host.parentElement !== parent) {
        host?.remove();
        host = document.createElement("div");
        host.dataset.storyboardAreaNav = "true";
        parent.insertBefore(host, nav);
        setTarget(host);
      }

      if (legacyNav !== nav) {
        if (legacyNav) legacyNav.hidden = false;
        legacyNav = nav;
        legacyNav.hidden = true;
        stateObserver?.disconnect();
        stateObserver = new MutationObserver(() => {
          const nextArea = areaFor(studio);
          setAreaLabel(nextArea);
          const area = AREAS.find((item) => item.label === nextArea) || AREAS[0];
          setActiveTool(activeToolFor(studio, area));
        });
        stateObserver.observe(nav, { subtree: true, attributes: true, attributeFilter: ["class", "aria-current"] });
      }

      setRoot(studio);
      const nextArea = areaFor(studio);
      setAreaLabel(nextArea);
      const area = AREAS.find((item) => item.label === nextArea) || AREAS[0];
      setActiveTool(activeToolFor(studio, area));
    };

    const handleLocation = () => sync();
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", handleLocation);

    return () => {
      observer.disconnect();
      stateObserver?.disconnect();
      window.removeEventListener("popstate", handleLocation);
      if (legacyNav) legacyNav.hidden = false;
      host?.remove();
    };
  }, []);

  const activeArea = useMemo(() => AREAS.find((area) => area.label === areaLabel) || AREAS[0], [areaLabel]);

  if (!target || !root) return null;

  function openArea(area: Area) {
    if (area.label === "Versions") {
      openVersions(root!);
      setAreaLabel("Versions");
      setActiveTool("Selected moment versions");
      return;
    }
    clearDecisionFlag();
    const preferred = area.label === "Moments" ? area.tools[1] : area.tools[0];
    clickLegacy(root!, preferred);
    setAreaLabel(area.label);
    setActiveTool(preferred.label);
  }

  function openTool(tool: Tool) {
    if (tool.virtual === "versions") {
      openVersions(root!);
      setActiveTool(tool.label);
      return;
    }
    clearDecisionFlag();
    clickLegacy(root!, tool);
    setActiveTool(tool.label);
  }

  return createPortal(
    <aside className={styles.rail} aria-label="Storyboard creative areas">
      <header className={styles.header}>
        <p>Storyboard</p>
        <h2>Direct the film.</h2>
        <span>One story moment. Five creative areas.</span>
      </header>

      <nav className={styles.areas} aria-label="Storyboard areas">
        {AREAS.map((area, index) => (
          <button
            key={area.label}
            type="button"
            aria-current={area.label === activeArea.label ? "page" : undefined}
            className={area.label === activeArea.label ? styles.activeArea : ""}
            onClick={() => openArea(area)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{area.label}</strong>
            <small>{area.description}</small>
          </button>
        ))}
      </nav>

      <section className={styles.tools} aria-label={`${activeArea.label} tools`}>
        <p>{activeArea.label}</p>
        {activeArea.tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            aria-current={tool.label === activeTool ? "location" : undefined}
            className={tool.label === activeTool ? styles.activeTool : ""}
            onClick={() => openTool(tool)}
          >
            {tool.label}
          </button>
        ))}
      </section>

      <footer className={styles.footer}>
        <span>4 Acts</span>
        <span>24 Blocks</span>
        <span>96 moments</span>
      </footer>
    </aside>,
    target,
  );
}
